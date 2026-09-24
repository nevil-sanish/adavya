import { FieldValue, Timestamp, type DocumentData, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { z } from 'zod';
import { presenceStaleMs } from '../config/env.js';
import { nowMs } from '../lib/clock.js';
import { GameError } from '../lib/errors.js';
import { runGameTransaction } from '../lib/transaction.js';
import { newId } from '../lib/random.js';
import { refs } from './refs.js';
import { DEFAULT_SCORING_POLICY, placeCompletion } from './scoring.js';
import { taskModule, TASKS } from './tasks/index.js';
import type { ActionPlan, TaskModule, TeamContext } from './tasks/types.js';
import {
  REQUIRED_MEMBERS,
  TASK_ORDER,
  type CaptainLogEntry,
  type CompetitionDoc,
  type MemberDoc,
  type RankingGroup,
  type TaskId,
  type TaskRunDoc,
  type TeamDoc,
  type UserDoc,
} from './types.js';

const LOG_LIMIT = 25;

/* ------------------------------ team context ------------------------------ */

/** Loads the caller's fixed team from their profile. The client never names its team. */
export async function loadTeamContext(tx: Transaction, db: Firestore, uid: string): Promise<TeamContext & { caller: MemberDoc }> {
  const r = refs(db);
  const userSnap = await tx.get(r.user(uid));
  const user = userSnap.data() as UserDoc | undefined;
  if (!user) throw new GameError('PROFILE_NOT_FOUND', 'Sign in again to create your profile.', 404);
  if (!user.competitionId || !user.teamId) throw new GameError('NO_TEAM', 'Join a team first.', 403);

  const cid = user.competitionId;
  const teamId = user.teamId;
  const [teamSnap, membersSnap] = await Promise.all([tx.get(r.team(cid, teamId)), tx.get(r.members(cid, teamId))]);
  const team = teamSnap.data() as TeamDoc | undefined;
  if (!team) throw new GameError('TEAM_NOT_FOUND', 'Your team no longer exists.', 404);

  const members = membersSnap.docs.map((d) => d.data() as MemberDoc);
  const caller = members.find((m) => m.uid === uid);
  if (!caller) throw new GameError('NOT_A_MEMBER', 'You are not a member of this team.', 403);
  const captain = members.find((m) => m.role === 'CAPTAIN')!;
  const players = members.filter((m) => m.role === 'PLAYER').sort((a, b) => a.slot.localeCompare(b.slot));

  return { tx, db, r, cid, teamId, team, members, captain, players, caller };
}

/* ------------------------------- task start ------------------------------- */

interface PreparedStart {
  module: TaskModule;
  config: unknown;
  loaded: unknown;
}

export async function loadTaskConfig(ctx: TeamContext, module: TaskModule): Promise<unknown> {
  const snap = await ctx.tx.get(ctx.r.privateConfig(ctx.cid, module.taskId));
  const merged = { ...module.defaultConfig, ...((snap.data()?.config as object | undefined) ?? {}) };
  const parsed = module.configSchema.safeParse(merged);
  if (!parsed.success) {
    throw new GameError('COMPETITION_NOT_CONFIGURED', `${module.taskId} configuration is invalid: ${parsed.error.errors[0]?.message}`, 409);
  }
  return parsed.data;
}

/** Read phase for creating a run. */
async function prepareStart(ctx: TeamContext, taskId: TaskId): Promise<PreparedStart> {
  const module = TASKS[taskId];
  const config = await loadTaskConfig(ctx, module);
  const loaded = module.loadInit ? await module.loadInit(ctx, config) : undefined;
  return { module, config, loaded };
}

/** Write phase for creating a run: public run doc, hidden state, and role views. */
function writeRunStart(ctx: TeamContext, prepared: PreparedStart, startedAt: Timestamp): void {
  const { module, config, loaded } = prepared;
  const init = module.init(ctx, config, loaded);
  const { tx, r, cid, teamId } = ctx;

  const run: TaskRunDoc = {
    taskId: module.taskId,
    taskType: module.taskType,
    title: module.title,
    status: 'ACTIVE',
    runId: newId(),
    startedAt,
    completedAt: null,
  };
  tx.set(r.run(cid, teamId, module.taskId), run);
  tx.set(r.teamPrivate(cid, teamId, module.taskId), { ...init.privateState, config, seq: {} });
  tx.set(r.captainView(cid, teamId, module.taskId), {
    ...init.captainView,
    taskId: module.taskId,
    status: 'ACTIVE',
    startedAt,
    completedAt: null,
    completionRank: null,
    pointsAwarded: 0,
  });
  for (const player of ctx.players) {
    tx.set(r.playerView(cid, teamId, module.taskId, player.uid), { lastSeq: 0, ...(init.playerViews?.[player.uid] ?? {}) });
  }
  init.extraWrites?.(tx);
}

/**
 * The captain starts task01 once the team has exactly four members. This locks
 * the team: no more joins, and no display-name changes. Every task's
 * configuration is checked first so a later automatic start cannot fail.
 */
export async function startFirstTask(db: Firestore, uid: string): Promise<{ started: boolean }> {
  return runGameTransaction(db, async (tx) => {
    const ctx = await loadTeamContext(tx, db, uid);
    if (ctx.caller.role !== 'CAPTAIN') throw new GameError('CAPTAIN_ONLY', 'Only the captain can start the competition.', 403);
    if (ctx.team.status !== 'LOBBY') return { started: false };
    if (ctx.members.length !== REQUIRED_MEMBERS || ctx.team.memberCount !== REQUIRED_MEMBERS) {
      throw new GameError('TEAM_NOT_FULL', `A team needs exactly ${REQUIRED_MEMBERS} members to start.`, 409);
    }
    const comp = (await tx.get(ctx.r.competition(ctx.cid))).data() as CompetitionDoc | undefined;
    if (comp?.status !== 'ACTIVE') {
      throw new GameError('COMPETITION_NOT_ACTIVE', 'The competition has not opened yet. An organizer must set it to ACTIVE in /admin.', 409);
    }

    let first: PreparedStart | null = null;
    for (const taskId of TASK_ORDER) {
      const prepared = await prepareStart(ctx, taskId);
      if (taskId === 'task01') first = prepared;
    }

    const now = Timestamp.fromMillis(nowMs());
    tx.update(ctx.r.team(ctx.cid, ctx.teamId), { status: 'IN_PROGRESS', lockedAt: now, currentTaskId: 'task01' });
    tx.set(ctx.r.captainSummary(ctx.cid, ctx.teamId), { totalScore: 0, tasks: {} });
    writeRunStart(ctx, first!, now);
    return { started: true };
  });
}

/* ------------------------------- submissions ------------------------------ */

export const submissionEnvelope = z.object({
  runId: z.string().min(1).max(64),
  clientEventId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, 'clientEventId must be 8-64 url-safe characters'),
  clientSeq: z.number().int().positive(),
  payload: z.record(z.unknown()).default({}),
});

export interface SubmissionResult {
  duplicate: boolean;
  [key: string]: unknown;
}

/**
 * The single entry point for every task input.
 *
 * Identity, team, role and slot come from the auth token and stored membership.
 * The event must target the team's current task and active run (old-round events
 * are rejected), carry a fresh per-player sequence number (late and out-of-order
 * events are rejected), and is recorded under an idempotency key so a retried
 * request returns the original result without applying twice.
 */
export async function submitAction(
  db: Firestore,
  uid: string,
  taskId: string,
  actionName: string,
  body: unknown
): Promise<SubmissionResult> {
  const module = taskModule(taskId);
  const action = module?.actions[actionName];
  if (!module || !action) throw new GameError('UNKNOWN_ACTION', 'Unknown task action.', 404);

  const envelope = submissionEnvelope.safeParse(body);
  if (!envelope.success) throw new GameError('VALIDATION_ERROR', envelope.error.errors[0]?.message ?? 'Invalid submission', 400);
  const input = action.input.safeParse(envelope.data.payload);
  if (!input.success) throw new GameError('VALIDATION_ERROR', input.error.errors[0]?.message ?? 'Invalid input', 400);
  const { runId, clientEventId, clientSeq } = envelope.data;

  return runGameTransaction(db, async (tx) => {
    const ctx = await loadTeamContext(tx, db, uid);
    const { r, cid, teamId, caller } = ctx;
    if (ctx.team.status !== 'IN_PROGRESS' || ctx.team.currentTaskId !== taskId) {
      throw new GameError('TASK_NOT_CURRENT', 'This task is not your team’s current task.', 409);
    }

    const eventRef = r.event(cid, teamId, taskId, `${uid}_${clientEventId}`);
    const [runSnap, privateSnap, captainSnap, callerViewSnap, eventSnap] = await tx.getAll(
      r.run(cid, teamId, taskId),
      r.teamPrivate(cid, teamId, taskId),
      r.captainView(cid, teamId, taskId),
      r.playerView(cid, teamId, taskId, uid),
      eventRef
    );
    const run = runSnap.data() as TaskRunDoc | undefined;
    if (!run || run.status !== 'ACTIVE') throw new GameError('TASK_NOT_ACTIVE', 'This task is not active.', 409);
    if (run.runId !== runId) throw new GameError('STALE_RUN', 'This event belongs to an old round.', 409);

    if (eventSnap.exists) {
      return { ...(eventSnap.data()!.response as object), duplicate: true };
    }
    if (!action.roles.includes(caller.role)) {
      throw new GameError('ROLE_NOT_ALLOWED', 'Your role cannot perform this action.', 403);
    }
    if (caller.role !== 'CAPTAIN' && !isPresent(ctx.captain)) {
      throw new GameError('TEAM_PAUSED', 'Paused: waiting for the captain to reconnect.', 409);
    }

    const privateState = privateSnap.data() ?? {};
    const lastSeq = (privateState.seq?.[uid] as number | undefined) ?? 0;
    if (clientSeq <= lastSeq) throw new GameError('STALE_EVENT', 'This event is older than one already accepted.', 409);

    const captainView = captainSnap.data() ?? {};
    const plan = await action.prepare(
      { ...ctx, config: privateState.config, run, privateState, captainView, callerView: callerViewSnap.data() ?? {} },
      input.data
    );
    const completion = plan.complete ? await prepareCompletion(ctx, module.taskId) : null;

    // ------------------------------ writes ------------------------------
    if (!plan.mutating) return { ...plan.response, duplicate: false };

    applyPlan(ctx, module.taskId, plan, captainView, {
      ...(caller.role === 'CAPTAIN' ? { lastSeq: clientSeq } : {}),
      ...(completion ? completionCaptainFields(completion) : {}),
    });
    tx.set(r.teamPrivate(cid, teamId, taskId), { ...(plan.privatePatch ?? {}), seq: { [uid]: clientSeq } }, { merge: true });
    if (caller.role === 'PLAYER') {
      tx.set(r.playerView(cid, teamId, taskId, uid), { lastSeq: clientSeq }, { merge: true });
    }
    tx.set(eventRef, { uid, action: actionName, clientSeq, response: plan.response, createdAt: FieldValue.serverTimestamp() });
    if (completion) applyCompletion(ctx, run, completion);

    return { ...plan.response, duplicate: false };
  });
}

function isPresent(member: MemberDoc): boolean {
  const lastSeen = member.lastSeenAt?.toMillis?.() ?? 0;
  return member.isConnected !== false && Date.now() - lastSeen <= presenceStaleMs();
}

function applyPlan(ctx: TeamContext, taskId: TaskId, plan: ActionPlan, captainView: DocumentData, extraCaptain: DocumentData): void {
  const { tx, r, cid, teamId } = ctx;
  const at = Date.now();
  const log = [...((captainView.log as CaptainLogEntry[] | undefined) ?? []), ...(plan.log ?? []).map((e) => ({ ...e, at }))].slice(-LOG_LIMIT);
  tx.set(r.captainView(cid, teamId, taskId), { ...(plan.captainPatch ?? {}), log, ...extraCaptain }, { merge: true });
  for (const [playerUid, patch] of Object.entries(plan.playerViewPatches ?? {})) {
    tx.set(r.playerView(cid, teamId, taskId, playerUid), patch, { merge: true });
  }
  plan.extraWrites?.(tx);
}

/* ------------------------------- completion ------------------------------- */

interface PreparedCompletion {
  taskId: TaskId;
  completionMs: number;
  rank: number;
  points: number;
  groups: RankingGroup[];
  completedCount: number;
  next: PreparedStart | null;
}

/**
 * Read phase of completion. The per-task ranking document is read and rewritten
 * by every completing team, so Firestore serializes completions of the same task
 * across teams; the server clock is sampled inside that serialized section.
 */
async function prepareCompletion(ctx: TeamContext, taskId: TaskId): Promise<PreparedCompletion> {
  const [compSnap, rankingSnap] = await ctx.tx.getAll(ctx.r.competition(ctx.cid), ctx.r.taskResult(ctx.cid, taskId));
  const policy = (compSnap.data() as CompetitionDoc | undefined)?.scoringPolicy ?? DEFAULT_SCORING_POLICY;
  const ranking = rankingSnap.data() ?? {};
  const nextTaskId = TASK_ORDER[TASK_ORDER.indexOf(taskId) + 1];
  const next = nextTaskId ? await prepareStart(ctx, nextTaskId) : null;

  const completionMs = nowMs();
  const placed = placeCompletion((ranking.groups as RankingGroup[] | undefined) ?? [], completionMs, policy);
  return {
    taskId,
    completionMs,
    rank: placed.rank,
    points: placed.points,
    groups: placed.groups,
    completedCount: ((ranking.completedCount as number | undefined) ?? 0) + 1,
    next,
  };
}

function completionCaptainFields(c: PreparedCompletion): DocumentData {
  return {
    status: 'COMPLETED',
    completedAt: Timestamp.fromMillis(c.completionMs),
    completionRank: c.rank,
    pointsAwarded: c.points,
  };
}

/** Write phase of completion: rank once, points once, next task started once. */
function applyCompletion(ctx: TeamContext, run: TaskRunDoc, c: PreparedCompletion): void {
  const { tx, r, cid, teamId, team } = ctx;
  const completedAt = Timestamp.fromMillis(c.completionMs);

  tx.set(r.taskResult(cid, c.taskId), { taskId: c.taskId, groups: c.groups, completedCount: c.completedCount });
  tx.set(r.completion(cid, c.taskId, teamId), {
    teamId,
    teamName: team.teamName,
    teamCode: team.teamCode,
    rank: c.rank,
    points: c.points,
    completedAt,
    completedAtMs: c.completionMs,
    durationMs: c.completionMs - run.startedAt.toMillis(),
  });
  tx.update(r.run(cid, teamId, c.taskId), { status: 'COMPLETED', completedAt });
  tx.set(
    r.captainSummary(cid, teamId),
    { totalScore: FieldValue.increment(c.points), tasks: { [c.taskId]: { rank: c.rank, points: c.points, completedAtMs: c.completionMs } } },
    { merge: true }
  );

  if (c.next) {
    tx.update(r.team(cid, teamId), { currentTaskId: c.next.module.taskId });
    writeRunStart(ctx, c.next, completedAt);
  } else {
    tx.update(r.team(cid, teamId), { status: 'COMPLETED', currentTaskId: null, completedAt });
  }
}

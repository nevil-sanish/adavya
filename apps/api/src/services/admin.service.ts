import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { GameError } from '../lib/errors.js';
import { runGameTransaction } from '../lib/transaction.js';
import { refs } from '../game/refs.js';
import { DEFAULT_SCORING_POLICY } from '../game/scoring.js';
import { taskModule, TASKS } from '../game/tasks/index.js';
import { computeLeaderboards } from './leaderboard.service.js';
import { formableWords } from '../game/words.js';
import { assignmentProblem, assignmentSchema, DEFAULT_ASSIGNMENT, locationPoolSchema, type Assignment, type LocationConfig } from '../game/tasks/task02.js';
import { TASK_ORDER, type CompetitionDoc, type MemberDoc, type TeamDoc } from '../game/types.js';

export const scoringPolicySchema = z.object({
  pointsByRank: z.record(z.string().regex(/^\d+$/), z.number().min(0).max(100_000)),
  tieWindowMs: z.number().int().min(0).max(60_000),
  tieMode: z.literal('DENSE'),
});

const competitionPatchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED']).optional(),
  scoringPolicy: scoringPolicySchema.optional(),
});

/** Creates the competition document and public task definitions if missing. Safe to re-run. */
export async function ensureCompetition(db: Firestore, cid: string, name = 'Team Challenge'): Promise<void> {
  const r = refs(db);
  await runGameTransaction(db, async (tx) => {
    const snap = await tx.get(r.competition(cid));
    if (!snap.exists) {
      const comp = {
        name,
        status: 'DRAFT',
        taskOrder: [...TASK_ORDER],
        scoringPolicy: DEFAULT_SCORING_POLICY,
        createdAt: FieldValue.serverTimestamp(),
        startedAt: null,
      };
      tx.set(r.competition(cid), comp);
    }
    TASK_ORDER.forEach((taskId, i) => {
      const m = TASKS[taskId];
      tx.set(r.taskDefinition(cid, taskId), { taskId, taskType: m.taskType, title: m.title, description: m.description, order: i + 1 });
    });
  });
}

export async function updateCompetition(db: Firestore, cid: string, body: unknown): Promise<void> {
  const parsed = competitionPatchSchema.safeParse(body);
  if (!parsed.success) throw new GameError('VALIDATION_ERROR', parsed.error.errors[0]?.message ?? 'Invalid competition');
  const patch: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === 'ACTIVE') patch.startedAt = FieldValue.serverTimestamp();
  const ref = refs(db).competition(cid);
  if (!(await ref.get()).exists) throw new GameError('NOT_FOUND', 'Competition does not exist. Run the setup script.', 404);
  await ref.update(patch);
}

/**
 * Replaces the ten global Task 2 locations. Runs already started keep their own
 * copy. Editing a hint changes nothing else; assignments reference locations by id.
 */
export async function setLocations(db: Firestore, cid: string, body: unknown): Promise<void> {
  const parsed = locationPoolSchema.safeParse((body as { locations?: unknown })?.locations);
  if (!parsed.success) throw new GameError('VALIDATION_ERROR', parsed.error.errors[0]?.message ?? 'Invalid locations');
  const col = refs(db).locations(cid);
  const existing = await col.get();
  const batch = db.batch();
  existing.docs.forEach((d) => batch.delete(d.ref));
  parsed.data.forEach((l) => batch.set(col.doc(l.locationId), l));
  batch.set(refs(db).privateConfig(cid, 'task02'), { updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();
}

/**
 * Sets the Task 2 assignment for one team, or for `_default` (every team without
 * its own): five locations in hint order, three correct, and the intended word.
 */
export async function setAssignment(db: Firestore, cid: string, key: string, body: unknown): Promise<Assignment> {
  const r = refs(db);
  if (key !== DEFAULT_ASSIGNMENT && !(await r.team(cid, key).get()).exists) throw new GameError('NOT_FOUND', 'Unknown team.', 404);
  const parsed = assignmentSchema.safeParse(body);
  if (!parsed.success) throw new GameError('VALIDATION_ERROR', parsed.error.errors[0]?.message ?? 'Invalid assignment');
  const pool = locationPoolSchema.safeParse((await r.locations(cid).get()).docs.map((d) => d.data()));
  if (!pool.success) throw new GameError('VALIDATION_ERROR', 'Configure the ten locations before assigning them.');
  const problem = assignmentProblem(parsed.data, pool.data);
  if (problem) throw new GameError('VALIDATION_ERROR', problem);
  await r.assignment(cid, key).set({ ...parsed.data, updatedAt: FieldValue.serverTimestamp() });
  return parsed.data;
}

/** Removes a team's own assignment so it falls back to `_default`. */
export async function deleteAssignment(db: Firestore, cid: string, key: string): Promise<void> {
  await refs(db).assignment(cid, key).delete();
}

/** Why a team cannot play Task 2 yet, or null when its assignment is valid. */
function assignmentStatus(
  teamId: string,
  assignments: Map<string, Assignment>,
  pool: LocationConfig[] | null,
  task02: { assignmentMode: 'RANDOM' | 'MANUAL'; words: string[] }
): { source: 'TEAM' | 'RANDOM' | 'DEFAULT' | 'NONE'; problem: string | null } {
  const own = assignments.get(teamId);
  if (!own && task02.assignmentMode === 'RANDOM') {
    if (!pool) return { source: 'RANDOM', problem: 'Locations are not configured' };
    return { source: 'RANDOM', problem: formableWords(task02.words, pool).length ? null : 'No word in the word list can be spelled from the location letters' };
  }
  const assignment = own ?? assignments.get(DEFAULT_ASSIGNMENT);
  const source = own ? 'TEAM' : assignment ? 'DEFAULT' : 'NONE';
  if (!pool) return { source, problem: 'Locations are not configured' };
  if (!assignment) return { source, problem: 'No assignment' };
  return { source, problem: assignmentProblem(assignment, pool) };
}

export async function setTaskConfig(db: Firestore, cid: string, taskId: string, body: unknown): Promise<unknown> {
  const m = taskModule(taskId);
  if (!m) throw new GameError('NOT_FOUND', 'Unknown task.', 404);
  const parsed = m.configSchema.safeParse({ ...m.defaultConfig, ...((body as { config?: object })?.config ?? {}) });
  if (!parsed.success) throw new GameError('VALIDATION_ERROR', parsed.error.errors[0]?.message ?? 'Invalid configuration');
  await refs(db).privateConfig(cid, taskId).set({ config: parsed.data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return parsed.data;
}

/** Everything an operator needs: config state, teams, rosters, scores and per-task ranking. */
export async function getOverview(db: Firestore, cid: string) {
  const r = refs(db);
  const [compSnap, teamsSnap, locationsSnap, assignmentsSnap, configSnaps] = await Promise.all([
    r.competition(cid).get(),
    r.teams(cid).get(),
    r.locations(cid).get(),
    r.assignments(cid).get(),
    Promise.all(TASK_ORDER.map((t) => r.privateConfig(cid, t).get())),
  ]);
  const comp = compSnap.data() as CompetitionDoc | undefined;
  const task02Index = TASK_ORDER.indexOf('task02');
  const task02Config = {
    ...(TASKS.task02.defaultConfig as { assignmentMode: 'RANDOM' | 'MANUAL'; words: string[] }),
    ...((configSnaps[task02Index].data()?.config as object) ?? {}),
  };
  const usedWords = (configSnaps[task02Index].data()?.usedWords as Record<string, number> | undefined) ?? {};
  const locations = locationsSnap.docs.map((d) => d.data() as LocationConfig).sort((a, b) => a.locationId.localeCompare(b.locationId));
  const pool = locationPoolSchema.safeParse(locations);
  const assignments = new Map(
    assignmentsSnap.docs.flatMap((d) => {
      const parsed = assignmentSchema.safeParse(d.data());
      return parsed.success ? [[d.id, parsed.data] as const] : [];
    })
  );

  const teams = await Promise.all(
    teamsSnap.docs.map(async (d) => {
      const team = d.data() as TeamDoc;
      const [membersSnap, summarySnap] = await Promise.all([r.members(cid, d.id).get(), r.captainSummary(cid, d.id).get()]);
      return {
        teamId: d.id,
        teamName: team.teamName,
        teamCode: team.teamCode,
        status: team.status,
        currentTaskId: team.currentTaskId,
        memberCount: team.memberCount,
        totalScore: (summarySnap.data()?.totalScore as number | undefined) ?? 0,
        task02: assignmentStatus(d.id, assignments, pool.success ? pool.data : null, task02Config),
        // What the team was actually given, once it reached Level 02.
        task02Given: await (async () => {
          const given = (await r.teamPrivate(cid, d.id, 'task02').get()).data();
          return given
            ? {
                word: given.word as string,
                locationIds: (given.assigned as Array<{ locationId: string; classification: string }>).map(
                  (l) => `${l.locationId}${l.classification === 'CORRECT' ? '✓' : ''}`
                ),
              }
            : null;
        })(),
        members: membersSnap.docs.map((m) => {
          const member = m.data() as MemberDoc;
          return { uid: member.uid, displayName: member.displayName, slot: member.slot, lastSeenAtMs: member.lastSeenAt?.toMillis?.() ?? null };
        }),
      };
    })
  );

  const results = Object.fromEntries(
    await Promise.all(
      TASK_ORDER.map(async (taskId) => {
        const snap = await r.taskResult(cid, taskId).collection('completions').orderBy('completedAtMs').get();
        return [taskId, snap.docs.map((c) => c.data())] as const;
      })
    )
  );

  return {
    competitionId: cid,
    leaderboards: await computeLeaderboards(db, cid),
    competition: comp ? { name: comp.name, status: comp.status, scoringPolicy: comp.scoringPolicy, taskOrder: comp.taskOrder } : null,
    locations,
    locationsProblem: pool.success ? null : pool.error.errors[0]?.message ?? 'Invalid locations',
    assignments: Object.fromEntries(assignments),
    task02Random: {
      mode: task02Config.assignmentMode,
      spellableWords: pool.success ? formableWords(task02Config.words, pool.data) : [],
      usedWords,
    },
    taskConfigs: Object.fromEntries(
      TASK_ORDER.map((taskId, i) => [taskId, { ...TASKS[taskId].defaultConfig, ...((configSnaps[i].data()?.config as object) ?? {}) }])
    ),
    teams: teams.sort((a, b) => b.totalScore - a.totalScore || a.teamName.localeCompare(b.teamName)),
    results,
  };
}

/**
 * Deletes competition progress. With `keepTeams`, teams and rosters survive and
 * return to the lobby; otherwise teams, codes and memberships are removed too.
 * Configuration (locations, task configs, scoring) is always kept.
 */
export async function resetCompetition(db: Firestore, cid: string, keepTeams: boolean): Promise<{ teams: number }> {
  const r = refs(db);
  for (const taskId of TASK_ORDER) await db.recursiveDelete(r.taskResult(cid, taskId));
  // Random Level 02 words start fresh.
  await r.privateConfig(cid, 'task02').set({ usedWords: FieldValue.delete() }, { merge: true });
  const teamsSnap = await r.teams(cid).get();

  for (const teamDoc of teamsSnap.docs) {
    const team = teamDoc.data() as TeamDoc;
    await db.recursiveDelete(teamDoc.ref.collection('taskRuns'));
    await db.recursiveDelete(teamDoc.ref.collection('private'));
    await db.recursiveDelete(teamDoc.ref.collection('captain'));
    if (keepTeams) {
      await teamDoc.ref.update({ status: 'LOBBY', currentTaskId: null, lockedAt: null, completedAt: null });
      continue;
    }
    const members = await r.members(cid, teamDoc.id).get();
    const batch = db.batch();
    members.docs.forEach((m) =>
      batch.set(r.user(m.id), { competitionId: null, teamId: null, role: null, slot: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    );
    batch.delete(r.teamDirectory(team.teamCode));
    await batch.commit();
    await db.recursiveDelete(teamDoc.ref);
  }
  return { teams: teamsSnap.size };
}

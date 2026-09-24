import { Router, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../config/firebase.js';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth.middleware.js';

export const roundRouter = Router();

/** Play order of a team's `round_status`. The team finishes after the last round. */
const ROUND_ORDER = ['round1', 'round2', 'round3'] as const;
type RoundId = (typeof ROUND_ORDER)[number];
type RoundStatus = 'not_started' | RoundId | 'completed';

/** Position in play order; `not_started` counts as round 1 and `completed` sits past the end. */
function roundIndex(status: string): number {
  if (status === 'completed') return ROUND_ORDER.length;
  const i = ROUND_ORDER.indexOf(status as RoundId);
  return i === -1 ? 0 : i;
}

/** Poses the field phones can recognise. Ids are shared with the phone app. */
const POSES = ['t_pose', 'both_hands_up', 'one_hand_up_one_down'] as const;
/** Round 3 performer slots; Player A is the communicator at the monitor. */
const POSE_SLOTS = ['B', 'C', 'D'] as const;

const verifyCodeSchema = z.object({
  code: z.string().trim().min(1, 'Code is required').max(64),
});

const verifyWordsSchema = z.object({
  words: z.array(z.string().trim().min(1, 'Fill in all three words').max(64)).length(3, 'Exactly three words are required'),
});

const normalizeCode = (code: string) => code.trim().toUpperCase();
const normalizeWord = (word: string) => word.trim().toLowerCase();

const teamRefOf = (teamId: string) => getDb().collection('teams').doc(teamId);

const roundEntryRef = (round: RoundId, teamId: string) =>
  getDb().collection('rounds').doc(round).collection('teams').doc(teamId);

/** Resolves the caller's team, or sends 403 and returns null. */
async function resolveTeamId(req: AuthenticatedRequest, res: Response): Promise<string | null> {
  const userSnap = await getDb().collection('users').doc(req.user!.uid).get();
  const teamId = userSnap.data()?.teamId as string | undefined;
  if (!teamId) {
    res.status(403).json({ error: 'NO_TEAM', message: 'Join a team before playing.' });
    return null;
  }
  return teamId;
}

async function getRoundStatus(teamId: string): Promise<RoundStatus> {
  return ((await teamRefOf(teamId).get()).data()?.round_status as RoundStatus | undefined) ?? 'not_started';
}

function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A fresh Round 3 entry: each performer slot gets a random pose. */
function newRound3Entry(teamId: string, now: string) {
  const poses = shuffled(POSES);
  return {
    teamID: teamId,
    assignments: Object.fromEntries(POSE_SLOTS.map((slot, i) => [slot, poses[i % poses.length]])),
    verified: Object.fromEntries(POSE_SLOTS.map((slot) => [slot, false])),
    startedAt: now,
  };
}

/**
 * Finishes `from` and unlocks the round after it, in one batch.
 * Called when a round is solved, and by the dev skip.
 */
async function advanceTeam(teamId: string, from: RoundStatus, completion: Record<string, unknown> = {}): Promise<RoundStatus> {
  const now = new Date();
  const nowIso = now.toISOString();
  const nextIndex = roundIndex(from) + 1;
  const next: RoundStatus = nextIndex >= ROUND_ORDER.length ? 'completed' : ROUND_ORDER[nextIndex];

  const batch = getDb().batch();
  if (from !== 'not_started' && from !== 'completed') {
    const currentRef = roundEntryRef(from, teamId);
    const startedAt = (await currentRef.get()).data()?.startedAt as string | undefined;
    const durationSeconds = startedAt ? Math.round((now.getTime() - new Date(startedAt).getTime()) / 1000) : null;
    batch.set(currentRef, { completedAt: nowIso, durationSeconds, ...completion }, { merge: true });
  }

  if (next === 'round2') {
    batch.set(roundEntryRef('round2', teamId), { startedAt: nowIso }, { merge: true });
  } else if (next === 'round3') {
    batch.set(roundEntryRef('round3', teamId), newRound3Entry(teamId, nowIso));
  }

  batch.set(
    teamRefOf(teamId),
    next === 'completed' ? { round_status: next, finished_at: nowIso } : { round_status: next },
    { merge: true }
  );
  await batch.commit();
  return next;
}

/* --------------------------------- round 1 -------------------------------- */

/**
 * POST /api/rounds/round1/verify
 * The field phones reveal a code once the rotation sequence is done; HQ enters it here.
 * The expected code lives in rounds/round1/teams/{teamId}.code and never reaches the browser.
 */
roundRouter.post('/round1/verify', requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const result = verifyCodeSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: result.error.errors[0]?.message || 'Invalid code',
    });
    return;
  }

  const teamId = await resolveTeamId(req, res);
  if (!teamId) return;

  const status = await getRoundStatus(teamId);
  if (roundIndex(status) > 0) {
    res.status(200).json({ correct: true, message: 'Round 1 is already complete.' });
    return;
  }

  const expected = (await roundEntryRef('round1', teamId).get()).data()?.code as string | undefined;
  if (!expected) {
    res.status(404).json({ error: 'ROUND_NOT_READY', message: 'Round 1 has not been set up for your team yet.' });
    return;
  }

  if (normalizeCode(result.data.code) !== normalizeCode(expected)) {
    res.status(200).json({ correct: false, message: 'Incorrect code. Try the sequence again.' });
    return;
  }

  await advanceTeam(teamId, 'round1');
  res.status(200).json({ correct: true, message: 'Code verified. Round 1 complete!' });
});

/* --------------------------------- round 2 -------------------------------- */

/**
 * GET /api/rounds/round2
 * Returns the team's round status and, once Round 2 is unlocked, its clues.
 * The answer sequence stays on the server.
 */
roundRouter.get('/round2', requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const teamId = await resolveTeamId(req, res);
  if (!teamId) return;

  const roundStatus = await getRoundStatus(teamId);
  if (roundIndex(roundStatus) < 1) {
    res.status(200).json({ roundStatus, clues: [] });
    return;
  }

  const round = (await roundEntryRef('round2', teamId).get()).data();
  res.status(200).json({
    roundStatus,
    clues: (round?.cluesGenerated as string[] | undefined) ?? [],
    completedAt: round?.completedAt ?? null,
  });
});

/**
 * POST /api/rounds/round2/verify
 * HQ submits the three words the field team found, in order.
 */
roundRouter.post('/round2/verify', requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const result = verifyWordsSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: result.error.errors[0]?.message || 'Invalid words',
    });
    return;
  }

  const teamId = await resolveTeamId(req, res);
  if (!teamId) return;

  const status = await getRoundStatus(teamId);
  if (roundIndex(status) > 1) {
    res.status(200).json({ correct: true, message: 'Round 2 is already complete.' });
    return;
  }
  if (status !== 'round2') {
    res.status(403).json({ error: 'ROUND_LOCKED', message: 'Finish Round 1 before submitting Round 2.' });
    return;
  }

  const expected = (await roundEntryRef('round2', teamId).get()).data()?.sequence as string[] | undefined;
  if (!expected || expected.length !== 3) {
    res.status(404).json({ error: 'ROUND_NOT_READY', message: 'Round 2 has not been set up for your team yet.' });
    return;
  }

  const isMatch = result.data.words.every((word, i) => normalizeWord(word) === normalizeWord(expected[i]));
  if (!isMatch) {
    res.status(200).json({ correct: false, message: 'That combination is not right. Check the words and their order.' });
    return;
  }

  await advanceTeam(teamId, 'round2');
  res.status(200).json({ correct: true, message: 'Correct! Round 2 complete.' });
});

/* --------------------------------- round 3 -------------------------------- */

/**
 * GET /api/rounds/round3
 * Returns the team id and the pose assigned to each performer, creating the
 * assignment if the team reached Round 3 before it existed. Live verification
 * status is read by the client straight from rounds/round3/teams/{teamId}.
 */
roundRouter.get('/round3', requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const teamId = await resolveTeamId(req, res);
  if (!teamId) return;

  const roundStatus = await getRoundStatus(teamId);
  if (roundIndex(roundStatus) < 2) {
    res.status(403).json({ error: 'ROUND_LOCKED', message: 'Finish Round 2 to unlock Round 3.' });
    return;
  }

  const ref = roundEntryRef('round3', teamId);
  const entry = await getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.data();
    if (existing?.assignments) return existing;
    const fresh = newRound3Entry(teamId, new Date().toISOString());
    tx.set(ref, fresh, { merge: true });
    return fresh;
  });

  res.status(200).json({ roundStatus, teamId, assignments: entry.assignments });
});

/**
 * POST /api/rounds/round3/complete
 * Called by the monitor once every performer shows as verified. The server re-reads
 * the phones' results so the monitor cannot finish the round on its own say-so.
 */
roundRouter.post('/round3/complete', requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const teamId = await resolveTeamId(req, res);
  if (!teamId) return;

  const status = await getRoundStatus(teamId);
  if (roundIndex(status) > 2) {
    res.status(200).json({ correct: true, message: 'Round 3 is already complete.' });
    return;
  }
  if (status !== 'round3') {
    res.status(403).json({ error: 'ROUND_LOCKED', message: 'Finish Round 2 to unlock Round 3.' });
    return;
  }

  const verified = ((await roundEntryRef('round3', teamId).get()).data()?.verified ?? {}) as Record<string, boolean>;
  const pending = POSE_SLOTS.filter((slot) => verified[slot] !== true);
  if (pending.length > 0) {
    res.status(200).json({ correct: false, message: `Still waiting on Player ${pending.join(', ')}.` });
    return;
  }

  await advanceTeam(teamId, 'round3');
  res.status(200).json({ correct: true, message: 'All poses verified. Round 3 complete!' });
});

/* ---------------------------------- team ---------------------------------- */

interface StoredMember {
  id?: string;
  googleId?: string;
  email?: string;
  name?: string;
  role?: string;
}

/**
 * GET /api/rounds/progress
 * The caller's team roster and how far the team has got, for the workspace sidebar and pipeline.
 */
roundRouter.get('/progress', requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const teamId = await resolveTeamId(req, res);
  if (!teamId) return;

  const db = getDb();
  const team = (await teamRefOf(teamId).get()).data() ?? {};

  // Teams created through the API store member objects; seeded teams only store ids.
  let members: StoredMember[] = Array.isArray(team.members) ? team.members : [];
  if (members.length === 0 && Array.isArray(team.members_id)) {
    const snaps = await Promise.all(
      (team.members_id as string[]).map((id) => db.collection('users').doc(id).get())
    );
    members = snaps.map((snap, i) => ({ googleId: snap.id, ...snap.data(), id: (team.members_id as string[])[i] }));
  }

  const captainId = team.captain_id as string | undefined;
  res.status(200).json({
    teamId,
    teamName: (team.name ?? team.team_name ?? teamId) as string,
    roundStatus: (team.round_status as string | undefined) ?? 'not_started',
    members: members.map((m) => {
      const uid = m.googleId ?? m.id ?? '';
      return {
        uid,
        name: m.name || m.email?.split('@')[0] || 'Unnamed player',
        email: m.email ?? '',
        isCaptain: m.role === 'owner' || (captainId !== undefined && (uid === captainId || m.id === captainId)),
        isYou: uid === req.user!.uid,
      };
    }),
  });
});

/* ----------------------------------- dev ---------------------------------- */

/**
 * POST /api/rounds/dev/advance
 * Development only: moves the caller's team to the next task without solving the current one.
 */
roundRouter.post('/dev/advance', requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (process.env.NODE_ENV !== 'development') {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Endpoint does not exist.' });
    return;
  }

  const teamId = await resolveTeamId(req, res);
  if (!teamId) return;

  const current = await getRoundStatus(teamId);
  if (current === 'completed') {
    res.status(409).json({ error: 'NO_NEXT_TASK', message: 'Your team is already on the last task.' });
    return;
  }

  const next = await advanceTeam(teamId, current, { skipped: true });
  console.log(`[Dev] Team ${teamId} advanced from ${current} to ${next} by ${req.user!.email}`);
  res.status(200).json({ roundStatus: next });
});

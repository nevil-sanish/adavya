import type { Firestore } from 'firebase-admin/firestore';
import { activeCompetitionId, adminEmails } from '../config/env.js';
import { GameError } from '../lib/errors.js';
import { refs } from '../game/refs.js';
import { TASK_ORDER, type TaskId, type TeamDoc, type UserDoc } from '../game/types.js';

export interface TeamStanding {
  teamId: string;
  teamName: string;
  totalScore: number;
  tasksCompleted: number;
  currentTaskId: TaskId | null;
  finished: boolean;
  /** Server time the sixth task was completed. */
  completedAtMs: number | null;
  /** From the captain starting task01 to completing task06. */
  durationMs: number | null;
}

export interface Leaderboards {
  /** Highest points first; equal points are broken by who finished earlier. */
  points: Array<TeamStanding & { rank: number }>;
  /** Finished teams by completion time, then unfinished teams by progress (rank null). */
  finishOrder: Array<TeamStanding & { rank: number | null }>;
  generatedAtMs: number;
}

/** Orders standings into the two boards. Pure, so it can be tested without Firestore. */
export function rankStandings(standings: readonly TeamStanding[]): Omit<Leaderboards, 'generatedAtMs'> {
  const byFinish = (a: TeamStanding, b: TeamStanding) =>
    (a.completedAtMs ?? Infinity) - (b.completedAtMs ?? Infinity) || b.tasksCompleted - a.tasksCompleted;

  const points = [...standings]
    .sort((a, b) => b.totalScore - a.totalScore || byFinish(a, b) || a.teamName.localeCompare(b.teamName))
    .map((s, i) => ({ ...s, rank: i + 1 }));

  const finished = standings.filter((s) => s.finished).sort(byFinish);
  const unfinished = standings
    .filter((s) => !s.finished)
    .sort((a, b) => b.tasksCompleted - a.tasksCompleted || b.totalScore - a.totalScore || a.teamName.localeCompare(b.teamName));
  const finishOrder = [...finished.map((s, i) => ({ ...s, rank: i + 1 })), ...unfinished.map((s) => ({ ...s, rank: null }))];

  return { points, finishOrder };
}

/** Both final leaderboards for a competition, from team documents and captain summaries. */
export async function computeLeaderboards(db: Firestore, cid: string): Promise<Leaderboards> {
  const r = refs(db);
  const teamsSnap = await r.teams(cid).get();
  const standings = await Promise.all(
    teamsSnap.docs
      .map((d) => d.data() as TeamDoc)
      .filter((t) => t.status !== 'LOBBY')
      .map(async (t): Promise<TeamStanding> => {
        const summary = (await r.captainSummary(cid, t.teamId).get()).data() as
          | { totalScore?: number; tasks?: Partial<Record<TaskId, unknown>> }
          | undefined;
        const completedAtMs = t.completedAt?.toMillis?.() ?? null;
        const lockedAtMs = t.lockedAt?.toMillis?.() ?? null;
        return {
          teamId: t.teamId,
          teamName: t.teamName,
          totalScore: summary?.totalScore ?? 0,
          tasksCompleted: TASK_ORDER.filter((id) => summary?.tasks?.[id]).length,
          currentTaskId: t.currentTaskId,
          finished: t.status === 'COMPLETED',
          completedAtMs,
          durationMs: completedAtMs !== null && lockedAtMs !== null ? completedAtMs - lockedAtMs : null,
        };
      })
  );
  return { ...rankStandings(standings), generatedAtMs: Date.now() };
}

/**
 * Leaderboards for a signed-in user. Scores of other teams are revealed only at
 * the end: to a team once it has completed all six tasks, and to admins always.
 */
export async function getLeaderboardsFor(db: Firestore, uid: string, email: string): Promise<Leaderboards & { yourTeamId: string | null }> {
  const r = refs(db);
  const user = (await r.user(uid).get()).data() as UserDoc | undefined;
  const isAdmin = adminEmails().has(email);
  if (!isAdmin) {
    if (!user?.competitionId || !user.teamId) throw new GameError('NO_TEAM', 'Join a team first.', 403);
    const team = (await r.team(user.competitionId, user.teamId).get()).data() as TeamDoc | undefined;
    if (team?.status !== 'COMPLETED') {
      throw new GameError('LEADERBOARD_LOCKED', 'The leaderboard opens once your team has completed all six tasks.', 403);
    }
  }
  const cid = user?.competitionId ?? activeCompetitionId();
  return { ...(await computeLeaderboards(db, cid)), yourTeamId: user?.teamId ?? null };
}

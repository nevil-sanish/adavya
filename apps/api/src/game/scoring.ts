import type { RankingGroup, ScoringPolicy } from './types.js';

export const DEFAULT_SCORING_POLICY: ScoringPolicy = {
  pointsByRank: { '1': 100, '2': 90, '3': 80, '4': 70 },
  tieWindowMs: 1000,
  tieMode: 'DENSE',
};

export function pointsForRank(policy: ScoringPolicy, rank: number): number {
  const points = policy.pointsByRank[String(rank)];
  return typeof points === 'number' && Number.isFinite(points) ? points : 0;
}

/**
 * Places a completion into the task's existing groups.
 *
 * A group is anchored at its first completion; a later completion within
 * `tieWindowMs` of the latest group's anchor joins it with the same rank and
 * points. Otherwise it opens the next dense rank. Completions are serialized by
 * the ranking transaction, so a time earlier than the latest anchor (clock
 * jitter between attempts) joins the latest group rather than reordering history.
 */
export function placeCompletion(
  groups: readonly RankingGroup[],
  completionMs: number,
  policy: ScoringPolicy
): { rank: number; points: number; groups: RankingGroup[] } {
  const last = groups[groups.length - 1];
  if (last && completionMs - last.anchorMs <= policy.tieWindowMs) {
    const updated = groups.map((g) => (g === last ? { ...g, teamCount: g.teamCount + 1 } : g));
    return { rank: last.rank, points: last.points, groups: updated };
  }
  const rank = last ? last.rank + 1 : 1;
  const points = pointsForRank(policy, rank);
  return { rank, points, groups: [...groups, { rank, anchorMs: completionMs, points, teamCount: 1 }] };
}

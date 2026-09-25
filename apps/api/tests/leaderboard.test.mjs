import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { rankStandings, getLeaderboardsFor } from '../dist/services/leaderboard.service.js';
import { startFirstTask } from '../dist/game/engine.js';
import { setClock } from '../dist/lib/clock.js';
import { newTeam, openCompetition, skip, solveTask, testDb } from './helpers.mjs';

const TASKS = ['task01', 'task02', 'task03', 'task04', 'task05', 'task06'];
const standing = (teamName, totalScore, completedAtMs, tasksCompleted = 6) => ({
  teamId: teamName,
  teamName,
  totalScore,
  tasksCompleted,
  currentTaskId: completedAtMs ? null : `task0${tasksCompleted + 1}`,
  finished: completedAtMs !== null,
  completedAtMs,
  durationMs: completedAtMs,
});

test('points board: highest points first, equal points broken by earlier finish', () => {
  const { points } = rankStandings([
    standing('Late 500', 500, 9000),
    standing('Early 500', 500, 5000),
    standing('Top 560', 560, 7000),
    standing('Unfinished 500', 500, null, 5),
  ]);
  assert.deepEqual(points.map((s) => [s.rank, s.teamName]), [
    [1, 'Top 560'],
    [2, 'Early 500'],
    [3, 'Late 500'],
    [4, 'Unfinished 500'],
  ]);
});

test('finish-order board: finishers by completion time, then unfinished teams by progress without a rank', () => {
  const { finishOrder } = rankStandings([
    standing('Second', 300, 8000),
    standing('Stuck on 3', 200, null, 2),
    standing('First', 100, 4000),
    standing('Stuck on 6', 500, null, 5),
  ]);
  assert.deepEqual(finishOrder.map((s) => [s.rank, s.teamName]), [
    [1, 'First'],
    [2, 'Second'],
    [null, 'Stuck on 6'],
    [null, 'Stuck on 3'],
  ]);
});

describe('leaderboards over real games', { skip }, () => {
  const CID = 'leaderboard-tests';
  let db;
  before(async () => {
    db = testDb(CID);
    await openCompetition(db, CID);
  });
  after(() => setClock(null));

  test('opens for a team only after it completes; boards reflect points and finish order', async () => {
    const [a, b, c] = await Promise.all([newTeam(db, 'LB A'), newTeam(db, 'LB B'), newTeam(db, 'LB C')]);
    await Promise.all([a, b, c].map((t) => startFirstTask(db, t.captain)));

    // B wins task01 alone (100 points); A and C tie later for rank 2.
    setClock(() => 1_000_000);
    await solveTask(db, b, 'task01');
    setClock(() => 1_010_000);
    await Promise.all([solveTask(db, a, 'task01'), solveTask(db, c, 'task01')]);
    setClock(null);

    // A finishes everything first; B second; C stays on task02.
    for (const t of TASKS.slice(1)) await solveTask(db, a, t);
    for (const t of TASKS.slice(1)) await solveTask(db, b, t);

    await assert.rejects(getLeaderboardsFor(db, c.captain, 'c@iiitkottayam.ac.in'), (e) => e.code === 'LEADERBOARD_LOCKED');
    await assert.rejects(getLeaderboardsFor(db, c.players[0], 'p@iiitkottayam.ac.in'), (e) => e.code === 'LEADERBOARD_LOCKED');

    const board = await getLeaderboardsFor(db, a.players[1], 'p@iiitkottayam.ac.in');
    assert.equal(board.yourTeamId, a.teamId);
    const mine = (list) => list.filter((s) => [a.teamId, b.teamId, c.teamId].includes(s.teamId));
    const finish = mine(board.finishOrder);
    assert.deepEqual(finish.map((s) => [s.teamId, s.finished]), [[a.teamId, true], [b.teamId, true], [c.teamId, false]]);
    assert.ok(finish[0].completedAtMs <= finish[1].completedAtMs);
    assert.ok(finish[0].durationMs > 0);
    assert.equal(finish[2].currentTaskId, 'task02');
    const points = mine(board.points);
    assert.equal(points[0].teamId, b.teamId, 'B won task01 outright, so it has the most points');
    assert.ok(points[0].totalScore > points[1].totalScore);
    assert.equal(points.find((s) => s.teamId === c.teamId).tasksCompleted, 1);

    process.env.ADMIN_EMAILS = 'boss@iiitkottayam.ac.in';
    const adminView = await getLeaderboardsFor(db, c.captain, 'boss@iiitkottayam.ac.in');
    assert.ok(adminView.points.length >= 3, 'admins can always see the boards');
    delete process.env.ADMIN_EMAILS;
  });
});

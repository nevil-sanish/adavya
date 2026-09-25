import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, describe, test } from 'node:test';
import { Timestamp } from 'firebase-admin/firestore';
import { refs } from '../dist/game/refs.js';
import { startFirstTask, submitAction } from '../dist/game/engine.js';
import { MORSE } from '../dist/game/morse.js';
import { captainView, heartbeat, newTeam, openCompetition, privateState, skip, solveTask, submit, teamDoc, testDb } from './helpers.mjs';

const CID = 'task-tests';
const TASKS = ['task01', 'task02', 'task03', 'task04', 'task05', 'task06'];

async function rejects(promise, code) {
  await assert.rejects(promise, (err) => {
    assert.equal(err.code, code, `expected ${code}, got ${err.code}: ${err.message}`);
    return true;
  });
}

async function startedTeam(db, name) {
  const team = await newTeam(db, name);
  await startFirstTask(db, team.captain);
  return team;
}

/** Plays the team forward until `taskId` is current. */
async function advanceTo(db, team, taskId) {
  for (const t of TASKS) {
    if (t === taskId) return;
    await solveTask(db, team, t);
  }
}

describe('task engine', { skip }, () => {
  let db;
  before(async () => {
    db = testDb(CID);
    await openCompetition(db, CID);
  });

  /* ---------------------------- shared lifecycle ---------------------------- */

  test('a team plays all six tasks; each completes once and the next starts automatically', async () => {
    const team = await startedTeam(db, 'Full Run');
    for (const taskId of TASKS) {
      assert.equal((await teamDoc(db, team)).currentTaskId, taskId);
      await solveTask(db, team, taskId);
      const run = (await refs(db).run(CID, team.teamId, taskId).get()).data();
      assert.equal(run.status, 'COMPLETED');
      const view = await captainView(db, team, taskId);
      assert.ok(view.completionRank >= 1);
    }
    const doc = await teamDoc(db, team);
    assert.equal(doc.status, 'COMPLETED');
    assert.equal(doc.currentTaskId, null);
    const summary = (await refs(db).captainSummary(CID, team.teamId).get()).data();
    const sum = Object.values(summary.tasks).reduce((s, t) => s + t.points, 0);
    assert.equal(summary.totalScore, sum);
    assert.equal(Object.keys(summary.tasks).length, 6);
  });

  test('duplicate event id returns the original result and is applied once', async () => {
    const team = await startedTeam(db, 'Dup');
    const p = await privateState(db, team, 'task01');
    const run = (await refs(db).run(CID, team.teamId, 'task01').get()).data();
    const body = {
      runId: run.runId,
      clientEventId: randomUUID(),
      clientSeq: 1,
      payload: { direction: p.sequence[0] ? 'RIGHT' : 'LEFT' },
    };
    const first = await submitAction(db, p.stepPlayers[0], 'task01', 'orient', body);
    const second = await submitAction(db, p.stepPlayers[0], 'task01', 'orient', body);
    assert.equal(first.duplicate, false);
    assert.equal(second.duplicate, true);
    assert.equal((await captainView(db, team, 'task01')).currentStep, 1);
  });

  test('concurrent identical submissions are applied once', async () => {
    const team = await startedTeam(db, 'Concurrent Dup');
    const p = await privateState(db, team, 'task01');
    const run = (await refs(db).run(CID, team.teamId, 'task01').get()).data();
    const body = { runId: run.runId, clientEventId: randomUUID(), clientSeq: 1, payload: { direction: p.sequence[0] ? 'RIGHT' : 'LEFT' } };
    const results = await Promise.all(Array.from({ length: 5 }, () => submitAction(db, p.stepPlayers[0], 'task01', 'orient', body)));
    assert.equal(results.filter((r) => !r.duplicate).length, 1);
    assert.equal((await captainView(db, team, 'task01')).currentStep, 1);
  });

  test('an older sequence number (late / replayed event) is rejected', async () => {
    const team = await startedTeam(db, 'Stale Seq');
    const uid = team.players[0];
    const run = (await refs(db).run(CID, team.teamId, 'task01').get()).data();
    await submitAction(db, uid, 'task01', 'orient', { runId: run.runId, clientEventId: randomUUID(), clientSeq: 10, payload: { direction: 'LEFT' } });
    await rejects(
      submitAction(db, uid, 'task01', 'orient', { runId: run.runId, clientEventId: randomUUID(), clientSeq: 9, payload: { direction: 'LEFT' } }),
      'STALE_EVENT'
    );
  });

  test('events for an old run or a non-current task are rejected', async () => {
    const team = await startedTeam(db, 'Old Round');
    const oldRun = (await refs(db).run(CID, team.teamId, 'task01').get()).data();
    await solveTask(db, team, 'task01');
    await rejects(
      submitAction(db, team.players[0], 'task01', 'orient', { runId: oldRun.runId, clientEventId: randomUUID(), clientSeq: 999, payload: { direction: 'LEFT' } }),
      'TASK_NOT_CURRENT'
    );
    await rejects(submit(db, team, team.players[0], 'task02', 'gps', { latitude: 0, longitude: 0, accuracy: 5, positionTimestamp: Date.now() }, { runId: oldRun.runId }), 'STALE_RUN');
    await rejects(submit(db, team, team.players[0], 'task03', 'pose', { poseId: 't_pose', holdMs: 2000 }), 'TASK_NOT_CURRENT');
  });

  test('roles are enforced and identity comes from the token, not the payload', async () => {
    const team = await startedTeam(db, 'Roles');
    await rejects(submit(db, team, team.captain, 'task01', 'orient', { direction: 'LEFT' }), 'ROLE_NOT_ALLOWED');
    await advanceTo(db, team, 'task02');
    await rejects(submit(db, team, team.players[0], 'task02', 'word', { letters: 'ABC' }), 'ROLE_NOT_ALLOWED');
    // Extra fields such as a forged uid/teamId/rank are ignored by validation.
    const result = await submit(db, team, team.players[0], 'task02', 'gps', {
      latitude: 0, longitude: 0, accuracy: 5, positionTimestamp: Date.now(), uid: team.captain, teamId: 'other', rank: 1,
    });
    assert.equal(result.status, 'SEARCHING');
  });

  test('a user outside the team cannot touch it; users without a team are rejected', async () => {
    const a = await startedTeam(db, 'Iso A');
    const b = await startedTeam(db, 'Iso B');
    const runA = (await refs(db).run(CID, a.teamId, 'task01').get()).data();
    // B's player aims at A's run id: the engine resolves B's own team, so the run id is stale.
    await rejects(
      submitAction(db, b.players[0], 'task01', 'orient', { runId: runA.runId, clientEventId: randomUUID(), clientSeq: 1, payload: { direction: 'LEFT' } }),
      'STALE_RUN'
    );
    assert.equal((await captainView(db, a, 'task01')).log.length, 0);
    await rejects(submitAction(db, 'nobody', 'task01', 'orient', {}), 'VALIDATION_ERROR');
    await rejects(
      submitAction(db, 'nobody', 'task01', 'orient', { runId: 'x', clientEventId: randomUUID(), clientSeq: 1, payload: { direction: 'LEFT' } }),
      'PROFILE_NOT_FOUND'
    );
  });

  test('captain disconnect pauses player submissions until the captain reconnects', async () => {
    const team = await startedTeam(db, 'Pause');
    const captainRef = refs(db).member(CID, team.teamId, team.captain);
    // Record a heartbeat now so the helpers' automatic heartbeat does not undo the disconnect below.
    await heartbeat(db, team, true);
    await captainRef.update({ lastSeenAt: Timestamp.fromMillis(Date.now() - 10 * 60_000) });
    await rejects(submit(db, team, team.players[0], 'task01', 'orient', { direction: 'LEFT' }), 'TEAM_PAUSED');
    await captainRef.update({ lastSeenAt: Timestamp.now(), isConnected: true });
    await submit(db, team, team.players[0], 'task01', 'orient', { direction: 'LEFT' });
  });

  /* ------------------------------ task specifics ----------------------------- */

  test('task01: wrong player and wrong direction do not advance; players get no verdict', async () => {
    const team = await startedTeam(db, 'T1');
    const p = await privateState(db, team, 'task01');
    const right = p.sequence[0] ? 'RIGHT' : 'LEFT';
    const wrong = p.sequence[0] ? 'LEFT' : 'RIGHT';
    const other = team.players.find((u) => u !== p.stepPlayers[0]);
    assert.deepEqual(await submit(db, team, other, 'task01', 'orient', { direction: right }), { received: true, duplicate: false });
    await submit(db, team, p.stepPlayers[0], 'task01', 'orient', { direction: wrong });
    let view = await captainView(db, team, 'task01');
    assert.equal(view.currentStep, 0);
    assert.equal(view.log.filter((e) => e.kind === 'REJECTED').length, 2);
    await submit(db, team, p.stepPlayers[0], 'task01', 'orient', { direction: right });
    view = await captainView(db, team, 'task01');
    assert.equal(view.currentStep, 1);
    assert.deepEqual(view.revealed, [p.sequence[0]]);
    assert.equal(view.currentPlayerUid, p.stepPlayers[1]);
  });

  // Level 02 (task02) has its own suite: task02.test.mjs.

  test('task03: wrong pose and short holds do not count; completed performers stay completed', async () => {
    const team = await startedTeam(db, 'T3');
    await advanceTo(db, team, 'task03');
    const p = await privateState(db, team, 'task03');
    const [uid, pose] = Object.entries(p.assignments)[0];
    const otherPose = Object.values(p.assignments).find((x) => x !== pose);
    await submit(db, team, uid, 'task03', 'pose', { poseId: otherPose, holdMs: 2000 });
    await submit(db, team, uid, 'task03', 'pose', { poseId: pose, holdMs: 500 });
    assert.equal((await captainView(db, team, 'task03')).completedCount, 0);
    await submit(db, team, uid, 'task03', 'pose', { poseId: pose, holdMs: 1600 });
    await submit(db, team, uid, 'task03', 'pose', { poseId: otherPose, holdMs: 2000 });
    const view = await captainView(db, team, 'task03');
    assert.equal(view.completedCount, 1);
    assert.equal(view.performers.find((x) => x.uid === uid).completed, true);
  });

  test('task04: order, mapping, tolerance, hold, late events and simultaneous attempts', async () => {
    const team = await startedTeam(db, 'T4');
    await advanceTo(db, team, 'task04');
    const p = await privateState(db, team, 'task04');
    const [first, second] = p.order;
    const view0 = await captainView(db, team, 'task04');
    assert.deepEqual(view0.targets, p.order.map((o) => o.targetDb));
    assert.equal(JSON.stringify(view0).includes(first.uid), false, 'captain view has no mapping');

    // No hold: a target counts the moment its owner reaches it (default holdMs 0).
    const hit = (uid, levelDb, extra = {}) => submit(db, team, uid, 'task04', 'hit', { levelDb, holdMs: 0, ageMs: 100, ...extra });
    await hit(second.uid, second.targetDb); // out of order
    await hit(first.uid, first.targetDb + 10); // outside tolerance
    await hit(first.uid, first.targetDb, { ageMs: 60_000 }); // late
    assert.equal((await captainView(db, team, 'task04')).completedCount, 0);
    assert.equal((await captainView(db, team, 'task04')).log.length, 0, 'no rejection feedback by default');

    // All three players hold the first target simultaneously: only the mapped player counts.
    await Promise.all(team.players.map((uid) => hit(uid, first.targetDb)));
    assert.equal((await captainView(db, team, 'task04')).completedCount, 1);
    await hit(second.uid, second.targetDb + 2);
    assert.equal((await captainView(db, team, 'task04')).completedCount, 2);
  });

  test('task05: attempts, retry penalty, auto-lock after three, completion after all finalized', async () => {
    const team = await startedTeam(db, 'T5');
    await advanceTo(db, team, 'task05');
    const [a, b, c] = team.players;
    const target = (await captainView(db, team, 'task05')).executors.find((e) => e.uid === a).targetMs;
    await submit(db, team, a, 'task05', 'attempt', { durationMs: target + 1000 });
    await submit(db, team, a, 'task05', 'attempt', { durationMs: target });
    const r3 = await submit(db, team, a, 'task05', 'attempt', { durationMs: target });
    assert.equal(r3.finalized, true);
    assert.equal((await submit(db, team, a, 'task05', 'attempt', { durationMs: target })).accepted, false);
    let view = await captainView(db, team, 'task05');
    const ex = view.executors.find((e) => e.uid === a);
    assert.deepEqual(ex.attempts.map((x) => x.score), [80, 90, 80]);
    assert.equal(ex.finalScore, 80);

    assert.equal((await submit(db, team, b, 'task05', 'lock')).reason, 'NO_ATTEMPT');
    await submit(db, team, b, 'task05', 'attempt', { durationMs: 4000 });
    await submit(db, team, b, 'task05', 'lock');
    assert.equal((await teamDoc(db, team)).currentTaskId, 'task05');
    await submit(db, team, c, 'task05', 'attempt', { durationMs: 4000 });
    await submit(db, team, c, 'task05', 'lock');
    assert.equal((await teamDoc(db, team)).currentTaskId, 'task06');
    view = await captainView(db, team, 'task05');
    assert.equal(view.finalizedCount, 3);
    const playerView = (await refs(db).playerView(CID, team.teamId, 'task05', b).get()).data();
    assert.equal(playerView.finalized, true);
    assert.equal(playerView.targetMs, undefined);
  });

  test('task06: wrong player and wrong Morse keep the position; retries are unlimited', async () => {
    const team = await startedTeam(db, 'T6');
    await advanceTo(db, team, 'task06');
    const p = await privateState(db, team, 'task06');
    assert.match(p.word, /^[A-Z]{3}$/);
    assert.equal(new Set(p.positions.map((x) => x.assignedPlayerUid)).size, 3);
    const pos0 = p.positions[0];
    const other = team.players.find((u) => u !== pos0.assignedPlayerUid);
    const wrongMorse = pos0.morse === '.' ? '-' : '.';

    await submit(db, team, other, 'task06', 'morse', { morse: pos0.morse });
    for (let i = 0; i < 5; i++) await submit(db, team, pos0.assignedPlayerUid, 'task06', 'morse', { morse: wrongMorse });
    let view = await captainView(db, team, 'task06');
    assert.equal(view.currentPosition, 0);
    assert.deepEqual(view.attempts.map((a) => a.result), ['WRONG_PLAYER', ...Array(5).fill('WRONG_MORSE')]);

    await submit(db, team, pos0.assignedPlayerUid, 'task06', 'morse', { morse: MORSE[p.word[0]] });
    view = await captainView(db, team, 'task06');
    assert.equal(view.currentPosition, 1);
    assert.equal(view.word, p.word);
    for (const pos of p.positions.slice(1)) await submit(db, team, pos.assignedPlayerUid, 'task06', 'morse', { morse: pos.morse });
    assert.equal((await teamDoc(db, team)).status, 'COMPLETED');
    await rejects(submit(db, team, pos0.assignedPlayerUid, 'task06', 'morse', { morse: pos0.morse }), 'TASK_NOT_CURRENT');
  });
});

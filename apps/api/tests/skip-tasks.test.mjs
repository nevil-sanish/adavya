import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import { FieldValue } from 'firebase-admin/firestore';
import { refs } from '../dist/game/refs.js';
import { startFirstTask } from '../dist/game/engine.js';
import { updateCompetition } from '../dist/services/admin.service.js';
import { newTeam, openCompetition, skip, solveTask, teamDoc, testDb } from './helpers.mjs';

const CID = 'skip-tests';

describe('skipped tasks', { skip }, () => {
  let db;
  before(async () => {
    db = testDb(CID);
    await openCompetition(db, CID);
  });

  test('by default task02 is skipped: task01 leads straight to task03', async () => {
    await refs(db).competition(CID).update({ skippedTasks: FieldValue.delete() });
    const team = await newTeam(db, 'Default Skip');
    await startFirstTask(db, team.captain);
    assert.deepEqual((await teamDoc(db, team)).taskPlan, ['task01', 'task03', 'task04', 'task05', 'task06']);

    await solveTask(db, team, 'task01');
    assert.equal((await teamDoc(db, team)).currentTaskId, 'task03');
    assert.equal((await refs(db).run(CID, team.teamId, 'task02').get()).exists, false);

    for (const taskId of ['task03', 'task04', 'task05', 'task06']) await solveTask(db, team, taskId);
    const doc = await teamDoc(db, team);
    assert.equal(doc.status, 'COMPLETED');
    const summary = (await refs(db).captainSummary(CID, team.teamId).get()).data();
    assert.deepEqual(Object.keys(summary.tasks).sort(), ['task01', 'task03', 'task04', 'task05', 'task06']);
  });

  test('a team keeps the plan it started with when the skip list changes', async () => {
    await updateCompetition(db, CID, { skippedTasks: [] });
    const team = await newTeam(db, 'Plan Fixed');
    await startFirstTask(db, team.captain);
    await updateCompetition(db, CID, { skippedTasks: ['task02'] });
    await solveTask(db, team, 'task01');
    assert.equal((await teamDoc(db, team)).currentTaskId, 'task02');
  });

  test('skipping every task is rejected', async () => {
    await assert.rejects(
      updateCompetition(db, CID, { skippedTasks: ['task01', 'task02', 'task03', 'task04', 'task05', 'task06'] }),
      (err) => err.code === 'VALIDATION_ERROR'
    );
  });
});

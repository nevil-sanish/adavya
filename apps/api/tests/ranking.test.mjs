import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { refs } from '../dist/game/refs.js';
import { startFirstTask } from '../dist/game/engine.js';
import { setClock } from '../dist/lib/clock.js';
import { captainView, newTeam, openCompetition, privateState, skip, solveTask, submit, testDb } from './helpers.mjs';

const CID = 'ranking-tests';

/** Solves everything in task01 except the final step, so completion can be triggered on demand. */
async function almostSolveTask01(db, team) {
  const p = await privateState(db, team, 'task01');
  for (let i = 0; i < p.sequence.length - 1; i++) {
    await submit(db, team, p.stepPlayers[i], 'task01', 'orient', { direction: p.sequence[i] ? 'RIGHT' : 'LEFT' });
  }
  const last = p.sequence.length - 1;
  return () => submit(db, team, p.stepPlayers[last], 'task01', 'orient', { direction: p.sequence[last] ? 'RIGHT' : 'LEFT' });
}

async function result(db, team, taskId) {
  const v = await captainView(db, team, taskId);
  return [v.completionRank, v.pointsAwarded];
}

describe('multi-team completion ranking', { skip }, () => {
  let db;
  before(async () => {
    db = testDb(CID);
    await openCompetition(db, CID);
  });
  after(() => setClock(null));

  test('four teams finishing simultaneously all tie at rank 1; next task starts for each', async () => {
    const teams = await Promise.all([1, 2, 3, 4].map((i) => newTeam(db, `Sim ${i}`)));
    await Promise.all(teams.map((t) => startFirstTask(db, t.captain)));
    const finishers = await Promise.all(teams.map((t) => almostSolveTask01(db, t)));

    setClock(() => 1_000_000);
    await Promise.all(finishers.map((finish) => finish()));
    setClock(null);

    for (const t of teams) {
      assert.deepEqual(await result(db, t, 'task01'), [1, 100]);
      const run02 = (await refs(db).run(CID, t.teamId, 'task02').get()).data();
      assert.equal(run02.status, 'ACTIVE');
    }
    const ranking = (await refs(db).taskResult(CID, 'task01').get()).data();
    assert.equal(ranking.completedCount, 4);
    assert.equal(ranking.groups.length, 1);
    const completions = await refs(db).taskResult(CID, 'task01').collection('completions').get();
    assert.equal(completions.size, 4);
  });

  test('tie window and dense ranking across teams on the same task', async () => {
    // task02 for the four teams above, finishing at controlled server times.
    const teams = (await refs(db).teams(CID).get()).docs.map((d) => d.data());
    const byName = Object.fromEntries(teams.map((t) => [t.teamName, t]));
    const make = async (t) => {
      const members = (await refs(db).members(CID, t.teamId).get()).docs.map((d) => d.data());
      return {
        cid: CID,
        teamId: t.teamId,
        captain: t.captainUid,
        players: members.filter((m) => m.role === 'PLAYER').sort((a, b) => a.slot.localeCompare(b.slot)).map((m) => m.uid),
      };
    };
    const names = Object.keys(byName).filter((n) => n.startsWith('Sim')).sort();
    const [a, b, c, d] = await Promise.all(names.map((n) => make(byName[n])));

    const at = async (ms, team) => {
      setClock(() => ms);
      await solveTask(db, team, 'task02');
    };
    await at(2_000_000, a); // rank 1
    await at(2_000_700, b); // within 1 s of A → rank 1
    await at(2_003_000, c); // rank 2 (dense)
    await at(2_003_900, d); // within 1 s of C → rank 2
    setClock(null);

    assert.deepEqual(await result(db, a, 'task02'), [1, 100]);
    assert.deepEqual(await result(db, b, 'task02'), [1, 100]);
    assert.deepEqual(await result(db, c, 'task02'), [2, 90]);
    assert.deepEqual(await result(db, d, 'task02'), [2, 90]);

    // Scores aggregate exactly once per task.
    for (const t of [a, b, c, d]) {
      const summary = (await refs(db).captainSummary(CID, t.teamId).get()).data();
      assert.equal(summary.totalScore, 100 + summary.tasks.task02.points);
    }
  });

  test('same task definition, independent runs: one team’s progress never moves another’s', async () => {
    const [x, y] = await Promise.all([newTeam(db, 'Indep X'), newTeam(db, 'Indep Y')]);
    await Promise.all([startFirstTask(db, x.captain), startFirstTask(db, y.captain)]);
    const px = await privateState(db, x, 'task01');
    await submit(db, x, px.stepPlayers[0], 'task01', 'orient', { direction: px.sequence[0] ? 'RIGHT' : 'LEFT' });
    assert.equal((await captainView(db, x, 'task01')).currentStep, 1);
    assert.equal((await captainView(db, y, 'task01')).currentStep, 0);
  });
});

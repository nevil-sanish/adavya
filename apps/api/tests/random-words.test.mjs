import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import { DEFAULT_ASSIGNMENT_WORDS, formableWords, randomAssignment, spellings } from '../dist/game/words.js';
import { refs } from '../dist/game/refs.js';
import { startFirstTask } from '../dist/game/engine.js';
import { getOverview, setAssignment, setTaskConfig } from '../dist/services/admin.service.js';
import { LOCATIONS, newTeam, openCompetition, privateState, skip, solveTask, teamDoc, testDb } from './helpers.mjs';

const letterOf = Object.fromEntries(LOCATIONS.map((l) => [l.locationId, l.letter]));

/* ------------------------------- pure generator ------------------------------ */

test('the default word list only yields words the pool can spell', () => {
  const words = formableWords(DEFAULT_ASSIGNMENT_WORDS, LOCATIONS);
  assert.ok(words.length >= 20, `${words.length} words: ${words.join(' ')}`);
  for (const w of words) assert.ok(spellings(w, LOCATIONS).length > 0, w);
  assert.ok(!words.includes('SEE'), 'needs two E locations');
  assert.ok(!words.includes('CAT'), 'no C location');
});

test('a random assignment: 5 distinct locations, 3 correct spelling the word in order, 2 decoys', () => {
  for (let i = 0; i < 300; i++) {
    const a = randomAssignment(LOCATIONS, DEFAULT_ASSIGNMENT_WORDS, {});
    assert.equal(new Set(a.locationIds).size, 5);
    assert.equal(a.correctLocationIds.length, 3);
    assert.ok(a.correctLocationIds.every((id) => a.locationIds.includes(id)));
    assert.equal(a.correctLocationIds.map((id) => letterOf[id]).join(''), a.word);
  }
});

test('least-used words are picked first, so teams get different words', () => {
  const used = {};
  const words = formableWords(DEFAULT_ASSIGNMENT_WORDS, LOCATIONS);
  for (let i = 0; i < words.length; i++) {
    const { word } = randomAssignment(LOCATIONS, DEFAULT_ASSIGNMENT_WORDS, used);
    assert.equal(used[word], undefined, `repeated ${word} before the list ran out`);
    used[word] = 1;
  }
  assert.equal(Object.keys(used).length, words.length);
});

test('no spellable word gives null', () => {
  assert.equal(randomAssignment(LOCATIONS, ['CAT', 'DOG'], {}), null);
});

/* ------------------------------ in the real engine ----------------------------- */

describe('random Level 02 assignments', { skip }, () => {
  const CID = 'random-words-tests';
  let db;
  before(async () => {
    db = testDb(CID);
    await openCompetition(db, CID);
  });

  test('each team gets a different word and its own five locations; the admin sees what was given', async () => {
    const teams = await Promise.all([1, 2, 3, 4, 5].map((i) => newTeam(db, `Rnd ${i}`)));
    await Promise.all(teams.map((t) => startFirstTask(db, t.captain)));
    // Two teams reach Level 02 at the same moment, the rest one after another.
    await Promise.all(teams.slice(0, 2).map((t) => solveTask(db, t, 'task01')));
    for (const t of teams.slice(2)) await solveTask(db, t, 'task01');

    const given = await Promise.all(teams.map((t) => privateState(db, t, 'task02')));
    const words = given.map((p) => p.word);
    assert.equal(new Set(words).size, teams.length, `words: ${words.join(', ')}`);
    for (const p of given) {
      assert.equal(p.assigned.length, 5);
      assert.equal(p.assigned.filter((l) => l.classification === 'CORRECT').map((l) => l.letter).sort().join(''), [...p.word].sort().join(''));
      assert.deepEqual(p.assigned.map((l) => l.order), [1, 2, 3, 4, 5]);
    }
    const used = (await refs(db).privateConfig(CID, 'task02').get()).data().usedWords;
    for (const w of words) assert.equal(used[w], 1);

    const overview = await getOverview(db, CID);
    const row = overview.teams.find((t) => t.teamId === teams[0].teamId);
    assert.equal(row.task02.source, 'RANDOM');
    assert.equal(row.task02Given.word, words[0]);
    assert.equal(overview.task02Random.mode, 'RANDOM');

    // The random word works end to end.
    await solveTask(db, teams[0], 'task02');
    assert.equal((await teamDoc(db, teams[0])).currentTaskId, 'task03');
  });

  test('a team the admin assigned by hand keeps that assignment in random mode', async () => {
    const team = await newTeam(db, 'Rnd Manual');
    await setAssignment(db, CID, team.teamId, { locationIds: ['L01', 'L03', 'L04', 'L07', 'L09'], correctLocationIds: ['L04', 'L01', 'L03'], word: 'MAT' });
    await startFirstTask(db, team.captain);
    await solveTask(db, team, 'task01');
    const p = await privateState(db, team, 'task02');
    assert.equal(p.word, 'MAT');
    assert.deepEqual(p.assigned.map((l) => l.locationId), ['L01', 'L03', 'L04', 'L07', 'L09']);
  });

  test('a word list the pool cannot spell blocks the start with a clear error', async () => {
    await setTaskConfig(db, CID, 'task02', { config: { words: ['CAT', 'DOG'] } });
    const team = await newTeam(db, 'Rnd Blocked');
    await assert.rejects(startFirstTask(db, team.captain), (e) => e.code === 'COMPETITION_NOT_CONFIGURED' && /spelled/.test(e.message));
    await setTaskConfig(db, CID, 'task02', { config: {} });
  });
});

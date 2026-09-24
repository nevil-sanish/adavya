import assert from 'node:assert/strict';
import { test } from 'node:test';
import { placeCompletion, DEFAULT_SCORING_POLICY } from '../dist/game/scoring.js';
import { distanceMeters } from '../dist/game/geo.js';
import { generateSoundTargets } from '../dist/game/sound.js';
import { scoreAttempt } from '../dist/game/timer.js';
import { MORSE } from '../dist/game/morse.js';
import { fourDigitCode } from '../dist/lib/random.js';
import { isAllowedEmail } from '../dist/config/env.js';

const policy = DEFAULT_SCORING_POLICY;

function rankAll(times) {
  let groups = [];
  return times.map((t) => {
    const placed = placeCompletion(groups, t, policy);
    groups = placed.groups;
    return [placed.rank, placed.points];
  });
}

test('architecture example: ties within one second share rank; next group is dense', () => {
  assert.deepEqual(rankAll([200, 700, 3000]), [[1, 100], [1, 100], [2, 90]]);
});

test('tie window is anchored at the group’s first completion, not chained', () => {
  // 0 → 900 ties; 1800 is 1800 ms after the anchor, so it opens rank 2.
  assert.deepEqual(rankAll([0, 900, 1800]), [[1, 100], [1, 100], [2, 90]]);
});

test('exactly on the window boundary still ties', () => {
  assert.deepEqual(rankAll([0, 1000]), [[1, 100], [1, 100]]);
  assert.deepEqual(rankAll([0, 1001]), [[1, 100], [2, 90]]);
});

test('ranks beyond the points table earn zero', () => {
  assert.deepEqual(rankAll([0, 5000, 10000, 15000, 20000]).map(([r, p]) => [r, p]), [[1, 100], [2, 90], [3, 80], [4, 70], [5, 0]]);
});

test('a completion stamped before the latest anchor joins the latest group', () => {
  assert.deepEqual(rankAll([5000, 4990]), [[1, 100], [1, 100]]);
});

test('team codes are exactly four digits', () => {
  for (let i = 0; i < 2000; i++) assert.match(fourDigitCode(), /^\d{4}$/);
});

test('institutional email check', () => {
  assert.equal(isAllowedEmail('a.b@iiitkottayam.ac.in'), true);
  assert.equal(isAllowedEmail('A@IIITKOTTAYAM.AC.IN'), true);
  for (const bad of ['a@gmail.com', 'a@iiitkottayam.ac.in.evil.com', 'a@x.iiitkottayam.ac.in', 'a@iiiitkottayam.ac.in', '@iiitkottayam.ac.in', null]) {
    assert.equal(isAllowedEmail(bad), false, String(bad));
  }
});

test('geofence distance', () => {
  assert.equal(Math.round(distanceMeters(9.755, 76.65, 9.755, 76.65)), 0);
  const d = distanceMeters(9.755, 76.65, 9.7552, 76.65); // ~22 m north
  assert.ok(d > 21 && d < 23, `${d}`);
});

test('sound targets are unique and separated', () => {
  for (let i = 0; i < 500; i++) {
    const t = generateSoundTargets(50, 85, 8).sort((a, b) => a - b);
    assert.ok(t[1] - t[0] >= 8 && t[2] - t[1] >= 8 && t[0] >= 50 && t[2] <= 85, t.join(','));
  }
});

test('timer score applies error and retry penalty, floored at zero', () => {
  const cfg = { maxPoints: 100, pointsLostPerSecond: 20, retryPenalty: 10 };
  assert.equal(scoreAttempt(5000, 5000, 0, cfg), 100);
  assert.equal(scoreAttempt(5000, 5500, 0, cfg), 90);
  assert.equal(scoreAttempt(5000, 4500, 2, cfg), 70);
  assert.equal(scoreAttempt(5000, 60000, 0, cfg), 0);
});

test('morse table covers A-Z', () => {
  assert.equal(Object.keys(MORSE).length, 26);
  assert.equal(MORSE.C, '-.-.');
});

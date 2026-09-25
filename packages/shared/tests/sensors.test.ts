import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTiltLock } from '../src/sensors/tilt.ts';
import { classifyPose, createPoseHold, type Landmark } from '../src/sensors/pose.ts';
import { createPlateauDetector, median, rmsDb } from '../src/sensors/sound.ts';
import { letterForMorse, MORSE, pressSymbol } from '../src/morse.ts';

/* ---------------------------------- tilt ---------------------------------- */

test('tilt must start from neutral, hold to lock, and return to neutral before the next lock', () => {
  const tilt = createTiltLock({ lockDeg: 30, neutralDeg: 12, holdMs: 700 });
  assert.equal(tilt(-45, 0).armed, false); // already leaning at start: not armed
  assert.equal(tilt(-45, 1000).locked, undefined);
  assert.equal(tilt(0, 1100).armed, true);
  tilt(-40, 1200);
  assert.equal(tilt(-40, 1600).locked, undefined);
  assert.equal(tilt(-40, 1900).locked, 'LEFT');
  assert.equal(tilt(-40, 3000).locked, undefined, 'no repeat while still leaning');
  tilt(40, 3100);
  assert.equal(tilt(40, 4000).locked, undefined, 'must pass through neutral first');
  tilt(5, 4100);
  tilt(40, 4200);
  assert.equal(tilt(40, 4900).locked, 'RIGHT');
});

test('switching direction mid-hold restarts the hold', () => {
  const tilt = createTiltLock({ holdMs: 700 });
  tilt(0, 0);
  tilt(-40, 100);
  tilt(40, 600);
  assert.equal(tilt(40, 1200).locked, undefined);
  assert.equal(tilt(40, 1300).locked, 'RIGHT');
});

/* ---------------------------------- pose ---------------------------------- */

/** A synthetic upper body with shoulders at y=0.4, width 0.2 (x 0.4..0.6), nose above. */
function body(left: [number, number, number, number], right: [number, number, number, number], visibility = 0.9): Landmark[] {
  const lm: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.8, visibility }));
  lm[0] = { x: 0.5, y: 0.28, visibility };
  lm[11] = { x: 0.6, y: 0.4, visibility };
  lm[12] = { x: 0.4, y: 0.4, visibility };
  [lm[13], lm[15]] = [{ x: left[0], y: left[1], visibility }, { x: left[2], y: left[3], visibility }];
  [lm[14], lm[16]] = [{ x: right[0], y: right[1], visibility }, { x: right[2], y: right[3], visibility }];
  return lm;
}
const UP_L: [number, number, number, number] = [0.62, 0.25, 0.63, 0.1];
const UP_R: [number, number, number, number] = [0.38, 0.25, 0.37, 0.1];
const SIDE_L: [number, number, number, number] = [0.75, 0.4, 0.9, 0.41];
const SIDE_R: [number, number, number, number] = [0.25, 0.4, 0.1, 0.41];
const DOWN_L: [number, number, number, number] = [0.62, 0.55, 0.62, 0.7];
const DOWN_R: [number, number, number, number] = [0.38, 0.55, 0.38, 0.7];

test('classifies the three relay poses', () => {
  assert.equal(classifyPose(body(UP_L, UP_R)), 'both_hands_up');
  assert.equal(classifyPose(body(SIDE_L, SIDE_R)), 't_pose');
  assert.equal(classifyPose(body(UP_L, DOWN_R)), 'one_hand_up_one_down');
  assert.equal(classifyPose(body(DOWN_L, UP_R)), 'one_hand_up_one_down');
  assert.equal(classifyPose(body(DOWN_L, DOWN_R)), null);
  assert.equal(classifyPose(body(SIDE_L, UP_R)), null);
});

test('requires visible upper-body landmarks', () => {
  assert.equal(classifyPose(body(UP_L, UP_R, 0.2)), null);
  assert.equal(classifyPose([]), null);
});

test('pose hold confirms once after 1.5 s and tolerates short jitter', () => {
  const hold = createPoseHold({ holdMs: 1500, graceMs: 300 });
  hold('t_pose', 0);
  hold('t_pose', 500);
  hold(null, 700); // dropout within grace
  hold('t_pose', 900);
  assert.equal(hold('t_pose', 1400).confirmed, undefined);
  assert.equal(hold('t_pose', 1500).confirmed, 't_pose');
  assert.equal(hold('t_pose', 3000).confirmed, undefined, 'one confirmation per hold');
});

test('a dropout longer than the grace period restarts the hold', () => {
  const hold = createPoseHold({ holdMs: 1500, graceMs: 300 });
  hold('t_pose', 0);
  hold('t_pose', 1000);
  hold(null, 1400); // 400 ms after last seen: reset
  hold('t_pose', 1500);
  assert.equal(hold('t_pose', 2900).confirmed, undefined);
  assert.equal(hold('t_pose', 3000).confirmed, 't_pose');
});

/* ---------------------------------- sound --------------------------------- */

test('rmsDb maps full-scale and silence', () => {
  assert.equal(rmsDb(new Float32Array(128)), 0);
  assert.equal(Math.round(rmsDb(new Float32Array(128).fill(1))), 90);
  assert.equal(Math.round(rmsDb(new Float32Array(128).fill(0.1))), 70);
  assert.equal(median([5, 1, 3]), 3);
});

test('plateau detector reports a steady hold once, ignores noise below the floor', () => {
  const p = createPlateauDetector({ bandDb: 2.5, holdMs: 1500, floorDb: 45 });
  for (let t = 0; t <= 2000; t += 100) assert.equal(p.update(40, t), null, 'ambient');
  let hit = null;
  for (let t = 2000; t <= 3600 && !hit; t += 100) hit = p.update(62 + ((t / 100) % 2), t);
  assert.ok(hit);
  assert.ok(Math.abs(hit.levelDb - 62.5) < 1, `${hit.levelDb}`);
  assert.ok(hit.holdMs >= 1500);
  for (let t = 3600; t <= 6000; t += 100) assert.equal(p.update(62, t), null, 'no repeat while holding');
  p.update(75, 6100); // leave band
  let second = null;
  for (let t = 6200; t <= 8000 && !second; t += 100) second = p.update(75, t);
  assert.equal(second?.levelDb, 75);
});

test('an unsteady level never plateaus', () => {
  const p = createPlateauDetector({ bandDb: 2.5, holdMs: 1500 });
  for (let t = 0; t <= 5000; t += 100) assert.equal(p.update(t % 400 === 0 ? 50 : 70, t), null);
});

/* ---------------------------------- morse --------------------------------- */

test('press timing and letter lookup', () => {
  assert.equal(pressSymbol(120), '.');
  assert.equal(pressSymbol(400), '-');
  assert.equal(letterForMorse('-.-.'), 'C');
  assert.equal(letterForMorse('......'), null);
  assert.equal(Object.keys(MORSE).length, 26);
});

test('with no hold, each new level is reported as soon as it is reached, rate-limited', () => {
  const p = createPlateauDetector({ bandDb: 2.5, holdMs: 0, floorDb: 45, minIntervalMs: 150 });
  assert.equal(p.update(40, 0), null, 'below room noise');
  assert.equal(p.update(55, 100)?.levelDb, 55, 'first level above the floor reports at once');
  assert.equal(p.update(56, 120), null, 'same level band: no repeat');
  assert.equal(p.update(62, 180), null, 'new level too soon after the last report');
  assert.equal(p.update(62, 260)?.levelDb, 62, 'reported once the interval has passed');
  // A quick rising voice passes through every level on the way up.
  const seen: number[] = [];
  const q = createPlateauDetector({ bandDb: 2.5, holdMs: 0, floorDb: 45, minIntervalMs: 150 });
  for (let t = 0, db = 50; db <= 80; t += 50, db += 1) {
    const hit = q.update(db, t);
    if (hit) seen.push(hit.levelDb);
  }
  assert.ok(seen.length >= 5, seen.join(','));
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] - seen[i - 1] <= 6, `gap ${seen[i - 1]}→${seen[i]}`);
});

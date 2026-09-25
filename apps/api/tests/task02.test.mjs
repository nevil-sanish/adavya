// Level 02 — Campus GPS letters (see the Level 02 specification §43–44).
import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import { Timestamp } from 'firebase-admin/firestore';
import { refs } from '../dist/game/refs.js';
import { startFirstTask } from '../dist/game/engine.js';
import { deleteAssignment, getOverview, setAssignment, setLocations, setTaskConfig } from '../dist/services/admin.service.js';
import {
  ASSIGNMENT, LOCATIONS, captainView, fixTime, newTeam, openCompetition, privateState, skip, solveTask, submit, teamDoc, testDb, visit,
} from './helpers.mjs';

const CID = 'task02-tests';
const byId = Object.fromEntries(LOCATIONS.map((l) => [l.locationId, l]));

async function rejects(promise, code) {
  await assert.rejects(promise, (err) => {
    assert.equal(err.code, code, `expected ${code}, got ${err.code}: ${err.message}`);
    return true;
  });
}

/** A team whose current task is task02. */
async function atTask02(db, name) {
  const team = await newTeam(db, name);
  await startFirstTask(db, team.captain);
  await solveTask(db, team, 'task01');
  assert.equal((await teamDoc(db, team)).currentTaskId, 'task02');
  return team;
}

const reading = (l, extra = {}) => ({ latitude: l.latitude, longitude: l.longitude, accuracy: 6, positionTimestamp: fixTime(), ...extra });

describe('Level 02 — campus GPS letters', { skip }, () => {
  let db;
  // These tests exercise admin-chosen assignments; random assignment has its own suite (random-words.test.mjs).
  const config = (extra = {}) => setTaskConfig(db, CID, 'task02', { config: { assignmentMode: 'MANUAL', requireDiscoveries: true, ...extra } });
  before(async () => {
    db = testDb(CID);
    await openCompetition(db, CID);
    await config();
  });

  /* ---------------------------- admin configuration ---------------------------- */

  test('the pool needs exactly ten complete, uniquely named locations', async () => {
    await rejects(setLocations(db, CID, { locations: LOCATIONS.slice(0, 9) }), 'VALIDATION_ERROR');
    await rejects(setLocations(db, CID, { locations: [...LOCATIONS.slice(0, 9), { ...LOCATIONS[9], locationId: 'L01' }] }), 'VALIDATION_ERROR');
    await rejects(setLocations(db, CID, { locations: [...LOCATIONS.slice(0, 9), { ...LOCATIONS[9], hint: '' }] }), 'VALIDATION_ERROR');
    await rejects(setLocations(db, CID, { locations: [...LOCATIONS.slice(0, 9), { ...LOCATIONS[9], radiusMeters: undefined }] }), 'VALIDATION_ERROR');
    await setLocations(db, CID, { locations: LOCATIONS });
  });

  test('assignments need five locations, three correct among them, and letters that form the word', async () => {
    const bad = [
      { ...ASSIGNMENT, locationIds: ASSIGNMENT.locationIds.slice(0, 4) },
      { ...ASSIGNMENT, locationIds: ['L02', 'L02', 'L06', 'L08', 'L10'] },
      { ...ASSIGNMENT, locationIds: ['L02', 'L05', 'L06', 'L08', 'L99'] },
      { ...ASSIGNMENT, correctLocationIds: ['L02', 'L06'] },
      { ...ASSIGNMENT, correctLocationIds: ['L02', 'L06', 'L01'] },
      { ...ASSIGNMENT, word: 'CAT' },
      { ...ASSIGNMENT, word: 'ROES' },
    ];
    for (const a of bad) await rejects(setAssignment(db, CID, '_default', a), 'VALIDATION_ERROR');
    await rejects(setAssignment(db, CID, 'no-such-team', ASSIGNMENT), 'NOT_FOUND');
    assert.deepEqual(await setAssignment(db, CID, '_default', { ...ASSIGNMENT, word: 'roe' }), ASSIGNMENT);
  });

  test('a team without a valid assignment cannot start; the overview shows why', async () => {
    await deleteAssignment(db, CID, '_default');
    const team = await newTeam(db, 'Unassigned');
    let overview = await getOverview(db, CID);
    assert.equal(overview.teams.find((t) => t.teamId === team.teamId).task02.problem, 'No assignment');
    await rejects(startFirstTask(db, team.captain), 'COMPETITION_NOT_CONFIGURED');
    // A team-specific assignment is enough on its own.
    await setAssignment(db, CID, team.teamId, { locationIds: ['L01', 'L03', 'L04', 'L07', 'L09'], correctLocationIds: ['L01', 'L04', 'L03'], word: 'MAT' });
    overview = await getOverview(db, CID);
    assert.deepEqual(overview.teams.find((t) => t.teamId === team.teamId).task02, { source: 'TEAM', problem: null });
    assert.deepEqual(await startFirstTask(db, team.captain), { started: true });
    await setAssignment(db, CID, '_default', ASSIGNMENT);
  });

  /* ------------------------------ assignment use ------------------------------ */

  test('teams get their own five locations in hint order; the captain sees hints only', async () => {
    const custom = await newTeam(db, 'Custom');
    await setAssignment(db, CID, custom.teamId, { locationIds: ['L09', 'L01', 'L03', 'L04', 'L07'], correctLocationIds: ['L01', 'L03', 'L04'], word: 'MAT' });
    await startFirstTask(db, custom.captain);
    await solveTask(db, custom, 'task01');
    const def = await atTask02(db, 'Default');

    const pc = await privateState(db, custom, 'task02');
    assert.deepEqual(pc.assigned.map((l) => l.locationId), ['L09', 'L01', 'L03', 'L04', 'L07']);
    assert.deepEqual(pc.assigned.filter((l) => l.classification === 'CORRECT').map((l) => l.locationId), ['L01', 'L03', 'L04']);
    const pd = await privateState(db, def, 'task02');
    assert.deepEqual(pd.assigned.map((l) => l.locationId), ASSIGNMENT.locationIds);

    const hints = await refs(db).run(CID, def.teamId, 'task02').collection('assignedLocations').orderBy('order').get();
    assert.deepEqual(hints.docs.map((h) => h.data().hint), ASSIGNMENT.locationIds.map((id) => byId[id].hint));
    for (const h of hints.docs) assert.deepEqual(Object.keys(h.data()).sort(), ['hint', 'locationId', 'order']);
    const view = await captainView(db, def, 'task02');
    assert.equal(view.correctRequired, 3);
    assert.equal(view.correctFound, null, 'correct count hidden unless classification is revealed');
  });

  test('a later admin edit does not change a run already in progress', async () => {
    const team = await atTask02(db, 'Frozen');
    await setAssignment(db, CID, team.teamId, { locationIds: ['L09', 'L01', 'L03', 'L04', 'L07'], correctLocationIds: ['L01', 'L03', 'L04'], word: 'MAT' });
    assert.deepEqual((await privateState(db, team, 'task02')).assigned.map((l) => l.locationId), ASSIGNMENT.locationIds);
    await deleteAssignment(db, CID, team.teamId);
  });

  /* ---------------------------------- GPS ---------------------------------- */

  test('accuracy, distance hint, searching, and boundary conditions', async () => {
    const team = await atTask02(db, 'GPS');
    const p = team.players[0];
    const l2 = byId.L02;
    // Distance 0 but ±80 m accuracy: not trusted.
    assert.equal((await submit(db, team, p, 'task02', 'gps', reading(l2, { accuracy: 80 }))).status, 'POOR_ACCURACY');
    // Far from every assigned location.
    assert.equal((await submit(db, team, p, 'task02', 'gps', reading({ latitude: 9.70, longitude: 76.60 }))).status, 'SEARCHING');
    // 35 m north of a 25 m geofence: move closer, with the approximate distance.
    const near = await submit(db, team, p, 'task02', 'gps', reading({ latitude: l2.latitude + 35 / 111_000, longitude: l2.longitude }));
    assert.equal(near.status, 'MOVE_CLOSER');
    assert.ok(Math.abs(near.distanceMeters - 35) <= 2, `${near.distanceMeters}`);
    assert.equal(near.letter, undefined);
    // Just outside vs just inside the radius.
    const outside = { latitude: l2.latitude + (l2.radiusMeters + 3) / 111_000, longitude: l2.longitude };
    assert.equal((await submit(db, team, p, 'task02', 'gps', reading(outside))).status, 'MOVE_CLOSER');
    const inside = { latitude: l2.latitude + (l2.radiusMeters - 3) / 111_000, longitude: l2.longitude };
    assert.equal((await visit(db, team, p, inside)).letter, 'R');
    // An unassigned location is just "searching".
    assert.equal((await submit(db, team, p, 'task02', 'gps', reading(byId.L01))).status, 'SEARCHING');
  });

  test('one reading is not trusted: discovery needs a second, newer reading in the same geofence', async () => {
    const team = await atTask02(db, 'Confirm');
    const p = team.players[0];
    const first = reading(byId.L06);
    const r1 = await submit(db, team, p, 'task02', 'gps', first);
    assert.deepEqual([r1.status, r1.confirmations, r1.required], ['LOCATION_DETECTED', 1, 2]);
    // The same fix replayed does not confirm.
    assert.equal((await submit(db, team, p, 'task02', 'gps', first)).status, 'LOCATION_DETECTED');
    // Drifting to another geofence restarts confirmation.
    assert.equal((await submit(db, team, p, 'task02', 'gps', reading(byId.L08))).status, 'LOCATION_DETECTED');
    assert.equal((await submit(db, team, p, 'task02', 'gps', reading(byId.L06))).status, 'LOCATION_DETECTED');
    assert.equal((await captainView(db, team, 'task02')).discoveredCount, 0);
    const r2 = await submit(db, team, p, 'task02', 'gps', reading(byId.L06));
    assert.deepEqual([r2.status, r2.letter, r2.alreadyDiscovered], ['FOUND', 'O', false]);
  });

  test('stale, pre-start and offline-queued readings', async () => {
    const team = await atTask02(db, 'Offline');
    const p = team.players[0];
    const l = byId.L08;
    // Pretend the run started 20 minutes ago.
    await refs(db).run(CID, team.teamId, 'task02').update({ startedAt: Timestamp.fromMillis(Date.now() - 20 * 60_000) });
    const now = Date.now();
    assert.equal((await submit(db, team, p, 'task02', 'gps', reading(l, { positionTimestamp: now - 5 * 60_000 }))).status, 'STALE_POSITION', 'old live reading');
    assert.equal((await submit(db, team, p, 'task02', 'gps', reading(l, { positionTimestamp: now - 15 * 60_000, queued: true }))).status, 'STALE_POSITION', 'beyond offline window');
    assert.equal((await submit(db, team, p, 'task02', 'gps', reading(l, { positionTimestamp: now - 25 * 60_000, queued: true }))).status, 'STALE_POSITION', 'before the run');
    assert.equal((await submit(db, team, p, 'task02', 'gps', reading(l, { positionTimestamp: now + 5 * 60_000 }))).status, 'STALE_POSITION', 'future clock');
    // Two readings captured offline 5 minutes ago, synchronized now.
    await submit(db, team, p, 'task02', 'gps', reading(l, { positionTimestamp: now - 5 * 60_000, queued: true }));
    const synced = await submit(db, team, p, 'task02', 'gps', reading(l, { positionTimestamp: now - 5 * 60_000 + 3000, queued: true }));
    assert.deepEqual([synced.status, synced.letter], ['FOUND', 'E']);
    const d = (await refs(db).run(CID, team.teamId, 'task02').collection('discoveries').doc('L08').get()).data();
    assert.equal(d.viaOfflineQueue, true);
  });

  /* ------------------------ decoys, duplicates, concurrency ------------------------ */

  test('decoys reveal their letter but never their classification', async () => {
    const team = await atTask02(db, 'Decoy');
    const res = await visit(db, team, team.players[0], byId.L05);
    assert.deepEqual(Object.keys(res).sort(), ['alreadyDiscovered', 'duplicate', 'letter', 'order', 'status']);
    assert.equal(res.letter, 'K');
    await visit(db, team, team.players[1], byId.L10); // second decoy
    const docs = await refs(db).run(CID, team.teamId, 'task02').collection('discoveries').get();
    for (const d of docs.docs) assert.equal(d.data().resultType, undefined);
    const view = await captainView(db, team, 'task02');
    assert.equal(view.discoveredCount, 2);
    assert.equal(view.correctFound, null);
    const pv = (await refs(db).playerView(CID, team.teamId, 'task02', team.players[0]).get()).data();
    assert.deepEqual(pv.discoveries.map((x) => Object.keys(x).sort()), [['letter', 'locationId', 'order']]);
  });

  test('a location counts once per team; a second visitor gets the same letter', async () => {
    const team = await atTask02(db, 'Duplicate');
    await visit(db, team, team.players[0], byId.L02);
    const again = await visit(db, team, team.players[1], byId.L02);
    assert.deepEqual([again.status, again.letter, again.alreadyDiscovered, again.byYou], ['FOUND', 'R', true, false]);
    assert.equal((await visit(db, team, team.players[0], byId.L02)).byYou, true);
    const d = (await refs(db).run(CID, team.teamId, 'task02').collection('discoveries').doc('L02').get()).data();
    assert.equal(d.discoveredByUid, team.players[0]);
    assert.equal((await captainView(db, team, 'task02')).discoveredCount, 1);
  });

  test('concurrent visits: same location → one discovery; different locations → all kept', async () => {
    const team = await atTask02(db, 'Concurrent');
    const [a, b, c] = team.players;
    // Each player's first reading everywhere, then all confirmations at once.
    await Promise.all([a, b, c].map((uid) => submit(db, team, uid, 'task02', 'gps', reading(byId.L06))));
    const same = await Promise.all([a, b, c].map((uid) => submit(db, team, uid, 'task02', 'gps', reading(byId.L06))));
    assert.equal(same.filter((r) => r.alreadyDiscovered === false).length, 1);
    assert.ok(same.every((r) => r.letter === 'O'));

    await Promise.all([[a, 'L02'], [b, 'L05'], [c, 'L08']].map(([uid, id]) => submit(db, team, uid, 'task02', 'gps', reading(byId[id]))));
    const diff = await Promise.all([[a, 'L02'], [b, 'L05'], [c, 'L08']].map(([uid, id]) => submit(db, team, uid, 'task02', 'gps', reading(byId[id]))));
    assert.deepEqual(diff.map((r) => r.letter), ['R', 'K', 'E']);
    const docs = await refs(db).run(CID, team.teamId, 'task02').collection('discoveries').get();
    assert.deepEqual(docs.docs.map((d) => d.id).sort(), ['L02', 'L05', 'L06', 'L08']);
    assert.equal((await captainView(db, team, 'task02')).discoveredCount, 4);
  });

  /* -------------------------------- completion -------------------------------- */

  test('captain word: needs all three correct letters, exact order by default; wrong words keep discoveries', async () => {
    const team = await atTask02(db, 'Word');
    const word = (w) => submit(db, team, team.captain, 'task02', 'word', { letters: w });
    assert.equal((await word('ROE')).correct, false, 'right word, letters not found yet');
    await visit(db, team, team.players[0], byId.L02);
    await visit(db, team, team.players[1], byId.L06);
    await visit(db, team, team.players[2], byId.L08);
    assert.equal((await word('KEN')).correct, false);
    assert.equal((await word('ORE')).correct, false, 'anagram rejected unless configured');
    assert.equal((await captainView(db, team, 'task02')).discoveredCount, 3);
    assert.equal((await word('roe')).correct, true);
    assert.equal((await teamDoc(db, team)).currentTaskId, 'task03');
    await rejects(submit(db, team, team.players[0], 'task02', 'gps', reading(byId.L05)), 'TASK_NOT_CURRENT');
    const attempts = await refs(db).run(CID, team.teamId, 'task02').collection('wordAttempts').get();
    assert.equal(attempts.size, 4);
  });

  test('with requireDiscoveries off, the right word counts even if nobody visited a location', async () => {
    await config({ requireDiscoveries: false });
    const team = await atTask02(db, 'Word Only');
    assert.equal((await captainView(db, team, 'task02')).requireDiscoveries, false);
    assert.equal((await submit(db, team, team.captain, 'task02', 'word', { letters: 'ORE' })).correct, false, 'order still matters');
    assert.equal((await submit(db, team, team.captain, 'task02', 'word', { letters: 'ROE' })).correct, true);
    assert.equal((await captainView(db, team, 'task02')).discoveredCount, 0);
    assert.equal((await teamDoc(db, team)).currentTaskId, 'task03');
    await config();
  });

  test('configurable: any-order word, auto-completion on three correct, revealed classification', async () => {
    await config({ acceptAnyOrder: true });
    const anagram = await atTask02(db, 'Anagram');
    for (const id of ['L02', 'L06', 'L08']) await visit(db, anagram, anagram.players[0], byId[id]);
    assert.equal((await submit(db, anagram, anagram.captain, 'task02', 'word', { letters: 'ORE' })).correct, true);

    await config({ acceptAnyOrder: false, completionMode: 'AUTO_ON_THREE_CORRECT', revealClassificationOnDiscovery: true });
    const auto = await atTask02(db, 'Auto');
    const decoy = await visit(db, auto, auto.players[0], byId.L10);
    assert.equal(decoy.resultType, 'DECOY');
    await visit(db, auto, auto.players[1], byId.L02);
    await visit(db, auto, auto.players[2], byId.L06);
    const view = await captainView(db, auto, 'task02');
    assert.deepEqual([view.correctFound, view.discoveredCount, view.completionMode], [2, 3, 'AUTO_ON_THREE_CORRECT']);
    assert.equal((await teamDoc(db, auto)).currentTaskId, 'task02');
    const last = await visit(db, auto, auto.players[0], byId.L08);
    assert.equal(last.resultType, 'CORRECT');
    assert.equal((await teamDoc(db, auto)).currentTaskId, 'task03', 'third correct letter completes the level');
    assert.ok((await captainView(db, auto, 'task02')).completionRank >= 1);

    await config({ completionMode: 'CAPTAIN_SUBMITS_WORD', revealClassificationOnDiscovery: false });
  });
});

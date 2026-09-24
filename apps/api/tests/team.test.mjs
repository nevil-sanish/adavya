import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import { refs } from '../dist/game/refs.js';
import { startFirstTask } from '../dist/game/engine.js';
import { createTeam, joinTeam, loadOrCreateProfile, updateDisplayName } from '../dist/services/team.service.js';
import { newTeam, newUser, openCompetition, skip, testDb } from './helpers.mjs';

const CID = 'team-tests';

async function rejects(promise, code) {
  await assert.rejects(promise, (err) => {
    assert.equal(err.code, code, `expected ${code}, got ${err.code}: ${err.message}`);
    return true;
  });
}

async function freeCode(db) {
  for (let i = 0; i < 10000; i++) {
    const code = String(i).padStart(4, '0');
    if (!(await refs(db).teamDirectory(code).get()).exists) return code;
  }
  throw new Error('no free code');
}

describe('identity and team lifecycle', { skip }, () => {
  let db;
  before(async () => {
    db = testDb(CID);
    await openCompetition(db, CID);
  });

  test('profile is created once and never reset by a later login', async () => {
    const uid = await newUser(db);
    const team = await createTeam(db, uid, 'Persistence');
    const again = await loadOrCreateProfile(db, uid, `${uid}@iiitkottayam.ac.in`, 'Different Name');
    assert.equal(again.teamId, team.teamId);
    assert.equal(again.role, 'CAPTAIN');
    assert.equal(again.slot, 'captain');
  });

  test('missing profile is rejected by team operations', async () => {
    await rejects(createTeam(db, 'no-such-user', 'Ghosts'), 'PROFILE_NOT_FOUND');
    await rejects(joinTeam(db, 'no-such-user', '1234'), 'PROFILE_NOT_FOUND');
  });

  test('creator is captain; code is four digits and reserved in teamDirectory', async () => {
    const uid = await newUser(db);
    const { teamId, teamCode } = await createTeam(db, uid, 'Alpha');
    assert.match(teamCode, /^\d{4}$/);
    const dir = (await refs(db).teamDirectory(teamCode).get()).data();
    assert.equal(dir.teamId, teamId);
    const team = (await refs(db).team(CID, teamId).get()).data();
    assert.equal(team.captainUid, uid);
    assert.equal(team.status, 'LOBBY');
    const member = (await refs(db).member(CID, teamId, uid).get()).data();
    assert.equal(member.slot, 'captain');
  });

  test('code collision retries with a new code', async () => {
    const first = await createTeam(db, await newUser(db), 'Collide A');
    const free = await freeCode(db);
    const codes = [first.teamCode, first.teamCode, free];
    // A transaction retry calls the generator again, so keep returning the free code once the list runs out.
    const next = await createTeam(db, await newUser(db), 'Collide B', () => (codes.length > 1 ? codes.shift() : codes[0]));
    assert.equal(next.teamCode, free);
  });

  test('players get permanent slots player1..player3; a fifth member is rejected', async () => {
    const team = await newTeam(db, 'Slots');
    const slots = await Promise.all(team.players.map(async (uid) => (await refs(db).user(uid).get()).data().slot));
    assert.deepEqual(slots, ['player1', 'player2', 'player3']);
    await rejects(joinTeam(db, await newUser(db), team.teamCode), 'TEAM_FULL');
  });

  test('duplicate join is idempotent; joining a second team is rejected', async () => {
    const a = await newTeam(db, 'Dup A');
    const again = await joinTeam(db, a.players[0], a.teamCode);
    assert.equal(again.slot, 'player1');
    const b = await createTeam(db, await newUser(db), 'Dup B');
    await rejects(joinTeam(db, a.players[0], b.teamCode), 'ALREADY_IN_TEAM');
    await rejects(createTeam(db, a.captain, 'Second team'), 'ALREADY_IN_TEAM');
    const team = (await refs(db).team(CID, a.teamId).get()).data();
    assert.equal(team.memberCount, 4);
  });

  test('simultaneous joins never exceed four members', async () => {
    const captain = await newUser(db);
    const { teamId, teamCode } = await createTeam(db, captain, 'Race');
    const joiners = await Promise.all(Array.from({ length: 6 }, () => newUser(db)));
    const results = await Promise.allSettled(joiners.map((uid) => joinTeam(db, uid, teamCode)));
    const ok = results.filter((r) => r.status === 'fulfilled');
    assert.equal(ok.length, 3);
    assert.deepEqual(ok.map((r) => r.value.slot).sort(), ['player1', 'player2', 'player3']);
    const members = await refs(db).members(CID, teamId).get();
    assert.equal(members.size, 4);
    assert.equal((await refs(db).team(CID, teamId).get()).data().memberCount, 4);
  });

  test('invalid and unknown codes are rejected', async () => {
    const uid = await newUser(db);
    await rejects(joinTeam(db, uid, '12a4'), 'VALIDATION_ERROR');
    await rejects(joinTeam(db, uid, '12345'), 'VALIDATION_ERROR');
    await rejects(joinTeam(db, uid, await freeCode(db)), 'TEAM_NOT_FOUND');
  });

  test('start requires the captain and exactly four members', async () => {
    const captain = await newUser(db);
    const { teamCode } = await createTeam(db, captain, 'Early');
    await rejects(startFirstTask(db, captain), 'TEAM_NOT_FULL');
    const player = await newUser(db);
    await joinTeam(db, player, teamCode);
    await rejects(startFirstTask(db, player), 'CAPTAIN_ONLY');
    await rejects(startFirstTask(db, captain), 'TEAM_NOT_FULL');
  });

  test('starting locks the team: no joins and no name changes; start is idempotent', async () => {
    const team = await newTeam(db, 'Locked');
    await updateDisplayName(db, team.players[0], 'Renamed Before');
    const member = (await refs(db).member(CID, team.teamId, team.players[0]).get()).data();
    assert.equal(member.displayName, 'Renamed Before');

    assert.deepEqual(await startFirstTask(db, team.captain), { started: true });
    assert.deepEqual(await startFirstTask(db, team.captain), { started: false });
    const doc = (await refs(db).team(CID, team.teamId).get()).data();
    assert.equal(doc.status, 'IN_PROGRESS');
    assert.equal(doc.currentTaskId, 'task01');

    await rejects(joinTeam(db, await newUser(db), team.teamCode), 'TEAM_LOCKED');
    await rejects(updateDisplayName(db, team.players[0], 'Renamed After'), 'TEAM_LOCKED');
  });

  test('display names are validated', async () => {
    const uid = await newUser(db);
    await rejects(updateDisplayName(db, uid, 'x'), 'VALIDATION_ERROR');
    await rejects(updateDisplayName(db, uid, 'y'.repeat(41)), 'VALIDATION_ERROR');
    assert.deepEqual(await updateDisplayName(db, uid, '  Ada  '), { displayName: 'Ada' });
  });
});

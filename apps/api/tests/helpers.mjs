// Shared setup for tests that run against the Firestore emulator (`npm run test:emulator`).
import { randomUUID } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import fs from 'node:fs';
import { admin, getDb } from '../dist/config/firebase.js';
import { refs } from '../dist/game/refs.js';
import { ensureCompetition, setAssignment, setLocations, updateCompetition } from '../dist/services/admin.service.js';
import { createTeam, joinTeam, loadOrCreateProfile } from '../dist/services/team.service.js';
import { submitAction } from '../dist/game/engine.js';

export const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
export const skip = emulator ? false : 'requires the Firestore emulator (npm run test:emulator)';

export const LOCATIONS = JSON.parse(fs.readFileSync(new URL('../config/locations.sample.json', import.meta.url), 'utf8'));
export const ASSIGNMENT = JSON.parse(fs.readFileSync(new URL('../config/assignment.sample.json', import.meta.url), 'utf8'));

let db;
/** Admin Firestore bound to the emulator. Each test file uses its own competition id. */
export function testDb(competitionId) {
  process.env.COMPETITION_ID = competitionId;
  process.env.FIREBASE_PROJECT_ID = 'demo-adavya';
  if (!db) {
    if (admin.apps.length === 0) admin.initializeApp({ projectId: 'demo-adavya' });
    db = getDb();
  }
  return db;
}

export async function openCompetition(db, cid) {
  await ensureCompetition(db, cid, 'Test Cup');
  await setLocations(db, cid, { locations: LOCATIONS });
  await setAssignment(db, cid, '_default', ASSIGNMENT);
  await updateCompetition(db, cid, { status: 'ACTIVE' });
}

let userCounter = 0;
export async function newUser(db, name = 'Player') {
  const uid = `u${++userCounter}_${randomUUID().slice(0, 8)}`;
  await loadOrCreateProfile(db, uid, `${uid}@iiitkottayam.ac.in`, `${name} ${userCounter}`);
  return uid;
}

/** A full lobby team: captain plus three players. */
export async function newTeam(db, name = 'Team') {
  const captain = await newUser(db, 'Captain');
  const { teamId, teamCode, competitionId } = await createTeam(db, captain, `${name} ${userCounter}`);
  const players = [];
  for (let i = 0; i < 3; i++) {
    const uid = await newUser(db);
    await joinTeam(db, uid, teamCode);
    players.push(uid);
  }
  return { cid: competitionId, teamId, teamCode, captain, players, all: [captain, ...players] };
}

const seqs = new Map();
/** Submits a task event like a client would: current runId, fresh event id, increasing sequence. */
export async function submit(db, team, uid, taskId, action, payload = {}, overrides = {}) {
  if (team.captain) await heartbeat(db, team);
  const run = (await refs(db).run(team.cid, team.teamId, taskId).get()).data();
  const seq = (seqs.get(uid) ?? 0) + 1;
  seqs.set(uid, seq);
  return submitAction(db, uid, taskId, action, {
    runId: run?.runId ?? 'missing',
    clientEventId: randomUUID(),
    clientSeq: seq,
    payload,
    ...overrides,
  });
}

export async function privateState(db, team, taskId) {
  return (await refs(db).teamPrivate(team.cid, team.teamId, taskId).get()).data();
}

export async function captainView(db, team, taskId) {
  return (await refs(db).captainView(team.cid, team.teamId, taskId).get()).data();
}

export async function teamDoc(db, team) {
  return (await refs(db).team(team.cid, team.teamId).get()).data();
}

const lastBeat = new Map();
/**
 * The captain's open page sends a presence heartbeat every 10 s. Tests do the same
 * (at most every 10 s per team) so a slow run never looks like a disconnected captain.
 */
export async function heartbeat(db, team, force = false) {
  const now = Date.now();
  if (!force && now - (lastBeat.get(team.teamId) ?? 0) < 10_000) return;
  lastBeat.set(team.teamId, now);
  await refs(db).member(team.cid, team.teamId, team.captain).update({ isConnected: true, lastSeenAt: Timestamp.now() });
}

/** Solves the team's current task using the hidden state (as only the server could). */
export async function solveTask(db, team, taskId) {
  await heartbeat(db, team);
  const p = await privateState(db, team, taskId);
  switch (taskId) {
    case 'task01':
      for (let i = 0; i < p.sequence.length; i++) {
        await submit(db, team, p.stepPlayers[i], 'task01', 'orient', { direction: p.sequence[i] ? 'RIGHT' : 'LEFT' });
      }
      return;
    case 'task02': {
      for (const l of p.assigned.filter((a) => a.classification === 'CORRECT')) await visit(db, team, team.players[0], l);
      if (p.config.completionMode === 'CAPTAIN_SUBMITS_WORD') await submit(db, team, team.captain, 'task02', 'word', { letters: p.word });
      return;
    }
    case 'task03':
      for (const [uid, poseId] of Object.entries(p.assignments)) {
        await submit(db, team, uid, 'task03', 'pose', { poseId, holdMs: 1600 });
      }
      return;
    case 'task04':
      for (const { uid, targetDb } of p.order) {
        await submit(db, team, uid, 'task04', 'hit', { levelDb: targetDb, holdMs: 1600, ageMs: 100 });
      }
      return;
    case 'task05':
      for (const uid of team.players) {
        await submit(db, team, uid, 'task05', 'attempt', { durationMs: 5000 });
        await submit(db, team, uid, 'task05', 'lock');
      }
      return;
    case 'task06':
      for (const pos of p.positions) {
        await submit(db, team, pos.assignedPlayerUid, 'task06', 'morse', { morse: pos.morse });
      }
      return;
  }
}

let clock = Date.now();
/** Distinct, increasing device fix times (readings must be newer than the previous one). */
export function fixTime() {
  clock = Math.max(clock + 1, Date.now());
  return clock;
}

/** Stands at a location long enough for the configured number of confirming readings. */
export async function visit(db, team, uid, l, extra = {}) {
  const p = await privateState(db, team, 'task02');
  let res;
  for (let i = 0; i < p.config.confirmReadings; i++) {
    res = await submit(db, team, uid, 'task02', 'gps', { latitude: l.latitude, longitude: l.longitude, accuracy: 5, positionTimestamp: fixTime(), ...extra });
    if (res.status === 'FOUND') break;
  }
  return res;
}

/**
 * Multi-team rehearsal against the emulators, through the real HTTP API.
 *
 *   firebase emulators:start --only auth,firestore      (from the repo root)
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm run dev   (API)
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm run rehearsal -- [--teams 4] [--api http://localhost:5000]
 *
 * Creates verified test accounts in the Auth emulator, then every team signs in,
 * creates/joins, starts, and plays all six tasks concurrently over HTTP. Hidden
 * answers are read from Firestore as a test oracle, which is why this refuses to
 * run outside the emulators. Adversarial events (duplicates, wrong players,
 * cross-team run ids) are mixed in. Finally ranking, ties, dense ranks, score
 * totals and isolation are checked from the stored results.
 */
import { randomUUID } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { activeCompetitionId } from '../config/env.js';
import { refs } from '../game/refs.js';
import { DEFAULT_SCORING_POLICY, placeCompletion } from '../game/scoring.js';
import { TASK_ORDER, type CompetitionDoc, type RankingGroup, type TaskId } from '../game/types.js';
import { ensureCompetition, setAssignment, setLocations, updateCompetition } from '../services/admin.service.js';
import { flag, scriptDb } from './cli.js';
import fs from 'fs';

const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!process.env.FIRESTORE_EMULATOR_HOST || !authHost) {
  console.error('Refusing to run: set FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST (emulators only).');
  process.exit(1);
}

const db = scriptDb();
const r = refs(db);
const cid = activeCompetitionId();
const API = flag('api') ?? 'http://localhost:5000';
const TEAM_COUNT = Number(flag('teams') ?? 4);
const DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || 'iiitkottayam.ac.in';
const projectId = process.env.FIREBASE_PROJECT_ID || 'demo-adavya';
const failures: string[] = [];
const check = (ok: boolean, what: string) => {
  if (!ok) failures.push(what);
  console.log(`${ok ? '  ✔' : '  ✖'} ${what}`);
};

/* ------------------------------ test accounts ------------------------------ */

interface Account {
  uid: string;
  email: string;
  token: string;
}

async function authEmulator(path: string, body: unknown, admin = false): Promise<any> {
  const res = await fetch(`http://${authHost}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(admin ? { Authorization: 'Bearer owner' } : {}) },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Auth emulator ${path}: ${JSON.stringify(data)}`);
  return data;
}

/** A verified institutional account with a fresh ID token. */
async function account(name: string): Promise<Account> {
  const email = `${name}.${randomUUID().slice(0, 6)}@${DOMAIN}`;
  const signUp = await authEmulator('/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake', { email, password: 'rehearsal-pass', returnSecureToken: true });
  await authEmulator(`/identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`, { localId: signUp.localId, emailVerified: true, displayName: name }, true);
  const signIn = await authEmulator('/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake', { email, password: 'rehearsal-pass', returnSecureToken: true });
  return { uid: signIn.localId, email, token: signIn.idToken };
}

/* ---------------------------------- HTTP ----------------------------------- */

async function call<T = any>(who: Account, method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${who.token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json()) as T };
}

interface Team {
  name: string;
  teamId: string;
  captain: Account;
  players: Account[];
  seq: Map<string, number>;
  duplicatesRejected: number;
  wrongPlayerIgnored: number;
}

async function event(team: Team, who: Account, taskId: TaskId, action: string, payload: object, envelope: Partial<{ runId: string; clientEventId: string; clientSeq: number }> = {}) {
  const run = (await r.run(cid, team.teamId, taskId).get()).data()!;
  const seq = (team.seq.get(who.uid) ?? 0) + 1;
  team.seq.set(who.uid, seq);
  const body = { runId: run.runId, clientEventId: randomUUID(), clientSeq: seq, payload, ...envelope };
  const res = await call(who, 'POST', `/tasks/${taskId}/${action}`, body);
  if (res.status !== 200) throw new Error(`${team.name} ${taskId}/${action} → ${res.status} ${JSON.stringify(res.data)}`);
  return { body, data: res.data };
}

const secret = async (team: Team, taskId: TaskId) => (await r.teamPrivate(cid, team.teamId, taskId).get()).data()!;
const byUid = (team: Team, uid: string) => [team.captain, ...team.players].find((a) => a.uid === uid)!;

/* ------------------------------- task players ------------------------------ */

async function play(team: Team, taskId: TaskId) {
  const p = await secret(team, taskId);
  switch (taskId) {
    case 'task01': {
      // A wrong player first (ignored), then the real sequence; one event is replayed verbatim.
      const wrong = team.players.find((x) => x.uid !== p.stepPlayers[0])!;
      await event(team, wrong, 'task01', 'orient', { direction: 'LEFT' });
      team.wrongPlayerIgnored++;
      for (let i = 0; i < p.sequence.length; i++) {
        const who = byUid(team, p.stepPlayers[i]);
        const sent = await event(team, who, 'task01', 'orient', { direction: p.sequence[i] ? 'RIGHT' : 'LEFT' });
        if (i === 0) {
          const again = await call(who, 'POST', '/tasks/task01/orient', sent.body);
          if (again.data.duplicate === true) team.duplicatesRejected++;
        }
      }
      return;
    }
    case 'task02': {
      // Three players at three correct locations at once, each confirmed by consecutive readings.
      const correct = p.assigned.filter((l: any) => l.classification === 'CORRECT');
      await Promise.all(
        correct.map(async (l: any, i: number) => {
          for (let n = 0; n < p.config.confirmReadings; n++) {
            await event(team, team.players[i], 'task02', 'gps', { latitude: l.latitude, longitude: l.longitude, accuracy: 8, positionTimestamp: Date.now() + n });
          }
        })
      );
      await event(team, team.captain, 'task02', 'word', { letters: 'QQQ' });
      await event(team, team.captain, 'task02', 'word', { letters: p.word });
      return;
    }
    case 'task03':
      await Promise.all(Object.entries(p.assignments).map(([uid, poseId]) => event(team, byUid(team, uid), 'task03', 'pose', { poseId, holdMs: 1600 })));
      return;
    case 'task04':
      for (const o of p.order) await event(team, byUid(team, o.uid), 'task04', 'hit', { levelDb: o.targetDb + 1, holdMs: 1600, ageMs: 120 });
      return;
    case 'task05':
      await Promise.all(
        team.players.map(async (pl, i) => {
          await event(team, pl, 'task05', 'attempt', { durationMs: 4000 + i * 700 });
          await event(team, pl, 'task05', 'lock', {});
        })
      );
      return;
    case 'task06':
      for (const pos of p.positions) await event(team, byUid(team, pos.assignedPlayerUid), 'task06', 'morse', { morse: pos.morse });
      return;
  }
}

/* ---------------------------------- main ----------------------------------- */

console.log(`Rehearsal: ${TEAM_COUNT} teams, competition "${cid}", API ${API}`);
await ensureCompetition(db, cid, 'Rehearsal Cup');
await setLocations(db, cid, { locations: JSON.parse(fs.readFileSync(new URL('../../config/locations.sample.json', import.meta.url), 'utf8')) });
await setAssignment(db, cid, '_default', JSON.parse(fs.readFileSync(new URL('../../config/assignment.sample.json', import.meta.url), 'utf8')));
await updateCompetition(db, cid, { status: 'ACTIVE' });

const health = await fetch(`${API}/api/health`).then((x) => x.ok).catch(() => false);
if (!health) {
  console.error(`API not reachable at ${API}. Start it with the emulator variables set.`);
  process.exit(1);
}

console.log('\n1. Accounts, sign-in, teams');
const teams: Team[] = [];
for (let t = 0; t < TEAM_COUNT; t++) {
  const members = await Promise.all(['captain', 'p1', 'p2', 'p3'].map((n) => account(`t${t + 1}${n}`)));
  for (const m of members) {
    const login = await call(m, 'POST', '/auth/google', { idToken: m.token });
    if (login.status !== 200) throw new Error(`login failed: ${JSON.stringify(login.data)}`);
  }
  const [captain, ...players] = members;
  const created = await call(captain, 'POST', '/teams/create', { teamName: `Rehearsal ${t + 1}` });
  if (created.status !== 201) throw new Error(JSON.stringify(created.data));
  const start0 = await call(captain, 'POST', '/teams/start');
  check(start0.status === 409 && start0.data.error === 'TEAM_NOT_FULL', `team ${t + 1}: start blocked below four members`);
  await Promise.all(players.map((pl) => call(pl, 'POST', '/teams/join', { code: created.data.teamCode })));
  teams.push({ name: `Rehearsal ${t + 1}`, teamId: created.data.teamId, captain, players, seq: new Map(), duplicatesRejected: 0, wrongPlayerIgnored: 0 });
}
const outsider = await account('outsider');
await call(outsider, 'POST', '/auth/google', { idToken: outsider.token });
const fifth = await call(outsider, 'POST', '/teams/join', { code: (await r.team(cid, teams[0].teamId).get()).data()!.teamCode });
check(fifth.status === 409 && fifth.data.error === 'TEAM_FULL', 'a fifth member is rejected');
const badDomain = await call({ ...outsider, token: 'not-a-token' }, 'GET', '/auth/me');
check(badDomain.status === 401, 'an invalid token is rejected');

// Keep everyone "connected" like the clients' heartbeat does.
const heartbeat = setInterval(async () => {
  for (const t of teams) {
    for (const m of [t.captain, ...t.players]) await r.member(cid, t.teamId, m.uid).update({ isConnected: true, lastSeenAt: Timestamp.now() }).catch(() => {});
  }
}, 10_000);

console.log('\n2. Start and play all six tasks, all teams concurrently');
const t0 = Date.now();
await Promise.all(teams.map((t) => call(t.captain, 'POST', '/teams/start')));
check(teams.length > 0, `${teams.length} teams started`);

// Cross-team: team 2's player replays team 1's run id.
if (teams.length > 1) {
  const run1 = (await r.run(cid, teams[0].teamId, 'task01').get()).data()!;
  const cross = await call(teams[1].players[0], 'POST', '/tasks/task01/orient', { runId: run1.runId, clientEventId: randomUUID(), clientSeq: 1, payload: { direction: 'LEFT' } });
  check(cross.status === 409 && cross.data.error === 'STALE_RUN', 'a cross-team run id is rejected');
}

await Promise.all(
  teams.map(async (t) => {
    for (const taskId of TASK_ORDER) await play(t, taskId);
  })
);
clearInterval(heartbeat);
console.log(`   played in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

console.log('\n3. Verification');
const policy = ((await r.competition(cid).get()).data() as CompetitionDoc).scoringPolicy ?? DEFAULT_SCORING_POLICY;
for (const taskId of TASK_ORDER) {
  const completions = (await r.taskResult(cid, taskId).collection('completions').orderBy('completedAtMs').get()).docs
    .map((d) => d.data())
    .filter((c) => teams.some((t) => t.teamId === c.teamId));
  const all = (await r.taskResult(cid, taskId).collection('completions').orderBy('completedAtMs').get()).docs.map((d) => d.data());
  // Recompute ranks from stored server times in completion order.
  let groups: RankingGroup[] = [];
  const expected = new Map<string, [number, number]>();
  for (const c of all) {
    const placed = placeCompletion(groups, c.completedAtMs, policy);
    groups = placed.groups;
    expected.set(c.teamId, [placed.rank, placed.points]);
  }
  const consistent = completions.every((c) => {
    const [rank, points] = expected.get(c.teamId)!;
    return rank === c.rank && points === c.points;
  });
  check(completions.length === teams.length, `${taskId}: every team completed exactly once (${completions.length})`);
  check(consistent, `${taskId}: stored rank/points match the tie-window dense ranking`);
  const ranks = [...new Set(all.map((c) => c.rank))].sort((a, b) => a - b);
  check(ranks.every((rank, i) => rank === i + 1), `${taskId}: ranks are dense (${ranks.join(',')})`);
}

for (const t of teams) {
  const team = (await r.team(cid, t.teamId).get()).data()!;
  const summary = (await r.captainSummary(cid, t.teamId).get()).data()!;
  const sum = TASK_ORDER.reduce((s, id) => s + (summary.tasks[id]?.points ?? 0), 0);
  check(team.status === 'COMPLETED' && summary.totalScore === sum, `${t.name}: completed; total ${summary.totalScore} = sum of task points`);
  check(t.duplicatesRejected === 1, `${t.name}: replayed event returned as duplicate, applied once`);
  const task01Log = (await r.captainView(cid, t.teamId, 'task01').get()).data()!.log as Array<{ kind: string }>;
  check(task01Log.filter((e) => e.kind === 'REJECTED').length === t.wrongPlayerIgnored, `${t.name}: wrong-player tilt rejected without progress`);
}

console.log('\nLeaderboard');
for (const t of teams) {
  const s = (await r.captainSummary(cid, t.teamId).get()).data()!;
  console.log(`  ${t.name.padEnd(14)} ${String(s.totalScore).padStart(4)}  ${TASK_ORDER.map((id) => `${id}:#${s.tasks[id].rank}`).join(' ')}`);
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll rehearsal checks passed.');
process.exit(0);

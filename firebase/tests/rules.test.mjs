// Firestore rules as seen by an untrusted browser. Run with `npm test` in firebase/.
import fs from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

const C = 'competitions/c1';
const T1 = `${C}/teams/t1`;
const T2 = `${C}/teams/t2`;
const RUN = `${T1}/taskRuns/task02`;

let env;

function as(uid, email = `${uid}@iiitkottayam.ac.in`, verified = true) {
  return env.authenticatedContext(uid, { email, email_verified: verified }).firestore();
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-adavya',
    firestore: { rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});

after(async () => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const member = (uid, role, slot) => ({ uid, displayName: uid, role, slot, isConnected: true, lastSeenAt: Timestamp.now() });
    const writes = {
      'users/cap': { uid: 'cap', teamId: 't1', role: 'CAPTAIN' },
      'users/p1': { uid: 'p1', teamId: 't1', role: 'PLAYER' },
      'teamDirectory/1234': { competitionId: 'c1', teamId: 't1' },
      [C]: { name: 'Cup', status: 'ACTIVE' },
      [`${C}/taskDefinitions/task01`]: { title: 'Orientation' },
      [`${C}/privateTaskConfig/task02`]: { config: {} },
      [`${C}/privateTaskConfig/task02/locations/L01`]: { letter: 'C', hint: 'gate' },
      [`${C}/privateTaskConfig/task02/assignments/_default`]: { locationIds: ['L01'], correctLocationIds: ['L01'], word: 'CAT' },
      [`${C}/privateTaskConfig/task02/assignments/t1`]: { locationIds: ['L01'], correctLocationIds: ['L01'], word: 'CAT' },
      [`${C}/taskResults/task02`]: { groups: [] },
      [`${C}/taskResults/task02/completions/t1`]: { rank: 1 },
      [T1]: { captainUid: 'cap', status: 'IN_PROGRESS', currentTaskId: 'task02' },
      [`${T1}/members/cap`]: member('cap', 'CAPTAIN', 'captain'),
      [`${T1}/members/p1`]: member('p1', 'PLAYER', 'player1'),
      [`${T1}/members/p2`]: member('p2', 'PLAYER', 'player2'),
      [`${T1}/captain/summary`]: { totalScore: 100 },
      [`${T1}/private/task02`]: { sequence: 'COD' },
      [RUN]: { status: 'ACTIVE', runId: 'r1' },
      [`${RUN}/views/captain`]: { discoveredCount: 1 },
      [`${RUN}/views/p1`]: { discoveries: [] },
      [`${RUN}/views/p2`]: { discoveries: [] },
      [`${RUN}/events/p1_e1`]: { response: {} },
      [`${RUN}/assignedLocations/L01`]: { hint: 'gate' },
      [`${RUN}/discoveries/L01`]: { letter: 'C' },
      [`${RUN}/wordAttempts/a1`]: { letters: 'ABC' },
      [T2]: { captainUid: 'other', status: 'IN_PROGRESS' },
      [`${T2}/members/other`]: member('other', 'CAPTAIN', 'captain'),
      [`${T2}/taskRuns/task02`]: { status: 'ACTIVE' },
      [`${T2}/taskRuns/task02/views/captain`]: {},
    };
    for (const [path, data] of Object.entries(writes)) await setDoc(doc(db, path), data);
  });
});

describe('reads', () => {
  test('unauthenticated and non-institutional users read nothing', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, C)));
    await assertFails(getDoc(doc(as('x', 'x@gmail.com'), C)));
    await assertFails(getDoc(doc(as('x', 'x@iiitkottayam.ac.in.evil.com'), C)));
    await assertFails(getDoc(doc(as('x', 'x@iiitkottayam.ac.in', false), C)));
    await assertSucceeds(getDoc(doc(as('x'), C)));
    await assertSucceeds(getDoc(doc(as('x'), `${C}/taskDefinitions/task01`)));
  });

  test('own profile only', async () => {
    await assertSucceeds(getDoc(doc(as('p1'), 'users/p1')));
    await assertFails(getDoc(doc(as('p1'), 'users/cap')));
  });

  test('members read their team, roster and run status; outsiders cannot', async () => {
    for (const uid of ['cap', 'p1']) {
      await assertSucceeds(getDoc(doc(as(uid), T1)));
      await assertSucceeds(getDocs(collection(as(uid), `${T1}/members`)));
      await assertSucceeds(getDoc(doc(as(uid), RUN)));
    }
    await assertFails(getDoc(doc(as('other'), T1)));
    await assertFails(getDocs(collection(as('other'), `${T1}/members`)));
    await assertFails(getDoc(doc(as('other'), RUN)));
    await assertFails(getDoc(doc(as('p1'), T2)));
    await assertFails(getDocs(collection(as('p1'), `${C}/teams`)));
  });

  test('captain-only data', async () => {
    for (const path of [`${RUN}/views/captain`, `${T1}/captain/summary`, `${RUN}/assignedLocations/L01`, `${RUN}/discoveries/L01`, `${RUN}/wordAttempts/a1`]) {
      await assertSucceeds(getDoc(doc(as('cap'), path)));
      await assertFails(getDoc(doc(as('p1'), path)));
      await assertFails(getDoc(doc(as('other'), path)));
    }
  });

  test('a player reads only their own view', async () => {
    await assertSucceeds(getDoc(doc(as('p1'), `${RUN}/views/p1`)));
    await assertFails(getDoc(doc(as('p1'), `${RUN}/views/p2`)));
    await assertFails(getDoc(doc(as('cap'), `${RUN}/views/p1`)));
    // A non-member who happens to share a uid-named view path is still refused.
    await assertFails(getDoc(doc(as('other'), `${RUN}/views/other`)));
  });

  test('server-only data is unreadable by everyone', async () => {
    const paths = [
      'teamDirectory/1234',
      `${C}/privateTaskConfig/task02`,
      `${C}/privateTaskConfig/task02/locations/L01`,
      `${C}/privateTaskConfig/task02/assignments/_default`,
      `${C}/privateTaskConfig/task02/assignments/t1`,
      `${C}/taskResults/task02`,
      `${C}/taskResults/task02/completions/t1`,
      `${T1}/private/task02`,
      `${RUN}/events/p1_e1`,
    ];
    for (const path of paths) {
      for (const uid of ['cap', 'p1', 'other']) await assertFails(getDoc(doc(as(uid), path)));
    }
  });
});

describe('writes', () => {
  test('presence heartbeat: own connection fields with server time only', async () => {
    const p1 = as('p1');
    await assertSucceeds(updateDoc(doc(p1, `${T1}/members/p1`), { isConnected: true, lastSeenAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(p1, `${T1}/members/p1`), { isConnected: true, lastSeenAt: Timestamp.fromMillis(Date.now() + 3_600_000) }));
    await assertFails(updateDoc(doc(p1, `${T1}/members/p1`), { lastSeenAt: serverTimestamp(), role: 'CAPTAIN' }));
    await assertFails(updateDoc(doc(p1, `${T1}/members/p1`), { lastSeenAt: serverTimestamp(), slot: 'captain' }));
    await assertFails(updateDoc(doc(p1, `${T1}/members/p1`), { lastSeenAt: serverTimestamp(), displayName: 'x' }));
    await assertFails(updateDoc(doc(p1, `${T1}/members/p2`), { isConnected: false, lastSeenAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(p1, `${T1}/members/p1`)));
  });

  test('clients cannot change identity, membership, captain, progress, rank or points', async () => {
    const cap = as('cap');
    const p1 = as('p1');
    const attempts = [
      () => setDoc(doc(p1, 'users/p1'), { teamId: 't2', role: 'CAPTAIN' }, { merge: true }),
      () => updateDoc(doc(cap, T1), { captainUid: 'p1' }),
      () => updateDoc(doc(cap, T1), { status: 'COMPLETED' }),
      () => setDoc(doc(p1, `${T1}/members/intruder`), { uid: 'intruder', role: 'PLAYER' }),
      () => setDoc(doc(as('intruder'), `${T1}/members/intruder`), { uid: 'intruder', role: 'PLAYER' }),
      () => deleteDoc(doc(cap, `${T1}/members/p2`)),
      () => updateDoc(doc(cap, RUN), { status: 'COMPLETED' }),
      () => updateDoc(doc(cap, `${RUN}/views/captain`), { completionRank: 1, pointsAwarded: 100 }),
      () => updateDoc(doc(p1, `${RUN}/views/p1`), { discoveries: [{ letter: 'Z' }] }),
      () => setDoc(doc(p1, `${RUN}/discoveries/L02`), { letter: 'Z' }),
      () => setDoc(doc(cap, `${RUN}/wordAttempts/x`), { letters: 'COD', correct: true }),
      () => setDoc(doc(p1, `${RUN}/events/p1_forged`), { response: {} }),
      () => updateDoc(doc(cap, `${T1}/captain/summary`), { totalScore: 9999 }),
      () => setDoc(doc(cap, `${C}/taskResults/task02/completions/t1`), { rank: 1 }),
      () => setDoc(doc(cap, `${C}/privateTaskConfig/task02/locations/L01`), { letter: 'Z' }),
      () => setDoc(doc(cap, `${C}/privateTaskConfig/task02/assignments/t1`), { correctLocationIds: [] }),
      () => setDoc(doc(cap, 'teamDirectory/9999'), { teamId: 't1' }),
      () => updateDoc(doc(cap, C), { status: 'CLOSED' }),
    ];
    for (const attempt of attempts) await assertFails(attempt());
  });
});

// Seeds Firestore with dummy data matching src/types/firestore.ts.
// Usage: npm run seed   (reads VITE_FIREBASE_* from .env)
// Idempotent: documents are written with fixed ids, so re-running overwrites them.
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch } from 'firebase/firestore';

const env = process.env;
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});
const db = getFirestore(app);

const teams = [
  {
    team_name: 'Alpha Squad',
    team_id: 'ALPHA-7K2QX',
    captain_id: 'uid_alice',
    members_id: ['uid_alice', 'uid_bob', 'uid_carol'],
    round_status: 'round2',
    score: 120,
  },
  {
    team_name: 'Beta Brains',
    team_id: 'BETA-9M4TZ',
    captain_id: 'uid_dave',
    members_id: ['uid_dave', 'uid_erin', 'uid_frank'],
    round_status: 'round1',
    score: 60,
  },
  {
    team_name: 'Gamma Guild',
    team_id: 'GAMMA-3P8WL',
    captain_id: 'uid_grace',
    members_id: ['uid_grace', 'uid_heidi'],
    round_status: 'not_started',
    score: 0,
  },
];

const round1 = [
  {
    teamID: 'ALPHA-7K2QX',
    sequence: [1, 0, 1],
    playerActions: { uid_alice: 1, uid_bob: 0, uid_carol: 1 },
    code: 'ORBIT42',
  },
  {
    teamID: 'BETA-9M4TZ',
    sequence: [0, 1, 1],
    playerActions: { uid_dave: 0, uid_erin: null, uid_frank: 1 },
    code: 'SPIN7Q',
  },
];

const round2 = [
  {
    teamID: 'ALPHA-7K2QX',
    cluesGenerated: [
      'Where books outnumber people and silence is the rule.',
      'Where every meal on campus is served.',
      'Where the day begins with the national flag.',
    ],
    startedAt: '2026-09-24T10:00:00.000Z',
    sequence: ['sun', 'sand', 'oasis'],
  },
];

const questions = [
  { id: 'q1', question: 'What star is at the centre of our solar system?', location: [2, 5], word: 'sun' },
  { id: 'q2', question: 'What covers most of a desert floor?', location: [7, 1], word: 'sand' },
  { id: 'q3', question: 'A fertile spot in a desert with water is called?', location: [4, 8], word: 'oasis' },
  { id: 'q4', question: 'Which ship of the desert stores fat in its hump?', location: [9, 3], word: 'camel' },
  { id: 'q5', question: 'What is a hill of sand shaped by wind?', location: [0, 6], word: 'dune' },
];

const batch = writeBatch(db);
for (const t of teams) batch.set(doc(db, 'teams', t.team_id), t);
batch.set(doc(db, 'rounds', 'round1'), { name: 'Round 1' });
batch.set(doc(db, 'rounds', 'round2'), { name: 'Round 2' });
for (const r of round1) batch.set(doc(db, 'rounds', 'round1', 'teams', r.teamID), r);
for (const r of round2) batch.set(doc(db, 'rounds', 'round2', 'teams', r.teamID), r);
for (const { id, ...q } of questions) batch.set(doc(db, 'questions', id), q);

await batch.commit();
console.log(
  `Seeded ${teams.length} teams, ${round1.length} round1 + ${round2.length} round2 entries, ${questions.length} questions.`
);
process.exit(0);

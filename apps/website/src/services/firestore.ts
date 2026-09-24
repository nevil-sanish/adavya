import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  runTransaction,
  setDoc,
  updateDoc,
  type CollectionReference,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase.js';
import {
  MAX_TEAM_MEMBERS,
  type QuestionDoc,
  type Round1Doc,
  type Round2Doc,
  type RoundDocMap,
  type RoundId,
  type RoundStatus,
  type TeamDoc,
} from '../types/firestore.js';

const teamsCol = collection(db, 'teams') as CollectionReference<TeamDoc>;
const questionsCol = collection(db, 'questions') as CollectionReference<QuestionDoc>;

function roundTeamsCol<R extends RoundId>(round: R) {
  return collection(db, 'rounds', round, 'teams') as CollectionReference<RoundDocMap[R]>;
}

export function teamRef(teamId: string): DocumentReference<TeamDoc> {
  return doc(teamsCol, teamId);
}

export function roundEntryRef<R extends RoundId>(round: R, teamId: string) {
  return doc(roundTeamsCol(round), teamId);
}

/* ---------------------------------- teams --------------------------------- */

export async function createTeam(teamId: string, teamName: string, captainId: string): Promise<TeamDoc> {
  const ref = teamRef(teamId);
  const team: TeamDoc = {
    team_name: teamName,
    team_id: teamId,
    captain_id: captainId,
    members_id: [captainId],
    round_status: 'not_started',
    score: 0,
  };

  await runTransaction(db, async (tx) => {
    if ((await tx.get(ref)).exists()) {
      throw new Error(`Team ${teamId} already exists.`);
    }
    tx.set(ref, team);
  });
  return team;
}

/** Adds a member, enforcing the 3-member limit atomically. */
export async function joinTeam(teamId: string, memberId: string): Promise<TeamDoc> {
  const ref = teamRef(teamId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      throw new Error(`Team ${teamId} does not exist.`);
    }
    const team = snap.data();
    if (team.members_id.includes(memberId)) {
      return team;
    }
    if (team.members_id.length >= MAX_TEAM_MEMBERS) {
      throw new Error(`Team ${teamId} is full (${MAX_TEAM_MEMBERS} members).`);
    }
    tx.update(ref, { members_id: arrayUnion(memberId) });
    return { ...team, members_id: [...team.members_id, memberId] };
  });
}

export async function getTeam(teamId: string): Promise<TeamDoc | null> {
  const snap = await getDoc(teamRef(teamId));
  return snap.exists() ? snap.data() : null;
}

export async function listTeams(): Promise<TeamDoc[]> {
  const snap = await getDocs(teamsCol);
  return snap.docs.map((d) => d.data());
}

export function subscribeTeam(teamId: string, onChange: (team: TeamDoc | null) => void): Unsubscribe {
  return onSnapshot(teamRef(teamId), (snap) => onChange(snap.exists() ? snap.data() : null));
}

export async function setRoundStatus(teamId: string, status: RoundStatus): Promise<void> {
  await updateDoc(teamRef(teamId), { round_status: status });
}

export async function addScore(teamId: string, delta: number): Promise<void> {
  await updateDoc(teamRef(teamId), { score: increment(delta) });
}

/* --------------------------------- round 1 -------------------------------- */

export async function initRound1(
  teamId: string,
  sequence: Round1Doc['sequence'],
  memberIds: string[],
  code: string
): Promise<void> {
  const playerActions = Object.fromEntries(memberIds.map((id) => [id, null]));
  await setDoc(roundEntryRef('round1', teamId), { teamID: teamId, sequence, playerActions, code });
}

export async function getRound1(teamId: string): Promise<Round1Doc | null> {
  const snap = await getDoc(roundEntryRef('round1', teamId));
  return snap.exists() ? snap.data() : null;
}

export async function setPlayerAction(teamId: string, memberId: string, action: 0 | 1): Promise<void> {
  await updateDoc(roundEntryRef('round1', teamId), { [`playerActions.${memberId}`]: action });
}

/* --------------------------------- round 2 -------------------------------- */

export async function initRound2(teamId: string, sequence: Round2Doc['sequence']): Promise<void> {
  await setDoc(roundEntryRef('round2', teamId), { teamID: teamId, cluesGenerated: [], sequence });
}

export async function getRound2(teamId: string): Promise<Round2Doc | null> {
  const snap = await getDoc(roundEntryRef('round2', teamId));
  return snap.exists() ? snap.data() : null;
}

export async function addGeneratedClue(teamId: string, clue: string): Promise<void> {
  await updateDoc(roundEntryRef('round2', teamId), { cluesGenerated: arrayUnion(clue) });
}

export function subscribeRound<R extends RoundId>(
  round: R,
  teamId: string,
  onChange: (entry: RoundDocMap[R] | null) => void
): Unsubscribe {
  return onSnapshot(roundEntryRef(round, teamId), (snap) => onChange(snap.exists() ? snap.data() : null));
}

/* -------------------------------- questions ------------------------------- */

export async function listQuestions(): Promise<(QuestionDoc & { id: string })[]> {
  const snap = await getDocs(questionsCol);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

import type { Firestore } from 'firebase-admin/firestore';
import type { TaskId } from './types.js';

/** Every Firestore path the game uses, in one place. */
export function refs(db: Firestore) {
  const competition = (cid: string) => db.collection('competitions').doc(cid);
  const team = (cid: string, teamId: string) => competition(cid).collection('teams').doc(teamId);
  const run = (cid: string, teamId: string, taskId: TaskId | string) => team(cid, teamId).collection('taskRuns').doc(taskId);
  const privateConfig = (cid: string, taskId: TaskId | string) => competition(cid).collection('privateTaskConfig').doc(taskId);
  const taskResult = (cid: string, taskId: TaskId | string) => competition(cid).collection('taskResults').doc(taskId);

  return {
    user: (uid: string) => db.collection('users').doc(uid),
    teamDirectory: (code: string) => db.collection('teamDirectory').doc(code),
    competition,
    taskDefinition: (cid: string, taskId: string) => competition(cid).collection('taskDefinitions').doc(taskId),
    privateConfig,
    locations: (cid: string) => privateConfig(cid, 'task02').collection('locations'),
    /** Task 2 per-team assignments; `_default` applies to teams without their own. */
    assignment: (cid: string, key: string) => privateConfig(cid, 'task02').collection('assignments').doc(key),
    assignments: (cid: string) => privateConfig(cid, 'task02').collection('assignments'),
    teams: (cid: string) => competition(cid).collection('teams'),
    team,
    members: (cid: string, teamId: string) => team(cid, teamId).collection('members'),
    member: (cid: string, teamId: string, uid: string) => team(cid, teamId).collection('members').doc(uid),
    captainSummary: (cid: string, teamId: string) => team(cid, teamId).collection('captain').doc('summary'),
    teamPrivate: (cid: string, teamId: string, taskId: TaskId | string) => team(cid, teamId).collection('private').doc(taskId),
    run,
    captainView: (cid: string, teamId: string, taskId: TaskId | string) => run(cid, teamId, taskId).collection('views').doc('captain'),
    playerView: (cid: string, teamId: string, taskId: TaskId | string, uid: string) =>
      run(cid, teamId, taskId).collection('views').doc(uid),
    event: (cid: string, teamId: string, taskId: TaskId | string, eventId: string) =>
      run(cid, teamId, taskId).collection('events').doc(eventId),
    taskResult,
    completion: (cid: string, taskId: TaskId | string, teamId: string) =>
      taskResult(cid, taskId).collection('completions').doc(teamId),
  };
}

export type Refs = ReturnType<typeof refs>;

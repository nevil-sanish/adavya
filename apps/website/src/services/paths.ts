/** Firestore paths the captain site listens to. Rules restrict each to the right role. */
export const paths = {
  team: (cid: string, teamId: string) => `competitions/${cid}/teams/${teamId}`,
  members: (cid: string, teamId: string) => `competitions/${cid}/teams/${teamId}/members`,
  member: (cid: string, teamId: string, uid: string) => `competitions/${cid}/teams/${teamId}/members/${uid}`,
  summary: (cid: string, teamId: string) => `competitions/${cid}/teams/${teamId}/captain/summary`,
  run: (cid: string, teamId: string, taskId: string) => `competitions/${cid}/teams/${teamId}/taskRuns/${taskId}`,
  captainView: (cid: string, teamId: string, taskId: string) => `competitions/${cid}/teams/${teamId}/taskRuns/${taskId}/views/captain`,
  runCollection: (cid: string, teamId: string, taskId: string, name: string) =>
    `competitions/${cid}/teams/${teamId}/taskRuns/${taskId}/${name}`,
};

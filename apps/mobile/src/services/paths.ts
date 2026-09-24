/** Firestore paths the player app listens to. Rules restrict each to the right role. */
export const paths = {
  team: (cid: string, teamId: string) => `competitions/${cid}/teams/${teamId}`,
  members: (cid: string, teamId: string) => `competitions/${cid}/teams/${teamId}/members`,
  member: (cid: string, teamId: string, uid: string) => `competitions/${cid}/teams/${teamId}/members/${uid}`,
  run: (cid: string, teamId: string, taskId: string) => `competitions/${cid}/teams/${teamId}/taskRuns/${taskId}`,
  playerView: (cid: string, teamId: string, taskId: string, uid: string) =>
    `competitions/${cid}/teams/${teamId}/taskRuns/${taskId}/views/${uid}`,
};

import type { Timestamp } from 'firebase-admin/firestore';

export const TASK_ORDER = ['task01', 'task02', 'task03', 'task04', 'task05', 'task06'] as const;
export type TaskId = (typeof TASK_ORDER)[number];

export type TaskType = 'ORIENTATION' | 'GPS_LETTER' | 'POSE_RELAY' | 'SOUND_RELAY' | 'RESPONSE_TIME' | 'MORSE_RELAY';

export const PLAYER_SLOTS = ['player1', 'player2', 'player3'] as const;
export type PlayerSlot = (typeof PLAYER_SLOTS)[number];
export type Slot = 'captain' | PlayerSlot;
export type Role = 'CAPTAIN' | 'PLAYER';

export const REQUIRED_MEMBERS = 4;

export interface ScoringPolicy {
  pointsByRank: Record<string, number>;
  tieWindowMs: number;
  tieMode: 'DENSE';
}

export interface CompetitionDoc {
  name: string;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
  taskOrder: TaskId[];
  scoringPolicy: ScoringPolicy;
  createdAt?: Timestamp;
  startedAt?: Timestamp | null;
}

export interface UserDoc {
  uid: string;
  email: string;
  displayName: string;
  competitionId: string | null;
  teamId: string | null;
  role: Role | null;
  slot: Slot | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type TeamStatus = 'LOBBY' | 'IN_PROGRESS' | 'COMPLETED';

export interface TeamDoc {
  teamId: string;
  competitionId: string;
  teamCode: string;
  teamName: string;
  captainUid: string;
  status: TeamStatus;
  memberCount: number;
  requiredMembers: number;
  currentTaskId: TaskId | null;
  createdAt: Timestamp;
  lockedAt: Timestamp | null;
  completedAt: Timestamp | null;
}

export interface MemberDoc {
  uid: string;
  displayName: string;
  role: Role;
  slot: Slot;
  joinedAt: Timestamp;
  isConnected: boolean;
  lastSeenAt: Timestamp;
}

export type RunStatus = 'ACTIVE' | 'COMPLETED';

/** Readable by every team member: no progress, targets, rank or points. */
export interface TaskRunDoc {
  taskId: TaskId;
  taskType: TaskType;
  title: string;
  status: RunStatus;
  runId: string;
  startedAt: Timestamp;
  completedAt: Timestamp | null;
}

export interface CaptainLogEntry {
  at: number;
  kind: 'ACCEPTED' | 'REJECTED' | 'INFO';
  message: string;
}

export interface RankingGroup {
  rank: number;
  anchorMs: number;
  points: number;
  teamCount: number;
}

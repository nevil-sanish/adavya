/** Firestore document shapes as the clients see them, and the fixed task catalog. */

export const TASK_ORDER = ['task01', 'task02', 'task03', 'task04', 'task05', 'task06'] as const;
export type TaskId = (typeof TASK_ORDER)[number];

export const TASK_META: Record<TaskId, { title: string; short: string; captain: string; player: string }> = {
  task01: {
    title: 'Left / Right Orientation',
    short: 'Orientation',
    captain: 'Rebuild the hidden binary sequence. Tell the highlighted player to tilt left (0) or right (1); a wrong guess shows red and nothing advances.',
    player: 'Hold your phone flat, screen up. Tilt it left or right and hold until it locks. Your captain tells you when and which way.',
  },
  task02: {
    title: 'Campus GPS Letters',
    short: 'GPS Letters',
    captain: 'Five riddles lead to five campus locations. Send your players; letters appear here as they are found. Two are decoys: three letters form a word.',
    player: 'Go to the location your captain describes. When you are inside it, your letter appears automatically.',
  },
  task03: {
    title: 'Pose Relay',
    short: 'Poses',
    captain: 'Describe each pose to its performer without showing them. Each phone confirms the pose on its own.',
    player: 'Stand back so your whole upper body is in view and do the pose your captain describes. Hold it still.',
  },
  task04: {
    title: 'Sound Relay',
    short: 'Sound',
    captain: 'Three loudness targets must be hit in this order. You do not know who owns which target: find out and guide them.',
    player: 'Make a steady sound and hold it. The meter shows roughly how loud you are. Your captain guides you.',
  },
  task05: {
    title: 'Response-Time Relay',
    short: 'Timing',
    captain: 'Tell each player their target time. They stop a blind stopwatch; you see the result and decide: retry (costs points) or lock in.',
    player: 'Press Start, count the time in your head, press Stop. Your captain tells you whether to retry or lock in.',
  },
  task06: {
    title: 'Morse Word Relay',
    short: 'Morse',
    captain: 'Get the word tapped out in Morse, one letter per player, in order. Find out whose letter is next.',
    player: 'Tap for a dot, press and hold for a dash. Press Submit Letter when your letter is complete.',
  },
};

export type Role = 'CAPTAIN' | 'PLAYER';
export type Slot = 'captain' | 'player1' | 'player2' | 'player3';

export const SLOT_LABEL: Record<Slot, string> = {
  captain: 'Captain',
  player1: 'Player 1',
  player2: 'Player 2',
  player3: 'Player 3',
};

/** Firestore Timestamp, reduced to what the clients use. */
export interface TimestampLike {
  toMillis(): number;
}

export interface Profile {
  uid: string;
  email: string;
  displayName: string;
  competitionId: string | null;
  teamId: string | null;
  role: Role | null;
  slot: Slot | null;
}

export interface Session {
  user: Profile;
  isAdmin: boolean;
  activeCompetitionId: string;
}

export type TeamStatus = 'LOBBY' | 'IN_PROGRESS' | 'COMPLETED';

export interface Team {
  teamId: string;
  competitionId: string;
  teamCode: string;
  teamName: string;
  captainUid: string;
  status: TeamStatus;
  memberCount: number;
  requiredMembers: number;
  currentTaskId: TaskId | null;
  /** Tasks this team plays, fixed when the captain starts (skipped tasks left out). */
  taskPlan?: TaskId[];
}

/** The tasks a team plays, in order. Teams started before task plans existed play all six. */
export function teamTasks(team: Pick<Team, 'taskPlan'>): readonly TaskId[] {
  return team.taskPlan ?? TASK_ORDER;
}

export interface Member {
  uid: string;
  displayName: string;
  role: Role;
  slot: Slot;
  isConnected: boolean;
  lastSeenAt: TimestampLike | null;
}

export interface TaskRun {
  taskId: TaskId;
  taskType: string;
  title: string;
  status: 'ACTIVE' | 'COMPLETED';
  runId: string;
  startedAt: TimestampLike | null;
  completedAt: TimestampLike | null;
}

export interface CaptainLogEntry {
  at: number;
  kind: 'ACCEPTED' | 'REJECTED' | 'INFO';
  message: string;
}

interface CaptainViewBase {
  taskId: TaskId;
  status: 'ACTIVE' | 'COMPLETED';
  completionRank: number | null;
  pointsAwarded: number;
  lastSeq?: number;
  log: CaptainLogEntry[];
}

export interface Task01CaptainView extends CaptainViewBase {
  length: number;
  currentStep: number;
  revealed: number[];
  currentPlayerUid: string | null;
  currentPlayerName: string | null;
}

export interface Task02CaptainView extends CaptainViewBase {
  hintCount: number;
  correctRequired: number;
  discoveredCount: number;
  attemptCount: number;
  completionMode: 'CAPTAIN_SUBMITS_WORD' | 'AUTO_ON_THREE_CORRECT';
  acceptAnyOrder: boolean;
  /** The word counts only after the three correct locations were found (absent in older runs: false). */
  requireDiscoveries?: boolean;
  revealClassification: boolean;
  /** Correct letters found; null unless the admin reveals classification after discovery. */
  correctFound: number | null;
}

export interface AssignedHint {
  locationId: string;
  order: number;
  hint: string;
}

export interface Discovery {
  locationId: string;
  order: number;
  hint: string;
  letter: string;
  discoveredByUid: string;
  discoveredByName: string;
  discoveredAt: TimestampLike | null;
  status: 'VALIDATED';
  viaOfflineQueue?: boolean;
  /** Present only when classification is revealed after discovery. */
  resultType?: 'CORRECT' | 'DECOY';
}

export interface WordAttempt {
  letters: string;
  correct: boolean;
  byName: string;
  at: TimestampLike | null;
}

export interface Task03CaptainView extends CaptainViewBase {
  performers: Array<{ uid: string; name: string; slot: Slot; poseId: PoseId; poseName: string; completed: boolean }>;
  completedCount: number;
}

export interface Task04CaptainView extends CaptainViewBase {
  targets: number[];
  completedCount: number;
  toleranceDb: number;
  holdMs: number;
}

export interface Task05Attempt {
  attemptId: string;
  durationMs: number;
  errorMs: number;
  score: number;
}

export interface Task05CaptainView extends CaptainViewBase {
  executors: Array<{
    uid: string;
    name: string;
    slot: Slot;
    targetMs: number;
    attempts: Task05Attempt[];
    finalized: boolean;
    finalScore: number | null;
  }>;
  finalizedCount: number;
  totalScore: number;
  maxAttempts: number;
}

export interface Task06CaptainView extends CaptainViewBase {
  word: string;
  currentPosition: number;
  acceptedMorse: string[];
  attempts: Array<{ position: number; morse: string; byName: string; result: 'ACCEPTED' | 'WRONG_PLAYER' | 'WRONG_MORSE'; at: number }>;
}

export type CaptainView =
  | Task01CaptainView
  | Task02CaptainView
  | Task03CaptainView
  | Task04CaptainView
  | Task05CaptainView
  | Task06CaptainView;

/** A player's own view: `taskRuns/{taskId}/views/{uid}`. */
export interface PlayerView {
  lastSeq: number;
  discoveries?: Array<{ locationId: string; order: number; letter: string; resultType?: 'CORRECT' | 'DECOY' }>;
  attemptsUsed?: number;
  maxAttempts?: number;
  finalized?: boolean;
  holdMs?: number;
}

export interface CaptainSummary {
  totalScore: number;
  tasks: Partial<Record<TaskId, { rank: number; points: number; completedAtMs: number }>>;
}

export const POSE_IDS = ['t_pose', 'both_hands_up', 'one_hand_up_one_down'] as const;
export type PoseId = (typeof POSE_IDS)[number];

export const POSE_INFO: Record<PoseId, { name: string; description: string }> = {
  t_pose: { name: 'T-Pose', description: 'Stand straight with both arms stretched out sideways at shoulder height.' },
  both_hands_up: { name: 'Both Hands Up', description: 'Raise both arms straight up above your head.' },
  one_hand_up_one_down: { name: 'One Hand Up, One Down', description: 'One arm straight up, the other straight down by your side.' },
};

/** Presence heartbeat interval and the age after which a member counts as disconnected. */
export const HEARTBEAT_MS = 10_000;
export const PRESENCE_STALE_MS = 45_000;

export function isMemberOnline(member: Member, now = Date.now()): boolean {
  const seen = member.lastSeenAt?.toMillis() ?? 0;
  return member.isConnected && now - seen <= PRESENCE_STALE_MS;
}

/** One team's line on the final leaderboards (GET /api/leaderboard). */
export interface TeamStanding {
  teamId: string;
  teamName: string;
  totalScore: number;
  tasksCompleted: number;
  currentTaskId: TaskId | null;
  finished: boolean;
  completedAtMs: number | null;
  durationMs: number | null;
}

export interface Leaderboards {
  /** Highest points first; equal points broken by earlier finish. */
  points: Array<TeamStanding & { rank: number }>;
  /** Finishers by completion time, then unfinished teams (rank null). */
  finishOrder: Array<TeamStanding & { rank: number | null }>;
  generatedAtMs: number;
  yourTeamId: string | null;
}

/** 1:23:45 or 12:34 */
export function formatDuration(ms: number | null): string {
  if (ms === null || ms < 0) return '—';
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

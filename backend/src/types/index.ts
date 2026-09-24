export interface User {
  id: string;
  email: string;
  name: string;
  googleId: string;
  hasOnboarded: boolean;
  teamId?: string;
  taskspaceName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AuthResponse {
  user: User;
  isNewUser: boolean;
  token: string;
}

export interface TeamMember {
  id?: string;
  googleId: string;
  email: string;
  name: string;
  role: 'owner' | 'member';
  joinedAt: string;
}

export interface TeamTaskspace {
  teamId: string;
  name: string;
  ownerEmail?: string;
  membersCount: number;
  createdBy?: {
    id?: string;
    googleId: string;
    email: string;
    name: string;
  };
  members?: TeamMember[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateTeamRequest {
  teamName: string;
}

export interface JoinTeamRequest {
  teamId: string;
}

export type TaskType =
  | 'orientation'
  | 'spec_review'
  | 'agent_pipeline'
  | 'code_review'
  | 'deployment'
  | 'custom';

export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export type Orientation = 'clockwise' | 'anticlockwise' | null;

export interface PlayerOrientation {
  id: string;
  name: string;
  orientation: Orientation;
}

export interface OrientationTaskData {
  players: PlayerOrientation[];
  hasGenerated: boolean;
  generatedAt?: string;
  generationCount: number;
}

export interface SpecReviewTaskData {
  specTitle: string;
  version: string;
  checklist: Array<{ id: string; label: string; completed: boolean }>;
}

export interface CodeReviewTaskData {
  coveragePercent: number;
  testsTotal: number;
  testsPassed: number;
  securityVulnerabilities: number;
  approved: boolean;
}

export interface DeploymentTaskData {
  targetEnvironment: string;
  releaseVersion: string;
  deployedAt?: string;
  deployStatus: 'ready' | 'deploying' | 'live' | 'failed';
}

export interface TaskItem<T = Record<string, unknown>> {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  pipelineStage: number; // 1: Sprint Spec, 2: Agent Pipeline, 3: Code Review, 4: Deployment
  assignedTo?: string;
  data: T;
  createdAt: string;
  updatedAt: string;
}

export interface OrientationState {
  players: PlayerOrientation[];
  generatedAt?: string;
  generationCount: number;
}

export interface RoundPlayer {
  id: string;
  name: string;
  orientation: 0 | 1;
  orientationLabel: 'clockwise' | 'anticlockwise';
}

export interface RoundInstance {
  roundId?: string;
  roundNumber: number;
  teamId: string;
  orientation: {
    player1: 0 | 1;
    player2: 0 | 1;
    player3: 0 | 1;
  };
  orientations: (0 | 1)[] | number | null;
  player1: 0 | 1 | null;
  player2: 0 | 1 | null;
  player3: 0 | 1 | null;
  players: RoundPlayer[];
  timerStarted: boolean;
  createdAt: string;
  updatedAt?: string;
}

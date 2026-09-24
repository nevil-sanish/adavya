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

export interface TeamTaskspace {
  teamId: string;
  name: string;
  ownerEmail?: string;
  membersCount: number;
  createdAt?: string;
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

/**
 * Strict TypeScript definitions for Adavya Auth & Team Taskspace Onboarding
 */

export interface User {
  id: string;
  email: string;
  name: string;
  googleId: string;
  hasOnboarded: boolean;
  teamId?: string;
  taskspaceName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  user: User;
  isNewUser: boolean;
  token?: string;
}

export interface CreateTeamRequest {
  teamName: string;
}

export interface JoinTeamRequest {
  teamId: string;
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
  description?: string;
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

export interface OnboardingResponse {
  user: User;
  taskspace: TeamTaskspace;
  message: string;
}

export interface GoogleTokenPayload {
  iss?: string;
  sub?: string;
  azp?: string;
  aud?: string;
  iat?: number;
  exp?: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}

export type TaskType =
  | 'orientation'
  | 'spec_review'
  | 'agent_pipeline'
  | 'code_review'
  | 'deployment'
  | 'custom';

export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface TaskItem<T = Record<string, unknown>> {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  pipelineStage: number;
  assignedTo?: string;
  data: T;
  createdAt?: string;
  updatedAt?: string;
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
  orientations: (0 | 1)[];
  player1: 0 | 1;
  player2: 0 | 1;
  player3: 0 | 1;
  players: RoundPlayer[];
  timerStarted: boolean;
  createdAt: string;
  updatedAt?: string;
}

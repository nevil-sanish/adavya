import { doc, setDoc } from 'firebase/firestore';
import { auth, db, signOutFirebase } from './firebase.js';
import {
  AuthResponse,
  CreateTeamRequest,
  JoinTeamRequest,
  OnboardingResponse,
  User,
  TeamTaskspace,
} from '../types/auth.js';
import type { PoseId, PoseSlot } from '../types/firestore.js';
import {
  validateTeamIdFormat,
  generateTeamId,
} from '../schemas/workspace.schema.js';

const STORAGE_KEY_USER = 'adavya_auth_user';
const STORAGE_KEY_TOKEN = 'adavya_auth_token';
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export class AuthApiError extends Error {
  public code: string;
  public status?: number;

  constructor(message: string, code = 'AUTH_ERROR', status = 400) {
    super(message);
    this.name = 'AuthApiError';
    this.code = code;
    this.status = status;
  }
}

/** Verify the Firebase token on the server before creating an app session. */
export async function authenticateWithGoogle(idToken: string): Promise<AuthResponse> {
  try {
    const response = await fetch(`${API_BASE_URL || 'http://localhost:5000'}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new AuthApiError(data.message || 'Google authentication failed.', data.error, response.status);
    }
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(data.user));
    localStorage.setItem(STORAGE_KEY_TOKEN, idToken);
    return data;
  } catch (err) {
    if (err instanceof AuthApiError) throw err;
    throw new AuthApiError('Unable to reach the sign-in server. Please try again.', 'NETWORK_ERROR', 503);
  }
}

/**
 * Option 1: Create a new Team Taskspace
 * Generates a Team ID, persists to Firestore and backend, and links the user.
 */
export async function createTeamTaskspace(request: CreateTeamRequest): Promise<OnboardingResponse> {
  const rawName = request.teamName.trim();
  if (!rawName) {
    throw new AuthApiError('Team name is required.', 'VALIDATION_ERROR', 400);
  }

  const stored = localStorage.getItem(STORAGE_KEY_USER);
  if (!stored) {
    throw new AuthApiError('Session not found. Please log in again.', 'SESSION_NOT_FOUND', 401);
  }

  const currentUser = JSON.parse(stored) as User;
  const generatedTeamId = generateTeamId(rawName);
  const now = new Date().toISOString();

  let createdTaskspace: TeamTaskspace = {
    teamId: generatedTeamId,
    name: rawName,
    ownerEmail: currentUser.email,
    membersCount: 1,
    createdBy: {
      id: currentUser.id,
      googleId: currentUser.googleId,
      email: currentUser.email,
      name: currentUser.name,
    },
    members: [
      {
        id: currentUser.id,
        googleId: currentUser.googleId,
        email: currentUser.email,
        name: currentUser.name,
        role: 'owner',
        joinedAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  let backendSaved = false;

  // 1. Call Backend API (Backend saves to Firestore with exact teamId and user details)
  if (API_BASE_URL) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/teams/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: generatedTeamId, // Pass identical ID to prevent duplicate team instances
          teamName: rawName,
          userEmail: currentUser.email,
          googleId: currentUser.googleId,
          userName: currentUser.name,
          userId: currentUser.id,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.taskspace) {
          createdTaskspace = data.taskspace;
        }
        backendSaved = true;
        console.log(`[Backend API] Team created with user details: ${createdTaskspace.teamId}`);
      }
    } catch (apiErr) {
      console.warn('[Backend API] Team create API call warning:', apiErr);
    }
  }

  // 2. Client fallback only if backend was unreachable
  if (!backendSaved) {
    try {
      await setDoc(doc(db, 'teams', createdTaskspace.teamId), createdTaskspace, { merge: true });
      if (currentUser.googleId) {
        await setDoc(
          doc(db, 'users', currentUser.googleId),
          {
            hasOnboarded: true,
            teamId: createdTaskspace.teamId,
            taskspaceName: rawName,
            updatedAt: now,
          },
          { merge: true }
        );
      }
      console.log(`[Firestore Client Fallback] Team ${createdTaskspace.teamId} saved with user details`);
    } catch (fsErr) {
      console.warn('[Firestore Client] Team persistence warning:', fsErr);
    }
  }

  const updatedUser: User = {
    ...currentUser,
    hasOnboarded: true,
    teamId: createdTaskspace.teamId,
    taskspaceName: rawName,
    updatedAt: now,
  };

  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));

  return {
    user: updatedUser,
    taskspace: createdTaskspace,
    message: `Team Taskspace created with ID: ${createdTaskspace.teamId}`,
  };
}

/**
 * Option 2: Join an existing Team Taskspace
 * Validates Team ID, persists member user detail, and links the user.
 */
export async function joinTeamTaskspace(request: JoinTeamRequest): Promise<OnboardingResponse> {
  const validation = validateTeamIdFormat(request.teamId);
  if (!validation.isValid || !validation.normalizedValue) {
    throw new AuthApiError(validation.error || 'Invalid Team ID.', 'VALIDATION_ERROR', 400);
  }

  const normalizedTeamId = validation.normalizedValue;

  const stored = localStorage.getItem(STORAGE_KEY_USER);
  if (!stored) {
    throw new AuthApiError('Session not found. Please log in again.', 'SESSION_NOT_FOUND', 401);
  }

  const currentUser = JSON.parse(stored) as User;
  const now = new Date().toISOString();

  let joinedTaskspace: TeamTaskspace = {
    teamId: normalizedTeamId,
    name: `Taskspace (${normalizedTeamId})`,
    membersCount: 2,
    members: [
      {
        id: currentUser.id,
        googleId: currentUser.googleId,
        email: currentUser.email,
        name: currentUser.name,
        role: 'member',
        joinedAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  let backendSaved = false;

  // 1. Call Backend API to update team and user in Firestore
  if (API_BASE_URL) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/teams/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: normalizedTeamId,
          userEmail: currentUser.email,
          googleId: currentUser.googleId,
          userName: currentUser.name,
          userId: currentUser.id,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.taskspace) {
          joinedTaskspace = data.taskspace;
        }
        backendSaved = true;
        console.log(`[Backend API] Joined team with user detail: ${normalizedTeamId}`);
      }
    } catch (apiErr) {
      console.warn('[Backend API] Team join API call warning:', apiErr);
    }
  }

  // 2. Client fallback only if backend was unreachable
  if (!backendSaved) {
    try {
      await setDoc(doc(db, 'teams', normalizedTeamId), joinedTaskspace, { merge: true });
      if (currentUser.googleId) {
        await setDoc(
          doc(db, 'users', currentUser.googleId),
          {
            hasOnboarded: true,
            teamId: normalizedTeamId,
            taskspaceName: joinedTaskspace.name,
            updatedAt: now,
          },
          { merge: true }
        );
      }
      console.log(`[Firestore Client Fallback] Joined team ${normalizedTeamId} with user details`);
    } catch (fsErr) {
      console.warn('[Firestore Client] Team join persistence warning:', fsErr);
    }
  }

  const updatedUser: User = {
    ...currentUser,
    hasOnboarded: true,
    teamId: normalizedTeamId,
    taskspaceName: joinedTaskspace.name,
    updatedAt: now,
  };

  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));

  return {
    user: updatedUser,
    taskspace: joinedTaskspace,
    message: `Joined team taskspace ${normalizedTeamId}`,
  };
}

export async function getCurrentSession(): Promise<User | null> {
  try {
    await auth.authStateReady();
    const firebaseUser = auth.currentUser;
    if (!firebaseUser?.emailVerified || !/^[^@\s]+@iiitkottayam\.ac\.in$/i.test(firebaseUser.email || '')) {
      await logoutSession();
      await signOutFirebase();
      return null;
    }
    const token = await firebaseUser.getIdToken();
    const response = await fetch(`${API_BASE_URL || 'http://localhost:5000'}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Session verification failed.');
    const { user } = await response.json();
    // Preserve local onboarding state only for the same verified identity.
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    const cached = raw ? JSON.parse(raw) as User : null;
    const sessionUser = cached?.googleId === firebaseUser.uid && cached?.email === user.email
      ? { ...cached, email: user.email, googleId: firebaseUser.uid }
      : user;
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(sessionUser));
    return sessionUser;
  } catch {
    await logoutSession();
    return null;
  }
}

export async function logoutSession(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY_USER);
  localStorage.removeItem(STORAGE_KEY_TOKEN);
}

function simulateDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RoundVerifyResult {
  correct: boolean;
  message: string;
}

export interface Round2State {
  roundStatus: 'not_started' | 'round1' | 'round2' | 'round3' | 'completed';
  clues: string[];
  completedAt?: string | null;
}

/** Calls a round endpoint with the signed-in user's Firebase token. */
async function roundRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const fbUser = auth.currentUser;
  if (!fbUser) {
    throw new AuthApiError('Session expired. Please log in again.', 'SESSION_NOT_FOUND', 401);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL || 'http://localhost:5000'}/api/rounds${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await fbUser.getIdToken()}`,
      },
    });
  } catch {
    throw new AuthApiError('Unable to reach the server. Please try again.', 'NETWORK_ERROR', 503);
  }

  const data = await response.json();
  if (!response.ok) {
    throw new AuthApiError(data.message || 'Request failed.', data.error, response.status);
  }
  return data;
}

/** Sends the code revealed on the field phones to the server for Round 1 verification. */
export function verifyRound1Code(code: string): Promise<RoundVerifyResult> {
  return roundRequest('/round1/verify', { method: 'POST', body: JSON.stringify({ code }) });
}

/** Fetches the team's round status and, once unlocked, the Round 2 clues. */
export function getRound2State(): Promise<Round2State> {
  return roundRequest('/round2');
}

/** Submits the three words found by the field team, in order. */
export function verifyRound2Words(words: [string, string, string]): Promise<RoundVerifyResult> {
  return roundRequest('/round2/verify', { method: 'POST', body: JSON.stringify({ words }) });
}

export interface TeamProgressMember {
  uid: string;
  name: string;
  email: string;
  isCaptain: boolean;
  isYou: boolean;
}

export interface TeamProgress {
  teamId: string;
  teamName: string;
  roundStatus: Round2State['roundStatus'];
  members: TeamProgressMember[];
}

/** Fetches the caller's team roster and round progress. */
export function getTeamProgress(): Promise<TeamProgress> {
  return roundRequest('/progress');
}

/** Dev only: skips the team to the next task. The server rejects this outside development. */
export function devAdvanceTask(): Promise<{ roundStatus: TeamProgress['roundStatus'] }> {
  return roundRequest('/dev/advance', { method: 'POST' });
}

export interface Round3State {
  teamId: string;
  assignments: Record<PoseSlot, PoseId>;
}

/** Fetches the pose each performer must hold in Round 3. */
export function getRound3State(): Promise<Round3State> {
  return roundRequest('/round3');
}

/** Asks the server to close Round 3 once every performer is verified. */
export function completeRound3(): Promise<RoundVerifyResult> {
  return roundRequest('/round3/complete', { method: 'POST' });
}

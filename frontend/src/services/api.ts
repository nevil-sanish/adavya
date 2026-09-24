import { jwtDecode } from 'jwt-decode';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import {
  AuthResponse,
  GoogleTokenPayload,
  CreateTeamRequest,
  JoinTeamRequest,
  OnboardingResponse,
  User,
  TeamTaskspace,
} from '../types/auth.js';
import {
  DEFAULT_TASKSPACES,
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

/**
 * Google OAuth Authentication (Gmail-Restricted)
 */
export async function authenticateWithGoogle(idToken: string): Promise<AuthResponse> {
  if (API_BASE_URL) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new AuthApiError(data.message || 'Google authentication failed', data.code, response.status);
      }
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(data.user));
      return data;
    } catch (err) {
      if (err instanceof AuthApiError) throw err;
      throw new AuthApiError('Network connection failed while contacting auth server.', 'NETWORK_ERROR', 503);
    }
  }

  // Client-Side parsing
  await simulateDelay(350);

  if (!idToken) {
    throw new AuthApiError('Invalid or missing Google ID token.', 'INVALID_TOKEN', 400);
  }

  let payload: GoogleTokenPayload;
  try {
    payload = jwtDecode<GoogleTokenPayload>(idToken);
  } catch {
    throw new AuthApiError('Unable to parse Google ID token signature.', 'INVALID_TOKEN', 400);
  }

  if (payload.exp && payload.exp * 1000 < Date.now()) {
    throw new AuthApiError('Google session expired. Please sign in again.', 'EXPIRED_TOKEN', 401);
  }

  const email = payload.email?.toLowerCase().trim();
  if (!email) {
    throw new AuthApiError('Google account does not contain a verified email.', 'MISSING_EMAIL', 400);
  }

  const isGmail = email.endsWith('@gmail.com') || email.endsWith('@googlemail.com');
  if (!isGmail) {
    throw new AuthApiError(
      `Access restricted: Only @gmail.com accounts are permitted to access Adavya. (${email} is restricted)`,
      'GMAIL_RESTRICTED',
      403
    );
  }

  const now = new Date().toISOString();
  const user: User = {
    id: `usr_${Math.random().toString(36).substring(2, 10)}`,
    email,
    name: payload.name || email.split('@')[0],
    googleId: payload.sub || `g_${Date.now()}`,
    hasOnboarded: false,
    createdAt: now,
    updatedAt: now,
  };

  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  localStorage.setItem(STORAGE_KEY_TOKEN, idToken);

  return { user, isNewUser: true, token: idToken };
}

/**
 * Fast Mock Login for testing
 */
export async function authenticateWithMockGoogle(options?: {
  email?: string;
  name?: string;
  rejectNonGmail?: boolean;
}): Promise<AuthResponse> {
  await simulateDelay(400);

  const email = options?.email || 'shubham.adavya@gmail.com';
  if (options?.rejectNonGmail || (!email.endsWith('@gmail.com') && !email.endsWith('@googlemail.com'))) {
    throw new AuthApiError(
      `Access restricted: Only @gmail.com accounts are permitted. (${email} is restricted)`,
      'GMAIL_RESTRICTED',
      403
    );
  }

  const user: User = {
    id: 'usr_demo_1001',
    email,
    name: options?.name || 'Shubham Biswal',
    googleId: 'g_demo_1234567890',
    hasOnboarded: false,
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  localStorage.setItem(STORAGE_KEY_TOKEN, 'mock_token');

  return { user, isNewUser: true, token: 'mock_token' };
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

  const generatedTeamId = generateTeamId(rawName);

  await simulateDelay(300);

  const stored = localStorage.getItem(STORAGE_KEY_USER);
  if (!stored) {
    throw new AuthApiError('Session not found. Please log in again.', 'SESSION_NOT_FOUND', 401);
  }

  const currentUser = JSON.parse(stored) as User;
  const now = new Date().toISOString();
  const updatedUser: User = {
    ...currentUser,
    hasOnboarded: true,
    teamId: generatedTeamId,
    taskspaceName: rawName,
    updatedAt: now,
  };

  const newTaskspace: TeamTaskspace = {
    teamId: generatedTeamId,
    name: rawName,
    ownerEmail: currentUser.email,
    membersCount: 1,
    createdAt: now,
  };

  // 1. Direct Client-side Firestore persistence
  try {
    await setDoc(doc(db, 'teams', generatedTeamId), newTaskspace, { merge: true });
    if (currentUser.googleId) {
      await setDoc(
        doc(db, 'users', currentUser.googleId),
        {
          hasOnboarded: true,
          teamId: generatedTeamId,
          taskspaceName: rawName,
          updatedAt: now,
        },
        { merge: true }
      );
    }
    console.log(`[Firestore Client] Team ${generatedTeamId} saved and user updated`);
  } catch (fsErr) {
    console.warn('[Firestore Client] Team persistence warning:', fsErr);
  }

  // 2. Backend API persistence
  if (API_BASE_URL) {
    try {
      await fetch(`${API_BASE_URL}/api/teams/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName: rawName,
          userEmail: currentUser.email,
          googleId: currentUser.googleId,
        }),
      });
      console.log(`[Backend API] Team created via backend API`);
    } catch (apiErr) {
      console.warn('[Backend API] Team create API call warning:', apiErr);
    }
  }

  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));

  return {
    user: updatedUser,
    taskspace: newTaskspace,
    message: `Team Taskspace created with ID: ${generatedTeamId}`,
  };
}

/**
 * Option 2: Join an existing Team Taskspace
 * Validates Team ID, persists to Firestore and backend, and links the user.
 */
export async function joinTeamTaskspace(request: JoinTeamRequest): Promise<OnboardingResponse> {
  const validation = validateTeamIdFormat(request.teamId);
  if (!validation.isValid || !validation.normalizedValue) {
    throw new AuthApiError(validation.error || 'Invalid Team ID.', 'VALIDATION_ERROR', 400);
  }

  const normalizedTeamId = validation.normalizedValue;

  await simulateDelay(300);

  // Check known taskspaces or accept properly formatted IDs
  const matched = DEFAULT_TASKSPACES.find(
    (t) => t.teamId.toUpperCase() === normalizedTeamId
  );

  const taskspaceName = matched ? matched.name : `Taskspace (${normalizedTeamId})`;

  const stored = localStorage.getItem(STORAGE_KEY_USER);
  if (!stored) {
    throw new AuthApiError('Session not found. Please log in again.', 'SESSION_NOT_FOUND', 401);
  }

  const currentUser = JSON.parse(stored) as User;
  const now = new Date().toISOString();
  const updatedUser: User = {
    ...currentUser,
    hasOnboarded: true,
    teamId: normalizedTeamId,
    taskspaceName,
    updatedAt: now,
  };

  const joinedTaskspace: TeamTaskspace = {
    teamId: normalizedTeamId,
    name: taskspaceName,
    membersCount: (matched?.membersCount || 1) + 1,
    createdAt: now,
  };

  // 1. Direct Client-side Firestore persistence
  try {
    await setDoc(doc(db, 'teams', normalizedTeamId), joinedTaskspace, { merge: true });
    if (currentUser.googleId) {
      await setDoc(
        doc(db, 'users', currentUser.googleId),
        {
          hasOnboarded: true,
          teamId: normalizedTeamId,
          taskspaceName,
          updatedAt: now,
        },
        { merge: true }
      );
    }
    console.log(`[Firestore Client] Joined team ${normalizedTeamId} and updated user`);
  } catch (fsErr) {
    console.warn('[Firestore Client] Team join persistence warning:', fsErr);
  }

  // 2. Backend API persistence
  if (API_BASE_URL) {
    try {
      await fetch(`${API_BASE_URL}/api/teams/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: normalizedTeamId,
          userEmail: currentUser.email,
          googleId: currentUser.googleId,
        }),
      });
      console.log(`[Backend API] Joined team via backend API`);
    } catch (apiErr) {
      console.warn('[Backend API] Team join API call warning:', apiErr);
    }
  }

  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));

  return {
    user: updatedUser,
    taskspace: joinedTaskspace,
    message: `Joined team taskspace ${normalizedTeamId}`,
  };
}

export async function getCurrentSession(): Promise<User | null> {
  const raw = localStorage.getItem(STORAGE_KEY_USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    localStorage.removeItem(STORAGE_KEY_USER);
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

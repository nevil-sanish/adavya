import { jwtDecode } from 'jwt-decode';
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

  const existingRaw = localStorage.getItem(STORAGE_KEY_USER);
  let existingUser: User | null = null;
  if (existingRaw) {
    try {
      const parsed = JSON.parse(existingRaw) as User;
      if (parsed.email === email || parsed.googleId === payload.sub) {
        existingUser = parsed;
      }
    } catch {
      // ignore
    }
  }

  const isNewUser = !existingUser;
  const user: User = existingUser
    ? {
        ...existingUser,
        name: payload.name || existingUser.name,
        avatarUrl: payload.picture || existingUser.avatarUrl,
        updatedAt: new Date().toISOString(),
      }
    : {
        id: `usr_${Math.random().toString(36).substring(2, 10)}`,
        email,
        name: payload.name || email.split('@')[0],
        avatarUrl: payload.picture,
        googleId: payload.sub || `g_${Date.now()}`,
        hasOnboarded: false,
        createdAt: new Date().toISOString(),
      };

  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  localStorage.setItem(STORAGE_KEY_TOKEN, idToken);

  return { user, isNewUser, token: idToken };
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
    avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(options?.name || 'Shubham')}&backgroundColor=18181b&textColor=f4f4f5`,
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
 * Generates a Team ID and links the user.
 */
export async function createTeamTaskspace(request: CreateTeamRequest): Promise<OnboardingResponse> {
  const rawName = request.teamName.trim();
  if (!rawName) {
    throw new AuthApiError('Team name is required.', 'VALIDATION_ERROR', 400);
  }

  const generatedTeamId = generateTeamId(rawName);

  await simulateDelay(500);

  const stored = localStorage.getItem(STORAGE_KEY_USER);
  if (!stored) {
    throw new AuthApiError('Session not found. Please log in again.', 'SESSION_NOT_FOUND', 401);
  }

  const currentUser = JSON.parse(stored) as User;
  const updatedUser: User = {
    ...currentUser,
    hasOnboarded: true,
    teamId: generatedTeamId,
    taskspaceName: rawName,
    workspaceName: rawName,
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));

  const newTaskspace: TeamTaskspace = {
    teamId: generatedTeamId,
    name: rawName,
    ownerEmail: currentUser.email,
    membersCount: 1,
    createdAt: new Date().toISOString(),
  };

  return {
    user: updatedUser,
    taskspace: newTaskspace,
    message: `Team Taskspace created with ID: ${generatedTeamId}`,
  };
}

/**
 * Option 2: Join an existing Team Taskspace
 * Validates Team ID and links the user.
 */
export async function joinTeamTaskspace(request: JoinTeamRequest): Promise<OnboardingResponse> {
  const validation = validateTeamIdFormat(request.teamId);
  if (!validation.isValid || !validation.normalizedValue) {
    throw new AuthApiError(validation.error || 'Invalid Team ID.', 'VALIDATION_ERROR', 400);
  }

  const normalizedTeamId = validation.normalizedValue;

  await simulateDelay(500);

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
  const updatedUser: User = {
    ...currentUser,
    hasOnboarded: true,
    teamId: normalizedTeamId,
    taskspaceName,
    workspaceName: taskspaceName,
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));

  return {
    user: updatedUser,
    taskspace: {
      teamId: normalizedTeamId,
      name: taskspaceName,
      membersCount: (matched?.membersCount || 1) + 1,
    },
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

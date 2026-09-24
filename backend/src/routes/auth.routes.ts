import { Router, Response } from 'express';
import { z } from 'zod';
import { verifyFirebaseIdToken, getDb } from '../config/firebase.js';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { User, AuthResponse } from '../types/index.js';

export const authRouter = Router();

const googleAuthSchema = z.object({
  idToken: z.string().min(1, 'idToken is required'),
});

// In-memory fallback user store
const usersStore = new Map<string, User>();

/**
 * POST /api/auth/google
 * Validates Google/Firebase ID token with Gmail restriction and persists to Firestore
 */
authRouter.post('/google', async (req, res): Promise<void> => {
  const parseResult = googleAuthSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: parseResult.error.errors[0]?.message || 'Invalid payload',
    });
    return;
  }

  const { idToken } = parseResult.data;

  try {
    const decoded = await verifyFirebaseIdToken(idToken);
    const email = decoded.email?.toLowerCase().trim();

    if (!email) {
      res.status(400).json({
        error: 'MISSING_EMAIL',
        message: 'Google account has no associated email.',
      });
      return;
    }

    const isGmail = email.endsWith('@gmail.com') || email.endsWith('@googlemail.com');
    if (!isGmail) {
      res.status(403).json({
        error: 'GMAIL_RESTRICTED',
        message: `Access restricted: Only @gmail.com accounts are permitted. (${email} is restricted).`,
      });
      return;
    }

    const now = new Date().toISOString();
    const userId = `usr_${decoded.uid.substring(0, 10)}`;

    // Create a new instance for the user with onboarding status false
    const user: User = {
      id: userId,
      email,
      name: decoded.name || email.split('@')[0],
      googleId: decoded.uid,
      hasOnboarded: false, // Always initialize to false upon login
      createdAt: now,
      updatedAt: now,
    };

    // Persist new user instance to Firestore database (without merge, resetting onboarding state)
    try {
      const db = getDb();
      await db.collection('users').doc(decoded.uid).set({
        ...user,
        lastLoginAt: now,
      });
      console.log(`[Firestore] New user instance created for ${email} with hasOnboarded=false in 'users/${decoded.uid}'`);
    } catch (dbWriteErr) {
      console.error('[Firestore] Failed to persist user to Firestore:', dbWriteErr);
      throw new Error(
        `Failed to save user to Firestore: ${dbWriteErr instanceof Error ? dbWriteErr.message : 'Unknown database error'}`
      );
    }

    usersStore.set(email, user);

    const response: AuthResponse = {
      user,
      isNewUser: true,
      token: idToken,
    };

    res.status(200).json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Google authentication failed.';
    res.status(401).json({
      error: 'AUTH_FAILED',
      message,
    });
  }
});

/**
 * GET /api/auth/me
 * Retrieves current session user
 */
authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return;
  }

  const user = usersStore.get(req.user.email) || {
    id: `usr_${req.user.uid.substring(0, 10)}`,
    email: req.user.email,
    name: req.user.name || req.user.email.split('@')[0],
    googleId: req.user.uid,
    hasOnboarded: false,
    createdAt: new Date().toISOString(),
  };

  res.status(200).json({ user });
});

/**
 * POST /api/auth/logout
 */
authRouter.post('/logout', (_req, res) => {
  res.status(200).json({ message: 'Session logged out successfully' });
});

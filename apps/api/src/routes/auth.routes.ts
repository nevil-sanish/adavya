import { Router } from 'express';
import { z } from 'zod';
import { adminEmails, allowedEmailDomain, isAllowedEmail, activeCompetitionId } from '../config/env.js';
import { getDb, verifyFirebaseIdToken } from '../config/firebase.js';
import { route } from '../lib/http.js';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { loadOrCreateProfile, updateDisplayName } from '../services/team.service.js';
import type { UserDoc } from '../game/types.js';

export const authRouter = Router();

const googleAuthSchema = z.object({
  idToken: z.string().min(1, 'idToken is required'),
});

/** The fields a client may see about its own profile. */
function publicProfile(user: UserDoc) {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    competitionId: user.competitionId,
    teamId: user.teamId,
    role: user.role,
    slot: user.slot,
  };
}

function session(user: UserDoc, email: string) {
  return {
    user: publicProfile(user),
    isAdmin: adminEmails().has(email),
    activeCompetitionId: activeCompetitionId(),
  };
}

/**
 * POST /api/auth/google
 * Verifies the Firebase ID token, enforces the institutional domain, and loads or
 * creates the persistent profile. An existing profile (team, role, slot) is never reset.
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

  try {
    const decoded = await verifyFirebaseIdToken(parseResult.data.idToken);
    const email = decoded.email?.toLowerCase().trim();

    if (!email) {
      res.status(400).json({
        error: 'MISSING_EMAIL',
        message: 'Google account has no associated email.',
      });
      return;
    }

    if (!decoded.email_verified || !isAllowedEmail(email)) {
      res.status(403).json({
        error: 'INSTITUTION_EMAIL_REQUIRED',
        message: `Please sign in with your verified @${allowedEmailDomain()} Google account.`,
      });
      return;
    }

    const user = await loadOrCreateProfile(getDb(), decoded.uid, email, decoded.name);
    res.status(200).json(session(user, email));
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
 * Restores the session after refresh or re-login: identity, team, role and slot.
 */
authRouter.get(
  '/me',
  requireAuth,
  route(async (req: AuthenticatedRequest, res) => {
    const user = await loadOrCreateProfile(getDb(), req.user!.uid, req.user!.email, req.user!.name);
    res.status(200).json(session(user, req.user!.email));
  })
);

/**
 * PATCH /api/auth/me
 * Changes the display name until the team is locked.
 */
authRouter.patch(
  '/me',
  requireAuth,
  route(async (req: AuthenticatedRequest, res) => {
    res.status(200).json(await updateDisplayName(getDb(), req.user!.uid, req.body?.displayName));
  })
);

/**
 * POST /api/auth/logout
 */
authRouter.post('/logout', (_req, res) => {
  res.status(200).json({ message: 'Session logged out successfully' });
});

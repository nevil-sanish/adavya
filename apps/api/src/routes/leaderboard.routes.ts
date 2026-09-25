import { Router } from 'express';
import { getDb } from '../config/firebase.js';
import { route } from '../lib/http.js';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { getLeaderboardsFor } from '../services/leaderboard.service.js';

export const leaderboardRouter = Router();

/**
 * GET /api/leaderboard
 * Final points and finish-order leaderboards. Opens for a team once it has
 * completed all six tasks (403 LEADERBOARD_LOCKED before that); admins always.
 */
leaderboardRouter.get(
  '/',
  requireAuth,
  route(async (req: AuthenticatedRequest, res) => {
    res.status(200).json(await getLeaderboardsFor(getDb(), req.user!.uid, req.user!.email));
  })
);

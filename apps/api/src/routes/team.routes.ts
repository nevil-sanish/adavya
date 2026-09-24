import { Router } from 'express';
import { getDb } from '../config/firebase.js';
import { startFirstTask } from '../game/engine.js';
import { route } from '../lib/http.js';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { createTeam, joinTeam } from '../services/team.service.js';

export const teamRouter = Router();
teamRouter.use(requireAuth);

/**
 * POST /api/teams/create  { teamName }
 * The caller becomes the permanent captain and receives a four-digit code.
 */
teamRouter.post(
  '/create',
  route(async (req: AuthenticatedRequest, res) => {
    res.status(201).json(await createTeam(getDb(), req.user!.uid, req.body?.teamName));
  })
);

/**
 * POST /api/teams/join  { code }
 * Joins a lobby team as the next free player slot.
 */
teamRouter.post(
  '/join',
  route(async (req: AuthenticatedRequest, res) => {
    res.status(200).json(await joinTeam(getDb(), req.user!.uid, req.body?.code));
  })
);

/**
 * POST /api/teams/start
 * Captain only: locks the four-member team and starts task01.
 */
teamRouter.post(
  '/start',
  route(async (req: AuthenticatedRequest, res) => {
    res.status(200).json(await startFirstTask(getDb(), req.user!.uid));
  })
);

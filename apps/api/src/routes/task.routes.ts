import { Router } from 'express';
import { getDb } from '../config/firebase.js';
import { submitAction } from '../game/engine.js';
import { route } from '../lib/http.js';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth.middleware.js';

export const taskRouter = Router();
taskRouter.use(requireAuth);

/**
 * POST /api/tasks/:taskId/:action  { runId, clientEventId, clientSeq, payload }
 * Every task input goes through the engine, which derives the team and role
 * from the caller's identity and validates the event against the active run.
 */
taskRouter.post(
  '/:taskId/:action',
  route(async (req: AuthenticatedRequest, res) => {
    res.status(200).json(await submitAction(getDb(), req.user!.uid, req.params.taskId, req.params.action, req.body));
  })
);

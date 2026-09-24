import { Router } from 'express';
import { activeCompetitionId } from '../config/env.js';
import { getDb } from '../config/firebase.js';
import { route } from '../lib/http.js';
import { requireAdmin, requireAuth } from '../middlewares/auth.middleware.js';
import { deleteAssignment, getOverview, setAssignment, setLocations, setTaskConfig, updateCompetition } from '../services/admin.service.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

/** GET /api/admin/overview — configuration, teams, scores and per-task ranking. */
adminRouter.get(
  '/overview',
  route(async (_req, res) => {
    res.status(200).json(await getOverview(getDb(), activeCompetitionId()));
  })
);

/** PUT /api/admin/competition  { name?, status?, scoringPolicy? } */
adminRouter.put(
  '/competition',
  route(async (req, res) => {
    await updateCompetition(getDb(), activeCompetitionId(), req.body);
    res.status(200).json({ ok: true });
  })
);

/** PUT /api/admin/locations  { locations: [10 locations] } */
adminRouter.put(
  '/locations',
  route(async (req, res) => {
    await setLocations(getDb(), activeCompetitionId(), req.body);
    res.status(200).json({ ok: true });
  })
);

/** PUT /api/admin/assignments/:key  { locationIds[5], correctLocationIds[3], word } — key is a team id or `_default` */
adminRouter.put(
  '/assignments/:key',
  route(async (req, res) => {
    res.status(200).json({ assignment: await setAssignment(getDb(), activeCompetitionId(), req.params.key, req.body) });
  })
);

/** DELETE /api/admin/assignments/:key — the team falls back to `_default` */
adminRouter.delete(
  '/assignments/:key',
  route(async (req, res) => {
    await deleteAssignment(getDb(), activeCompetitionId(), req.params.key);
    res.status(200).json({ ok: true });
  })
);

/** PUT /api/admin/tasks/:taskId/config  { config } */
adminRouter.put(
  '/tasks/:taskId/config',
  route(async (req, res) => {
    res.status(200).json({ config: await setTaskConfig(getDb(), activeCompetitionId(), req.params.taskId, req.body) });
  })
);

import { Router } from 'express';
import { z } from 'zod';
import { TeamTaskspace } from '../types/index.js';
import { getDb } from '../config/firebase.js';

export const teamRouter = Router();

const createTeamSchema = z.object({
  teamName: z.string().trim().min(1, 'Team name is required'),
  userEmail: z.string().optional(),
  googleId: z.string().optional(),
});

const joinTeamSchema = z.object({
  teamId: z.string().trim().min(3, 'Valid Team ID is required'),
  userEmail: z.string().optional(),
  googleId: z.string().optional(),
});

// Pre-seeded teams for instant verification
const teamsStore = new Map<string, TeamTaskspace>([
  ['TEAM-ALPHA', { teamId: 'TEAM-ALPHA', name: 'Alpha Core Taskspace', membersCount: 4, createdAt: new Date().toISOString() }],
  ['TEAM-BETA', { teamId: 'TEAM-BETA', name: 'Agent Pipeline Taskspace', membersCount: 3, createdAt: new Date().toISOString() }],
  ['TEAM-GAMMA', { teamId: 'TEAM-GAMMA', name: 'Verification Lab', membersCount: 5, createdAt: new Date().toISOString() }],
]);

function generateTeamId(name: string): string {
  const sanitized = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 5) || 'TEAM';
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `${sanitized}-${randomSuffix}`;
}

/**
 * POST /api/teams/create
 */
teamRouter.post('/create', async (req, res): Promise<void> => {
  const result = createTeamSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: result.error.errors[0]?.message || 'Invalid team name',
    });
    return;
  }

  const { teamName, userEmail, googleId } = result.data;
  const teamId = generateTeamId(teamName);

  const newTeam: TeamTaskspace = {
    teamId,
    name: teamName,
    ownerEmail: userEmail,
    membersCount: 1,
    createdAt: new Date().toISOString(),
  };

  teamsStore.set(teamId, newTeam);

  try {
    const db = getDb();
    await db.collection('teams').doc(teamId).set(newTeam, { merge: true });
    console.log(`[Firestore] Team ${teamId} saved to Firestore collection ('teams/${teamId}')`);

    if (googleId) {
      await db.collection('users').doc(googleId).set(
        {
          hasOnboarded: true,
          teamId,
          taskspaceName: teamName,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      console.log(`[Firestore] User ${googleId} updated with team ${teamId} in Firestore ('users/${googleId}')`);
    }
  } catch (fsErr) {
    console.error('[Firestore] Failed to persist team to Firestore:', fsErr);
  }

  res.status(201).json({
    message: `Team Taskspace created with ID: ${teamId}`,
    taskspace: newTeam,
  });
});

/**
 * POST /api/teams/join
 */
teamRouter.post('/join', async (req, res): Promise<void> => {
  const result = joinTeamSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: result.error.errors[0]?.message || 'Invalid team ID',
    });
    return;
  }

  const { teamId: rawTeamId, googleId } = result.data;
  const normalizedTeamId = rawTeamId.toUpperCase().trim();
  const existing = teamsStore.get(normalizedTeamId);

  const team: TeamTaskspace = existing
    ? { ...existing, membersCount: existing.membersCount + 1 }
    : {
        teamId: normalizedTeamId,
        name: `Taskspace (${normalizedTeamId})`,
        membersCount: 2,
        createdAt: new Date().toISOString(),
      };

  teamsStore.set(normalizedTeamId, team);

  try {
    const db = getDb();
    await db.collection('teams').doc(normalizedTeamId).set(team, { merge: true });
    console.log(`[Firestore] Team ${normalizedTeamId} saved to Firestore collection ('teams/${normalizedTeamId}')`);

    if (googleId) {
      await db.collection('users').doc(googleId).set(
        {
          hasOnboarded: true,
          teamId: normalizedTeamId,
          taskspaceName: team.name,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      console.log(`[Firestore] User ${googleId} joined team ${normalizedTeamId} and updated in Firestore`);
    }
  } catch (fsErr) {
    console.error('[Firestore] Failed to update join in Firestore:', fsErr);
  }

  res.status(200).json({
    message: `Joined team taskspace ${normalizedTeamId}`,
    taskspace: team,
  });
});

/**
 * GET /api/teams/:teamId
 */
teamRouter.get('/:teamId', async (req, res): Promise<void> => {
  const teamId = req.params.teamId.toUpperCase().trim();
  let team = teamsStore.get(teamId);

  if (!team) {
    try {
      const db = getDb();
      const docSnap = await db.collection('teams').doc(teamId).get();
      if (docSnap.exists) {
        team = docSnap.data() as TeamTaskspace;
        teamsStore.set(teamId, team);
      }
    } catch (fsErr) {
      console.warn('[Firestore] Error fetching team:', fsErr);
    }
  }

  if (!team) {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: `Team taskspace with ID ${teamId} not found`,
    });
    return;
  }

  res.status(200).json({ taskspace: team });
});

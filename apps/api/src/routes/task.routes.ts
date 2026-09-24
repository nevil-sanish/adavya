import { Router } from 'express';
import { z } from 'zod';
import {
  TaskItem,
  TaskType,
  OrientationTaskData,
  SpecReviewTaskData,
  CodeReviewTaskData,
  DeploymentTaskData,
  RoundInstance,
  RoundPlayer,
} from '../types/index.js';
import { getDb } from '../config/firebase.js';

export const taskRouter = Router();

// In-memory Task Repository supporting multiple diverse task types
const tasksStore = new Map<string, TaskItem<any>>([
  [
    'task-orientation-1',
    {
      id: 'task-orientation-1',
      title: 'Agent Orientation Generator',
      description: 'Assigns each agent a clockwise or anticlockwise orientation at random.',
      type: 'orientation',
      status: 'pending',
      pipelineStage: 2, // Agent Pipeline
      data: {
        players: [
          { id: 'player-1', name: 'Player 1', orientation: null },
          { id: 'player-2', name: 'Player 2', orientation: null },
          { id: 'player-3', name: 'Player 3', orientation: null },
        ],
        hasGenerated: false,
        generationCount: 0,
      } as OrientationTaskData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  [
    'task-spec-1',
    {
      id: 'task-spec-1',
      title: 'Sprint Architecture Specification',
      description: 'Define and review system contracts, API schemas, and validation boundaries.',
      type: 'spec_review',
      status: 'completed',
      pipelineStage: 1, // Sprint Spec
      data: {
        specTitle: 'Adavya Multi-Agent Platform Spec',
        version: 'v2.4.1',
        checklist: [
          { id: 'chk-1', label: 'Define WebSocket session protocol', completed: true },
          { id: 'chk-2', label: 'Audit Gmail-restricted OAuth authentication', completed: true },
          { id: 'chk-3', label: 'Configure pipeline state machine guards', completed: true },
        ],
      } as SpecReviewTaskData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  [
    'task-qa-1',
    {
      id: 'task-qa-1',
      title: 'Automated Code Review & QA Verification',
      description: 'Full automated test suite, security vulnerability scan, and lint verification.',
      type: 'code_review',
      status: 'in_progress',
      pipelineStage: 3, // Code Review
      data: {
        coveragePercent: 94.8,
        testsTotal: 52,
        testsPassed: 52,
        securityVulnerabilities: 0,
        approved: false,
      } as CodeReviewTaskData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  [
    'task-deploy-1',
    {
      id: 'task-deploy-1',
      title: 'Production Canary Deployment',
      description: 'Rolling deployment to global edge cluster with automated health checks.',
      type: 'deployment',
      status: 'pending',
      pipelineStage: 4, // Deployment
      data: {
        targetEnvironment: 'production-primary',
        releaseVersion: 'v1.1.0',
        deployStatus: 'ready',
      } as DeploymentTaskData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
]);

// Host timer state (controlled by website owner)
interface HostTimerState {
  seconds: number;
  isRunning: boolean;
  lastUpdated: string;
}

const timerState: HostTimerState = {
  seconds: 0,
  isRunning: false,
  lastUpdated: new Date().toISOString(),
};

/**
 * GET /api/tasks
 * Returns all tasks, optionally filtered by ?stage=X or ?type=Y
 */
taskRouter.get('/', (req, res) => {
  const stageQuery = req.query.stage ? parseInt(req.query.stage as string, 10) : undefined;
  const typeQuery = req.query.type as TaskType | undefined;

  let allTasks = Array.from(tasksStore.values());

  if (stageQuery !== undefined && !isNaN(stageQuery)) {
    allTasks = allTasks.filter((t) => t.pipelineStage === stageQuery);
  }

  if (typeQuery) {
    allTasks = allTasks.filter((t) => t.type === typeQuery);
  }

  res.status(200).json({
    total: allTasks.length,
    tasks: allTasks,
  });
});

/**
 * GET /api/tasks/:taskId
 * Returns a specific task by ID
 */
taskRouter.get('/:taskId', (req, res): void => {
  const { taskId } = req.params;
  const task = tasksStore.get(taskId);

  if (!task) {
    res.status(404).json({
      error: 'TASK_NOT_FOUND',
      message: `Task with ID ${taskId} not found`,
    });
    return;
  }

  res.status(200).json(task);
});

const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().trim().default(''),
  type: z.enum(['orientation', 'spec_review', 'agent_pipeline', 'code_review', 'deployment', 'custom']),
  pipelineStage: z.number().int().min(1).max(4).default(2),
  assignedTo: z.string().optional(),
  data: z.record(z.any()).default({}),
});

/**
 * POST /api/tasks
 * Creates a new task of any supported type
 */
taskRouter.post('/', (req, res): void => {
  const parseResult = createTaskSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: parseResult.error.errors[0]?.message || 'Invalid task payload',
    });
    return;
  }

  const { title, description, type, pipelineStage, assignedTo, data } = parseResult.data;
  const taskId = `task-${type}-${Date.now().toString(36)}`;

  const newTask: TaskItem<any> = {
    id: taskId,
    title,
    description,
    type: type as TaskType,
    status: 'pending',
    pipelineStage,
    assignedTo,
    data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  tasksStore.set(taskId, newTask);

  res.status(201).json({
    message: 'Task created successfully',
    task: newTask,
  });
});

/**
 * PUT /api/tasks/:taskId
 * Updates task status, metadata, or data payload
 */
taskRouter.put('/:taskId', (req, res): void => {
  const { taskId } = req.params;
  const existing = tasksStore.get(taskId);

  if (!existing) {
    res.status(404).json({
      error: 'TASK_NOT_FOUND',
      message: `Task with ID ${taskId} not found`,
    });
    return;
  }

  const updated: TaskItem<any> = {
    ...existing,
    ...req.body,
    id: existing.id, // ID cannot be altered
    updatedAt: new Date().toISOString(),
  };

  tasksStore.set(taskId, updated);

  res.status(200).json({
    message: 'Task updated successfully',
    task: updated,
  });
});

/**
 * POST /api/tasks/:taskId/execute
 * Executes a task-specific polymorphic action
 */
taskRouter.post('/:taskId/execute', (req, res): void => {
  const { taskId } = req.params;
  const { action, payload } = req.body;
  const task = tasksStore.get(taskId);

  if (!task) {
    res.status(404).json({
      error: 'TASK_NOT_FOUND',
      message: `Task with ID ${taskId} not found`,
    });
    return;
  }

  // Handle task-specific execution logic
  if (task.type === 'orientation') {
    const currentData = task.data as OrientationTaskData;
    const newPlayers = currentData.players.map((p) => ({
      ...p,
      orientation: (Math.random() < 0.5 ? 'clockwise' : 'anticlockwise') as 'clockwise' | 'anticlockwise',
    }));

    task.data = {
      players: newPlayers,
      hasGenerated: true,
      generatedAt: new Date().toISOString(),
      generationCount: currentData.generationCount + 1,
    };
    task.status = 'completed';
    task.updatedAt = new Date().toISOString();

    res.status(200).json({
      message: 'Orientation task executed successfully',
      task,
    });
    return;
  }

  if (task.type === 'spec_review' && action === 'toggle_checklist') {
    const currentData = task.data as SpecReviewTaskData;
    const { itemId } = payload || {};
    currentData.checklist = currentData.checklist.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    const allDone = currentData.checklist.every((c) => c.completed);
    task.status = allDone ? 'completed' : 'in_progress';
    task.updatedAt = new Date().toISOString();

    res.status(200).json({ message: 'Checklist updated', task });
    return;
  }

  if (task.type === 'code_review' && action === 'approve') {
    const currentData = task.data as CodeReviewTaskData;
    currentData.approved = true;
    task.status = 'completed';
    task.updatedAt = new Date().toISOString();

    res.status(200).json({ message: 'Code review approved', task });
    return;
  }

  if (task.type === 'deployment' && action === 'deploy') {
    const currentData = task.data as DeploymentTaskData;
    currentData.deployStatus = 'live';
    currentData.deployedAt = new Date().toISOString();
    task.status = 'completed';
    task.updatedAt = new Date().toISOString();

    res.status(200).json({ message: 'Deployment triggered', task });
    return;
  }

  // Generic action execution
  task.status = 'completed';
  task.updatedAt = new Date().toISOString();

  res.status(200).json({
    message: `Action '${action || 'execute'}' executed on task ${taskId}`,
    task,
  });
});

/**
 * DELETE /api/tasks/:taskId
 */
taskRouter.delete('/:taskId', (req, res): void => {
  const { taskId } = req.params;
  const existed = tasksStore.delete(taskId);

  if (!existed) {
    res.status(404).json({
      error: 'TASK_NOT_FOUND',
      message: `Task with ID ${taskId} not found`,
    });
    return;
  }

  res.status(200).json({
    message: `Task ${taskId} deleted successfully`,
  });
});

// ---------------------------------------------------------------------
// Backward Compatibility Endpoints for Client & Testing
// ---------------------------------------------------------------------

/**
 * GET /api/tasks/orientation
 */
taskRouter.get('/orientation', (_req, res) => {
  const orientationTask = tasksStore.get('task-orientation-1');
  if (orientationTask) {
    res.status(200).json(orientationTask.data);
  } else {
    res.status(200).json({
      players: [
        { id: 'player-1', name: 'Player 1', orientation: null },
        { id: 'player-2', name: 'Player 2', orientation: null },
        { id: 'player-3', name: 'Player 3', orientation: null },
      ],
      generationCount: 0,
    });
  }
});

/**
 * POST /api/tasks/orientation/generate
 */
taskRouter.post('/orientation/generate', (_req, res) => {
  const orientationTask = tasksStore.get('task-orientation-1');
  if (orientationTask) {
    const currentData = orientationTask.data as OrientationTaskData;
    const newPlayers = currentData.players.map((p) => ({
      ...p,
      orientation: (Math.random() < 0.5 ? 'clockwise' : 'anticlockwise') as 'clockwise' | 'anticlockwise',
    }));

    orientationTask.data = {
      players: newPlayers,
      hasGenerated: true,
      generatedAt: new Date().toISOString(),
      generationCount: currentData.generationCount + 1,
    };
    orientationTask.status = 'completed';
    orientationTask.updatedAt = new Date().toISOString();

    res.status(200).json({
      message: 'Orientation generated successfully',
      ...orientationTask.data,
    });
    return;
  }

  res.status(200).json({
    message: 'Orientation generated',
    players: [
      { id: 'player-1', name: 'Player 1', orientation: 'clockwise' },
      { id: 'player-2', name: 'Player 2', orientation: 'anticlockwise' },
      { id: 'player-3', name: 'Player 3', orientation: 'clockwise' },
    ],
  });
});

/**
 * GET /api/tasks/timer
 */
taskRouter.get('/timer', (_req, res) => {
  res.status(200).json(timerState);
});

/**
 * POST /api/tasks/timer
 */
taskRouter.post('/timer', (req, res): void => {
  const { action, seconds } = req.body;

  if (action === 'start') {
    timerState.isRunning = true;
    timerState.lastUpdated = new Date().toISOString();
  } else if (action === 'pause') {
    timerState.isRunning = false;
    timerState.lastUpdated = new Date().toISOString();
  } else if (action === 'reset') {
    timerState.isRunning = false;
    timerState.seconds = typeof seconds === 'number' ? seconds : 0;
    timerState.lastUpdated = new Date().toISOString();
  } else if (typeof seconds === 'number') {
    timerState.seconds = seconds;
    timerState.lastUpdated = new Date().toISOString();
  }

  res.status(200).json({
    message: `Timer updated (${action || 'sync'})`,
    timer: timerState,
  });
});

const recordRoundSchema = z.object({
  roundId: z.string().optional(),
  teamId: z.string().min(1, 'Team ID is required'),
  roundNumber: z.number().int().min(1).optional(),
  player1: z.union([z.literal(0), z.literal(1)]),
  player2: z.union([z.literal(0), z.literal(1)]),
  player3: z.union([z.literal(0), z.literal(1)]),
  timerSeconds: z.number().optional().default(0),
});

/**
 * POST /api/tasks/round
 * Creates a new round instance in the Firestore collection 'rounds'
 * Clockwise: 1, Anticlockwise: 0
 */
taskRouter.post('/round', async (req, res): Promise<void> => {
  const result = recordRoundSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: result.error.errors[0]?.message || 'Invalid round payload',
    });
    return;
  }

  const { roundId: customRoundId, teamId, player1, player2, player3 } = result.data;
  const now = new Date().toISOString();
  const db = getDb();

  // Calculate roundNumber if not provided by counting existing rounds for team
  let roundNumber = result.data.roundNumber;
  if (!roundNumber) {
    try {
      const snap = await db.collection('rounds').where('teamId', '==', teamId).get();
      roundNumber = snap.size + 1;
    } catch {
      roundNumber = 1;
    }
  }

  const roundDocId = customRoundId || `${teamId}_round_${roundNumber}_${Date.now()}`;

  const players: RoundPlayer[] = [
    {
      id: 'player-1',
      name: 'Player 1',
      orientation: player1,
      orientationLabel: player1 === 1 ? 'clockwise' : 'anticlockwise',
    },
    {
      id: 'player-2',
      name: 'Player 2',
      orientation: player2,
      orientationLabel: player2 === 1 ? 'clockwise' : 'anticlockwise',
    },
    {
      id: 'player-3',
      name: 'Player 3',
      orientation: player3,
      orientationLabel: player3 === 1 ? 'clockwise' : 'anticlockwise',
    },
  ];

  const roundInstance: RoundInstance = {
    roundId: roundDocId,
    roundNumber,
    teamId,
    orientation: {
      player1,
      player2,
      player3,
    },
    orientations: null,
    player1: null,
    player2: null,
    player3: null,
    players,
    timerStarted: true,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await db.collection('rounds').doc(roundDocId).set(roundInstance, { merge: true });
    console.log(`[Firestore] New round instance created for team ${teamId} (Round ${roundNumber}) in 'rounds/${roundDocId}'`);
  } catch (err) {
    console.error('[Firestore] Error saving round instance:', err);
    res.status(500).json({ error: 'DB_ERROR', message: 'Failed to persist round to Firestore' });
    return;
  }

  res.status(201).json({
    message: `Round ${roundNumber} created successfully`,
    round: roundInstance,
  });
});

/**
 * PATCH /api/tasks/round/:roundId/orientations
 * Update player1, player2, player3, or orientations for real-time verification (0 | 1)
 */
taskRouter.patch('/round/:roundId/orientations', async (req, res): Promise<void> => {
  const { roundId } = req.params;
  const { orientations, player1, player2, player3 } = req.body;
  try {
    const db = getDb();
    const updatePayload: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };
    if (orientations !== undefined) updatePayload.orientations = orientations;
    if (player1 !== undefined) updatePayload.player1 = player1;
    if (player2 !== undefined) updatePayload.player2 = player2;
    if (player3 !== undefined) updatePayload.player3 = player3;

    await db.collection('rounds').doc(roundId).set(updatePayload, { merge: true });
    res.status(200).json({ message: 'Round updated successfully', roundId, updatePayload });
  } catch (err) {
    res.status(500).json({ error: 'DB_ERROR', message: 'Failed to update orientations' });
  }
});

/**
 * GET /api/tasks/rounds/:teamId
 */
taskRouter.get('/rounds/:teamId', async (req, res): Promise<void> => {
  const { teamId } = req.params;
  try {
    const db = getDb();
    const snap = await db.collection('rounds').where('teamId', '==', teamId).get();
    const rounds = snap.docs.map((doc) => doc.data() as RoundInstance);
    res.status(200).json({ rounds, total: rounds.length });
  } catch (err) {
    res.status(500).json({ error: 'DB_ERROR', message: 'Failed to fetch rounds from Firestore' });
  }
});

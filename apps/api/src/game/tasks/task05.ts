import { z } from 'zod';
import { randomInt } from '../../lib/random.js';
import { scoreAttempt } from '../timer.js';
import type { ActionContext, ActionPlan, TaskModule } from './types.js';

interface Task05Config {
  minTargetMs: number;
  maxTargetMs: number;
  maxAttempts: number;
  maxPoints: number;
  pointsLostPerSecond: number;
  retryPenalty: number;
}

interface Attempt {
  attemptId: string;
  durationMs: number;
  errorMs: number;
  score: number;
}

interface Executor {
  uid: string;
  name: string;
  slot: string;
  targetMs: number;
  attempts: Attempt[];
  finalized: boolean;
  finalScore: number | null;
}

/**
 * Response-time relay. The captain sees each player's target duration and tells
 * them; players time it on a blind stopwatch (performance.now on the device).
 * Each attempt after the first costs a retry penalty; a player locks in their
 * latest attempt, or is locked automatically after the last allowed attempt.
 */
export const task05: TaskModule<Task05Config> = {
  taskId: 'task05',
  taskType: 'RESPONSE_TIME',
  title: 'Response-Time Relay',
  description: 'Stop a blind stopwatch as close to your target time as you can.',
  defaultConfig: { minTargetMs: 3000, maxTargetMs: 15000, maxAttempts: 3, maxPoints: 100, pointsLostPerSecond: 20, retryPenalty: 10 },
  configSchema: z
    .object({
      minTargetMs: z.number().int().min(500).max(120_000),
      maxTargetMs: z.number().int().min(500).max(120_000),
      maxAttempts: z.number().int().min(1).max(10),
      maxPoints: z.number().min(1).max(10_000),
      pointsLostPerSecond: z.number().min(0).max(10_000),
      retryPenalty: z.number().min(0).max(10_000),
    })
    .refine((c) => c.maxTargetMs - c.minTargetMs >= 300, 'Target range is too narrow'),

  init(ctx, config) {
    // Distinct targets rounded to 100 ms.
    const targets = new Set<number>();
    while (targets.size < ctx.players.length) {
      targets.add(Math.round(randomInt(config.minTargetMs, config.maxTargetMs) / 100) * 100);
    }
    const values = [...targets];
    const executors: Executor[] = ctx.players.map((p, i) => ({
      uid: p.uid,
      name: p.displayName,
      slot: p.slot,
      targetMs: values[i],
      attempts: [],
      finalized: false,
      finalScore: null,
    }));
    return {
      privateState: {},
      captainView: { taskType: 'RESPONSE_TIME', executors, finalizedCount: 0, totalScore: 0, maxAttempts: config.maxAttempts, log: [] },
      playerViews: Object.fromEntries(
        ctx.players.map((p) => [p.uid, { attemptsUsed: 0, maxAttempts: config.maxAttempts, finalized: false }])
      ),
    };
  },

  actions: {
    attempt: {
      roles: ['PLAYER'],
      input: z.object({ durationMs: z.number().min(50).max(600_000) }),
      prepare(ctx, input: { durationMs: number }) {
        const executors = ctx.captainView.executors as Executor[];
        const me = executors.find((e) => e.uid === ctx.caller.uid);
        if (!me || me.finalized || me.attempts.length >= ctx.config.maxAttempts) {
          return { response: { accepted: false, reason: 'FINALIZED' }, mutating: false };
        }

        const durationMs = Math.round(input.durationMs);
        const attempt: Attempt = {
          attemptId: `${me.attempts.length + 1}`,
          durationMs,
          errorMs: Math.abs(durationMs - me.targetMs),
          score: scoreAttempt(me.targetMs, durationMs, me.attempts.length, ctx.config),
        };
        const attempts = [...me.attempts, attempt];
        const autoLock = attempts.length >= ctx.config.maxAttempts;
        return finalizePlan(ctx, executors, { ...me, attempts }, autoLock, {
          accepted: true,
          attemptNumber: attempts.length,
          attemptsRemaining: ctx.config.maxAttempts - attempts.length,
          finalized: autoLock,
        }, `${me.name} attempt ${attempts.length}: ${(durationMs / 1000).toFixed(2)} s.`);
      },
    },

    lock: {
      roles: ['PLAYER'],
      input: z.object({}),
      prepare(ctx) {
        const executors = ctx.captainView.executors as Executor[];
        const me = executors.find((e) => e.uid === ctx.caller.uid);
        if (!me || me.finalized || me.attempts.length === 0) {
          return { response: { accepted: false, reason: me?.finalized ? 'FINALIZED' : 'NO_ATTEMPT' }, mutating: false };
        }
        return finalizePlan(ctx, executors, me, true, { accepted: true, finalized: true }, `${me.name} locked in.`);
      },
    },
  },
};

function finalizePlan(
  ctx: ActionContext<Task05Config>,
  executors: Executor[],
  me: Executor,
  lock: boolean,
  response: Record<string, unknown>,
  message: string
): ActionPlan {
  const latest = me.attempts[me.attempts.length - 1];
  const updatedMe: Executor = lock ? { ...me, finalized: true, finalScore: latest.score } : me;
  const updated = executors.map((e) => (e.uid === me.uid ? updatedMe : e));
  const finalizedCount = updated.filter((e) => e.finalized).length;
  const totalScore = Math.round(updated.reduce((sum, e) => sum + (e.finalScore ?? 0), 0) * 10) / 10;
  return {
    response,
    mutating: true,
    captainPatch: { executors: updated, finalizedCount, totalScore },
    playerViewPatches: {
      [me.uid]: { attemptsUsed: me.attempts.length, maxAttempts: ctx.config.maxAttempts, finalized: updatedMe.finalized },
    },
    log: [{ kind: lock ? 'ACCEPTED' : 'INFO', message: lock ? `${message} Final score ${latest.score}.` : message }],
    complete: finalizedCount === updated.length,
  };
}

import { z } from 'zod';
import { randomInt, shuffled } from '../../lib/random.js';
import type { TaskModule } from './types.js';

interface Task01Config {
  sequenceLength: number;
}

const DIRECTION_BIT = { LEFT: 0, RIGHT: 1 } as const;

/**
 * Left/right orientation. The server holds a hidden binary sequence and the
 * player assigned to each step. Players tilt and lock a direction; the captain
 * sees which player is up and the accepted bits, and coordinates by trial and error.
 * Players never learn whether their event was accepted.
 */
export const task01: TaskModule<Task01Config> = {
  taskId: 'task01',
  taskType: 'ORIENTATION',
  title: 'Left / Right Orientation',
  description: 'Tilt phones left (0) or right (1) to rebuild the hidden binary sequence.',
  defaultConfig: { sequenceLength: 6 },
  configSchema: z.object({ sequenceLength: z.number().int().min(3).max(12) }),

  init(ctx, config) {
    const sequence = Array.from({ length: config.sequenceLength }, () => randomInt(0, 1));
    // Rotate through a shuffled player order so every player gets steps.
    const order = shuffled(ctx.players);
    const stepPlayers = sequence.map((_, i) => order[i % order.length].uid);
    const first = ctx.players.find((p) => p.uid === stepPlayers[0])!;
    return {
      privateState: { sequence, stepPlayers },
      captainView: {
        taskType: 'ORIENTATION',
        length: sequence.length,
        currentStep: 0,
        revealed: [],
        currentPlayerUid: first.uid,
        currentPlayerName: first.displayName,
        log: [],
      },
    };
  },

  actions: {
    orient: {
      roles: ['PLAYER'],
      input: z.object({ direction: z.enum(['LEFT', 'RIGHT']) }),
      prepare(ctx, input: { direction: 'LEFT' | 'RIGHT' }) {
        const sequence = ctx.privateState.sequence as number[];
        const stepPlayers = ctx.privateState.stepPlayers as string[];
        const step = ctx.captainView.currentStep as number;
        const bit = DIRECTION_BIT[input.direction];
        // The player only learns that the event arrived, never the verdict.
        const response = { received: true };

        if (ctx.caller.uid !== stepPlayers[step]) {
          return {
            response,
            mutating: true,
            log: [{ kind: 'REJECTED', message: `${ctx.caller.displayName} tilted ${input.direction.toLowerCase()} — not their turn.` }],
          };
        }
        if (sequence[step] !== bit) {
          return {
            response,
            mutating: true,
            log: [{ kind: 'REJECTED', message: `${ctx.caller.displayName} tilted ${input.direction.toLowerCase()} — wrong direction.` }],
          };
        }

        const nextStep = step + 1;
        const done = nextStep >= sequence.length;
        const nextPlayer = done ? null : ctx.players.find((p) => p.uid === stepPlayers[nextStep])!;
        return {
          response,
          mutating: true,
          captainPatch: {
            currentStep: nextStep,
            revealed: [...(ctx.captainView.revealed as number[]), bit],
            currentPlayerUid: nextPlayer?.uid ?? null,
            currentPlayerName: nextPlayer?.displayName ?? null,
          },
          log: [{ kind: 'ACCEPTED', message: `Step ${nextStep}: ${ctx.caller.displayName} tilted ${input.direction.toLowerCase()} (${bit}).` }],
          complete: done,
        };
      },
    },
  },
};

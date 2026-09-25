import { z } from 'zod';
import { shuffled } from '../../lib/random.js';
import { generateSoundTargets } from '../sound.js';
import type { TaskModule } from './types.js';

interface Task04Config {
  minDb: number;
  maxDb: number;
  minSeparationDb: number;
  toleranceDb: number;
  /** 0: a target counts the moment it is reached. Above 0: the level must be held this long. */
  holdMs: number;
  /** Hits whose hold ended longer ago than this (device-relative) are late and ignored. */
  maxEventAgeMs: number;
  /** When true the captain log also shows rejected hits, which can reveal the mapping. */
  revealIncorrect: boolean;
}

interface OrderEntry {
  uid: string;
  targetDb: number;
}

/**
 * Sound relay. Three separated targets are mapped to players in a hidden
 * required order. The captain sees the ordered values only. Phones report the
 * levels they reach (held for `holdMs`, 0 by default); the server accepts a hit
 * only from the player whose target is next, within tolerance.
 */
export const task04: TaskModule<Task04Config> = {
  taskId: 'task04',
  taskType: 'SOUND_RELAY',
  title: 'Sound Relay',
  description: 'Hold your voice at the right loudness, in the right order.',
  defaultConfig: {
    minDb: 50,
    maxDb: 85,
    minSeparationDb: 8,
    toleranceDb: 3,
    holdMs: 0,
    maxEventAgeMs: 4000,
    revealIncorrect: false,
  },
  configSchema: z
    .object({
      minDb: z.number().int().min(20).max(120),
      maxDb: z.number().int().min(20).max(120),
      minSeparationDb: z.number().int().min(1).max(40),
      toleranceDb: z.number().min(0.5).max(20),
      holdMs: z.number().int().min(0).max(10_000),
      maxEventAgeMs: z.number().int().min(500).max(60_000),
      revealIncorrect: z.boolean(),
    })
    .refine((c) => c.maxDb - c.minDb >= c.minSeparationDb * 2, 'Range must fit three separated targets')
    .refine((c) => c.toleranceDb * 2 < c.minSeparationDb, 'Tolerance bands must not overlap'),

  init(ctx, config) {
    const targets = generateSoundTargets(config.minDb, config.maxDb, config.minSeparationDb);
    const order: OrderEntry[] = shuffled(ctx.players).map((p, i) => ({ uid: p.uid, targetDb: targets[i] }));
    return {
      privateState: { order },
      captainView: {
        taskType: 'SOUND_RELAY',
        targets: order.map((o) => o.targetDb),
        completedCount: 0,
        toleranceDb: config.toleranceDb,
        holdMs: config.holdMs,
        log: [],
      },
      // The hold duration is not secret; the phone needs it to detect a stable hit.
      playerViews: Object.fromEntries(ctx.players.map((p) => [p.uid, { holdMs: config.holdMs }])),
    };
  },

  actions: {
    hit: {
      roles: ['PLAYER'],
      input: z.object({
        levelDb: z.number().min(0).max(140),
        holdMs: z.number().int().min(0).max(60_000),
        /** Device-relative: milliseconds between the end of the hold and sending. */
        ageMs: z.number().int().min(0).max(3_600_000),
      }),
      prepare(ctx, input: { levelDb: number; holdMs: number; ageMs: number }) {
        const response = { received: true };
        const order = ctx.privateState.order as OrderEntry[];
        const index = ctx.captainView.completedCount as number;
        const current = order[index];

        if (input.holdMs < ctx.config.holdMs || input.ageMs > ctx.config.maxEventAgeMs || !current) {
          return { response, mutating: false };
        }
        const isHit = current.uid === ctx.caller.uid && Math.abs(input.levelDb - current.targetDb) <= ctx.config.toleranceDb;
        if (!isHit) {
          return ctx.config.revealIncorrect
            ? {
                response,
                mutating: true,
                log: [{ kind: 'REJECTED', message: `${ctx.caller.displayName} held ~${Math.round(input.levelDb)} dB — not accepted.` }],
              }
            : { response, mutating: false };
        }

        const completedCount = index + 1;
        return {
          response,
          mutating: true,
          captainPatch: { completedCount },
          log: [{ kind: 'ACCEPTED', message: `Target ${completedCount} (${current.targetDb} dB) hit.` }],
          complete: completedCount === order.length,
        };
      },
    },
  },
};

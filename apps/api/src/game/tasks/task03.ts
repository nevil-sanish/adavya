import { z } from 'zod';
import { shuffled } from '../../lib/random.js';
import type { TaskModule } from './types.js';

/** Pose ids recognised by the player app's local MediaPipe classifier. */
export const POSE_IDS = ['t_pose', 'both_hands_up', 'one_hand_up_one_down'] as const;
export type PoseId = (typeof POSE_IDS)[number];

export const POSE_NAMES: Record<PoseId, string> = {
  t_pose: 'T-Pose',
  both_hands_up: 'Both Hands Up',
  one_hand_up_one_down: 'One Hand Up, One Down',
};

interface Task03Config {
  minHoldMs: number;
}

interface Performer {
  uid: string;
  name: string;
  slot: string;
  poseId: PoseId;
  poseName: string;
  completed: boolean;
}

/**
 * Pose relay. Each player is secretly assigned one of three shuffled poses; only
 * the captain sees the mapping. The phone classifies whatever pose the player
 * holds and reports it; the server decides whether it was the assigned one, so
 * the target never reaches the player's device.
 */
export const task03: TaskModule<Task03Config> = {
  taskId: 'task03',
  taskType: 'POSE_RELAY',
  title: 'Pose Relay',
  description: 'Describe each pose to its performer; phones verify the pose on-device.',
  defaultConfig: { minHoldMs: 1500 },
  configSchema: z.object({ minHoldMs: z.number().int().min(500).max(10_000) }),

  init(ctx) {
    const poses = shuffled(POSE_IDS);
    const performers: Performer[] = ctx.players.map((p, i) => ({
      uid: p.uid,
      name: p.displayName,
      slot: p.slot,
      poseId: poses[i],
      poseName: POSE_NAMES[poses[i]],
      completed: false,
    }));
    return {
      privateState: { assignments: Object.fromEntries(performers.map((p) => [p.uid, p.poseId])) },
      captainView: { taskType: 'POSE_RELAY', performers, completedCount: 0, log: [] },
    };
  },

  actions: {
    pose: {
      roles: ['PLAYER'],
      input: z.object({ poseId: z.enum(POSE_IDS), holdMs: z.number().int().min(0).max(120_000) }),
      prepare(ctx, input: { poseId: PoseId; holdMs: number }) {
        // Players get no verification feedback.
        const response = { received: true };
        const performers = ctx.captainView.performers as Performer[];
        const me = performers.find((p) => p.uid === ctx.caller.uid);
        if (!me || me.completed) return { response, mutating: false };

        if (input.holdMs < ctx.config.minHoldMs) {
          return { response, mutating: false };
        }
        if (ctx.privateState.assignments[ctx.caller.uid] !== input.poseId) {
          return {
            response,
            mutating: true,
            log: [{ kind: 'REJECTED', message: `${me.name} held ${POSE_NAMES[input.poseId]} — not their pose.` }],
          };
        }

        const updated = performers.map((p) => (p.uid === me.uid ? { ...p, completed: true } : p));
        const completedCount = updated.filter((p) => p.completed).length;
        return {
          response,
          mutating: true,
          captainPatch: { performers: updated, completedCount },
          log: [{ kind: 'ACCEPTED', message: `${me.name} verified ${me.poseName}.` }],
          complete: completedCount === updated.length,
        };
      },
    },
  },
};

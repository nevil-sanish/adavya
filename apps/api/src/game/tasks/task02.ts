import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { GameError } from '../../lib/errors.js';
import { newId } from '../../lib/random.js';
import { distanceMeters } from '../geo.js';
import { DEFAULT_ASSIGNMENT_WORDS, formableWords, randomAssignment } from '../words.js';
import type { ActionContext, ActionPlan, TaskModule } from './types.js';

export const LOCATION_COUNT = 10;
export const ASSIGNED_PER_TEAM = 5;
export const CORRECT_PER_TEAM = 3;
export const DECOYS_PER_TEAM = 2;
/** Assignment key used for every team that has no assignment of its own. */
export const DEFAULT_ASSIGNMENT = '_default';

/* ------------------------------ configuration ------------------------------ */

/** One of the ten global locations. Correct/decoy is decided per team, in the assignment. */
export const locationSchema = z.object({
  locationId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,32}$/, 'Location id must be 1-32 letters, digits, - or _'),
  name: z.string().trim().min(1, 'Every location needs a name').max(80),
  latitude: z.number({ invalid_type_error: 'Latitude is required' }).min(-90).max(90),
  longitude: z.number({ invalid_type_error: 'Longitude is required' }).min(-180).max(180),
  radiusMeters: z.number({ invalid_type_error: 'Radius is required' }).min(5, 'Radius must be at least 5 m').max(500),
  letter: z.string().trim().toUpperCase().regex(/^[A-Z]$/, 'Letter must be a single A-Z character'),
  hint: z.string().trim().min(1, 'Every location needs a hint').max(200),
});
export type LocationConfig = z.infer<typeof locationSchema>;

/** Exactly ten locations with unique ids. */
export const locationPoolSchema = z
  .array(locationSchema)
  .length(LOCATION_COUNT, `Exactly ${LOCATION_COUNT} locations are required`)
  .superRefine((locations, ctx) => {
    if (new Set(locations.map((l) => l.locationId)).size !== locations.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Location ids must be unique' });
    }
  });

/**
 * A team's five locations in hint order, which three are correct, and the
 * intended word those three letters form.
 */
export const assignmentSchema = z.object({
  locationIds: z.array(z.string().trim()).length(ASSIGNED_PER_TEAM, `Exactly ${ASSIGNED_PER_TEAM} locations must be assigned`),
  correctLocationIds: z.array(z.string().trim()).length(CORRECT_PER_TEAM, `Exactly ${CORRECT_PER_TEAM} locations must be correct`),
  word: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'The word must be exactly three letters A-Z'),
});
export type Assignment = z.infer<typeof assignmentSchema>;

const sortedLetters = (s: string) => [...s].sort().join('');

/** Checks an assignment against the location pool. Returns the first problem, or null. */
export function assignmentProblem(assignment: Assignment, pool: readonly LocationConfig[]): string | null {
  const byId = new Map(pool.map((l) => [l.locationId, l]));
  if (new Set(assignment.locationIds).size !== ASSIGNED_PER_TEAM) return 'The five assigned locations must be different';
  const unknown = assignment.locationIds.find((id) => !byId.has(id));
  if (unknown) return `Unknown location ${unknown}`;
  if (new Set(assignment.correctLocationIds).size !== CORRECT_PER_TEAM) return 'The three correct locations must be different';
  const outside = assignment.correctLocationIds.find((id) => !assignment.locationIds.includes(id));
  if (outside) return `Correct location ${outside} is not one of the five assigned`;
  const letters = assignment.correctLocationIds.map((id) => byId.get(id)!.letter).join('');
  if (sortedLetters(letters) !== sortedLetters(assignment.word)) {
    return `The correct letters (${letters}) do not form the word ${assignment.word}`;
  }
  return null;
}

interface Task02Config {
  /** Readings less accurate than this never count. */
  maxAccuracyMeters: number;
  /** Live readings older than this (device fix time) are stale. */
  maxPositionAgeMs: number;
  /** Readings captured offline and sent on reconnect may be this old, but never older than the run. */
  maxOfflineAgeMs: number;
  /** Within this many radii of an assigned location the player is told to move closer. */
  nearbyRadiusMultiplier: number;
  /** Consecutive readings inside the same geofence needed before a discovery counts. */
  confirmReadings: number;
  /** Those readings must fall within this window. */
  confirmWindowMs: number;
  /** CAPTAIN_SUBMITS_WORD: the captain types the word. AUTO_ON_THREE_CORRECT: finding the third correct letter completes. */
  completionMode: 'CAPTAIN_SUBMITS_WORD' | 'AUTO_ON_THREE_CORRECT';
  /** Accept the word's letters in any order. */
  acceptAnyOrder: boolean;
  /** Show correct/decoy to players and captain once a location is discovered. */
  revealClassificationOnDiscovery: boolean;
  /** Show players the approximate distance to the nearest assigned location when close. */
  showDistance: boolean;
  /**
   * RANDOM: a team without its own assignment gets a random word (least used so far) and five
   * random locations when it reaches Level 02. MANUAL: it uses the `_default` assignment.
   */
  assignmentMode: 'RANDOM' | 'MANUAL';
  /** Candidate words for RANDOM mode; only words the ten location letters can spell are used. */
  words: string[];
}

export interface AssignedLocation extends LocationConfig {
  order: number;
  classification: 'CORRECT' | 'DECOY';
}

interface PendingReading {
  locationId: string;
  count: number;
  firstAt: number;
  lastAt: number;
}

type GpsInput = { latitude: number; longitude: number; accuracy: number; positionTimestamp: number; queued: boolean };

/**
 * Campus GPS letters. The admin configures ten global locations and gives each
 * team five of them, three correct (their letters form a word) and two decoys.
 * The captain sees the five hints; players walk to them. A discovery needs
 * consecutive accurate readings inside the geofence; the letter comes from the
 * server's configuration, never from the client. Classification stays on the
 * server unless the admin chooses to reveal it after discovery.
 */
export const task02: TaskModule<Task02Config> = {
  taskId: 'task02',
  taskType: 'GPS_LETTER',
  title: 'Campus GPS Letters',
  description: 'Find the hinted campus locations, reveal their letters, and find the three-letter word.',
  defaultConfig: {
    maxAccuracyMeters: 40,
    maxPositionAgeMs: 60_000,
    maxOfflineAgeMs: 600_000,
    nearbyRadiusMultiplier: 3,
    confirmReadings: 2,
    confirmWindowMs: 60_000,
    completionMode: 'CAPTAIN_SUBMITS_WORD',
    acceptAnyOrder: false,
    revealClassificationOnDiscovery: false,
    showDistance: true,
    assignmentMode: 'RANDOM',
    words: DEFAULT_ASSIGNMENT_WORDS,
  },
  configSchema: z.object({
    maxAccuracyMeters: z.number().min(5).max(500),
    maxPositionAgeMs: z.number().int().min(5_000).max(600_000),
    maxOfflineAgeMs: z.number().int().min(0).max(3_600_000),
    nearbyRadiusMultiplier: z.number().min(1).max(20),
    confirmReadings: z.number().int().min(1).max(10),
    confirmWindowMs: z.number().int().min(1_000).max(600_000),
    completionMode: z.enum(['CAPTAIN_SUBMITS_WORD', 'AUTO_ON_THREE_CORRECT']),
    acceptAnyOrder: z.boolean(),
    revealClassificationOnDiscovery: z.boolean(),
    showDistance: z.boolean(),
    assignmentMode: z.enum(['RANDOM', 'MANUAL']),
    words: z.array(z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Words must be exactly three letters A-Z')).min(1),
  }),

  /**
   * Loads the pool and this team's assignment: its own if the admin set one; otherwise a
   * random one (RANDOM mode) or the `_default` (MANUAL mode). Validates the result.
   */
  async loadInit(ctx, config) {
    const [poolSnap, teamSnap, defaultSnap, configSnap] = await Promise.all([
      ctx.tx.get(ctx.r.locations(ctx.cid)),
      ctx.tx.get(ctx.r.assignment(ctx.cid, ctx.teamId)),
      ctx.tx.get(ctx.r.assignment(ctx.cid, DEFAULT_ASSIGNMENT)),
      ctx.tx.get(ctx.r.privateConfig(ctx.cid, 'task02')),
    ]);
    const pool = locationPoolSchema.safeParse(poolSnap.docs.map((d) => d.data()));
    if (!pool.success) {
      throw new GameError('COMPETITION_NOT_CONFIGURED', `Task 2 locations are not configured: ${pool.error.errors[0]?.message}`, 409);
    }

    let raw = teamSnap.data();
    let randomWord: string | null = null;
    if (!raw && config.assignmentMode === 'RANDOM') {
      const used = (configSnap.data()?.usedWords as Record<string, number> | undefined) ?? {};
      const generated = randomAssignment(pool.data, config.words, used);
      if (!generated) {
        throw new GameError('COMPETITION_NOT_CONFIGURED', 'No word in the Task 2 word list can be spelled with the ten location letters.', 409);
      }
      raw = generated;
      randomWord = generated.word;
    }
    raw ??= defaultSnap.data();
    if (!raw) {
      throw new GameError('COMPETITION_NOT_CONFIGURED', 'Task 2 locations have not been assigned to your team yet. Ask the organizers.', 409);
    }
    const assignment = assignmentSchema.safeParse(raw);
    const problem = assignment.success ? assignmentProblem(assignment.data, pool.data) : assignment.error.errors[0]?.message;
    if (!assignment.success || problem) {
      throw new GameError('COMPETITION_NOT_CONFIGURED', `Task 2 assignment for your team is invalid: ${problem}`, 409);
    }
    return { pool: pool.data, assignment: assignment.data, randomWord };
  },

  init(ctx, config, loaded) {
    const { pool, assignment, randomWord } = loaded as { pool: LocationConfig[]; assignment: Assignment; randomWord: string | null };
    const byId = new Map(pool.map((l) => [l.locationId, l]));
    const assigned: AssignedLocation[] = assignment.locationIds.map((id, i) => ({
      ...byId.get(id)!,
      order: i + 1,
      classification: assignment.correctLocationIds.includes(id) ? 'CORRECT' : 'DECOY',
    }));

    return {
      // The assignment is frozen into the run: later admin edits affect only runs that start afterwards.
      privateState: { assigned, word: assignment.word, correctFound: 0, pending: {} },
      captainView: {
        taskType: 'GPS_LETTER',
        hintCount: assigned.length,
        correctRequired: CORRECT_PER_TEAM,
        discoveredCount: 0,
        attemptCount: 0,
        completionMode: config.completionMode,
        acceptAnyOrder: config.acceptAnyOrder,
        revealClassification: config.revealClassificationOnDiscovery,
        // Only maintained when classification is revealed; otherwise it would leak which hints are correct.
        correctFound: config.revealClassificationOnDiscovery ? 0 : null,
        log: [],
      },
      playerViews: Object.fromEntries(ctx.players.map((p) => [p.uid, { discoveries: [] }])),
      extraWrites(tx) {
        // Record the random word so the next team is given a different one.
        if (randomWord) {
          tx.set(ctx.r.privateConfig(ctx.cid, 'task02'), { usedWords: { [randomWord]: FieldValue.increment(1) } }, { merge: true });
        }
        for (const l of assigned) {
          // Captain sees the hint only: no coordinates, letter or classification.
          tx.set(ctx.r.run(ctx.cid, ctx.teamId, 'task02').collection('assignedLocations').doc(l.locationId), {
            locationId: l.locationId,
            order: l.order,
            hint: l.hint,
          });
        }
      },
    };
  },

  actions: {
    gps: {
      roles: ['PLAYER'],
      input: z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        accuracy: z.number().min(0).max(100_000),
        positionTimestamp: z.number().int().positive(),
        /** Captured while offline and sent on reconnect. */
        queued: z.boolean().default(false),
      }),
      prepare: gpsReading,
    },

    word: {
      roles: ['CAPTAIN'],
      input: z.object({ letters: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Enter exactly three letters') }),
      async prepare(ctx, input: { letters: string }) {
        if (ctx.config.completionMode !== 'CAPTAIN_SUBMITS_WORD') {
          return { response: { correct: false, reason: 'NOT_REQUIRED' }, mutating: false };
        }
        // The word counts only once its three correct letters were legitimately discovered.
        // A guess without them is rejected exactly like a wrong word, so it reveals nothing.
        const correctIds = (ctx.privateState.assigned as AssignedLocation[]).filter((l) => l.classification === 'CORRECT').map((l) => l.locationId);
        const discoveries = ctx.r.run(ctx.cid, ctx.teamId, 'task02').collection('discoveries');
        const snaps = await ctx.tx.getAll(...correctIds.map((id) => discoveries.doc(id)));
        const word = ctx.privateState.word as string;
        const matches = ctx.config.acceptAnyOrder ? sortedLetters(input.letters) === sortedLetters(word) : input.letters === word;
        const correct = matches && snaps.every((s) => s.exists);
        return {
          response: { correct },
          mutating: true,
          captainPatch: { attemptCount: (ctx.captainView.attemptCount as number) + 1 },
          log: [{ kind: correct ? 'ACCEPTED' : 'REJECTED', message: `Word ${input.letters} ${correct ? 'accepted' : 'rejected'}.` }],
          extraWrites(tx) {
            tx.set(ctx.r.run(ctx.cid, ctx.teamId, 'task02').collection('wordAttempts').doc(newId()), {
              letters: input.letters,
              correct,
              byName: ctx.caller.displayName,
              at: FieldValue.serverTimestamp(),
            });
          },
          complete: correct,
        };
      },
    },
  },
};

/**
 * One GPS reading. Checks freshness and accuracy, finds the geofence the reading
 * is inside, requires confirmation by consecutive readings, then records the
 * team's discovery once (document id = location id, created in the transaction).
 */
async function gpsReading(ctx: ActionContext<Task02Config>, input: GpsInput): Promise<ActionPlan> {
  const cfg = ctx.config;
  const now = Date.now();
  const age = now - input.positionTimestamp;
  const maxAge = input.queued ? Math.max(cfg.maxOfflineAgeMs, cfg.maxPositionAgeMs) : cfg.maxPositionAgeMs;
  // Readings from the future, too old, or from before this run started (device clock or replay) never count.
  if (age > maxAge || age < -cfg.maxPositionAgeMs || input.positionTimestamp < ctx.run.startedAt.toMillis() - 5_000) {
    return { response: { status: 'STALE_POSITION' }, mutating: false };
  }
  if (input.accuracy > cfg.maxAccuracyMeters) {
    return { response: { status: 'POOR_ACCURACY', maxAccuracyMeters: cfg.maxAccuracyMeters }, mutating: false };
  }

  const assigned = ctx.privateState.assigned as AssignedLocation[];
  const nearest = assigned
    .map((l) => ({ l, d: distanceMeters(input.latitude, input.longitude, l.latitude, l.longitude) }))
    .sort((a, b) => a.d - b.d);
  const inside = nearest.find(({ l, d }) => d <= l.radiusMeters);
  if (!inside) {
    const near = nearest.find(({ l, d }) => d <= l.radiusMeters * cfg.nearbyRadiusMultiplier);
    return {
      response: near
        ? { status: 'MOVE_CLOSER', ...(cfg.showDistance ? { distanceMeters: Math.round(near.d) } : {}) }
        : { status: 'SEARCHING' },
      mutating: false,
    };
  }

  const location = inside.l;
  const reveal = cfg.revealClassificationOnDiscovery;
  const resultType = reveal ? { resultType: location.classification } : {};
  const discoveryRef = ctx.r.run(ctx.cid, ctx.teamId, 'task02').collection('discoveries').doc(location.locationId);
  const existing = await ctx.tx.get(discoveryRef);
  const callerDiscoveries = (ctx.callerView.discoveries as Array<{ locationId: string }> | undefined) ?? [];
  const callerKnows = callerDiscoveries.some((d) => d.locationId === location.locationId);
  const found = { locationId: location.locationId, order: location.order, letter: location.letter, ...resultType };
  const playerViewPatches = callerKnows ? undefined : { [ctx.caller.uid]: { discoveries: [...callerDiscoveries, found] } };

  if (existing.exists) {
    // Same letter for every visitor; a later visit changes no team progress.
    const byYou = existing.data()?.discoveredByUid === ctx.caller.uid;
    return {
      response: { status: 'FOUND', letter: location.letter, order: location.order, alreadyDiscovered: true, byYou, ...resultType },
      mutating: !callerKnows,
      playerViewPatches,
    };
  }

  // Confirmation: one reading can be drift. Require consecutive, distinct readings in the same geofence.
  const pending = (ctx.privateState.pending as Record<string, PendingReading | undefined>)?.[ctx.caller.uid];
  const continues =
    pending?.locationId === location.locationId &&
    input.positionTimestamp > pending.lastAt &&
    input.positionTimestamp - pending.firstAt <= cfg.confirmWindowMs;
  const next: PendingReading = continues
    ? { ...pending!, count: pending!.count + 1, lastAt: input.positionTimestamp }
    : { locationId: location.locationId, count: 1, firstAt: input.positionTimestamp, lastAt: input.positionTimestamp };
  if (next.count < cfg.confirmReadings) {
    return {
      response: { status: 'LOCATION_DETECTED', confirmations: next.count, required: cfg.confirmReadings },
      mutating: true,
      privatePatch: { pending: { [ctx.caller.uid]: next } },
    };
  }

  const isCorrect = location.classification === 'CORRECT';
  const correctFound = (ctx.privateState.correctFound as number) + (isCorrect ? 1 : 0);
  const autoComplete = cfg.completionMode === 'AUTO_ON_THREE_CORRECT' && correctFound >= CORRECT_PER_TEAM;
  return {
    response: { status: 'FOUND', letter: location.letter, order: location.order, alreadyDiscovered: false, ...resultType },
    mutating: true,
    playerViewPatches,
    privatePatch: { correctFound, pending: { [ctx.caller.uid]: FieldValue.delete() } },
    captainPatch: {
      discoveredCount: (ctx.captainView.discoveredCount as number) + 1,
      ...(reveal ? { correctFound } : {}),
    },
    log: [{ kind: 'INFO', message: `${ctx.caller.displayName} revealed letter ${location.letter} at hint ${location.order}.` }],
    extraWrites(tx) {
      tx.set(discoveryRef, {
        discoveryId: location.locationId,
        locationId: location.locationId,
        order: location.order,
        hint: location.hint,
        letter: location.letter,
        discoveredByUid: ctx.caller.uid,
        discoveredByName: ctx.caller.displayName,
        discoveredAt: FieldValue.serverTimestamp(),
        status: 'VALIDATED',
        viaOfflineQueue: input.queued,
        ...resultType,
      });
    },
    complete: autoComplete,
  };
}

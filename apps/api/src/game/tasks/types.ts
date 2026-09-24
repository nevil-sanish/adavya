import type { DocumentData, Firestore, Transaction } from 'firebase-admin/firestore';
import type { z } from 'zod';
import type { Refs } from '../refs.js';
import type { CaptainLogEntry, MemberDoc, Role, TaskId, TaskRunDoc, TaskType, TeamDoc } from '../types.js';

/** Team state loaded at the start of every game transaction. */
export interface TeamContext {
  tx: Transaction;
  db: Firestore;
  r: Refs;
  cid: string;
  teamId: string;
  team: TeamDoc;
  members: MemberDoc[];
  captain: MemberDoc;
  /** player1, player2, player3 in slot order. */
  players: MemberDoc[];
}

export interface TaskInit {
  /** Captain-only live view: `taskRuns/{taskId}/views/captain`. */
  captainView: DocumentData;
  /** Server-only state: `teams/{teamId}/private/{taskId}`. */
  privateState: DocumentData;
  /** Per-player views keyed by uid; every player gets at least `{}`. */
  playerViews?: Record<string, DocumentData>;
  /** Additional task documents created with the run. */
  extraWrites?: (tx: Transaction) => void;
}

export interface ActionContext<C> extends TeamContext {
  caller: MemberDoc;
  config: C;
  run: TaskRunDoc;
  privateState: DocumentData;
  captainView: DocumentData;
  callerView: DocumentData;
}

export interface ActionPlan {
  /** Returned to the caller. Must contain only what the caller's role may see. */
  response: Record<string, unknown>;
  /**
   * False when the action changed nothing (e.g. a GPS poll outside every geofence).
   * Non-mutating actions skip the idempotency log and the sequence watermark.
   */
  mutating: boolean;
  privatePatch?: DocumentData;
  captainPatch?: DocumentData;
  playerViewPatches?: Record<string, DocumentData>;
  log?: Array<Omit<CaptainLogEntry, 'at'>>;
  extraWrites?: (tx: Transaction) => void;
  /** The task's final condition is met; the engine completes and ranks the run. */
  complete?: boolean;
}

export interface TaskAction<C> {
  roles: Role[];
  input: z.ZodTypeAny;
  /** May read inside `ctx.tx`; must not write. Writes are returned in the plan. */
  prepare(ctx: ActionContext<C>, input: any): Promise<ActionPlan> | ActionPlan;
}

export interface TaskModule<C = any> {
  taskId: TaskId;
  taskType: TaskType;
  title: string;
  description: string;
  defaultConfig: C;
  /** Validates the merged configuration. */
  configSchema: z.ZodType<C>;
  /** Read phase before a run is created (inside the transaction). */
  loadInit?(ctx: TeamContext, config: C): Promise<unknown>;
  /** Pure: builds the run's hidden state and role views. */
  init(ctx: TeamContext, config: C, loaded: unknown): TaskInit;
  actions: Record<string, TaskAction<C>>;
}

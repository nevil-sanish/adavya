import { Timestamp } from "firebase/firestore";

/** The three field player slots */
export type PlayerSlot = "b" | "c" | "d";

/** Per-player status within a session */
export type PlayerStatus = "waiting" | "listening" | "correct";

/** Overall session status */
export type SessionStatus = "idle" | "running" | "complete";

/** Live data for one player slot */
export interface PlayerData {
  status: PlayerStatus;
  lastLevel: number;
  updatedAt: Timestamp | null;
}

/** Target dB values assigned per slot */
export interface Targets {
  b: number;
  c: number;
  d: number;
}

/** Full Firestore document shape for task4Sessions/{sessionId} */
export interface Task4Session {
  status: SessionStatus;
  targets: Targets;
  tolerance: number;
  targetMin: number;
  targetMax: number;
  players: {
    b: PlayerData;
    c: PlayerData;
    d: PlayerData;
  };
  startedAt: Timestamp | null;
  completedAt: Timestamp | null;
}

export const DEFAULT_PLAYER_DATA: PlayerData = {
  status: "waiting",
  lastLevel: 0,
  updatedAt: null,
};

export const SESSION_ID = "team001";
export const COLLECTION = "task4Sessions";

export const DEFAULT_TARGET_MIN = 70;
export const DEFAULT_TARGET_MAX = 95;
export const DEFAULT_TOLERANCE = 5;

export const FIRESTORE_WRITE_THROTTLE_MS = 500;

/**
 * ADDITION beyond literal spec: player must stay in tolerance window for this
 * duration (ms) before being marked "correct". Prevents single-spike false positives.
 */
export const CORRECT_HOLD_DURATION_MS = 0; // instant — no hold required

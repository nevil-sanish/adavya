import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase.js";
import {
  Task4Session,
  PlayerSlot,
  PlayerData,
  SessionStatus,
  SESSION_ID,
  COLLECTION,
  DEFAULT_PLAYER_DATA,
  DEFAULT_TARGET_MIN,
  DEFAULT_TARGET_MAX,
  DEFAULT_TOLERANCE,
} from "../types/task4.js";

const sessionRef = () => doc(db, COLLECTION, SESSION_ID);

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Read the current session once (used for page resume / init check). */
export async function getSession(): Promise<Task4Session | null> {
  const snap = await getDoc(sessionRef());
  if (!snap.exists()) return null;
  return snap.data() as Task4Session;
}

/**
 * Monitor: start a new Task 4 session.
 * Generates 3 random targets, resets all player states.
 */
export async function startTask4(
  targetMin = DEFAULT_TARGET_MIN,
  targetMax = DEFAULT_TARGET_MAX,
  tolerance = DEFAULT_TOLERANCE
): Promise<void> {
  const playerDefaults: PlayerData = { ...DEFAULT_PLAYER_DATA, updatedAt: null };
  const session: Omit<Task4Session, "startedAt" | "completedAt"> & {
    startedAt: ReturnType<typeof serverTimestamp>;
    completedAt: null;
  } = {
    status: "running",
    targets: {
      b: randomInt(targetMin, targetMax),
      c: randomInt(targetMin, targetMax),
      d: randomInt(targetMin, targetMax),
    },
    tolerance,
    targetMin,
    targetMax,
    players: {
      b: { ...playerDefaults },
      c: { ...playerDefaults },
      d: { ...playerDefaults },
    },
    startedAt: serverTimestamp() as unknown as ReturnType<typeof serverTimestamp>,
    completedAt: null,
  };
  await setDoc(sessionRef(), session);
}

/**
 * Monitor: reset Task 4 back to idle (clear all progress).
 */
export async function resetTask4(): Promise<void> {
  const existing = await getSession();
  if (!existing) return;
  await setDoc(sessionRef(), {
    ...existing,
    status: "idle" as SessionStatus,
    players: {
      b: { ...DEFAULT_PLAYER_DATA, updatedAt: null },
      c: { ...DEFAULT_PLAYER_DATA, updatedAt: null },
      d: { ...DEFAULT_PLAYER_DATA, updatedAt: null },
    },
    completedAt: null,
  } as Task4Session);
}

/**
 * Player view: update this player's slot with their live level and status.
 * Throttled externally by the caller.
 */
export async function updatePlayerLevel(
  slot: PlayerSlot,
  level: number,
  status: "listening" | "correct"
): Promise<void> {
  await updateDoc(sessionRef(), {
    [`players.${slot}.status`]: status,
    [`players.${slot}.lastLevel`]: Math.round(level * 10) / 10,
    [`players.${slot}.updatedAt`]: serverTimestamp(),
  });
}

/**
 * Monitor: when all 3 players are correct, mark session complete.
 * Called from the monitor onSnapshot handler.
 */
export async function completeTask4(): Promise<void> {
  await updateDoc(sessionRef(), {
    status: "complete" as SessionStatus,
    completedAt: serverTimestamp(),
  });
}

/**
 * Subscribe to the session document (used by both monitor and player views).
 * Returns the unsubscribe function.
 */
export function subscribeToSession(
  callback: (session: Task4Session | null) => void
): () => void {
  return onSnapshot(sessionRef(), (snap) => {
    if (!snap.exists()) {
      callback(null);
    } else {
      callback(snap.data() as Task4Session);
    }
  });
}

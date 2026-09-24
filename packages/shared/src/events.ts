import { ApiError, type Api, type EventEnvelope } from './api.ts';
import type { TaskId } from './model.ts';

export interface SeqStore {
  get(key: string): number;
  set(key: string, value: number): void;
}

/** localStorage-backed sequence store; falls back to memory when storage is unavailable. */
export function browserSeqStore(): SeqStore {
  const memory = new Map<string, number>();
  return {
    get(key) {
      try {
        return Number(localStorage.getItem(key)) || memory.get(key) || 0;
      } catch {
        return memory.get(key) ?? 0;
      }
    },
    set(key, value) {
      memory.set(key, value);
      try {
        localStorage.setItem(key, String(value));
      } catch {
        /* private mode: memory only */
      }
    },
  };
}

export function newEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends task events. Each event gets a fresh idempotency key and the next
 * sequence number above both the local counter and the server's watermark
 * (`knownSeq`, from the caller's view), so a new device or cleared storage
 * resumes cleanly. Network failures are retried with the same key and sequence:
 * the server applies the event at most once.
 *
 * Pass `dedupeKey` for a user action that may be resent by hand after a failure
 * (e.g. "Send again"): until it succeeds or is rejected, every send with that key
 * reuses the same idempotency key and sequence number.
 */
export function createEventSender(api: Api, store: SeqStore, options: { retries?: number; baseDelayMs?: number } = {}) {
  const retries = options.retries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 600;
  const pending = new Map<string, EventEnvelope>();

  return async function send<T = Record<string, unknown>>(args: {
    taskId: TaskId;
    action: string;
    runId: string;
    uid: string;
    knownSeq?: number;
    payload?: Record<string, unknown>;
    dedupeKey?: string;
  }): Promise<T & { duplicate: boolean }> {
    const key = `adavya:seq:${args.runId}:${args.uid}`;
    const pendingKey = args.dedupeKey ? `${key}:${args.taskId}:${args.action}:${args.dedupeKey}` : null;
    let envelope = pendingKey ? pending.get(pendingKey) : undefined;
    if (!envelope) {
      const clientSeq = Math.max(store.get(key), args.knownSeq ?? 0) + 1;
      store.set(key, clientSeq);
      envelope = { runId: args.runId, clientEventId: newEventId(), clientSeq, payload: args.payload ?? {} };
      if (pendingKey) pending.set(pendingKey, envelope);
    }

    for (let attempt = 0; ; attempt++) {
      try {
        const result = await api.submit<T>(args.taskId, args.action, envelope);
        if (pendingKey) pending.delete(pendingKey);
        return result;
      } catch (err) {
        const retryable = err instanceof ApiError && err.retryable;
        if (!retryable && pendingKey) pending.delete(pendingKey);
        if (!retryable || attempt >= retries) throw err;
        await wait(baseDelayMs * 2 ** attempt);
      }
    }
  };
}

export type EventSender = ReturnType<typeof createEventSender>;

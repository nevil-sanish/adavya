import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError, type Api, type EventEnvelope } from '../src/api.ts';
import { createEventSender, type SeqStore } from '../src/events.ts';

function memoryStore(): SeqStore {
  const m = new Map<string, number>();
  return { get: (k) => m.get(k) ?? 0, set: (k, v) => void m.set(k, v) };
}

function fakeApi(handler: (env: EventEnvelope) => unknown): { api: Api; calls: EventEnvelope[] } {
  const calls: EventEnvelope[] = [];
  const api = {
    submit: async (_t: string, _a: string, env: EventEnvelope) => {
      calls.push(env);
      return handler(env);
    },
  } as unknown as Api;
  return { api, calls };
}

test('sequence increases and respects the server watermark', async () => {
  const { api, calls } = fakeApi(() => ({ duplicate: false }));
  const send = createEventSender(api, memoryStore());
  await send({ taskId: 'task01', action: 'orient', runId: 'r', uid: 'u' });
  await send({ taskId: 'task01', action: 'orient', runId: 'r', uid: 'u' });
  await send({ taskId: 'task01', action: 'orient', runId: 'r', uid: 'u', knownSeq: 40 });
  assert.deepEqual(calls.map((c) => c.clientSeq), [1, 2, 41]);
  assert.equal(new Set(calls.map((c) => c.clientEventId)).size, 3);
});

test('network failures retry with the same idempotency key and sequence', async () => {
  let n = 0;
  const { api, calls } = fakeApi(() => {
    if (n++ < 2) throw new ApiError('offline', 'NETWORK_ERROR', 0);
    return { duplicate: false };
  });
  const send = createEventSender(api, memoryStore(), { baseDelayMs: 1 });
  await send({ taskId: 'task06', action: 'morse', runId: 'r', uid: 'u', payload: { morse: '.-' } });
  assert.equal(calls.length, 3);
  assert.equal(new Set(calls.map((c) => c.clientEventId)).size, 1);
  assert.equal(new Set(calls.map((c) => c.clientSeq)).size, 1);
});

test('game rejections are not retried', async () => {
  const { api, calls } = fakeApi(() => {
    throw new ApiError('stale', 'STALE_RUN', 409);
  });
  const send = createEventSender(api, memoryStore(), { baseDelayMs: 1 });
  await assert.rejects(send({ taskId: 'task01', action: 'orient', runId: 'r', uid: 'u' }), /stale/);
  assert.equal(calls.length, 1);
});

test('a manual resend with the same dedupeKey reuses the envelope after retries are exhausted', async () => {
  let fail = true;
  const { api, calls } = fakeApi(() => {
    if (fail) throw new ApiError('offline', 'NETWORK_ERROR', 0);
    return { duplicate: false };
  });
  const send = createEventSender(api, memoryStore(), { retries: 1, baseDelayMs: 1 });
  const args = { taskId: 'task05' as const, action: 'attempt', runId: 'r', uid: 'u', payload: { durationMs: 5000 }, dedupeKey: 'attempt-1' };
  await assert.rejects(send(args));
  fail = false;
  await send(args);
  assert.equal(new Set(calls.map((c) => c.clientEventId)).size, 1);
  assert.equal(new Set(calls.map((c) => c.clientSeq)).size, 1);
  // After success the key is released: the next attempt is a new event.
  await send({ ...args, dedupeKey: 'attempt-2' });
  assert.equal(new Set(calls.map((c) => c.clientEventId)).size, 2);
});

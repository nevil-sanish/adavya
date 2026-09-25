import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { ApiError, createApi } from '../src/api.ts';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function respond(body: string, status = 200, type = 'application/json') {
  globalThis.fetch = (async () => new Response(body, { status, headers: { 'Content-Type': type } })) as typeof fetch;
}

const api = createApi('', async () => null);

test('an empty or HTML answer is an error, not an empty session', async () => {
  for (const [body, status, type] of [['', 200, 'text/plain'], ['<!doctype html><html></html>', 200, 'text/html'], ['Not Found', 404, 'text/plain']] as const) {
    respond(body, status, type);
    await assert.rejects(api.login('token'), (err: unknown) => err instanceof ApiError && err.code === 'BAD_RESPONSE' && /forwarded to the API/.test(err.message));
  }
});

test('JSON errors keep the server code and message', async () => {
  respond(JSON.stringify({ error: 'INSTITUTION_EMAIL_REQUIRED', message: 'Use your institute account.' }), 403);
  await assert.rejects(api.login('token'), (err: unknown) => err instanceof ApiError && err.code === 'INSTITUTION_EMAIL_REQUIRED' && err.status === 403);
});

test('a JSON session passes through', async () => {
  const session = { user: { uid: 'u', teamId: null }, isAdmin: false, activeCompetitionId: 'main' };
  respond(JSON.stringify(session));
  assert.deepEqual(await api.session(), session);
});

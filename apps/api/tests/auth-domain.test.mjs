import assert from 'node:assert/strict';
import { test } from 'node:test';
import { admin } from '../dist/config/firebase.js';
import { requireAuth } from '../dist/middlewares/auth.middleware.js';
import { authRouter } from '../dist/routes/auth.routes.js';

// Stub only Firebase verification; exercise the real route and middleware.
admin.initializeApp({ projectId: 'auth-policy-test' });
const firebaseAuth = admin.auth();
const googleLogin = authRouter.stack.find(layer => layer.route?.path === '/google').route.stack[0].handle;
function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

for (const email of ['student@gmail.com', 'student@googlemail.com', 'student@iiitkottayam.ac.in.evil.com', 'student@fakeiiitkottayam.ac.in', 'student@dept.iiitkottayam.ac.in', 'a@b@iiitkottayam.ac.in', '@iiitkottayam.ac.in']) {
  test(`rejects ${email} at login and on protected requests`, async () => {
    firebaseAuth.verifyIdToken = async () => ({ uid: 'test-user', email, email_verified: true });
    const loginResponse = response();
    await googleLogin({ body: { idToken: 'test-token' } }, loginResponse);
    assert.equal(loginResponse.statusCode, 403);
    const protectedResponse = response();
    await requireAuth({ headers: { authorization: 'Bearer test-token' } }, protectedResponse, () => assert.fail('Unauthorized request passed'));
    assert.equal(protectedResponse.statusCode, 403);
  });
}

test('rejects an unverified campus address at both entry points', async () => {
  firebaseAuth.verifyIdToken = async () => ({ uid: 'test-user', email: 'student@iiitkottayam.ac.in', email_verified: false });
  const loginResponse = response();
  await googleLogin({ body: { idToken: 'test-token' } }, loginResponse);
  assert.equal(loginResponse.statusCode, 403);
  const protectedResponse = response();
  await requireAuth({ headers: { authorization: 'Bearer test-token' } }, protectedResponse, () => assert.fail('Unverified request passed'));
  assert.equal(protectedResponse.statusCode, 403);
});

test('accepts a verified campus identity and normalizes case', async () => {
  firebaseAuth.verifyIdToken = async () => ({ uid: 'test-user', email: 'Student@IIITKOTTAYAM.AC.IN', email_verified: true });
  const req = { headers: { authorization: 'Bearer test-token' } };
  let passed = false;
  await requireAuth(req, response(), () => { passed = true; });
  assert.equal(passed, true);
  assert.equal(req.user.email, 'student@iiitkottayam.ac.in');
});

test('rejects invalid tokens', async () => {
  firebaseAuth.verifyIdToken = async () => { throw new Error('Invalid token'); };
  const res = response();
  await requireAuth({ headers: { authorization: 'Bearer invalid' } }, res, () => assert.fail('Invalid token passed'));
  assert.equal(res.statusCode, 401);
});

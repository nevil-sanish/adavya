# Shared logic

Dependency-free TypeScript used by `apps/website` (captain) and `apps/mobile` (player):

- `model.ts` — Firestore document shapes the clients read, task catalog, pose and Morse tables.
- `api.ts` — typed client for the trusted API (`apps/api`), given a token getter.
- `events.ts` — task event sender: run id, idempotency key, per-player sequence, safe retries.
- `sensors/` — pure detectors for tilt lock, pose classification and hold, sound plateaus, Morse presses.

Apps import it as `@adavya/shared` through a Vite alias and a TypeScript path mapping.
Keep browser APIs, Firebase SDKs and server credentials out of this directory so it stays testable.
Imports use explicit `.ts` extensions so Node can run the tests directly: `npm test`.

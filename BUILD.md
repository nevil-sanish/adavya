# Team Challenge Platform — End-to-End Build Plan

This is the ordered implementation plan for the complete application.

## 1. Target stack

| Layer | Planned | As built (repository) |
|---|---|---|
| Player app | Flutter Web, mobile-first | `apps/mobile` — React + Vite, mobile-first web |
| Captain website | Next.js with React and TypeScript | `apps/website` — React + Vite + Tailwind, includes `/admin` |
| Authentication | Firebase Authentication | Firebase Auth, Google provider, local persistence |
| Database | Cloud Firestore | Cloud Firestore; rules in `firebase/firestore.rules` |
| Trusted logic | Cloud Functions or existing trusted backend | `apps/api` — Express + Firebase Admin SDK (existing backend) |
| Realtime | Firestore listeners | Firestore `onSnapshot`, scoped per team/task, detached on task change |
| Hosting | Firebase Hosting | `firebase.json` hosting targets `captain` and `player`; API on any Node 22 host |
| GPS | Geolocation API | `navigator.geolocation.watchPosition` |
| Pose detection | MediaPipe Pose Landmarker | `@mediapipe/tasks-vision`, WASM self-hosted |
| Timing | `performance.now()`; server timestamps | same |
| Shared client code | — | `packages/shared` (types, API client, event sender, sensor detectors) |

The React/Vite/Express stack already existed; the agent contract forbids parallel systems, so it was extended rather than replaced with Flutter/Next.js/Functions. No second backend or data store was introduced.

## 2. Repository discovery phase

Before implementation, inspect:

```text
Flutter:
  pubspec.yaml
  lib/main.dart
  lib/routes/
  lib/models/
  lib/services/
  lib/screens/
  lib/widgets/
  lib/firebase/
  lib/levels/

Captain website:
  package.json
  app/ or pages/
  components/
  lib/
  services/
  firebase/
  hooks/
  levels/
  admin/
  captain/

Backend/Firebase:
  firebase.json
  firestore.rules
  firestore.indexes.json
  functions/
  security rules
  authentication configuration
```

Record the actual paths in the implementation report. Reuse existing names when possible.

Actual paths in this repository:

```text
apps/api/src/game/engine.ts          task lifecycle, submissions, completion ranking
apps/api/src/game/tasks/task0N.ts    one module per task (hidden state, role views, actions)
apps/api/src/services/               profiles/teams, admin and reset
apps/api/src/routes/                 auth, teams, tasks, admin
apps/api/src/scripts/                setup-competition, reset-competition, rehearsal
apps/api/tests/                      engine, team, ranking, scoring tests
apps/website/src/captain/            captain shell, lobby, monitor, task panels
apps/website/src/admin/              operator console
apps/mobile/src/screens|tasks/       player shell and task screens
packages/shared/src/                 client types, API client, event sender, sensors
firebase/firestore.rules             security rules (+ tests in firebase/tests)
firebase.json                        emulators and hosting targets
```

## 3. Milestone plan

### Milestone 0 — Baseline

- Run existing Flutter checks and web build.
- Run existing Next.js checks and build.
- Run existing Firebase emulator tests if available.
- Capture the current schema and routes.
- Create a baseline commit or equivalent checkpoint.

Exit criteria: existing levels still run before any feature changes.

### Milestone 1 — Identity and team lifecycle

Implement or extend:

- Institutional email allowlist.
- Persistent Firebase Auth session.
- Display-name creation/editing.
- Team creation by the captain.
- Four-digit numeric team-code generation.
- Collision-safe team-code reservation.
- Join-by-code flow.
- Permanent captain and player slots.
- Four-member readiness gate.
- Lobby realtime roster.
- First-task start permission for the captain only.

Test:

- Invalid email rejection.
- Refresh after login.
- Duplicate team-code retry.
- Full team rejection.
- Duplicate membership rejection.
- Attempted leave/removal rejection.
- Start blocked until four members exist.

### Milestone 2 — Shared task lifecycle and scoring

Implement:

- Competition document.
- Six task definitions.
- Per-team task runs.
- Automatic next-task start.
- Task status transitions.
- Server completion timestamps.
- Transactional completion rank.
- Shared points-by-rank policy.
- One-second tie window and dense ranking.
- Score aggregation.

Example ranking:

```text
Team A: rank 1, 100 points
Team B: rank 1, 100 points
Team C: rank 2, 90 points
```

### Milestone 3 — Captain and player shells

Build reusable screens/components for:

- Authenticated routing.
- Lobby.
- Captain shell.
- Player shell.
- Task loading state.
- Waiting-for-captain state.
- Waiting-for-player state.
- Reconnect state.
- Task completion state.
- Error and permission states.

### Milestone 4 — Task 1

Implement the left/right orientation task:

- Server-generated hidden binary sequence.
- Player-local orientation detection.
- Left=`0`, right=`1`.
- Stable-position lock.
- Server validation of player and expected direction.
- Trial-and-error captain coordination.
- Idempotent step completion.
- Reconnect-safe progress.

### Milestone 5 — Task 2

Implement the campus GPS challenge:

- Admin configuration for ten global locations.
- Five assigned locations per team.
- Three correct locations and two decoys.
- Captain-visible hints only.
- GPS permission and accuracy states.
- Configurable geofences.
- Online-only discovery.
- Trusted server validation.
- One discovery per location per team.
- Same letter returned to multiple players at the same location.
- Decoy letter returned without exposing classification.
- Captain manual three-letter submission.
- Wrong sequence rejection without task reset.
- Completion ranking.

The team does not need to discover all five locations. It needs three correct letters and the correct ordered submission.

### Milestone 6 — Task 3

Implement the pose relay:

- Three shuffled pose assignments.
- Captain pose names/reference images.
- Mobile camera-only view.
- Local MediaPipe verification.
- One-person detection and visibility preconditions.
- Hold-to-confirm with timestamps and grace period.
- Completion persistence.
- Camera-permission error state.

### Milestone 7 — Task 4

Implement the sound relay:

- Three unique sound levels.
- Configurable range, tolerance, separation, and hold duration.
- Captain sees ordered values but not player mapping.
- Player sees live approximate sound reading but not target.
- Local calibration.
- Stable valid hit events.
- Server event ordering buffer.
- Repeated attempts.
- Duplicate, late, out-of-order, and simultaneous event handling.

### Milestone 8 — Task 5

Implement the response-time relay:

- Three target times.
- Blind player stopwatch.
- `performance.now()` for local duration.
- No `setInterval` for actual timing.
- Maximum three attempts.
- Retry penalty from task configuration.
- Lock-in behavior.
- Captain result dashboard.
- Server-authoritative task completion and ranking.

### Milestone 9 — Task 6

Implement the Morse relay:

- Target word of exactly three letters, with one position assigned to each mobile player.
- One distinct assigned player per letter position.
- Mobile blank screen.
- Single tap generates dot.
- Press-and-hold generates dash.
- Local vibration only when supported.
- Explicit Submit Letter action.
- Captain sees target word, submitted Morse, red/green status, and progress.
- Wrong player or wrong Morse rejected without resetting the current position.
- Unlimited retries.
- Accepted letters advance the position.
- Completion ranking.

### Milestone 10 — Security and adversarial testing

Test:

- Cross-team reads and writes.
- Forged player IDs.
- Forged team IDs.
- Forged roles and slots.
- Arbitrary GPS letters.
- Arbitrary Morse acceptance.
- Client-written points/ranks.
- Replay of old-round events.
- Duplicate submissions.
- Concurrent final submissions.
- Reconnect during every task.

### Milestone 11 — Event rehearsal

Run a realistic multi-team rehearsal with:

- At least four simultaneous teams.
- Three mobile clients plus one captain client per team.
- Real campus GPS locations.
- Android Chrome.
- iOS Safari if supported.
- Network interruption tests.
- Admin configuration and reset procedure.

## 4. Local development commands

Node.js 22+ and Java 21+ (for the Firestore emulator). From the repository root:

```bash
npm run setup           # install apps/website, apps/mobile, apps/api, firebase/
npm test                # shared unit tests + Firestore rules tests + API/engine tests (emulator)
npm run build           # typecheck and build all three apps

# Full local stack on emulators (four terminals)
npm run emulators       # Auth :9099, Firestore :8080, UI :4000
cd apps/api && FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
  FIREBASE_PROJECT_ID=demo-adavya FIREBASE_CLIENT_EMAIL= FIREBASE_PRIVATE_KEY= npm run dev
cd apps/website && VITE_USE_EMULATORS=true VITE_FIREBASE_PROJECT_ID=demo-adavya npm run dev
cd apps/mobile  && VITE_USE_EMULATORS=true VITE_FIREBASE_PROJECT_ID=demo-adavya npm run dev

# Competition setup and rehearsal (apps/api; same emulator variables)
npm run setup -- --locations config/locations.sample.json --assignment config/assignment.sample.json --open
npm run rehearsal -- --teams 4
```

Do not run destructive resets against shared or production Firebase projects. `npm run reset` refuses to run without `--confirm <competitionId>`.

## 5. Environment configuration

Use environment-specific configuration. Each app has a `.env.example`:

| Setting | Where |
|---|---|
| Firebase project ID and service account | `apps/api/.env`: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (or ADC) |
| Firebase web config | `apps/website/.env`, `apps/mobile/.env`: `VITE_FIREBASE_*` |
| Allowed email domain | `ALLOWED_EMAIL_DOMAIN` (API), `VITE_ALLOWED_EMAIL_DOMAIN` (clients), and `firebase/firestore.rules` |
| Competition ID | `COMPETITION_ID` (API, default `main`) |
| Admins | `ADMIN_EMAILS` (API, comma-separated) |
| Presence timeout | `PRESENCE_STALE_MS` (API, default 45000) |
| Captain / player URLs | `FRONTEND_URL`, `MOBILE_URL` (API CORS); `VITE_API_URL`, `VITE_PLAYER_APP_URL` (clients) |
| Pose model | `VITE_POSE_MODEL_URL` (player app, optional) |
| Firestore region | chosen when the Firebase project is created |

Never commit private keys. The service account belongs in the API host's secret store.

## 6. Acceptance checklist

Evidence: `apps/api/tests/*.test.mjs` (emulator), `firebase/tests/rules.test.mjs`, `packages/shared/tests/`, `npm run rehearsal` (four teams over HTTP), and a browser playthrough of both UIs against the emulators.

- [x] Four-person team can authenticate and join. — `team.test.mjs`, rehearsal, browser run
- [x] Team code is four random numeric digits. — `scoring.test.mjs`, `team.test.mjs` (collision retry)
- [x] Captain starts only the first task. — `team.test.mjs` (captain-only, four members, lock)
- [x] Later tasks start automatically. — `tasks.test.mjs`, rehearsal
- [x] All six tasks persist state. — `tasks.test.mjs`, browser run with a captain refresh mid-task
- [x] Multiple teams compete on the same task ID. — `ranking.test.mjs`, rehearsal
- [x] Completion rank is server-assigned. — server clock in the ranking transaction
- [x] Ties receive equal rank and points. — `scoring.test.mjs`, `ranking.test.mjs` (simultaneous and 1 s window)
- [x] Round 2 requires three correct letters and exact captain sequence. — `tasks.test.mjs`
- [x] Round 6 validates player order and Morse code. — `tasks.test.mjs`, browser run
- [x] Refresh and reconnect restore state. — browser run (captain tab closed/reopened, player reload)
- [x] Security tests pass. — `rules.test.mjs`, adversarial cases in `tasks.test.mjs` and the rehearsal
- [ ] Existing levels remain functional. — superseded: the prototype rounds (3-member teams, client-trusted endpoints) were replaced by task01–task06; see `docs/OPERATIONS.md`
- [x] Production build passes for both clients. — `npm run build`
- [ ] Physical-device rehearsal (Android Chrome, iOS Safari, real campus GPS) — requires the event venue; see `docs/OPERATIONS.md`

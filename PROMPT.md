# Team Challenge Platform — Modular Development Prompts

Use these prompts sequentially. Each prompt is intentionally scoped so an implementation agent can work without rewriting the whole application.

> **Repository stack.** Where a prompt says Flutter Web player app, Next.js captain website, or Cloud Functions, read: `apps/mobile` (React + Vite), `apps/website` (React + Vite), and `apps/api` (Express + Admin SDK; functions are HTTPS routes). See ARCHITECTURE.md §1 and §16. Prompts 00–13 are implemented; Prompt 14's operator material is in `docs/OPERATIONS.md`.

## Prompt 00 — Orchestrator and repository audit

```text
You are the lead engineer for the existing team challenge platform.

First inspect the repository without modifying it. Identify the Flutter Web player app, Next.js/React captain website, Firebase initialization, authentication, Firestore schema, security rules, Cloud Functions/backend, routing, existing level lifecycle, admin pages, and reusable UI/services.

The product invariants are:
- Exactly four members per team: one permanent captain and three permanent players.
- The team creator is the captain.
- Team code is exactly four random numeric digits.
- Players cannot leave; captain cannot remove members.
- Captain starts only task01; later tasks start automatically.
- Six task IDs: task01 through task06.
- Multiple teams compete on each task ID by server completion time.
- Firebase Auth, Firestore, and trusted Firebase backend logic are authoritative.

Do not implement features yet. Produce:
1. Actual repository map.
2. Existing systems to reuse.
3. Conflicts with ARCHITECTURE.md.
4. Files that must change.
5. Safe implementation order.
6. Baseline commands and results.
Stop if the existing architecture contradicts the product invariants in a way that requires a product decision.
```

## Prompt 01 — Authentication and persistent identity

```text
Implement or extend authentication using the existing Firebase Auth setup.

Requirements:
- Accept only @iiitkottayam.ac.in emails (the institute domain; configurable).
- Persist the Firebase session across refresh and app close according to platform capability.
- Load or create the user profile.
- Allow display-name creation and editing before team lock.
- Restore competitionId, teamId, role, and fixed slot after re-login.
- Do not trust client-provided UID or email in writes.

Add tests for invalid domain, refresh restoration, missing profile, duplicate profile, and unauthorized profile updates.
Run the relevant checks and report changed files.
```

## Prompt 02 — Team creation, code reservation, and joining

```text
Implement the team lifecycle using Firestore transactions and trusted functions.

Requirements:
- Team creator becomes permanent captain.
- Generate exactly four random numeric digits.
- Reserve the code atomically in teamDirectory.
- Retry on collision.
- Allow joining by code only while the team is in the lobby.
- Assign permanent slots captain, player1, player2, player3.
- Reject full teams, duplicate membership, invalid competitions, and unauthorized joins.
- Do not implement leave or captain removal.
- Expose a realtime lobby roster.

Add tests for simultaneous joins, code collision, fifth member, duplicate join, and join after lock.
```

## Prompt 03 — Shared task lifecycle and scoring

```text
Implement the generic task-run engine for task01 through task06.

Requirements:
- Captain may start only task01 after exactly four members exist.
- Completing a task automatically starts the next task for that team.
- A task run can complete only once.
- Completion ranking is global per competition and task ID.
- Use trusted server timestamps.
- Use a one-second tie window.
- Tied teams receive the same rank and points.
- Use dense ranking for the next group.
- Use the shared pointsByRank configuration.
- Never accept client-written rank, score, completion timestamp, or status.

Add transaction and concurrency tests with multiple teams completing simultaneously.
```

## Prompt 04 — Shared captain/player shells

```text
Build reusable authenticated shells for captain and mobile players.

Implement:
- Route restoration from currentTaskId.
- Lobby and task waiting screens.
- Captain monitor layout.
- Player interaction layout.
- Loading, disconnected, reconnecting, permission, and fatal-error states.
- Firestore listeners scoped to competition, team, and task.
- Cleanup of listeners when routes change.

Do not implement task-specific rules in the shells.
```

## Prompt 05 — Task 1 orientation

```text
Implement task01 as a left/right orientation challenge.

Rules:
- Server generates the hidden binary sequence.
- Left is 0 and right is 1.
- The player phone detects and locks the requested orientation.
- The captain coordinates by trial and error.
- Server accepts only the authenticated player and direction for the current step.
- Wrong, stale, duplicate, and replayed events do not advance progress.
- Reconnect restores the current sequence position.

Do not add alternative rotation modes.
```

## Prompt 06 — Task 2 admin configuration and GPS

```text
Implement task02, the campus GPS letter challenge.

Admin rules:
- Exactly ten global locations.
- Each team receives exactly five.
- Exactly three are correct and two are decoys.
- Correct letters form the private three-letter sequence.
- Every location has coordinates, radius, letter/result, hint, and classification.

Player rules:
- Require online connection.
- Request browser GPS permission.
- Show accuracy, searching, move-closer, validating, and error states.
- Validate coordinates and accuracy on the trusted backend.
- Automatically reveal the assigned letter when inside the geofence.
- Return the same letter to multiple players visiting the same location.
- Ignore later visits to an already discovered location.

Captain rules:
- Show five hints.
- Show legitimately discovered letters.
- Do not reveal correct/decoy classification.
- Allow manual three-letter submission.
- Reject a wrong sequence without resetting discoveries.
- Complete only after the correct sequence is submitted.

Test GPS denial, poor accuracy, boundary conditions, decoys, duplicates, concurrent visits, offline rejection, and cross-team access.
```

## Prompt 07 — Task 3 pose relay

```text
Implement task03 pose relay.

The captain sees three pose names/reference images and ownership. Players see only camera preview. Do not show pose names, skeleton overlays, or verification feedback to players.

Use local MediaPipe verification with visible-landmark preconditions, timestamp-based hold duration, and a short jitter grace period. Write only the result, not video or landmarks. Completion is idempotent. A completed performer remains completed. Handle camera permission failure and reconnect.
```

## Prompt 08 — Task 4 sound relay

```text
Implement task04 sound relay.

Generate three unique configurable sound targets and a required completion order. Captain sees ordered values but not player mapping. Players see live approximate readings but not their target.

Implement calibration, tolerance, minimum hold duration, stable hit events, server timestamps, event idempotency, duplicate handling, out-of-order handling, late network events, background-noise handling, and simultaneous player attempts.

Do not expose incorrect-attempt feedback that reveals hidden mapping unless explicitly configured.
```

## Prompt 09 — Task 5 response-time relay

```text
Implement task05 response-time relay.

Captain sees three target times. Players use a blind stopwatch. Use performance.now() to calculate local duration; never use setInterval for the measured duration. Support three attempts, retry penalties, score calculation, reset/retry, and lock-in.

Write results through a trusted function. Make retries idempotent. Show the captain target, actual, error, attempts, retries, and final score. Complete and rank the task only after all required players are finalized.
```

## Prompt 10 — Task 6 Morse relay

```text
Implement task06 Morse relay.

Rules:
- Target word has exactly three letter positions and exactly three letters.
- Each position is assigned to a different player.
- Mobile screens are blank except for input controls.
- Single tap means dot.
- Press-and-hold means dash.
- Vibrate locally only when the browser supports it.
- Player presses Submit Letter when finished.
- Captain sees target word, submitted Morse, result color, and overall progress.
- Wrong player or wrong Morse is rejected without resetting the current position.
- Retries are unlimited.
- Correct acceptance advances one position.

Store target word, player-position assignment, and expected Morse in private configuration. Do not expose them to mobile clients. Add tests for wrong player, wrong Morse, retry, duplicate submission, reconnect, and final completion.
```

## Prompt 11 — Security rules and adversarial review

```text
Review every Firestore rule and trusted function against an untrusted browser.

Attempt to:
- Read another team's data.
- Change a UID, role, slot, team, or captain.
- Submit an arbitrary GPS letter.
- Read correct/decoy classification.
- Read a mobile player's Morse target.
- Change progress, rank, points, or completion.
- Replay an old task event.
- Submit duplicate and concurrent events.

Fix vulnerabilities with the smallest compatible change. Add emulator tests for every rejected operation.
```

## Prompt 12 — Recovery and realtime verification

```text
Test every task with refresh, app close, reconnect, captain disconnect, player disconnect, delayed listener delivery, duplicate submission, and stale task events.

Required behavior:
- Captain disconnect pauses the team's task until captain reconnects.
- Player disconnect pauses the relevant task until the player reconnects.
- No progress disappears.
- No accepted action is counted twice.
- Old-round actions are rejected.
- The website updates through Firestore without manual refresh.
```

## Prompt 13 — Multi-team competition rehearsal

```text
Run an end-to-end rehearsal with at least four simultaneous teams.

Verify:
- Team data isolation.
- Same task definitions with independent task runs.
- Correct completion ranking.
- One-second tie behavior.
- Dense ranking after ties.
- Automatic next-task start.
- Total-score aggregation.
- Captain and player reconnection.
- Admin reset and reconfiguration procedure.

Produce a defect list and evidence for each acceptance criterion.
```

## Prompt 14 — Release and handoff

```text
Prepare the application for event deployment.

Verify production configuration, Firebase rules, indexes, functions, hosting, allowed domains, Auth providers, admin access, task configuration, reset tools, backups, logs, and monitoring.

Produce:
- Deployment checklist.
- Rollback procedure.
- Event operator guide.
- Test-account procedure.
- Final changed-file list.
- Known limitations.
- Final build and test results.
```

## Agent output format

Every implementation prompt must finish with:

```text
Status: COMPLETE | BLOCKED | PARTIAL
Changed files:
Tests run:
Builds run:
Security checks:
Known risks:
Next prompt:
```

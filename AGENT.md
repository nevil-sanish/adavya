# Team Challenge Platform — Agent Contract

This document is the operating contract for every coding agent working on the application.

## 1. Product definition

Build a real-time, multi-team campus competition platform with:

- Player web application optimized for mobile browsers on Android and iOS (`apps/mobile`, React + Vite).
- React captain website for the laptop/monitor view (`apps/website`, React + Vite).
- Firebase Authentication for identity.
- Cloud Firestore for persistent state and real-time listeners.
- A trusted Firebase server layer for protected validation, scoring, and progression (`apps/api`, Express + Firebase Admin SDK).

The original plan named Flutter Web, Next.js and Cloud Functions; the existing React/Express stack was kept to avoid parallel systems (see ARCHITECTURE.md §1).

Each team always has exactly four members:

```text
1 captain + 3 players
```

The team creator is permanently the captain. The captain, player membership, and player slots do not change during the competition.

The captain starts only the first task. Every later task starts automatically after the previous task is completed.

Multiple teams execute the same task IDs concurrently and compete on completion time.

## 2. Non-negotiable invariants

Never violate these rules:

1. Only `@iiitkottayam.ac.in` accounts may authenticate (configurable; see ARCHITECTURE.md §1).
2. A user has one persistent identity and one fixed team membership for the competition.
3. A team has exactly four members before it can start.
4. The team creator is the captain for the complete game.
5. The captain cannot remove members after they join.
6. Players cannot leave or change teams after joining.
7. Team codes are exactly four random numeric digits and must be unique while active.
8. Clients are untrusted. Never accept client-provided identity, team, role, slot, score, rank, completion, target, letter, or classification as authoritative.
9. Firestore is the source of truth for persistent game state.
10. Protected writes are performed through trusted server functions and transactions.
11. A refresh, app close, reconnect, or re-login restores the exact team, role, task, assignment, and progress.
12. Old-round events must be rejected.
13. A task can be completed only once.
14. Completion rank and points are assigned by server time and a transaction, never by a device clock.
15. Captain and player views must expose only information allowed for that role.
16. One team's data must never be readable or writable by another team.

## 3. Canonical task order

The competition contains six task IDs. The task definition is global; every team gets its own task run.

| ID | Task | Captain view | Player interaction |
|---|---|---|---|
| `task01` | Left/right orientation | Coordinates hidden binary sequence | Tilt phone left/right; left=`0`, right=`1` |
| `task02` | Campus GPS letters | Five hints and discovered letters | Travel to geofences and reveal letters |
| `task03` | Pose relay | Three poses and live completion | Camera pose verification |
| `task04` | Sound relay | Ordered sound targets without mapping | Produce held sound levels |
| `task05` | Response-time relay | Three target times and scores | Blind precision stopwatch |
| `task06` | Morse word relay | Target word, Morse, and progress | Tap dot/hold dash on blank screen |

Do not reorder, merge, or silently redefine tasks. If a task changes, update `ARCHITECTURE.md`, `BUILD.md`, and `PROMPT.md` together.

## 4. Security rules for agents

Before changing code:

1. Inspect the existing repository, Firebase initialization, authentication, routes, models, and level lifecycle.
2. Reuse existing services and components.
3. Do not create parallel authentication, team, routing, or progression systems.
4. Do not expose private task configuration in public client documents.
5. Do not store secrets, service-account keys, or production credentials in the repository.
6. Do not use client time for ranking, task completion, or timeout validation.
7. Do not trust a Flutter GPS coordinate, submitted letter, submitted Morse result, or player ID without server validation.
8. Use idempotency keys for submissions that can be retried after network failure.
9. Use transactions for team joining, duplicate discovery protection, task completion, and completion ranking.
10. Preserve unrelated user changes in a dirty worktree.

## 5. Role visibility

### Captain may see

- Their team and all four member names.
- The current task and task progress.
- Task-specific captain instructions.
- Round 2 hints and legitimately discovered letters.
- Round 3 pose names/reference images and performer statuses.
- Round 4 ordered sound values, but not player-to-target mapping.
- Round 5 target times and executor results.
- Round 6 target word, accepted Morse sequence, and overall progress.

### Captain must not see

- Hidden correct/decoy classification before it is legitimately inferable.
- Other teams' data.
- Private player targets when the task intentionally hides them.
- Server-only validation metadata.

### Mobile player may see

- Their identity, team, role, current task, and authorized task controls.
- A result only after the server accepts the relevant action.
- Their own connection and synchronization state.

### Mobile player must not see

- The target word in Task 6.
- Other players' targets, assignments, or progress.
- Round 2's full location mapping or correct/decoy classification.
- Scores or rankings unless explicitly provided by the product owner.

## 6. Required implementation behavior

Every task must implement:

- A server-created task run.
- A public role-specific view.
- Private configuration protected from unauthorized clients.
- Server-side submission validation.
- Idempotent event handling.
- Real-time captain updates.
- Reconnect/resume behavior.
- Completion transaction.
- Server-time completion ranking.
- Tests for duplicate, concurrent, late, unauthorized, and disconnected events.

## 7. Agent workflow

For each change:

1. State the task and affected invariants.
2. Inspect the relevant existing code.
3. Make the smallest compatible change.
4. Add or update tests before declaring completion.
5. Run formatters, static checks, unit tests, integration tests, and build checks relevant to the change.
6. Review Firestore rules and server validation.
7. Verify mobile, captain, and reconnect states.
8. Report changed files, commands run, failures, and remaining risks.

Do not claim a feature is complete if it only works in a single browser tab or with a trusted client.

## 8. Definition of done

A feature is complete only when:

- The normal flow works for one team.
- Multiple teams can run the same task concurrently.
- The server rejects invalid and cross-team requests.
- Refresh and reconnect resume correctly.
- Completion is idempotent.
- Rank and points are assigned once.
- Firestore rules deny unauthorized access.
- The relevant automated tests pass.
- The documentation and prompt modules reflect the implementation.

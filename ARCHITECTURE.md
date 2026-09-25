# Team Challenge Platform — Architecture

## 1. System overview

```text
                    Firebase Auth (Google, @iiitkottayam.ac.in)
                         │
          ┌──────────────┴──────────────┐
          │                             │
   Player app (apps/mobile)     Captain website (apps/website)
   React + Vite, mobile web     React + Vite, laptop
          │   reads: Firestore listeners (rules-restricted)
          │   writes: HTTPS → trusted API (+ own presence heartbeat)
          └──────────────┬──────────────┘
                         │
          Trusted API (apps/api, Express + Firebase Admin SDK)
                         │  transactions
                    Firestore
```

The clients render authorized state and submit user actions. The trusted API decides identity, team membership, task validity, completion, scoring, and rank.

**Stack as built.** The original plan named Flutter Web, Next.js and Cloud Functions. The repository already had React/Vite apps and an Express + Admin SDK API, and the agent contract forbids parallel systems, so the platform is built on those: the player app is `apps/mobile`, the captain site is `apps/website`, and the trusted layer is `apps/api` (the same functions as §16, exposed as authenticated HTTPS routes). Game logic lives in one engine (`apps/api/src/game/engine.ts`) with one module per task (`apps/api/src/game/tasks/`). Dependency-free client code shared by both apps (types, API client, event sender, sensor detectors) is in `packages/shared`.

**Email domain.** The institute's domain is `iiitkottayam.ac.in` (three i's). It is configurable in the API (`ALLOWED_EMAIL_DOMAIN`) and clients (`VITE_ALLOWED_EMAIL_DOMAIN`) and hard-coded in `firebase/firestore.rules`.

## 2. Core entities

```text
Competition
 ├── Task definitions
 └── Teams
      ├── Captain
      ├── Three fixed players
      └── Six team task runs
```

One global task definition is shared by all teams. Each team has an independent task run for that definition.

## 3. Firestore collections

```text
/users/{uid}
/teamDirectory/{fourDigitCode}
/competitions/{competitionId}
/competitions/{competitionId}/taskDefinitions/{taskId}
/competitions/{competitionId}/teams/{teamId}
/competitions/{competitionId}/teams/{teamId}/members/{uid}
/competitions/{competitionId}/teams/{teamId}/taskRuns/{taskId}
/competitions/{competitionId}/teams/{teamId}/taskRuns/{taskId}/events/{eventId}
/competitions/{competitionId}/taskResults/{taskId}/completions/{teamId}
/competitions/{competitionId}/privateTaskConfig/{taskId}
```

Private task configuration may use subcollections. It must not be readable by ordinary clients.

Role-scoped documents added so that rules (which cannot filter fields) enforce §5 of the agent contract:

```text
/competitions/{cid}/teams/{teamId}/captain/summary                       captain only: totalScore, rank/points per task
/competitions/{cid}/teams/{teamId}/private/{taskId}                      server only: hidden targets, assignments, frozen config, per-member sequence watermarks
/competitions/{cid}/teams/{teamId}/taskRuns/{taskId}/views/captain       captain only: progress, captain-visible task data, rank, points, activity log
/competitions/{cid}/teams/{teamId}/taskRuns/{taskId}/views/{uid}         that player only: their own results (e.g. letters they found)
/competitions/{cid}/taskResults/{taskId}                                 server only: ranking groups used for tie/dense ranking
```

The run document `taskRuns/{taskId}` is readable by every member and holds only `taskId, taskType, title, status, runId, startedAt, completedAt`.

| Path | Read | Write |
|---|---|---|
| `users/{uid}` | self | API |
| `teamDirectory/**` | nobody | API |
| `competitions/{cid}`, `taskDefinitions/*` | any signed-in competitor | API / setup script |
| `teams/{teamId}`, `members/*`, `taskRuns/{taskId}` | team members | API; a member may update only their own `isConnected` and `lastSeenAt` (= request time) |
| `captain/summary`, `views/captain`, task02 `assignedLocations`, `discoveries`, `wordAttempts` | captain | API |
| `views/{uid}` | that member | API |
| `private/**`, `events/**`, `privateTaskConfig/**`, `taskResults/**` | nobody | API |

## 4. Competition document

```json
{
  "name": "Tech Fest Championship",
  "status": "ACTIVE",
  "taskOrder": ["task01", "task02", "task03", "task04", "task05", "task06"],
  "scoringPolicy": {
    "pointsByRank": {"1": 100, "2": 90, "3": 80, "4": 70},
    "tieWindowMs": 1000,
    "tieMode": "DENSE"
  },
  "createdAt": "serverTimestamp",
  "startedAt": "serverTimestamp"
}
```

The scoring policy is shared by every task unless a task definition explicitly overrides it.

## 5. Team and membership model

### Team

```json
{
  "teamCode": "4827",
  "teamName": "Team Alpha",
  "captainUid": "uid_captain",
  "status": "LOBBY",
  "memberCount": 4,
  "requiredMembers": 4,
  "currentTaskId": null,
  "createdAt": "serverTimestamp",
  "lockedAt": null,
  "completedAt": null
}
```

The creator becomes captain. The server reserves the four-digit code transactionally in `/teamDirectory/{code}`. If the code exists, generation retries. The team's total score is kept in `captain/summary`, not on the team document, because players must not see scores.

### Member

```json
{
  "uid": "uid_player1",
  "displayName": "Player One",
  "role": "PLAYER",
  "slot": "player1",
  "joinedAt": "serverTimestamp",
  "isConnected": true,
  "lastSeenAt": "serverTimestamp"
}
```

Allowed fixed slots:

```text
captain, player1, player2, player3
```

There is no leave or remove operation after joining. If a member disconnects, the task waits for reconnection.

Presence: each client updates its own member document every 10 s (`lastSeenAt` = server time) and sets `isConnected: false` when the page is closed. A member whose heartbeat is older than 45 s counts as disconnected. While the captain is disconnected the API rejects every player input with `TEAM_PAUSED` and the players' screens show a pause banner. A disconnected player blocks only the part of the task that needs them (their step, target, pose or letter); the captain's monitor names who the team is waiting for.

## 6. Task lifecycle

```text
NOT_STARTED → ACTIVE → COMPLETED
```

For a team:

```text
Captain starts task01
        ↓
task01 completes
        ↓
Server awards rank and points
        ↓
task02 starts automatically
        ↓
...
        ↓
task06 completes
        ↓
Competition complete
```

The task run contains:

```json
{
  "taskId": "task02",
  "taskType": "GPS_LETTER",
  "status": "ACTIVE",
  "startedAt": "serverTimestamp",
  "completedAt": null,
  "completionRank": null,
  "pointsAwarded": 0,
  "currentProgress": 0
}
```

As built, progress, rank and points live in the captain view (`views/captain`), and the run document additionally carries a random `runId`. Every task input is `POST /api/tasks/{taskId}/{action}` with `{ runId, clientEventId, clientSeq, payload }`:

1. Identity comes from the ID token; team, role and slot from the stored membership.
2. The team must be `IN_PROGRESS` with `currentTaskId == taskId`, and `runId` must match the active run — otherwise `TASK_NOT_CURRENT` / `STALE_RUN` (old-round events).
3. `events/{uid}_{clientEventId}` is the idempotency record: a repeat returns the original response with `duplicate: true` and applies nothing.
4. `clientSeq` must exceed the member's last accepted sequence (`STALE_EVENT`), so late or out-of-order deliveries cannot apply. The watermark is exposed in the caller's view so a new device resumes above it.
5. The task module validates the input against hidden state and returns the changes; the engine applies them, and if the final condition is met, completes and ranks in the same transaction.

## 7. Completion ranking

The trusted completion step runs inside the submission transaction. It reads and rewrites the per-task ranking document `taskResults/{taskId}`, so Firestore serializes completions of the same task across teams.

1. Validate that the task run has not already completed.
2. Validate the task's final condition.
3. Read the existing completion groups.
4. Compare server completion time with the configured tie window.
5. Assign the same rank and points to a tie group.
6. Use dense ranking for the next group.
7. Mark the team task run complete.
8. Add points to the team total exactly once.
9. Start the next task exactly once.

Example:

```text
Team A  12:00:00.200  rank 1  100 points
Team B  12:00:00.700  rank 1  100 points
Team C  12:00:03.000  rank 2   90 points
```

A tie group is anchored at its first completion: a later completion joins the latest group if it is within `tieWindowMs` of that group's first completion (inclusive), so ties do not chain indefinitely. Ranks past the end of `pointsByRank` earn 0 points.

The completion timestamp is created by the trusted backend. Client timestamps are analytics only.

## 7b. Final leaderboards

Two leaderboards are computed by the API from team documents and captain summaries (`apps/api/src/services/leaderboard.service.ts`):

- **Points:** total ranking points over the six tasks, highest first. Equal points are ranked by earlier finish.
- **First to finish:** teams that completed task06, ordered by the server time of that completion, with total time from the captain starting task01. Unfinished teams follow without a rank, ordered by tasks completed.

The product owner chose to show both at the end of the game. A team sees them (captain and players) only once it has completed all six tasks, and admins see them live in `/admin`. Before that, `GET /api/leaderboard` answers `403 LEADERBOARD_LOCKED`. The boards are served by the API, so the Firestore rules still keep every team's raw data private.

## 8. Task 1 — Orientation

Private configuration contains the expected sequence and player association. Each phone detects left/right and submits a direction event. The server accepts only the authenticated player's expected direction at the current sequence position.

```text
left  = 0
right = 1
```

Progress advances only on a valid current-step event. Duplicate accepted events are idempotent; wrong or stale events do not advance progress.

As built: the sequence length is configurable (default 6). Steps are assigned to players in a rotating shuffled order. The captain sees which player is up for the current step and the bits accepted so far, never the upcoming bits; wrong-player and wrong-direction attempts appear red in the captain's activity log. Players only see "sent" — never whether it counted. The phone reads `DeviceOrientationEvent.gamma` (phone held flat, screen up), requires a lean past 30° held for 0.7 s, and must return to within 12° of level before the next lock.

## 9. Task 2 — Campus GPS letters (Level 02)

### Configuration (admin, `/admin` → Level 02)

Ten global locations, each with an id, name, coordinates, geofence radius, letter, and the riddle (hint) the captain reads. There is no classification at this level, because correct/decoy is decided per team.

```json
{ "locationId": "L02", "name": "Basketball Court", "latitude": 9.7556, "longitude": 76.6496,
  "radiusMeters": 25, "letter": "R", "hint": "Ten feet up, a ring with no finger; bounce, jump, and shoot. Stand where the hoops hang." }
```

Each team gets an assignment: five of the ten location ids in the order the captain sees the riddles, the three correct ones, and the intended word. The correct letters must be exactly the word's letters; the admin's word fixes the order. `_default` applies to every team without its own assignment.

```json
{ "locationIds": ["L02", "L05", "L06", "L08", "L10"], "correctLocationIds": ["L02", "L06", "L08"], "word": "ROE" }
```

**How a team gets its assignment** (checked in this order when the team reaches Level 02):

1. **Its own assignment**, if the admin set one for that team in `/admin`.
2. **Random** (`assignmentMode: RANDOM`, the default). The server picks a word from the `words` list that the ten location letters can spell, choosing the least-used one so teams get different words until the list runs out. It then picks three locations spelling it, two random decoys from the other seven, and a random riddle order. Word usage is recorded in `privateTaskConfig/task02.usedWords` in the same transaction, so simultaneous teams still get different words. A reset clears it.
3. **`_default`** (`assignmentMode: MANUAL`): every team gets the same assignment.

A captain cannot start until the team's assignment is valid (in random mode: at least one word in the list can be spelled). The admin page shows per-team readiness and, once a team reaches Level 02, the word and locations it was given. The assignment is frozen into the run when Level 02 starts, so later edits affect only teams that have not reached it. Editing a riddle changes nothing else.

Task configuration (`task02` in `/admin`; defaults shown):

| Setting | Default | Meaning |
|---|---|---|
| `maxAccuracyMeters` | 40 | Readings less accurate than this never count |
| `confirmReadings` / `confirmWindowMs` | 2 / 60 s | Consecutive, newer readings inside the same geofence before a discovery counts |
| `maxPositionAgeMs` | 60 s | Live reading freshness (device fix time) |
| `maxOfflineAgeMs` | 10 min | Readings captured offline and sent on reconnect; never older than the run |
| `nearbyRadiusMultiplier` / `showDistance` | 3 / true | Within 3× a radius the player sees "move closer, about N m" |
| `completionMode` | `CAPTAIN_SUBMITS_WORD` | Or `AUTO_ON_THREE_CORRECT`: the third correct discovery completes the level |
| `acceptAnyOrder` | false | Accept the word's letters in any order |
| `requireDiscoveries` | false | Accept the word only after the three correct locations were discovered |
| `revealClassificationOnDiscovery` | false | Show correct/decoy (and a correct-letter count) after discovery |
| `assignmentMode` | `RANDOM` | `RANDOM`: random word and five locations per team; `MANUAL`: the `_default` assignment |
| `words` | ~280 common three-letter words | Candidates for random words; only words the ten letters can spell are used |

### Data

```text
/privateTaskConfig/task02/locations/{locationId}          server only
/privateTaskConfig/task02/assignments/{teamId|_default}   server only
/teams/{teamId}/private/task02                            frozen assignment, word, per-player pending confirmations
/teams/{teamId}/taskRuns/task02/assignedLocations/{id}    captain: order + riddle only
/teams/{teamId}/taskRuns/task02/discoveries/{locationId}  captain: letter, riddle, who, when, status (id = location: one per team)
/teams/{teamId}/taskRuns/task02/wordAttempts/{attemptId}  captain
/teams/{teamId}/taskRuns/task02/views/{uid}               that player: letters they found
```

### Discovery

A player's phone sends `{ latitude, longitude, accuracy, positionTimestamp, queued }` every 4 s while online, requesting a fresh fix when the last one is older than 3 s. The server:

1. Checks identity, team, role, active run and sequence, like every task event.
2. Rejects stale, future, or pre-run readings, and readings less accurate than the threshold.
3. Finds the team's assigned geofence containing the reading. Unassigned locations are just "searching".
4. Returns the same letter to anyone at an already-discovered location (`byYou` tells the finder it was theirs), with no progress change.
5. Otherwise requires confirmation, then creates the discovery document in the transaction; concurrent visits to one location create one discovery.
6. Takes the letter from the frozen configuration: the client never submits a letter.

Offline, the phone keeps good readings in a persisted queue ("waiting to synchronize") and sends them on reconnect with `queued: true`. The server validates them like live readings, within the offline age limit.

The captain sees the five riddles, each letter as it is found (player and time), and progress. The captain submits the word (in the default mode) and it counts as soon as it matches, even if nobody visited the locations. With `requireDiscoveries` on, it counts only once all three correct locations were discovered, and an unearned guess is rejected exactly like a wrong one. Wrong words keep every discovery. Classification is never sent to the captain or players unless `revealClassificationOnDiscovery` is set.

## 10. Task 3 — Pose relay

The server assigns one captain and three pose performers, using the fixed team roles. The three poses are shuffled once for the task run.

Captain sees pose names, reference images, ownership, and statuses. Players see camera preview and no pose name, skeleton overlay, or verification feedback. MediaPipe verifies locally and submits only a completion result.

Verification requires visible upper-body landmarks and approximately 1.5 seconds of continuous valid pose, with a short jitter grace period. Completed players remain completed.

As built: to keep the target off the player's device, the phone does not know its assigned pose. It classifies whatever relay pose is held (exactly one person in frame; nose, shoulders, elbows and wrists visible; 1.5 s hold measured by frame timestamps with a 300 ms grace) and reports only `{ poseId, holdMs }`. The server marks the performer complete if it is their assigned pose. Wrong poses appear in the captain log. The pose set is `t_pose`, `both_hands_up`, `one_hand_up_one_down`. MediaPipe's WASM runtime is served from the app, and the model URL is configurable.

## 11. Task 4 — Sound relay

The server generates three unique sound targets and a required completion order. The captain sees only ordered values. Each performer sees a live approximate microphone reading and not their target.

The player must hold the target range for the configured duration. The server validates hit events using server timestamps and an ordering buffer. Out-of-order, duplicate, stale, and late events do not corrupt progress. Attempts are not permanently locked after a hit unless the task configuration requires it.

As built: the phone never has its target. It calibrates room noise for 3 s and then reports each *steady hold* — readings within ±2.5 dB of their running mean for the hold time, at least 6 dB above room noise — as `{ levelDb, holdMs, ageMs }`. The server accepts it only from the player whose target is next in order and within tolerance (default ±3 dB). Hits older than `maxEventAgeMs` (device-relative, default 4 s) are late, and the per-player sequence watermark rejects out-of-order delivery. Simultaneous attempts serialize in the transaction. Rejected hits are silent unless `revealIncorrect` is configured. Defaults: range 50–85 dB, separation ≥ 8 dB, hold 1.5 s.

## 12. Task 5 — Response-time relay

The captain sees three target times. Players use a blind stopwatch.

- Start records `performance.now()` locally.
- Stop records `performance.now()` locally.
- Actual duration is calculated from the two values.
- The client submits the measured result.
- The server stores attempts and applies the configured score/penalty policy.
- Maximum attempts and retry penalties are task configuration.
- Task completion and rank remain server-authoritative.

As built: defaults are targets 3–15 s (distinct, 100 ms steps), 3 attempts, attempt score `max(0, 100 − 20 × error_seconds − 10 × retries_before_it)`. A player locks in their latest attempt or is locked automatically after the last attempt. The task completes when all three are locked, and the captain sees target, actual, error, attempts, retries and final scores. The precision score is displayed to the captain; the task's ranking points come from completion time like every other task.

## 13. Task 6 — Morse word relay

The target is exactly a three-letter word. Completion requires all three letter positions.

The server stores a private position assignment:

```json
{
  "positions": [
    {"index": 0, "assignedPlayerUid": "uid_player2", "letter": "C", "morse": "-.-."},
    {"index": 1, "assignedPlayerUid": "uid_player1", "letter": "A", "morse": ".-"},
    {"index": 2, "assignedPlayerUid": "uid_player3", "letter": "T", "morse": "-"}
  ]
}
```

Players see a blank screen. A single tap creates a dot. Press-and-hold creates a dash. Vibration is local and optional. The player presses **Submit Letter** when the Morse sequence is complete.

The captain sees:

- Target word.
- Current position.
- Overall progress.
- Submitted Morse sequence.
- Red/green result.

The server checks the current position, player identity, and Morse value. A wrong player or wrong Morse attempt is rejected without resetting the task. Accepted positions advance the task. Retries are unlimited.

As built: a press shorter than 250 ms is a dot, longer is a dash; vibration is 40 ms / 160 ms when supported. The word is drawn from a configurable list of three-letter words. The captain sees the Morse for each letter and a reference chart.

## 14. Realtime and recovery

Clients listen only to their authorized competition/team/task paths. On reload:

1. Firebase Auth restores the identity.
2. The app loads the user profile.
3. The app loads the fixed team and slot.
4. The app loads `currentTaskId`.
5. The app loads the task-specific public view.
6. Listeners reattach.
7. Local sensors/camera/GPS restart only when required.

The server rejects events whose `competitionId`, `teamId`, `taskId`, or task-run status no longer matches the current state.

## 15. Security model

Firestore rules should enforce coarse authorization. Trusted functions enforce game logic.

### Client may write

- Own display-name update before the team locks.
- Own presence heartbeat.
- Join request through a callable function.
- Task input through a callable function.

### Client may not write

- Team membership or captain fields.
- Slots or role assignments.
- Hidden configuration.
- Target values.
- Correct/decoy classification.
- Task status.
- Progress counters.
- Completion timestamp.
- Rank or points.

## 16. Trusted functions (as built: HTTPS routes in apps/api)

| Function | Route | Caller |
|---|---|---|
| sign-in / load-or-create profile | `POST /api/auth/google`, `GET /api/auth/me` | anyone with an institutional token |
| display name (before lock) | `PATCH /api/auth/me` | self |
| createTeam | `POST /api/teams/create` | user without a team |
| joinTeam | `POST /api/teams/join` | user without a team |
| startFirstTask | `POST /api/teams/start` | captain |
| submitTask01Orientation | `POST /api/tasks/task01/orient` | player |
| submitTask02GpsDiscovery | `POST /api/tasks/task02/gps` | player |
| submitTask02Word | `POST /api/tasks/task02/word` | captain |
| submitTask03PoseCompletion | `POST /api/tasks/task03/pose` | player |
| submitTask04SoundHit | `POST /api/tasks/task04/hit` | player |
| submitTask05TimerResult / lockTask05Score | `POST /api/tasks/task05/attempt`, `/lock` | player |
| submitTask06Morse | `POST /api/tasks/task06/morse` | player |
| completeTaskAndRank | inside every submission transaction | — |
| setPresence | direct Firestore write to own member doc (rules-restricted) | member |
| final leaderboards | `GET /api/leaderboard` | a member of a team that has completed all six tasks; admins always |
| admin | `GET /api/admin/overview`, `PUT /api/admin/competition`, `/locations`, `/tasks/{taskId}/config` | `ADMIN_EMAILS` |

All routes authenticate the caller, derive identity from the auth token, verify team membership, verify task state, and use idempotency keys where retries are possible. Game transactions retry up to 20 times under contention; a request that still loses returns `503 BUSY`, which clients retry with the same idempotency key.

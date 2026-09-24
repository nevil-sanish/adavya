# Adavya — Team Challenge Platform

A real-time, multi-team campus competition. Each team has one captain (laptop) and three players (phones). Teams play six tasks in a fixed order, and every team is ranked on each task by server completion time.

```text
apps/
  website/         Captain website + /admin operator console (React, Vite)
  mobile/          Player app for Android/iOS browsers (React, Vite, MediaPipe)
  api/             Trusted game API: auth, teams, task engine, ranking (Express, Firebase Admin)
packages/
  shared/          Client types, API client, event sender, sensor detectors (dependency-free)
  ui/              Reserved for shared React components
firebase/          Firestore rules, indexes, rules tests, emulator tooling
docs/OPERATIONS.md Deployment, event-day guide, reset, rollback, test accounts, limitations
```

| Task | Captain sees | Players do |
|---|---|---|
| task01 Orientation | Who is up, accepted bits | Tilt left (0) / right (1) |
| task02 GPS letters | Five hints, discovered letters, submits the word | Walk into geofences to reveal letters |
| task03 Pose relay | Each player's pose and status | Hold the pose in front of the camera |
| task04 Sound relay | Ordered loudness targets | Hold a steady sound |
| task05 Response time | Targets, attempts, scores | Blind stopwatch |
| task06 Morse relay | Word, submissions (red/green) | Tap dots and dashes |

Specifications: [AGENT.md](AGENT.md) (contract), [ARCHITECTURE.md](ARCHITECTURE.md) (design as built), [BUILD.md](BUILD.md) (plan, commands, acceptance), [PROMPT.md](PROMPT.md) (work modules).

## Development

Node.js 22+ and Java 21+ (Firestore emulator).

```sh
npm run setup      # install every app
npm test           # shared + Firestore rules + API/engine tests (starts the emulator)
npm run build      # build all apps
```

To run everything locally against the emulators, see [BUILD.md §4](BUILD.md#4-local-development-commands). The dev servers are:

```sh
npm run emulators    # Auth :9099, Firestore :8080, UI :4000
npm run dev:api      # http://localhost:5000
npm run dev:website  # http://localhost:5173  (captain, /admin)
npm run dev:mobile   # http://localhost:5174  (players)
```

Each app has a `.env.example`. Server secrets belong only in `apps/api/.env`, which is gitignored.

## Mobile and sensors

Target iOS Safari and Android Chrome over HTTPS: camera, microphone, GPS and motion sensors need a secure context, so an HTTP LAN address on a phone does not work like localhost. Permissions are requested from a tap, denial is explained on screen, and streams and listeners are released when a task ends. Verify every sensor on physical phones before the event (see `docs/OPERATIONS.md`).

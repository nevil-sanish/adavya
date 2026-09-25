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

Deployment: Render Blueprint in `render.yaml` — see [docs/OPERATIONS.md](docs/OPERATIONS.md#1-deploying-on-render-chosen-host).

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

All settings live in one file at the repository root: copy `.env.example` to `.env` (gitignored) and fill it in. The API and scripts read every key; the browser apps receive only `VITE_*` keys, so server secrets never reach a build. `.env.production` (committed, no secrets) holds the production build switches.

## Testing on a phone

Phones must use HTTPS for GPS, camera, microphone and motion sensors.

1. Put the phone on the same Wi-Fi as the laptop.
2. Run the API (`npm run dev:api`) and the player app in phone mode: `npm run dev:phone`. Vite prints a `Network: https://<laptop-ip>:5174` address. `/api` is proxied to the local API, so the phone needs only that address.
3. One time: in Firebase console → Authentication → Settings → Authorized domains, add the laptop IP (e.g. `172.16.0.210`) so Google sign-in works there.
4. Open the address on the phone. The certificate is self-signed: tap Advanced → Proceed (Chrome) or Show Details → visit this website (Safari).
5. The captain uses the website on the laptop as usual (`npm run dev:website`).

If the laptop's IP changes, repeat step 3 with the new one. For the event, deploy over real HTTPS instead (docs/OPERATIONS.md).

## Mobile and sensors

Target iOS Safari and Android Chrome over HTTPS: camera, microphone, GPS and motion sensors need a secure context, so an HTTP LAN address on a phone does not work like localhost. Permissions are requested from a tap, denial is explained on screen, and streams and listeners are released when a task ends. Verify every sensor on physical phones before the event (see `docs/OPERATIONS.md`).

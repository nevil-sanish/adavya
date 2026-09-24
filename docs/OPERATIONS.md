# Operations: deployment, event day, rollback

For architecture see [ARCHITECTURE.md](../ARCHITECTURE.md); for local development see [BUILD.md](../BUILD.md).

## 1. Components to deploy

| Component | Source | Host | Notes |
|---|---|---|---|
| Firestore rules and indexes | `firebase/firestore.rules`, `firebase/firestore.indexes.json` | Firebase | `npm run deploy:rules --prefix firebase` |
| Trusted API | `apps/api` (`npm run build`, `npm start`) | Any HTTPS Node 22 host (Cloud Run, Render, a VM behind TLS) | Needs a service account for the project |
| Captain website | `apps/website/dist` | Firebase Hosting target `captain` (or any static host with SPA fallback) | |
| Player app | `apps/mobile/dist` | Firebase Hosting target `player` | Must be HTTPS: camera, microphone, GPS and motion need a secure context |

Hosting targets are declared in `firebase.json`. Map them once: `firebase target:apply hosting captain <site-id>` and `firebase target:apply hosting player <site-id>`.

## 2. Deployment checklist

Firebase console:

- [ ] Authentication → Sign-in method → **Google** enabled.
- [ ] Authentication → Settings → Authorized domains include the captain and player hosting domains.
- [ ] Firestore created (note the region) in production mode.
- [ ] A service account for the API with the *Cloud Datastore User* and *Firebase Authentication Viewer* roles (or Firebase Admin SDK Administrator Service Agent). Store its key in the API host's secret store, never in git.

Configuration:

- [ ] `apps/api` env: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (or ADC on Google Cloud), `COMPETITION_ID`, `ADMIN_EMAILS`, `ALLOWED_EMAIL_DOMAIN`, `FRONTEND_URL`, `MOBILE_URL` (exact HTTPS origins for CORS), `NODE_ENV=production`.
- [ ] `apps/website/.env` and `apps/mobile/.env`: `VITE_FIREBASE_*`, `VITE_API_URL` (HTTPS), `VITE_ALLOWED_EMAIL_DOMAIN`, `VITE_PLAYER_APP_URL` (website), `VITE_USE_EMULATORS=false`.
- [ ] If the domain differs from `iiitkottayam.ac.in`, also edit `signedIn()` in `firebase/firestore.rules`.
- [ ] Optional: host the pose model (`pose_landmarker_lite.task`) yourself and set `VITE_POSE_MODEL_URL`, so event Wi-Fi does not depend on Google's CDN.

Release:

- [ ] `npm run setup && npm test && npm run build` passes on the release commit.
- [ ] `npm run deploy:rules --prefix firebase`.
- [ ] Deploy the API; `GET /api/health` returns `ok`.
- [ ] `firebase deploy --only hosting --config firebase.json` (captain and player).
- [ ] `cd apps/api && npm run setup -- --name "<Event name>" --locations <locations.json> --assignment <assignment.json>`. This creates the competition in `DRAFT` with task definitions, the ten Level 02 locations and riddles, and the default assignment. `config/*.sample.json` are templates: the coordinates are placeholders.
- [ ] Sign in to the captain site with an admin account and open `/admin`: check locations, task configs and the scoring policy.
- [ ] Record the real coordinates of each location: stand there with `/admin` open on a phone and press **Use my position**, then save.
- [ ] Walk the ten locations with a phone to confirm each geofence triggers (radius vs. real GPS accuracy).
- [ ] In `/admin` → Level 02 team assignments, set the default (and any per-team) assignment: five locations in riddle order, three correct, the word. Every team must show **ready** before its captain can start.
- [ ] Set the competition **ACTIVE** in `/admin` when captains may start.

## 3. Event operator guide

Before doors open:

1. `/admin` shows status `ACTIVE`, 10 valid locations, every team **ready** under Level 02 team assignments, and the expected task configs.
2. Captains sign in on the captain site from a laptop and create their team. They get a four-digit code.
3. Players sign in to the player app on their phones and join with the code. Exactly three players per team; slots are permanent.
4. The captain presses **Start Task 1** once all four members show green. Later tasks start automatically.

During the event:

- `/admin` refreshes every 10 s: team status, current task, score, members' last-seen times, and the completion ranking for each task.
- A member with a grey dot has been silent for over 45 s. If it is the captain, that team's players are paused until the captain's laptop is back online. Nothing is lost.
- Phones must stay on the player page during a task. The screen may sleep between tasks; reopening the app resumes in place.
- Permission problems (camera, microphone, motion, location) are shown on the phone with instructions. On iOS, motion needs the **Enable motion sensor** tap; in Safari settings, the site's camera, microphone and location must be allowed.

Changing configuration mid-event: task configs and locations apply only to runs that start after saving. A run keeps the configuration it started with.

## 4. Reset and reconfiguration

Run from `apps/api` with production credentials in `.env`:

```bash
npm run reset -- --confirm <competitionId> --keep-teams   # clear all progress, teams return to the lobby
npm run reset -- --confirm <competitionId>                # also delete teams, codes and memberships
```

Configuration (locations, task configs, scoring policy) is never deleted by reset. There is no per-team reset: ranking is shared across teams, so resetting one team would shift others' ranks.

Back up before a reset: `gcloud firestore export gs://<bucket>/backups/$(date +%F-%H%M)`. Scheduled exports can be enabled in the Firebase console.

## 5. Rollback

- **Clients**: `firebase hosting:clone <site>:<previous-version> <site>:live`, or redeploy the previous commit's `dist`.
- **API**: redeploy the previous image or commit. The Firestore schema is additive, so the previous API reads current data.
- **Rules**: `git checkout <previous> -- firebase/firestore.rules && npm run deploy:rules --prefix firebase`. The console also keeps rule history.
- **Data**: restore the pre-event export with `gcloud firestore import`. This replaces documents at the same paths.

## 6. Test accounts

Real Google accounts on the institute domain are required in production. For rehearsals:

1. Start the emulators (`npm run emulators`). The API, captain site and player app run with the emulator variables from BUILD.md §4.
2. **Automated**: `cd apps/api && npm run rehearsal -- --teams 4` creates verified test accounts (`t1captain.xxxx@…`, `t1p1.xxxx@…`) in the Auth emulator. It plays all six tasks for every team over HTTP, including duplicate, wrong-player and cross-team events, then verifies ranking, ties, dense ranks, score totals and isolation.
3. **Manual**: in the emulated sign-in popup choose *Add new account*, enter any `name@iiitkottayam.ac.in` address, and continue. Use a separate browser profile or private window per person, because each keeps its own session. In development builds the orientation task shows **Dev: left/right** buttons for desktops without motion sensors; production builds do not.
4. The emulator UI (http://localhost:4000) shows every document, including hidden task state, for debugging.

Never point the rehearsal at production: it refuses to run unless both emulator variables are set.

## 7. Monitoring and logs

- The API logs every request with a timestamp to stdout. Collect it with the host's log service.
- Useful signals: `503 BUSY` responses (contention), `TEAM_PAUSED` (captain offline), and 5xx rates.
- Firestore usage and rule denials are in the Firebase console (Firestore → Usage, Monitor rules).

## 8. Known limitations

- **Sensors vary by device.** Tilt uses `DeviceOrientationEvent.gamma` with the phone flat. Sound levels are approximate: phones differ in microphone gain, so targets are relative to one fixed offset, and the ±3 dB default tolerance may need widening after the on-site rehearsal. Pose thresholds were tuned on synthetic landmarks and should be checked with real players and lighting.
- **Client-measured values are trusted.** Stopwatch durations, pose results and sound levels are measured on the phone and can be forged by someone who scripts the API with their own token. The server enforces identity, order, timing windows, idempotency and bounds, but cannot verify a physical measurement. GPS coordinates are likewise device-reported; accuracy and freshness are checked.
- **Presence is heartbeat-based** (Firestore has no disconnect hook). A closed tab pauses immediately; a crashed browser or lost network pauses after 45 s. Mobile browsers suspend background tabs, so a player who switches apps shows as offline. Only the captain's absence blocks input.
- **Physical-device rehearsal pending.** Everything was verified in tests, the emulator rehearsal and headless Chromium with emulated GPS and fake camera/microphone. Android Chrome, iOS Safari and real campus GPS must be rehearsed on site.
- **Superseded prototype.** The earlier prototype rounds (`/api/rounds`, `rounds/*`, `task4Sessions`, the 3-member onboarding) were replaced. They trusted client-supplied identity, which violated the agent contract. Their data is not migrated.
- **Precision score (task05)** is shown to the captain but does not change ranking points; ranking is by completion time for every task, as specified.

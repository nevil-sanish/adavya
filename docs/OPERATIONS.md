# Operations: deployment, event day, rollback

For architecture see [ARCHITECTURE.md](../ARCHITECTURE.md); for local development see [BUILD.md](../BUILD.md).

## 1. Deploying on Render (chosen host)

`render.yaml` is a Render Blueprint for the whole platform:

| Service | What | URL |
|---|---|---|
| `adavya-api` | Trusted API, Docker (`apps/api/Dockerfile`), Singapore | https://adavya-api.onrender.com |
| `adavya-captain` | Captain website + `/admin`, static | https://adavya-captain.onrender.com |
| `adavya-player` | Player app, static | https://adavya-player.onrender.com |

Both sites rewrite `/api/*` to the API, so browsers only talk to their own HTTPS origin.

First deployment:

1. Push the repository to GitHub or GitLab.
2. Render dashboard → **New → Blueprint** → pick the repository. Render reads `render.yaml`.
3. When asked for the secret values of `adavya-api`:
   - `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`: Firebase console → Project settings → Service accounts → **Generate new private key**, then copy `client_email` and `private_key` from the JSON. Paste the key with its real line breaks or with `\n`; both work. Do not commit the JSON.
   - `ADMIN_EMAILS`: your institute email(s), comma-separated.
4. **Apply**. Wait until all three services are live; https://adavya-api.onrender.com/api/health returns `ok`.
5. If Render gave a service a different URL (name already taken), edit the two `/api/*` destinations and `VITE_PLAYER_APP_URL` in `render.yaml`, push, and let it redeploy.
6. Firebase console → Authentication → Settings → **Authorized domains** → add `adavya-captain.onrender.com` and `adavya-player.onrender.com`.
7. Deploy the Firestore rules (Render does not host them): `npm --prefix firebase exec -- firebase login`, then `npm run deploy:rules`.

After that, every push redeploys only the services whose files changed (`buildFilter`).

**Plan.** The Blueprint starts the API on the free plan, which sleeps after 15 idle minutes; the next request then waits about a minute. Switch `adavya-api` to a paid instance before rehearsals and the event. The static sites are free.

## 1b. Alternative: Firebase Hosting + Cloud Run

| Component | Source | Host | Deploy |
|---|---|---|---|
| Firestore rules and indexes | `firebase/` | Firebase | `npm run deploy:rules` |
| Trusted API | `apps/api` (Dockerfile) | Cloud Run `adavya-api`, region `asia-south1` | `npm run deploy:api` |
| Captain website | `apps/website/dist` | Firebase Hosting site `adavya-f796d` (https://adavya-f796d.web.app) | `npm run deploy:web` |
| Player app | `apps/mobile/dist` | Firebase Hosting site `adavya-player` (https://adavya-player.web.app) | `npm run deploy:web` |

Both Hosting sites forward `/api/**` to the Cloud Run service (`firebase.json`), so the clients call the API on their own origin: no CORS and no API URL in the builds (`.env.production`). Everything is HTTPS, which the phone sensors need. `*.web.app` domains are already authorized for Firebase Auth.

First deployment (from the repo root):

```sh
gcloud auth login && gcloud config set project adavya-f796d      # Blaze plan required for Cloud Run
npm --prefix firebase exec -- firebase login
npm --prefix firebase exec -- firebase hosting:sites:create adavya-player --project adavya-f796d
npm run deploy               # rules → API (Cloud Build from apps/api/Dockerfile) → both sites
gcloud run services update adavya-api --region asia-south1 --update-env-vars ADMIN_EMAILS=you@iiitkottayam.ac.in
```

Later deployments: `npm run deploy:web` (clients only) or `npm run deploy:api` (API only). On Cloud Run the API uses the service's default identity (Application Default Credentials); do not upload a key.

**Other hosts.** The two clients are static SPAs and can be served anywhere with a rewrite of `/api/*` to the API and an SPA fallback to `/index.html`. Add each domain to Firebase Authentication → Authorized domains. The API is a long-running Express server with Admin SDK transactions; keep it on a container host.

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
- [ ] `npm run deploy` (rules, API, both sites); https://adavya-f796d.web.app/api/health returns `ok`.
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

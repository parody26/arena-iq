# ArenaIQ — Stadium Operations & Fan Experience Command Hub

**Challenge:** [Challenge 4] Smart Stadiums & Tournament Operations
**Event Context:** FIFA World Cup 2026™

## Vertical

ArenaIQ addresses **Smart Stadiums & Tournament Operations** — the real-time coordination challenge faced by large tournament venues during live matches: monitoring crowd flow, gate throughput, sustainability metrics, and safety incidents simultaneously, while giving both operations staff and fans instant, relevant answers without waiting on a human dispatcher.

## Approach and Logic

Large stadium events generate a constant stream of operational signals — queue lengths, crowd density, energy/water usage, waste levels — alongside unpredictable incidents (spills, elevator failures, bottlenecks) that need a fast, correct response. Two groups need very different things from this data at the same moment:

- **Operations staff** need a live, unified view of telemetry and incidents, with actionable dispatch recommendations, so they can act in seconds rather than minutes.
- **Fans** need simple, immediate answers (where's the nearest accessible restroom, how long is the line, where do I catch the light rail) without hunting through signage or apps.

ArenaIQ's logic is built around a **single shared simulation state** on the server that:
1. Continuously updates telemetry (crowd density, gate throughput, queue times, energy/water/waste metrics) on a tick loop, adjusted based on the current match phase (Pre-match, Kick-off, Half-time, Second-half, Post-match).
2. Randomly generates realistic operational incidents (spills, elevator faults, crowd bottlenecks, waste overflow) with a severity level and a recommended response.
3. Feeds that same live state to two different AI-driven chat personas — one tuned for staff (dispatch-focused, analytical) and one tuned for fans (friendly, wayfinding-focused) — so both audiences get context-aware answers grounded in what's actually happening in the stadium right now, not generic responses.

## How the Solution Works

**Architecture:** Node.js + Express backend, vanilla HTML/CSS/JS frontend, Server-Sent Events (SSE) for live updates, Google Gemini API for generative AI responses.

- **Live telemetry simulation** (`server.js`): A server-side tick loop adjusts crowd density, gate throughput, queue wait times, energy usage (solar/grid/battery), water flow, and waste bin capacity based on the simulated match state and a configurable simulation speed (1x/5x/10x), mimicking how real IoT sensor data would evolve over a matchday.

- **Live data stream** (`/api/live-data`): The frontend subscribes via Server-Sent Events, so the dashboard, incident feed, and charts update in real time without polling.

- **Incident engine**: Incidents are generated periodically with realistic templates (waste overflow, spills, accessibility equipment faults, crowd bottlenecks) tied to actual stadium zones. Each incident gets an initial rule-based recommendation instantly, then — if a Gemini API key is configured — a more detailed, context-aware recommendation is generated asynchronously in the background and pushed to connected clients once ready.

- **AI Fan Assistant & Staff Advisor** (`/api/chat`): A single chat endpoint serves two distinct system prompts depending on the caller's role:
  - *Fan Concierge* — multilingual, welcoming, focused on wayfinding, accessibility, food, and sustainability options, grounded in a stadium knowledge base (gates, facilities, transport) and live queue times.
  - *Operations Advisor* — analytical and dispatch-oriented, grounded in current telemetry, active incidents, and available volunteer/staff units, to suggest concrete response actions.

- **Graceful AI fallback**: If no `GEMINI_API_KEY` is configured (or the Gemini call fails for any reason), the app automatically falls back to a built-in local NLP engine (`handleLocalNLP`) that pattern-matches on keywords to still deliver useful, role-appropriate answers — so the app remains fully functional even without external AI access.

- **Dashboard UI** (`public/index.html`, `styles.css`, `app.js`): A multi-tab command hub covering the Main Dashboard, Stadium Wayfinder, Eco & Sustainability metrics, AI Fan Assistant, and Staff Command view, styled as a dark, glassmorphic real-time operations console with live charts (Chart.js) and an event stream feed.

## Assumptions

- Telemetry and incident data are **simulated**, not pulled from real IoT sensors or a live venue — this reflects the constraints of a hackathon build, but the data model, update cadence, and incident/response structure are designed to mirror what real stadium sensor and ticketing systems would produce.
- The demo venue (MetLife Stadium, gates, facilities, transport options) is modeled on publicly available information about the venue and reasonable assumptions about FIFA World Cup 2026 operations, not official tournament data.
- The app is designed to run correctly **with or without** a `GEMINI_API_KEY` present, so reviewers without an API key can still evaluate full functionality via the local simulation fallback; providing a real key unlocks live Gemini-generated responses for both the incident recommendations and the chat assistants.

  **Confirmed behavior without a key:** On startup, `server.js` checks `process.env.GEMINI_API_KEY`. If it's absent, the Gemini client (`genAI`) is simply never initialized (stays `null`) and the server logs `"No GEMINI_API_KEY found. Operating in local simulation mode."` — it does not throw or exit. Every code path that would call Gemini (`/api/chat`, incident recommendation generation) checks `if (genAI)` first and falls back to a fully self-contained local response engine (`handleLocalNLP`) when it's not available. This fallback covers both the Operator Advisor and Fan Concierge personas — incidents, crowd/gate status, volunteer dispatch, sustainability metrics, accessibility, food, transit, and medical queries — with realistic, data-grounded responses pulled from the live simulation state, not generic placeholder text. So the app is fully demoable end-to-end with zero external API dependency; the key only upgrades response quality, it isn't required for the app to function.

- Match state, simulation speed, and live-stream connection are operator-controlled via the Simulation Settings panel, standing in for what would otherwise be automated inputs from real match-day systems (kickoff triggers, turnstile scanners, etc.).

## Challenges Faced

- **Static file path mismatch:** The Express server initially pointed `express.static()` at a `public` folder that didn't match where the front-end files were located, causing the deployed page to load with no CSS/JS applied (unstyled HTML only). Fixed by aligning the static file serving path with the actual `public/` folder structure containing `index.html`, `styles.css`, and `app.js`.
- **Layout bug in the live event stream panel:** A hardcoded `max-height` on the live event stream container capped its content well below the height of its parent card, leaving visible empty space in the "Live Arena & Match Stream" box. Fixed by letting the container flex to fill its parent's full height instead of a fixed pixel cap.
- **Accidental `.env` exposure in Git history:** `node_modules` and `.env` were committed to the public GitHub repo before `.gitignore` was added, briefly exposing the API key publicly. Resolved by untracking both with `git rm --cached`, committing the removal, and rotating the exposed key.
- **Render deployment connectivity issues:** The Render dashboard was unreachable from the development network (`ERR_CONNECTION_TIMED_OUT`), unrelated to any code issue — confirmed via Render's public status page showing all systems operational at the time. Deployment was moved to Railway as a result.
- **Railway build instability:** Two separate Railway build failures occurred — a transient build-daemon error unrelated to the app (`context canceled` during an unrelated apt package install step), and a `secret GEMINI_API_KEY not found` error caused by the environment variable not being correctly scoped/attached to the deploying service. Resolved by re-adding the variable directly to the service's Variables tab and redeploying.

## Tech Stack

- **Backend:** Node.js, Express
- **AI:** Google Gemini API (`gemini-1.5-flash`) via `@google/generative-ai`, with local NLP fallback
- **Frontend:** HTML, CSS, vanilla JavaScript, Chart.js
- **Real-time updates:** Server-Sent Events (SSE)

## Running Locally

```bash
npm install
npm start
```
Then open `http://localhost:3000`. Add a `GEMINI_API_KEY` to a `.env` file to enable live Gemini AI responses (optional — the app runs fully without it).

## Deploying / Running Globally

**Live Deployment:** `http://arena-iq-production-3c24.up.railway.app`

The app is a standard Express server and can be deployed on any Node-compatible hosting platform (Railway, Render, Fly.io, Glitch, etc.). No external database is required — telemetry, incidents, and volunteer state are snapshotted to a local `data/simulation-state.json` file every 10 seconds and restored on startup, so a server restart or redeploy resumes the simulation instead of resetting to defaults. This is intentionally lightweight (no DB dependency) since the file only needs to survive process restarts on the same host, not act as a durable system of record. If the filesystem is read-only or the write fails for any reason, the app logs a warning and falls back to pure in-memory behavior rather than crashing.

**General deployment steps (applies to most platforms):**
1. Push the repository to a public GitHub repo (exclude `node_modules` and `.env` via `.gitignore`).
2. Connect the platform to the GitHub repo and let it install dependencies automatically (`npm install`).
3. Set the **Start Command** to `npm start` (runs `node server.js`).
4. Add an environment variable `GEMINI_API_KEY` with a valid Gemini API key if live AI responses are desired (optional — see Assumptions above).
5. The server automatically binds to the platform-provided port via `process.env.PORT` (`server.js` uses `process.env.PORT || 3000`), so no manual port configuration is needed.
6. Once deployed, the platform will provide a public URL (e.g. `https://arena-iq-production.up.railway.app`) serving the app directly — no additional routing or build step is required since the frontend is plain HTML/CSS/JS served statically from `public/`.

**Notes for reviewers:**
- The Staff Command / Operations Advisor portal is behind a demo login. Password: `fifa2026`. (Previously this was hinted directly on the login screen; it's been moved here so it isn't publicly visible on the live deployed page.)
- Free-tier hosting (e.g. Render's free plan) may spin down after inactivity and take 30–60 seconds to respond on the first request after idling — this is expected platform behavior, not an application bug.
- If the deployed link ever shows an unstyled page, it typically means static assets aren't being served from the correct folder on that platform — verify the **Start Command** is `npm start` and that the build didn't strip the `public/` directory.

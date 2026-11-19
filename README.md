# CN Workbench

Interactive, per-student parameterised classroom assessments for **21CSC302J Computer Networks** (SRMIST).
Teachers open a timed room. Students join with a room code and their register number, then solve hands-on questions in full screen.
Every student gets different values, and answers are graded on the server. Time, moves, wrong checks, and integrity events feed a transparent score that the teacher can tune and export.

Specs live in [docs/](docs/). See [Build decisions](#build-decisions-v1-demo) for how this build differs from them.

## What's in the app

| Area | Route | Notes |
|---|---|---|
| Student join | `/` | Room code + register number + name. The QR on the projector pre-fills the code. |
| Student quiz | `/play/[code]` | Lobby → full-screen workbench → summary. Work is saved locally and survives refreshes and network drops. |
| Teacher console | `/teacher` | Not linked from the student page. **Press and hold the logo for about 1 second** (mouse, touch, or hold Enter), or bookmark `/teacher`. Lists rooms created on this browser (the host key stays in the browser). |
| New room | `/teacher/new` | Pick topics per unit, set the Easy/Medium/Hard mix and the session window (1.25×, 1.5× the estimate, or custom), late policy, and feedback level. |
| Live room | `/teacher/room/[code]` | Start, +5 min, End. Live roster with presence, performance leaderboard, integrity monitor, and event feed. |
| Results | same page, *Results and export* tab | Adjust judging criteria and every score recomputes instantly. Excuse events, review per student, see common mistakes, export **CSV / Excel / PDF**. |
| Projector | `/teacher/room/[code]/present` | Large room code, QR, timer, and joined count. |

### Question types (11 interactive templates)

| Unit | Topic | Interaction |
|---|---|---|
| 1 | Latency and delay | Build a latency budget, then pick the dominant component on a timeline |
| 1 | Twisted-pair cabling | Choose straight/crossover/rollover and crimp RJ-45 pins |
| 2 | Subnet masks | Drag the prefix boundary, flip host bits to get network and broadcast |
| 2 | VLSM planning | Size subnets, place blocks on an address bar, fill host ranges |
| 3 | IP forwarding | Route packets by longest-prefix match (unsorted table, drop case) |
| 3 | Link-state routing | Click Dijkstra's pick order, enter distances and next hops |
| 3 | Distance-vector routing | Apply a neighbour's RIP update (Forouzan's 3 rules, 16 = ∞) |
| 4 | CRC | Modulo-2 long division on a bit board, with error carried forward |
| 4 | Hamming code | Mark parity positions, encode, find the syndrome, correct |
| 5 | UDP and TCP headers | Brush hex bytes onto fields, decode, interpret |
| 5 | TCP connection | Build the segment ladder with SEQ/ACK (3-way open and close) |

There is deliberately no IOS command-line console: students already practise configuration in the Packet Tracer lab sessions.

## Run locally

```bash
npm install
npm run dev            # http://localhost:3000
```

Without Redis configured, rooms live in server memory. That is fine for one local process. The teacher dashboard shows a "Demo storage" tag in this mode.

Students on other devices can join over the same Wi‑Fi using your machine's LAN address (e.g. `http://192.168.1.20:3000`).

## Deploy on Vercel

1. Push this folder to a Git repository and **Import** it in Vercel. The framework (Next.js) is detected automatically.
2. In the project, open **Storage → Marketplace → Upstash Redis** and connect a database (the free tier is enough for a class). This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically. `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` also work.
3. Add an environment variable `QUIZ_SECRET` set to a long random string. It keys the per-student question seeds, so students can't predict each other's values. Keep it stable across deploys.
4. Deploy. Share the URL. The projector view shows the join address and a QR code.

Redis is required on Vercel because serverless instances do not share memory. All live updates use plain HTTPS polling (every 2.5–5 s), so the app works on SRMIST Wi‑Fi, home Wi‑Fi, or mobile data with no WebSocket requirements.

`.vercelignore` keeps `course_materials/`, `docs/`, and `scripts/` out of the deployment.

## Checks

```bash
npm run test:engine                 # golden tests from the slides + 300 seeds × 3 levels × 11 templates
npx tsx scripts/e2e.ts http://localhost:3000     # full API flow against a running server
npx tsx scripts/shots.ts http://localhost:3000 shots   # screenshots of every screen via headless Edge
```

`scripts/shots.ts` uses `playwright-core` with the installed Microsoft Edge (`channel: "msedge"`).

## How scoring works

Per question: **accuracy** (weighted checkpoints) × **efficiency** (time vs expected, moves vs optimal, wrong checks; each bounded so accuracy dominates).
Per attempt: weighted by difficulty, then × **integrity factor** (full-screen exits, tab switches, focus loss, devtools, second device) × **(1 − late penalty)**, mapped to marks.
Every weight is adjustable in *Results and export*, and exports include the criteria used. Full formulas are in [docs/PRD.md §8](docs/PRD.md).

Trial-and-error is flagged when a question has more wrong checks than expected, far more moves than needed, repeated flipping of the same element, or bursts of failing checks with no changes in between.

## Build decisions (v1 demo)

These follow the faculty decisions of 2026-11-19 and supersede the corresponding parts of the specs:

- **No login.** Students are identified by register number. Teachers hold a per-room host key in their browser, and can move it to another device with the *Host link* button. Accounts with email and password are a later enhancement.
- **No Packet Tracer replication.** The IOS console template from the spec is not built, and lab-related concepts are covered conceptually instead (cabling, VLSM, forwarding, RIP).
- **Vercel + Upstash Redis + HTTPS polling** replace the on-prem Postgres/Socket.IO architecture for the demo. The engine, scoring, and data model are unchanged and portable.
- **Session window** is 1.25× or 1.5× the paper's estimated time, or custom.
- **Exports**: CSV, Excel (with a criteria sheet), and PDF.

## Layout

```
src/engine/      pure, deterministic: templates (generate/solve/grade), scoring, catalogue
src/server/      storage adapter (Redis/memory), room and attempt service
src/app/api/     HTTP endpoints (rooms, host actions, student play)
src/components/  UI kit, avatars, student workbench + 11 template UIs, teacher views
src/lib/         client API queue, integrity sensors, exports, formatting
scripts/         engine checks, end-to-end test, screenshot tour
docs/            product, architecture, design system, templates, question bank, roadmap
```

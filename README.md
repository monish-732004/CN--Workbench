# CN Workbench

Interactive, per-student parameterised classroom assessments for **21CSC302J Computer Networks** (SRMIST).
Teachers open a timed room. Students join with a room code and their register number, then solve hands-on questions in full screen.
Every student gets different values, and answers are graded on the server. Time, moves, wrong checks, and integrity events feed a transparent score that the teacher can tune and export.

Specs live in [docs/](docs/). See [Build decisions](#build-decisions-v1-demo) for how this build differs from them.

## What's in the app

| Area | Route | Notes |
|---|---|---|
| Student join | `/` | Room code + register number + name. The QR on the projector pre-fills the code. |
| Student quiz | `/play/[code]` | Lobby (avatar, team, guide switch) → full-screen workbench → summary with rank and podium. Work is saved locally and survives refreshes and network drops. |
| Teacher console | `/teacher` | Not linked from the student page. **Press and hold the logo for about 1 second** (mouse, touch, or hold Enter), or bookmark `/teacher`. Lists rooms created on this browser (the host key stays in the browser). |
| New room | `/teacher/new` | Pick topics per unit, write your own questions, choose the game mode, leaderboard and teams, set the Easy/Medium/Hard mix and the session window (1.25×, 1.5× the estimate, or custom), late policy, and feedback level. |
| Live room | `/teacher/room/[code]` | Start, +5 min, End. Live roster with presence, performance leaderboard, integrity monitor, and event feed. |
| Game and teams | same page, *Game and teams* tab | Points ranking, move students between teams, show or hide the student leaderboard, preview what students see. |
| Results | same page, *Results and export* tab | Adjust judging criteria and every score recomputes instantly. Excuse events, review per student, see common mistakes, export **CSV / Excel / PDF**. |
| Projector | `/teacher/room/[code]/present` | Join screen (room code, QR) while waiting; live podium, top 10, team race and game moments once the room starts. Final standings when it closes. |

### Topics (36 across the 5 units, 16 interactive templates)

| Unit | Topics |
|---|---|
| 1 | Network types, topologies, circuit/packet/message switching, OSI and TCP/IP layers, latency and delay, unguided media, twisted-pair cabling |
| 2 | IPv4 notation and classes, subnet masks, FLSM, VLSM, supernetting, NAT and PAT, collision/broadcast domains, switch MAC learning |
| 3 | IP forwarding (longest prefix), link-state (Dijkstra), distance-vector (RIP), path vector (BGP), routing protocol families, IPv6 addressing, multicasting |
| 4 | ALOHA, CSMA/CD and Ethernet, MAC protocol families, sliding windows, ARQ (stop-and-wait, Go-Back-N, Selective Repeat), parity and checksum, CRC, Hamming code, HDLC bit stuffing, HDLC and PPP sessions |
| 5 | Port numbers, UDP and TCP headers, TCP connection, HTTP and FTP, FTP session, email and SMTP, DNS resolution |

Interactions include bit boards, address bars, Dijkstra steppers, hex dissectors, segment ladders, drag-to-bucket sorting, step ordering, event tables (NAT, ARQ, BGP, MAC learning) and calculation forms.

**Answer sharing.** Every platform question is generated from a per-student seed: different numbers, addresses, bit strings, frame sequences and item sets, and a different question order. The server also refuses to give two students in the same room the same instance of a question (it retries up to 12 seeds). Teacher questions shuffle their options and steps per student, and numeric ones draw each student's own variable values.

### Teacher questions

In *New room → Your own questions*, write:

- **Multiple choice** and **multiple select** (2–8 options, shuffled per student)
- **Numeric**: variables with ranges (e.g. `{L}` from 500 to 1500 in steps of 100) and an answer formula (`L * 8 / R`), with a tolerance; each student gets their own values. The editor previews another student's version.
- **Short answer**: one or more accepted answers (case and spacing ignored)
- **Order the steps**: steps in the correct order, shuffled for students

Questions are saved in the browser's library for reuse, and can be exported to and imported from JSON. A room can mix them with platform topics, or use only them (up to 20 per room, 25 questions in total).

### Game layer

Inspired by game-based quiz platforms, kept separate from marks:

- **Points** for every verified step: up to 1000 × difficulty (1, 1.5, 2) split across the question's steps, scaled by tries (100%, 70%, 45%, 25%), with speed (+10–20%) and streak (+10% per step, up to +50%) bonuses. Students see an animated points popup and a "question complete" summary.
- **Modes**: *Classic*; *Gold rush* (after each verified step, pick one of three chests: bonus points, a percentage, double the next step, steal from a top-5 rival, or lose some); *Race* (ranked by progress, then finishing time).
- **Leaderboard**: top 10 with the top 3 highlighted, the student's own rank, team standings and a feed of steals, streaks and finishes. It refreshes after every check and submission and every few seconds. The teacher can hide it, and then students see only their own points.
- **Teams**: 2–8 teams (Routers, Switches, Packets…), assigned in turn as students join. A team scores the average of its members, so uneven team sizes stay fair. The teacher can move students between teams.
- **Avatars**: 12 per student, picked in the lobby. Avatar seeds are hashed, so the leaderboard never shows register numbers.

### Guidance for students

The **Guide** is on by default. With it on, students get a 7-step tour of the interface when they start, and a "How to answer" box above every question that explains that question type. The last tour step points at the **Guide** switch in the top bar, which turns it off (it is also in the lobby, and each guide box has a *Turn guide off* link). The choice is remembered on that device.

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

Redis is required on Vercel because serverless instances do not share memory. All live updates use plain HTTPS polling (every 2.5–5 s; the student leaderboard every 8 s, or 4 s while open), so the app works on SRMIST Wi‑Fi, home Wi‑Fi, or mobile data with no WebSocket requirements.

**Redis usage.** A 60-student, 40-minute room uses roughly 150–250k Redis commands (heartbeats, checks, leaderboard reads). The Upstash free tier allows 500k commands per month, which covers about two such sessions. For regular weekly use, switch the database to Upstash's pay-as-you-go plan (a few US dollars a month at this volume).

`.vercelignore` keeps `course_materials/`, `docs/`, and `scripts/` out of the deployment.

## Checks

```bash
npm run test:engine                 # golden tests from the slides + many seeds × 3 levels × every topic, plus teacher questions
npx tsx scripts/e2e.ts http://localhost:3000     # full API flow: rooms, grading, integrity, points, teams, chests, leaderboards
npx tsx scripts/shots.ts http://localhost:3000 shots   # screenshots of every screen via headless Edge
```

`scripts/shots.ts` uses `playwright-core` with the installed Microsoft Edge (`channel: "msedge"`).

## How scoring works

Per question: **accuracy** (weighted checkpoints) × **efficiency** (time vs expected, moves vs optimal, wrong checks; each bounded so accuracy dominates).
Game points, chests and team scores never affect marks.
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
src/engine/      pure, deterministic: templates (generate/solve/grade), teacher questions, scoring, catalogue
src/server/      storage adapter (Redis/memory), room and attempt service, game layer (points, chests, boards)
src/app/api/     HTTP endpoints (rooms, host actions, student play)
src/components/  UI kit, avatars, student workbench + template UIs, game UI (points, chests, leaderboard, tour), teacher views and question builder
src/lib/         client API queue, integrity sensors, exports, formatting
scripts/         engine checks, end-to-end test, screenshot tour
docs/            product, architecture, design system, templates, question bank, roadmap
```

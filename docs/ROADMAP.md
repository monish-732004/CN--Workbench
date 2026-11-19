# ROADMAP — SRM CN Workbench

**Status:** v1.0 · 2026-11-19
**Target:** pilot in one 21CSC302J section in the 2026–27 EVEN semester; v1.0 for all sections in the 2027–28 ODD semester.
**Read with:** every other spec in `docs/`. Each phase lists a checklist and **exit criteria**. A phase is not done until its exit criteria pass in CI or in a recorded demo.

---

## Team (recommended minimum)

| Role | Count | Owns |
|---|---|---|
| Tech lead / architect | 1 | `engine`, `protocol`, ARCHITECTURE decisions, reviews |
| Full-stack engineers | 2 | `web`, `realtime`, `worker`, `db` |
| Front-end / interaction engineer | 1 | `ui`, `templates-ui`, canvas kit, accessibility |
| Networks domain author (faculty or TA) | 1–2 | `netkit` golden tests, blueprints, misconception tags, lab parity |
| Product designer (part-time) | 0.5 | DESIGN_SYSTEM enforcement, layouts, usability tests |

## Timeline at a glance (weeks from kickoff)

```
Wk   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17  18  19  20  21  22  23  24
P0  ███
P1      ████████████
P2              ████████████████
P3                  ████████████████████
P4                              ████████████
P5                                          ████████████████
P6                                          ████████████████████████████████████████
P7                                                                          ████████████████
P8                                                                                          ▶ v1.0
```

---

## Phase 0 — Foundations (weeks 1–2)

**Repository and tooling**
- [ ] Monorepo: pnpm workspaces + Turborepo; packages per ARCHITECTURE §4 (empty shells with build/test scripts).
- [ ] TypeScript strict everywhere (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- [ ] ESLint + Prettier + Stylelint, including the **design-system ban rules** (raw hex, banned Tailwind classes; DESIGN_SYSTEM §13).
- [ ] Vitest, fast-check, and Playwright wired; CI on every PR (lint, typecheck, unit, build); Renovate; SBOM.
- [ ] Commit conventions and branch protection (main protected, PR review required, CI green).

**Infrastructure**
- [ ] `infra/compose`: Postgres 16, Redis/Valkey, MinIO, Caddy, OTel collector, Grafana stack.
- [ ] Secrets: SOPS for dev and staging; `MASTER_KEY` and JWT signing keys generated per environment.
- [ ] Staging environment on the target platform (on-prem VM or India-region cloud). Confirm with SRMIST IT (PRD A3).

**Data and identity**
- [ ] `@cn/db`: Drizzle schema (ARCHITECTURE §9), migrations, monthly partition job for `telemetry_events`.
- [ ] `packages/syllabus/21CSC302J.json`: the full taxonomy from PRD §3, including lab cross-links; seed script.
- [ ] Auth.js with the institutional OIDC provider (confirm the provider, PRD A2); roster CSV import (register no., name, email, section).

**Design system bootstrap**
- [ ] `@cn/ui` tokens (light and dark), fonts self-hosted (Geist, JetBrains Mono), Tailwind v4 `@theme` mapping.
- [ ] Token contrast test (WCAG AA pairs) in CI.

**Exit criteria**
- `pnpm dev` brings up the full stack locally in one command; staging deploys from `main`.
- A faculty account signs in through SSO on staging, and the syllabus tree renders from the DB.

---

## Phase 1 — Engine core and netkit (weeks 2–5)

**`@cn/netkit`: pure networking math, with golden tests from the slides' worked examples**
- [ ] IPv4: parse/format, masks, AND/OR/NOT, class detection, block info, FLSM/VLSM solver (canonical and any-valid), supernet/aggregation, LPM.
- [ ] IPv6: parse, RFC 5952 canonical form, all valid compressions, block classification, EUI-64.
- [ ] Multicast IPv4 → MAC mapping.
- [ ] Error control: parity, SRM 4-bit checksum, Internet checksum (with the special cases of Example 24.2), CRC (row-wise trace), Hamming (LSB-first positions, coverage sets, syndrome).
- [ ] Graphs: Dijkstra with an iteration trace, Bellman-Ford rounds, RIP 3-rule update, path-vector update, Forouzan BGP selection flow, OSPF cost.
- [ ] Rationals for exact delays and throughputs; formatting helpers per DESIGN_SYSTEM §4.3.
- [ ] Golden tests (minimum set):
  - 167.199.170.82/27;
  - 230.8.24.56 across prefixes /16–/31;
  - 192.16.2.0 FLSM ×4;
  - 192.168.10.0 VLSM (50/25/10/5);
  - CRC 1001 ÷ 1011 → 110;
  - CRC 1010001101 ÷ 110101;
  - Hamming 1011011 → 10101010111;
  - Hamming decode of 10101000111 → error at position 5;
  - checksum (7, 11, 12, 0, 6) → 9;
  - UDP `CB84000D001C001C`;
  - TCP 5,000 B from 10001;
  - ALOHA S at G = 1, ½, ¼ (pure and slotted);
  - CSMA/CD 10 Mbps, 25.6 µs → 512 bits;
  - Ethernet efficiency at a = 0.24 → ≈ 39%.

  Expected values are computed independently, not copied from the slides (PRD §3.1).

**`@cn/engine`: template contract and infrastructure**
- [ ] `Rng` (sfc32), HKDF/HMAC seed derivation, `fork`; cross-engine determinism test (Node 22 vs Chromium vs Firefox via Playwright).
- [ ] FPE permutation allocator (Feistel + cycle-walking) with a bijection test for N ∈ [2, 10⁶].
- [ ] `TemplateModule` contract, registry, knob/param/view/solution/response Zod schemas.
- [ ] Paper builder (ARCHITECTURE §6.6) with a diversity-maximising slot allocation.
- [ ] Pure scoring function `score()` implementing PRD §8.2–8.5; the PRD §8.5 worked example as a golden test (S = 79.20, marks 8.0).
- [ ] T&E rule engine R1–R5 over telemetry plus checks (synthetic telemetry fixtures for every rule).
- [ ] `pnpm bank:validate` pipeline (QUESTION_BANK_SCHEMA §5), runnable locally and in CI.

**Exit criteria**
- `netkit` has 100% line coverage on the solvers, and every golden test passes.
- A stub template passes the full validation pipeline (10k seeds, secrecy lint, perturbation).
- Determinism: identical instances across three JS engines for 1,000 seeds.

---

## Phase 2 — Session platform: rooms, realtime, integrity (weeks 4–8)

**Rooms and attempts (`web`)**
- [ ] Teacher room setup (DESIGN_SYSTEM §6.6): scope tree, mix bar, window defaults from the timetable, policies, preview and re-roll.
- [ ] Room code generator (unambiguous alphabet), projector view with QR, rotating lab PIN.
- [ ] Join flow: enrollment check, cut-off, idempotent attempt creation, **instance materialisation at join** (ARCHITECTURE §5.3).
- [ ] Room state machine with BullMQ delayed transitions (open → grace → closed), pause/resume, and extensions (room-wide and per student).

**Realtime (`realtime`)**
- [ ] Fastify + Socket.IO with the Redis adapter; `/student` and `/teacher` namespaces; EdDSA ticket verification and refresh.
- [ ] Every event contract in `@cn/protocol` (ARCHITECTURE §7.2) with Zod validation and acks.
- [ ] Single-session takeover → `multi_session`.
- [ ] Check service: rate limit, cache, grade, idempotent insert, verdict per feedback policy.
- [ ] Telemetry ingest → Redis stream → worker `COPY` into partitioned Postgres; sequence-gap detection.
- [ ] Hot-state keys and `rebuildRoomHotState`; clock sync.

**Integrity (client `lib/integrity` + server)**
- [ ] Fullscreen gate and overlay; visibility/blur deduplication; devtools heuristics; clipboard/context-menu/print blocking and logging; extended-display probe; 2 s heartbeat.
- [ ] Immediate `integrity.event` with ack, `sendBeacon` on `pagehide`, and IndexedDB persistence of unacked events.
- [ ] Server reconciliation → `tamper_suspected`; severity computation (PRD §8.4); excuse API (audited).
- [ ] Lobby: capability check, DPDP notice and acknowledgement, warm-up interaction.

**Exit criteria (Playwright E2E, all three browser engines)**
- 30 simulated students join a room, enter fullscreen, check, lose fullscreen, switch tabs, go offline for 60 s, come back, and finish. Every integrity event and every telemetry sequence arrives exactly once in Postgres.
- In a hard-lock room, attempts auto-submit at `end_time` ± 1 s. A late submission in `accept-flagged` has `is_late` set and `late_by_s` correct to ±1 s.

---

## Phase 3 — Workbench UI and first six templates (weeks 5–10)

**Workbench shell**
- [ ] Telemetry bar, prompt rail, canvas host, action bar, item navigator (⌘J), connection states, watermark layer (DESIGN_SYSTEM §6.2).
- [ ] XState harness: telemetry emission per event; replay from the event log; draft snapshots and resume.
- [ ] Tools: `calc-basic`, `port-registry`, `scratchpad` (with per-template forbidden lists).
- [ ] Keyboard model (INTERACTIVE_TEMPLATES_SPEC §2.6) and an axe-core test per screen.

**MVP templates.** These cover Units 2–4 and the highest-value labs. Each one needs: generator, solver, grader, moves, misconception tags, renderer, keyboard path, property tests, and **≥ 5 reviewed blueprints per difficulty**.

- [ ] `bitbench` (modes `mask`, `notation`, `supernet`, `ipv6`)
- [ ] `slicer` (`flsm`, `vlsm`) — Lab 4
- [ ] `bitforge` (`crc`, `hamming`, `checksum-4bit`, `parity`)
- [ ] `fib` (`lpm`, `build`) — Lab 5
- [ ] `spf` (`dijkstra`)
- [ ] `ios` (`build`) with the IOS grammar subset for Labs 3, 5, 7, 8, 9 (basics, static/default, RIP v1/v2, single-area OSPF)

**Exit criteria**
- A usability test with 5 students per template: median completion within 1.5× the default expected time, with no blocking confusion about the controls (recorded sessions).
- The DESIGN_SYSTEM §14 review gate passes for every screen in both themes.

---

## Phase 4 — Scoring, teacher dashboards, results (weeks 8–11)

- [ ] Worker `attempt.finalize`: efficiency, T&E flags, integrity I, lateness, composite S, and marks; reruns on override, excuse, or regrade.
- [ ] Live Command Center (DESIGN_SYSTEM §6.5): roster, Performance and Mastery leaderboard, Integrity monitor, event feed, room actions; ≤ 1 Hz coalesced deltas; FLIP reorder.
- [ ] Results table, the review drawer with **replay** (moves, checks, and integrity lanes; canvas reconstruction), and overrides with mandatory reasons.
- [ ] Publish/unpublish; student summary page with the breakdown and their own event log.
- [ ] Exports: CSV/XLSX in the section marks format (with CSV-injection escaping); per-student evidence PDF for Flagged attempts.
- [ ] Misconception analytics per room (deterministic aggregation, PRD §8.7).
- [ ] Audit log viewer (admin).

**Exit criteria**
- A full rehearsal: one faculty member and 20 volunteer students run a 50-minute room end to end. Marks are exported and spot-checked by hand for 5 students (the score decomposition matches the formula).
- Teacher setup time ≤ 90 s, measured.

---

## Phase 5 — Pilot and calibration (weeks 12–15)

- [ ] One section of 21CSC302J, 6–8 rooms over 4 weeks, with Units 2–4 and Labs 4, 5, 7–9 in scope.
- [ ] Integrity mode `advisory` for the first two rooms (shown, not applied) to measure false-positive rates, then `enforced`.
- [ ] Daily review: check-latency SLO, disconnect rates, telemetry gaps, integrity event distribution, T&E flag rates.
- [ ] **Calibration:**
  - re-estimate `expectedTimeS` per blueprint from the median of clean, A = 1 attempts;
  - adjust T&E thresholds if > 15% of correct-first-check items get flagged;
  - recheck instance-equivalence (time variance across instances of the same blueprint ≤ 15%, PRD G3);
  - each change goes in as a reviewed PR.
- [ ] Surveys: student fairness (target ≥ 4/5), faculty trust in marks; three faculty interviews.
- [ ] Validity check: correlation of Workbench Mastery with the section's CLA-1 unit test marks (target r ≥ 0.5).

**Exit criteria**
- No P0 or P1 incidents in the last two pilot weeks.
- Calibration PRs are merged, and the fairness survey is ≥ 4/5.
- Faculty sign off that they would use the exported marks as CLA evidence.

---

## Phase 6 — Template wave 2 and bank growth (weeks 12–22, parallel with P5)

Build in this order (labs that come up earliest in the semester first). Each template follows the Phase 3 per-template definition of done.

- [ ] `pinout` (crimp, select, tester, media) — Lab 1
- [ ] `patchbay` (build, count, domains, scope) — Lab 2
- [ ] `ios` modes extension: NAT (Lab 6), multi-area OSPF (Lab 10), PPP/CHAP (Lab 11), HDLC (Lab 12), BGP (Lab 13), EIGRP (Lab 14), Telnet (Lab 15); `fault-hunt` with the full fault library
- [ ] `nat` (static, dynamic, pat) — Lab 6
- [ ] `encap` (stack, hops, layers)
- [ ] `delayline` (latency, bdp, bandwidth, switching, spectrum)
- [ ] `vectors` (dv-update, rip-update, dv-converge, pv-update, bgp-select, ibgp-sessions)
- [ ] `medium` (aloha-pure/slotted, csma-cd, csma-ca, token-ring, ethernet-eff)
- [ ] `arq` (stop-wait, gbn, sr, window-size)
- [ ] `frame` (ethernet, hdlc-control, bit-stuff, ppp, token-ring)
- [ ] `hexdump` (udp, tcp)
- [ ] `ladder` (tcp, http, ftp, smtp, dns, telnet, hdlc, ppp-chap)
- [ ] Remaining modes of the MVP templates (`bitbench`: classful-size, mcast-mac, base64; `fib`: aggregate, ad, mac-learning; `spf`: lsdb, ospf-cost, areas; `bitforge`: checksum-16)

**Bank**
- [ ] ≥ 300 active blueprints: ≥ 15 per unit per difficulty, plus ≥ 5 per lab (QUESTION_BANK_SCHEMA §5). The coverage CI gate is enabled.
- [ ] Department lab records obtained and IOS objectives aligned with them (PRD A1 closed).
- [ ] Faculty review rota: every blueprint gets one domain review before `active`.

**Exit criteria**
- All 17 templates are live. The coverage matrix (INTERACTIVE_TEMPLATES_SPEC §1.1) is fully green: every syllabus node and Labs 1–15 have ≥ 1 active blueprint per difficulty.

---

## Phase 7 — Hardening (weeks 20–24)

- [ ] **Load:** a k6 run with 5,000 simulated students for 60 minutes. Gates: p95 check ≤ 300 ms, zero lost telemetry sequences, realtime CPU < 70% (ARCHITECTURE §13.2).
- [ ] **Chaos:** kill a realtime replica mid-room; fail over Redis; fail over Postgres. Rooms continue, and no attempt loses a check or integrity event.
- [ ] **Security:** run the pen-test checklist (ARCHITECTURE §12) by an internal red team or the SRMIST CERT; fix all highs.
- [ ] **Accessibility:** WCAG 2.2 AA audit, a screen-reader pass per template, keyboard-only completion of one blueprint per template.
- [ ] **Privacy (DPDP Act 2023):** notice text approved by the institution; retention jobs (telemetry 12 months, scores 7 years); runbook for data-principal requests; a data-processing record.
- [ ] **Operations:** runbooks (Redis loss, DB failover, campus Wi-Fi outage, mass pause), SLO alerts, backup restore drill (PITR to a timestamp), deploy freeze windows.
- [ ] **Training:** a 20-minute faculty walkthrough video, a one-page student guide, and an in-app "first room" checklist.

**Exit criteria**
- Every gate is green, a restore drill is documented, and security highs are at zero.

---

## Phase 8 — v1.0 rollout (2027–28 ODD semester start)

- [ ] Onboard all 21CSC302J sections (rosters, timetables, faculty accounts).
- [ ] Office hours in week 1 and a hypercare rota for the first 3 weeks.
- [ ] A weekly metrics review against PRD §11: adoption, setup time, fairness, appeals with no evidence = 0.

---

## Phase 9 — Post-v1 (v1.1+)

- [ ] **AI insights module** (PRD §8.8, ARCHITECTURE §11): pseudonymised digests, provider interface, feature flag, evidence-linked insight cards, prompt versioning, an evaluation set of 50 hand-labelled digests before enabling.
- [ ] Coordinator analytics: cross-section distributions, CO attainment reports for NBA/NAAC.
- [ ] Safe Exam Browser support for hard-lock rooms (config-key header verification).
- [ ] Second course onboarding: taxonomy JSON, then reuse of templates (e.g. `bitforge` and `ladder` for a Data Communications or OS course), then new templates only where needed.
- [ ] Research signal (unscored): transcription-pattern detection from move cadence, validated against labelled pilot data before any use.

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Lab manuals differ from the assumed IOS procedures | Medium | Medium | Close PRD A1 in Phase 6; objectives are predicate-based, so syntax variants still pass |
| Campus Wi-Fi cannot sustain 70 sockets per room | Medium | High | Long-polling fallback; telemetry batching; a pilot measurement in week 12; a wired-lab fallback |
| Integrity false positives erode trust | Medium | High | Advisory mode in early pilot rooms; 2 s blur grace; teacher excuse; tier labels with evidence |
| Generator produces unequal difficulty | Low | High | Fingerprints with 10k-seed CI; pilot time-variance check; curated fallback pools |
| Slide examples contain arithmetic slips that students learned | High | Low | Graders compute from first principles; ECF and misconception tags; teacher notes per blueprint |
| Scope creep into full Packet Tracer emulation | Medium | Medium | The non-goal stated in the PRD; `ios` grades configuration state only |
| Fullscreen API limits on student devices | Medium | Medium | Device policy (PRD §9.6); a capability check in the lobby; tablets flagged as degraded |

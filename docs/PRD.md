# PRD — SRM CN Workbench

**Product:** SRM CN Workbench, an in-house interactive assessment platform for timetabled classroom windows.
**First course:** 21CSC302J — Computer Networks (B.Tech, Regulations 2021, School of Computing, SRMIST).
**Status:** Specification v1.0 · 2026-11-19
**Companion specs:** [ARCHITECTURE.md](ARCHITECTURE.md) · [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) · [INTERACTIVE_TEMPLATES_SPEC.md](INTERACTIVE_TEMPLATES_SPEC.md) · [QUESTION_BANK_SCHEMA.md](QUESTION_BANK_SCHEMA.md) · [ROADMAP.md](ROADMAP.md)

> **Decisions update (2026-11-19, faculty review):** the first build differs from this spec as follows.
> - No SSO: students use register numbers and teachers use a per-room host key. Accounts come later.
> - No IOS console or other Packet Tracer replication: labs are already practised in PT.
> - Hosted on Vercel with Upstash Redis and HTTPS polling, so it works on any network.
> - Session window is 1.25× or 1.5× the estimate, or custom.
> - Marks export to CSV, Excel, or PDF after the teacher adjusts the criteria.
>
> See the root `README.md` → *Build decisions*.

---

## 1. Problem

Faculty need to award internal marks (CLA-1 / CLA-2) from in-class assessments they can trust. Current tools fail in three ways:

1. **Static MCQs are outsourced.** A phone, Google Lens, or an LLM answers a static multiple-choice item in seconds.
2. **Neighbours copy.** Every student sees the same values, so an answer travels across a bench in one glance.
3. **Completion is not understanding.** A raw score can't tell a student who reasoned through a VLSM plan from one who brute-forced the "check" button.

The Workbench fixes all three. Every item is a hands-on interactive task (a canvas, bit field, CLI, or timeline), not a pick-one question. Values are generated per student from a seed and graded on the server. Grading also uses interaction telemetry: time, moves, wrong checks, and focus loss.

## 2. Goals and non-goals

### Goals
| # | Goal | Measure of success |
|---|------|--------------------|
| G1 | Zero static MCQs; every item requires spatial, logical, or procedural interaction | 100% of the bank uses one of the 17 interactive templates |
| G2 | No two students in a room receive the same instance of a question | Instance collision rate within a room = 0 for parameter spaces ≥ room size |
| G3 | Equal difficulty across parameterised instances | Same optimal-move count and complexity fingerprint per (blueprint, difficulty); pilot time variance across instances ≤ 15% |
| G4 | Teachers can defend the marks they award | Every score decomposes into accuracy, efficiency, integrity, and lateness, with an event log as evidence |
| G5 | Fits a 50-minute period or a 100-minute double period | Room setup ≤ 90 s; student join to first question ≤ 60 s |
| G6 | Covers theory and labs | Every syllabus topic and all 15 labs map to at least one template mode |
| G7 | Scales to other engineering courses | Course, unit, topic, and lab taxonomy is data, not code; templates are course-agnostic plugins |

### Non-goals (v1)
- Full Packet Tracer emulation. The IOS console models configuration state and command semantics, not packet forwarding inside IOS.
- Proctoring with webcam or microphone. These are privacy-invasive and out of scope.
- Native mobile apps. Students need a laptop or desktop browser (see §9.6).
- Replacing the university's academic ERP. The Workbench exports marks; it does not write to the ERP in v1.

## 3. Course scope extracted from the materials

Source: `course_materials/Computer Networks syllabus.pdf` and the Unit 1–5 slide decks (Dr. J. Justina Michael, SoC, SRMIST-KTR; textbook: Forouzan, *Data Communications and Networking*, 5th ed.). L-T-P-C = 3-0-2-4.

> **Mapping note.** The syllabus attaches labs to units by **timetable order**, not by topic: Lab 10 (Multi-Area OSPF) is listed under Unit 4, and Labs 13–14 (BGP, EIGRP) under Unit 5, but their theory lives in Unit 3. The taxonomy keeps the official placement (for "what was taught this week") **and** cross-links each lab to its theory topic (for grading tags and analytics).

| Unit | Theory topics (topic IDs) | Labs (official placement) → theory cross-link |
|---|---|---|
| **U1 Introduction to Networks** | `u1.network-types` LAN/MAN/PAN/WAN · `u1.topology` bus/star/ring/mesh/hybrid · `u1.switching` circuit/packet · `u1.osi` · `u1.tcpip` (encapsulation, addressing per layer) · `u1.physical` · `u1.performance` latency, bandwidth (Hz vs bps), propagation/transmission/queuing/processing delay · `u1.guided` twisted pair (UTP/STP, Cat 1–7, RJ-45), coax (RG-59/58/11, BNC), fiber (modes, step/graded index, SC/ST/MT-RJ) · `u1.unguided` radio, microwave, infrared, propagation bands | **Lab 1** Packet Tracer intro, peer-to-peer, cables and colour codes → `u1.guided` · **Lab 2** Topologies → `u1.topology` · **Lab 3** Router config (passwords, interfaces) → `ios.basics` |
| **U2 Addressing** | `u2.ipv4` · `u2.address-space` (binary/dotted/hex notation, 2³²) · `u2.classful` A–E · `u2.mask` (AND/OR/NOT) · `u2.flsm` · `u2.classless` CIDR, block rules · `u2.vlsm` · `u2.nat` static/dynamic/PAT, translation tables · `u2.supernet` aggregation · `u2.devices` hub, repeater, switch (learning, STP), bridge (collision domains), router | **Lab 4** IP addressing and VLSM → `u2.vlsm` · **Lab 5** Static and default routing → `u3.static` · **Lab 6** NAT → `u2.nat` |
| **U3 Routing** | `u3.forwarding` longest-prefix match, aggregation, hierarchical routing, label/MPLS · `u3.static` static/default/dynamic · `u3.dv` Bellman-Ford · `u3.ls` LSDB, Dijkstra · `u3.pv` spanning trees, path vectors, loop avoidance · `u3.rip` hop count (16 = ∞), 3 update rules, UDP 520, timers · `u3.ospf` cost metric, areas, LSA types, 5 message types · `u3.bgp` eBGP/iBGP, TCP 179, n(n−1)/2 sessions, path attributes, route-selection flow · `u3.eigrp` metrics, neighbour/topology/route tables, successor/feasible successor, 224.0.0.10 · `u3.multicast` 224.0.0.0/4 blocks, 01:00:5E + 23-bit mapping, source-based vs shared trees · `u3.ipv6` colon-hex, zero compression, block prefixes, EUI-64, autoconfiguration | **Lab 7** RIPv1 → `u3.rip` · **Lab 8** RIPv2 → `u3.rip` · **Lab 9** Single-area OSPF → `u3.ospf` |
| **U4 Medium Access Control** | `u4.aloha` pure/slotted, vulnerable time, S = G·e⁻²ᴳ / G·e⁻ᴳ, BEB · `u4.csma-cd` persistence, min frame = 2·Tp·B, energy levels · `u4.csma-ca` IFS, contention window, RTS/CTS/NAV, hidden station · `u4.ethernet` frame, address types, LSB-first bit order, efficiency 1/(1+6.4a), 10/100/1000/10G variants · `u4.token-ring` · `u4.flow` stop-and-wait, sliding window · `u4.arq` S&W ARQ (0/1 seq), GBN (Ws ≤ 2ᵐ−1, cumulative ACK), SR (Ws ≤ 2ᵐ⁻¹) · `u4.parity` · `u4.checksum` (SRM 4-bit fold method, Internet checksum) · `u4.crc` · `u4.hamming` (2ʳ ≥ m+r+1, LSB-first positions, even parity, syndrome) · `u4.hdlc` NRM/ABM, I/S/U frames, control field, bit stuffing · `u4.ppp` frame, phases, LCP/PAP/CHAP/NCP protocol values, multilink | **Lab 10** Multi-area OSPF → `u3.ospf` · **Lab 11** PPP → `u4.ppp` · **Lab 12** HDLC → `u4.hdlc` |
| **U5 Transport and Application** | `u5.ports` well-known/registered/dynamic · `u5.udp` header, pseudoheader checksum · `u5.tcp` byte numbering, SEQ/ACK, segment format, 3-way open, 3-way close (Forouzan), state diagram, windows, flow/error/congestion control, timers · `u5.http` persistent vs non-persistent, request/response format, status codes, cookies, proxy · `u5.ftp` control 21 / data 20, commands, reply codes · `u5.email` UA/MTA/MAA, SMTP phases and codes, POP3/IMAP4, MIME, Base64 · `u5.telnet` NVT, remote logging · `u5.dns` name space, zones, recursive vs iterative, RR 5-tuple, message format | **Lab 13** BGP → `u3.bgp` · **Lab 14** EIGRP → `u3.eigrp` · **Lab 15** Telnet → `u5.telnet` |

**Course outcomes** (used to tag every blueprint): CO1 apply knowledge of communication · CO2 construct networks using addressing schemes · CO3 design and implement routing protocols · CO4 identify and correct transmission errors · CO5 analyse transport and application services.

**Assessment context** (from the syllabus): CLA-1 = average of unit tests (45%, Bloom L1 20%, L3 40%, L5 40%); CLA-2 = 15% practice; final exam 40%. The Workbench produces evidence for CLA-1 unit tests and CLA-2 practice and tags every blueprint with a Bloom level so faculty can match the prescribed distribution.

### 3.1 Conventions the grader must honour

The slides teach Forouzan's conventions. Some differ from Cisco IOS behaviour that students see in Packet Tracer. Every blueprint declares a **convention profile** (`forouzan` or `cisco-ios`) so a student is never marked wrong for following what was taught.

| Concept | `forouzan` (theory items) | `cisco-ios` (lab items) |
|---|---|---|
| RIP cost of a directly connected network | 1 hop (networks are counted) | metric 0; a route one router away shows `[120/1]` |
| BGP route selection | highest LOCAL-PREF → lowest MULTI-EXIT-DISC → shortest AS-PATH → least-cost NEXT-HOP → external over internal → lowest BGP identifier (slide Fig. 20.30) | Not graded in v1; lab items test configuration, not best-path internals |
| TCP connection termination | 3-way: FIN → FIN+ACK → ACK (slide Fig. 24.12); half-close accepted as an alternative path | n/a |
| Checksum | SRM 4-bit-unit method: sum → fold carries → 1's complement (slides p.111–115); 16-bit Internet checksum for UDP/TCP | n/a |
| Hamming positions | Numbered from LSB (position 1 at right); parity at powers of 2; even parity; data bits fill D3, D5, D6, D7, D9… MSB-first from the left | n/a |
| Usable hosts | 2ʰ − 2 | /31 and /32 per IOS rules only in lab items that state them |

**Slides are not answer keys.** The decks contain transcription slips; for example, "/29 → usable hosts 8" (p.104) and a FLSM network-bit count of 15 instead of 18 (p.84). Solutions are always computed by `@cn/netkit` and verified by property tests. Hand-typed answers never enter the bank.

## 4. Personas

### P1 — Dr. Meera R., Assistant Professor (course faculty)
- Teaches 2–3 sections of 60–70 students. Runs labs in Packet Tracer and lectures from the shared decks.
- **Needs:** set up a quiz in under two minutes at the start of a period, scoped to exactly what was taught today; marks she can defend to the HoD and to students who appeal; a view during the session that shows who is struggling and who is cheating.
- **Frustrations:** students photographing MCQs; identical marks across a bench; spending evenings in spreadsheets.
- **Environment:** a projector, faculty laptop on campus Wi-Fi or wired, sometimes a lab with 30–70 desktops.

### P2 — Arjun K., 3rd-year B.Tech CSE student
- Has a personal laptop, or uses a lab desktop. Comfortable with Packet Tracer, nervous about subnetting.
- **Needs:** clear instructions, fair difficulty, immediate sense of progress, no lost work on a Wi-Fi hiccup, and a breakdown afterwards of what he got wrong.
- **Frustrations:** opaque marks; timers that cut him off; tools that feel like a 2009 LMS.

### P3 — Course Coordinator / HoD (secondary)
- Reviews section-wise distributions, integrity statistics, and outcome attainment for accreditation (NBA/NAAC CO-PO mapping).
- **Needs:** read-only analytics across sections; exports; an audit trail.

### P4 — Platform Administrator (SRMIST IT / department tech team)
- Manages SSO configuration, roster imports, backups, and course onboarding.

## 5. Core concepts and glossary

| Term | Definition |
|---|---|
| **Course** | e.g. 21CSC302J. Owns a syllabus taxonomy: Units → Topics, plus Labs. |
| **Offering / Section** | A course taught by a faculty member to a roster in a semester (e.g. "21CSC302J · 2026-ODD · Section K2"). |
| **Template** | An interactive mechanic (e.g. `slicer` — Address Space Slicer). Code. 17 in v1. |
| **Mode** | A variant of a template (e.g. `bitforge:crc`, `bitforge:hamming`). |
| **Blueprint** | An authored, parameterised question: template + mode + difficulty + parameter constraints + syllabus tags + checkpoints. Data. |
| **Instance** | A blueprint resolved for one student with a deterministic seed: concrete values, public view, server-only solution. |
| **Room** | A timetabled assessment session: scope, difficulty mix, time window, policies, room code. |
| **Paper** | The ordered list of **slots** a room generates (e.g. 2 × Easy U2, 2 × Medium Lab 4, 1 × Hard U3). Every student gets the same slot multiset (fairness) but different blueprints, instances, and order (variety). |
| **Attempt** | One student's run through a room's paper. |
| **Checkpoint** | A gradable step inside an instance (e.g. VLSM: "mask for subnet A"). Partial credit is per checkpoint. |
| **Move** | A committed state change on the canvas (drop, toggle, connect, CLI line entered). |
| **Check** | A student-initiated validation of a checkpoint, graded on the server. Counts as a "try". |
| **Integrity event** | A sensor observation: fullscreen exit, tab hidden, window blur, devtools suspected, clipboard attempt, multi-session, tamper. |

## 6. Workflows

### 6.1 Teacher: create and open a room (target ≤ 90 s)

1. **Sign in** with institutional SSO. The dashboard opens to "Today", showing the teacher's sections and the timetable slot that is current or next.
2. **New room** (⌘N). Pick the section; the class roster attaches automatically.
3. **Scope.** A syllabus tree (Units → Topics; Labs in a separate group, each showing its theory cross-link). The teacher can:
   - tick whole units, single topics, or labs;
   - use **"Since last room"** to pre-select topics added since this section's previous room;
   - see live coverage: how many blueprints and templates are available for the selected scope, per difficulty.
4. **Difficulty mix.** A three-segment stacked bar with drag handles (Easy / Medium / Hard) plus a numeric item count. The panel shows the derived values live:
   - paper size, e.g. 6 items;
   - **Σ expected time** with a warning if it exceeds the window minus a 5-minute buffer;
   - template diversity (the paper generator avoids repeating a template within one paper when the scope allows).
5. **Window.** Start and end times default to the current period (or a double period) from the section's timetable. Options:
   - **Late policy:** `accept-flagged` (default), `accept-penalised` (rate and cap), or `hard-lock`.
   - **Grace:** extra minutes in which late submissions are accepted; default 15.
   - **Join cut-off:** minutes after start after which a new join needs teacher approval; default 20.
6. **Policies** (collapsed by default with institution defaults):
   - feedback level: `binary` (default) / `checkpoint` / `none`;
   - integrity mode: `enforced` (trust factor multiplies the score) / `advisory` (shown, not applied);
   - student leaderboard visibility: hidden (default) / own rank after publish / top-10 projected after close;
   - review after close: show solutions yes/no.
7. **Preview paper.** The teacher sees one sample instance per slot and can re-roll a slot's blueprint pool or exclude a blueprint.
8. **Open room.** The room enters `SCHEDULED` (or `OPEN` if start ≤ now). **Projector view** shows the room code (6 chars, e.g. `K7Q-4MX`, no ambiguous glyphs), a QR code, the URL, a countdown to start, and a live joined/roster count.

### 6.2 Student: join and complete

1. Open `cn.srmist.edu.in` (or scan the QR). Sign in with SSO. Lab desktops use the fallback: register number + one-time room PIN shown on the projector (see ARCHITECTURE §8).
2. **Enter room code.** The server checks enrollment in the section, the room state, and the join cut-off.
3. **Lobby / pre-flight** (no assessment content yet):
   - browser capability check (Fullscreen API, WebSocket, viewport ≥ 1280×720);
   - an integrity notice in plain language listing what is monitored and why, with an acknowledgement checkbox (DPDP Act notice, §10);
   - a 20-second interactive warm-up (drag a cable, flip a bit) so students learn the controls without being graded;
   - the **Enter full screen and begin** button. The Fullscreen request must come from a user gesture.
4. **Workbench.** One item at a time on a canvas-first layout (DESIGN_SYSTEM §6.2). The top telemetry bar shows the room timer, item k/N, expected time and moves for this item, the fullscreen lock state, and connection state.
   - **Navigation:** free (default) or linear (teacher policy). Free navigation keeps state per item.
   - **Check** validates the current checkpoint on the server. Feedback depends on policy. Checks are rate-limited to 1 per 1.5 s.
   - **Submit item** locks the item. **Finish attempt** asks for confirmation and lists unanswered items.
5. **Leaving fullscreen or switching tabs:** the canvas is replaced by a full-bleed overlay ("Assessment paused — return to full screen"), the event is recorded, and the room timer keeps running. The item timer keeps running too.
6. **Window end:**
   - `accept-flagged` / `accept-penalised`: a banner at T−5 min (amber) and T−1 min (crimson). After `end_time` the student may continue until grace ends. Submissions after `end_time` are `is_late = true` with `late_by_seconds`.
   - `hard-lock`: at `end_time` the attempt auto-submits with the current state graded.
7. **After submit:** a summary of items, accuracy, efficiency notes ("Item 3: 5 checks against an expected 2, flagged as trial-and-error"), and the integrity events logged against them. Scores show as **provisional** until the teacher publishes.

### 6.3 Teacher: during the session (Live Command Center)

- **Roster grid**: one row per student with state, current item, progress, live provisional score, a trust badge, and a T&E flag count. Rows sort by risk or score.
- **Performance and Mastery leaderboard** (§8.6).
- **Integrity monitor** (§8.6): a live feed of events with timestamps and red/amber tags.
- **Actions:**
  - extend the window for the room or one student;
  - pause the room (freezes the timer, used for power or network outages);
  - force-submit a student;
  - approve a late join;
  - excuse an integrity event, with a reason that goes to the audit log;
  - send a message to all students or one student (toast).

### 6.4 Teacher: after the session

1. Room → `CLOSED` once grace ends (or when the teacher closes it manually).
2. **Review:** per-student breakdown with item replay (a scrubbable timeline of moves, checks, and integrity events) and score decomposition.
3. **Adjust:** manual override per item or per attempt, with a mandatory reason; the original value is kept.
4. **Publish:** students see final scores (and solutions, if enabled).
5. **Export:** CSV/XLSX in the section's marks format (register no., name, raw score, scaled marks, accuracy, integrity tier, late flag), plus a PDF evidence pack per flagged student.

## 7. Question model (summary — full spec in QUESTION_BANK_SCHEMA.md)

- **No static MCQs.** A blueprint is valid only if solving it requires interacting with a template. Selection-type sub-steps (e.g. "which class?") are allowed only *inside* an interactive flow and only when the answer depends on per-student parameters.
- **Per-student parameterisation.** Values come from a seeded generator under constraints that keep complexity identical: same number of subnets, same optimal move count, same number of Dijkstra relaxations, same number of ARQ retransmissions.
- **Uniqueness within a room.** For finite parameter spaces the server allocates instances from a room-scoped permutation, so instances don't repeat until the space is exhausted (ARCHITECTURE §6.4).
- **Order jumbling.** Slot order is shuffled per attempt. Within a slot, the blueprint is drawn from an equivalent pool.
- **Server-side truth.** The client receives only the public view. Solutions never leave the server during a live room.

## 8. Grading and mastery model

### 8.1 Inputs per item *i*

| Symbol | Meaning | Source |
|---|---|---|
| Dᵢ | Difficulty weight: Easy 1, Medium 2, Hard 3 | blueprint |
| Aᵢ ∈ [0,1] | Conceptual accuracy = Σ wⱼ·sⱼ / Σ wⱼ over checkpoints *j*, where sⱼ ∈ [0,1] is the final correctness of checkpoint *j* (fractional for multi-field checkpoints) | server grader |
| tᵢ, t̂ᵢ | Active time on the item; expected time | telemetry; blueprint |
| mᵢ, m̂ᵢ | Moves; optimal moves | telemetry; generator (instance-exact) |
| wᵢ, ŵᵢ | Wrong checks; free wrong checks (Easy 1, Medium 1, Hard 2, overridable per blueprint) | server |

"Active time" is wall-clock time with the item open, excluding server-confirmed disconnections and teacher pauses. Time spent outside fullscreen **is** included, because leaving does not stop the clock.

### 8.2 Efficiency multiplier

```
r_t = tᵢ / t̂ᵢ          f_t = 1                              if r_t ≤ 1
                        f_t = max(0.75, 1 − 0.25·(r_t − 1))  otherwise

r_m = mᵢ / m̂ᵢ          f_m = 1                              if r_m ≤ 1.5
                        f_m = max(0.70, 1 − 0.20·(r_m − 1.5)) otherwise

                        f_w = max(0.60, 1 − 0.10·max(0, wᵢ − ŵᵢ))

Mᵢ = 0.25·f_t + 0.30·f_m + 0.45·f_w                      ∈ [0.6825, 1.00]

Clean-mastery bonus:  Mᵢ += 0.05  iff  Aᵢ = 1 ∧ wᵢ = 0 ∧ r_t ≤ 0.75 ∧ r_m ≤ 1.2
```

Design rationale:
- **Accuracy dominates.** Efficiency can remove at most ~32% of an item's earned value and add at most 5%. A slow but correct student still earns far more than a fast, wrong one.
- **Wrong checks weigh most (0.45)**, because they are the clearest guessing signal. Moves get a 1.5× allowance because exploratory dragging is normal.
- **The bonus requires perfection** (A = 1, zero wrong checks), so speed is never rewarded on its own, and the bonus can't help a guesser.

### 8.3 Trial-and-error (T&E) detection

An item is flagged **Trial-and-Error** when any rule fires. Thresholds are template defaults that blueprints can override (INTERACTIVE_TEMPLATES_SPEC §3).

| Rule | Condition | Typical default |
|---|---|---|
| R1 Excess checks | wᵢ > τ_checks | Easy 2, Medium 3, Hard 4 |
| R2 Move inflation | mᵢ > ρ · m̂ᵢ | ρ = 2.5 (2.0 for Easy) |
| R3 Oscillation | the same element toggled or moved back and forth ≥ 3 full cycles within 30 s | template-specific element identity |
| R4 Check spam | ≥ 3 checks within 15 s with ≤ 1 move between consecutive checks | — |
| R5 Enumeration sweep | ≥ 4 consecutive (single-change → check) pairs on the same checkpoint | — |

- **Student view:** an amber chip on the item after it triggers: "Trial-and-error pattern: 5 checks (expected ≤ 2)". The chip states the fact without moralising.
- **Teacher view:** a per-item amber flag and the triggering rule IDs. An attempt is labelled **T&E-dominant** when ≥ 25% of its items are flagged.
- The penalty already lives in `f_w` / `f_m`. The flag adds no further deduction, so nothing is penalised twice.

### 8.4 Integrity trust factor

```
P = Σ_events severity(e)        (per-event caps apply; excused events contribute 0)
I = max(I_floor, 1 − P)         I_floor = 0.50 (configurable)
```

| Event | Severity | Notes |
|---|---|---|
| `fullscreen_exit` | 0.04 + 0.002/s outside, cap 0.15 per event | duration measured until re-entry |
| `tab_hidden` | 0.04 + 0.002/s hidden, cap 0.15 per event | Page Visibility API |
| `window_blur` (without `tab_hidden`) | 0.02 if > 2 s; 0 if ≤ 2 s (logged) | secondary monitor or OS overlay |
| `devtools_suspected` | 0.10 | heuristic, so labelled "suspected" |
| `clipboard_attempt` | 0.02 each, cap 0.06 total | copy/cut/paste blocked and logged |
| `context_menu` | 0.005 each, cap 0.02 total | |
| `print_attempt` / `screenshot_key` | 0.03 | best-effort detection |
| `multi_session` | 0.15 | same student connected from a second device or tab |
| `tamper_suspected` | 0.15 | heartbeat state contradicts the event stream (e.g. non-fullscreen heartbeat with no exit event) |
| `extended_display` | 0 (advisory) | Window Management API, where available |
| `connectivity_gap` | 0 (logged) | network loss is not misconduct |

**Integrity tiers:** **Clean** (I ≥ 0.95, emerald), **Watch** (0.80 ≤ I < 0.95, amber), **Flagged** (I < 0.80, or any `devtools_suspected`, `multi_session`, or `tamper_suspected`; crimson).

### 8.5 Lateness and the composite score

```
Δ = submitted_at − end_time (seconds), late iff Δ > 0
L = 0                                              if policy = accept-flagged
L = min(L_cap, rate · ⌈Δ / step⌉)                  if policy = accept-penalised   (default rate 2%, step 5 min, cap 30%)

Accuracy (pure)   = Σ Dᵢ·Aᵢ / Σ Dᵢ
Mastery (raw)     = Σ Dᵢ·Aᵢ·Mᵢ / Σ Dᵢ              (unattempted items contribute 0; sums over all paper slots)
Composite score S = 100 · min(1, Mastery_raw) · I_applied · (1 − L)
I_applied         = I if integrity mode = enforced, else 1
Marks             = round_to(S/100 · max_marks, 0.5)
```

The Results view always shows **Accuracy, Mastery, I, L and S side by side**. Teachers can see that "S = 64" came from strong accuracy with poor integrity, not from weak understanding.

#### Worked example (6 marks-equivalent paper, max_marks = 10)

| Item | D | A | t / t̂ | m / m̂ | w (ŵ) | f_t | f_m | f_w | M | A·M |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 Easy (`bitbench`) | 1 | 1.00 | 80/90 s | 10/8 | 0 (1) | 1.000 | 1.000 | 1.00 | 1.0000 | 1.0000 |
| 2 Medium (`slicer`) | 2 | 0.75 | 420/300 s | 30/16 | 3 (1) | 0.900 | 0.925 | 0.80 | 0.8625 | 0.6469 |
| 3 Hard (`spf`) | 3 | 1.00 | 500/600 s | 25/22 | 1 (2) | 1.000 | 1.000 | 1.00 | 1.0000 | 1.0000 |

- Accuracy = (1·1 + 2·0.75 + 3·1)/6 = **91.7%**
- Mastery_raw = (1 + 2·0.6469 + 3)/6 = **0.8823**
- Integrity: one tab switch of 12 s (0.04 + 0.024 = 0.064) and one 3 s blur (0.02) → P = 0.084 → I = **0.916** (Watch)
- Late by 3 min under accept-penalised → L = 2% × ⌈180/300⌉ = **0.02**
- S = 100 × 0.8823 × 0.916 × 0.98 = **79.20** → Marks = 7.92 → **8.0 / 10**
- Item 2 is **not** flagged T&E: 3 wrong checks does not exceed τ = 3 for Medium (R1), and 30 moves is under 2.5 × 16 = 40 (R2). Its efficiency penalty still applies. This is deliberate: an imperfect process shows up in the score without a misconduct-style flag.

### 8.6 Dual leaderboards

**Performance and Mastery leaderboard** (teacher; optionally projected after close)
- Rank by S (provisional during the session), tie-break by Accuracy, then by total active time (ascending).
- Columns: rank · student · S · Accuracy · E/M/H accuracy split (three mini-bars) · Σt vs Σt̂ (ratio) · efficiency mean · T&E count · late marker.
- Live updates throttled to 1 Hz with **no rank-shuffle animation storms**: rows move with a 180 ms ease and only when the rank actually changes.

**Integrity monitor** (teacher only, never projected)
- Rank by risk = (1 − I), then by violation count, then by the most recent event.
- Columns: student · tier badge · I · fullscreen exits · tab switches · blurs · other (devtools/clipboard/multi-session) · last event (relative time, absolute on hover) · T&E flags · late Δ.
- A row expands to the event timeline aligned with the item timeline (what item was open when focus was lost).
- "Excuse" acts on a single event and never wipes the whole record.

### 8.7 Analytics (deterministic, v1)

Graders emit **misconception tags** on wrong checkpoints (e.g. `vlsm.not-sorted-desc`, `subnet.usable-off-by-two`, `crc.no-augment`, `hamming.wrong-coverage`, `tcp.syn-no-seq`, `rip.rule3-ignored`, `ios.missing-no-shutdown`). The Results view aggregates them per topic and per student. This works without any AI.

### 8.8 Phase-2: AI insights (optional module)

- Input: a pseudonymised telemetry digest per attempt or per room (topic accuracies, misconception tag counts, T&E patterns, time ratios), with **no names or register numbers**.
- Output: 3–5 short insight statements per student and a class summary ("12 of 64 students computed VLSM blocks without sorting requirements first; revisit Lab 4 step 1").
- Off by default; enabled per institution. Always labelled "AI-generated summary"; never used in scoring. Contract in ARCHITECTURE §11.

## 9. Anti-cheat rules

### 9.1 Principles
1. **Deterrence and evidence, not prevention.** A browser cannot fully control a student's device. The system makes cheating slow and visible, and it gives teachers evidence. It never claims certainty: devtools detection is labelled "suspected".
2. **Proportionality.** Network drops are not misconduct. Brief blurs (≤ 2 s) are logged with zero weight. Teachers can excuse events.
3. **Transparency to students.** Students are told what is monitored before they start and see their own event log afterwards.

### 9.2 Enforced fullscreen
- The attempt can begin only from a user-gesture `requestFullscreen({ navigationUI: "hide" })`.
- When `document.fullscreenElement` becomes null, the canvas is unmounted from view (an overlay replaces it) until fullscreen is re-entered.
- Keyboard: Esc exits fullscreen (browser-controlled; it can't be blocked). The overlay offers a single "Return to full screen" button.

### 9.3 Sensors (client)
| Signal | API / heuristic |
|---|---|
| Fullscreen exit/entry | `fullscreenchange` |
| Tab hidden/visible | `visibilitychange` |
| Window blur/focus | `blur` / `focus` on `window`; deduplicated with visibility (a blur followed by hidden within 150 ms counts as one tab switch) |
| DevTools suspected | F12 / Ctrl+Shift+I/J/C / Ctrl+U keydown; outer-inner size delta > 160 px without a fullscreen change; `debugger` timing probe (off by default; noisy) |
| Clipboard | `copy`/`cut`/`paste` prevented and logged; question text `user-select: none` |
| Context menu | `contextmenu` prevented and logged |
| Print | `beforeprint`, Ctrl+P |
| Screenshot key | `keyup` PrintScreen (Windows only, best-effort) |
| Extended display | `window.screen.isExtended` (Chromium) at start and on change |
| Heartbeat | every 2 s: `{fs, vis, focus, itemId, seq}` |

### 9.4 Server-side integrity
- **Single active session** per (student, room). A new connection takes over and logs `multi_session` against the old one.
- **Tamper detection:** heartbeat state is reconciled with the event stream; sequence gaps and missing heartbeats while the socket is connected raise `tamper_suspected`.
- **Rate limits:** checks are limited to 1 per 1.5 s and 40 per item.
- **Answer secrecy:** no solution on the client; per-field feedback only under the `checkpoint` policy.
- **Per-student watermark:** the register number is tiled at about 3% opacity across the canvas, so a photographed screen can be traced.

### 9.5 Late submissions
- Default `accept-flagged`: `is_late = true`, `late_by_seconds = Δ`, and no deduction unless the policy says otherwise.
- `hard-lock`: auto-submit at `end_time`. Unanswered items score 0; partially completed checkpoints are graded as they stand.
- A teacher extension changes the effective `end_time` for the affected students; lateness is computed against the effective end.

### 9.6 Device policy
- **Supported:** Chrome/Edge ≥ 120, Firefox ≥ 120, Safari ≥ 17 on macOS. Viewport ≥ 1280×720.
- **Phones are blocked** from attempting. iOS Safari lacks the element Fullscreen API on iPhone, and phone screens can't host the canvases.
- **Tablets** (iPadOS Safari, Android Chrome) can be allowed per room. Those attempts are marked "degraded integrity" because fullscreen guarantees are weaker.

## 10. Non-functional requirements

| Area | Requirement |
|---|---|
| Scale | 70 students per room; 60 concurrent rooms (≈ 4,200 concurrent students) at peak without degradation |
| Latency | Check verdict p95 ≤ 300 ms on campus network; teacher dashboard staleness ≤ 2 s |
| Availability | 99.9% during teaching hours (08:00–18:00 IST, Mon–Sat) |
| Resilience | A Wi-Fi drop ≤ 2 min loses no work: client state persists locally (IndexedDB) and the telemetry queue replays in order. The server reconciles from item snapshots. |
| Determinism | Regrading any historical attempt reproduces the original instance byte-for-byte (seed + template version + blueprint version pinned) |
| Security | Institutional SSO; least-privilege roles (student, faculty, coordinator, admin); OWASP ASVS L2; CSP with no third-party scripts on student pages; secrets in a vault |
| Privacy (DPDP Act 2023) | Purpose-limited processing (assessment and integrity); notice at the lobby; retention: telemetry 1 year, scores 7 years (configurable); data in Indian region/on-prem; export/erasure procedures for data-principal requests via the institution |
| Accessibility | WCAG 2.2 AA; every drag interaction has a keyboard alternative; status is never conveyed by colour alone; extra-time accommodation per student |
| Observability | Traces across web → realtime → db; per-room health panel; alerting on check-latency SLO burn |
| Auditability | Every teacher override, excuse, extension, and publish is written to an append-only audit log |

## 11. Success metrics (first semester)

- ≥ 80% of 21CSC302J sections use the Workbench for at least 6 rooms.
- Median teacher setup time ≤ 90 s.
- Student-reported fairness ("my questions were as hard as my neighbour's") ≥ 4/5.
- Correlation between Workbench Mastery and the end-semester theory score r ≥ 0.5. This is the validity check for the scoring model.
- Appeals where the teacher could not produce evidence: 0.

## 12. Release scope

| Release | Contents |
|---|---|
| **MVP (pilot, 1 section)** | SSO, rooms, join, fullscreen + integrity sensors, 6 templates (`bitbench`, `slicer`, `bitforge`, `fib`, `spf`, `ios:build`), scoring, live roster, both leaderboards, CSV export |
| **v1.0 (all sections)** | All 17 templates, ≥ 300 blueprints across U1–U5 and Labs 1–15, replay, overrides, publish, evidence PDF, misconception analytics |
| **v1.1** | AI insights module, coordinator analytics, Safe Exam Browser support for hard-lock rooms, a second course onboarded |

## 13. Assumptions and open questions

| # | Item | Default assumption until confirmed |
|---|---|---|
| A1 | The course materials contain **no Packet Tracer lab manuals**: labs are named in the syllabus only. | Lab templates model standard Cisco IOS 15.x procedures on PT's default 1941/2911 routers and 2960 switches. Faculty to share the department's lab record templates for exact command sequences and device models. |
| A2 | Institutional SSO provider (Microsoft Entra ID or Google Workspace) | OIDC through Auth.js supports either; to be confirmed with SRMIST IT. |
| A3 | Hosting | On-prem VM cluster in the SRMIST datacenter preferred; otherwise a cloud region in India (ap-south-1). |
| A4 | Marks format | CSV with register number as the key; scaled to `max_marks` per room. To align with the department's CLA sheets. |
| A5 | Lab-desktop logins | Shared desktops use register number + one-time room PIN with teacher approval if SSO is impractical in labs. |
| A6 | Classroom Wi-Fi capacity | 70 concurrent long-lived connections per room are assumed feasible; long-polling fallback covers restrictive proxies. |

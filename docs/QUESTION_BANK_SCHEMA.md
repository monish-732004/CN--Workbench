# QUESTION BANK SCHEMA — SRM CN Workbench

**Status:** v1.0 · 2026-11-19
**Package:** `@cn/protocol` (types and Zod schemas) · `packages/bank/` (blueprint JSON files, reviewed by PR)
**Read with:** [INTERACTIVE_TEMPLATES_SPEC.md](INTERACTIVE_TEMPLATES_SPEC.md) (template modes, checkpoints, moves) · [ARCHITECTURE.md §6](ARCHITECTURE.md) (generation, uniqueness, secrecy)

---

## 1. Model

```
Course taxonomy (data)        Template (code)              Blueprint (data, authored)           Instance (per student)
──────────────────────        ───────────────              ──────────────────────────           ──────────────────────
Unit → Topic, Lab  ◄─tags──   generate / solve / grade ◄── template + mode + difficulty +   ──► seed + params (server)
                              fingerprint / moves           knobs + fingerprint + checkpoints     publicView (client)
                                                            + timing + prompt                     solution (server)
```

- A **blueprint** is a reusable, parameterised question. It never contains concrete answers.
- An **instance** is a blueprint resolved for one attempt slot. The same blueprint gives every student different values with identical complexity.
- **Lifecycle:** `draft → review → active → retired`. A blueprint becomes `active` only after CI validation (§5) and a faculty review. Any change to knobs, fingerprint, checkpoints, or prompt bumps `version`. Historical attempts keep pointing at the version they used.

## 2. TypeScript contracts (`@cn/protocol`)

```ts
// ───────── Taxonomy ─────────
export type NodeKind = "unit" | "topic" | "lab";
export interface SyllabusNode {
  id: string;                 // "u3.rip", "lab08"
  kind: NodeKind;
  parent?: string;            // "u3" for topics; official unit for labs ("u3" for lab07)
  title: string;
  ordinal: number;
  crossLinks?: string[];      // labs → theory topics, e.g. lab10 → ["u3.ospf"]
  co: CourseOutcome[];
}
export type CourseOutcome = "CO1" | "CO2" | "CO3" | "CO4" | "CO5";
export type Bloom = 1 | 2 | 3 | 4 | 5 | 6;   // Remember … Create

// ───────── Blueprint ─────────
export type Difficulty = "easy" | "medium" | "hard";
export type TemplateId =
  | "pinout" | "patchbay" | "encap" | "delayline" | "bitbench" | "slicer" | "nat" | "fib" | "ios"
  | "spf" | "vectors" | "medium" | "arq" | "bitforge" | "frame" | "hexdump" | "ladder";
export type ToolId = "calc-basic" | "calc-programmer" | "port-registry" | "scratchpad";

export interface CheckpointDef {
  id: string;                 // "sizing"
  title: string;              // "Size each subnet"
  weight: number;             // relative; normalised by the engine
  fields?: string[];          // gradable field paths (template-specific)
  sequential?: boolean;       // must be checked after the previous checkpoint
  ecf?: boolean;              // error-carried-forward grading (INTERACTIVE_TEMPLATES_SPEC §2.3)
  maxChecks?: number;         // default 4
}

export interface TERuleConfig {
  tauChecks: number;          // R1
  freeWrong: number;          // ŵ in f_w
  rho: number;                // R2
  oscillation: { cycles: number; windowS: number };   // R3
  checkSpam: { checks: number; windowS: number; maxMovesBetween: number }; // R4
  sweep: { pairs: number };   // R5
}

export interface Blueprint {
  $schema: "cnwb/blueprint@1";
  id: string;                 // "<primary-node>.<template>.<e|m|h><nn>", e.g. "u2.vlsm.slicer.m01"
  version: number;
  course: string;             // "21CSC302J"
  title: string;              // teacher-facing label
  template: { id: TemplateId; range: string; mode: string };
  difficulty: Difficulty;
  tags: { nodes: string[]; co: CourseOutcome[]; bloom: Bloom };
  convention: "forouzan" | "cisco-ios";
  prompt: { title: string; body: string };   // Markdown with {{param}} placeholders, rendered server-side
  knobs: Record<string, unknown>;            // validated by the template's knob schema
  fingerprint: Record<string, unknown>;      // target complexity (must match every generated instance)
  checkpoints: CheckpointDef[];
  timing: { expectedTimeS: number; optimalMoves: "solver" | number };
  te?: Partial<TERuleConfig>;
  tools?: ToolId[];
  space: { minUnique: number; lowEntropyCore?: boolean };
  review: { status: "draft" | "review" | "active" | "retired"; sourceRefs: string[]; notes?: string };
}

// ───────── Instance ─────────
export interface Instance<P = unknown, Pub = unknown, Sol = unknown> {
  blueprint: { id: string; version: number };
  template: { id: TemplateId; version: string };
  seed: string;               // 32 hex chars (128 bits)
  instanceIndex?: string;     // bigint as string, when room-scoped allocation was used
  source: "generated" | "pool";
  params: P;                  // SERVER ONLY
  publicView: Pub;            // the only part sent to the client
  solution: Sol;              // SERVER ONLY
  fingerprint: Record<string, unknown>;
  optimalMoves: number;
  expectedTimeS: number;
}

// ───────── Responses and verdicts ─────────
export interface CheckRequest { itemId: string; checkpointId: string; response: unknown; idemKey: string; clientSeq: number }
export interface Verdict {
  checkpointId: string;
  status: "correct" | "incorrect" | "partial" | "locked";
  score?: number;                          // shown only if policy allows
  fieldResults?: Record<string, boolean>;  // only under feedback = "checkpoint"
  wrongChecks: number; checksLeft: number;
  teFlag?: { rules: string[]; message: string };
  serverNow: number;
}

// ───────── Telemetry ─────────
export type TelemetryType =
  | "item_open" | "item_leave" | "move" | "undo" | "redo" | "reset" | "select" | "field_commit"
  | "cli_line" | "check_click" | "tool_open" | "zoom" | "nav";
export interface TelemetryEvent {
  seq: number; t: number;     // performance.now() ms
  itemId: string; type: TelemetryType;
  data?: { element?: string; from?: unknown; to?: unknown; [k: string]: unknown };
}
```

Each template ships Zod schemas for its `knobs`, `params`, `publicView`, `solution`, `response`, and `telemetry.data`. They are registered in `@cn/engine/registry.ts` and used by CI, Studio previews, and runtime validation.

## 3. Syllabus taxonomy file (`packages/syllabus/21CSC302J.json`, excerpt)

```json
{
  "course": { "code": "21CSC302J", "title": "Computer Networks", "regulation": "2021", "ltpc": "3-0-2-4" },
  "outcomes": {
    "CO1": "Apply the knowledge of communication",
    "CO2": "Construct the network using addressing schemes",
    "CO3": "Design and implement the various routing protocols",
    "CO4": "Identify and correct the errors in transmission",
    "CO5": "Analyze the services provided by transport and application layers"
  },
  "nodes": [
    { "id": "u1", "kind": "unit", "title": "Introduction to Networks", "ordinal": 1, "co": ["CO1"] },
    { "id": "u1.topology", "kind": "topic", "parent": "u1", "title": "Network topology: bus, star, ring, mesh, hybrid", "ordinal": 2, "co": ["CO1"] },
    { "id": "u1.guided", "kind": "topic", "parent": "u1", "title": "Guided media: twisted pair, coaxial, fiber optic", "ordinal": 8, "co": ["CO1"] },
    { "id": "lab01", "kind": "lab", "parent": "u1", "title": "Packet Tracer intro, peer-to-peer, cables and colour codes", "ordinal": 1, "crossLinks": ["u1.guided"], "co": ["CO1"] },
    { "id": "lab03", "kind": "lab", "parent": "u1", "title": "Router configuration: passwords, interfaces", "ordinal": 3, "crossLinks": ["ios.basics"], "co": ["CO1", "CO3"] },
    { "id": "u2.vlsm", "kind": "topic", "parent": "u2", "title": "VLSM", "ordinal": 7, "co": ["CO2"] },
    { "id": "lab04", "kind": "lab", "parent": "u2", "title": "IP addressing and subnetting (VLSM)", "ordinal": 4, "crossLinks": ["u2.vlsm"], "co": ["CO2"] },
    { "id": "lab10", "kind": "lab", "parent": "u4", "title": "Multi-area OSPF", "ordinal": 10, "crossLinks": ["u3.ospf"], "co": ["CO3"] },
    { "id": "lab13", "kind": "lab", "parent": "u5", "title": "BGP", "ordinal": 13, "crossLinks": ["u3.bgp"], "co": ["CO3"] }
  ]
}
```

The full file lists every node in PRD §3. A non-syllabus support node, `ios.basics`, holds IOS mode and command fundamentals shared by several labs.

## 4. Authoring rules

1. **No static MCQ.** `template.mode` must be an interactive mode. A selection sub-step is valid only when its correct option depends on per-instance parameters. CI rejects blueprints whose answer is identical across 50 random seeds unless `space.lowEntropyCore` is set; that flag is allowed only for Easy recall items.
2. **Prompt hygiene.** `prompt.body` may reference `{{params}}` but never solution fields. CI renders 1,000 instances and fails if any solution leaf appears in the rendered prompt or `publicView`.
3. **Indirect values for labs.** Prefer "first usable address of {{lanBlock}}" over "10.14.32.65". This forces the computation and multiplies the parameter space.
4. **Convention declared.** Theory items use `forouzan`; IOS items use `cisco-ios` (PRD §3.1).
5. **Source refs.** Every blueprint cites where the concept is taught: deck page, Forouzan section/example, or lab number. Values are never copied from slides, because the slides contain transcription slips.
6. **Space.** `space.minUnique ≥ 140`, so a full section never shares an instance (ARCHITECTURE §6.4).
7. **Timing.** `expectedTimeS` starts from the template default (INTERACTIVE_TEMPLATES_SPEC §4) and is recalibrated after the pilot. `optimalMoves` should be `"solver"` unless it is constant across instances.
8. **Bloom tagging** follows the CLA mix (L1 Remember, L3 Apply, L5 Evaluate dominate): fault-hunt → 5, construction → 3, classification inside interaction → 2.

## 5. CI validation pipeline (`pnpm bank:validate`)

| Stage | Check |
|---|---|
| Schema | Zod-valid `Blueprint`; knobs valid for the template version range |
| Taxonomy | every `tags.nodes` id exists; labs resolve cross-links |
| Generation | 10,000 seeds: fingerprint match, generation within budget, `space ≥ minUnique` |
| Solvability | `grade(solve(p)) = 1.0` on all checkpoints |
| Sensitivity | each single-field perturbation of the solution scores < 1.0 and emits ≥ 1 misconception tag |
| Moves | `optimalMoves` (solver) is stable for the fingerprint; constant if declared constant |
| Secrecy | no solution leaf in the rendered prompt or `publicView` |
| Golden | blueprints with `sourceRefs` to a textbook example reproduce that example under a pinned "golden seed" |
| Coverage | after the change, every syllabus node still has ≥ 1 active blueprint per difficulty, or an explicit waiver |

**Bank size targets for v1.0:** ≥ 300 active blueprints. That is ≥ 15 per unit per difficulty (225), plus ≥ 5 per lab across difficulties (75).

---

## 6. Sample payloads

Each sample shows the **blueprint** (authored JSON, as stored in `packages/bank/`) and one **resolved instance** for a fixed demo seed: params, the client-visible view in abridged form, the server-side solution, and m̂. All solutions below were computed independently and are used as golden tests.

> Format note: `publicView` excerpts are abridged with `…`; the real payloads also carry layout hints (positions, IDs) for the renderer.

### Unit 1 — Introduction to Networks

#### U1-E · Lab 1 · Crimp an RJ-45 end (`pinout:crimp`)

```json
{
  "$schema": "cnwb/blueprint@1",
  "id": "lab01.pinout.e01", "version": 1, "course": "21CSC302J",
  "title": "Crimp one end to a named TIA-568 standard",
  "template": { "id": "pinout", "range": "^1.0", "mode": "crimp" },
  "difficulty": "easy",
  "tags": { "nodes": ["lab01", "u1.guided"], "co": ["CO1"], "bloom": 1 },
  "convention": "cisco-ios",
  "prompt": { "title": "Crimp the connector", "body": "Terminate this end of the cable to **{{standard}}**. Pin 1 is on the left with the clip facing down." },
  "knobs": { "standards": ["T568A", "T568B"], "context": { "devicePairs": ["PC-Switch", "Switch-Router", "PC-Hub"] } },
  "fingerprint": { "conductors": 8, "preplaced": 0 },
  "checkpoints": [ { "id": "order", "title": "Pin order", "weight": 1, "fields": ["pins[1..8]"] } ],
  "timing": { "expectedTimeS": 75, "optimalMoves": 8 },
  "space": { "minUnique": 2, "lowEntropyCore": true },
  "review": { "status": "active", "sourceRefs": ["Syllabus Lab 1", "U1 deck p.87–93 (twisted pair, RJ-45)"] }
}
```

```json
{
  "params": { "standard": "T568A", "devicePair": "Switch-Router", "tray": ["Br", "W/O", "G", "W/B", "B", "W/G", "O", "W/Br"] },
  "publicView": { "standard": "T568A", "pins": [null, null, null, null, null, null, null, null], "tray": ["Br", "W/O", "G", "W/B", "B", "W/G", "O", "W/Br"] },
  "solution": { "pins": ["W/G", "G", "W/O", "B", "W/B", "O", "W/Br", "Br"] },
  "optimalMoves": 8
}
```

#### U1-M · Lab 1 · Choose the cable and crimp end B (`pinout:select`)

```json
{
  "$schema": "cnwb/blueprint@1",
  "id": "lab01.pinout.m01", "version": 1, "course": "21CSC302J",
  "title": "Pick straight/crossover/rollover for a device pair, then crimp end B",
  "template": { "id": "pinout", "range": "^1.0", "mode": "select" },
  "difficulty": "medium",
  "tags": { "nodes": ["lab01", "u1.guided"], "co": ["CO1"], "bloom": 3 },
  "convention": "cisco-ios",
  "prompt": { "title": "Patch {{deviceA}} to {{deviceB}}", "body": "End A is already crimped. Choose the cable this link needs in Packet Tracer (no Auto-MDIX), then crimp end B." },
  "knobs": { "devicePairs": ["PC-Switch", "Switch-Router", "PC-Hub", "PC-PC", "Switch-Switch", "Router-Router", "PC-Router", "Hub-Switch", "PC-Router(console)"], "endAStandards": ["T568A", "T568B"] },
  "fingerprint": { "decisions": 1, "conductors": 8 },
  "checkpoints": [
    { "id": "cable", "title": "Cable type", "weight": 0.3, "fields": ["cableType"] },
    { "id": "endB", "title": "End B pin order", "weight": 0.7, "fields": ["pins[1..8]"], "ecf": true }
  ],
  "timing": { "expectedTimeS": 120, "optimalMoves": 9 },
  "space": { "minUnique": 18, "lowEntropyCore": true },
  "review": { "status": "active", "sourceRefs": ["Syllabus Lab 1"], "notes": "ECF: end B graded against the student's chosen cable type at 0.75." }
}
```

```json
{
  "params": { "deviceA": "PC", "deviceB": "Router (Gi0/0)", "endA": "T568B" },
  "publicView": { "devices": ["PC0", "R1 Gi0/0"], "endA": { "standard": "T568B", "pins": ["W/O", "O", "W/G", "B", "W/B", "G", "W/Br", "Br"] }, "spools": ["straight", "crossover", "rollover"], "endB": { "pins": [null, null, null, null, null, null, null, null] } },
  "solution": { "cableType": "crossover", "endB": ["W/G", "G", "W/O", "B", "W/B", "O", "W/Br", "Br"] },
  "optimalMoves": 9
}
```

#### U1-M · Latency budget (`delayline:latency`)

```json
{
  "$schema": "cnwb/blueprint@1",
  "id": "u1.performance.delayline.m01", "version": 1, "course": "21CSC302J",
  "title": "Compose latency from four delays and find the dominant one",
  "template": { "id": "delayline", "range": "^1.0", "mode": "latency" },
  "difficulty": "medium",
  "tags": { "nodes": ["u1.performance"], "co": ["CO1"], "bloom": 3 },
  "convention": "forouzan",
  "prompt": { "title": "How long until the last bit arrives?", "body": "A {{size}} message crosses {{distanceKm}} km of cable (propagation speed {{speed}}) on a {{bandwidth}} link. Queuing adds {{queue}} and processing adds {{proc}}. Build the latency on the timeline." },
  "knobs": { "distanceKm": [500, 12000], "speeds": ["2.4e8"], "sizes": { "unit": "KB", "range": [5, 50], "kbIs": 1000 }, "bandwidthsMbps": [10, 100, 1000], "queueMs": [1, 5], "procUs": [100, 900] },
  "fingerprint": { "components": 4, "unitConversions": 2, "dominant": "any" },
  "checkpoints": [
    { "id": "components", "title": "Each delay", "weight": 0.6, "fields": ["tx", "prop", "queue", "proc"] },
    { "id": "total", "title": "Latency", "weight": 0.3, "fields": ["total"], "ecf": true },
    { "id": "dominant", "title": "Dominant delay", "weight": 0.1, "fields": ["dominant"] }
  ],
  "timing": { "expectedTimeS": 180, "optimalMoves": "solver" },
  "tools": ["calc-basic"],
  "space": { "minUnique": 2000 },
  "review": { "status": "active", "sourceRefs": ["U1 deck p.78–82", "Forouzan 5e Ex. 3.45–3.47"] }
}
```

```json
{
  "params": { "distanceKm": 3600, "speed": 240000000, "sizeBytes": 15000, "bandwidthBps": 100000000, "queueUs": 2000, "procUs": 500 },
  "publicView": { "size": "15 KB", "distance": "3,600 km", "speed": "2.4 × 10⁸ m/s", "bandwidth": "100 Mbps", "queue": "2 ms", "proc": "0.5 ms", "axis": { "maxUs": 25000, "scale": "linear" } },
  "solution": { "propUs": 15000, "txUs": 1200, "queueUs": 2000, "procUs": 500, "totalUs": 18700, "dominant": "propagation" },
  "optimalMoves": 10
}
```

Working: prop = 3.6×10⁶ m ÷ 2.4×10⁸ m/s = 15 ms; tx = 15,000 × 8 = 120,000 bits ÷ 10⁸ bps = 1.2 ms; total = 15 + 1.2 + 2 + 0.5 = **18.7 ms**. m̂ = 4 segments + 5 values + 1 dominant.

#### U1-H · Lab 3 · Secure and address a router (`ios:build`)

```json
{
  "$schema": "cnwb/blueprint@1",
  "id": "lab03.ios.h01", "version": 1, "course": "21CSC302J",
  "title": "Basic router hardening and interface addressing from CIDR objectives",
  "template": { "id": "ios", "range": "^1.0", "mode": "build" },
  "difficulty": "hard",
  "tags": { "nodes": ["lab03", "ios.basics", "u2.mask"], "co": ["CO1", "CO3"], "bloom": 3 },
  "convention": "cisco-ios",
  "prompt": { "title": "Bring {{hostname}} online", "body": "Configure the router so that every objective on the right is met. Addresses must be derived from the blocks shown on the topology." },
  "knobs": {
    "model": ["1941"],
    "objectives": ["hostname", "enableSecret", "servicePasswordEncryption", "consoleLogin", "vtyLogin", "lanFirstUsable", "wanLastUsableDce"],
    "lanPrefix": [26, 28], "wanPrefix": [30],
    "passwordStyle": "pronounceable8"
  },
  "fingerprint": { "objectives": 7, "computedValues": 2, "modesVisited": 5 },
  "checkpoints": [
    { "id": "security", "title": "Security", "weight": 0.45, "fields": ["hostname", "enableSecret", "servicePasswordEncryption", "console", "vty"] },
    { "id": "interfaces", "title": "Interfaces", "weight": 0.55, "fields": ["Gi0/0", "Se0/0/0"] }
  ],
  "timing": { "expectedTimeS": 480, "optimalMoves": "solver" },
  "space": { "minUnique": 100000 },
  "review": { "status": "active", "sourceRefs": ["Syllabus Lab 3", "U2 deck p.61–71 (first/last address)"] }
}
```

```json
{
  "params": {
    "hostname": "TAMBARAM-GW", "enableSecret": "kavu7rin", "consolePw": "pelto3ma", "vtyPw": "zirok5ta",
    "lanBlock": "10.14.32.64/27", "wanBlock": "172.19.4.8/30", "dceInterface": "Serial0/0/0"
  },
  "publicView": {
    "prompt": "R1 > ",
    "topology": { "R1": { "Gi0/0": "LAN 10.14.32.64/27 (router = first usable)", "Se0/0/0": "WAN 172.19.4.8/30 (router = last usable, DCE end)" } },
    "objectives": ["Hostname TAMBARAM-GW", "Privileged EXEC protected by an encrypted secret: kavu7rin", "No plain-text passwords in running-config", "Console requires password pelto3ma", "Telnet/VTY 0–4 requires password zirok5ta", "Gi0/0 addressed and up", "Se0/0/0 addressed, clocked at 64000, and up"]
  },
  "solution": {
    "state": {
      "hostname": "TAMBARAM-GW", "enableSecret": "kavu7rin", "servicePasswordEncryption": true,
      "line": { "con0": { "password": "pelto3ma", "login": true }, "vty0-4": { "password": "zirok5ta", "login": true } },
      "interfaces": {
        "GigabitEthernet0/0": { "ip": "10.14.32.65", "mask": "255.255.255.224", "shutdown": false },
        "Serial0/0/0": { "ip": "172.19.4.10", "mask": "255.255.255.252", "clockRate": 64000, "shutdown": false }
      }
    },
    "canonicalLines": [
      "enable", "configure terminal", "hostname TAMBARAM-GW", "enable secret kavu7rin", "service password-encryption",
      "line console 0", "password pelto3ma", "login", "line vty 0 4", "password zirok5ta", "login",
      "interface GigabitEthernet0/0", "ip address 10.14.32.65 255.255.255.224", "no shutdown",
      "interface Serial0/0/0", "ip address 172.19.4.10 255.255.255.252", "clock rate 64000", "no shutdown"
    ]
  },
  "optimalMoves": 18
}
```

#### U1-M · Lab 2 · Complete a full mesh (`patchbay:count`)

```json
{
  "$schema": "cnwb/blueprint@1",
  "id": "u1.topology.patchbay.m01", "version": 1, "course": "21CSC302J",
  "title": "Finish a partial full mesh and state link and port counts",
  "template": { "id": "patchbay", "range": "^1.0", "mode": "count" },
  "difficulty": "medium",
  "tags": { "nodes": ["u1.topology", "lab02"], "co": ["CO1"], "bloom": 3 },
  "convention": "forouzan",
  "prompt": { "title": "Complete the mesh", "body": "These {{n}} routers must form a fully connected mesh using serial links. Add only the missing links, then enter the total number of links and the number of I/O ports each router needs." },
  "knobs": { "n": [5, 7], "prebuiltFraction": [0.5, 0.7] },
  "fingerprint": { "n": 6, "missing": 6 },
  "checkpoints": [
    { "id": "links", "title": "Missing links", "weight": 0.6, "fields": ["edges"] },
    { "id": "counts", "title": "Counts", "weight": 0.4, "fields": ["totalLinks", "portsPerDevice"] }
  ],
  "timing": { "expectedTimeS": 200, "optimalMoves": 8 },
  "space": { "minUnique": 5000 },
  "review": { "status": "active", "sourceRefs": ["U1 deck p.20 (n(n−1)/2, n−1 ports)"] }
}
```

```json
{
  "params": { "n": 6, "nodes": ["R1", "R2", "R3", "R4", "R5", "R6"], "prebuilt": [["R1","R2"],["R1","R3"],["R1","R4"],["R2","R3"],["R2","R5"],["R3","R6"],["R4","R5"],["R4","R6"],["R5","R6"]] },
  "publicView": { "nodes": ["R1", "R2", "R3", "R4", "R5", "R6"], "edges": "prebuilt (9)", "media": ["serial"] },
  "solution": { "missing": [["R1","R5"],["R1","R6"],["R2","R4"],["R2","R6"],["R3","R4"],["R3","R5"]], "totalLinks": 15, "portsPerDevice": 5 },
  "optimalMoves": 8
}
```

### Unit 2 — Addressing

#### U2-E · Network and broadcast by bits (`bitbench:mask`)

```json
{
  "$schema": "cnwb/blueprint@1",
  "id": "u2.mask.bitbench.e01", "version": 1, "course": "21CSC302J",
  "title": "Find the block of an address with a last-octet prefix",
  "template": { "id": "bitbench", "range": "^1.0", "mode": "mask" },
  "difficulty": "easy",
  "tags": { "nodes": ["u2.mask", "u2.classless", "u2.classful"], "co": ["CO2"], "bloom": 3 },
  "convention": "forouzan",
  "prompt": { "title": "Which block is {{address}} in?", "body": "Set the prefix boundary, then produce the network (first) and broadcast (last) addresses by editing the host bits. Finish with the address counts." },
  "knobs": { "prefix": [25, 30], "classes": ["A", "B", "C"], "avoid": ["0/8", "127/8", "224/3"] },
  "fingerprint": { "boundaryOctet": 4 },
  "checkpoints": [
    { "id": "mask", "title": "Mask", "weight": 0.2, "fields": ["prefix"] },
    { "id": "network", "title": "Network address", "weight": 0.3, "fields": ["networkBits"], "ecf": true },
    { "id": "broadcast", "title": "Broadcast address", "weight": 0.3, "fields": ["broadcastBits"], "ecf": true },
    { "id": "counts", "title": "Addresses and usable hosts", "weight": 0.2, "fields": ["addresses", "usable"] }
  ],
  "timing": { "expectedTimeS": 90, "optimalMoves": "solver" },
  "tools": ["calc-basic"],
  "space": { "minUnique": 1000000 },
  "review": { "status": "active", "sourceRefs": ["U2 deck p.61–68", "Forouzan 5e Ex. 18.1"] }
}
```

```json
{
  "params": { "address": "172.22.37.150", "prefix": 27 },
  "publicView": { "address": "172.22.37.150 /27", "addressBits": "10101100 00010110 00100101 10010110" },
  "solution": {
    "mask": "255.255.255.224",
    "network": "172.22.37.128", "networkBits": "10101100 00010110 00100101 10000000",
    "broadcast": "172.22.37.159", "broadcastBits": "10101100 00010110 00100101 10011111",
    "addresses": 32, "usable": 30, "class": "B"
  },
  "optimalMoves": 8
}
```

m̂ = 1 boundary + 5 host-bit edits (3 clears for the network row, 2 sets for the broadcast row) + 2 counts.

#### U2-M · Lab 4 · VLSM plan (`slicer:vlsm`)

```json
{
  "$schema": "cnwb/blueprint@1",
  "id": "lab04.slicer.m01", "version": 1, "course": "21CSC302J",
  "title": "VLSM: four LANs and one WAN inside a /24",
  "template": { "id": "slicer", "range": "^1.0", "mode": "vlsm" },
  "difficulty": "medium",
  "tags": { "nodes": ["lab04", "u2.vlsm", "u2.classless"], "co": ["CO2"], "bloom": 3 },
  "convention": "forouzan",
  "prompt": { "title": "Plan {{block}}", "body": "Allocate a subnet to each requirement using VLSM. Allocate the largest requirement first, from the lowest free address. Fill in each subnet's host range." },
  "knobs": { "parentPrefix": 24, "lans": 4, "wans": 1, "hostRanges": [[33, 62], [17, 30], [9, 14], [3, 6]], "placementPolicy": "canonical", "inputOrder": "shuffled" },
  "fingerprint": { "k": 5, "prefixes": [26, 27, 28, 29, 30], "crossesOctet": false },
  "checkpoints": [
    { "id": "sizing", "title": "Prefix for each requirement", "weight": 0.3, "fields": ["prefix[*]"] },
    { "id": "placement", "title": "Placement", "weight": 0.3, "fields": ["network[*]"], "sequential": true },
    { "id": "ranges", "title": "Host ranges", "weight": 0.4, "fields": ["first[*]", "last[*]", "broadcast[*]", "mask[*]"], "ecf": true }
  ],
  "timing": { "expectedTimeS": 300, "optimalMoves": "solver" },
  "space": { "minUnique": 50000 },
  "review": { "status": "active", "sourceRefs": ["U2 deck p.96–104", "Syllabus Lab 4"] }
}
```

```json
{
  "params": { "block": "192.168.40.0/24", "requirements": [ { "id": "C", "hosts": 12 }, { "id": "WAN", "hosts": 2 }, { "id": "A", "hosts": 60 }, { "id": "D", "hosts": 5 }, { "id": "B", "hosts": 28 } ] },
  "publicView": { "block": "192.168.40.0/24", "chips": ["LAN C · 12 hosts", "WAN · 2 hosts", "LAN A · 60 hosts", "LAN D · 5 hosts", "LAN B · 28 hosts"], "bar": { "from": "192.168.40.0", "to": "192.168.40.255", "grid": 4 } },
  "solution": {
    "subnets": [
      { "id": "A",   "prefix": 26, "mask": "255.255.255.192", "network": "192.168.40.0",   "first": "192.168.40.1",   "last": "192.168.40.62",  "broadcast": "192.168.40.63" },
      { "id": "B",   "prefix": 27, "mask": "255.255.255.224", "network": "192.168.40.64",  "first": "192.168.40.65",  "last": "192.168.40.94",  "broadcast": "192.168.40.95" },
      { "id": "C",   "prefix": 28, "mask": "255.255.255.240", "network": "192.168.40.96",  "first": "192.168.40.97",  "last": "192.168.40.110", "broadcast": "192.168.40.111" },
      { "id": "D",   "prefix": 29, "mask": "255.255.255.248", "network": "192.168.40.112", "first": "192.168.40.113", "last": "192.168.40.118", "broadcast": "192.168.40.119" },
      { "id": "WAN", "prefix": 30, "mask": "255.255.255.252", "network": "192.168.40.120", "first": "192.168.40.121", "last": "192.168.40.122", "broadcast": "192.168.40.123" }
    ],
    "free": "192.168.40.124 – 192.168.40.255"
  },
  "optimalMoves": 30
}
```

m̂ = 5 sizing + 5 placements + 5 × 4 range fields.

#### U2-M · Collision and broadcast domains (`patchbay:domains`)

```json
{
  "$schema": "cnwb/blueprint@1",
  "id": "u2.devices.patchbay.m01", "version": 1, "course": "21CSC302J",
  "title": "Paint collision and broadcast domains across a router, switch and hub",
  "template": { "id": "patchbay", "range": "^1.0", "mode": "domains" },
  "difficulty": "medium",
  "tags": { "nodes": ["u2.devices"], "co": ["CO2"], "bloom": 4 },
  "convention": "forouzan",
  "prompt": { "title": "Mark the domains", "body": "Use the collision brush to mark every collision domain, then the broadcast brush to mark every broadcast domain." },
  "knobs": { "routers": [1, 1], "switches": [1, 2], "hubs": [1, 1], "bridges": [0, 0], "hostsPerSegment": [2, 5] },
  "fingerprint": { "collisionDomains": 6, "broadcastDomains": 2 },
  "checkpoints": [
    { "id": "collision", "title": "Collision domains", "weight": 0.5, "fields": ["collisionPartition"] },
    { "id": "broadcast", "title": "Broadcast domains", "weight": 0.5, "fields": ["broadcastPartition"] }
  ],
  "timing": { "expectedTimeS": 180, "optimalMoves": "solver" },
  "space": { "minUnique": 400 },
  "review": { "status": "active", "sourceRefs": ["U2 deck p.4–29 (hub, repeater, switch, bridge, router)"] }
}
```

```json
{
  "params": { "topology": { "R1": { "Gi0/0": "SW1", "Gi0/1": "HUB1" }, "SW1": ["PC1", "PC2", "PC3", "PC4"], "HUB1": ["PC5", "PC6", "PC7"] } },
  "publicView": { "devices": ["R1", "SW1", "HUB1", "PC1…PC7"], "links": 9 },
  "solution": {
    "collision": [["PC1-SW1"], ["PC2-SW1"], ["PC3-SW1"], ["PC4-SW1"], ["R1-SW1"], ["PC5-HUB1", "PC6-HUB1", "PC7-HUB1", "R1-HUB1"]],
    "broadcast": [["PC1-SW1", "PC2-SW1", "PC3-SW1", "PC4-SW1", "R1-SW1"], ["PC5-HUB1", "PC6-HUB1", "PC7-HUB1", "R1-HUB1"]]
  },
  "optimalMoves": 8
}
```

m̂ = 6 collision strokes + 2 broadcast strokes; one lasso stroke defines one domain.

#### U2-H · Lab 6 · PAT with a port conflict (`nat:pat`)

```json
{
  "$schema": "cnwb/blueprint@1",
  "id": "lab06.nat.h01", "version": 1, "course": "21CSC302J",
  "title": "PAT: three flows, a source-port conflict, a reply and an unsolicited packet",
  "template": { "id": "nat", "range": "^1.0", "mode": "pat" },
  "difficulty": "hard",
  "tags": { "nodes": ["lab06", "u2.nat"], "co": ["CO2"], "bloom": 4 },
  "convention": "forouzan",
  "prompt": { "title": "Run the NAT router", "body": "{{router}} overloads {{publicIp}} for {{insideNet}}. Step each packet. Maintain the translation table and rewrite headers. Drop anything without a translation." },
  "knobs": { "insideNets": ["192.168.0.0/16"], "publicPools": ["203.0.113.0/24", "198.51.100.0/24"], "flows": 3, "conflicts": 1, "replies": 1, "unsolicited": 1, "protocols": ["TCP", "UDP"] },
  "fingerprint": { "events": 5, "conflicts": 1, "drops": 1 },
  "checkpoints": [
    { "id": "f1", "title": "Packet 1", "weight": 1 },
    { "id": "f2", "title": "Packet 2", "weight": 1.5 },
    { "id": "f3", "title": "Packet 3", "weight": 1 },
    { "id": "r1", "title": "Reply", "weight": 1.5, "ecf": true },
    { "id": "u1", "title": "Inbound packet", "weight": 1 }
  ],
  "timing": { "expectedTimeS": 360, "optimalMoves": "solver" },
  "space": { "minUnique": 100000 },
  "review": { "status": "active", "sourceRefs": ["U2 deck p.107–114", "Forouzan 5e Table 18.1", "Syllabus Lab 6"], "notes": "Conflict port: any free public port is accepted; the reply is graded against the student's own table (ECF)." }
}
```

```json
{
  "params": {
    "router": "R-EDGE", "publicIp": "203.0.113.18", "insideNet": "192.168.12.0/24",
    "events": [
      { "id": "f1", "dir": "out", "src": "192.168.12.10:51000", "dst": "198.51.100.7:80", "proto": "TCP" },
      { "id": "f2", "dir": "out", "src": "192.168.12.11:51000", "dst": "198.51.100.7:80", "proto": "TCP" },
      { "id": "f3", "dir": "out", "src": "192.168.12.12:49152", "dst": "192.0.2.53:53", "proto": "UDP" },
      { "id": "r1", "dir": "in", "src": "198.51.100.7:80", "dst": "203.0.113.18:{{studentPortForF2}}", "proto": "TCP" },
      { "id": "u1", "dir": "in", "src": "198.51.100.99:4444", "dst": "203.0.113.18:3389", "proto": "TCP" }
    ]
  },
  "publicView": { "table": [], "queue": ["f1", "f2", "f3", "r1", "u1"], "interfaces": { "inside": "Gi0/0", "outside": "Se0/0/0 (203.0.113.18)" } },
  "solution": {
    "rows": [
      { "privateIp": "192.168.12.10", "privatePort": 51000, "publicIp": "203.0.113.18", "publicPort": 51000, "dest": "198.51.100.7:80", "proto": "TCP" },
      { "privateIp": "192.168.12.11", "privatePort": 51000, "publicIp": "203.0.113.18", "publicPort": { "rule": "unique-and-not-51000" }, "dest": "198.51.100.7:80", "proto": "TCP" },
      { "privateIp": "192.168.12.12", "privatePort": 49152, "publicIp": "203.0.113.18", "publicPort": 49152, "dest": "192.0.2.53:53", "proto": "UDP" }
    ],
    "rewrites": { "f1": { "src": "203.0.113.18:51000" }, "f2": { "src": "203.0.113.18:<row2.publicPort>" }, "f3": { "src": "203.0.113.18:49152" }, "r1": { "dst": "192.168.12.11:51000" } },
    "u1": "drop"
  },
  "optimalMoves": 19
}
```

### Unit 3 — Routing

#### U3-E · IPv6 zero compression and block type (`bitbench:ipv6`)

```json
{
  "$schema": "cnwb/blueprint@1",
  "id": "u3.ipv6.bitbench.e01", "version": 1, "course": "21CSC302J",
  "title": "Compress an IPv6 address with two equal zero runs and classify its block",
  "template": { "id": "bitbench", "range": "^1.0", "mode": "ipv6" },
  "difficulty": "easy",
  "tags": { "nodes": ["u3.ipv6"], "co": ["CO2"], "bloom": 3 },
  "convention": "forouzan",
  "prompt": { "title": "Shorten {{address}}", "body": "Remove leading zeros and apply zero compression once. Then highlight the prefix bits that identify the block type." },
  "knobs": { "blocks": ["2000::/3", "FE80::/10", "FC00::/7", "FF00::/8"], "zeroRuns": { "count": 2, "equalLength": true } },
  "fingerprint": { "zeroRuns": 2, "tie": true, "leadingZeroHextets": 7 },
  "checkpoints": [
    { "id": "compressed", "title": "Compressed form", "weight": 0.7, "fields": ["text"] },
    { "id": "type", "title": "Block type", "weight": 0.3, "fields": ["prefixBits", "type"] }
  ],
  "timing": { "expectedTimeS": 90, "optimalMoves": "solver" },
  "space": { "minUnique": 100000 },
  "review": { "status": "active", "sourceRefs": ["U3 deck p.122–124", "Forouzan 5e Table 22.1"], "notes": "Either equal-length run may take :: (Forouzan does not specify; RFC 5952 prefers leftmost). Using :: twice is wrong." }
}
```

```json
{
  "params": { "address": "2001:0DB8:0000:0000:0A40:0000:0000:00F1" },
  "publicView": { "hextets": ["2001", "0DB8", "0000", "0000", "0A40", "0000", "0000", "00F1"] },
  "solution": { "accepted": ["2001:db8::a40:0:0:f1", "2001:db8:0:0:a40::f1"], "canonical": "2001:db8::a40:0:0:f1", "type": "global unicast", "prefixBits": "001" },
  "optimalMoves": 9
}
```

#### U3-M · Lab 5 · Longest-prefix forwarding (`fib:lpm`)

```json
{
  "$schema": "cnwb/blueprint@1",
  "id": "lab05.fib.m01", "version": 1, "course": "21CSC302J",
  "title": "Forward five packets through nested static routes and a default",
  "template": { "id": "fib", "range": "^1.0", "mode": "lpm" },
  "difficulty": "medium",
  "tags": { "nodes": ["lab05", "u3.forwarding", "u3.static"], "co": ["CO3"], "bloom": 3 },
  "convention": "forouzan",
  "prompt": { "title": "Where does each packet go?", "body": "Drag each packet onto the interface {{router}} forwards it out of. If there is no matching route, use Drop." },
  "knobs": { "rows": 4, "nested": 3, "default": true, "packets": 5, "nonOctetPrefixes": [22, 25] },
  "fingerprint": { "rows": 4, "nestedDepth": 3, "packets": 5, "multiMatch": 3, "defaultHits": 1 },
  "checkpoints": [ { "id": "forward", "title": "Forwarding decisions", "weight": 1, "fields": ["p1", "p2", "p3", "p4", "p5"] } ],
  "timing": { "expectedTimeS": 180, "optimalMoves": 5 },
  "space": { "minUnique": 1000000 },
  "review": { "status": "active", "sourceRefs": ["U3 deck p.6–15", "Forouzan 5e Ex. 18.7–18.9"] }
}
```

```json
{
  "params": {
    "router": "R1",
    "table": [
      { "prefix": "10.40.10.128/25", "nextHop": null, "iface": "Gi0/1" },
      { "prefix": "10.40.10.0/24", "nextHop": "172.16.2.2", "iface": "Se0/0/1" },
      { "prefix": "10.40.8.0/22", "nextHop": "172.16.1.2", "iface": "Se0/0/0" },
      { "prefix": "0.0.0.0/0", "nextHop": "172.16.3.1", "iface": "Gi0/0" }
    ],
    "packets": ["10.40.10.200", "10.40.10.17", "10.40.9.4", "10.40.12.1", "10.40.11.255"]
  },
  "publicView": { "table": "as params (rows shown in shuffled order)", "packets": ["p1 → 10.40.10.200", "p2 → 10.40.10.17", "p3 → 10.40.9.4", "p4 → 10.40.12.1", "p5 → 10.40.11.255"] },
  "solution": { "p1": "Gi0/1", "p2": "Se0/0/1", "p3": "Se0/0/0", "p4": "Gi0/0", "p5": "Se0/0/0" },
  "optimalMoves": 5
}
```

The table is shown **unsorted** so students must apply longest match rather than read top-down (`lpm.first-match` trap). 10.40.11.255 is in 10.40.8.0/22 (8–11), so p5 → Se0/0/0.

#### U3-M · Dijkstra by hand (`spf:dijkstra`)

```json
{
  "$schema": "cnwb/blueprint@1",
  "id": "u3.ls.spf.m01", "version": 1, "course": "21CSC302J",
  "title": "Dijkstra on six nodes with four relaxations, then the root's forwarding table",
  "template": { "id": "spf", "range": "^1.0", "mode": "dijkstra" },
  "difficulty": "medium",
  "tags": { "nodes": ["u3.ls", "u3.ospf"], "co": ["CO3"], "bloom": 3 },
  "convention": "forouzan",
  "prompt": { "title": "Shortest-path tree from {{root}}", "body": "Each iteration, add the closest node not yet in the tree and update its neighbours' tentative distances. Then fill {{root}}'s forwarding table." },
  "knobs": { "V": 6, "E": [8, 10], "weights": [1, 12] },
  "fingerprint": { "V": 6, "E": 9, "improvements": 4, "uniqueSpt": true, "noPickTies": true },
  "checkpoints": [
    { "id": "order", "title": "Order nodes join the tree", "weight": 0.3 },
    { "id": "distances", "title": "Tentative distances", "weight": 0.3, "ecf": true },
    { "id": "tree", "title": "Shortest-path tree", "weight": 0.2 },
    { "id": "fib", "title": "Forwarding table", "weight": 0.2, "ecf": true }
  ],
  "timing": { "expectedTimeS": 300, "optimalMoves": "solver" },
  "space": { "minUnique": 1000000 },
  "review": { "status": "active", "sourceRefs": ["U3 deck p.50–59", "Forouzan 5e Table 20.2"] }
}
```

```json
{
  "params": { "root": "A", "edges": [["A","B",4],["A","C",1],["C","B",2],["B","D",5],["C","D",8],["C","E",10],["D","E",2],["D","F",6],["E","F",3]] },
  "publicView": { "nodes": ["A","B","C","D","E","F"], "edges": "as params (weights on chips)" },
  "solution": {
    "order": ["C", "B", "D", "E", "F"],
    "iterations": [
      { "add": "A", "D": { "B": 4, "C": 1, "D": "∞", "E": "∞", "F": "∞" } },
      { "add": "C", "D": { "B": 3, "D": 9, "E": 11, "F": "∞" } },
      { "add": "B", "D": { "D": 8, "E": 11, "F": "∞" } },
      { "add": "D", "D": { "E": 10, "F": 14 } },
      { "add": "E", "D": { "F": 13 } },
      { "add": "F", "D": {} }
    ],
    "distance": { "A": 0, "C": 1, "B": 3, "D": 8, "E": 10, "F": 13 },
    "predecessor": { "C": "A", "B": "C", "D": "B", "E": "D", "F": "E" },
    "fib": [ { "dest": "B", "next": "C", "cost": 3 }, { "dest": "C", "next": "C", "cost": 1 }, { "dest": "D", "next": "C", "cost": 8 }, { "dest": "E", "next": "C", "cost": 10 }, { "dest": "F", "next": "C", "cost": 13 } ]
  },
  "optimalMoves": 19
}
```

m̂ = 5 picks + 9 tentative entries (2 at init, 3 + 1 + 2 + 1 afterwards) + 5 forwarding rows. The trap: every next hop is C even for F, five hops away (`dijkstra.next-hop-is-predecessor`).

#### U3-M · RIP update with all three rules (`vectors:rip-update`)

```json
{
  "$schema": "cnwb/blueprint@1",
  "id": "u3.rip.vectors.m01", "version": 1, "course": "21CSC302J",
  "title": "Apply a neighbour's RIP response to a forwarding table",
  "template": { "id": "vectors", "range": "^1.0", "mode": "rip-update" },
  "difficulty": "medium",
  "tags": { "nodes": ["u3.rip", "u3.dv", "lab07"], "co": ["CO3"], "bloom": 3 },
  "convention": "forouzan",
  "prompt": { "title": "{{receiver}} receives {{sender}}'s table", "body": "Apply the RIP update procedure. For every destination, choose Add, Replace or Keep and set the resulting next router and cost (in hops)." },
  "knobs": { "rows": [5, 6], "mustExercise": ["add", "lower", "sameNextHigher", "keep"] },
  "fingerprint": { "rows": 6, "adds": 1, "replacesLower": 1, "replacesSameNext": 1 },
  "checkpoints": [ { "id": "table", "title": "Updated table", "weight": 1, "fields": ["rows[*].action", "rows[*].next", "rows[*].cost"] } ],
  "timing": { "expectedTimeS": 210, "optimalMoves": "solver" },
  "space": { "minUnique": 100000 },
  "review": { "status": "active", "sourceRefs": ["U3 deck p.73–83 (RIP algorithm, 3 cases)", "Forouzan 5e Fig. 20.18"] }
}
```

```json
{
  "params": {
    "receiver": "B", "sender": "C",
    "old": [ { "dest": "N1", "next": null, "cost": 1 }, { "dest": "N2", "next": null, "cost": 1 }, { "dest": "N3", "next": "C", "cost": 2 }, { "dest": "N4", "next": "A", "cost": 3 }, { "dest": "N5", "next": "C", "cost": 4 } ],
    "received": [ { "dest": "N1", "cost": 3 }, { "dest": "N3", "cost": 1 }, { "dest": "N4", "cost": 1 }, { "dest": "N5", "cost": 6 }, { "dest": "N6", "cost": 2 } ]
  },
  "publicView": { "old": "as params", "received": "as params (animated along B–C link)" },
  "solution": {
    "rows": [
      { "dest": "N1", "action": "keep", "next": null, "cost": 1 },
      { "dest": "N2", "action": "keep", "next": null, "cost": 1 },
      { "dest": "N3", "action": ["keep", "replace"], "next": "C", "cost": 2 },
      { "dest": "N4", "action": "replace", "next": "C", "cost": 2 },
      { "dest": "N5", "action": "replace", "next": "C", "cost": 7 },
      { "dest": "N6", "action": "add", "next": "C", "cost": 3 }
    ]
  },
  "optimalMoves": 9
}
```

N5 is the rule-3 trap: cost 7 is higher, but the next router is the same (C), so the route is replaced (`rip.rule3-ignored`). For N3 either action is accepted because the result is identical (refresh). m̂ = 3 changed rows × (action + next + cost) = 9.

#### U3-H · Lab 8 · RIPv2 fault hunt across a discontiguous network (`ios:fault-hunt`)

```json
{
  "$schema": "cnwb/blueprint@1",
  "id": "lab08.ios.h01", "version": 1, "course": "21CSC302J",
  "title": "Find and fix three RIP faults that hide a discontiguous subnet",
  "template": { "id": "ios", "range": "^1.0", "mode": "fault-hunt" },
  "difficulty": "hard",
  "tags": { "nodes": ["lab08", "lab07", "u3.rip"], "co": ["CO3"], "bloom": 5 },
  "convention": "cisco-ios",
  "prompt": { "title": "{{lanR3}} is unreachable from {{lanR1}}", "body": "Hosts on {{lanR1}} cannot reach {{lanR3}}. R1 has no RIP-learned routes at all, and R2 has no route to {{lanR3}}. Mark each faulty or missing line, then fix the routers from their consoles." },
  "knobs": { "routers": 3, "discontiguousMajor": ["172.16.0.0/16", "172.20.0.0/16"], "faults": { "count": 3, "library": ["rip.version-missing", "rip.auto-summary-on", "rip.network-missing", "ios.shutdown"] } },
  "fingerprint": { "faults": 3, "devicesToEdit": 2 },
  "checkpoints": [
    { "id": "locate", "title": "Faults located", "weight": 0.4, "fields": ["marked[*]"] },
    { "id": "fix", "title": "Routers fixed", "weight": 0.6, "fields": ["R1.rip", "R3.rip"] }
  ],
  "timing": { "expectedTimeS": 540, "optimalMoves": "solver" },
  "space": { "minUnique": 50000 },
  "review": { "status": "active", "sourceRefs": ["Syllabus Labs 7–8", "U3 deck p.72–84"] }
}
```

```json
{
  "params": {
    "lanR1": "172.16.10.0/24", "lanR3": "172.16.20.0/24", "wan12": "10.1.1.0/30", "wan23": "10.1.1.4/30",
    "configs": {
      "R1": ["router rip", " version 2", " no auto-summary", " network 172.16.0.0"],
      "R2": ["router rip", " version 2", " no auto-summary", " network 10.0.0.0"],
      "R3": ["router rip", " network 172.16.0.0", " network 10.0.0.0"]
    }
  },
  "publicView": { "showRun": "R1, R2, R3 (router rip sections + interfaces)", "showIpRoute": { "R1": ["C 172.16.10.0/24 Gi0/0", "C 10.1.1.0/30 Se0/0/0"], "R2": ["C 10.1.1.0/30 Se0/0/0", "C 10.1.1.4/30 Se0/0/1"] }, "symptom": "as prompt" },
  "solution": {
    "faults": [
      { "device": "R1", "kind": "rip.network-missing", "fix": "network 10.0.0.0" },
      { "device": "R3", "kind": "rip.version-missing", "fix": "version 2" },
      { "device": "R3", "kind": "rip.auto-summary-on", "fix": "no auto-summary" }
    ],
    "predicates": ["R1.rip.networks ⊇ {10.0.0.0, 172.16.0.0}", "R3.rip.version = 2", "R3.rip.autoSummary = false"],
    "canonicalLines": { "R1": ["enable", "configure terminal", "router rip", "network 10.0.0.0"], "R3": ["enable", "configure terminal", "router rip", "version 2", "no auto-summary"] }
  },
  "optimalMoves": 12
}
```

m̂ = 3 fault marks + 4 lines on R1 + 5 lines on R3.

#### U3-H · Lab 13 · BGP route selection (`vectors:bgp-select`)

```json
{
  "$schema": "cnwb/blueprint@1",
  "id": "u3.bgp.vectors.h01", "version": 1, "course": "21CSC302J",
  "title": "Walk the BGP route-selection flow for four candidate routes",
  "template": { "id": "vectors", "range": "^1.0", "mode": "bgp-select" },
  "difficulty": "hard",
  "tags": { "nodes": ["u3.bgp", "u3.pv", "lab13"], "co": ["CO3"], "bloom": 5 },
  "convention": "forouzan",
  "prompt": { "title": "Which route to {{prefix}} wins?", "body": "Apply the route-selection flow (Fig. 20.30). At each step keep only the surviving candidates. Stop when one route remains." },
  "knobs": { "candidates": 4, "stopStage": ["NEXT-HOP"], "decoy": "best-aspath-low-localpref" },
  "fingerprint": { "candidates": 4, "stopStage": "NEXT-HOP", "decoy": true },
  "checkpoints": [ { "id": "stages", "title": "Survivors at each stage", "weight": 0.8, "ecf": true }, { "id": "winner", "title": "Selected route", "weight": 0.2 } ],
  "timing": { "expectedTimeS": 300, "optimalMoves": "solver" },
  "space": { "minUnique": 100000 },
  "review": { "status": "active", "sourceRefs": ["U3 deck p.95–107", "Forouzan 5e Fig. 20.30"] }
}
```

```json
{
  "params": {
    "prefix": "10.20.0.0/16",
    "candidates": [
      { "id": "Ra", "localPref": 200, "med": 50, "asPath": [65020, 65030], "nextHopCost": 10, "origin": "external", "bgpId": "192.0.2.1" },
      { "id": "Rb", "localPref": 200, "med": 20, "asPath": [65040, 65030], "nextHopCost": 5, "origin": "external", "bgpId": "192.0.2.9" },
      { "id": "Rc", "localPref": 200, "med": 20, "asPath": [65060, 65030], "nextHopCost": 8, "origin": "internal", "bgpId": "192.0.2.4" },
      { "id": "Rd", "localPref": 100, "med": 0, "asPath": [65030], "nextHopCost": 1, "origin": "external", "bgpId": "192.0.2.2" }
    ]
  },
  "publicView": { "candidates": "as params (cards)", "flow": ["LOCAL-PREF (highest)", "MULTI-EXIT-DISC (lowest)", "AS-PATH (shortest)", "NEXT-HOP (least cost)", "External over internal", "BGP identifier (lowest)"] },
  "solution": { "stages": [ { "stage": "LOCAL-PREF", "survivors": ["Ra", "Rb", "Rc"] }, { "stage": "MULTI-EXIT-DISC", "survivors": ["Rb", "Rc"] }, { "stage": "AS-PATH", "survivors": ["Rb", "Rc"] }, { "stage": "NEXT-HOP", "survivors": ["Rb"] } ], "winner": "Rb" },
  "optimalMoves": 5
}
```

The decoy Rd has the shortest AS-PATH and lowest MED but loses at the first stage (`bgp.aspath-before-localpref`).

### Unit 4 — Medium Access Control

#### U4-E · Hamming(7,4) encode and correct (`bitforge:hamming`)

```json
{
  "$schema": "cnwb/blueprint@1",
  "id": "u4.hamming.bitforge.e01", "version": 1, "course": "21CSC302J",
  "title": "Encode a 4-bit dataword, then correct a received 7-bit codeword",
  "template": { "id": "bitforge", "range": "^1.0", "mode": "hamming" },
  "difficulty": "easy",
  "tags": { "nodes": ["u4.hamming"], "co": ["CO4"], "bloom": 3 },
  "convention": "forouzan",
  "prompt": { "title": "Hamming code, even parity", "body": "**Sender:** encode dataword {{dataword}}. **Receiver:** {{received}} arrived with one bit flipped. Find the syndrome, correct it and extract the dataword. Positions are numbered from the right (position 1)." },
  "knobs": { "m": 4, "parity": "even", "errorPositions": [1, 7] },
  "fingerprint": { "m": 4, "r": 3, "encode": true, "decodeWithError": true },
  "checkpoints": [
    { "id": "positions", "title": "Parity positions", "weight": 0.1 },
    { "id": "coverage", "title": "Parity coverage", "weight": 0.25 },
    { "id": "codeword", "title": "Codeword", "weight": 0.25, "ecf": true },
    { "id": "syndrome", "title": "Syndrome", "weight": 0.2 },
    { "id": "corrected", "title": "Corrected dataword", "weight": 0.2, "ecf": true }
  ],
  "timing": { "expectedTimeS": 150, "optimalMoves": "solver" },
  "space": { "minUnique": 1792 },
  "review": { "status": "active", "sourceRefs": ["U4 deck p.120–135"] }
}
```

```json
{
  "params": { "dataword": "1101", "received": "1011001" },
  "publicView": { "encodeGrid": ["P1", "P2", "D3", "P4", "D5", "D6", "D7"], "received": "1011001" },
  "solution": {
    "encode": { "D7": 1, "D6": 1, "D5": 0, "D3": 1, "P1": 0, "P2": 1, "P4": 0, "codeword": "1100110", "coverage": { "P1": [1,3,5,7], "P2": [2,3,6,7], "P4": [4,5,6,7] } },
    "decode": { "S1": 1, "S2": 1, "S4": 1, "syndrome": "111", "errorPosition": 7, "corrected": "0011001", "dataword": "0010" }
  },
  "optimalMoves": 15
}
```

Working:
- **Encode** (positions 7…1 = D7 D6 D5 P4 D3 P2 P1): P1 = D3⊕D5⊕D7 = 1⊕0⊕1 = 0; P2 = D3⊕D6⊕D7 = 1⊕1⊕1 = 1; P4 = D5⊕D6⊕D7 = 0⊕1⊕1 = 0. Codeword **1100110**.
- **Decode** 1011001: S1 = b1⊕b3⊕b5⊕b7 = 1⊕0⊕1⊕1 = 1; S2 = b2⊕b3⊕b6⊕b7 = 0⊕0⊕0⊕1 = 1; S4 = b4⊕b5⊕b6⊕b7 = 1⊕1⊕0⊕1 = 1. Syndrome 111 = 7, so flip bit 7 → **0011001** → dataword **0010**.
- m̂ = 10 (encode) + 5 (3 syndrome bits, 1 flip, 1 dataword).

#### U4-M · CRC by long division (`bitforge:crc`)

```json
{
  "$schema": "cnwb/blueprint@1",
  "id": "u4.crc.bitforge.m01", "version": 1, "course": "21CSC302J",
  "title": "CRC sender: augment, divide modulo 2, append the remainder",
  "template": { "id": "bitforge", "range": "^1.0", "mode": "crc" },
  "difficulty": "medium",
  "tags": { "nodes": ["u4.crc"], "co": ["CO4"], "bloom": 3 },
  "convention": "forouzan",
  "prompt": { "title": "CRC for {{dataword}}", "body": "Generator polynomial {{poly}} (divisor {{divisor}}). Augment the dataword, perform the division row by row, and build the codeword." },
  "knobs": { "datawordBits": [7, 8], "generators": ["1011", "1101"], "requireZeroLeadSteps": [1, 3] },
  "fingerprint": { "k": 7, "degree": 3, "zeroLeadSteps": 2, "remainderNonZero": true },
  "checkpoints": [
    { "id": "rows", "title": "Division steps", "weight": 0.5, "sequential": true, "ecf": true },
    { "id": "remainder", "title": "Remainder", "weight": 0.3, "ecf": true },
    { "id": "codeword", "title": "Codeword", "weight": 0.2, "ecf": true }
  ],
  "timing": { "expectedTimeS": 210, "optimalMoves": "solver" },
  "space": { "minUnique": 200 },
  "review": { "status": "active", "sourceRefs": ["U4 deck p.101–107", "Forouzan 5e Fig. 10.6"] }
}
```

```json
{
  "params": { "dataword": "1101011", "divisor": "1011", "poly": "x³ + x + 1" },
  "publicView": { "dataword": "1101011", "divisor": "1011", "board": { "dividendWidth": 10, "rows": 7 } },
  "solution": {
    "augmented": "1101011000",
    "steps": [
      { "in": "1101", "use": "1011", "out": "0110" },
      { "in": "1100", "use": "1011", "out": "0111" },
      { "in": "1111", "use": "1011", "out": "0100" },
      { "in": "1001", "use": "1011", "out": "0010" },
      { "in": "0100", "use": "0000", "out": "0100" },
      { "in": "1000", "use": "1011", "out": "0011" },
      { "in": "0110", "use": "0000", "out": "0110" }
    ],
    "remainder": "110", "codeword": "1101011110"
  },
  "optimalMoves": 16
}
```

Verified independently with a shift-register CRC (remainder 110). Golden companion: Forouzan Fig. 10.6, 1001 ÷ 1011 → 110 → 1001110.

#### U4-M · Lab 12 · HDLC bit stuffing and unstuffing (`frame:bit-stuff`)

```json
{
  "$schema": "cnwb/blueprint@1",
  "id": "lab12.frame.m01", "version": 1, "course": "21CSC302J",
  "title": "Stuff a payload for an HDLC frame and unstuff a received one",
  "template": { "id": "frame", "range": "^1.0", "mode": "bit-stuff" },
  "difficulty": "medium",
  "tags": { "nodes": ["lab12", "u4.hdlc"], "co": ["CO4"], "bloom": 3 },
  "convention": "forouzan",
  "prompt": { "title": "Make the payload flag-safe", "body": "**Sender:** stuff {{payload}} and wrap it in flags. **Receiver:** remove the stuffed bits from {{received}}." },
  "knobs": { "bits": [14, 20], "runsOfFivePlus": [2, 3], "includeRunOfSix": true },
  "fingerprint": { "insertions": 2, "removals": 2 },
  "checkpoints": [
    { "id": "stuffed", "title": "Stuffed payload", "weight": 0.4 },
    { "id": "flags", "title": "Frame flags", "weight": 0.2 },
    { "id": "unstuffed", "title": "Unstuffed data", "weight": 0.4 }
  ],
  "timing": { "expectedTimeS": 180, "optimalMoves": "solver" },
  "space": { "minUnique": 10000 },
  "review": { "status": "active", "sourceRefs": ["U4 deck p.136–146", "Forouzan 5e §11.2 (bit stuffing)", "Syllabus Lab 12"] }
}
```

```json
{
  "params": { "payload": "0111111011111100", "received": "1011111001111100" },
  "publicView": { "payload": "0111 1110 1111 1100", "received": "1011 1110 0111 1100" },
  "solution": {
    "stuffed": "011111010111110100", "insertedAtOutputIndex": [6, 14],
    "frame": "01111110 011111010111110100 01111110",
    "unstuffed": "10111110111110", "removedAtInputIndex": [7, 14]
  },
  "optimalMoves": 6
}
```

#### U4-H · Go-Back-N with a lost frame (`arq:gbn`)

```json
{
  "$schema": "cnwb/blueprint@1",
  "id": "u4.arq.gbn.h01", "version": 1, "course": "21CSC302J",
  "title": "Drive a Go-Back-N sender and receiver through a lost frame and a timeout",
  "template": { "id": "arq", "range": "^1.0", "mode": "gbn" },
  "difficulty": "hard",
  "tags": { "nodes": ["u4.arq", "u4.flow"], "co": ["CO4"], "bloom": 4 },
  "convention": "forouzan",
  "prompt": { "title": "Go-Back-N, m = {{m}}", "body": "The sender uses the largest legal send window. Handle each event: slide windows, send what the window allows, discard or accept at the receiver, and retransmit on timeout." },
  "knobs": { "m": [3, 3], "framesToSend": [9, 9], "loss": { "frames": 1, "acks": 0 }, "wrap": true },
  "fingerprint": { "m": 3, "Ws": 7, "decisionPoints": 7, "retransmissions": 7, "wrap": true },
  "checkpoints": [
    { "id": "window", "title": "Window size", "weight": 0.1 },
    { "id": "receiver", "title": "Receiver decisions", "weight": 0.35, "ecf": true },
    { "id": "sender", "title": "Sender decisions", "weight": 0.45, "ecf": true },
    { "id": "count", "title": "Total transmissions", "weight": 0.1 }
  ],
  "timing": { "expectedTimeS": 420, "optimalMoves": "solver" },
  "space": { "minUnique": 300 },
  "review": { "status": "active", "sourceRefs": ["U4 deck p.71–80", "Forouzan 5e §23.2 (GBN)"], "notes": "Receiver response to out-of-order frames: 'discard' is graded; resending ackNo = R_n or staying silent are both accepted." }
}
```

```json
{
  "params": { "m": 3, "frames": 9, "lostFrameIndex": 2, "timeoutAfter": "frame index 8 sent" },
  "publicView": { "seqSpace": [0,1,2,3,4,5,6,7], "frames": ["#0…#8 → seq 0,1,2,3,4,5,6,7,0"], "events": "revealed one by one" },
  "solution": {
    "Ws": 7,
    "timeline": [
      { "sender": "send seq 0–6 (frames #0–#6)" },
      { "receiver": "accept 0 → ackNo 1; accept 1 → ackNo 2" },
      { "network": "seq 2 lost" },
      { "receiver": "seq 3,4,5,6 out of order → discard each" },
      { "sender": "ackNo 1 → Sf = 1; ackNo 2 → Sf = 2; window 2…0 allows seq 7 and seq 0 (#7, #8) → send both" },
      { "sender": "timer for seq 2 expires → resend all outstanding: 2,3,4,5,6,7,0" },
      { "receiver": "accept 2,3,4,5,6,7,0 in order → final ackNo 1" }
    ],
    "totalTransmissions": 16
  },
  "optimalMoves": 21
}
```

#### U4-H · Labs 10 + 11 · Multi-area OSPF ABR over a PPP/CHAP link (`ios:build`)

```json
{
  "$schema": "cnwb/blueprint@1",
  "id": "lab11.ios.h01", "version": 1, "course": "21CSC302J",
  "title": "Authenticate a serial link with PPP/CHAP and make the router an OSPF ABR",
  "template": { "id": "ios", "range": "^1.0", "mode": "build" },
  "difficulty": "hard",
  "tags": { "nodes": ["lab11", "lab10", "u4.ppp", "u3.ospf"], "co": ["CO3", "CO4"], "bloom": 3 },
  "convention": "cisco-ios",
  "prompt": { "title": "Bring up {{r1}} ⇄ {{r2}}", "body": "Both routers' interfaces are addressed. Secure the serial link with PPP and CHAP using the shared secret on the topology. Then make {{r1}} an ABR: its LAN in area {{lanArea}}, the serial link in area 0." },
  "knobs": { "lanPrefix": [20, 23], "areas": [1, 9], "pid": [1, 100], "secretStyle": "pronounceable8" },
  "fingerprint": { "devices": 2, "computedWildcards": 2, "objectives": 5 },
  "checkpoints": [
    { "id": "ppp", "title": "PPP and CHAP on both ends", "weight": 0.5, "fields": ["MARINA.Se0/0/0", "GUINDY.Se0/0/1", "usernames"] },
    { "id": "ospf", "title": "OSPF areas on MARINA", "weight": 0.5, "fields": ["MARINA.ospf"] }
  ],
  "timing": { "expectedTimeS": 600, "optimalMoves": "solver" },
  "space": { "minUnique": 100000 },
  "review": { "status": "active", "sourceRefs": ["Syllabus Labs 10–11", "U4 deck p.148–158 (PPP, CHAP)", "U3 deck p.89–90 (OSPF areas)"] }
}
```

```json
{
  "params": { "r1": "MARINA", "r2": "GUINDY", "secret": "t4lpakoz", "pid": 10, "lanArea": 1, "lan": "10.5.12.1/22", "wan": "10.0.0.0/30", "r1Serial": "Serial0/0/0", "r2Serial": "Serial0/0/1" },
  "publicView": { "topology": { "MARINA": { "Gi0/0": "10.5.12.1/22 · area 1", "Se0/0/0": "10.0.0.1/30 · area 0" }, "GUINDY": { "Se0/0/1": "10.0.0.2/30" } }, "secret": "t4lpakoz", "consoles": ["MARINA", "GUINDY"] },
  "solution": {
    "predicates": [
      "MARINA.Se0/0/0.encapsulation = ppp ∧ pppAuth = chap", "GUINDY.Se0/0/1.encapsulation = ppp ∧ pppAuth = chap",
      "MARINA.usernames[GUINDY] = t4lpakoz", "GUINDY.usernames[MARINA] = t4lpakoz",
      "ospfArea(MARINA, Gi0/0) = 1", "ospfArea(MARINA, Se0/0/0) = 0"
    ],
    "canonicalLines": {
      "MARINA": ["enable", "configure terminal", "username GUINDY password t4lpakoz", "interface Serial0/0/0", "encapsulation ppp", "ppp authentication chap", "router ospf 10", "network 10.5.12.0 0.0.3.255 area 1", "network 10.0.0.0 0.0.0.3 area 0"],
      "GUINDY": ["enable", "configure terminal", "username MARINA password t4lpakoz", "interface Serial0/0/1", "encapsulation ppp", "ppp authentication chap"]
    }
  },
  "optimalMoves": 15
}
```

10.5.12.1/22 → block 10.5.12.0–10.5.15.255 (third octet 12 is divisible by 4), so the wildcard is 0.0.3.255. Any wildcard that enables exactly Gi0/0 (e.g. `network 10.5.12.1 0.0.0.0 area 1`) passes the predicate.

### Unit 5 — Transport and Application Layer Protocols

#### U5-E · Dissect a UDP header (`hexdump:udp`)

```json
{
  "$schema": "cnwb/blueprint@1",
  "id": "u5.udp.hexdump.e01", "version": 1, "course": "21CSC302J",
  "title": "Decode an 8-byte UDP header and identify the service and direction",
  "template": { "id": "hexdump", "range": "^1.0", "mode": "udp" },
  "difficulty": "easy",
  "tags": { "nodes": ["u5.udp", "u5.ports"], "co": ["CO5"], "bloom": 3 },
  "convention": "forouzan",
  "prompt": { "title": "What is this datagram?", "body": "Brush each header field onto the dump, decode it, and identify the application, payload length and direction." },
  "knobs": { "wellKnown": [7, 13, 53, 67, 69, 123, 161, 520], "ephemeral": [49152, 65535], "direction": ["c2s", "s2c"] },
  "fingerprint": { "fields": 4, "interpretations": 3 },
  "checkpoints": [
    { "id": "fields", "title": "Field boundaries", "weight": 0.3 },
    { "id": "values", "title": "Decoded values", "weight": 0.4 },
    { "id": "meaning", "title": "Service, data length, direction", "weight": 0.3, "ecf": true }
  ],
  "timing": { "expectedTimeS": 90, "optimalMoves": 11 },
  "tools": ["port-registry"],
  "space": { "minUnique": 1000000 },
  "review": { "status": "active", "sourceRefs": ["U5 deck p.10–11", "Forouzan 5e Ex. 24.1"] }
}
```

```json
{
  "params": { "hex": "D2F10035002C7A1B", "srcPort": 54001, "dstPort": 53, "length": 44, "checksum": 31259 },
  "publicView": { "dump": "0000  D2 F1 00 35 00 2C 7A 1B" },
  "solution": { "srcPort": 54001, "dstPort": 53, "totalLength": 44, "checksum": 31259, "service": "DNS", "dataLength": 36, "direction": "client → server" },
  "optimalMoves": 11
}
```

Working: 0xD2F1 = 210×256 + 241 = 54001 (ephemeral, so this is the client); 0x0035 = 53 (DNS); 0x002C = 44, so data = 44 − 8 = 36 B; 0x7A1B = 31259.

#### U5-M · TCP open, transfer and close on a ladder (`ladder:tcp`)

```json
{
  "$schema": "cnwb/blueprint@1",
  "id": "u5.tcp.ladder.m01", "version": 1, "course": "21CSC302J",
  "title": "Three-way open, two data segments, three-way close with states",
  "template": { "id": "ladder", "range": "^1.0", "mode": "tcp" },
  "difficulty": "medium",
  "tags": { "nodes": ["u5.tcp"], "co": ["CO5"], "bloom": 3 },
  "convention": "forouzan",
  "prompt": { "title": "Draw the connection", "body": "The client's ISN is {{isnC}} and the server's ISN is {{isnS}}. The client sends {{segments}} segments of {{size}} bytes each and then closes. Place every segment, fill seq and ack, and mark both sides' states." },
  "knobs": { "isn": [1000, 4000000000], "segments": [2, 2], "size": [500, 1460], "close": "three-way" },
  "fingerprint": { "segments": 9, "states": 8 },
  "checkpoints": [
    { "id": "order", "title": "Segment order", "weight": 0.4 },
    { "id": "numbers", "title": "Sequence and acknowledgment numbers", "weight": 0.4, "ecf": true },
    { "id": "states", "title": "States", "weight": 0.2 }
  ],
  "timing": { "expectedTimeS": 300, "optimalMoves": "solver" },
  "space": { "minUnique": 1000000 },
  "review": { "status": "active", "sourceRefs": ["U5 deck p.19–28", "Forouzan 5e Fig. 24.10–24.12, Table 24.2"] }
}
```

```json
{
  "params": { "isnC": 24200, "isnS": 71500, "segments": 2, "size": 1000 },
  "publicView": { "lifelines": ["Client", "Server"], "palette": ["SYN", "SYN + ACK", "ACK", "Data", "FIN", "FIN + ACK"], "initialStates": { "Client": "CLOSED", "Server": "LISTEN" } },
  "solution": {
    "segments": [
      { "n": 1, "dir": "C→S", "flags": "SYN",     "seq": 24200 },
      { "n": 2, "dir": "S→C", "flags": "SYN+ACK", "seq": 71500, "ack": 24201 },
      { "n": 3, "dir": "C→S", "flags": "ACK",     "seq": 24201, "ack": 71501 },
      { "n": 4, "dir": "C→S", "flags": "Data",    "seq": 24201, "ack": 71501, "bytes": "24201–25200" },
      { "n": 5, "dir": "C→S", "flags": "Data",    "seq": 25201, "ack": 71501, "bytes": "25201–26200" },
      { "n": 6, "dir": "S→C", "flags": "ACK",     "seq": 71501, "ack": 26201 },
      { "n": 7, "dir": "C→S", "flags": "FIN",     "seq": 26201, "ack": 71501 },
      { "n": 8, "dir": "S→C", "flags": "FIN+ACK", "seq": 71501, "ack": 26202 },
      { "n": 9, "dir": "C→S", "flags": "ACK",     "seq": 26202, "ack": 71502 }
    ],
    "states": {
      "Client": [ { "after": 1, "state": "SYN-SENT" }, { "after": 2, "state": "ESTABLISHED" }, { "after": 7, "state": "FIN-WAIT-1" }, { "after": 8, "state": "TIME-WAIT" } ],
      "Server": [ { "after": 2, "state": "SYN-RCVD" }, { "after": 3, "state": "ESTABLISHED" }, { "after": 7, "state": "CLOSE-WAIT" }, { "after": 8, "state": "LAST-ACK" } ]
    }
  },
  "optimalMoves": 34
}
```

SYN and FIN each consume one sequence number; a pure ACK consumes none, so the first data byte is ISN + 1. m̂ = 9 arrows + 17 numbers + 8 states.

#### U5-M · Lab 15 · Telnet access (`ios:build`)

```json
{
  "$schema": "cnwb/blueprint@1",
  "id": "lab15.ios.m01", "version": 1, "course": "21CSC302J",
  "title": "Enable Telnet management with privileged access and idle timeout",
  "template": { "id": "ios", "range": "^1.0", "mode": "build" },
  "difficulty": "medium",
  "tags": { "nodes": ["lab15", "u5.telnet"], "co": ["CO5"], "bloom": 3 },
  "convention": "cisco-ios",
  "prompt": { "title": "Let {{adminPc}} manage {{hostname}}", "body": "The admin PC at {{adminIp}} must be able to Telnet to the router's LAN address and reach privileged EXEC. Idle sessions must close after {{idle}} minutes." },
  "knobs": { "lanPrefix": [24, 26], "idleMinutes": [3, 10] },
  "fingerprint": { "objectives": 5 },
  "checkpoints": [
    { "id": "lan", "title": "LAN interface", "weight": 0.3 },
    { "id": "vty", "title": "VTY access", "weight": 0.5 },
    { "id": "priv", "title": "Privileged EXEC", "weight": 0.2 }
  ],
  "timing": { "expectedTimeS": 360, "optimalMoves": "solver" },
  "space": { "minUnique": 100000 },
  "review": { "status": "active", "sourceRefs": ["Syllabus Lab 15", "U5 deck p.78–81 (TELNET)"] }
}
```

```json
{
  "params": { "hostname": "KTR-CORE", "adminPc": "ADMIN-PC", "adminIp": "192.168.77.10", "lan": "192.168.77.0/24", "routerIp": "192.168.77.1", "vtyPw": "mubate3s", "secret": "qorvi8le", "idle": 5 },
  "publicView": { "topology": { "KTR-CORE": { "Gi0/0": "192.168.77.0/24 (router = first usable)" }, "ADMIN-PC": "192.168.77.10" }, "secrets": { "vty": "mubate3s", "enable": "qorvi8le" } },
  "solution": {
    "canonicalLines": ["enable", "configure terminal", "interface GigabitEthernet0/0", "ip address 192.168.77.1 255.255.255.0", "no shutdown", "enable secret qorvi8le", "line vty 0 4", "password mubate3s", "login", "transport input telnet", "exec-timeout 5 0"]
  },
  "optimalMoves": 11
}
```

Without `enable secret` (or an enable password), a remote Telnet user cannot enter privileged EXEC. The objective tests that dependency (`telnet.no-enable-secret`).

#### U5-H · Lab 14 · EIGRP adjacency fault hunt (`ios:fault-hunt`)

```json
{
  "$schema": "cnwb/blueprint@1",
  "id": "lab14.ios.h01", "version": 1, "course": "21CSC302J",
  "title": "Two routers will not form an EIGRP adjacency — find and fix both faults",
  "template": { "id": "ios", "range": "^1.0", "mode": "fault-hunt" },
  "difficulty": "hard",
  "tags": { "nodes": ["lab14", "u3.eigrp"], "co": ["CO3"], "bloom": 5 },
  "convention": "cisco-ios",
  "prompt": { "title": "No EIGRP neighbours", "body": "`show ip eigrp neighbors` is empty on both routers. Read the configurations, mark the faulty lines, and fix them so the routers form an adjacency and exchange their LANs." },
  "knobs": { "faults": { "count": 2, "library": ["eigrp.as-mismatch", "eigrp.network-not-covering", "ios.shutdown", "eigrp.auto-summary-discontiguous"] }, "lanPrefix": [20, 24] },
  "fingerprint": { "faults": 2, "devicesToEdit": 2 },
  "checkpoints": [
    { "id": "locate", "title": "Faults located", "weight": 0.4 },
    { "id": "fix", "title": "Adjacency predicates satisfied", "weight": 0.6 }
  ],
  "timing": { "expectedTimeS": 540, "optimalMoves": "solver" },
  "space": { "minUnique": 50000 },
  "review": { "status": "active", "sourceRefs": ["Syllabus Lab 14", "U3 deck p.108–110 (EIGRP)"] }
}
```

```json
{
  "params": {
    "R1": ["interface GigabitEthernet0/0", " ip address 192.168.4.1 255.255.255.0", "interface Serial0/0/0", " ip address 192.168.5.5 255.255.255.252", "router eigrp 100", " network 192.168.4.0 0.0.0.255", " network 192.168.5.0 0.0.0.3", " no auto-summary"],
    "R2": ["interface Serial0/0/0", " ip address 192.168.5.6 255.255.255.252", " clock rate 64000", "interface GigabitEthernet0/0", " ip address 172.20.8.1 255.255.248.0", "router eigrp 10", " network 192.168.5.4 0.0.0.3", " network 172.20.8.0 0.0.7.255", " no auto-summary"]
  },
  "publicView": { "showRun": "R1, R2 as params", "symptom": "show ip eigrp neighbors: (empty) on both" },
  "solution": {
    "faults": [
      { "device": "R1", "line": " network 192.168.5.0 0.0.0.3", "kind": "eigrp.network-not-covering", "why": "Se0/0/0 is 192.168.5.5 in 192.168.5.4/30; 192.168.5.0 0.0.0.3 covers .0–.3 only" },
      { "device": "R2", "line": "router eigrp 10", "kind": "eigrp.as-mismatch", "why": "R1 uses AS 100" }
    ],
    "predicates": ["eigrpAs(R1) = eigrpAs(R2)", "eigrpEnabled(R1, Se0/0/0)", "eigrpEnabled(R2, Se0/0/0)", "eigrpEnabled(R1, Gi0/0)", "eigrpEnabled(R2, Gi0/0)"],
    "canonicalLines": {
      "R1": ["enable", "configure terminal", "router eigrp 100", "network 192.168.5.4 0.0.0.3"],
      "R2": ["enable", "configure terminal", "no router eigrp 10", "router eigrp 100", "network 192.168.5.4 0.0.0.3", "network 172.20.8.0 0.0.7.255", "no auto-summary"]
    }
  },
  "optimalMoves": 13
}
```

Removing R1's stray `network 192.168.5.0 0.0.0.3` is optional, because it matches no interface. Changing R1 to AS 10 instead of R2 to AS 100 is equally valid; the predicate only requires the AS numbers to match. 172.20.8.1/21 lies in 172.20.8.0–172.20.15.255, so the wildcard is 0.0.7.255.

#### U5-H · SMTP session and mail access (`ladder:smtp`)

```json
{
  "$schema": "cnwb/blueprint@1",
  "id": "u5.email.ladder.h01", "version": 1, "course": "21CSC302J",
  "title": "Full SMTP transaction with two recipients, then choose the access protocol",
  "template": { "id": "ladder", "range": "^1.0", "mode": "smtp" },
  "difficulty": "hard",
  "tags": { "nodes": ["u5.email"], "co": ["CO5"], "bloom": 4 },
  "convention": "forouzan",
  "prompt": { "title": "Deliver {{sender}}'s mail", "body": "Build the SMTP exchange between the MTA client and server for one message to {{rcptCount}} recipients, with the server's reply codes. Then choose how {{reader}} should read mail, given: {{accessRequirement}}." },
  "knobs": { "recipients": [1, 3], "accessRequirements": ["search headers on server before download", "download and delete from server", "maintain folders on server"] },
  "fingerprint": { "commands": 7, "replies": 8, "rcpt": 2 },
  "checkpoints": [
    { "id": "order", "title": "Command and reply order", "weight": 0.45 },
    { "id": "codes", "title": "Reply codes", "weight": 0.35 },
    { "id": "access", "title": "Mail access protocol", "weight": 0.2 }
  ],
  "timing": { "expectedTimeS": 420, "optimalMoves": "solver" },
  "space": { "minUnique": 10000 },
  "review": { "status": "active", "sourceRefs": ["U5 deck p.63–70", "Forouzan 5e Fig. 26.16, Tables 26.6–26.7"] }
}
```

```json
{
  "params": { "sender": "asha@cse.ktr.example", "rcpts": ["ravi@ece.vdp.example", "lina@mech.ncr.example"], "reader": "Ravi", "accessRequirement": "search headers on server before download" },
  "publicView": { "lifelines": ["MTA client", "MTA server"], "palette": ["HELO", "MAIL FROM", "RCPT TO", "DATA", "message body + '.'", "QUIT", "reply"], "access": ["POP3", "IMAP4"] },
  "solution": {
    "sequence": [
      "S: 220 service ready", "C: HELO cse.ktr.example", "S: 250 OK",
      "C: MAIL FROM:<asha@cse.ktr.example>", "S: 250 OK",
      "C: RCPT TO:<ravi@ece.vdp.example>", "S: 250 OK",
      "C: RCPT TO:<lina@mech.ncr.example>", "S: 250 OK",
      "C: DATA", "S: 354 start mail input",
      "C: <body> .", "S: 250 OK",
      "C: QUIT", "S: 221 service closing"
    ],
    "access": "IMAP4"
  },
  "optimalMoves": 24
}
```

m̂ = 15 arrows + 8 reply codes + 1 access choice. IMAP4 is chosen because it supports searching headers on the server before download (slide p.70); POP3 does not.

---

## 7. Sample coverage summary

| Unit | Easy | Medium | Hard | Theory | Lab |
|---|---|---|---|---|---|
| U1 | `lab01.pinout.e01` | `lab01.pinout.m01`, `u1.performance.delayline.m01`, `u1.topology.patchbay.m01` | `lab03.ios.h01` | performance, topology, guided media | Labs 1, 2, 3 |
| U2 | `u2.mask.bitbench.e01` | `lab04.slicer.m01`, `u2.devices.patchbay.m01` | `lab06.nat.h01` | masks, classes, devices, NAT | Labs 4, 6 |
| U3 | `u3.ipv6.bitbench.e01` | `lab05.fib.m01`, `u3.ls.spf.m01`, `u3.rip.vectors.m01` | `lab08.ios.h01`, `u3.bgp.vectors.h01` | IPv6, forwarding, LS, DV/RIP, PV/BGP | Labs 5, 7, 8, 13 |
| U4 | `u4.hamming.bitforge.e01` | `u4.crc.bitforge.m01`, `lab12.frame.m01` | `u4.arq.gbn.h01`, `lab11.ios.h01` | Hamming, CRC, HDLC, GBN, PPP, OSPF areas | Labs 10, 11, 12 |
| U5 | `u5.udp.hexdump.e01` | `u5.tcp.ladder.m01`, `lab15.ios.m01` | `lab14.ios.h01`, `u5.email.ladder.h01` | UDP, ports, TCP, Telnet, SMTP/IMAP | Labs 14, 15 |

Labs 9 (single-area OSPF) and 13 (BGP configuration) are covered by template modes (`ios:build` with `router ospf` / `router bgp` objectives); their first blueprints are scheduled in ROADMAP Phase 4.

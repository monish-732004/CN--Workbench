# DESIGN SYSTEM — SRM CN Workbench

**Status:** v1.0 · 2026-11-19
**Package:** `@cn/ui` (tokens, components) · `@cn/templates-ui` (canvas kit)

This product should feel like an instrument: a network analyser, a lab bench, a terminal that someone cared about. Linear, Vercel, Raycast, and Stripe are the reference for *craft*. Cisco ThousandEyes and good oscilloscopes are the reference for *density*. It must never look generated.

---

## 1. Principles

1. **The canvas is the product.** Chrome, meaning everything around the interactive surface, recedes. The student's attention belongs on the bits, wires, and packets.
2. **Density with hierarchy.** Teachers watch 70 rows of live data. Use type weight, alignment, and hairlines, not boxes and colour, to separate things.
3. **Colour means something or it isn't there.** Neutral graphite does the structural work. Colour appears only for **status** (emerald / amber / crimson), **focus and selection** (signal blue), and **physical reality** (RJ-45 wire colours, which are functional).
4. **Numbers are first-class.** Every number is tabular. Every address, bit, and hex byte is set in mono and aligned on a grid.
5. **Calm under pressure.** Timers and integrity warnings inform without alarming: no pulsing, no flashing, no sirens. A student mid-exam should never feel startled by the UI.

## 2. Banned (PR is rejected if present)

| Banned | Why | Do instead |
|---|---|---|
| Purple, indigo, pink, or cyan glowing gradients; neon "cyberpunk" backgrounds; mesh-gradient heroes | The default AI-generated aesthetic; it fights the data | Flat graphite surfaces; a dot grid only on the canvas |
| Marketing hero sections, floating 3D blobs, isometric illustrations, stock art | This is a tool, not a landing page | The first screen is the user's task |
| Emoji anywhere in UI chrome: headings, buttons, badges, leaderboards, toasts | Imprecise, juvenile, and inconsistent across OSes | Lucide icons at 1.5 px stroke, or nothing |
| Default shadcn/Tailwind cards: `rounded-2xl`, `shadow-lg`, gradient borders, glassmorphism blur | Instantly recognisable boilerplate | 1 px hairline borders, radius ≤ 6 px, no card shadows |
| Confetti, trophies, mascots, celebratory animation on correct answers | Gamification undermines assessment seriousness and distracts neighbours | A quiet emerald state change on the checkpoint |
| Shake animations on wrong answers | Punitive and noisy | A static crimson hairline on the affected field plus a line of text |
| Pill-shaped everything | Visual mush | Radius 4 px for controls; full radius only for status dots and switch tracks |
| Centered body text, ALL CAPS paragraphs, exclamation marks in copy | Shouty and hard to scan | Left-aligned, sentence case, full stops |
| Loading shimmers with gradient sweeps | Animated noise | Static skeleton blocks at `bg-3`, or nothing |
| Random accent colours per page or per template | No system | One accent: signal blue |

## 3. Colour tokens

All colour is defined as CSS custom properties in `@cn/ui/tokens.css` and mapped into Tailwind v4 via `@theme`. Components never use raw hex values. Contrast pairs are verified in CI (`tokens.contrast.test.ts`, WCAG 2.2 AA: body text ≥ 4.5:1, large text and UI glyphs ≥ 3:1).

### 3.1 Neutrals (graphite)

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg-0` | `#0A0C0F` | `#F6F7F9` | App background behind everything |
| `--bg-1` | `#0F1216` | `#FFFFFF` | Primary surfaces: panels, tables |
| `--bg-2` | `#14181D` | `#FAFBFC` | Raised: popovers, telemetry bar, prompt rail |
| `--bg-3` | `#1B2027` | `#F0F2F5` | Hover rows, inset wells, skeletons |
| `--canvas` | `#0C0F12` | `#FBFCFD` | Interactive canvas field |
| `--canvas-grid` | `#1A1F26` | `#E6E9EE` | 1 px dots on a 16 px grid |
| `--border-1` | `#222831` | `#E2E5EA` | Default hairline |
| `--border-2` | `#2E3540` | `#CBD1D8` | Inputs, emphasis, table header underline |
| `--fg-1` | `#E8EBEF` | `#0E1116` | Primary text and glyphs |
| `--fg-2` | `#A2AAB5` | `#4A5361` | Secondary text, labels |
| `--fg-3` | `#6C7480` | `#868E99` | Tertiary text, disabled, placeholders |
| `--ink` | `#E8EBEF` | `#0E1116` | Primary button fill (inverted ink) |
| `--ink-fg` | `#0A0C0F` | `#FFFFFF` | Text on ink |

### 3.2 Signal (the only accent)

| Token | Dark | Light | Use |
|---|---|---|---|
| `--signal` | `#5B93F5` | `#1F5FCC` | Focus ring, selection outline, active tab rule, links, the current drop target |
| `--signal-bg` | `rgb(91 147 245 / 0.12)` | `rgb(31 95 204 / 0.08)` | Selected row/cell fill |

Primary actions are **ink** (inverted neutral), not signal-blue. Blue marks *where you are*; ink marks *what to do*.

### 3.3 Status

| Token | Dark | Light | Meaning |
|---|---|---|---|
| `--ok` / `--ok-bg` | `#3FA37A` / `rgb(63 163 122 / 0.12)` | `#1D7A55` / `rgb(29 122 85 / 0.08)` | Verified, correct checkpoint, Clean integrity, connected |
| `--warn` / `--warn-bg` | `#D6A23E` / `rgb(214 162 62 / 0.12)` | `#946300` / `rgb(148 99 0 / 0.08)` | Trial-and-error, focus warning, Watch tier, late, ≤ 5 min |
| `--bad` / `--bad-bg` | `#E5534B` / `rgb(229 83 75 / 0.12)` | `#C02B2B` / `rgb(192 43 43 / 0.08)` | Integrity violation, Flagged tier, incorrect field, ≤ 1 min, disconnected |

Status is **never colour-only**. It always pairs with an icon or text label (`CheckCircle2` + "Clean", `AlertTriangle` + "Watch", `ShieldAlert` + "Flagged").

### 3.4 Data categorical (canvas only)

Muted, earthy hues for distinguishing *categories* such as protocol layers, header field groups, OSPF areas, or autonomous systems. They are never used for status.

| Token | Dark | Light | Typical use |
|---|---|---|---|
| `--cat-1` slate | `#7C9CC9` | `#3F5F8F` | L2 / frame fields; Area 0 |
| `--cat-2` ochre | `#C9A35B` | `#8A6620` | L3 / IP fields; Area 1 |
| `--cat-3` sage | `#86AE86` | `#3F6E3F` | L4 / TCP-UDP fields; Area 2 |
| `--cat-4` terracotta | `#C98466` | `#9A4B2C` | Application payload; AS 65020 |
| `--cat-5` steel | `#97A3B5` | `#5A6677` | Control / padding / reserved |
| `--cat-6` olive | `#AFAE66` | `#6E6D23` | Trailer / FCS / CRC |

Each category also has a **pattern** (solid, 45° hatch, dots, cross-hatch, horizontal rule, vertical rule) available as SVG `<pattern>` fills for colour-blind safety and greyscale projectors.

### 3.5 Physical (functional realism)

RJ-45 conductors (`pinout` template). These are real-world colours because the skill being assessed is recognising them.

| Token | Hex | Rendering |
|---|---|---|
| `--wire-orange` | `#E07B39` | solid |
| `--wire-green` | `#3E9B5B` | solid |
| `--wire-blue` | `#3C6FD1` | solid |
| `--wire-brown` | `#8A5A3B` | solid |
| `--wire-white` | `#ECECEC` | base for striped conductors |

Striped conductors (W/O, W/G, W/B, W/Br) render as a white base with a 3 px helical stripe of the pair colour. Every conductor also carries a mono label (`W/O`, `O`, …) on hover and focus, so the task is solvable by colour-blind students. The skill being tested is the order, not colour perception.

## 4. Typography

### 4.1 Families (self-hosted, OFL-licensed, no runtime CDN)

| Role | Family | Fallback | Notes |
|---|---|---|---|
| UI sans | **Geist** (400/500/600) | `ui-sans-serif, system-ui` | Sharp geometric grotesk; `font-feature-settings: "ss01", "tnum"` on numeric contexts |
| Technical mono | **JetBrains Mono** (400/500/600) | `ui-monospace, "Cascadia Mono", monospace` | Distinct `0/O`, `1/l/I`; ligatures **off** (`"liga" 0, "calt" 0`) so `!=`, `->`, `::` read literally in IOS, IPv6, and code |

### 4.2 Scale

| Token | Size / line-height | Weight | Tracking | Use |
|---|---|---|---|---|
| `text-micro` | 11 / 16 | 500 | +0.02em | Table column headers (sentence case), axis ticks |
| `text-caption` | 12 / 16 | 400 | 0 | Metadata, timestamps, helper text |
| `text-dense` | 13 / 20 | 400 | 0 | **Teacher default body**: tables, feeds |
| `text-body` | 14 / 22 | 400 | 0 | **Student default body**: prompt rail |
| `text-strong` | 14 / 22 | 500 | 0 | Emphasis within body |
| `text-h3` | 16 / 24 | 600 | −0.005em | Panel titles |
| `text-h2` | 20 / 28 | 600 | −0.01em | Page titles |
| `text-h1` | 28 / 36 | 600 | −0.015em | Rare: empty-state and projector headings |
| `mono-sm` | 12 / 18 | 400 | 0 | Inline addresses in tables |
| `mono-md` | 14 / 20 | 400 | 0 | Canvas labels, CLI |
| `mono-lg` | 18 / 24 | 500 | 0 | Bit cells, hex cells |
| `mono-display` | 112 / 112 | 600 | +0.04em | Projector room code |
| `mono-timer` | 20 / 24 (bar) · 56 / 56 (projector) | 500 | 0 | Timers |

### 4.3 Technical formatting rules (enforced by `@cn/ui/format`)

| Data | Format | Example |
|---|---|---|
| IPv4 | dotted decimal, no padding; prefix in `--fg-2` | `192.168.10.64`/`27` |
| IPv4 binary | octets separated by a 6 px gap (not a dot) when interactive; a dot when inline | `11000000 10101000 00001010 01000000` |
| Subnet mask | dotted decimal and `/n` side by side | `255.255.255.224  /27` |
| IPv6 | lowercase, RFC 5952 canonical for display; inputs accept any valid form | `2001:db8::a40:0:0:f1` |
| MAC | uppercase hex, colon-separated | `4A:30:10:21:10:1A` |
| Hex dump | uppercase byte pairs, 8 bytes per group, offset column in `--fg-3` | `0000  CB 84 00 0D 00 1C 00 1C` |
| Bitstreams | groups of 4 with 4 px gaps; stuffed or inserted bits underlined in `--signal` | `0111 1101 0111 1101 00` |
| Durations | `mm:ss` under one hour; tabular | `04:12` |
| Ratios vs expected | actual / expected, expected in `--fg-3` | `04:12 / 05:00` |
| Percentages | one decimal max, tabular | `91.7%` |

`font-variant-numeric: tabular-nums slashed-zero` applies to all numeric UI (leaderboards, timers, counters). JetBrains Mono's zero is already distinct.

## 5. Space, shape, depth

- **Spacing scale (px):** 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64. The layout grid is 4 px; the canvas grid is 16 px.
- **Radii:** `--r-1: 2px` (bit cells, tags) · `--r-2: 4px` (buttons, inputs, menu items) · `--r-3: 6px` (panels, dialogs, popovers). **Nothing larger.**
- **Borders:** 1 px everywhere. Inputs and table header rules use `--border-2`. Selected objects get a 1 px `--signal` outline plus `--signal-bg` fill. Keyboard focus gets a 2 px `--signal` ring offset 2 px, visible only via `:focus-visible`.
- **Elevation:**
  - `e0`: flat; panels and tables separate by border and tone (`bg-1` on `bg-0`).
  - `e1` popover / menu / tooltip: `bg-2` + `border-1` + `0 8px 24px rgb(0 0 0 / 0.28)` dark / `0 8px 24px rgb(16 24 40 / 0.08)` light.
  - `e2` dialog: `e1` plus a scrim `rgb(10 12 15 / 0.72)` dark / `rgb(14 17 22 / 0.32)` light. No backdrop blur.
- **Z-index:** canvas 0 · canvas overlays 10 · telemetry bar 20 · popovers 30 · dialogs 40 · integrity overlay 50 · toasts 60.

## 6. Layout blueprints

### 6.1 Teacher: Today (home)

```
┌ CN Workbench ─────────────────────────────────────────── ⌘K Search   Dr. Meera R. ▾ ┐
│ Today · Thu 19 Nov                                                                   │
│                                                                                      │
│  NOW   10:40–11:30   21CSC302J · K2 · 68 students        [ New room  ⌘N ]            │
│        Last room: Tue · U2 VLSM, NAT · mean 71.4 · 3 flagged                         │
│  NEXT  13:20–15:00   21CSC302J · K4 · Lab (double)       [ Plan room ]               │
│ ──────────────────────────────────────────────────────────────────────────────────── │
│  Recent rooms                                                                         │
│  Code     Section  Scope                Window          Status     Mean   Flagged    │
│  K7Q-4MX  K2       U2 · Lab 4, Lab 6    Tue 10:40–11:30 Published  71.4   3          │
│  …                                                                                    │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Student: Workbench (canvas-first; 1280×720 minimum)

```
┌─ TELEMETRY BAR (40 px, bg-2, border-bottom) ─────────────────────────────────────────────────────────────┐
│ ▣ Locked  │ Item 3/6  U2 · VLSM  │  Room 31:42  │  Item 04:12 / 05:00  │  Moves 9 / 12  │  Checks 1 · free 1  │ ● Live │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌─ PROMPT RAIL (320 px, collapsible ⌘\) ─┐┌─ CANVAS (fills; bg canvas + 16 px dot grid; per-student watermark 3%) ─┐
│ Plan the address space                 ││                                                                       │
│                                        ││   192.168.40.0/24                                                     │
│ Block   192.168.40.0/24                ││   ├────────────────────────────── 256 ───────────────────────────────┤ │
│ LAN A   60 hosts                       ││   [ A /26  .0–.63 ][ B /27 ][ C /28 ][D/29][W]  free                  │
│ LAN B   28 hosts                       ││                                                                       │
│ LAN C   12 hosts                       ││   Drag a requirement onto free space. Drag edges to split.            │
│ LAN D    5 hosts                       ││                                                                       │
│ WAN      2 hosts                       ││   ┌ Inspector: LAN B ─────────────────────────┐                       │
│                                        ││   │ Network   192.168.40.64   Mask /27        │                       │
│ Checkpoints                            ││   │ First     192.168.40.65   Bcast .95       │                       │
│ ● Sizing        verified               ││   └───────────────────────────────────────────┘                       │
│ ○ Placement                            ││                                                                       │
│ ○ Host ranges                          ││                                                                       │
└────────────────────────────────────────┘└───────────────────────────────────────────────────────────────────────┘
┌─ ACTION BAR (48 px) ─────────────────────────────────────────────────────────────────────────────────────┐
│ ◀ Prev   Next ▶        Undo ⌘Z   Redo ⇧⌘Z   Reset item            [ Check placement  ⏎ ]  [ Submit item ] │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Telemetry bar:** every element is tabular mono, with ratio values showing the expected value in `--fg-3`.
  - Item time turns amber at 100% of expected and does not change further, so there is no escalating pressure.
  - The room timer turns amber at ≤ 5 min and crimson at ≤ 1 min. During grace it shows `Late +02:13` in amber.
  - "▣ Locked" shows the fullscreen state; "● Live" shows connectivity (`Reconnecting…` in amber).
- **Item navigator:** `⌘J` opens a compact list of items with status glyphs (○ unopened, ◐ in progress, ● submitted) and T&E chips. It is never a sidebar of cards.
- **Canvas** owns pan/zoom (space-drag, ⌘+/−, `0` to fit). Template controls dock at the canvas's top-right as a 32 px icon toolbar.
- **Watermark:** the student's register number, tiled diagonally at 3% opacity in `mono-sm`, rendered in the canvas layer (not CSS background) so screenshots include it.

### 6.3 Student: integrity pause overlay (z 50)

```
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│                    ⤢  Assessment paused                       │
│                                                               │
│   You left full screen at 10:42:13. This has been recorded.   │
│   The room timer is still running.                            │
│                                                               │
│                 [ Return to full screen ]                     │
│                                                               │
│                     Away  00:07                               │
└───────────────────────────────────────────────────────────────┘
```

- The background is `--bg-0` at 98% opacity, so the canvas is not legible behind it.
- The text is plain and factual. There is no countdown threat and no red full-screen wash.

### 6.4 Projector: room code

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 21CSC302J · Section K2 · U2 VLSM, Lab 4, Lab 6                                │
│                                                                              │
│                         K7Q-4MX                         ┌──────────┐         │
│                                                         │ QR       │         │
│                cn.srmist.edu.in/join                    │          │         │
│                                                         └──────────┘         │
│                                                                              │
│      Starts in 02:14            Joined 41 / 68            PIN 482 913 (labs) │
└──────────────────────────────────────────────────────────────────────────────┘
```

- The room code uses `mono-display`. The character set is `ACDEFHJKMNPQRTUVWXY3479`, with no `0/O/1/I/L/5/S/2/Z/8/B/6/G`.
- The view always renders in dark theme, which projects better in lit classrooms. Never show the leaderboard or integrity data here unless the teacher explicitly chooses "Project top 10" after close.

### 6.5 Teacher: Live Command Center

```
┌ K7Q-4MX · K2 · OPEN · ends 11:30 (31:42) · grace 15m ─── [Pause] [Extend ▾] [Message] [Close room] ┐
├───────────────────────────────────┬─────────────────────────────────────────┬───────────────────────┤
│ ROSTER  68 · 61 active · 4 lobby  │ PERFORMANCE  │ INTEGRITY                │ EVENTS                │
│ ⌕ filter      sort: risk ▾        │ #  Student        S     Acc   E M H  t/t̂ │ 10:42:13  RA…047      │
│ ─────────────────────────────────  │ 1  Priya S.     92.4  95.0  ▮▮▮ 0.82    │  ▲ tab hidden 12 s    │
│ ● RA…012 Arjun K.   3/6  ◐  71.2  │ 2  Karthik R.   90.1  93.3  ▮▮▯ 0.91    │  item 3 · VLSM        │
│ ▲ RA…047 Divya M.   2/6  ◐  64.0  │ 3  …                                     │ 10:41:58  RA…103      │
│ ■ RA…103 Rahul V.   4/6  ◐  58.5  │                                          │  ■ devtools suspected │
│ …                                 │ (Integrity tab)                          │ 10:41:02  RA…047      │
│                                   │ Student   Tier     I     FS  Tab Blur Oth│  ▲ fullscreen exit 4s │
│                                   │ Rahul V.  Flagged  0.71   2   3   1   DT │                       │
│                                   │ Divya M.  Watch    0.91   1   1   0   —  │ [Excuse] on hover     │
└───────────────────────────────────┴─────────────────────────────────────────┴───────────────────────┘
```

- **Three panes:** Roster (360 px), Boards (fluid), Events (320 px). Every pane scrolls independently, and table headers are sticky.
- **Row glyphs:** `●` emerald = clean, `▲` amber = watch or T&E, `■` crimson = flagged. Each glyph pairs with a tooltip and an aria-label.
- **E/M/H accuracy:** three 4×12 px bars filled proportionally. There are no pie charts or donut charts anywhere.
- **Event feed:** newest first, relative time and absolute on hover. New events slide in with a 120 ms height transition and no highlight flash. A crimson event also adds a 2 px left rule to that student's roster row until the teacher acknowledges it.

### 6.6 Teacher: Room setup (single page, three columns)

```
┌ New room · 21CSC302J · K2 ───────────────────────────────────────────────────────────────── [Open room ⏎] ┐
│ SCOPE                               │ MIX & WINDOW                       │ PREVIEW                          │
│ ⌕ Search topics                     │ Items  6                           │ Slot 1 · Easy · u2.mask          │
│ ▸ U1 Introduction to Networks       │ ├ Easy ▮▮──── 2 │ Medium ▮▮ 2 │ Hard ▮▮ 2 │ bitbench · 192.168.x.x/27   │
│ ▾ U2 Addressing            ☑ 6/10   │ Σ expected 31 min · window 50 min ✓ │ [Re-roll] [Exclude]              │
│    ☑ Subnet mask                    │ Start 10:40   End 11:30 (period 3) │ Slot 2 · …                       │
│    ☑ VLSM                           │ Late  accept-flagged ▾  grace 15m  │                                  │
│    ☐ Supernetting …                 │ Policies ▸ (feedback binary, integrity enforced, review on) │       │
│ ▾ Labs                              │                                    │                                  │
│    ☑ Lab 4 VLSM          → u2.vlsm  │ Coverage: 41 blueprints · 7 templates │                              │
│    ☑ Lab 6 NAT           → u2.nat   │                                    │                                  │
│ [ Since last room ]                 │                                    │                                  │
└─────────────────────────────────────┴────────────────────────────────────┴──────────────────────────────────┘
```

### 6.7 Results and review
- **Table:** register no. · name · S · Accuracy · Mastery · I (tier) · L · marks · T&E items · override marker.
- **Row → Review drawer** (640 px right sheet):
  - the item list with each item's score decomposition;
  - **Replay**: a scrubbable timeline (0 → submit) with three lanes: moves (ticks), checks (✓/✗ markers), and integrity (amber/crimson spans);
  - a read-only reconstruction of the canvas at the scrub position.

## 7. Components (`@cn/ui`)

| Component | Spec |
|---|---|
| **Button** | Heights 28 / 32 / 36. Variants: `primary` (ink fill, ink-fg text), `secondary` (bg-1, border-2), `ghost` (no border, bg-3 on hover), `danger` (bad text and border; fill only inside confirm dialogs). Icon + label gap 6 px. Pressed state: translateY(0.5px), no scale. Disabled: fg-3, no opacity tricks. |
| **IconButton** | Square 28 / 32; 16 px Lucide icon; tooltip required (with shortcut if any). |
| **Input** | Height 32; bg-1; border-2; radius 4; mono variant for technical values. |
| **AddressInput** | A segmented IPv4 input: four 3-char cells with auto-advance on `.`, paste-blocked during attempts, live syntactic validation (no semantic hints). Variants for prefix (`/n`) and MAC. |
| **BitField** | N cells of 28×32 px, `mono-lg`; click, Space, or Enter toggles; arrow keys move; group gap every 4 or 8 bits; optional index row in `fg-3` (LSB-first positions for Hamming). |
| **SegmentedControl** | Two to five options; bg-3 track, bg-1 thumb with border-1; no sliding blob animation (an instant position change is fine). |
| **Table** | 32 px rows (dense) / 40 px (comfortable); header `text-micro` fg-2 on bg-1 with a border-2 bottom; numeric columns right-aligned and tabular; row hover bg-3; selection signal-bg + signal 1 px left rule. Sorting via header click with a chevron icon. |
| **StatusTag** | Inline: 6 px dot or 14 px icon + label; border 1 px of the status colour at 40% alpha; text in the status colour; bg is the status `-bg` token. Height 20; radius 2. |
| **Meter** | 4 px tall bar, bg-3 track, fg-2 fill (status colour only when the meaning is status). |
| **Timer** | Tabular mono; colour thresholds per §6.2; `aria-live="polite"` announcements at 5 min and 1 min only. |
| **Kbd** | mono-sm, border-1, radius 2, 18 px tall. |
| **Toast** | Bottom-right, bg-2, border-1, e1; 4 s default; never stacks more than 3; status icon at left. |
| **Dialog** | Max 560 px; e2; title h3; footer with right-aligned actions; Esc closes (except during attempt-critical confirmations). |
| **Command palette** (teacher) | ⌘K: navigate sections, rooms, students; actions (extend, pause, message). |
| **EmptyState** | One line of fg-2 text and one action. No illustration. |
| **Skeleton** | Static bg-3 blocks matching the final layout. No shimmer. |

## 8. Canvas kit (`@cn/templates-ui/kit`)

| Element | Spec |
|---|---|
| **Device glyphs** | Original 1.5 px-stroke line glyphs at 40×40 (router: circle with four cardinal arrows; switch: rounded rectangle with two opposed arrow pairs; hub: rectangle with a fan of lines; PC: monitor; server: stacked rectangles; cloud: three-arc outline; AS boundary: dashed hull). Not Cisco artwork. Stroke `--fg-1`, fill `--bg-1`. Label below in `mono-sm`. |
| **Ports** | 8 px squares on device edges, labelled on hover (`Gi0/0`, `Se0/0/0`). States: free (border-2), occupied (fg-2 fill), compatible drop target (signal outline), incompatible (fg-3 + "not-allowed" cursor). |
| **Links** | 1.5 px. Copper straight: solid · crossover: 6-3 dash · serial: solid with a 4 px zig at midpoint and a `DCE` tag on the clocking end · fiber: double hairline · console/rollover: dotted. Media is distinguished by shape, not hue. |
| **Packets / frames** | 28×16 rect tokens, radius 2, filled with the `--cat-*` of their outermost header, label `mono-sm` (e.g. `F3`, `SYN`). Move linearly; collisions render as two tokens overlapping with a crimson 1 px outline and an `×` glyph. |
| **Timelines** | Horizontal time axis with ticks in `fg-3`, `text-micro` labels; lanes 40 px; frames as spans; vulnerable windows as hatched `--warn-bg` spans. |
| **Ladder diagrams** | Two to four vertical lifelines (1 px border-2), arrows 1.5 px fg-1 with labels in mono-sm above the arrow; the editable label slot is a dashed 1 px signal outline when focused. |
| **Graph (xyflow)** | Nodes as 32 px circles (border-2, bg-1, mono label). Edge weights shown in a small bg-1 chip with border-1 at the midpoint. Finalised (SPT) edges become 2 px fg-1; candidate edges 1 px fg-3 dashed. |
| **Drag affordance** | Draggables show a 6-dot grip on hover. During drag: 0.92 opacity source ghost, real item follows the cursor with a 1 px signal outline; valid targets highlight with signal-bg; on drop, a 120 ms settle. |
| **Verdict states** | Correct checkpoint: affected elements get a 1 px `--ok` outline for 1.2 s, then settle to normal; the checkpoint row shows `CheckCircle2` + "Verified". Incorrect: affected fields get a persistent 1 px `--bad` outline until edited (only under `checkpoint` feedback; under `binary`, only the checkpoint row shows "Incorrect"). |
| **T&E chip** | `AlertTriangle` + "Trial-and-error pattern · 5 checks (expected ≤ 2)" in a warn StatusTag on the checkpoint row. Static, never animated. |

## 9. Motion

| Token | Duration | Easing | Used for |
|---|---|---|---|
| `--t-instant` | 80 ms | linear | Hover and pressed tint |
| `--t-quick` | 120 ms | `cubic-bezier(0.2, 0, 0, 1)` | Drops settling, verdict outlines, feed insertion |
| `--t-move` | 180 ms | `cubic-bezier(0.2, 0, 0, 1)` | Leaderboard reorder (FLIP), drawer open, item navigation |
| `--t-physical` | parameter-driven | **linear** | Packets and bits in simulations: speed is meaningful (proportional to propagation delay), so it is never eased |

- **Animate:** state changes the user caused; simulated physics.
- **Do not animate:** layout on data arrival (except the leaderboard FLIP), background decoration, numbers ticking up (counters update instantly).
- **`prefers-reduced-motion: reduce`:** all transitions become 0 ms. Simulations switch to step mode (Next ▸) with no continuous motion.

## 10. Iconography

**Lucide** at 1.5 px stroke; 16 px in dense UI and 20 px in toolbars; `currentColor`. Fixed mapping, so the same meaning always gets the same icon:

| Meaning | Icon |
|---|---|
| Fullscreen locked / paused | `Maximize2` / `Minimize2` |
| Connected / reconnecting | `Radio` / `RadioTower` (amber) |
| Clean / Watch / Flagged | `ShieldCheck` / `AlertTriangle` / `ShieldAlert` |
| Tab hidden | `EyeOff` |
| Window blur | `MonitorOff` |
| DevTools suspected | `Code2` |
| Clipboard attempt | `ClipboardX` |
| Multi-session | `Copy` |
| Late | `Clock4` |
| Check / Submit | `CheckCheck` / `ArrowRightToLine` |
| Undo / Redo / Reset | `Undo2` / `Redo2` / `RotateCcw` |
| Trial-and-error | `Shuffle` |

## 11. Copy and tone

- **Sentence case** everywhere ("Open room", not "Open Room").
- **Factual and specific:** "You left full screen at 10:42:13. This has been recorded." Never "Oops!" or "Uh-oh".
- **No exclamation marks, no emoji, no praise inflation.** A correct answer is "Verified", not "Great job!".
- **Numbers over adjectives:** "5 checks (expected ≤ 2)" rather than "too many attempts".
- **Technical terms follow the course:** use "dataword / codeword", "syndrome", "send window", "ackNo", as in the slides.
- **Errors say what happened and what to do:** "Can't reach the server. Your work is saved on this device. Checks will resume when the connection returns."

## 12. Accessibility

- WCAG 2.2 AA. Focus is always visible. The DOM order matches the visual order.
- **Every drag interaction has a keyboard path** (see each template's "Keyboard" row in INTERACTIVE_TEMPLATES_SPEC). The pattern is: select the source with Enter, move the focus to the target with arrows/Tab, then Enter to drop. Esc cancels.
- **Screen readers:**
  - canvas objects are SVG elements with `role` and `aria-label`, e.g. "Port Gi0/1 on R2, free, compatible with straight-through copper";
  - live verdicts go through an `aria-live="polite"` region.
- Hit targets are ≥ 24×24 px (bit cells are 28×32).
- An extra-time accommodation (per student) scales the room window and every item's expected time, so efficiency is not penalised.
- The projector view is checked for legibility at 4 m with a 1080p projector.

## 13. Theming implementation

```css
/* @cn/ui/tokens.css (excerpt) */
:root, :root[data-theme="light"] {
  --bg-0:#F6F7F9; --bg-1:#FFFFFF; --bg-2:#FAFBFC; --bg-3:#F0F2F5;
  --border-1:#E2E5EA; --border-2:#CBD1D8;
  --fg-1:#0E1116; --fg-2:#4A5361; --fg-3:#868E99;
  --signal:#1F5FCC; --ok:#1D7A55; --warn:#946300; --bad:#C02B2B;
  --r-1:2px; --r-2:4px; --r-3:6px;
  --font-sans:"Geist", ui-sans-serif, system-ui;
  --font-mono:"JetBrains Mono", ui-monospace, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { /* dark values */ } }
:root[data-theme="dark"] {
  --bg-0:#0A0C0F; --bg-1:#0F1216; --bg-2:#14181D; --bg-3:#1B2027;
  --border-1:#222831; --border-2:#2E3540;
  --fg-1:#E8EBEF; --fg-2:#A2AAB5; --fg-3:#6C7480;
  --signal:#5B93F5; --ok:#3FA37A; --warn:#D6A23E; --bad:#E5534B;
}
```

```css
/* tailwind v4 */
@import "tailwindcss";
@theme inline {
  --color-bg-0: var(--bg-0); --color-bg-1: var(--bg-1); --color-bg-2: var(--bg-2); --color-bg-3: var(--bg-3);
  --color-fg-1: var(--fg-1); --color-fg-2: var(--fg-2); --color-fg-3: var(--fg-3);
  --color-line: var(--border-1); --color-line-strong: var(--border-2);
  --color-signal: var(--signal); --color-ok: var(--ok); --color-warn: var(--warn); --color-bad: var(--bad);
  --radius-sm: var(--r-1); --radius-md: var(--r-2); --radius-lg: var(--r-3);
  --font-sans: var(--font-sans); --font-mono: var(--font-mono);
}
```

**Lint rules:**
- ESLint `no-restricted-syntax` and Stylelint ban raw hex values in components.
- The Tailwind classes `rounded-xl`, `rounded-2xl`, `rounded-3xl`, `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-2xl`, `bg-gradient-*`, `from-*`, `via-*`, `to-*`, `backdrop-blur-*` and the default palette colours (`indigo-*`, `purple-*`, `pink-*`, `cyan-*`, …) are banned via `eslint-plugin-tailwindcss` `no-custom-classname` plus a blocklist.

**Theme defaults:**
- Student default: the system theme, with a toggle in the lobby. The theme cannot change mid-attempt, which avoids accidental blur events.
- Teacher: per-user choice.

## 14. Anti-slop review gate (PR checklist)

Every UI PR includes screenshots in **both themes** and answers:

- [ ] No banned item from §2 (gradients, emoji, blobs, default cards, confetti, shake, pills).
- [ ] All colours come from tokens. Status colour is paired with an icon or text.
- [ ] Every number is tabular. Every address, bit, and hex value is in mono and formatted per §4.3.
- [ ] Radius ≤ 6 px. Borders are 1 px. No shadows on in-flow content.
- [ ] Copy is sentence case, specific, and free of exclamation marks.
- [ ] Every drag interaction has a keyboard path. Focus ring is visible.
- [ ] It renders correctly at 1280×720 and at 200% zoom.
- [ ] Motion is limited to §9 tokens. Reduced-motion mode has been checked.
- [ ] "Would this look at home next to Linear's issue view or a Keysight analyser UI?" If it looks like a startup landing page, redo it.

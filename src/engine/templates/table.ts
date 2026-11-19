import type { Rng } from "../rng";
import { fraction, type Difficulty, type Template } from "../types";

/**
 * Decision table: each row is an event (packet, frame, route) with given cells and answer cells.
 * Rows are simulated per student (addresses, ports, sequence numbers, attributes all random).
 */
export type Cell =
  | { kind: "given"; text: string }
  | { kind: "none" }
  | { kind: "number" | "text" | "select"; options?: string[]; answer: string | number; placeholder?: string };

export interface TableParams {
  d: Difficulty;
  mode: string;
  prompt: string;
  rules: string[];
  columns: { id: string; label: string; width?: string }[];
  rows: { id: string; cells: Record<string, Cell> }[];
}

type Gen = (rng: Rng, d: Difficulty) => Omit<TableParams, "d" | "mode">;
const g = (text: string): Cell => ({ kind: "given", text });
const none: Cell = { kind: "none" };

const MODES: Record<string, Gen> = {
  nat(rng, d) {
    const third = rng.int(0, 254);
    const inside = (h: number) => `192.168.${third}.${h}`;
    const pub = `203.0.113.${rng.int(2, 250)}`;
    const servers = [`198.51.100.${rng.int(2, 250)}`, `192.0.2.${rng.int(2, 250)}`];
    const used = new Set<number>();
    const table: { priv: string; port: number; pubPort: number; dst: string }[] = [];
    const rows: TableParams["rows"] = [];
    const hosts = rng.sample([10, 11, 12, 13, 14, 20, 21, 25, 30], 4);
    const basePort = rng.int(49200, 60000);
    const flows = d === "easy" ? 3 : 4;
    for (let i = 0; i < flows; i++) {
      // medium/hard: second flow reuses the first flow's source port (conflict)
      const port = d !== "easy" && i === 1 ? table[0]!.port : basePort + rng.int(1, 1200) * (i + 1);
      const proto = rng.pick(["TCP", "TCP", "UDP"]);
      const dport = proto === "UDP" ? 53 : rng.pick([80, 443, 25]);
      const dst = `${rng.pick(servers)}:${dport}`;
      let pp = port;
      while (used.has(pp)) pp++;
      used.add(pp);
      table.push({ priv: `${inside(hosts[i]!)}`, port, pubPort: pp, dst });
      rows.push({
        id: `r${rows.length}`,
        cells: {
          pkt: g(`OUT  ${inside(hosts[i]!)}:${port} → ${dst} (${proto})`),
          xl: { kind: "text", answer: `${pub}:${pp}`, placeholder: "address:port" },
          act: { kind: "select", options: ["Forward", "Drop"], answer: "Forward" },
        },
      });
    }
    const replyTo = d === "easy" ? table[0]! : table[1]!;
    rows.push({
      id: `r${rows.length}`,
      cells: {
        pkt: g(`IN   ${replyTo.dst} → ${pub}:${replyTo.pubPort} (reply)`),
        xl: { kind: "text", answer: `${replyTo.priv}:${replyTo.port}`, placeholder: "address:port" },
        act: { kind: "select", options: ["Forward", "Drop"], answer: "Forward" },
      },
    });
    if (d === "hard") {
      let p = rng.int(1024, 5000);
      while (used.has(p)) p++;
      rows.push({
        id: `r${rows.length}`,
        cells: { pkt: g(`IN   198.51.100.${rng.int(2, 250)}:${rng.int(1024, 9000)} → ${pub}:${p} (unsolicited)`), xl: none, act: { kind: "select", options: ["Forward", "Drop"], answer: "Drop" } },
      });
    }
    return {
      prompt: `Router R1 runs PAT (NAT overload) for 192.168.${third}.0/24 using the single public address ${pub}. Translate each packet in order.`,
      rules: ["Outbound: write the new source address:port.", "Inbound: write the new destination address:port.", "R1 keeps the source port when it is free; otherwise it uses the next free port above it.", "Drop inbound packets with no translation entry."],
      columns: [
        { id: "pkt", label: "Packet", width: "1fr" },
        { id: "xl", label: "Translated address:port", width: "220px" },
        { id: "act", label: "Action", width: "130px" },
      ],
      rows,
    };
  },

  stopwait(rng) {
    let s = rng.int(0, 1);
    let pkt = rng.int(1, 40);
    const rows: TableParams["rows"] = [];
    const add = (event: string, act: Cell, ack: Cell, resend: Cell) => rows.push({ id: `r${rows.length}`, cells: { ev: g(event), act, ack, rs: resend } });
    const sel = (a: string): Cell => ({ kind: "select", options: ["Accept", "Discard", "Buffer"], answer: a });
    const n = (v: number): Cell => ({ kind: "number", answer: v });
    for (let i = rng.int(1, 3); i > 0; i--) {
      add(`Frame ${s} (packet P${pkt++}) arrives`, sel("Accept"), n(1 - s), none);
      s = 1 - s;
    }
    const ackLost = rng.bool();
    if (ackLost) {
      add(`Frame ${s} (packet P${pkt}) arrives`, sel("Accept"), n(1 - s), none);
      add(`ACK ${1 - s} is lost; the sender's timer expires`, none, none, { kind: "text", answer: String(s), placeholder: "frame(s)" });
      add(`The resent frame ${s} (packet P${pkt}) arrives`, sel("Discard"), n(1 - s), none);
    } else {
      add(`Frame ${s} (packet P${pkt}) is lost; the sender's timer expires`, none, none, { kind: "text", answer: String(s), placeholder: "frame(s)" });
      add(`The resent frame ${s} (packet P${pkt}) arrives`, sel("Accept"), n(1 - s), none);
    }
    s = 1 - s;
    pkt++;
    add(`Frame ${s} (packet P${pkt}) arrives`, sel("Accept"), n(1 - s), none);
    return {
      prompt: "Stop-and-Wait ARQ with 1-bit sequence numbers. Fill in what happens at each event.",
      rules: ["The ackNo is the sequence number of the next frame expected.", "A duplicate frame is discarded but still acknowledged.", "On a timeout the sender resends the frame it saved."],
      columns: [
        { id: "ev", label: "Event", width: "1fr" },
        { id: "act", label: "Receiver", width: "130px" },
        { id: "ack", label: "ackNo sent", width: "110px" },
        { id: "rs", label: "Sender resends", width: "140px" },
      ],
      rows,
    };
  },

  gbn(rng, d) {
    return arq(rng, d, false);
  },
  sr(rng, d) {
    return arq(rng, d, true);
  },

  bgp(rng, d) {
    const STAGES = ["LOCAL-PREF", "MULTI-EXIT-DISC", "AS-PATH", "NEXT-HOP", "External over internal", "BGP identifier"];
    const n = d === "easy" ? 3 : d === "medium" ? 4 : 5;
    const want = d === "easy" ? [0, 1] : d === "medium" ? [2, 3] : [3, 4, 5];
    for (let t = 0; t < 500; t++) {
      const ids = rng.sample(Array.from({ length: 200 }, (_, i) => i + 2), n);
      const routes = Array.from({ length: n }, (_, i) => ({
        name: `R${String.fromCharCode(97 + i)}`,
        lp: rng.pick([100, 100, 200, 200, 150]),
        med: rng.pick([0, 10, 20, 50]),
        path: Array.from({ length: rng.int(1, 4) }, () => rng.int(64512, 65534)),
        nh: rng.int(1, 20),
        ext: rng.bool(),
        id: ids[i]!,
      }));
      // Forouzan Fig 20.30 flow
      let alive = routes.slice();
      const elim: Record<string, number> = {};
      const keys: ((r: (typeof routes)[number]) => number)[] = [(r) => -r.lp, (r) => r.med, (r) => r.path.length, (r) => r.nh, (r) => (r.ext ? 0 : 1), (r) => r.id];
      let stop = -1;
      for (let s = 0; s < keys.length; s++) {
        const best = Math.min(...alive.map(keys[s]!));
        alive.forEach((r) => {
          if (keys[s]!(r) !== best) elim[r.name] = s;
        });
        alive = alive.filter((r) => keys[s]!(r) === best);
        if (alive.length === 1) {
          stop = s;
          break;
        }
      }
      if (stop < 0 || !want.includes(stop)) continue;
      const opts = [...STAGES.map((s) => `Out at ${s}`), "Selected (best route)"];
      return {
        prompt: `Router R1 has ${n} BGP routes to 10.${rng.int(1, 250)}.0.0/16. Apply the route-selection flow from the slides and say where each route drops out.`,
        rules: ["Order: highest LOCAL-PREF → lowest MULTI-EXIT-DISC → shortest AS-PATH → least-cost NEXT-HOP → external over internal → lowest BGP identifier.", "A route drops out at the first step where it is not among the best."],
        columns: [
          { id: "r", label: "Route", width: "60px" },
          { id: "lp", label: "LOCAL-PREF", width: "90px" },
          { id: "med", label: "MED", width: "60px" },
          { id: "path", label: "AS-PATH", width: "1fr" },
          { id: "nh", label: "NEXT-HOP cost", width: "100px" },
          { id: "o", label: "Learned", width: "80px" },
          { id: "id", label: "BGP id", width: "100px" },
          { id: "out", label: "Result", width: "220px" },
        ],
        rows: routes.map((r, i) => ({
          id: `r${i}`,
          cells: {
            r: g(r.name),
            lp: g(String(r.lp)),
            med: g(String(r.med)),
            path: g(r.path.join(" ")),
            nh: g(String(r.nh)),
            o: g(r.ext ? "eBGP" : "iBGP"),
            id: g(`192.0.2.${r.id}`),
            out: { kind: "select", options: opts, answer: elim[r.name] === undefined ? "Selected (best route)" : `Out at ${STAGES[elim[r.name]!]}` },
          },
        })),
      };
    }
    return MODES.nat!(rng, d);
  },

  maclearn(rng, d) {
    const names = rng.sample(["A", "B", "C", "D", "E", "F", "G"], 5);
    const hex = () => rng.int(0, 255).toString(16).toUpperCase().padStart(2, "0");
    const mac: Record<string, string> = Object.fromEntries(names.map((n) => [n, `${hex()}:${hex()}`]));
    const ports = rng.shuffle([1, 2, 3, 4]);
    const portOf: Record<string, number> = {};
    names.forEach((n, i) => (portOf[n] = ports[i % 4]!)); // the 5th host shares a port through a hub
    const shared = names[4]!;
    const mate = names.find((n) => n !== shared && portOf[n] === portOf[shared])!;
    const frames: [string, string][] = [];
    const k = d === "easy" ? 4 : d === "medium" ? 6 : 7;
    const learned = new Set<string>();
    const rows: TableParams["rows"] = [];
    const pairs: [string, string][] = [
      [names[0]!, names[1]!],
      [names[1]!, names[0]!],
      [shared, mate],
      [names[2]!, shared],
      [mate, shared],
      [names[3]!, names[2]!],
      [names[0]!, names[3]!],
    ];
    for (const p of rng.shuffle(pairs.slice(2)).slice(0, k - 2)) frames.push(p);
    frames.unshift(pairs[0]!, pairs[1]!);
    const opts = ["Flood (all ports but the arrival port)", ...[1, 2, 3, 4].map((p) => `Forward on port ${p}`), "Filter (drop, same port)"];
    for (const [s, t] of frames.slice(0, k)) {
      learned.add(s);
      let dec: string;
      if (!learned.has(t)) dec = opts[0]!;
      else if (portOf[t] === portOf[s]) dec = opts[5]!;
      else dec = `Forward on port ${portOf[t]}`;
      rows.push({
        id: `r${rows.length}`,
        cells: {
          f: g(`${s} (…:${mac[s]}) → ${t} (…:${mac[t]}) arrives on port ${portOf[s]}`),
          dec: { kind: "select", options: opts, answer: dec },
          n: { kind: "number", answer: learned.size },
        },
      });
    }
    return {
      prompt: "A learning switch starts with an empty table. Hosts sit on ports 1–4; two hosts share one port through a hub. Decide what the switch does with each frame.",
      rules: ["The switch learns the source address and arrival port of every frame.", "Unknown destination → flood; known destination on another port → forward; same port → filter."],
      columns: [
        { id: "f", label: "Frame", width: "1fr" },
        { id: "dec", label: "Switch decision", width: "270px" },
        { id: "n", label: "Table entries after", width: "130px" },
      ],
      rows,
    };
  },
};

function arq(rng: Rng, d: Difficulty, selective: boolean): Omit<TableParams, "d" | "mode"> {
  const m = d === "hard" ? rng.int(3, 5) : rng.int(3, 4);
  const mod = 2 ** m;
  const window = selective ? mod / 2 : mod - 1;
  // hard starts near the top of the sequence space so numbers wrap around to 0
  const s0 = d === "hard" ? rng.int(mod - 4, mod - 1) : rng.int(0, mod - 1);
  const L = rng.int(1, Math.min(3, window - 2)); // index of the lost frame
  const later = rng.int(1, Math.min(3, window - L - 1)); // frames after the loss (window must allow them)
  const seq = (i: number) => (s0 + i) % mod;
  const rows: TableParams["rows"] = [];
  const sel = (a: string): Cell => ({ kind: "select", options: ["Accept", "Discard", "Buffer"], answer: a });
  const n = (v: number): Cell => ({ kind: "number", answer: v });
  const add = (ev: string, act: Cell, ack: Cell, rs: Cell) => rows.push({ id: `r${rows.length}`, cells: { ev: g(ev), act, ack, rs } });
  for (let i = 0; i < L; i++) add(`Frame ${seq(i)} arrives`, sel("Accept"), n(selective ? seq(i) : seq(i + 1)), none);
  add(`Frame ${seq(L)} is lost`, none, none, none);
  for (let i = L + 1; i <= L + later; i++) add(`Frame ${seq(i)} arrives`, sel(selective ? "Buffer" : "Discard"), n(selective ? seq(i) : seq(L)), none);
  const resend = selective ? String(seq(L)) : Array.from({ length: later + 1 }, (_, i) => seq(L + i)).join(",");
  add(`Timer for frame ${seq(L)} expires`, none, none, { kind: "text", answer: resend, placeholder: "e.g. 2,3,4" });
  add(`The resent frame ${seq(L)} arrives`, sel("Accept"), n(selective ? seq(L) : seq(L + 1)), none);
  return {
    prompt: `${selective ? "Selective Repeat" : "Go-Back-N"} ARQ with m = ${m} (sequence numbers 0–${mod - 1}, window ${window}). The sender has sent frames ${Array.from({ length: L + later + 1 }, (_, i) => seq(i)).join(", ")}. Fill in each event.`,
    rules: selective
      ? ["The receiver buffers correct out-of-order frames.", "Each ACK carries the sequence number of the frame it confirms.", "On a timeout only the timed-out frame is resent."]
      : ["The receiver accepts only the frame it expects; others are discarded.", "ackNo is the next frame expected (cumulative); it is resent for discarded frames.", "On a timeout every outstanding frame is resent, oldest first."],
    columns: [
      { id: "ev", label: "Event", width: "1fr" },
      { id: "act", label: "Receiver", width: "130px" },
      { id: "ack", label: "ackNo sent", width: "110px" },
      { id: "rs", label: "Sender resends", width: "150px" },
    ],
    rows,
  };
}

export const TABLE_MODES = Object.keys(MODES);

const normText = (s: unknown) => String(s ?? "").toLowerCase().replace(/\s+/g, "").replace(/;/g, ",");

export function checkCell(c: Cell, got: unknown): boolean {
  if (c.kind === "given" || c.kind === "none") return true;
  if (c.kind === "number") return Number(String(got ?? "").replace(/,/g, "")) === Number(c.answer) && String(got ?? "").trim() !== "";
  if (c.kind === "select") return got === c.answer;
  return normText(got) === normText(c.answer);
}

export const table: Template<TableParams, null> = {
  id: "table",
  generate(rng, d, mode = "nat") {
    const gen = MODES[mode] ?? MODES.nat!;
    return { d, mode, ...gen(rng, d) };
  },
  solve() {
    return null;
  },
  view(p) {
    return {
      prompt: p.prompt,
      rules: p.rules,
      columns: p.columns,
      rows: p.rows.map((r) => ({
        id: r.id,
        cells: Object.fromEntries(Object.entries(r.cells).map(([k, c]) => [k, c.kind === "given" || c.kind === "none" ? c : { kind: c.kind, options: c.options, placeholder: c.placeholder }])),
      })),
    };
  },
  checkpoints() {
    return [{ id: "table", title: "All events", weight: 1 }];
  },
  grade(p, _s, _cp, r) {
    const fields: Record<string, boolean> = {};
    let hits = 0;
    let total = 0;
    for (const row of p.rows) {
      for (const [col, c] of Object.entries(row.cells)) {
        if (c.kind === "given" || c.kind === "none") continue;
        total++;
        const ok = checkCell(c, r?.cells?.[row.id]?.[col]);
        fields[`${row.id}.${col}`] = ok;
        if (ok) hits++;
      }
    }
    return { score: fraction(hits, total), misconceptions: hits < total ? [`table.${p.mode}`] : [], fields };
  },
  optimalMoves(p) {
    return p.rows.reduce((s, r) => s + Object.values(r.cells).filter((c) => c.kind !== "given" && c.kind !== "none").length, 0);
  },
  key(p) {
    return JSON.stringify(p.rows.map((r) => r.cells));
  },
};

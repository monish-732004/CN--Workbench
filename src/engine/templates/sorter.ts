import type { Rng } from "../rng";
import { intToIp, toBits } from "../net";
import { fraction, type Difficulty, type Template } from "../types";

/**
 * Bucket sorter: place each item into the right category. Items are drawn per student
 * from parameterised pools (random addresses, frequencies, MACs, ports, scenarios) and shuffled,
 * so two neighbours never see the same set or order.
 */
export interface SorterItem {
  id: string;
  text: string;
  mono?: boolean;
  bucket: number;
}

export interface SorterParams {
  d: Difficulty;
  mode: string;
  prompt: string;
  buckets: string[];
  items: SorterItem[];
}

const count = (d: Difficulty, e: number, m: number, h: number) => (d === "easy" ? e : d === "medium" ? m : h);

/** Pick n items from per-bucket generators, covering every bucket at least once when possible. */
function spread(rng: Rng, n: number, buckets: number, make: (bucket: number) => Omit<SorterItem, "id" | "bucket">): SorterItem[] {
  const order: number[] = [];
  const base = rng.shuffle(Array.from({ length: buckets }, (_, i) => i));
  for (let i = 0; i < n; i++) order.push(i < buckets ? base[i]! : rng.int(0, buckets - 1));
  const seen = new Set<string>();
  const out: SorterItem[] = [];
  for (const b of order) {
    for (let t = 0; t < 30; t++) {
      const it = make(b);
      if (seen.has(it.text)) continue;
      seen.add(it.text);
      out.push({ ...it, id: `i${out.length}`, bucket: b });
      break;
    }
  }
  return rng.shuffle(out).map((x, i) => ({ ...x, id: `i${i}` }));
}

function fromPool(rng: Rng, pool: [string, number][], n: number, buckets: number): SorterItem[] {
  const byBucket = Array.from({ length: buckets }, (_, b) => rng.shuffle(pool.filter((p) => p[1] === b)));
  const picked: [string, number][] = [];
  for (let b = 0; b < buckets && picked.length < n; b++) if (byBucket[b]!.length) picked.push(byBucket[b]!.shift()!);
  const rest = rng.shuffle(byBucket.flat());
  while (picked.length < n && rest.length) picked.push(rest.shift()!);
  return rng.shuffle(picked).map(([text, bucket], i) => ({ id: `i${i}`, text, bucket }));
}

const PEOPLE = ["Asha", "Ravi", "Meena", "Karthik", "Divya", "Arun", "Nisha", "Vikram", "Priya", "Sanjay"];
const CITIES = ["Chennai", "Bengaluru", "Coimbatore", "Madurai", "Hyderabad", "Kochi", "Trichy", "Pune", "Delhi", "Mumbai"];
const FAR = ["Singapore", "London", "Dubai", "Tokyo", "Frankfurt", "New York", "Sydney"];

function freqText(hz: number): string {
  const units: [number, string][] = [
    [1e12, "THz"],
    [1e9, "GHz"],
    [1e6, "MHz"],
    [1e3, "kHz"],
  ];
  for (const [v, u] of units) if (hz >= v) return `${+(hz / v).toFixed(hz / v >= 100 ? 0 : 1)} ${u}`;
  return `${hz} Hz`;
}

function logRand(rng: Rng, lo: number, hi: number) {
  // log-uniform, avoiding the outer 8% of the decade range so items are never on a boundary
  const a = Math.log10(lo);
  const b = Math.log10(hi);
  const t = 0.08 + (rng.int(0, 1000) / 1000) * 0.84;
  const raw = 10 ** (a + (b - a) * t);
  const mag = 10 ** Math.floor(Math.log10(raw) - 1);
  return Math.round(raw / mag) * mag;
}

const MODES: Record<string, (rng: Rng, d: Difficulty) => Omit<SorterParams, "d" | "mode">> = {
  nettypes(rng, d) {
    const buckets = ["PAN", "LAN", "MAN", "WAN"];
    const items = spread(rng, count(d, 4, 6, 8), 4, (b) => {
      const p = rng.pick(PEOPLE);
      if (b === 0) return { text: `${p}'s phone, smartwatch and earbuds paired over Bluetooth within ${rng.int(1, 9)} m` };
      if (b === 1) return { text: `${rng.int(12, 70)} PCs and a printer in one ${rng.pick(["computer lab", "office floor", "library hall"])} on a switch` };
      if (b === 2) return { text: `${rng.int(3, 9)} college campuses across ${rng.pick(CITIES)}, about ${rng.int(5, 45)} km apart, on a city fibre ring` };
      return { text: `Offices in ${rng.pick(CITIES)} and ${rng.pick(FAR)}, ${rng.int(2, 9) * 1000} km apart, over leased lines` };
    });
    return { prompt: "Classify each network by its size and reach.", buckets, items };
  },
  switching(rng, d) {
    const pool: [string, number][] = [
      ["A dedicated path is set up before any data flows", 0],
      ["Resources stay reserved until the teardown phase", 0],
      ["Traditional telephone calls", 0],
      ["Capacity is wasted when the reserved channel is idle", 0],
      ["Each link is divided into n channels (FDM or TDM)", 0],
      ["No storing: data is only forwarded along the circuit", 0],
      ["Data is split into independent packets", 1],
      ["Routers queue packets when an output line is busy", 1],
      ["Resources are allocated on demand", 1],
      ["Each packet may take a different route", 1],
      ["Store-and-forward at every router", 1],
      ["The Internet's main switching method", 1],
      ["Delay varies with queueing at intermediate nodes", 1],
    ];
    return { prompt: "Is each statement about circuit switching or packet switching?", buckets: ["Circuit switching", "Packet switching"], items: fromPool(rng, pool, count(d, 6, 8, 10), 2) };
  },
  layers(rng, d) {
    const buckets = ["Physical", "Data link", "Network", "Transport", "Session", "Presentation", "Application"];
    const pool: [string, number][] = [
      ["Converts bits to signals on the medium", 0],
      ["NRZ line encoding", 0],
      ["Hub", 0],
      ["Repeater", 0],
      ["Data rate and bit synchronisation", 0],
      ["Frame", 1],
      ["MAC address", 1],
      ["Switch", 1],
      ["Bridge", 1],
      ["Error-free node-to-node (hop) delivery", 1],
      ["Router", 2],
      ["IP address (logical addressing)", 2],
      ["Datagram / packet", 2],
      ["Routing between networks", 2],
      ["Segment / user datagram", 3],
      ["Port numbers", 3],
      ["TCP and UDP", 3],
      ["Process-to-process delivery", 3],
      ["Segmentation and reassembly", 3],
      ["Dialog control (half or full duplex)", 4],
      ["Synchronisation checkpoints in a long transfer", 4],
      ["Encryption of data", 5],
      ["Compression (e.g. JPEG, MPEG)", 5],
      ["Translation between character encodings", 5],
      ["HTTP, FTP, SMTP", 6],
      ["Network virtual terminal (TELNET)", 6],
      ["DNS name lookup", 6],
      ["Services directly used by the user", 6],
    ];
    return { prompt: "Place each item on the OSI layer it belongs to.", buckets, items: fromPool(rng, pool, count(d, 7, 9, 11), 7) };
  },
  media(rng, d) {
    if (d === "easy") {
      const ranges: [number, number][] = [
        [3e3, 1e9],
        [1e9, 3e11],
        [3e11, 4e14],
      ];
      return {
        prompt: "Which kind of unguided signal uses each frequency?",
        buckets: ["Radio wave", "Microwave", "Infrared"],
        items: spread(rng, 6, 3, (b) => ({ text: freqText(logRand(rng, ranges[b]![0], ranges[b]![1])), mono: true })),
      };
    }
    if (d === "medium") {
      const ranges: [number, number][] = [
        [3e3, 2e6],
        [2e6, 3e7],
        [3e7, 3e11],
      ];
      return {
        prompt: "How does a signal at each frequency propagate?",
        buckets: ["Ground (below 2 MHz)", "Sky (2–30 MHz)", "Line-of-sight (above 30 MHz)"].map((x) => x.split(" (")[0]!),
        items: spread(rng, 7, 3, (b) => ({ text: freqText(logRand(rng, ranges[b]![0], ranges[b]![1])), mono: true })),
      };
    }
    const bands: [string, number, number][] = [
      ["VLF", 3e3, 3e4],
      ["LF", 3e4, 3e5],
      ["MF", 3e5, 3e6],
      ["HF", 3e6, 3e7],
      ["VHF", 3e7, 3e8],
      ["UHF", 3e8, 3e9],
      ["SHF", 3e9, 3e10],
      ["EHF", 3e10, 3e11],
    ];
    return {
      prompt: "Place each frequency in its band.",
      buckets: bands.map((b) => b[0]),
      items: spread(rng, 8, 8, (b) => ({ text: freqText(logRand(rng, bands[b]![1], bands[b]![2])), mono: true })),
    };
  },
  ipclass(rng, d) {
    const ranges: [number, number][] = [
      [1, 126],
      [128, 191],
      [192, 223],
      [224, 239],
      [240, 254],
    ];
    const items = spread(rng, count(d, 6, 8, 10), 5, (b) => {
      const ip = ((rng.int(ranges[b]![0], ranges[b]![1]) << 24) | (rng.int(0, 255) << 16) | (rng.int(0, 255) << 8) | rng.int(1, 254)) >>> 0;
      const fmt = d === "easy" ? 0 : d === "medium" ? rng.int(0, 1) : rng.int(0, 2);
      const text =
        fmt === 0
          ? intToIp(ip)
          : fmt === 1
            ? toBits(ip).replace(/(.{8})(?=.)/g, "$1.")
            : (ip >>> 0).toString(16).toUpperCase().padStart(8, "0").replace(/(..)(?=.)/g, "$1 ");
      return { text, mono: true };
    });
    return { prompt: "Which class does each IPv4 address belong to?", buckets: ["Class A", "Class B", "Class C", "Class D", "Class E"], items };
  },
  protocols(rng, d) {
    const pool: [string, number][] = [
      ["Cost is a hop count; 16 hops means unreachable", 0],
      ["Runs over UDP port 520", 0],
      ["Sends its whole table to neighbours periodically", 0],
      ["Distance-vector (Bellman-Ford)", 0],
      ["Version 2 carries subnet masks in updates", 0],
      ["Link-state; each router runs Dijkstra", 1],
      ["Splits an AS into areas around backbone area 0", 1],
      ["Floods link-state advertisements", 1],
      ["Hello, DBD, LSR, LSU and LSAck messages", 1],
      ["Path vector; advertisements carry the AS-PATH", 2],
      ["Sessions run over TCP port 179", 2],
      ["The interdomain protocol between autonomous systems", 2],
      ["Uses eBGP and iBGP sessions", 2],
      ["Prefers highest LOCAL-PREF, then lowest MED", 2],
      ["Hybrid of distance-vector and link-state ideas", 3],
      ["Neighbours discovered with hellos to 224.0.0.10", 3],
      ["Metric from bandwidth, delay, load and reliability", 3],
      ["Keeps a successor and a feasible successor", 3],
      ["Neighbour, topology and route tables", 3],
    ];
    return { prompt: "Match each statement to its routing protocol.", buckets: ["RIP", "OSPF", "BGP", "EIGRP"], items: fromPool(rng, pool, count(d, 6, 8, 10), 4) };
  },
  mactype(rng, d) {
    const hex = (n: number) => n.toString(16).toUpperCase().padStart(2, "0");
    const items = spread(rng, count(d, 5, 7, 9), 3, (b) => {
      const sep = d === "hard" && rng.bool() ? "-" : ":";
      if (b === 2) return { text: Array(6).fill("FF").join(sep), mono: true };
      let first = rng.int(0, 255) & 0xfe;
      if (b === 1) first |= 1;
      if (b === 1 && first === 0xff) first = 0xfd;
      const rest = Array.from({ length: 5 }, () => hex(rng.int(0, 255)));
      if (b === 1 && rng.bool()) return { text: ["01", "00", "5E", hex(rng.int(0, 127)), hex(rng.int(0, 255)), hex(rng.int(0, 255))].join(sep), mono: true };
      return { text: [hex(first), ...rest].join(sep), mono: true };
    });
    return { prompt: "Is each destination MAC address unicast, multicast or broadcast?", buckets: ["Unicast", "Multicast", "Broadcast"], items };
  },
  ports(rng, d) {
    if (d === "medium") {
      const pool: [string, number][] = [
        ["HTTP", 0],
        ["HTTPS", 0],
        ["FTP", 0],
        ["SMTP", 0],
        ["TELNET", 0],
        ["POP3", 0],
        ["IMAP", 0],
        ["BGP", 0],
        ["TFTP", 1],
        ["SNMP", 1],
        ["DHCP", 1],
        ["NTP", 1],
        ["RIP", 1],
        ["Echo (as a UDP service)", 1],
      ];
      return { prompt: "Which transport protocol does each application normally use?", buckets: ["TCP", "UDP"], items: fromPool(rng, pool, 8, 2) };
    }
    const ranges: [number, number][] = [
      [0, 1023],
      [1024, 49151],
      [49152, 65535],
    ];
    const edges = [1023, 1024, 49151, 49152];
    const items = spread(rng, count(d, 6, 8, 9), 3, (b) => {
      let port = rng.int(ranges[b]![0], ranges[b]![1]);
      if (d === "hard" && rng.bool()) {
        const e = edges.filter((x) => x >= ranges[b]![0] && x <= ranges[b]![1]);
        if (e.length) port = rng.pick(e);
      }
      return { text: `Port ${port}`, mono: true };
    });
    return { prompt: "Which range does each port number fall in?", buckets: ["Well-known", "Registered", "Dynamic / private"], items };
  },
};

export const SORTER_MODES = Object.keys(MODES);

export const sorter: Template<SorterParams, Record<string, number>> = {
  id: "sorter",
  generate(rng, d, mode = "layers") {
    const gen = MODES[mode] ?? MODES.layers!;
    return { d, mode, ...gen(rng, d) };
  },
  solve(p) {
    return Object.fromEntries(p.items.map((it) => [it.id, it.bucket]));
  },
  view(p) {
    return { prompt: p.prompt, buckets: p.buckets, items: p.items.map(({ bucket: _b, ...it }) => it) };
  },
  checkpoints() {
    return [{ id: "sort", title: "Placements", weight: 1 }];
  },
  grade(p, s, _cp, r) {
    const fields: Record<string, boolean> = {};
    let hits = 0;
    for (const it of p.items) {
      const ok = Number(r?.place?.[it.id]) === s[it.id];
      fields[it.id] = ok;
      if (ok) hits++;
    }
    return { score: fraction(hits, p.items.length), misconceptions: hits < p.items.length ? [`sort.${p.mode}`] : [], fields };
  },
  optimalMoves(p) {
    return p.items.length;
  },
  key(p) {
    return p.items.map((x) => x.text).join("|");
  },
};

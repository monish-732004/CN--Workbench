import type { Rng } from "../rng";
import { compressV6, eui64, expandV6, fullV6, v6Type } from "../ipv6";
import { blockSize, intToIp, ipToInt, maskInt } from "../net";
import { fraction, type Difficulty, type Template } from "../types";

/**
 * Calculation workbench: a short scenario with per-student values and fields to fill.
 * Covers the numeric parts of the syllabus (topology counts, FLSM, supernetting, domains,
 * IPv6, multicast mapping, ALOHA, CSMA/CD, parity/checksum, HTTP/FTP, ARQ window sizes).
 */
export type Norm = "ip" | "ipv6min" | "ipv6" | "iid" | "mac" | "plain";

export interface FormField {
  id: string;
  label: string;
  kind: "number" | "text" | "select";
  unit?: string;
  options?: string[];
  placeholder?: string;
  norm?: Norm;
  tol?: number;
}

export interface FormParams {
  d: Difficulty;
  mode: string;
  prompt: string;
  given: { k: string; v: string }[];
  groups: { id: string; title: string; fields: FormField[] }[];
  answers: Record<string, string | number>;
}

type Gen = (rng: Rng, d: Difficulty) => Omit<FormParams, "d" | "mode">;

const num = (id: string, label: string, unit?: string, tol?: number): FormField => ({ id, label, kind: "number", unit, tol });
const txt = (id: string, label: string, norm: Norm, placeholder?: string): FormField => ({ id, label, kind: "text", norm, placeholder });
const sel = (id: string, label: string, options: string[]): FormField => ({ id, label, kind: "select", options });

const MODES: Record<string, Gen> = {
  topology(rng, d) {
    const [lo, hi] = d === "easy" ? [4, 12] : d === "medium" ? [6, 20] : [10, 40];
    const nm = rng.int(lo, hi); // mesh
    const ns = rng.int(lo, hi + 10); // star
    const nr = rng.int(lo, hi + 10); // ring
    const fields = [num("mesh", `Links in a full mesh of ${nm} devices`), num("ports", `I/O ports per device in that mesh`), num("star", `Cables in a star of ${ns} devices (to the hub)`)];
    const answers: Record<string, number> = { mesh: (nm * (nm - 1)) / 2, ports: nm - 1, star: ns };
    const given = [
      { k: "Mesh", v: `${nm} devices` },
      { k: "Star", v: `${ns} devices + 1 hub` },
    ];
    if (d !== "easy") {
      fields.push(num("ring", `Links in a ring of ${nr} devices`));
      answers.ring = nr;
      given.push({ k: "Ring", v: `${nr} devices` });
    }
    if (d === "hard") {
      const add = rng.int(1, 5);
      fields.push(num("allports", "Total I/O ports in the full mesh"), num("extra", `Extra links if ${add} more device${add > 1 ? "s join" : " joins"} the mesh`));
      answers.allports = nm * (nm - 1);
      answers.extra = ((nm + add) * (nm + add - 1)) / 2 - (nm * (nm - 1)) / 2;
    }
    return { prompt: "Work out the cabling each topology needs.", given, groups: [{ id: "counts", title: "Topology counts", fields }], answers };
  },

  flsm(rng, d) {
    let base: number;
    let def: number;
    if (d === "easy") {
      base = ipToInt(`${rng.int(192, 223)}.${rng.int(0, 255)}.${rng.int(0, 255)}.0`);
      def = 24;
    } else if (d === "medium" || rng.bool()) {
      base = ipToInt(`${rng.int(128, 191)}.${rng.int(0, 255)}.0.0`);
      def = 16;
    } else {
      base = ipToInt(`${rng.int(1, 126)}.0.0.0`);
      def = 8;
    }
    const n = d === "easy" ? rng.int(3, 8) : d === "medium" ? rng.int(5, 30) : rng.int(9, 120);
    const s = Math.ceil(Math.log2(n));
    const prefix = def + s;
    const size = blockSize(prefix);
    const k = rng.int(2, n);
    const net = (base + (k - 1) * size) >>> 0;
    return {
      prompt: `The classful network ${intToIp(base)}/${def} must be split into ${n} equal subnets (FLSM). Find the mask and the range of subnet ${k}.`,
      given: [
        { k: "Network", v: `${intToIp(base)}/${def}` },
        { k: "Subnets needed", v: String(n) },
        { k: "Subnet to describe", v: `subnet ${k} (subnet 1 starts at the network address)` },
      ],
      groups: [
        { id: "mask", title: "Subnet mask", fields: [num("bits", "Bits borrowed"), txt("mask", "New subnet mask (dotted decimal)", "ip", "255.255.0.0"), num("hosts", "Usable hosts per subnet")] },
        { id: "range", title: `Subnet ${k}`, fields: [txt("net", "Network address", "ip", "a.b.c.d"), txt("bc", "Broadcast address", "ip", "a.b.c.d")] },
      ],
      answers: { bits: s, mask: intToIp(maskInt(prefix)), hosts: size - 2, net: intToIp(net), bc: intToIp(net + size - 1) },
    };
  },

  supernet(rng, d) {
    const k = d === "hard" ? 8 : d === "medium" ? 4 : rng.pick([2, 4]);
    const third = rng.int(0, Math.floor(256 / k) - 1) * k;
    const first = rng.pick([192, 198, 200, 203, 210, 220]);
    const second = rng.int(0, 255);
    const blocks = Array.from({ length: k }, (_, i) => `${first}.${second}.${third + i}.0/24`);
    const prefix = 24 - Math.log2(k);
    return {
      prompt: `An ISP wants a single routing entry for these ${k} contiguous /24 blocks. Find the supernet.`,
      given: blocks.map((b, i) => ({ k: `Block ${i + 1}`, v: b })),
      groups: [{ id: "summary", title: "Supernet", fields: [txt("net", "Supernet address", "ip", "a.b.c.d"), num("prefix", "Prefix length", "bits"), txt("mask", "Supernet mask", "ip", "255.255.0.0")] }],
      answers: { net: `${first}.${second}.${third}.0`, prefix, mask: intToIp(maskInt(prefix)) },
    };
  },

  domains(rng, d) {
    const lines: string[] = [];
    let collision = 0;
    let broadcast = 0;
    let gi = 0;
    const sw = d === "easy" ? rng.int(1, 2) : rng.int(2, 3);
    for (let i = 0; i < sw; i++) {
      const p = rng.int(2, 6);
      lines.push(`Switch S${i + 1} with ${p} PCs, uplinked to R1 Gi0/${gi++}`);
      collision += p + 1;
      broadcast += 1;
    }
    const hubs = d === "easy" ? rng.int(0, 1) : rng.int(1, 2);
    for (let i = 0; i < hubs; i++) {
      const q = rng.int(2, 5);
      lines.push(`Hub H${i + 1} with ${q} PCs, connected to R1 Gi0/${gi++}`);
      collision += 1;
      broadcast += 1;
    }
    if (d === "hard") {
      const a = rng.int(2, 4);
      const b = rng.int(2, 4);
      lines.push(`Hub H${hubs + 1} (${a} PCs) on R1 Gi0/${gi++}, joined through a bridge to hub H${hubs + 2} (${b} PCs)`);
      collision += 2;
      broadcast += 1;
    }
    return {
      prompt: "Router R1 connects the segments below. Count the collision domains and the broadcast domains.",
      given: lines.map((l, i) => ({ k: `Segment ${i + 1}`, v: l })),
      groups: [{ id: "domains", title: "Domains", fields: [num("collision", "Collision domains"), num("broadcast", "Broadcast domains")] }],
      answers: { collision, broadcast },
    };
  },

  ipv6(rng, d) {
    const kind = rng.int(0, 3);
    const h: number[] = new Array(8).fill(0);
    if (kind === 0) {
      h[0] = rng.pick([0x2001, 0x2400, 0x2404, 0x2600, 0x3ffe]);
      h[1] = rng.pick([0x0db8, 0x0470, 0x00a1, 0x0f00]);
    } else if (kind === 1) h[0] = 0xfe80;
    else if (kind === 2) {
      h[0] = 0xfd00 | rng.int(0, 255);
      h[1] = rng.int(0, 0xffff);
    } else h[0] = rng.pick([0xff02, 0xff05, 0xff0e]);
    // two zero runs of different or equal length, sprinkled non-zero hextets with leading zeros
    const slots = [2, 3, 4, 5, 6, 7];
    for (const i of rng.sample(slots, rng.int(2, 3))) h[i] = rng.pick([rng.int(1, 0xff), rng.int(0x100, 0xfff), rng.int(0x1000, 0xffff)]);
    const answers: Record<string, string> = { comp: compressV6(h), type: v6Type(h) };
    const fields1: FormField[] = [txt("comp", "Shortest form", "ipv6min", "2001:db8::1"), sel("type", "Address type", ["Global unicast", "Link local", "Unique local", "Multicast"])];
    const groups: FormParams["groups"] = [{ id: "compress", title: "Compress", fields: fields1 }];
    const given = [{ k: "Address", v: fullV6(h) }];
    if (d !== "easy") {
      const h2 = h.slice().reverse().map((x, i) => (i % 3 === 0 ? 0 : x));
      h2[0] = 0x2001;
      given.push({ k: "Compressed address", v: compressV6(h2) });
      groups.push({ id: "expand", title: "Expand", fields: [txt("full", "Full form (8 groups of 4 hex digits)", "ipv6", "2001:0db8:0000:…")] });
      answers.full = fullV6(h2);
    }
    if (d === "hard") {
      const mac = Array.from({ length: 6 }, (_, i) => (i === 0 ? rng.int(0, 255) & 0xfc : rng.int(0, 255)).toString(16).toUpperCase().padStart(2, "0")).join(":");
      given.push({ k: "Interface MAC", v: mac });
      groups.push({ id: "eui", title: "EUI-64", fields: [txt("iid", "64-bit interface ID", "iid", "xxxx:xxff:fexx:xxxx")] });
      answers.iid = eui64(mac);
    }
    return { prompt: "Work with the IPv6 addresses below using zero compression and the address-block table.", given, groups, answers };
  },

  mcast(rng, d) {
    const blocks: [string, () => string][] = [
      ["Local network control", () => `224.0.0.${rng.int(1, 254)}`],
      ["Internetwork control", () => `224.0.1.${rng.int(1, 254)}`],
      ["Source-specific (SSM)", () => `232.${rng.int(0, 255)}.${rng.int(0, 255)}.${rng.int(1, 254)}`],
      ["GLOP", () => `233.${rng.int(0, 255)}.${rng.int(0, 255)}.${rng.int(1, 254)}`],
      ["Administratively scoped", () => `239.${rng.int(0, 255)}.${rng.int(0, 255)}.${rng.int(1, 254)}`],
    ];
    const [bname, gen] = rng.pick(blocks);
    const addr = gen();
    const n = ipToInt(addr);
    const low = n & 0x7fffff;
    const mac = ["01", "00", "5E", ((low >> 16) & 0x7f).toString(16), ((low >> 8) & 255).toString(16), (low & 255).toString(16)].map((x) => x.toUpperCase().padStart(2, "0")).join(":");
    const fields: FormField[] = [sel("block", "Multicast block", blocks.map((b) => b[0])), txt("mac", "Ethernet multicast MAC address", "mac", "01:00:5E:xx:xx:xx")];
    const answers: Record<string, string | number> = { block: bname, mac };
    if (d === "hard") {
      fields.push(num("bits", "Bits of the IP address copied into the MAC"), num("share", "IP multicast groups that map to this same MAC"));
      answers.bits = 23;
      answers.share = 32;
    }
    return { prompt: `A host joins the IPv4 multicast group ${addr}.`, given: [{ k: "Group address", v: addr }], groups: [{ id: "map", title: "Mapping", fields: d === "easy" ? fields.slice(0, 2) : fields }], answers };
  },

  aloha(rng, d) {
    const B = rng.pick([50, 100, 200, 250, 400, 500, 1000]);
    // frame sizes that give a transmission time with at most 3 decimals in ms
    let L = rng.int(1, 30) * 100;
    while (((L * 1000) / B) % 1 !== 0) L += 100;
    const tfr = L / B; // ms
    const slotted = rng.bool();
    const fps = Math.round((rng.pick([0.25, 0.5, 1, 2]) * 1000) / tfr);
    const G = (fps * tfr) / 1000; // what the student derives from the given rate
    const S = slotted ? G * Math.exp(-G) : G * Math.exp(-2 * G);
    const fields: FormField[] = [num("tfr", "Frame transmission time", "ms", 0.0005), num("vuln", "Vulnerable time", "ms", 0.0005)];
    const answers: Record<string, number> = { tfr, vuln: slotted ? tfr : 2 * tfr };
    if (d !== "easy") {
      fields.push(num("S", "Throughput S (fraction)", undefined, 0.002));
      answers.S = Math.round(S * 1000) / 1000;
    }
    if (d === "hard") {
      fields.push(num("ok", "Frames that survive per second", "frames", 1));
      answers.ok = Math.round(S * fps);
    }
    return {
      prompt: `A ${slotted ? "slotted" : "pure"} ALOHA network sends ${L}-bit frames on a ${B} kbps shared channel. All stations together produce ${fps} frames per second.`,
      given: [
        { k: "Protocol", v: slotted ? "Slotted ALOHA" : "Pure ALOHA" },
        { k: "Frame size", v: `${L} bits` },
        { k: "Bandwidth", v: `${B} kbps` },
        { k: "Offered load", v: `${fps} frames/s` },
      ],
      groups: [{ id: "aloha", title: "ALOHA", fields }],
      answers,
    };
  },

  csma(rng, d) {
    const B = rng.pick([10, 100]);
    const tp = Math.round(rng.int(5, 125) * 0.4 * 10) / 10; // µs, multiple of 0.4 → bits divisible by 8
    const bits = Math.round(2 * tp * B);
    const fields: FormField[] = [num("tfr", "Minimum frame transmission time", "µs", 0.01), num("bits", "Minimum frame size", "bits"), num("bytes", "Minimum frame size", "bytes")];
    const answers: Record<string, number> = { tfr: Math.round(2 * tp * 100) / 100, bits, bytes: bits / 8 };
    const given = [
      { k: "Bandwidth", v: `${B} Mbps` },
      { k: "Maximum propagation time", v: `${tp} µs` },
    ];
    const groups: FormParams["groups"] = [{ id: "minframe", title: "Minimum frame (CSMA/CD)", fields }];
    if (d !== "easy") {
      const K = rng.int(2, 7);
      given.push({ k: "Collisions so far (K)", v: String(K) });
      groups.push({ id: "beb", title: "Binary exponential backoff", fields: [num("rmax", "Largest random number R"), num("rcount", "Number of choices for R")] });
      answers.rmax = 2 ** K - 1;
      answers.rcount = 2 ** K;
    }
    if (d === "hard") {
      const len = rng.int(5, 25) * 100; // metres
      const frame = rng.pick([512, 1024, 12144]);
      const prop = len / 2e8; // s
      const tx = frame / (B * 1e6);
      const a = prop / tx;
      given.push({ k: "Cable length / frame", v: `${len} m at 2×10⁸ m/s, ${frame}-bit frames` });
      groups.push({ id: "eff", title: "Ethernet efficiency", fields: [num("a", "a = propagation / transmission", undefined, 0.002), num("eff", "Efficiency 1/(1+6.4a)", "%", 0.3)] });
      answers.a = Math.round(a * 1000) / 1000;
      answers.eff = Math.round((100 / (1 + 6.4 * a)) * 10) / 10;
    }
    return { prompt: "A CSMA/CD network must detect every collision while it is still transmitting.", given, groups, answers };
  },

  parity(rng, d) {
    if (d === "easy") {
      let data = "";
      for (let i = 0; i < 7; i++) data += rng.bool() ? "1" : "0";
      const ones = data.split("").filter((b) => b === "1").length;
      let recv = data + String(ones % 2);
      const corrupt = rng.bool();
      if (corrupt) {
        const i = rng.int(0, 7);
        recv = recv.slice(0, i) + (recv[i] === "1" ? "0" : "1") + recv.slice(i + 1);
      }
      return {
        prompt: `Simple parity check on the dataword ${data}.`,
        given: [
          { k: "Dataword", v: data },
          { k: "Received (even parity)", v: recv },
        ],
        groups: [
          { id: "par", title: "Parity bits", fields: [num("even", "Even-parity bit"), num("odd", "Odd-parity bit")] },
          { id: "rx", title: "Receiver", fields: [sel("dec", "The receiver should", ["Accept the dataword", "Discard: error detected"])] },
        ],
        answers: { even: ones % 2, odd: 1 - (ones % 2), dec: corrupt ? "Discard: error detected" : "Accept the dataword" },
      };
    }
    const nums = Array.from({ length: 5 }, () => rng.int(0, 15));
    const fold = (v: number) => {
      while (v > 15) v = (v & 15) + (v >> 4);
      return v;
    };
    const sum = nums.reduce((a, b) => a + b, 0);
    const folded = fold(sum);
    const cs = 15 - folded;
    const groups: FormParams["groups"] = [{ id: "tx", title: "Sender", fields: [num("sum", "Sum of the five numbers"), num("folded", "Sum after wrapping carries (4 bits)"), num("cs", "Checksum (one's complement)")] }];
    const answers: Record<string, string | number> = { sum, folded, cs };
    const given = [{ k: "Data (4-bit numbers)", v: nums.join(", ") }];
    if (d === "hard") {
      const rx = nums.slice();
      const bad = rng.bool();
      if (bad) {
        for (let t = 0; t < 20; t++) {
          const i = rng.int(0, 4);
          const v = rng.int(0, 15);
          if (v === rx[i]) continue;
          const trial = rx.slice();
          trial[i] = v;
          if (15 - fold(trial.reduce((a, b) => a + b, 0) + cs) !== 0) {
            rx.splice(0, 5, ...trial);
            break;
          }
        }
      }
      const rcheck = 15 - fold(rx.reduce((a, b) => a + b, 0) + cs);
      given.push({ k: "Receiver gets", v: `${rx.join(", ")} and checksum ${cs}` });
      groups.push({ id: "rx", title: "Receiver", fields: [num("rcheck", "Receiver's checksum result"), sel("dec", "The receiver should", ["Accept", "Discard"])] });
      answers.rcheck = rcheck;
      answers.dec = rcheck === 0 ? "Accept" : "Discard";
    }
    return { prompt: "Use the checksum method from the slides: add, wrap the carries back into 4 bits, then take the one's complement.", given, groups, answers };
  },

  httpftp(rng, d) {
    const k = rng.int(1, 7);
    const rtt = rng.int(4, 24) * 5;
    const objects = k + 1;
    const groups: FormParams["groups"] = [{ id: "conn", title: "TCP connections", fields: [num("np", "Connections, non-persistent HTTP"), num("p", "Connections, persistent HTTP")] }];
    const answers: Record<string, string | number> = { np: objects, p: 1 };
    if (d !== "easy") {
      groups.push({ id: "time", title: "Response time (ignore transmission time)", fields: [num("tnp", "Non-persistent: 2 RTT per object", "ms"), num("tp", "Persistent: 1 RTT setup + 1 RTT per object", "ms")] });
      answers.tnp = 2 * rtt * objects;
      answers.tp = rtt + rtt * objects;
    }
    if (d === "hard") {
      groups.push({
        id: "ftp",
        title: "FTP and HTTP details",
        fields: [num("ctrl", "FTP control connection port"), num("data", "FTP data port at the server"), sel("which", "Opened and closed for every file", ["Control connection", "Data connection"]), num("notmod", "HTTP status for If-Modified-Since when unchanged")],
      });
      Object.assign(answers, { ctrl: 21, data: 20, which: "Data connection", notmod: 304 });
    }
    return {
      prompt: `A web page has ${k} embedded image${k > 1 ? "s" : ""} on the same server. The round-trip time is ${rtt} ms.`,
      given: [
        { k: "Objects", v: `1 base page + ${k} image${k > 1 ? "s" : ""}` },
        { k: "RTT", v: `${rtt} ms` },
      ],
      groups,
      answers,
    };
  },

  windows(rng, d) {
    const m = d === "hard" ? rng.int(3, 7) : rng.int(2, 6);
    const mod = 2 ** m;
    const sf = rng.int(0, mod - 1);
    const fields: FormField[] = [
      num("maxseq", "Largest sequence number"),
      num("sw", "Sequence numbers needed by Stop-and-Wait"),
      num("gbn", "Go-Back-N maximum send window"),
      num("last", `With a full Go-Back-N window starting at Sf = ${sf}, the last frame it may send`),
    ];
    const answers: Record<string, number> = { maxseq: mod - 1, sw: 2, gbn: mod - 1, last: (sf + mod - 2) % mod };
    const groups: FormParams["groups"] = [{ id: "win", title: "Window sizes", fields }];
    if (d !== "easy") {
      fields.push(num("gbnr", "Go-Back-N receive window"), num("sr", "Selective Repeat maximum send window"), num("srr", "Selective Repeat receive window"));
      Object.assign(answers, { gbnr: 1, sr: 2 ** (m - 1), srr: 2 ** (m - 1) });
    }
    const given = [{ k: "Sequence number field", v: `${m} bits` }];
    if (d === "hard") {
      const mod = 2 ** m;
      const sf = rng.int(0, mod - 1);
      const outstanding = rng.int(2, mod - 2);
      const a = (sf + rng.int(1, outstanding)) % mod;
      given.push({ k: "Go-Back-N sender", v: `Sf = ${sf}, ${outstanding} frames outstanding; ACK with ackNo = ${a} arrives` });
      groups.push({ id: "slide", title: "Sliding", fields: [num("slid", "Frames acknowledged by this ACK"), num("newsf", "New value of Sf")] });
      answers.slid = (a - sf + mod) % mod;
      answers.newsf = a;
    }
    return { prompt: "Sequence numbers are counted modulo 2^m. Work out the windows each ARQ protocol can use.", given, groups, answers };
  },
};

export const FORM_MODES = Object.keys(MODES);

function norm(f: FormField, v: unknown): string | number | null {
  const s = String(v ?? "").trim();
  if (f.kind === "number") {
    const x = Number(s.replace(/,/g, ""));
    return s === "" || !Number.isFinite(x) ? null : x;
  }
  if (f.kind === "select") return s;
  switch (f.norm) {
    case "ip": {
      const n = ipToInt(s);
      return Number.isFinite(n) ? intToIp(n) : null;
    }
    case "ipv6":
    case "ipv6min": {
      const h = expandV6(s);
      return h ? fullV6(h) : null;
    }
    case "iid":
      return s
        .toLowerCase()
        .split(":")
        .map((g) => g.replace(/^0+(?=.)/, ""))
        .join(":");
    case "mac":
      return s.toUpperCase().replace(/[-.\s]/g, ":");
    default:
      return s.toLowerCase().replace(/\s+/g, " ");
  }
}

export function checkField(f: FormField, got: unknown, want: string | number): boolean {
  const g = norm(f, got);
  if (g === null) return false;
  if (f.kind === "number") return Math.abs((g as number) - Number(want)) <= (f.tol ?? 0) + 1e-9;
  if (f.norm === "ipv6min") {
    const w = norm(f, want);
    return g === w && String(got).trim().length <= String(want).length;
  }
  return g === norm(f, want);
}

export const form: Template<FormParams, Record<string, string | number>> = {
  id: "form",
  generate(rng, d, mode = "topology") {
    const gen = MODES[mode] ?? MODES.topology!;
    return { d, mode, ...gen(rng, d) };
  },
  solve(p) {
    return p.answers;
  },
  view(p) {
    return { prompt: p.prompt, given: p.given, groups: p.groups };
  },
  checkpoints(p) {
    const total = p.groups.reduce((s, g) => s + g.fields.length, 0);
    return p.groups.map((g) => ({ id: g.id, title: g.title, weight: g.fields.length / total }));
  },
  grade(p, s, cp, r) {
    const g = p.groups.find((x) => x.id === cp);
    if (!g) return { score: 0, misconceptions: [] };
    const fields: Record<string, boolean> = {};
    let hits = 0;
    for (const f of g.fields) {
      const ok = checkField(f, r?.values?.[f.id], s[f.id]!);
      fields[f.id] = ok;
      if (ok) hits++;
    }
    const mis: string[] = [];
    if (p.mode === "flsm" && !fields.hosts && Number(r?.values?.hosts) === Number(s.hosts) + 2) mis.push("subnet.usable-off-by-two");
    if (p.mode === "aloha" && !fields.vuln && Number(r?.values?.vuln) === (p.given[0]!.v.startsWith("Slotted") ? 2 : 0.5) * Number(s.vuln)) mis.push("aloha.vulnerable-time");
    if (p.mode === "csma" && !fields.bits && Number(r?.values?.bits) === Number(s.bits) / 2) mis.push("csmacd.one-way-delay");
    if (hits < g.fields.length && !mis.length) mis.push(`form.${p.mode}`);
    return { score: fraction(hits, g.fields.length), misconceptions: hits < g.fields.length ? mis : [], fields };
  },
  optimalMoves(p) {
    return p.groups.reduce((s, g) => s + g.fields.length, 0);
  },
  key(p) {
    return JSON.stringify([p.given, p.groups.map((g) => g.fields.map((f) => f.label))]);
  },
};

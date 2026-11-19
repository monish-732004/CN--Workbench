import type { Rng } from "../rng";
import { fraction, type Difficulty, type Template } from "../types";

export const UDP_SERVICES: Record<number, string> = { 7: "Echo", 13: "Daytime", 53: "DNS", 67: "DHCP", 69: "TFTP", 123: "NTP", 161: "SNMP", 520: "RIP" };
export const TCP_SERVICES: Record<number, string> = { 20: "FTP (data)", 21: "FTP (control)", 23: "TELNET", 25: "SMTP", 80: "HTTP", 110: "POP3", 143: "IMAP", 179: "BGP", 443: "HTTPS" };
export const SERVICE_NAMES = [...new Set([...Object.values(UDP_SERVICES), ...Object.values(TCP_SERVICES)])].sort();

export const FLAG_NAMES = ["URG", "ACK", "PSH", "RST", "SYN", "FIN"] as const;
type FlagName = (typeof FLAG_NAMES)[number];

interface FieldDef {
  id: string;
  label: string;
  start: number;
  end: number;
}

const UDP_FIELDS: FieldDef[] = [
  { id: "src", label: "Source port", start: 0, end: 2 },
  { id: "dst", label: "Destination port", start: 2, end: 4 },
  { id: "len", label: "Total length", start: 4, end: 6 },
  { id: "csum", label: "Checksum", start: 6, end: 8 },
];
const TCP_FIELDS: FieldDef[] = [
  { id: "src", label: "Source port", start: 0, end: 2 },
  { id: "dst", label: "Destination port", start: 2, end: 4 },
  { id: "seq", label: "Sequence number", start: 4, end: 8 },
  { id: "ack", label: "Acknowledgment number", start: 8, end: 12 },
  { id: "hlen", label: "HLEN + flags", start: 12, end: 14 },
  { id: "win", label: "Window size", start: 14, end: 16 },
  { id: "csum", label: "Checksum", start: 16, end: 18 },
  { id: "urg", label: "Urgent pointer", start: 18, end: 20 },
];

const SCENARIOS: { flags: FlagName[]; phase: string }[] = [
  { flags: ["SYN"], phase: "Connection request (1st handshake segment)" },
  { flags: ["SYN", "ACK"], phase: "Connection reply (2nd handshake segment)" },
  { flags: ["ACK", "PSH"], phase: "Data transfer" },
  { flags: ["FIN", "ACK"], phase: "Connection termination" },
];
export const PHASES = SCENARIOS.map((s) => s.phase);

export interface HexParams {
  d: Difficulty;
  proto: "udp" | "tcp";
  src: number;
  dst: number;
  len: number; // UDP total length
  csum: number;
  seq: number;
  ack: number;
  flags: FlagName[];
  win: number;
  payload: number; // hard TCP: payload bytes carried
  phase: string;
}

export interface HexSolution {
  fields: Record<string, [number, number]>;
  values: Record<string, number>;
  flags: FlagName[];
  hlenBytes: number;
  service: string;
  direction: "client→server" | "server→client";
  dataLength?: number;
  nextSeq?: number;
  phase?: string;
}

function bytesOf(p: HexParams): number[] {
  const out: number[] = [];
  const u16 = (v: number) => out.push((v >>> 8) & 255, v & 255);
  const u32 = (v: number) => out.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
  u16(p.src);
  u16(p.dst);
  if (p.proto === "udp") {
    u16(p.len);
    u16(p.csum);
    return out;
  }
  u32(p.seq);
  u32(p.ack);
  let fl = 0;
  FLAG_NAMES.forEach((f, i) => {
    if (p.flags.includes(f)) fl |= 1 << (5 - i);
  });
  u16((5 << 12) | fl);
  u16(p.win);
  u16(p.csum);
  u16(0);
  return out;
}

export const hexdump: Template<HexParams, HexSolution> = {
  id: "hexdump",
  generate(rng: Rng, d) {
    const proto = d === "easy" ? "udp" : "tcp";
    const table = proto === "udp" ? UDP_SERVICES : TCP_SERVICES;
    const wk = Number(rng.pick(Object.keys(table)));
    const eph = rng.int(49152, 65535);
    const sc = rng.pick(SCENARIOS);
    const isSyn = proto === "tcp" && sc.flags.includes("SYN");
    const c2s = isSyn ? !sc.flags.includes("ACK") : rng.int(0, 2) > 0;
    const flags = proto === "udp" ? [] : sc.flags;
    const ack = flags.includes("ACK") ? rng.int(1_000_000, 4_000_000_000) : 0;
    return {
      d,
      proto,
      src: c2s ? eph : wk,
      dst: c2s ? wk : eph,
      len: 8 + rng.int(4, 1400),
      csum: rng.int(0x1000, 0xfffe),
      seq: rng.int(1_000_000, 4_000_000_000),
      ack,
      flags,
      win: rng.int(1024, 65535),
      payload: sc.flags.includes("PSH") ? rng.pick([100, 256, 512, 536, 1000, 1460]) : 0,
      phase: proto === "udp" ? "" : sc.phase,
    };
  },
  solve(p) {
    const defs = p.proto === "udp" ? UDP_FIELDS : TCP_FIELDS;
    const fields = Object.fromEntries(defs.map((f) => [f.id, [f.start, f.end] as [number, number]]));
    const table = p.proto === "udp" ? UDP_SERVICES : TCP_SERVICES;
    const wk = p.src < 1024 ? p.src : p.dst;
    const values: Record<string, number> =
      p.proto === "udp" ? { src: p.src, dst: p.dst, len: p.len, csum: p.csum } : { src: p.src, dst: p.dst, seq: p.seq, ack: p.ack, win: p.win };
    const consumes = (p.flags.includes("SYN") ? 1 : 0) + (p.flags.includes("FIN") ? 1 : 0);
    return {
      fields,
      values,
      flags: p.flags,
      hlenBytes: 20,
      service: table[wk]!,
      direction: p.dst < 1024 ? "client→server" : "server→client",
      dataLength: p.proto === "udp" ? p.len - 8 : undefined,
      nextSeq: p.proto === "tcp" ? (p.seq + p.payload + consumes) % 2 ** 32 : undefined,
      phase: p.proto === "tcp" ? p.phase : undefined,
    };
  },
  view(p) {
    const defs = p.proto === "udp" ? UDP_FIELDS : TCP_FIELDS;
    return {
      proto: p.proto,
      bytes: bytesOf(p),
      fieldPalette: defs.map((f) => ({ id: f.id, label: f.label })),
      valueFields: p.proto === "udp" ? ["src", "dst", "len", "csum"] : ["src", "dst", "seq", "ack", "win"],
      services: SERVICE_NAMES,
      phases: PHASES,
      askNextSeq: p.d === "hard",
      payload: p.payload,
    };
  },
  checkpoints(p) {
    return [
      { id: "fields", title: "Field boundaries", weight: 0.3 },
      { id: "values", title: "Decoded values", weight: 0.4 },
      { id: "meaning", title: p.proto === "udp" ? "Service, payload, direction" : "Service, direction, phase", weight: 0.3 },
    ];
  },
  grade(p, s, cp, r) {
    if (cp === "fields") {
      const fields: Record<string, boolean> = {};
      let hits = 0;
      for (const [id, [a, b]] of Object.entries(s.fields)) {
        const got = r?.map?.[id];
        const ok = Array.isArray(got) && got[0] === a && got[1] === b;
        fields[id] = ok;
        if (ok) hits++;
      }
      return { score: fraction(hits, Object.keys(s.fields).length), misconceptions: [], fields };
    }
    if (cp === "values") {
      const fields: Record<string, boolean> = {};
      const mis = new Set<string>();
      let hits = 0;
      let total = 0;
      for (const [id, v] of Object.entries(s.values)) {
        total++;
        const got = Number(String(r?.values?.[id] ?? "").replace(/[, ]/g, ""));
        const ok = got === v;
        fields[id] = ok;
        if (ok) hits++;
        else if (Number.isFinite(got)) {
          const swapped = v < 65536 ? ((v & 255) << 8) | (v >>> 8) : -1;
          if (got === swapped) mis.add("hex.byte-order");
        }
      }
      if (p.proto === "tcp") {
        total += 2;
        const okH = Number(r?.hlenBytes) === s.hlenBytes;
        fields.hlenBytes = okH;
        if (okH) hits++;
        else if (Number(r?.hlenBytes) === 5) mis.add("tcp.hlen-not-x4");
        const got = new Set<string>(Array.isArray(r?.flags) ? r.flags : []);
        const okF = got.size === s.flags.length && s.flags.every((f) => got.has(f));
        fields.flags = okF;
        if (okF) hits++;
        else mis.add("tcp.flags-bit-order");
      }
      return { score: fraction(hits, total), misconceptions: [...mis], fields };
    }
    if (cp === "meaning") {
      const fields: Record<string, boolean> = {};
      const mis: string[] = [];
      fields.service = r?.service === s.service;
      fields.direction = r?.direction === s.direction;
      if (!fields.direction) mis.push("ports.client-server-reversed");
      if (p.proto === "udp") {
        const dl = Number(r?.dataLength);
        fields.dataLength = dl === s.dataLength;
        if (!fields.dataLength && dl === p.len) mis.push("udp.length-includes-header");
      } else {
        fields.phase = r?.phase === s.phase;
        if (p.d === "hard") {
          const ns = Number(String(r?.nextSeq ?? "").replace(/[, ]/g, ""));
          fields.nextSeq = ns === s.nextSeq;
          if (!fields.nextSeq && (p.flags.includes("SYN") || p.flags.includes("FIN")) && ns === p.seq + p.payload) mis.push("tcp.syn-fin-consume-one");
        }
      }
      if (!fields.service) mis.push("ports.wrong-service");
      const vals = Object.values(fields);
      return { score: fraction(vals.filter(Boolean).length, vals.length), misconceptions: mis, fields };
    }
    return { score: 0, misconceptions: [] };
  },
  optimalMoves(p) {
    const f = p.proto === "udp" ? 4 : 8;
    const v = p.proto === "udp" ? 4 : 7;
    const m = p.proto === "udp" ? 3 : p.d === "hard" ? 4 : 3;
    return f + v + m;
  },
  key(p) {
    return bytesOf(p).join(",");
  },
};

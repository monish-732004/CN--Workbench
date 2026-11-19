import type { Rng } from "../rng";
import { fraction, type Difficulty, type Template } from "../types";

/** TCP connection ladder, Forouzan conventions: SYN and FIN consume one sequence number; 3-way close. */
export type SegType = "SYN" | "SYN+ACK" | "ACK" | "DATA" | "FIN" | "FIN+ACK";
export type Dir = "C2S" | "S2C";
export const SEG_TYPES: SegType[] = ["SYN", "SYN+ACK", "ACK", "DATA", "FIN", "FIN+ACK"];

export interface LadderParams {
  d: Difficulty;
  isnC: number;
  isnS: number;
  segs: number[];
}

export interface LadderMsg {
  type: SegType;
  dir: Dir;
  seq: number;
  ack: number | null;
  bytes?: number;
}

export interface LadderSolution {
  msgs: LadderMsg[];
}

function solve(p: LadderParams): LadderSolution {
  const c = p.isnC;
  const s = p.isnS;
  const msgs: LadderMsg[] = [
    { type: "SYN", dir: "C2S", seq: c, ack: null },
    { type: "SYN+ACK", dir: "S2C", seq: s, ack: c + 1 },
    { type: "ACK", dir: "C2S", seq: c + 1, ack: s + 1 },
  ];
  if (p.segs.length === 0) return { msgs };
  let next = c + 1;
  for (const b of p.segs) {
    msgs.push({ type: "DATA", dir: "C2S", seq: next, ack: s + 1, bytes: b });
    next += b;
  }
  msgs.push({ type: "ACK", dir: "S2C", seq: s + 1, ack: next });
  msgs.push({ type: "FIN", dir: "C2S", seq: next, ack: s + 1 });
  msgs.push({ type: "FIN+ACK", dir: "S2C", seq: s + 1, ack: next + 1 });
  msgs.push({ type: "ACK", dir: "C2S", seq: next + 1, ack: s + 2 });
  return { msgs };
}

const num = (x: unknown) => {
  const s = String(x ?? "").replace(/[, ]/g, "");
  return s === "" || s === "-" ? null : Number(s);
};

export const ladder: Template<LadderParams, LadderSolution> = {
  id: "ladder",
  generate(rng: Rng, d) {
    const isnC = rng.int(1000, 90000) * 10 + rng.int(0, 9);
    const isnS = rng.int(1000, 90000) * 10 + rng.int(0, 9);
    if (d === "easy") return { d, isnC, isnS, segs: [] };
    if (d === "medium") {
      const b = rng.pick([500, 800, 1000, 1200, 1460]);
      return { d, isnC, isnS, segs: [b, b] };
    }
    return { d, isnC, isnS, segs: [rng.pick([300, 500, 700]), rng.pick([1000, 1200, 1460]), rng.pick([200, 400, 600])] };
  },
  solve,
  view(p) {
    return { isnC: p.isnC, isnS: p.isnS, segs: p.segs, slots: solve(p).msgs.length, types: SEG_TYPES };
  },
  checkpoints() {
    return [
      { id: "order", title: "Segment order and direction", weight: 0.4 },
      { id: "numbers", title: "Sequence and acknowledgment numbers", weight: 0.6 },
    ];
  },
  grade(p, s, cp, r) {
    const rows: any[] = Array.isArray(r?.rows) ? r.rows : [];
    if (cp === "order") {
      const fields: Record<string, boolean> = {};
      let hits = 0;
      s.msgs.forEach((m, i) => {
        const ok = rows[i]?.type === m.type && rows[i]?.dir === m.dir;
        fields[`#${i + 1}`] = ok;
        if (ok) hits++;
      });
      const mis = hits < s.msgs.length && p.segs.length && rows.some((x) => x?.type === "FIN" && x?.dir === "S2C") ? ["tcp.close-order"] : [];
      return { score: fraction(hits, s.msgs.length), misconceptions: mis, fields };
    }
    if (cp === "numbers") {
      const fields: Record<string, boolean> = {};
      const mis = new Set<string>();
      let hits = 0;
      let total = 0;
      s.msgs.forEach((m, i) => {
        const gs = num(rows[i]?.seq);
        const ga = num(rows[i]?.ack);
        total++;
        const okS = gs === m.seq;
        fields[`#${i + 1}.seq`] = okS;
        if (okS) hits++;
        if (m.ack !== null) {
          total++;
          const okA = ga === m.ack;
          fields[`#${i + 1}.ack`] = okA;
          if (okA) hits++;
          else if (ga === m.ack - 1) mis.add("tcp.ack-not-plus-one");
        }
        if (!okS) {
          if (m.type === "ACK" && i === 2 && gs === p.isnC) mis.add("tcp.syn-no-seq");
          if (m.type === "DATA" && gs === p.isnC) mis.add("tcp.data-seq-from-isn");
          if (m.type === "ACK" && i === s.msgs.length - 1 && gs === m.seq - 1) mis.add("tcp.fin-no-seq");
        }
      });
      return { score: fraction(hits, total), misconceptions: [...mis], fields };
    }
    return { score: 0, misconceptions: [] };
  },
  optimalMoves(_p, s) {
    return s.msgs.length * 2 + s.msgs.reduce((n, m) => n + 1 + (m.ack === null ? 0 : 1), 0);
  },
  key(p) {
    return `${p.isnC}|${p.isnS}|${p.segs.join(",")}`;
  },
};

import type { Rng } from "../rng";
import type { Difficulty, Template } from "../types";

/** HDLC bit stuffing: insert a 0 after every five consecutive 1s; the receiver removes them. */
export interface StuffParams {
  d: Difficulty;
  data: string;
  recv: string | null; // a stuffed stream to unstuff (hard)
}

export interface StuffSolution {
  inserts: number[]; // insert a 0 after original index i
  stuffed: string;
  removed: number[]; // indices in recv to remove
  unstuffed: string;
}

export function stuff(data: string) {
  let out = "";
  let run = 0;
  const inserts: number[] = [];
  for (let i = 0; i < data.length; i++) {
    out += data[i];
    run = data[i] === "1" ? run + 1 : 0;
    if (run === 5) {
      out += "0";
      inserts.push(i);
      run = 0;
    }
  }
  return { stuffed: out, inserts };
}

export function unstuff(recv: string) {
  let out = "";
  let run = 0;
  const removed: number[] = [];
  for (let i = 0; i < recv.length; i++) {
    if (run === 5) {
      removed.push(i); // the stuffed 0
      run = 0;
      continue;
    }
    out += recv[i];
    run = recv[i] === "1" ? run + 1 : 0;
  }
  return { unstuffed: out, removed };
}

function build(rng: Rng, len: number, runs: number): string {
  for (let t = 0; t < 200; t++) {
    let s = "";
    while (s.length < len) {
      const r = rng.int(0, 9);
      if (r < 3) s += "1".repeat(rng.int(5, 7)) + "0";
      else s += rng.bool() ? "1" : "0";
    }
    s = s.slice(0, len);
    const n = stuff(s).inserts.length;
    if (n === runs) return s;
  }
  return "01111110111111001111".slice(0, len);
}

export const stuffing: Template<StuffParams, StuffSolution> = {
  id: "stuffing",
  generate(rng, d) {
    const data = d === "easy" ? build(rng, 16, 1) : d === "medium" ? build(rng, 22, rng.int(2, 3)) : build(rng, 20, 2);
    const recv = d === "hard" ? stuff(build(rng, 18, 2)).stuffed : null;
    return { d, data, recv };
  },
  solve(p) {
    const s = stuff(p.data);
    const u = p.recv ? unstuff(p.recv) : { unstuffed: "", removed: [] };
    return { ...s, ...u };
  },
  view(p) {
    return { data: p.data, recv: p.recv, flag: "01111110" };
  },
  checkpoints(p) {
    if (!p.recv) return [{ id: "stuff", title: "Stuffed bits", weight: 1 }];
    return [
      { id: "stuff", title: "Sender: stuffed bits", weight: 0.5 },
      { id: "unstuff", title: "Receiver: removed bits", weight: 0.5 },
    ];
  },
  grade(_p, s, cp, r) {
    const want = new Set(cp === "stuff" ? s.inserts : s.removed);
    const got = new Set<number>((Array.isArray(cp === "stuff" ? r?.inserts : r?.removed) ? (cp === "stuff" ? r.inserts : r.removed) : []).map(Number));
    const inter = [...got].filter((x) => want.has(x)).length;
    const union = new Set([...got, ...want]).size;
    const exact = inter === want.size && got.size === want.size;
    const mis: string[] = [];
    if (!exact) {
      if (cp === "stuff" && [...got].some((x) => !want.has(x) && want.has(x - 1))) mis.push("stuff.after-six-ones");
      else mis.push(cp === "stuff" ? "stuff.missed" : "stuff.unstuff");
    }
    return { score: exact ? 1 : union ? 0.9 * (inter / union) : 0, misconceptions: mis };
  },
  optimalMoves(_p, s) {
    return Math.max(1, s.inserts.length + s.removed.length);
  },
  key(p) {
    return `${p.data}|${p.recv ?? ""}`;
  },
};

import type { Rng } from "../rng";
import { fraction, type Difficulty, type Template } from "../types";

export interface CrcParams {
  d: Difficulty;
  data: string;
  gen: string;
}

export interface CrcStep {
  in: string;
  use: "g" | "z";
  out: string;
}

export interface CrcSolution {
  augmented: string;
  steps: CrcStep[];
  remainder: string;
  codeword: string;
}

export function xorBits(a: string, b: string): string {
  let s = "";
  for (let i = 0; i < a.length; i++) s += a[i] === b[i] ? "0" : "1";
  return s;
}

/** Input window for row i, given the previous row's output (student's own, for error-carried-forward). */
export function crcRowInput(augmented: string, r: number, i: number, prevOut: string | null): string {
  if (i === 0) return augmented.slice(0, r + 1);
  return (prevOut ?? "").slice(1) + augmented[r + i];
}

function solve(p: CrcParams): CrcSolution {
  const r = p.gen.length - 1;
  const augmented = p.data + "0".repeat(r);
  const zeros = "0".repeat(r + 1);
  const steps: CrcStep[] = [];
  let prev: string | null = null;
  for (let i = 0; i < p.data.length; i++) {
    const input = crcRowInput(augmented, r, i, prev);
    const use = input[0] === "1" ? "g" : "z";
    const out = xorBits(input, use === "g" ? p.gen : zeros);
    steps.push({ in: input, use, out });
    prev = out;
  }
  const remainder = prev!.slice(1);
  return { augmented, steps, remainder, codeword: p.data + remainder };
}

export const crc: Template<CrcParams, CrcSolution> = {
  id: "crc",
  generate(rng: Rng, d) {
    const k = d === "easy" ? 6 : d === "medium" ? 8 : 10;
    const gens = d === "hard" ? ["10011", "11001", "10101", "11111"] : ["1011", "1101", "1001", "1111"];
    for (let i = 0; i < 200; i++) {
      const gen = rng.pick(gens);
      let data = "1";
      for (let j = 1; j < k; j++) data += rng.bool() ? "1" : "0";
      const s = solve({ d, data, gen });
      const zeroLead = s.steps.filter((x) => x.use === "z").length;
      if (/^0+$/.test(s.remainder)) continue;
      if (zeroLead < 1 || zeroLead > Math.ceil(k / 2)) continue;
      return { d, data, gen };
    }
    return { d, data: "1101011", gen: "1011" };
  },
  solve,
  view(p) {
    const r = p.gen.length - 1;
    const degreeTerms = p.gen
      .split("")
      .map((b, i) => (b === "1" ? r - i : -1))
      .filter((e) => e >= 0)
      .map((e) => (e === 0 ? "1" : e === 1 ? "x" : `x${"⁰¹²³⁴⁵⁶⁷⁸⁹"[e]}`));
    return { data: p.data, gen: p.gen, poly: degreeTerms.join(" + "), r, augmented: p.data + "0".repeat(r), steps: p.data.length };
  },
  checkpoints() {
    return [
      { id: "rows", title: "Division steps", weight: 0.5 },
      { id: "remainder", title: "Remainder (CRC)", weight: 0.25 },
      { id: "codeword", title: "Transmitted codeword", weight: 0.25 },
    ];
  },
  grade(p, s, cp, r) {
    const R = p.gen.length - 1;
    const zeros = "0".repeat(R + 1);
    if (cp === "rows") {
      const rows: { use?: string; out?: string }[] = Array.isArray(r?.rows) ? r.rows : [];
      const fields: Record<string, boolean> = {};
      const mis = new Set<string>();
      let hits = 0;
      let prev: string | null = null;
      for (let i = 0; i < s.steps.length; i++) {
        const input = crcRowInput(s.augmented, R, i, prev);
        const use = input[0] === "1" ? "g" : "z";
        const out = xorBits(input, use === "g" ? p.gen : zeros);
        const row = rows[i] ?? {};
        const ok = row.use === use && row.out === out;
        fields[`row${i + 1}`] = ok;
        if (ok) hits++;
        else {
          if (row.use && row.use !== use) mis.add(use === "z" ? "crc.divided-on-zero-lead" : "crc.skipped-one-lead");
          else if (row.out && row.out !== out) mis.add("crc.xor-error");
        }
        prev = typeof row.out === "string" && row.out.length === R + 1 ? row.out : out;
      }
      return { score: fraction(hits, s.steps.length), misconceptions: [...mis], fields };
    }
    if (cp === "remainder") {
      const got = String(r?.remainder ?? "");
      if (got === s.remainder) return { score: 1, misconceptions: [] };
      if (typeof r?.lastOut === "string" && got === r.lastOut.slice(1)) return { score: 0.5, misconceptions: ["crc.carried-error"] };
      return { score: 0, misconceptions: got.length !== R ? ["crc.remainder-width"] : [] };
    }
    if (cp === "codeword") {
      const got = String(r?.codeword ?? "");
      if (got === s.codeword) return { score: 1, misconceptions: [] };
      if (typeof r?.remainder === "string" && got === p.data + r.remainder) return { score: 0.75, misconceptions: ["crc.carried-error"] };
      if (got === s.augmented) return { score: 0, misconceptions: ["crc.remainder-not-appended"] };
      return { score: 0, misconceptions: [] };
    }
    return { score: 0, misconceptions: [] };
  },
  optimalMoves(p, s) {
    // per row: divisor choice + one toggle per 1-bit in the result; then remainder + codeword
    return s.steps.reduce((n, st) => n + 1 + st.out.split("").filter((b) => b === "1").length, 0) + 2;
  },
  key(p) {
    return `${p.data}/${p.gen}`;
  },
};

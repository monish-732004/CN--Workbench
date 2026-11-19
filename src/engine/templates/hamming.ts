import type { Rng } from "../rng";
import { fraction, type Difficulty, type Template } from "../types";

/**
 * Hamming code as taught in the SRM U4 slides: positions numbered from the right
 * (position 1 = LSB), parity bits at powers of two, even parity, data bits
 * filled MSB-first into the remaining positions from the highest down.
 * Strings are written position n … 1, left to right.
 */
export interface HammingParams {
  d: Difficulty;
  m: number;
  data: string;
  recv?: string;
}

export interface HammingSolution {
  n: number;
  parityPositions: number[];
  codeword: string;
  syndrome?: string;
  errorPos?: number;
  corrected?: string;
  dataword?: string;
}

export function hammingN(m: number) {
  let r = 0;
  while (2 ** r < m + r + 1) r++;
  return m + r;
}

const isPow2 = (x: number) => (x & (x - 1)) === 0;

export function dataPositions(n: number) {
  const out: number[] = [];
  for (let pos = n; pos >= 1; pos--) if (!isPow2(pos)) out.push(pos);
  return out;
}

export function parityPositions(n: number) {
  const out: number[] = [];
  for (let p = 1; p <= n; p *= 2) out.push(p);
  return out;
}

/** bits: index = position (1..n) */
function toStr(bits: number[], n: number) {
  let s = "";
  for (let pos = n; pos >= 1; pos--) s += bits[pos] ? "1" : "0";
  return s;
}

function fromStr(s: string): number[] {
  const n = s.length;
  const bits = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i++) bits[n - i] = s[i] === "1" ? 1 : 0;
  return bits;
}

export function encode(data: string, odd = false, fromLeft = false): string {
  const n = hammingN(data.length);
  const bits = new Array(n + 1).fill(0);
  const dp = dataPositions(n);
  dp.forEach((pos, i) => (bits[pos] = data[i] === "1" ? 1 : 0));
  for (const p of parityPositions(n)) {
    let x = 0;
    for (let pos = 1; pos <= n; pos++) if (pos !== p && pos & p) x ^= bits[pos]!;
    bits[p] = odd ? x ^ 1 : x;
  }
  const s = toStr(bits, n);
  return fromLeft ? s.split("").reverse().join("") : s;
}

export function decode(recv: string) {
  const n = recv.length;
  const bits = fromStr(recv);
  const parities = parityPositions(n);
  let value = 0;
  let syn = "";
  for (const p of parities.slice().reverse()) {
    let x = 0;
    for (let pos = 1; pos <= n; pos++) if (pos & p) x ^= bits[pos]!;
    syn += String(x);
    if (x) value += p;
  }
  const fixed = bits.slice();
  if (value >= 1 && value <= n) fixed[value] ^= 1;
  const corrected = toStr(fixed, n);
  const dataword = dataPositions(n)
    .map((pos) => String(fixed[pos]))
    .join("");
  return { syndrome: syn, errorPos: value, corrected, dataword };
}

function randBits(rng: Rng, k: number) {
  let s = "";
  for (let i = 0; i < k; i++) s += rng.bool() ? "1" : "0";
  return s;
}

export const hamming: Template<HammingParams, HammingSolution> = {
  id: "hamming",
  generate(rng, d) {
    // Easy encodes a 7-bit word (slide U4 p.122); medium encodes 4 bits and decodes a 7-bit codeword; hard does both at 11 bits.
    const m = d === "medium" ? 4 : 7;
    let data = randBits(rng, m);
    while (/^0+$/.test(data) || /^1+$/.test(data)) data = randBits(rng, m);
    if (d === "easy") return { d, m, data };
    let other = randBits(rng, m);
    while (other === data) other = randBits(rng, m);
    const code = encode(other);
    const n = code.length;
    const flip = rng.int(1, n); // position from the right
    const idx = n - flip;
    const recv = code.slice(0, idx) + (code[idx] === "1" ? "0" : "1") + code.slice(idx + 1);
    return { d, m, data, recv };
  },
  solve(p) {
    const codeword = encode(p.data);
    const n = codeword.length;
    const base = { n, parityPositions: parityPositions(n), codeword };
    if (!p.recv) return base;
    return { ...base, ...decode(p.recv) };
  },
  view(p) {
    return { m: p.m, n: hammingN(p.m), data: p.data, recv: p.recv ?? null };
  },
  checkpoints(p) {
    if (p.d === "easy")
      return [
        { id: "parity", title: "Parity bit positions", weight: 0.2 },
        { id: "codeword", title: "Codeword", weight: 0.8 },
      ];
    return [
      { id: "parity", title: "Parity bit positions", weight: 0.1 },
      { id: "codeword", title: "Codeword", weight: 0.35 },
      { id: "syndrome", title: "Syndrome", weight: 0.2 },
      { id: "errorpos", title: "Error position", weight: 0.15 },
      { id: "dataword", title: "Corrected dataword", weight: 0.2 },
    ];
  },
  grade(p, s, cp, r) {
    if (cp === "parity") {
      const got = new Set<number>((Array.isArray(r?.positions) ? r.positions : []).map(Number));
      const want = new Set(s.parityPositions);
      const ok = got.size === want.size && [...want].every((x) => got.has(x));
      const fromLeft = s.parityPositions.every((pp) => got.has(s.n + 1 - pp));
      return { score: ok ? 1 : 0, misconceptions: ok ? [] : fromLeft ? ["hamming.positions-from-msb"] : ["hamming.parity-positions"] };
    }
    if (cp === "codeword") {
      const got = String(r?.bits ?? "");
      let hits = 0;
      const fields: Record<string, boolean> = {};
      for (let i = 0; i < s.n; i++) {
        const ok = got[i] === s.codeword[i];
        fields[`pos${s.n - i}`] = ok;
        if (ok) hits++;
      }
      const mis: string[] = [];
      if (got !== s.codeword) {
        if (got === encode(p.data, true)) mis.push("hamming.odd-parity");
        if (got === encode(p.data, false, true)) mis.push("hamming.positions-from-msb");
      }
      return { score: fraction(hits, s.n), misconceptions: mis, fields };
    }
    if (cp === "syndrome") {
      const ok = String(r?.bits ?? "") === s.syndrome;
      const rev = String(r?.bits ?? "").split("").reverse().join("") === s.syndrome;
      return { score: ok ? 1 : 0, misconceptions: ok ? [] : rev ? ["hamming.syndrome-bit-order"] : ["hamming.syndrome"] };
    }
    if (cp === "errorpos") {
      const got = Number(r?.pos);
      if (got === s.errorPos) return { score: 1, misconceptions: [] };
      if (typeof r?.syndrome === "string" && /^[01]+$/.test(r.syndrome) && got === parseInt(r.syndrome, 2)) return { score: 0.75, misconceptions: ["hamming.carried-error"] };
      if (got === (s.n + 1 - s.errorPos!)) return { score: 0, misconceptions: ["hamming.positions-from-msb"] };
      return { score: 0, misconceptions: [] };
    }
    if (cp === "dataword") {
      const got = String(r?.bits ?? "");
      if (got === s.dataword) return { score: 1, misconceptions: [] };
      if (p.recv && Number.isFinite(Number(r?.pos))) {
        const pos = Number(r.pos);
        const n = p.recv.length;
        const idx = n - pos;
        if (pos >= 1 && pos <= n) {
          const fixed = p.recv.slice(0, idx) + (p.recv[idx] === "1" ? "0" : "1") + p.recv.slice(idx + 1);
          const theirs = dataPositions(n)
            .map((q) => fixed[n - q])
            .join("");
          if (got === theirs) return { score: 0.75, misconceptions: ["hamming.carried-error"] };
        }
      }
      return { score: 0, misconceptions: ["hamming.data-extraction"] };
    }
    return { score: 0, misconceptions: [] };
  },
  optimalMoves(p, s) {
    const r = s.parityPositions.length;
    const enc = r + s.n;
    if (!p.recv) return enc;
    return enc + r + 1 + p.m;
  },
  key(p) {
    return `${p.data}|${p.recv ?? ""}`;
  },
};

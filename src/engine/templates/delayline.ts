import type { Rng } from "../rng";
import { clamp01, type Difficulty, type Template } from "../types";

/**
 * Latency = propagation + transmission + queuing + processing (Forouzan §3.6).
 * Every value is an exact integer in microseconds so answers have no rounding ambiguity.
 * 1 KB = 1,000 bytes, as in the SRM slides.
 */
export interface DelayParams {
  d: Difficulty;
  distanceKm: number;
  speedM: 200 | 240 | 300; // ×10^6 m/s
  sizeValue: number;
  sizeUnit: "KB" | "MB";
  bwMbps: 1 | 10 | 100 | 1000;
  queueUs: number;
  procUs: number;
}

export interface DelaySolution {
  propUs: number;
  txUs: number;
  totalUs: number;
  dominant: "propagation" | "transmission" | "queuing" | "processing";
  bdpBits: number;
}

const SPEED_STEP: Record<DelayParams["speedM"], number> = { 200: 10, 240: 60, 300: 30 };

function sizeBytes(p: DelayParams) {
  return p.sizeValue * (p.sizeUnit === "KB" ? 1000 : 1_000_000);
}

function solve(p: DelayParams): DelaySolution {
  const propUs = (p.distanceKm * 1_000_000_000) / (p.speedM * 1_000_000); // km→m, ×1e6 µs
  const txUs = (sizeBytes(p) * 8) / p.bwMbps; // bits / (Mbit/s) = µs
  const totalUs = propUs + txUs + p.queueUs + p.procUs;
  const parts: [DelaySolution["dominant"], number][] = [
    ["propagation", propUs],
    ["transmission", txUs],
    ["queuing", p.queueUs],
    ["processing", p.procUs],
  ];
  parts.sort((a, b) => b[1] - a[1]);
  return { propUs, txUs, totalUs, dominant: parts[0]![0], bdpBits: p.bwMbps * propUs };
}

function hasClearDominant(p: DelayParams) {
  const s = solve(p);
  const vals = [s.propUs, s.txUs, p.queueUs, p.procUs].sort((a, b) => b - a);
  return vals[0]! >= vals[1]! * 1.25;
}

/** Parse a millisecond answer like "18.7" or "18.700 ms" into µs. */
export function parseMs(x: unknown): number {
  if (typeof x !== "string" && typeof x !== "number") return NaN;
  const s = String(x).replace(/ms/i, "").replace(/,/g, "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s) * 1000;
}

function approxUs(answerUs: number, expectUs: number) {
  return Number.isFinite(answerUs) && Math.abs(answerUs - expectUs) < 0.5;
}

export const delayline: Template<DelayParams, DelaySolution> = {
  id: "delayline",
  generate(rng: Rng, d) {
    for (let i = 0; i < 200; i++) {
      const speedM = rng.pick([200, 240, 300] as const);
      const step = SPEED_STEP[speedM];
      const maxKm = d === "hard" ? 12000 : 6000;
      const distanceKm = rng.int(Math.ceil(30 / step), Math.floor(maxKm / step)) * step;
      const big = rng.int(0, 3) === 0;
      const sizeUnit: "KB" | "MB" = big ? "MB" : "KB";
      const sizeValue = big ? rng.int(1, 8) : rng.pick([2, 5, 8, 10, 12, 15, 20, 25, 40, 50, 64, 80, 100, 125, 200, 250, 500]);
      const bwMbps = big ? rng.pick([1, 10, 100] as const) : rng.pick([10, 100, 1000] as const);
      const queueUs = d === "easy" ? 0 : rng.int(1, 40) * 100;
      const procUs = d === "easy" ? 0 : rng.int(1, 9) * 50;
      const p: DelayParams = { d, distanceKm, speedM, sizeValue, sizeUnit, bwMbps, queueUs, procUs };
      if (hasClearDominant(p)) return p;
    }
    return { d, distanceKm: 3600, speedM: 240, sizeValue: 15, sizeUnit: "KB", bwMbps: 100, queueUs: d === "easy" ? 0 : 2000, procUs: d === "easy" ? 0 : 500 };
  },
  solve,
  view(p) {
    return {
      distanceKm: p.distanceKm,
      speed: p.speedM === 300 ? "3 × 10⁸ m/s" : p.speedM === 240 ? "2.4 × 10⁸ m/s" : "2 × 10⁸ m/s",
      medium: p.speedM === 300 ? "free space" : "cable",
      size: `${p.sizeValue} ${p.sizeUnit}`,
      bandwidth: p.bwMbps === 1000 ? "1 Gbps" : `${p.bwMbps} Mbps`,
      queueMs: p.queueUs / 1000,
      procMs: p.procUs / 1000,
      withQueue: p.d !== "easy",
      withBdp: p.d === "hard",
    };
  },
  checkpoints(p) {
    const cps = [
      { id: "delays", title: "Propagation and transmission time", weight: p.d === "hard" ? 0.35 : 0.45 },
      { id: "total", title: "Total latency", weight: p.d === "hard" ? 0.3 : 0.35 },
      { id: "dominant", title: "Dominant component", weight: p.d === "hard" ? 0.15 : 0.2 },
    ];
    if (p.d === "hard") cps.push({ id: "bdp", title: "Bandwidth-delay product", weight: 0.2 });
    return cps;
  },
  grade(p, s, cp, r) {
    const mis: string[] = [];
    if (cp === "delays") {
      const prop = parseMs(r?.prop);
      const tx = parseMs(r?.tx);
      const okP = approxUs(prop, s.propUs);
      const okT = approxUs(tx, s.txUs);
      if (!okT && approxUs(tx, s.txUs / 8)) mis.push("delay.bytes-not-bits");
      if ((!okP && (approxUs(prop, s.propUs * 1000) || approxUs(prop, s.propUs / 1000))) || (!okT && (approxUs(tx, s.txUs * 1000) || approxUs(tx, s.txUs / 1000))))
        mis.push("delay.unit-conversion");
      if (!okT && p.sizeUnit === "KB" && approxUs(tx, (s.txUs * 1024) / 1000)) mis.push("delay.kb-is-1000");
      return { score: ((okP ? 1 : 0) + (okT ? 1 : 0)) / 2, misconceptions: mis, fields: { prop: okP, tx: okT } };
    }
    if (cp === "total") {
      const t = parseMs(r?.total);
      const ok = approxUs(t, s.totalUs);
      if (!ok && approxUs(t, s.propUs + s.txUs) && p.d !== "easy") mis.push("delay.missed-queue-processing");
      return { score: ok ? 1 : 0, misconceptions: mis, fields: { total: ok } };
    }
    if (cp === "dominant") {
      const ok = r?.dominant === s.dominant;
      return { score: ok ? 1 : 0, misconceptions: ok ? [] : ["delay.dominant"], fields: { dominant: ok } };
    }
    if (cp === "bdp") {
      const v = Number(String(r?.bdp ?? "").replace(/[, ]/g, ""));
      const ok = Number.isFinite(v) && Math.abs(v - s.bdpBits) < 0.5;
      if (!ok && Math.abs(v - s.bdpBits / 8) < 0.5) mis.push("bdp.bytes-not-bits");
      return { score: clamp01(ok ? 1 : 0), misconceptions: mis, fields: { bdp: ok } };
    }
    return { score: 0, misconceptions: [] };
  },
  optimalMoves(p) {
    return p.d === "hard" ? 5 : 4;
  },
  key(p) {
    return `${p.distanceKm}|${p.speedM}|${p.sizeValue}${p.sizeUnit}|${p.bwMbps}|${p.queueUs}|${p.procUs}`;
  },
};

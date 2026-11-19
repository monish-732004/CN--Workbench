import type { Rng } from "../rng";
import { fraction, type Difficulty, type Template } from "../types";

export type Wire = "WO" | "O" | "WG" | "B" | "WB" | "G" | "WBr" | "Br";
export const T568A: Wire[] = ["WG", "G", "WO", "B", "WB", "O", "WBr", "Br"];
export const T568B: Wire[] = ["WO", "O", "WG", "B", "WB", "G", "WBr", "Br"];
export type Cable = "straight" | "crossover" | "rollover";

interface Pair {
  a: string;
  b: string;
  cable: Cable;
}

/** Packet Tracer conventions (no Auto-MDIX assumed). */
const PAIRS: Pair[] = [
  { a: "PC", b: "Switch", cable: "straight" },
  { a: "Switch", b: "Router (Gi0/0)", cable: "straight" },
  { a: "PC", b: "Hub", cable: "straight" },
  { a: "Server", b: "Switch", cable: "straight" },
  { a: "PC", b: "PC", cable: "crossover" },
  { a: "Switch", b: "Switch", cable: "crossover" },
  { a: "Router (Gi0/0)", b: "Router (Gi0/1)", cable: "crossover" },
  { a: "PC", b: "Router (Gi0/0)", cable: "crossover" },
  { a: "Hub", b: "Switch", cable: "crossover" },
  { a: "PC (RS-232 via adapter)", b: "Router (Console)", cable: "rollover" },
];

export interface PinoutParams {
  d: Difficulty;
  mode: "crimp" | "select";
  /** crimp: target standard. select: standard of end A. */
  standard: "T568A" | "T568B";
  pair?: Pair;
  tray: Wire[];
}

export interface PinoutSolution {
  cable?: Cable;
  pins: Wire[];
}

const std = (s: "T568A" | "T568B") => (s === "T568A" ? T568A : T568B);

function endB(endA: "T568A" | "T568B", cable: Cable): Wire[] {
  if (cable === "straight") return std(endA);
  if (cable === "crossover") return std(endA === "T568A" ? "T568B" : "T568A");
  return std(endA).slice().reverse();
}

export const pinout: Template<PinoutParams, PinoutSolution> = {
  id: "pinout",
  generate(rng: Rng, d) {
    const standard = rng.pick(["T568A", "T568B"] as const);
    const tray = rng.shuffle(T568B);
    if (d === "easy") return { d, mode: "crimp", standard, tray };
    const pool = d === "medium" ? PAIRS.filter((p) => p.cable !== "rollover") : PAIRS;
    const pair = rng.pick(pool);
    return { d, mode: "select", standard, pair, tray };
  },
  solve(p) {
    if (p.mode === "crimp") return { pins: std(p.standard) };
    return { cable: p.pair!.cable, pins: endB(p.standard, p.pair!.cable) };
  },
  view(p) {
    return {
      mode: p.mode,
      standard: p.standard,
      endA: p.mode === "select" ? std(p.standard) : null,
      deviceA: p.pair?.a ?? null,
      deviceB: p.pair?.b ?? null,
      tray: p.tray,
      cableOptions: p.d === "hard" ? ["straight", "crossover", "rollover"] : ["straight", "crossover", "rollover"],
    };
  },
  checkpoints(p) {
    if (p.mode === "crimp") return [{ id: "pins", title: "Pin order", weight: 1 }];
    return [
      { id: "cable", title: "Cable type", weight: 0.3 },
      { id: "pins", title: "End B pin order", weight: 0.7 },
    ];
  },
  grade(p, s, cp, r) {
    if (cp === "cable") {
      const ok = r?.cable === s.cable;
      const mis = ok ? [] : [r?.cable === "straight" ? "cable.straight-for-like-devices" : r?.cable === "crossover" ? "cable.crossover-for-unlike-devices" : "cable.rollover-misuse"];
      return { score: ok ? 1 : 0, misconceptions: mis, fields: { cable: ok } };
    }
    if (cp === "pins") {
      const pins: unknown[] = Array.isArray(r?.pins) ? r.pins : [];
      const fields: Record<string, boolean> = {};
      let hits = 0;
      s.pins.forEach((w, i) => {
        const ok = pins[i] === w;
        fields[`pin${i + 1}`] = ok;
        if (ok) hits++;
      });
      let score = fraction(hits, 8);
      const mis: string[] = [];
      const same = (a: Wire[]) => a.every((w, i) => pins[i] === w);
      if (score < 1) {
        if (same(T568A) || same(T568B)) mis.push("pinout.standard-swapped");
        if (same(s.pins.slice().reverse())) mis.push("pinout.reversed");
        // Error carried forward: pins consistent with the student's own (wrong) cable choice.
        if (p.mode === "select" && typeof r?.cable === "string" && r.cable !== s.cable) {
          const theirs = endB(p.standard, r.cable as Cable);
          if (same(theirs)) score = Math.max(score, 0.75);
        }
        const solidStripe = s.pins.some((w, i) => pins[i] && pins[i] !== w && String(pins[i]).replace("W", "") === w.replace("W", ""));
        if (solidStripe) mis.push("pinout.stripe-solid-swapped");
      }
      return { score, misconceptions: mis, fields };
    }
    return { score: 0, misconceptions: [] };
  },
  optimalMoves(p) {
    return p.mode === "crimp" ? 8 : 9;
  },
  key(p) {
    return `${p.mode}|${p.standard}|${p.pair?.a}|${p.pair?.b}`;
  },
};

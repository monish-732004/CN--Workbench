import type { AttemptItem, AttemptBase, IntegrityEvent, ScoringConfig } from "./model";
import type { Difficulty } from "./types";

/**
 * Transparent scoring (PRD §8). Pure, so the teacher can change criteria and
 * see every student's score recomputed instantly before exporting.
 */

const FREE_WRONG: Record<Difficulty, number> = { easy: 1, medium: 1, hard: 2 };
const TAU_CHECKS: Record<Difficulty, number> = { easy: 2, medium: 3, hard: 4 };
const RHO: Record<Difficulty, number> = { easy: 2, medium: 2.5, hard: 2.5 };

export interface ItemScore {
  index: number;
  topicId: string;
  title: string;
  difficulty: Difficulty;
  weight: number;
  accuracy: number;
  efficiency: number;
  value: number; // accuracy × efficiency
  timeSec: number;
  expectedSec: number;
  moves: number;
  optimalMoves: number;
  checks: number;
  wrongChecks: number;
  te: string[];
  misconceptions: string[];
  attempted: boolean;
}

export type Tier = "clean" | "watch" | "flagged";

export interface AttemptScore {
  accuracy: number; // 0..1
  mastery: number; // 0..1 (before integrity and lateness)
  integrity: number; // I, 0..1
  integrityApplied: number;
  tier: Tier;
  latePenalty: number; // L, 0..1
  lateSec: number;
  score: number; // S, 0..100
  marks: number;
  items: ItemScore[];
  counts: { fullscreen: number; tab: number; blur: number; other: number; total: number };
  teItems: number;
  timeSec: number;
  expectedSec: number;
}

export function itemAccuracy(item: Pick<AttemptItem, "checkpoints" | "cp">): number {
  const total = item.checkpoints.reduce((s, c) => s + c.weight, 0);
  if (!total) return 0;
  return item.checkpoints.reduce((s, c) => s + c.weight * (item.cp[c.id]?.score ?? 0), 0) / total;
}

export function trialAndError(item: Pick<AttemptItem, "difficulty" | "cp" | "stats" | "optimalMoves">): string[] {
  const rules: string[] = [];
  const wrong = Object.values(item.cp).reduce((s, c) => s + c.wrong, 0);
  if (wrong > TAU_CHECKS[item.difficulty]) rules.push("R1");
  if (item.optimalMoves > 0 && item.stats.moves > RHO[item.difficulty] * item.optimalMoves) rules.push("R2");
  if (item.stats.maxOscillation >= 3) rules.push("R3");
  const log = item.stats.checkLog;
  for (let i = 2; i < log.length; i++) {
    const a = log[i - 2]!;
    const c = log[i]!;
    // Only bursts of failing checks count: checking several finished checkpoints back to back is legitimate.
    if (!c.correct && !log[i - 1]!.correct && c.at - a.at <= 15_000 && c.moves - log[i - 1]!.moves <= 1 && log[i - 1]!.moves - a.moves <= 1) {
      rules.push("R4");
      break;
    }
  }
  return rules;
}

export const TE_RULE_TEXT: Record<string, string> = {
  R1: "More wrong checks than expected",
  R2: "Far more moves than needed",
  R3: "Repeatedly flipping the same element",
  R4: "Rapid checks with almost no changes",
};

export function scoreItem(item: Omit<AttemptItem, "view">, cfg: ScoringConfig): ItemScore {
  const accuracy = itemAccuracy(item);
  const checks = Object.values(item.cp).reduce((s, c) => s + c.checks, 0);
  const wrong = Object.values(item.cp).reduce((s, c) => s + c.wrong, 0);
  const timeSec = item.stats.activeMs / 1000;
  const attempted = checks > 0 || item.stats.moves > 0;
  let eff = 1;
  if (cfg.efficiency.enabled && attempted) {
    const rt = timeSec / Math.max(1, item.expectedSec);
    const ft = rt <= 1 ? 1 : Math.max(0.75, 1 - 0.25 * (rt - 1));
    const rm = item.stats.moves / Math.max(1, item.optimalMoves);
    const fm = rm <= 1.5 ? 1 : Math.max(0.7, 1 - 0.2 * (rm - 1.5));
    const fw = Math.max(0.6, 1 - 0.1 * Math.max(0, wrong - FREE_WRONG[item.difficulty]));
    const wsum = cfg.efficiency.time + cfg.efficiency.moves + cfg.efficiency.wrong || 1;
    eff = (cfg.efficiency.time * ft + cfg.efficiency.moves * fm + cfg.efficiency.wrong * fw) / wsum;
    if (cfg.efficiency.bonus && accuracy >= 0.9999 && wrong === 0 && rt <= 0.75 && rm <= 1.2) eff += 0.05;
  }
  const misconceptions = [...new Set(Object.values(item.cp).flatMap((c) => c.misconceptions))];
  return {
    index: item.index,
    topicId: item.topicId,
    title: item.title,
    difficulty: item.difficulty,
    weight: cfg.weights[item.difficulty],
    accuracy,
    efficiency: eff,
    value: accuracy * eff,
    timeSec,
    expectedSec: item.expectedSec,
    moves: item.stats.moves,
    optimalMoves: item.optimalMoves,
    checks,
    wrongChecks: wrong,
    te: attempted ? trialAndError(item) : [],
    misconceptions,
    attempted,
  };
}

export function severity(e: IntegrityEvent): number {
  const s = (e.durationMs ?? 0) / 1000;
  switch (e.type) {
    case "fullscreen_exit":
    case "tab_hidden":
      return Math.min(0.15, 0.04 + 0.002 * s);
    case "window_blur":
      return s > 2 ? 0.02 : 0;
    case "devtools_suspected":
      return 0.1;
    case "clipboard_attempt":
      return 0.02;
    case "context_menu":
      return 0.005;
    case "print_attempt":
      return 0.03;
    case "multi_session":
      return 0.15;
  }
}

export function integrityOf(events: IntegrityEvent[], excused: string[] | undefined, cfg: ScoringConfig) {
  const ex = new Set(excused ?? []);
  let clip = 0;
  let ctx = 0;
  let P = 0;
  let hard = false;
  const counts = { fullscreen: 0, tab: 0, blur: 0, other: 0, total: 0 };
  for (const e of events) {
    if (ex.has(e.id)) continue;
    let sev = severity(e);
    if (e.type === "clipboard_attempt") {
      sev = Math.min(sev, Math.max(0, 0.06 - clip));
      clip += sev;
    }
    if (e.type === "context_menu") {
      sev = Math.min(sev, Math.max(0, 0.02 - ctx));
      ctx += sev;
    }
    P += sev;
    if (e.type === "fullscreen_exit") counts.fullscreen++;
    else if (e.type === "tab_hidden") counts.tab++;
    else if (e.type === "window_blur") {
      if ((e.durationMs ?? 0) > 2000) counts.blur++;
    } else counts.other++;
    if (e.type === "devtools_suspected" || e.type === "multi_session") hard = true;
  }
  counts.total = counts.fullscreen + counts.tab + counts.blur + counts.other;
  const I = Math.max(cfg.integrity.floor, 1 - P * cfg.integrity.scale);
  const tier: Tier = hard || I < 0.8 ? "flagged" : I < 0.95 ? "watch" : "clean";
  return { I, tier, counts };
}

export function roundTo(x: number, step: number) {
  if (!step) return x;
  return Math.round(x / step) * step;
}

export function scoreAttempt(
  a: Pick<AttemptBase, "integrity" | "submittedAt" | "status"> & { items: Omit<AttemptItem, "view">[] },
  ctx: { endAt?: number; excused?: string[]; cfg: ScoringConfig; now: number },
): AttemptScore {
  const { cfg } = ctx;
  const items = a.items.map((it) => scoreItem(it, cfg));
  const wsum = items.reduce((s, x) => s + x.weight, 0) || 1;
  const accuracy = items.reduce((s, x) => s + x.weight * x.accuracy, 0) / wsum;
  const mastery = Math.min(1, items.reduce((s, x) => s + x.weight * x.value, 0) / wsum);
  const { I, tier, counts } = integrityOf(a.integrity, ctx.excused, cfg);
  const integrityApplied = cfg.integrity.mode === "enforced" ? I : 1;
  const lateSec = a.submittedAt && ctx.endAt ? Math.max(0, Math.round((a.submittedAt - ctx.endAt) / 1000)) : 0;
  let L = 0;
  if (cfg.late.mode === "penalise" && lateSec > 0) {
    L = Math.min(cfg.late.capPct / 100, (cfg.late.ratePct / 100) * Math.ceil(lateSec / (cfg.late.stepMin * 60)));
  }
  const score = 100 * mastery * integrityApplied * (1 - L);
  return {
    accuracy,
    mastery,
    integrity: I,
    integrityApplied,
    tier,
    latePenalty: L,
    lateSec,
    score,
    marks: roundTo((score / 100) * cfg.maxMarks, cfg.rounding),
    items,
    counts,
    teItems: items.filter((x) => x.te.length).length,
    timeSec: items.reduce((s, x) => s + x.timeSec, 0),
    expectedSec: items.reduce((s, x) => s + x.expectedSec, 0),
  };
}

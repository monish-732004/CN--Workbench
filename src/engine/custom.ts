import { evaluate, substitute } from "./expr";
import type { Rng } from "./rng";
import { fraction, type CheckpointDef, type Difficulty, type GradeResult } from "./types";

/**
 * Teacher-written questions. Differentiation per student: options and steps are shuffled,
 * and numeric questions draw their own variable values, so answers can't simply be shared.
 */
export type CustomType = "mcq" | "msq" | "numeric" | "text" | "order";

export interface CustomVar {
  name: string;
  min: number;
  max: number;
  step: number;
}

export interface CustomQuestion {
  id: string;
  type: CustomType;
  title: string;
  prompt: string;
  difficulty: Difficulty;
  unit: number; // 0 = general, 1..5
  options?: { text: string; correct: boolean }[];
  vars?: CustomVar[];
  formula?: string;
  tolerance?: number; // absolute
  unitLabel?: string;
  accepted?: string[];
  steps?: string[];
}

export interface CustomParams {
  d: Difficulty;
  q: CustomQuestion;
  vars: Record<string, number>;
  order: number[]; // option / step display order
}

export const CUSTOM_EXPECTED: Record<CustomType, Record<Difficulty, number>> = {
  mcq: { easy: 45, medium: 75, hard: 120 },
  msq: { easy: 60, medium: 90, hard: 150 },
  numeric: { easy: 90, medium: 150, hard: 240 },
  text: { easy: 60, medium: 90, hard: 150 },
  order: { easy: 60, medium: 100, hard: 150 },
};

export const CUSTOM_TYPE_LABEL: Record<CustomType, string> = {
  mcq: "Multiple choice",
  msq: "Multiple select",
  numeric: "Numeric (random values)",
  text: "Short answer",
  order: "Order the steps",
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Validate and clean a question from the browser. Returns an error message or the clean question. */
export function validateCustom(raw: any, idx: number): CustomQuestion | string {
  const type = raw?.type as CustomType;
  if (!["mcq", "msq", "numeric", "text", "order"].includes(type)) return `Question ${idx + 1}: unknown type.`;
  const prompt = String(raw?.prompt ?? "").trim().slice(0, 1500);
  if (prompt.length < 3) return `Question ${idx + 1}: write the question text.`;
  const difficulty: Difficulty = ["easy", "medium", "hard"].includes(raw?.difficulty) ? raw.difficulty : "medium";
  const q: CustomQuestion = {
    id: String(raw?.id ?? `q${idx}`).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || `q${idx}`,
    type,
    title: String(raw?.title ?? "").trim().slice(0, 60) || "Teacher question",
    prompt,
    difficulty,
    unit: Math.max(0, Math.min(5, Math.round(Number(raw?.unit) || 0))),
  };
  if (type === "mcq" || type === "msq") {
    const opts = (Array.isArray(raw?.options) ? raw.options : [])
      .map((o: any) => ({ text: String(o?.text ?? "").trim().slice(0, 300), correct: !!o?.correct }))
      .filter((o: any) => o.text);
    if (opts.length < 2 || opts.length > 8) return `Question ${idx + 1}: give 2 to 8 options.`;
    const nCorrect = opts.filter((o: any) => o.correct).length;
    if (type === "mcq" && nCorrect !== 1) return `Question ${idx + 1}: mark exactly one correct option.`;
    if (type === "msq" && nCorrect < 1) return `Question ${idx + 1}: mark at least one correct option.`;
    q.options = opts;
  }
  if (type === "numeric") {
    const vars = (Array.isArray(raw?.vars) ? raw.vars : [])
      .map((v: any) => ({ name: String(v?.name ?? "").trim(), min: Number(v?.min), max: Number(v?.max), step: Number(v?.step) || 1 }))
      .filter((v: any) => v.name);
    for (const v of vars) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v.name)) return `Question ${idx + 1}: variable "${v.name}" must be a simple name.`;
      if (!Number.isFinite(v.min) || !Number.isFinite(v.max) || v.max < v.min || v.step <= 0) return `Question ${idx + 1}: check the range of ${v.name}.`;
    }
    q.vars = vars.slice(0, 6);
    q.formula = String(raw?.formula ?? "").trim().slice(0, 300);
    q.tolerance = Math.max(0, Number(raw?.tolerance) || 0);
    q.unitLabel = String(raw?.unitLabel ?? "").trim().slice(0, 20);
    try {
      const mid = Object.fromEntries((q.vars ?? []).map((v) => [v.name, v.min]));
      const val = evaluate(q.formula, mid);
      if (!Number.isFinite(val)) return `Question ${idx + 1}: the formula does not give a number.`;
    } catch (e) {
      return `Question ${idx + 1}: formula error: ${(e as Error).message}.`;
    }
  }
  if (type === "text") {
    const acc = (Array.isArray(raw?.accepted) ? raw.accepted : String(raw?.accepted ?? "").split("|")).map((s: unknown) => String(s).trim()).filter(Boolean);
    if (!acc.length) return `Question ${idx + 1}: give at least one accepted answer.`;
    q.accepted = acc.slice(0, 10);
  }
  if (type === "order") {
    const steps = (Array.isArray(raw?.steps) ? raw.steps : []).map((s: unknown) => String(s).trim().slice(0, 200)).filter(Boolean);
    if (steps.length < 3 || steps.length > 10) return `Question ${idx + 1}: give 3 to 10 steps in the correct order.`;
    q.steps = steps;
  }
  return q;
}

export function generateCustom(q: CustomQuestion, rng: Rng): CustomParams {
  const vars: Record<string, number> = {};
  for (const v of q.vars ?? []) {
    const n = Math.floor((v.max - v.min) / v.step);
    vars[v.name] = +(v.min + rng.int(0, Math.max(0, n)) * v.step).toFixed(6);
  }
  const len = q.type === "order" ? q.steps!.length : q.options?.length ?? 0;
  let order = rng.shuffle(Array.from({ length: len }, (_, i) => i));
  if (q.type === "order" && order.every((x, i) => x === i) && len > 1) order = [...order.slice(1), order[0]!];
  return { d: q.difficulty, q, vars, order };
}

export function customView(p: CustomParams) {
  const q = p.q;
  return {
    type: q.type,
    prompt: substitute(q.prompt, p.vars),
    options: q.type === "mcq" || q.type === "msq" ? p.order.map((i) => ({ id: `o${i}`, text: substitute(q.options![i]!.text, p.vars) })) : null,
    cards: q.type === "order" ? p.order.map((i) => ({ id: `s${i}`, text: q.steps![i]! })) : null,
    unitLabel: q.unitLabel ?? "",
  };
}

export function customCheckpoints(): CheckpointDef[] {
  return [{ id: "answer", title: "Answer", weight: 1 }];
}

export function customAnswer(p: CustomParams): number | null {
  if (p.q.type !== "numeric") return null;
  return evaluate(p.q.formula!, p.vars);
}

export function gradeCustom(p: CustomParams, r: any): GradeResult {
  const q = p.q;
  switch (q.type) {
    case "mcq": {
      const got = String(r?.choice ?? "");
      const correct = q.options!.findIndex((o) => o.correct);
      return { score: got === `o${correct}` ? 1 : 0, misconceptions: [] };
    }
    case "msq": {
      const got = new Set<string>(Array.isArray(r?.choices) ? r.choices : []);
      let right = 0;
      q.options!.forEach((o, i) => {
        if (got.has(`o${i}`) === o.correct) right++;
      });
      const all = right === q.options!.length;
      return { score: all ? 1 : Math.max(0, (right - (q.options!.length - right)) / q.options!.length), misconceptions: [] };
    }
    case "numeric": {
      const ans = customAnswer(p)!;
      const x = Number(String(r?.value ?? "").replace(/,/g, ""));
      const tol = Math.max(q.tolerance ?? 0, Math.abs(ans) * 1e-9);
      return { score: String(r?.value ?? "").trim() !== "" && Number.isFinite(x) && Math.abs(x - ans) <= tol + 1e-12 ? 1 : 0, misconceptions: [] };
    }
    case "text": {
      const got = norm(String(r?.text ?? ""));
      return { score: q.accepted!.some((a) => norm(a) === got) ? 1 : 0, misconceptions: [] };
    }
    case "order": {
      const ids: string[] = Array.isArray(r?.order) ? r.order : [];
      const got = ids.map((id) => Number(String(id).slice(1)));
      const pos = got.filter((x, i) => x === i).length;
      return { score: pos === q.steps!.length ? 1 : 0.8 * fraction(pos, q.steps!.length), misconceptions: [] };
    }
  }
}

export function customMoves(p: CustomParams): number {
  if (p.q.type === "msq") return Math.max(1, p.q.options!.filter((o) => o.correct).length);
  if (p.q.type === "order") return Math.max(1, Math.ceil(p.q.steps!.length / 2));
  return 1;
}

export function customKey(p: CustomParams): string {
  return `${p.q.id}|${JSON.stringify(p.vars)}|${p.order.join(",")}`;
}

import type { Rng } from "./rng";

export type Difficulty = "easy" | "medium" | "hard";
export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

export interface CheckpointDef {
  id: string;
  title: string;
  weight: number;
}

export interface GradeResult {
  /** 0..1 */
  score: number;
  misconceptions: string[];
  /** Per-field correctness; only revealed to the student under "checkpoint" feedback. */
  fields?: Record<string, boolean | undefined>;
}

/**
 * A template is a pure, deterministic question mechanic.
 * Runs on the server only: the client never receives params or solutions.
 */
export interface Template<P extends { d: Difficulty } = any, S = any> {
  id: string;
  generate(rng: Rng, d: Difficulty): P;
  solve(p: P): S;
  /** Everything the student is allowed to see. Must not contain derived answers. */
  view(p: P): Record<string, unknown>;
  checkpoints(p: P): CheckpointDef[];
  grade(p: P, s: S, checkpointId: string, response: any): GradeResult;
  optimalMoves(p: P, s: S): number;
  /** Uniqueness key for room-level de-duplication of instances. */
  key(p: P): string;
}

export function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export function fraction(hits: number, total: number) {
  return total === 0 ? 0 : hits / total;
}

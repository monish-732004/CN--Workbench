import type { Slot } from "./catalog";
import type { CheckpointDef, Difficulty } from "./types";

export type IntegrityType =
  | "fullscreen_exit"
  | "tab_hidden"
  | "window_blur"
  | "devtools_suspected"
  | "clipboard_attempt"
  | "context_menu"
  | "print_attempt"
  | "multi_session";

export const INTEGRITY_LABEL: Record<IntegrityType, string> = {
  fullscreen_exit: "Left full screen",
  tab_hidden: "Switched tab or minimised",
  window_blur: "Window lost focus",
  devtools_suspected: "Developer tools suspected",
  clipboard_attempt: "Clipboard blocked",
  context_menu: "Right-click blocked",
  print_attempt: "Print or screenshot key",
  multi_session: "Joined from another device",
};

export interface IntegrityEvent {
  id: string;
  type: IntegrityType;
  at: number;
  durationMs?: number;
  itemIndex?: number;
}

export interface CpState {
  score: number;
  checks: number;
  wrong: number;
  correct: boolean;
  locked: boolean;
  misconceptions: string[];
}

export interface ItemStats {
  activeMs: number;
  moves: number;
  undos: number;
  resets: number;
  maxOscillation: number;
  checkLog: { at: number; moves: number; correct: boolean }[];
}

export interface AttemptItem {
  index: number;
  slot: number;
  topicId: string;
  templateId: string;
  difficulty: Difficulty;
  title: string;
  expectedSec: number;
  optimalMoves: number;
  checkpoints: CheckpointDef[];
  view: Record<string, unknown>;
  cp: Record<string, CpState>;
  stats: ItemStats;
  submitted: boolean;
}

export interface AttemptItemServer extends AttemptItem {
  params: unknown;
  solution: unknown;
  key: string;
}

export type AttemptStatus = "lobby" | "active" | "submitted";

export interface AttemptBase {
  code: string;
  regNo: string;
  name: string;
  joinedAt: number;
  startedAt?: number;
  submittedAt?: number;
  status: AttemptStatus;
  integrity: IntegrityEvent[];
  lastSeen: number;
  fullscreen: boolean;
  visible: boolean;
  sessions: number;
  device: string;
}

export interface Attempt extends AttemptBase {
  token: string;
  items: AttemptItemServer[];
}

/** What a student receives about their own attempt. */
export interface AttemptPublic extends AttemptBase {
  items: AttemptItem[];
}

/** What the teacher dashboard receives per student (no question content). */
export interface AttemptSummary extends AttemptBase {
  items: Omit<AttemptItem, "view">[];
}

export interface ScoringConfig {
  weights: Record<Difficulty, number>;
  efficiency: { enabled: boolean; time: number; moves: number; wrong: number; bonus: boolean };
  integrity: { mode: "enforced" | "advisory"; floor: number; scale: number };
  late: { mode: "none" | "penalise"; ratePct: number; stepMin: number; capPct: number };
  maxMarks: number;
  rounding: number;
}

export const DEFAULT_SCORING: ScoringConfig = {
  weights: { easy: 1, medium: 2, hard: 3 },
  efficiency: { enabled: true, time: 0.25, moves: 0.3, wrong: 0.45, bonus: true },
  integrity: { mode: "enforced", floor: 0.5, scale: 1 },
  late: { mode: "none", ratePct: 2, stepMin: 5, capPct: 30 },
  maxMarks: 10,
  rounding: 0.5,
};

export interface LatePolicy {
  mode: "flag" | "penalise" | "lock";
  graceMin: number;
}

export interface Room {
  code: string;
  title: string;
  section: string;
  createdAt: number;
  hostKeyHash: string;
  topics: string[];
  mix: Record<Difficulty, number>;
  slots: Slot[];
  estimatedSec: number;
  durationMode: "1.25" | "1.5" | "custom";
  durationSec: number;
  startAt?: number;
  endAt?: number;
  endedEarlyAt?: number;
  late: LatePolicy;
  feedback: "binary" | "checkpoint";
  maxChecks: number;
  scoring: ScoringConfig;
  excused: Record<string, string[]>;
}

export type RoomPhase = "waiting" | "live" | "grace" | "closed";

export function roomPhase(room: Pick<Room, "startAt" | "endAt" | "late" | "endedEarlyAt">, now: number): RoomPhase {
  if (!room.startAt || !room.endAt) return "waiting";
  if (now < room.startAt) return "waiting";
  if (room.endedEarlyAt && now >= room.endedEarlyAt) return "closed";
  if (now < room.endAt) return "live";
  if (room.late.mode !== "lock" && now < room.endAt + room.late.graceMin * 60_000) return "grace";
  return "closed";
}

/** The public room info a student or projector sees. */
export interface RoomPublic {
  code: string;
  title: string;
  section: string;
  phase: RoomPhase;
  startAt?: number;
  endAt?: number;
  graceEndAt?: number;
  durationSec: number;
  estimatedSec: number;
  items: number;
  feedback: Room["feedback"];
  lateMode: LatePolicy["mode"];
  serverNow: number;
}

export function toRoomPublic(room: Room, now: number): RoomPublic {
  return {
    code: room.code,
    title: room.title,
    section: room.section,
    phase: roomPhase(room, now),
    startAt: room.startAt,
    endAt: room.endedEarlyAt ?? room.endAt,
    graceEndAt: room.endAt && room.late.mode !== "lock" ? room.endAt + room.late.graceMin * 60_000 : undefined,
    durationSec: room.durationSec,
    estimatedSec: room.estimatedSec,
    items: room.slots.length,
    feedback: room.feedback,
    lateMode: room.late.mode,
    serverNow: now,
  };
}

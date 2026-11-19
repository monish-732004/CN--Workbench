import type { Slot } from "./catalog";
import type { CustomQuestion } from "./custom";
import type { CheckpointDef, Difficulty } from "./types";

// ───────── Game layer (points, modes, teams). Points never affect marks. ─────────
export type GameMode = "classic" | "gold" | "race";

export interface GameSettings {
  mode: GameMode;
  /** Show the live leaderboard to students. */
  leaderboard: boolean;
  /** 0 = individual; otherwise number of teams (2–8). */
  teams: number;
}

export const GAME_MODES: Record<GameMode, { label: string; blurb: string }> = {
  classic: { label: "Classic", blurb: "Points for every verified step, with first-try, speed and streak bonuses." },
  gold: { label: "Gold rush", blurb: "Each verified step opens three chests: gain, double, or steal points from a rival." },
  race: { label: "Race", blurb: "A progress race: the leaderboard ranks by verified steps, then by points." },
};

export const TEAMS = [
  { name: "Routers", color: "#5B8DEF" },
  { name: "Switches", color: "#3FA37A" },
  { name: "Packets", color: "#D6A23E" },
  { name: "Gateways", color: "#C9705A" },
  { name: "Firewalls", color: "#9A7FC6" },
  { name: "Bridges", color: "#4FA3A5" },
  { name: "Repeaters", color: "#B4864F" },
  { name: "Hubs", color: "#8A96A8" },
];

export interface PointsEvent {
  at: number;
  item: number;
  cp: string;
  pts: number;
  parts: string[];
}

export interface AttemptGame {
  streak: number;
  best: number;
  multNext: number;
  byItem: Record<number, number>;
  log: PointsEvent[];
}

export interface ChestOutcome {
  kind: "gain" | "pct" | "mult" | "lose" | "steal" | "nothing";
  value: number;
  label: string;
}

export interface BoardRow {
  rank: number;
  name: string;
  avatar: string;
  team: number | null;
  points: number;
  progress: number; // 0..1 verified steps
  finished: boolean;
  me?: boolean;
}

export interface TeamRow {
  index: number;
  name: string;
  color: string;
  members: number;
  points: number; // average per member
  total: number;
  progress: number;
}

export interface FeedEvent {
  at: number;
  kind: "steal" | "finish" | "streak";
  text: string;
  to?: string;
}

export interface Board {
  mode: GameMode;
  hidden: boolean;
  players: number;
  top: BoardRow[];
  me: BoardRow | null;
  teams: TeamRow[];
  feed: FeedEvent[];
}

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
  /** Avatar variant chosen in the lobby. */
  avatar: number;
  team: number | null;
  game: AttemptGame;
  chestPending: boolean;
  /** Id of the unopened chest (its outcomes stay server-side). */
  chestId?: string;
}

export interface Attempt extends AttemptBase {
  token: string;
  items: AttemptItemServer[];
  chest?: { id: string; outcomes: ChestOutcome[] };
}

/** Avatar seed. Hashed so the leaderboard never reveals a register number. */
export const avatarSeed = (regNo: string, variant: number) => {
  let h = 0x811c9dc5;
  for (const ch of `${regNo}:${variant}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `a${h.toString(36)}`;
};

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
  game: GameSettings;
  custom: CustomQuestion[];
  teamOverrides: Record<string, number>;
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
  game: GameSettings;
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
    game: room.game ?? { mode: "classic", leaderboard: true, teams: 0 },
  };
}

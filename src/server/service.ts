import { buildSlots, estimateSeconds, TOPIC_BY_ID } from "@/engine/catalog";
import {
  DEFAULT_SCORING,
  roomPhase,
  type Attempt,
  type AttemptItemServer,
  type AttemptPublic,
  type AttemptSummary,
  type IntegrityEvent,
  type IntegrityType,
  type Room,
  type ScoringConfig,
} from "@/engine/model";
import { TEMPLATES } from "@/engine/registry";
import { Rng } from "@/engine/rng";
import type { Difficulty } from "@/engine/types";
import { roomCode, safeEqual, seedFor, sha256, token } from "./crypto";
import { store } from "./store";

const TTL = 60 * 60 * 24 * 21; // 21 days

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const kRoom = (code: string) => `room:${code}`;
const kRoster = (code: string) => `room:${code}:roster`;
const kAttempt = (code: string, reg: string) => `att:${code}:${reg}`;
const kUsed = (code: string, slot: number) => `room:${code}:used:${slot}`;

export function normCode(code: unknown): string {
  const c = String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (c.length !== 6) throw new HttpError(400, "Room codes have 6 characters.");
  return c;
}

export function normReg(reg: unknown): string {
  const r = String(reg ?? "").toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9]{6,20}$/.test(r)) throw new HttpError(400, "Enter your register number (letters and digits only, e.g. RA2311003010123).");
  return r;
}

function cleanName(name: unknown): string {
  const n = String(name ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (n.length < 2) throw new HttpError(400, "Enter your name as it appears on the attendance list.");
  return n;
}

// ───────────────────────── Rooms ─────────────────────────

export interface CreateRoomInput {
  title?: string;
  section?: string;
  topics: string[];
  mix: Record<Difficulty, number>;
  durationMode: Room["durationMode"];
  customMinutes?: number;
  lateMode: Room["late"]["mode"];
  graceMin?: number;
  feedback: Room["feedback"];
}

export async function createRoom(input: CreateRoomInput) {
  const topics = (input.topics ?? []).filter((t) => TOPIC_BY_ID[t]);
  if (topics.length === 0) throw new HttpError(400, "Choose at least one topic.");
  const mix = {
    easy: clampInt(input.mix?.easy, 0, 10),
    medium: clampInt(input.mix?.medium, 0, 10),
    hard: clampInt(input.mix?.hard, 0, 10),
  };
  const slots = buildSlots(topics, mix);
  if (slots.length === 0) throw new HttpError(400, "Add at least one question.");
  if (slots.length > 15) throw new HttpError(400, "Keep a room to 15 questions or fewer.");
  const estimatedSec = estimateSeconds(slots);
  const mode = input.durationMode === "1.5" || input.durationMode === "custom" ? input.durationMode : "1.25";
  const durationSec =
    mode === "custom" ? clampInt(input.customMinutes, 5, 240) * 60 : Math.ceil((estimatedSec * Number(mode)) / 60) * 60;
  const hostKey = token(24);
  let code = roomCode();
  for (let i = 0; i < 10 && (await store().get(kRoom(code))); i++) code = roomCode();
  const room: Room = {
    code,
    title: String(input.title ?? "").trim().slice(0, 80) || "Class quiz",
    section: String(input.section ?? "").trim().slice(0, 30),
    createdAt: Date.now(),
    hostKeyHash: sha256(hostKey),
    topics,
    mix,
    slots,
    estimatedSec,
    durationMode: mode,
    durationSec,
    late: {
      mode: input.lateMode === "penalise" || input.lateMode === "lock" ? input.lateMode : "flag",
      graceMin: clampInt(input.graceMin ?? 10, 0, 60),
    },
    feedback: input.feedback === "checkpoint" ? "checkpoint" : "binary",
    maxChecks: 4,
    scoring: {
      ...DEFAULT_SCORING,
      late: { ...DEFAULT_SCORING.late, mode: input.lateMode === "penalise" ? "penalise" : "none" },
    },
    excused: {},
  };
  await store().set(kRoom(code), room, TTL);
  return { code, hostKey };
}

export async function getRoom(code: string): Promise<Room> {
  const room = await store().get<Room>(kRoom(code));
  if (!room) throw new HttpError(404, "No room with that code. Check the code on the projector.");
  return room;
}

export async function hostRoom(code: string, hostKey: string | null): Promise<Room> {
  const room = await getRoom(code);
  if (!hostKey || !safeEqual(sha256(hostKey), room.hostKeyHash)) throw new HttpError(403, "This browser does not hold the host key for this room.");
  return room;
}

export async function hostAction(room: Room, body: any) {
  const now = Date.now();
  switch (body?.action) {
    case "start": {
      if (room.startAt) throw new HttpError(409, "The room has already started.");
      room.startAt = now;
      room.endAt = now + room.durationSec * 1000;
      break;
    }
    case "extend": {
      if (!room.endAt) throw new HttpError(409, "Start the room first.");
      const min = clampInt(body.minutes, 1, 60);
      room.endAt = Math.max(room.endAt, now) + min * 60_000;
      room.durationSec += min * 60;
      delete room.endedEarlyAt;
      break;
    }
    case "end": {
      if (!room.startAt) throw new HttpError(409, "The room has not started.");
      room.endedEarlyAt = now;
      if (room.endAt && room.endAt > now) room.endAt = now;
      break;
    }
    case "scoring": {
      room.scoring = sanitizeScoring(body.scoring);
      break;
    }
    case "excuse": {
      const reg = normReg(body.reg);
      const id = String(body.eventId ?? "");
      const list = new Set(room.excused[reg] ?? []);
      if (body.undo) list.delete(id);
      else list.add(id);
      room.excused[reg] = [...list];
      break;
    }
    default:
      throw new HttpError(400, "Unknown action.");
  }
  await store().set(kRoom(room.code), room, TTL);
  return room;
}

function sanitizeScoring(s: any): ScoringConfig {
  const n = (x: unknown, lo: number, hi: number, dflt: number) => {
    const v = Number(x);
    return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
  };
  const d = DEFAULT_SCORING;
  return {
    weights: { easy: n(s?.weights?.easy, 0, 10, 1), medium: n(s?.weights?.medium, 0, 10, 2), hard: n(s?.weights?.hard, 0, 10, 3) },
    efficiency: {
      enabled: Boolean(s?.efficiency?.enabled ?? d.efficiency.enabled),
      time: n(s?.efficiency?.time, 0, 1, d.efficiency.time),
      moves: n(s?.efficiency?.moves, 0, 1, d.efficiency.moves),
      wrong: n(s?.efficiency?.wrong, 0, 1, d.efficiency.wrong),
      bonus: Boolean(s?.efficiency?.bonus ?? d.efficiency.bonus),
    },
    integrity: {
      mode: s?.integrity?.mode === "advisory" ? "advisory" : "enforced",
      floor: n(s?.integrity?.floor, 0, 1, d.integrity.floor),
      scale: n(s?.integrity?.scale, 0, 3, d.integrity.scale),
    },
    late: {
      mode: s?.late?.mode === "penalise" ? "penalise" : "none",
      ratePct: n(s?.late?.ratePct, 0, 50, 2),
      stepMin: n(s?.late?.stepMin, 1, 60, 5),
      capPct: n(s?.late?.capPct, 0, 100, 30),
    },
    maxMarks: n(s?.maxMarks, 1, 100, 10),
    rounding: n(s?.rounding, 0, 5, 0.5),
  };
}

function clampInt(x: unknown, lo: number, hi: number) {
  const v = Math.round(Number(x));
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
}

// ───────────────────────── Attempts ─────────────────────────

async function buildItems(room: Room, reg: string): Promise<AttemptItemServer[]> {
  const items: AttemptItemServer[] = [];
  for (let slot = 0; slot < room.slots.length; slot++) {
    const s = room.slots[slot]!;
    const topic = TOPIC_BY_ID[s.topicId]!;
    const tpl = TEMPLATES[topic.template];
    let params = tpl.generate(new Rng(seedFor(room.code, reg, slot, 0)), s.difficulty);
    // Room-level uniqueness: retry with fresh seeds until this instance is unused in this room.
    for (let n = 1; n <= 12; n++) {
      if (await store().sadd(kUsed(room.code, slot), tpl.key(params), TTL)) break;
      params = tpl.generate(new Rng(seedFor(room.code, reg, slot, n)), s.difficulty);
    }
    const solution = tpl.solve(params);
    const cps = tpl.checkpoints(params);
    items.push({
      index: 0,
      slot,
      topicId: topic.id,
      templateId: topic.template,
      difficulty: s.difficulty,
      title: topic.title,
      expectedSec: topic.expected[s.difficulty],
      optimalMoves: tpl.optimalMoves(params, solution),
      checkpoints: cps,
      view: tpl.view(params),
      cp: Object.fromEntries(cps.map((c) => [c.id, { score: 0, checks: 0, wrong: 0, correct: false, locked: false, misconceptions: [] }])),
      stats: { activeMs: 0, moves: 0, undos: 0, resets: 0, maxOscillation: 0, checkLog: [] },
      submitted: false,
      params,
      solution,
      key: tpl.key(params),
    });
  }
  // Per-student question order.
  const order = new Rng(seedFor(room.code, reg, "order")).shuffle(items);
  order.forEach((it, i) => (it.index = i));
  return order;
}

export async function join(code: string, regRaw: unknown, nameRaw: unknown, device: string) {
  const room = await getRoom(code);
  const reg = normReg(regRaw);
  const now = Date.now();
  if (roomPhase(room, now) === "closed") throw new HttpError(410, "This room has closed.");
  const existing = await store().get<Attempt>(kAttempt(code, reg));
  if (existing) {
    // Re-join (refresh, browser crash, switching laptop). New token; the old device loses access.
    if (now - existing.lastSeen < 20_000 && existing.status !== "submitted") {
      existing.integrity.push({ id: token(6), type: "multi_session", at: now });
    }
    existing.token = token();
    existing.sessions += 1;
    existing.device = device.slice(0, 160);
    existing.lastSeen = now;
    await saveAttempt(existing);
    return { attempt: existing, room };
  }
  const name = cleanName(nameRaw);
  const attempt: Attempt = {
    code,
    regNo: reg,
    name,
    token: token(),
    joinedAt: now,
    status: "lobby",
    integrity: [],
    lastSeen: now,
    fullscreen: false,
    visible: true,
    sessions: 1,
    device: device.slice(0, 160),
    items: await buildItems(room, reg),
  };
  await saveAttempt(attempt);
  await store().sadd(kRoster(code), reg, TTL);
  return { attempt, room };
}

async function saveAttempt(a: Attempt) {
  await store().set(kAttempt(a.code, a.regNo), a, TTL);
}

/** Auto-submit attempts once a room is closed (hard lock, grace over, or ended by the teacher). */
function settle(a: Attempt | AttemptSummary, room: Room, now: number): boolean {
  if (a.status === "submitted") return false;
  if (roomPhase(room, now) !== "closed") return false;
  const closeAt = room.endedEarlyAt ?? (room.late.mode === "lock" ? room.endAt! : room.endAt! + room.late.graceMin * 60_000);
  a.status = "submitted";
  a.submittedAt = Math.min(now, closeAt);
  return true;
}

export async function loadAttempt(code: string, regRaw: unknown, tok: string | null) {
  const reg = normReg(regRaw);
  const [room, a] = await Promise.all([getRoom(code), store().get<Attempt>(kAttempt(code, reg))]);
  if (!a) throw new HttpError(404, "Join the room first.");
  if (!tok || !safeEqual(tok, a.token)) throw new HttpError(401, "This session was replaced by a newer login for the same register number.");
  if (settle(a, room, Date.now())) await saveAttempt(a);
  return { room, attempt: a };
}

export function toPublic(a: Attempt): AttemptPublic {
  const { token: _t, items, ...rest } = a;
  return { ...rest, items: items.map(({ params: _p, solution: _s, key: _k, ...it }) => it) };
}

export function toSummary(a: Attempt): AttemptSummary {
  const { token: _t, items, ...rest } = a;
  return { ...rest, items: items.map(({ params: _p, solution: _s, key: _k, view: _v, ...it }) => it) };
}

function requireLive(room: Room) {
  const ph = roomPhase(room, Date.now());
  if (ph === "waiting") throw new HttpError(409, "The teacher has not started the room yet.");
  if (ph === "closed") throw new HttpError(410, "This room has closed. Your work was submitted.");
}

export async function begin(code: string, reg: unknown, tok: string | null) {
  const { room, attempt } = await loadAttempt(code, reg, tok);
  requireLive(room);
  if (attempt.status === "lobby") {
    attempt.status = "active";
    attempt.startedAt = Date.now();
  }
  attempt.fullscreen = true;
  attempt.lastSeen = Date.now();
  await saveAttempt(attempt);
  return { room, attempt };
}

interface StatsDelta {
  activeMs?: number;
  moves?: number;
  undos?: number;
  resets?: number;
  maxOscillation?: number;
}

function applyStats(a: Attempt, stats: Record<string, StatsDelta> | undefined) {
  if (!stats || typeof stats !== "object") return;
  for (const [k, v] of Object.entries(stats)) {
    const it = a.items[Number(k)];
    if (!it || it.submitted || !v) continue;
    const mono = (cur: number, nxt: unknown, cap: number) => {
      const x = Number(nxt);
      return Number.isFinite(x) ? Math.min(cap, Math.max(cur, Math.round(x))) : cur;
    };
    it.stats.activeMs = mono(it.stats.activeMs, v.activeMs, 6 * 3600 * 1000);
    it.stats.moves = mono(it.stats.moves, v.moves, 100_000);
    it.stats.undos = mono(it.stats.undos, v.undos, 100_000);
    it.stats.resets = mono(it.stats.resets, v.resets, 10_000);
    it.stats.maxOscillation = mono(it.stats.maxOscillation, v.maxOscillation, 1000);
  }
}

export async function sync(code: string, reg: unknown, tok: string | null, body: any) {
  const { room, attempt } = await loadAttempt(code, reg, tok);
  if (attempt.status !== "submitted") applyStats(attempt, body?.stats);
  attempt.fullscreen = Boolean(body?.fullscreen);
  attempt.visible = body?.visible !== false;
  attempt.lastSeen = Date.now();
  await saveAttempt(attempt);
  return { room, attempt };
}

const INTEGRITY_TYPES: IntegrityType[] = [
  "fullscreen_exit",
  "tab_hidden",
  "window_blur",
  "devtools_suspected",
  "clipboard_attempt",
  "context_menu",
  "print_attempt",
  "multi_session",
];

export async function addEvents(code: string, reg: unknown, tok: string | null, events: unknown) {
  const { room, attempt } = await loadAttempt(code, reg, tok);
  if (!Array.isArray(events)) throw new HttpError(400, "Bad events.");
  if (attempt.status !== "active") return { room, attempt };
  const now = Date.now();
  for (const e of events.slice(0, 50)) {
    if (!INTEGRITY_TYPES.includes(e?.type) || e.type === "multi_session") continue;
    const ev: IntegrityEvent = {
      id: token(6),
      type: e.type,
      at: Math.min(now, Number(e.at) || now),
      durationMs: Number.isFinite(Number(e.durationMs)) ? Math.max(0, Math.min(3_600_000, Number(e.durationMs))) : undefined,
      itemIndex: Number.isInteger(e.itemIndex) ? e.itemIndex : undefined,
    };
    attempt.integrity.push(ev);
  }
  if (attempt.integrity.length > 400) attempt.integrity = attempt.integrity.slice(-400);
  attempt.lastSeen = now;
  await saveAttempt(attempt);
  return { room, attempt };
}

export async function check(code: string, reg: unknown, tok: string | null, body: any) {
  const { room, attempt } = await loadAttempt(code, reg, tok);
  requireLive(room);
  if (attempt.status !== "active") throw new HttpError(409, "Your attempt is not active.");
  const item = attempt.items[Number(body?.itemIndex)];
  if (!item) throw new HttpError(400, "Unknown question.");
  if (item.submitted) throw new HttpError(409, "This question was already submitted.");
  const cpId = String(body?.checkpointId ?? "");
  const cp = item.cp[cpId];
  if (!cp) throw new HttpError(400, "Unknown checkpoint.");
  if (cp.locked) throw new HttpError(409, "This checkpoint is locked.");
  const now = Date.now();
  const last = item.stats.checkLog[item.stats.checkLog.length - 1];
  if (last && now - last.at < 1200) throw new HttpError(429, "Wait a moment before checking again.");
  applyStats(attempt, body?.stats);

  const tpl = TEMPLATES[item.templateId as keyof typeof TEMPLATES];
  const res = tpl.grade(item.params as any, item.solution, cpId, body?.response);
  const score = Math.max(0, Math.min(1, res.score));
  cp.checks += 1;
  if (score < 1) cp.wrong += 1;
  cp.score = score;
  cp.correct = score >= 0.9999;
  cp.misconceptions = [...new Set([...cp.misconceptions, ...res.misconceptions])].slice(0, 12);
  if (cp.correct || cp.checks >= room.maxChecks) cp.locked = true;
  item.stats.checkLog.push({ at: now, moves: item.stats.moves, correct: cp.correct });
  if (item.stats.checkLog.length > 60) item.stats.checkLog = item.stats.checkLog.slice(-60);
  attempt.lastSeen = now;
  await saveAttempt(attempt);
  return {
    attempt,
    verdict: {
      checkpointId: cpId,
      status: cp.correct ? "correct" : score > 0 && room.feedback === "checkpoint" ? "partial" : "incorrect",
      score: room.feedback === "checkpoint" ? score : undefined,
      fields: room.feedback === "checkpoint" ? res.fields : undefined,
      checks: cp.checks,
      wrong: cp.wrong,
      checksLeft: Math.max(0, room.maxChecks - cp.checks),
      locked: cp.locked,
    },
  };
}

export async function submit(code: string, reg: unknown, tok: string | null, body: any) {
  const { room, attempt } = await loadAttempt(code, reg, tok);
  if (attempt.status === "submitted") return { room, attempt };
  applyStats(attempt, body?.stats);
  if (body?.finish) {
    attempt.items.forEach((it) => (it.submitted = true));
    attempt.status = "submitted";
    attempt.submittedAt = Date.now();
  } else {
    const it = attempt.items[Number(body?.itemIndex)];
    if (!it) throw new HttpError(400, "Unknown question.");
    it.submitted = true;
    Object.values(it.cp).forEach((c) => (c.locked = true));
  }
  await saveAttempt(attempt);
  return { room, attempt };
}

// ───────────────────────── Teacher views ─────────────────────────

export async function roster(room: Room) {
  const regs = await store().smembers(kRoster(room.code));
  const attempts = (await store().mget<Attempt>(regs.map((r) => kAttempt(room.code, r)))).filter(Boolean) as Attempt[];
  const now = Date.now();
  return attempts.map((a) => {
    const s = toSummary(a);
    settle(s, room, now);
    return s;
  });
}

/** Full detail for one student, including solutions, for the teacher's review drawer. */
export async function attemptDetail(room: Room, regRaw: unknown) {
  const reg = normReg(regRaw);
  const a = await store().get<Attempt>(kAttempt(room.code, reg));
  if (!a) throw new HttpError(404, "No such student in this room.");
  const { token: _t, ...rest } = a;
  return rest;
}

export function storeKind() {
  return store().kind;
}

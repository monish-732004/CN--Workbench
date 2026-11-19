import { randomInt } from "node:crypto";
import {
  avatarSeed,
  TEAMS,
  type Attempt,
  type AttemptItemServer,
  type Board,
  type BoardRow,
  type ChestOutcome,
  type CpState,
  type FeedEvent,
  type Room,
  type TeamRow,
} from "@/engine/model";
import type { Difficulty } from "@/engine/types";
import { store } from "./store";

/**
 * Game layer. Points live in a Redis hash (atomic increments, cheap to read for leaderboards).
 * They are separate from marks: marks come only from the scoring engine.
 */
const TTL = 60 * 60 * 24 * 21;
export const kPts = (code: string) => `room:${code}:pts`;
export const kMeta = (code: string) => `room:${code}:meta`;
export const kFeed = (code: string) => `room:${code}:feed`;
export const kSeq = (code: string) => `room:${code}:seq`;

const DIFF_MULT: Record<Difficulty, number> = { easy: 1, medium: 1.5, hard: 2 };
const TRY_FACTOR = [1, 0.7, 0.45, 0.25];

export interface Meta {
  name: string;
  avatar: string;
  team: number | null;
  done: number;
  total: number;
  finishedAt?: number;
}

export function emptyGame() {
  return { streak: 0, best: 0, multNext: 1, byItem: {}, log: [] };
}

/** Upgrades attempts created before the game layer existed. */
export function ensureGame(a: Attempt) {
  if (!a.game) a.game = emptyGame();
  if (a.avatar === undefined) a.avatar = 0;
  if (a.team === undefined) a.team = null;
  if (a.chestPending === undefined) a.chestPending = false;
}

export function metaOf(a: Attempt): Meta {
  const total = a.items.reduce((s, it) => s + it.checkpoints.length, 0);
  const done = a.items.reduce((s, it) => s + Object.values(it.cp).filter((c) => c.correct).length, 0);
  return { name: a.name, avatar: avatarSeed(a.regNo, a.avatar), team: a.team, done, total, finishedAt: a.status === "submitted" ? a.submittedAt : undefined };
}

export async function writeMeta(a: Attempt) {
  await store().hset(kMeta(a.code), a.regNo, JSON.stringify(metaOf(a)), TTL);
}

export interface Award {
  points: number;
  parts: string[];
  streak: number;
  total: number;
}

/** Points for one check. Called after the checkpoint state is updated. */
export async function awardCheck(room: Room, a: Attempt, item: AttemptItemServer, cpId: string, cp: CpState, score: number, wrongBefore: number): Promise<Award | null> {
  const def = item.checkpoints.find((c) => c.id === cpId)!;
  const wsum = item.checkpoints.reduce((s, c) => s + c.weight, 0) || 1;
  const base = 1000 * DIFF_MULT[item.difficulty] * (def.weight / wsum);
  const g = a.game;
  let pts = 0;
  const parts: string[] = [];
  if (cp.correct) {
    const tryF = TRY_FACTOR[Math.min(3, wrongBefore)]!;
    const t = item.stats.activeMs / 1000;
    const speedF = t <= item.expectedSec * 0.5 ? 1.2 : t <= item.expectedSec ? 1.1 : 1;
    g.streak = wrongBefore === 0 ? g.streak + 1 : 0;
    g.best = Math.max(g.best, g.streak);
    const streakF = g.streak >= 2 ? 1 + Math.min(0.5, 0.1 * (g.streak - 1)) : 1;
    const mult = g.multNext || 1;
    g.multNext = 1;
    pts = Math.round(base * tryF * speedF * streakF * mult);
    parts.push(`Base ${Math.round(base)}`);
    parts.push(wrongBefore === 0 ? "First try" : `Try ${wrongBefore + 1} ×${tryF}`);
    if (speedF > 1) parts.push(`Fast +${Math.round((speedF - 1) * 100)}%`);
    if (streakF > 1) parts.push(`Streak ${g.streak} ×${streakF.toFixed(1)}`);
    if (mult > 1) parts.push(`Double ×${mult}`);
    if (g.streak === 5 || g.streak === 10) await pushFeed(room.code, { at: Date.now(), kind: "streak", text: `${a.name} is on a ${g.streak}-step streak` });
  } else {
    g.streak = 0;
    if (cp.locked && score > 0) {
      pts = Math.round(base * score * 0.25);
      parts.push(`Partial ${Math.round(score * 100)}%`);
    }
  }
  if (pts === 0) {
    await writeMeta(a);
    return { points: 0, parts, streak: g.streak, total: await pointsOf(a) };
  }
  g.byItem[item.index] = (g.byItem[item.index] ?? 0) + pts;
  g.log.push({ at: Date.now(), item: item.index, cp: cpId, pts, parts });
  if (g.log.length > 80) g.log = g.log.slice(-80);
  const total = await store().hincrby(kPts(a.code), a.regNo, pts, TTL);
  await writeMeta(a);
  return { points: pts, parts, streak: g.streak, total };
}

export async function pointsOf(a: Attempt) {
  const all = await store().hgetall(kPts(a.code));
  return Number(all[a.regNo] ?? 0);
}

async function pushFeed(code: string, e: FeedEvent) {
  await store().lpush(kFeed(code), JSON.stringify(e), 40, TTL);
}

// ───────── Gold rush chests ─────────
const CHEST_TABLE: { o: ChestOutcome; w: number }[] = [
  { o: { kind: "gain", value: 150, label: "+150 points" }, w: 26 },
  { o: { kind: "gain", value: 300, label: "+300 points" }, w: 20 },
  { o: { kind: "gain", value: 600, label: "+600 points" }, w: 9 },
  { o: { kind: "pct", value: 0.25, label: "+25% of your points" }, w: 9 },
  { o: { kind: "mult", value: 2, label: "Double your next step" }, w: 12 },
  { o: { kind: "steal", value: 0.15, label: "Steal 15% from a rival" }, w: 10 },
  { o: { kind: "lose", value: 0.1, label: "Lose 10%" }, w: 8 },
  { o: { kind: "nothing", value: 0, label: "Empty chest" }, w: 6 },
];

function rollOutcome(): ChestOutcome {
  const total = CHEST_TABLE.reduce((s, x) => s + x.w, 0);
  let r = randomInt(total);
  for (const x of CHEST_TABLE) {
    if (r < x.w) return { ...x.o };
    r -= x.w;
  }
  return { ...CHEST_TABLE[0]!.o };
}

export function offerChest(a: Attempt) {
  a.chest = { id: Math.random().toString(36).slice(2, 10), outcomes: [rollOutcome(), rollOutcome(), rollOutcome()] };
  a.chestPending = true;
}

export async function openChest(room: Room, a: Attempt, choice: number) {
  const chest = a.chest!;
  const o = chest.outcomes[Math.max(0, Math.min(2, choice))]!;
  const mine = await pointsOf(a);
  let delta = 0;
  let detail = o.label;
  if (o.kind === "gain") delta = o.value;
  else if (o.kind === "pct") delta = Math.round(mine * o.value);
  else if (o.kind === "lose") delta = -Math.round(mine * o.value);
  else if (o.kind === "mult") a.game.multNext = o.value;
  else if (o.kind === "steal") {
    const pts = await store().hgetall(kPts(room.code));
    const meta = await store().hgetall(kMeta(room.code));
    const rivals = Object.entries(pts)
      .filter(([reg, v]) => reg !== a.regNo && Number(v) > 0)
      .sort((x, y) => Number(y[1]) - Number(x[1]))
      .slice(0, 5);
    if (rivals.length) {
      const [victim, vp] = rivals[randomInt(rivals.length)]!;
      const amount = Math.max(1, Math.min(1500, Math.round(Number(vp) * o.value)));
      await store().hincrby(kPts(room.code), victim, -amount, TTL);
      delta = amount;
      const vname = (JSON.parse(meta[victim] ?? "{}") as Meta).name ?? "a rival";
      detail = `Stole ${amount} from ${vname}`;
      await pushFeed(room.code, { at: Date.now(), kind: "steal", text: `${a.name} stole ${amount} from ${vname}`, to: victim });
    } else detail = "No one to steal from yet";
  }
  const total = delta ? await store().hincrby(kPts(room.code), a.regNo, delta, TTL) : mine;
  a.chest = undefined;
  a.chestPending = false;
  if (delta) {
    a.game.log.push({ at: Date.now(), item: -1, cp: "chest", pts: delta, parts: [detail] });
    if (a.game.log.length > 80) a.game.log = a.game.log.slice(-80);
  }
  return { outcomes: chest.outcomes, chosen: choice, delta, detail, total };
}

export async function recordFinish(room: Room, a: Attempt) {
  await writeMeta(a);
  if (room.game?.mode === "race") {
    const meta = await store().hgetall(kMeta(room.code));
    const finished = Object.values(meta).filter((m) => (JSON.parse(m) as Meta).finishedAt).length;
    if (finished <= 3) await pushFeed(room.code, { at: Date.now(), kind: "finish", text: `${a.name} finished ${["first", "second", "third"][finished - 1] ?? ""}` });
  }
}

// ───────── Leaderboards ─────────
export async function computeBoard(room: Room, meReg: string | null, opts: { full?: boolean } = {}): Promise<Board & { all?: (BoardRow & { reg: string })[] }> {
  const [pts, meta, feedRaw] = await Promise.all([store().hgetall(kPts(room.code)), store().hgetall(kMeta(room.code)), store().lrange(kFeed(room.code), 0, 11)]);
  const mode = room.game?.mode ?? "classic";
  const rows = Object.entries(meta).map(([reg, json]) => {
    const m = JSON.parse(json) as Meta;
    const team = room.teamOverrides?.[reg] ?? m.team;
    return { reg, name: m.name, avatar: m.avatar, team, points: Number(pts[reg] ?? 0), progress: m.total ? m.done / m.total : 0, finished: !!m.finishedAt, finishedAt: m.finishedAt ?? Infinity };
  });
  rows.sort((a, b) =>
    mode === "race" ? b.progress - a.progress || a.finishedAt - b.finishedAt || b.points - a.points : b.points - a.points || b.progress - a.progress || a.name.localeCompare(b.name),
  );
  const ranked = rows.map((r, i) => ({ rank: i + 1, reg: r.reg, name: r.name, avatar: r.avatar, team: r.team, points: r.points, progress: r.progress, finished: r.finished }));
  const strip = ({ reg: _r, ...x }: (typeof ranked)[number], me: boolean): BoardRow => ({ ...x, me: me || undefined });
  const teams: TeamRow[] = [];
  if (room.game?.teams) {
    for (let i = 0; i < room.game.teams; i++) {
      const members = ranked.filter((r) => r.team === i);
      const total = members.reduce((s, r) => s + r.points, 0);
      teams.push({
        index: i,
        name: TEAMS[i]!.name,
        color: TEAMS[i]!.color,
        members: members.length,
        total,
        points: members.length ? Math.round(total / members.length) : 0,
        progress: members.length ? members.reduce((s, r) => s + r.progress, 0) / members.length : 0,
      });
    }
    teams.sort((a, b) => (mode === "race" ? b.progress - a.progress : b.points - a.points) || b.total - a.total);
  }
  const feed = feedRaw.map((f) => JSON.parse(f) as FeedEvent);
  const meRow = meReg ? ranked.find((r) => r.reg === meReg) : undefined;
  const hidden = !opts.full && room.game?.leaderboard === false;
  return {
    mode,
    hidden,
    players: ranked.length,
    top: hidden ? [] : ranked.slice(0, 10).map((r) => strip(r, r.reg === meReg)),
    me: meRow ? strip(meRow, true) : null,
    teams: hidden ? [] : teams,
    feed: hidden ? [] : feed.map((f) => ({ ...f, to: f.to === meReg ? "me" : undefined })),
    all: opts.full ? ranked : undefined,
  };
}

import type { AttemptSummary, Board, Room, RoomPhase } from "@/engine/model";
import { scoreAttempt, type AttemptScore } from "@/engine/scoring";
import type { ScoringConfig } from "@/engine/model";
import type { Presence } from "../Avatar";

export type HostRoom = Omit<Room, "hostKeyHash"> & { phase: RoomPhase; serverNow: number };

export interface HostData {
  room: HostRoom;
  attempts: AttemptSummary[];
  storage: "redis" | "memory";
  board?: Board;
  points?: Record<string, { points: number; rank: number }>;
}

export interface Scored {
  a: AttemptSummary;
  s: AttemptScore;
  presence: Presence;
  outOfFullscreen: boolean;
}

export function scoreAll(data: HostData, cfg: ScoringConfig, now: number): Scored[] {
  const endAt = data.room.endedEarlyAt ?? data.room.endAt;
  return data.attempts.map((a) => {
    const s = scoreAttempt(a, { endAt, excused: data.room.excused[a.regNo], cfg, now });
    const online = now - a.lastSeen < 15_000;
    const presence: Presence = a.status === "submitted" ? "done" : !online ? "offline" : a.status === "active" && (!a.fullscreen || !a.visible) ? "away" : "online";
    return { a, s, presence, outOfFullscreen: a.status === "active" && online && (!a.fullscreen || !a.visible) };
  });
}

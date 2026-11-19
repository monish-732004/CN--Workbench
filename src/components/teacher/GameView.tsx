"use client";

import { Eye, EyeOff } from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import { useMemo } from "react";
import { avatarSeed, GAME_MODES, TEAMS } from "@/engine/model";
import { Avatar } from "../Avatar";
import { BoardPanel, CountUp, MEDAL, RankBadge } from "../play/game";
import { Button, cx, EmptyState, Panel } from "../ui";
import type { HostData, Scored } from "./types";

export function GameView({ data, scored, onAction }: { data: HostData; scored: Scored[]; onAction: (body: Record<string, unknown>, label: string) => void }) {
  const game = data.room.game;
  const rows = useMemo(
    () =>
      scored
        .map((x) => ({ x, p: data.points?.[x.a.regNo] ?? { points: 0, rank: 9999 } }))
        .sort((a, b) => a.p.rank - b.p.rank || a.x.a.name.localeCompare(b.x.a.name)),
    [scored, data.points],
  );
  const board = data.board ? { ...data.board, me: null } : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-bg-1 px-4 py-3">
        <div>
          <p className="text-[12px] text-fg-3">Mode</p>
          <p className="text-[14px] font-semibold">{GAME_MODES[game.mode].label}</p>
        </div>
        <span className="h-8 w-px bg-line" />
        <div>
          <p className="text-[12px] text-fg-3">Teams</p>
          <p className="text-[14px] font-semibold">{game.teams ? `${game.teams} teams` : "Individual"}</p>
        </div>
        <span className="h-8 w-px bg-line" />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-fg-3">Student leaderboard</p>
          <p className="text-[13px]">{game.leaderboard ? "Visible to students: top 10, own rank and teams." : "Hidden. Students see only their own points."}</p>
        </div>
        <Button variant="secondary" onClick={() => onAction({ action: "leaderboard", visible: !game.leaderboard }, "leaderboard")}>
          {game.leaderboard ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
          {game.leaderboard ? "Hide from students" : "Show to students"}
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(420px,1.4fr)_minmax(340px,1fr)]">
        <Panel title={`Points · ${rows.length}`} actions={<span className="text-[11px] text-fg-3">Game points, separate from marks</span>} className="h-[calc(100dvh-330px)] min-h-[420px]" bodyClass="overflow-auto">
          {rows.length === 0 ? (
            <EmptyState>Points appear as students verify steps.</EmptyState>
          ) : (
            <LayoutGroup>
              <ul>
                {rows.map(({ x, p }) => {
                  const team = x.a.team !== null && x.a.team !== undefined ? TEAMS[x.a.team] : null;
                  const done = x.a.items.filter((i) => i.submitted).length;
                  return (
                    <motion.li
                      layout="position"
                      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                      key={x.a.regNo}
                      className="flex items-center gap-3 border-b border-line px-3 py-2"
                      style={p.rank <= 3 ? { boxShadow: `inset 3px 0 0 ${MEDAL[p.rank - 1]}` } : undefined}
                    >
                      {p.rank < 9999 ? <RankBadge rank={p.rank} /> : <span className="w-[22px]" />}
                      <Avatar seed={avatarSeed(x.a.regNo, x.a.avatar ?? 0)} size={28} presence={x.presence} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{x.a.name}</p>
                        <p className="mono tnum truncate text-[11px] text-fg-3">
                          {x.a.regNo} · {done}/{x.a.items.length} submitted
                          {x.a.game?.best ? ` · best streak ${x.a.game.best}` : ""}
                        </p>
                      </div>
                      {game.teams ? (
                        <label className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: team?.color ?? "var(--fg-3)" }} />
                          <select
                            aria-label={`Team for ${x.a.name}`}
                            value={x.a.team ?? 0}
                            onChange={(e) => onAction({ action: "team", reg: x.a.regNo, team: Number(e.target.value) }, "team")}
                            className="h-7 rounded-md border border-line-strong bg-bg-1 px-1.5 text-[12px]"
                          >
                            {TEAMS.slice(0, game.teams).map((t, i) => (
                              <option key={t.name} value={i}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      <CountUp value={p.points} className={cx("mono tnum w-20 text-right text-[14px]", p.rank <= 3 ? "font-semibold" : "font-medium")} />
                    </motion.li>
                  );
                })}
              </ul>
            </LayoutGroup>
          )}
        </Panel>
        <Panel title="What students see" className="h-[calc(100dvh-330px)] min-h-[420px]" bodyClass="overflow-auto p-3">
          <BoardPanel board={board ? { ...board, hidden: false } : null} title="Top 10" />
        </Panel>
      </div>
    </div>
  );
}

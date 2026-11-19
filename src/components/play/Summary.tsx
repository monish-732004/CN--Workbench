"use client";

import { AlertTriangle, CheckCircle2, Trophy } from "lucide-react";
import { motion } from "motion/react";
import { DIFFICULTY_LABEL } from "@/engine/catalog";
import { avatarSeed, INTEGRITY_LABEL, TEAMS, type AttemptPublic, type Board, type RoomPublic } from "@/engine/model";
import { itemAccuracy, TE_RULE_TEXT, trialAndError } from "@/engine/scoring";
import { clockTime, formatCode, mmss, pct } from "@/lib/format";
import { Avatar } from "../Avatar";
import { Meter, Tag } from "../ui";
import { BoardPanel, CountUp, MEDAL } from "./game";

export function Summary({ attempt, room, board }: { attempt: AttemptPublic; room: RoomPublic; board: Board | null }) {
  const me = board?.me ?? null;
  const team = attempt.team !== null && attempt.team !== undefined ? TEAMS[attempt.team] : null;
  const teamRank = board && team ? board.teams.findIndex((t) => t.index === attempt.team) + 1 : 0;
  const podium = board && !board.hidden ? board.top.slice(0, 3) : [];
  const items = attempt.items;
  const accs = items.map((it) => itemAccuracy(it));
  const overall = accs.reduce((a, b) => a + b, 0) / Math.max(1, accs.length);
  const late = attempt.submittedAt && room.endAt && attempt.submittedAt > room.endAt ? Math.round((attempt.submittedAt - room.endAt) / 1000) : 0;
  const events = attempt.integrity;
  return (
    <main className="mx-auto max-w-[920px] px-4 py-10">
      <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="rounded-lg border border-line bg-bg-1">
        <header className="flex flex-wrap items-center gap-4 border-b border-line px-6 py-5">
          <Avatar seed={avatarSeed(attempt.regNo, attempt.avatar ?? 0)} size={40} presence="done" />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">Submitted</p>
            <p className="text-[12px] text-fg-2">
              {attempt.name} · <span className="mono">{attempt.regNo}</span> · room <span className="mono">{formatCode(room.code)}</span>
              {attempt.submittedAt ? ` · ${clockTime(attempt.submittedAt)}` : ""}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {late ? <Tag tone="warn">Late by {mmss(late)}</Tag> : <Tag tone="ok">On time</Tag>}
          </div>
        </header>
        <div className="grid gap-px bg-line sm:grid-cols-3">
          <div className="bg-bg-1 px-6 py-4">
            <p className="text-[12px] text-fg-3">Accuracy</p>
            <p className="mono tnum mt-1 text-[24px] font-semibold">{pct(overall)}</p>
          </div>
          <div className="bg-bg-1 px-6 py-4">
            <p className="text-[12px] text-fg-3">Time on questions</p>
            <p className="mono tnum mt-1 text-[24px] font-semibold">{mmss(items.reduce((s, it) => s + it.stats.activeMs / 1000, 0))}</p>
          </div>
          <div className="bg-bg-1 px-6 py-4">
            <p className="text-[12px] text-fg-3">Recorded events</p>
            <p className="mono tnum mt-1 text-[24px] font-semibold">{events.length}</p>
          </div>
        </div>
        {me ? (
          <div className="border-t border-line px-6 py-5">
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <p className="flex items-center gap-1.5 text-[12px] text-fg-3">
                  <Trophy size={13} strokeWidth={1.5} /> Game points
                </p>
                <CountUp value={me.points} className="mono tnum mt-1 block text-[28px] font-semibold" />
              </div>
              {!board!.hidden ? (
                <div>
                  <p className="text-[12px] text-fg-3">Class rank</p>
                  <p className="mono tnum mt-1 text-[28px] font-semibold" style={{ color: MEDAL[me.rank - 1] }}>
                    #{me.rank}
                    <span className="text-[14px] font-normal text-fg-3"> of {board!.players}</span>
                  </p>
                </div>
              ) : null}
              {team && teamRank ? (
                <div>
                  <p className="text-[12px] text-fg-3">Team</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[16px] font-semibold">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: team.color }} />
                    {team.name}
                    <span className="mono tnum text-[13px] font-normal text-fg-2">
                      #{teamRank} of {board!.teams.length}
                    </span>
                  </p>
                </div>
              ) : null}
              <p className="ml-auto text-[11px] text-fg-3">Standings update live until the room closes.</p>
            </div>
            {podium.length ? (
              <div className="mt-6 flex items-end justify-center gap-3">
                {[1, 0, 2].map((pos) => {
                  const r = podium[pos];
                  if (!r) return <div key={pos} className="w-[120px]" />;
                  const h = [96, 72, 56][pos]!;
                  return (
                    <motion.div
                      key={pos}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + (2 - pos) * 0.12, type: "spring", stiffness: 260, damping: 24 }}
                      className="flex w-[120px] flex-col items-center"
                    >
                      <Avatar seed={r.avatar} size={pos === 0 ? 44 : 36} />
                      <p className={`mt-1.5 max-w-full truncate text-[12px] ${r.me ? "font-semibold text-signal" : "font-medium"}`}>{r.name}</p>
                      <p className="mono tnum text-[11px] text-fg-3">{r.points.toLocaleString("en-IN")}</p>
                      <div className="mt-2 flex w-full items-start justify-center rounded-t-md border border-b-0 border-line bg-bg-2 pt-2" style={{ height: h, boxShadow: `inset 0 3px 0 ${MEDAL[pos]}` }}>
                        <span className="mono tnum text-[18px] font-semibold" style={{ color: MEDAL[pos] }}>
                          {pos + 1}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : null}
            {board && !board.hidden ? (
              <div className="mx-auto mt-6 max-w-[520px]">
                <BoardPanel board={board} title="Top 10" />
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="border-t border-line px-6 py-4">
          <h2 className="text-[13px] font-semibold">Questions</h2>
          <table className="mt-2 w-full text-[13px]">
            <thead>
              <tr className="border-b border-line-strong text-left text-[11px] text-fg-2">
                <th className="py-1.5 pr-3 font-medium">Question</th>
                <th className="py-1.5 pr-3 font-medium">Level</th>
                <th className="w-40 py-1.5 pr-3 font-medium">Accuracy</th>
                <th className="py-1.5 pr-3 text-right font-medium">Time / expected</th>
                <th className="py-1.5 pr-3 text-right font-medium">Moves / optimal</th>
                <th className="py-1.5 font-medium">Process</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const te = trialAndError(it);
                return (
                  <tr key={i} className="border-b border-line last:border-b-0">
                    <td className="py-2 pr-3">
                      <span className="mono tnum mr-2 text-[11px] text-fg-3">{i + 1}</span>
                      {it.title}
                    </td>
                    <td className="py-2 pr-3 text-fg-2">{DIFFICULTY_LABEL[it.difficulty]}</td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <Meter value={accs[i]!} tone={accs[i]! >= 0.999 ? "ok" : undefined} className="w-20" />
                        <span className="mono tnum text-[12px]">{pct(accs[i]!, 0)}</span>
                      </div>
                    </td>
                    <td className="mono tnum py-2 pr-3 text-right">
                      {mmss(it.stats.activeMs / 1000)} <span className="text-fg-3">/ {mmss(it.expectedSec)}</span>
                    </td>
                    <td className="mono tnum py-2 pr-3 text-right">
                      {it.stats.moves} <span className="text-fg-3">/ {it.optimalMoves}</span>
                    </td>
                    <td className="py-2">
                      {te.length ? (
                        <span title={te.map((r) => TE_RULE_TEXT[r]).join("; ")}>
                          <Tag tone="warn" icon={<AlertTriangle size={11} strokeWidth={1.5} />}>
                            Trial-and-error
                          </Tag>
                        </span>
                      ) : accs[i]! >= 0.999 ? (
                        <Tag tone="ok" icon={<CheckCircle2 size={11} strokeWidth={1.5} />}>
                          Clean
                        </Tag>
                      ) : (
                        <span className="text-fg-3">–</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {events.length ? (
          <div className="border-t border-line px-6 py-4">
            <h2 className="text-[13px] font-semibold">What was recorded</h2>
            <ul className="mt-2 space-y-1 text-[13px]">
              {events.slice(-20).map((e) => (
                <li key={e.id} className="flex items-center gap-3">
                  <span className="mono tnum w-20 text-[12px] text-fg-3">{clockTime(e.at)}</span>
                  <span>{INTEGRITY_LABEL[e.type]}</span>
                  {e.durationMs ? <span className="mono tnum text-[12px] text-fg-3">{mmss(e.durationMs / 1000)}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <footer className="border-t border-line px-6 py-4 text-[12px] text-fg-3">Your teacher reviews these results and finalises the marks. You can close this window.</footer>
      </motion.section>
    </main>
  );
}

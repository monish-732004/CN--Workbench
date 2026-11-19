"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";
import { DIFFICULTY_LABEL } from "@/engine/catalog";
import { INTEGRITY_LABEL, type AttemptPublic, type RoomPublic } from "@/engine/model";
import { itemAccuracy, TE_RULE_TEXT, trialAndError } from "@/engine/scoring";
import { clockTime, formatCode, mmss, pct } from "@/lib/format";
import { Avatar } from "../Avatar";
import { Meter, Tag } from "../ui";

export function Summary({ attempt, room }: { attempt: AttemptPublic; room: RoomPublic }) {
  const items = attempt.items;
  const accs = items.map((it) => itemAccuracy(it));
  const overall = accs.reduce((a, b) => a + b, 0) / Math.max(1, accs.length);
  const late = attempt.submittedAt && room.endAt && attempt.submittedAt > room.endAt ? Math.round((attempt.submittedAt - room.endAt) / 1000) : 0;
  const events = attempt.integrity;
  return (
    <main className="mx-auto max-w-[920px] px-4 py-10">
      <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="rounded-lg border border-line bg-bg-1">
        <header className="flex flex-wrap items-center gap-4 border-b border-line px-6 py-5">
          <Avatar seed={attempt.regNo} size={40} presence="done" />
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

"use client";

import { AlertTriangle, Clipboard, Code2, Copy, EyeOff, Minimize2, MonitorOff, MousePointerClick, Printer, ShieldAlert, ShieldCheck } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useMemo, useState, type ReactNode } from "react";
import { avatarSeed, INTEGRITY_LABEL, type IntegrityType } from "@/engine/model";
import type { Tier } from "@/engine/scoring";
import { clockTime, mmss, pct, relTime } from "@/lib/format";
import { Avatar } from "../Avatar";
import { cx, EmptyState, Meter, Panel, Segmented, Tag } from "../ui";
import type { HostData, Scored } from "./types";

export const TIER_TAG: Record<Tier, ReactNode> = {
  clean: (
    <Tag tone="ok" icon={<ShieldCheck size={11} strokeWidth={1.5} />}>
      Clean
    </Tag>
  ),
  watch: (
    <Tag tone="warn" icon={<AlertTriangle size={11} strokeWidth={1.5} />}>
      Watch
    </Tag>
  ),
  flagged: (
    <Tag tone="bad" icon={<ShieldAlert size={11} strokeWidth={1.5} />}>
      Flagged
    </Tag>
  ),
};

export const EVENT_ICON: Record<IntegrityType, ReactNode> = {
  fullscreen_exit: <Minimize2 size={13} strokeWidth={1.5} />,
  tab_hidden: <EyeOff size={13} strokeWidth={1.5} />,
  window_blur: <MonitorOff size={13} strokeWidth={1.5} />,
  devtools_suspected: <Code2 size={13} strokeWidth={1.5} />,
  clipboard_attempt: <Clipboard size={13} strokeWidth={1.5} />,
  context_menu: <MousePointerClick size={13} strokeWidth={1.5} />,
  print_attempt: <Printer size={13} strokeWidth={1.5} />,
  multi_session: <Copy size={13} strokeWidth={1.5} />,
};

const SEVERE: IntegrityType[] = ["devtools_suspected", "multi_session"];

function statusTag(x: Scored) {
  if (x.a.status === "submitted") return x.s.lateSec ? <Tag tone="warn">Late {mmss(x.s.lateSec)}</Tag> : <Tag tone="signal">Submitted</Tag>;
  if (x.a.status === "lobby") return <Tag>Lobby</Tag>;
  if (x.outOfFullscreen) return <Tag tone="bad">Out of full screen</Tag>;
  if (x.presence === "offline") return <Tag tone="warn">Offline</Tag>;
  return <Tag tone="ok">Working</Tag>;
}

function byDifficulty(x: Scored) {
  const out: Record<string, number | null> = { easy: null, medium: null, hard: null };
  for (const d of ["easy", "medium", "hard"]) {
    const its = x.s.items.filter((i) => i.difficulty === d);
    out[d] = its.length ? its.reduce((s, i) => s + i.accuracy, 0) / its.length : null;
  }
  return out;
}

export function LiveView({ data, scored, now }: { data: HostData; scored: Scored[]; now: number; hostKey: string }) {
  const [rosterSort, setRosterSort] = useState<"name" | "progress" | "risk">("progress");
  const total = data.room.slots.length;
  const joined = scored.length;
  const working = scored.filter((x) => x.a.status === "active").length;
  const submitted = scored.filter((x) => x.a.status === "submitted").length;
  const flagged = scored.filter((x) => x.s.tier === "flagged").length;
  const outNow = scored.filter((x) => x.outOfFullscreen).length;
  const started = scored.filter((x) => x.s.items.some((i) => i.attempted));
  const avgAcc = started.length ? started.reduce((s, x) => s + x.s.accuracy, 0) / started.length : 0;

  const roster = useMemo(() => {
    const r = scored.slice();
    if (rosterSort === "name") r.sort((a, b) => a.a.name.localeCompare(b.a.name));
    else if (rosterSort === "risk") r.sort((a, b) => a.s.integrity - b.s.integrity || b.s.counts.total - a.s.counts.total);
    else r.sort((a, b) => b.a.items.filter((i) => i.submitted).length - a.a.items.filter((i) => i.submitted).length || b.s.accuracy - a.s.accuracy);
    return r;
  }, [scored, rosterSort]);

  const leaders = useMemo(() => scored.slice().sort((a, b) => b.s.score - a.s.score || b.s.accuracy - a.s.accuracy || a.s.timeSec - b.s.timeSec), [scored]);
  const risk = useMemo(
    () =>
      scored
        .filter((x) => x.s.counts.total > 0 || x.outOfFullscreen)
        .sort((a, b) => a.s.integrity - b.s.integrity || b.s.counts.total - a.s.counts.total),
    [scored],
  );
  const feed = useMemo(
    () =>
      scored
        .flatMap((x) => x.a.integrity.map((e) => ({ e, x })))
        .sort((p, q) => q.e.at - p.e.at)
        .slice(0, 40),
    [scored],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Joined" value={String(joined)} />
        <Stat label="Working" value={String(working)} />
        <Stat label="Submitted" value={`${submitted}`} sub={joined ? `/ ${joined}` : undefined} />
        <Stat label="Average accuracy" value={started.length ? pct(avgAcc) : "–"} />
        <Stat label="Out of full screen now" value={String(outNow)} tone={outNow ? "bad" : undefined} />
        <Stat label="Flagged" value={String(flagged)} tone={flagged ? "bad" : undefined} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(340px,1fr)_minmax(380px,1.15fr)_minmax(340px,1fr)]">
        <Panel
          title={`Roster · ${joined}`}
          actions={
            <Segmented
              size="sm"
              value={rosterSort}
              onChange={setRosterSort}
              options={[
                { value: "progress", label: "Progress" },
                { value: "risk", label: "Risk" },
                { value: "name", label: "Name" },
              ]}
            />
          }
          className="h-[calc(100dvh-270px)] min-h-[420px]"
          bodyClass="overflow-auto"
        >
          {roster.length === 0 ? (
            <EmptyState>No one has joined yet. Share the room code from the Present view.</EmptyState>
          ) : (
            <LayoutGroup>
              <ul>
                {roster.map((x) => {
                  const done = x.a.items.filter((i) => i.submitted).length;
                  return (
                    <motion.li layout="position" transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }} key={x.a.regNo} className={cx("flex items-center gap-3 border-b border-line px-3 py-2", x.s.tier === "flagged" && "shadow-[inset_2px_0_0_var(--bad)]")}>
                      <Avatar seed={avatarSeed(x.a.regNo, x.a.avatar ?? 0)} size={30} presence={x.presence} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{x.a.name}</p>
                        <p className="mono tnum truncate text-[11px] text-fg-3">{x.a.regNo}</p>
                      </div>
                      <div className="w-24">
                        <div className="flex justify-between text-[11px]">
                          <span className="mono tnum text-fg-2">
                            {done}/{total}
                          </span>
                          <span className="mono tnum text-fg-3">{x.s.items.some((i) => i.attempted) ? pct(x.s.accuracy, 0) : "–"}</span>
                        </div>
                        <Meter value={x.s.accuracy} tone={x.s.accuracy > 0.85 ? "ok" : undefined} className="mt-1" />
                      </div>
                      <div className="w-[112px] text-right">{statusTag(x)}</div>
                    </motion.li>
                  );
                })}
              </ul>
            </LayoutGroup>
          )}
        </Panel>

        <Panel title="Performance and mastery" actions={<span className="text-[11px] text-fg-3">Provisional · current criteria</span>} className="h-[calc(100dvh-270px)] min-h-[420px]" bodyClass="overflow-auto">
          {leaders.length === 0 ? (
            <EmptyState>The leaderboard fills as students check their work.</EmptyState>
          ) : (
            <>
              <div className="sticky top-0 z-10 grid grid-cols-[28px_1fr_64px_56px_70px] items-center gap-2 border-b border-line-strong bg-bg-1 px-3 py-1.5 text-[11px] text-fg-2">
                <span>#</span>
                <span>Student</span>
                <span className="text-right">Score</span>
                <span className="text-right">Acc.</span>
                <span className="text-right">E · M · H</span>
              </div>
              <LayoutGroup>
                <ul>
                  {leaders.map((x, i) => {
                    const dd = byDifficulty(x);
                    return (
                      <motion.li layout="position" transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }} key={x.a.regNo} className="grid grid-cols-[28px_1fr_64px_56px_70px] items-center gap-2 border-b border-line px-3 py-2">
                        <span className={cx("mono tnum text-[12px]", i < 3 ? "text-fg-1" : "text-fg-3")}>{i + 1}</span>
                        <span className="flex min-w-0 items-center gap-2">
                          <Avatar seed={avatarSeed(x.a.regNo, x.a.avatar ?? 0)} size={24} />
                          <span className="truncate text-[13px]">{x.a.name}</span>
                          {x.s.teItems ? (
                            <span title={`${x.s.teItems} question(s) with a trial-and-error pattern`} className="shrink-0 text-warn">
                              <AlertTriangle size={12} strokeWidth={1.5} />
                            </span>
                          ) : null}
                        </span>
                        <span className="mono tnum text-right text-[14px] font-medium">{x.s.score.toFixed(1)}</span>
                        <span className="mono tnum text-right text-[12px] text-fg-2">{pct(x.s.accuracy, 0)}</span>
                        <span className="flex items-end justify-end gap-[3px]" aria-label="Accuracy by difficulty">
                          {(["easy", "medium", "hard"] as const).map((d) => (
                            <span key={d} className="relative h-4 w-3 overflow-hidden rounded-[2px] bg-bg-3" title={`${d}: ${dd[d] === null ? "none" : pct(dd[d]!, 0)}`}>
                              {dd[d] !== null ? (
                                <motion.span
                                  className={cx("absolute inset-x-0 bottom-0", d === "easy" ? "bg-cat-3" : d === "medium" ? "bg-cat-2" : "bg-cat-4")}
                                  initial={false}
                                  animate={{ height: `${dd[d]! * 100}%` }}
                                  transition={{ duration: 0.3 }}
                                />
                              ) : null}
                            </span>
                          ))}
                        </span>
                      </motion.li>
                    );
                  })}
                </ul>
              </LayoutGroup>
            </>
          )}
        </Panel>

        <div className="flex h-[calc(100dvh-270px)] min-h-[420px] flex-col gap-4">
          <Panel title="Integrity monitor" className="min-h-0 flex-[1.1]" bodyClass="overflow-auto">
            {risk.length === 0 ? (
              <EmptyState>No integrity events so far.</EmptyState>
            ) : (
              <>
                <div className="sticky top-0 z-10 grid grid-cols-[1fr_74px_40px_repeat(4,28px)] items-center gap-1.5 border-b border-line-strong bg-bg-1 px-3 py-1.5 text-[11px] text-fg-2">
                  <span>Student</span>
                  <span>Tier</span>
                  <span className="text-right">I</span>
                  <span className="flex justify-center" title="Full-screen exits">
                    <Minimize2 size={12} strokeWidth={1.5} />
                  </span>
                  <span className="flex justify-center" title="Tab switches">
                    <EyeOff size={12} strokeWidth={1.5} />
                  </span>
                  <span className="flex justify-center" title="Focus losses over 2 s">
                    <MonitorOff size={12} strokeWidth={1.5} />
                  </span>
                  <span className="flex justify-center" title="Other (devtools, clipboard, second device…)">
                    <ShieldAlert size={12} strokeWidth={1.5} />
                  </span>
                </div>
                <LayoutGroup>
                  <ul>
                    {risk.map((x) => (
                      <motion.li layout="position" key={x.a.regNo} className="grid grid-cols-[1fr_74px_40px_repeat(4,28px)] items-center gap-1.5 border-b border-line px-3 py-1.5">
                        <span className="flex min-w-0 items-center gap-2">
                          <Avatar seed={avatarSeed(x.a.regNo, x.a.avatar ?? 0)} size={22} presence={x.presence} />
                          <span className="truncate text-[12px]">{x.a.name}</span>
                          {x.outOfFullscreen ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-bad" title="Out of full screen right now" /> : null}
                        </span>
                        <span>{TIER_TAG[x.s.tier]}</span>
                        <span className="mono tnum text-right text-[12px]">{x.s.integrity.toFixed(2)}</span>
                        {[x.s.counts.fullscreen, x.s.counts.tab, x.s.counts.blur, x.s.counts.other].map((n, i) => (
                          <span key={i} className={cx("mono tnum text-center text-[12px]", n ? (i === 3 ? "text-bad" : "text-fg-1") : "text-fg-3")}>
                            {n}
                          </span>
                        ))}
                      </motion.li>
                    ))}
                  </ul>
                </LayoutGroup>
              </>
            )}
          </Panel>
          <Panel title="Event feed" className="min-h-0 flex-1" bodyClass="overflow-auto">
            {feed.length === 0 ? (
              <EmptyState>Events appear here as they happen.</EmptyState>
            ) : (
              <ul>
                <AnimatePresence initial={false}>
                  {feed.map(({ e, x }) => (
                    <motion.li
                      key={e.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.14 }}
                      className={cx("flex items-center gap-2 border-b border-line px-3 py-1.5 text-[12px]", SEVERE.includes(e.type) ? "text-bad" : "text-fg-1")}
                    >
                      <span className={SEVERE.includes(e.type) ? "text-bad" : "text-fg-3"}>{EVENT_ICON[e.type]}</span>
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium">{x.a.name}</span> <span className="text-fg-2">· {INTEGRITY_LABEL[e.type]}</span>
                        {e.durationMs ? <span className="mono tnum text-fg-3"> · {mmss(e.durationMs / 1000)}</span> : null}
                      </span>
                      <span className="mono tnum shrink-0 text-[11px] text-fg-3" title={clockTime(e.at)}>
                        {relTime(e.at, now)}
                      </span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "bad" }) {
  return (
    <div className="bg-bg-1 px-4 py-3">
      <p className="text-[12px] text-fg-3">{label}</p>
      <p className={cx("mono tnum mt-0.5 text-[20px] font-semibold leading-7", tone === "bad" && "text-bad")}>
        {value}
        {sub ? <span className="ml-1 text-[13px] font-normal text-fg-3">{sub}</span> : null}
      </p>
    </div>
  );
}

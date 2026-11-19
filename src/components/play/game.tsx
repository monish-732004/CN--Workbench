"use client";

import { ChevronDown, Crown, Flame, HelpCircle, Lightbulb, Sparkles, Swords, Trophy, X } from "lucide-react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { avatarSeed, TEAMS, type Board, type BoardRow, type ChestOutcome } from "@/engine/model";
import { Avatar } from "../Avatar";
import { Button, cx } from "../ui";
import type { Guide } from "./guides";

// ───────── Count-up number ─────────
export function CountUp({ value, className }: { value: number; className?: string }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (x) => Math.round(x).toLocaleString("en-IN"));
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.6, ease: [0.2, 0, 0, 1] });
    return () => c.stop();
  }, [value, mv]);
  return <motion.span className={className}>{text}</motion.span>;
}

// ───────── Podium colours (muted metals) ─────────
export const MEDAL = ["#C9A227", "#A7B0BC", "#B07A4F"];

export function RankBadge({ rank, size = 22 }: { rank: number; size?: number }) {
  const m = MEDAL[rank - 1];
  return (
    <span
      className={cx("mono tnum inline-flex shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", !m && "border border-line text-fg-3")}
      style={{ width: size, height: size, background: m, color: m ? "#14171c" : undefined }}
    >
      {rank}
    </span>
  );
}

export function TeamDot({ team, withName }: { team: number | null; withName?: boolean }) {
  if (team === null || team === undefined) return null;
  const t = TEAMS[team]!;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-fg-2">
      <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
      {withName ? t.name : null}
    </span>
  );
}

// ───────── Guide card ─────────
export function GuideCard({ guide, onHide }: { guide: Guide; onHide: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <motion.section initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mb-4 rounded-lg border border-signal/30 bg-signal-bg">
      <header className="flex items-center gap-2 px-4 py-2.5">
        <Lightbulb size={15} strokeWidth={1.5} className="text-signal" />
        <button type="button" onClick={() => setOpen(!open)} className="flex flex-1 items-center gap-1.5 text-left text-[13px] font-semibold">
          How to answer · {guide.title}
          <ChevronDown size={14} strokeWidth={1.5} className={cx("text-fg-3 transition-transform", !open && "-rotate-90")} />
        </button>
        <button type="button" onClick={onHide} className="text-[12px] text-fg-2 hover:text-fg-1">
          Turn guide off
        </button>
      </header>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
            <ol className="space-y-1 px-4 pb-3 pl-10 text-[13px] text-fg-1">
              {guide.steps.map((s, i) => (
                <li key={i} className="list-decimal">
                  {s}
                </li>
              ))}
            </ol>
            {guide.tip ? <p className="px-4 pb-3 pl-10 text-[12px] text-fg-2">Tip: {guide.tip}</p> : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}

// ───────── Interface tour ─────────
export interface TourStep {
  selector: string;
  title: string;
  text: string;
}

export function Tour({ steps, onDone }: { steps: TourStep[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[i]!;
  useLayoutEffect(() => {
    const measure = () => {
      const el = document.querySelector(step.selector);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    window.addEventListener("resize", measure);
    const t = window.setInterval(measure, 400);
    return () => {
      window.removeEventListener("resize", measure);
      window.clearInterval(t);
    };
  }, [step.selector]);
  const pad = 6;
  const r = rect ? { x: rect.left - pad, y: rect.top - pad, w: rect.width + pad * 2, h: rect.height + pad * 2 } : null;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const cardW = 340;
  let cx_ = vw / 2 - cardW / 2;
  let cy = vh / 2 - 90;
  if (r) {
    const below = r.y + r.h + 12;
    cy = below + 190 < vh ? below : Math.max(12, r.y - 200);
    cx_ = Math.min(vw - cardW - 12, Math.max(12, r.x + r.w / 2 - cardW / 2));
  }
  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-label="Interface tour">
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <mask id="tour-hole">
            <rect width="100%" height="100%" fill="white" />
            {r ? <motion.rect initial={false} animate={{ x: r.x, y: r.y, width: r.w, height: r.h }} transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }} rx="8" fill="black" /> : null}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgb(8 10 13 / 0.62)" mask="url(#tour-hole)" />
        {r ? <motion.rect initial={false} animate={{ x: r.x, y: r.y, width: r.w, height: r.h }} transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }} rx="8" fill="none" stroke="var(--signal)" strokeWidth="2" /> : null}
      </svg>
      <motion.div
        key={i}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="absolute rounded-lg border border-line bg-bg-2 p-4 shadow-[var(--shadow-pop)]"
        style={{ left: cx_, top: cy, width: cardW }}
      >
        <p className="mono tnum text-[11px] text-fg-3">
          {i + 1} / {steps.length}
        </p>
        <h3 className="mt-1 text-[14px] font-semibold">{step.title}</h3>
        <p className="mt-1 text-[13px] text-fg-2">{step.text}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={onDone} className="text-[12px] text-fg-3 hover:text-fg-1">
            Skip tour
          </button>
          <div className="flex gap-2">
            {i > 0 ? (
              <Button size="sm" variant="ghost" onClick={() => setI(i - 1)}>
                Back
              </Button>
            ) : null}
            <Button size="sm" variant="primary" onClick={() => (i + 1 < steps.length ? setI(i + 1) : onDone())}>
              {i + 1 < steps.length ? "Next" : "Start answering"}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ───────── Score burst ─────────
export interface Burst {
  id: number;
  points: number;
  parts: string[];
  streak: number;
  complete?: { title: string; total: number };
}

export function ScoreBurst({ burst }: { burst: Burst | null }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-[65] flex justify-center">
      <AnimatePresence>
        {burst ? (
          <motion.div
            key={burst.id}
            initial={{ opacity: 0, y: -16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            className="relative flex min-w-[260px] flex-col items-center rounded-xl border border-line bg-bg-2 px-6 py-4 shadow-[var(--shadow-pop)]"
          >
            <motion.span
              className="absolute inset-0 rounded-xl border-2 border-ok"
              initial={{ opacity: 0.7, scale: 1 }}
              animate={{ opacity: 0, scale: 1.18 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
            {burst.complete ? <p className="mb-1 text-[12px] font-medium text-fg-2">Question complete · {burst.complete.title}</p> : null}
            <motion.p initial={{ scale: 0.6 }} animate={{ scale: [0.6, 1.15, 1] }} transition={{ duration: 0.45, times: [0, 0.6, 1] }} className="mono tnum text-[34px] font-semibold leading-none text-ok">
              +{burst.points.toLocaleString("en-IN")}
            </motion.p>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {burst.parts.map((p, i) => (
                <motion.span
                  key={p}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 + i * 0.06 }}
                  className="inline-flex h-5 items-center gap-1 rounded-sm border border-line bg-bg-1 px-1.5 text-[11px] text-fg-2"
                >
                  {p.startsWith("Streak") ? <Flame size={11} strokeWidth={1.75} className="text-warn" /> : p.startsWith("Fast") ? <Sparkles size={11} strokeWidth={1.75} className="text-signal" /> : null}
                  {p}
                </motion.span>
              ))}
            </div>
            {burst.complete ? <p className="mono tnum mt-2 text-[12px] text-fg-3">{burst.complete.total.toLocaleString("en-IN")} points on this question</p> : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// ───────── Gold rush chests ─────────
function ChestGlyph({ open, tone }: { open: boolean; tone: string }) {
  return (
    <svg width="76" height="64" viewBox="0 0 76 64" aria-hidden>
      <motion.g initial={false} animate={{ rotate: open ? -22 : 0 }} transition={{ type: "spring", stiffness: 260, damping: 14 }} style={{ transformBox: "fill-box", transformOrigin: "0% 100%" }}>
        <path d="M8 26 V18 a10 10 0 0 1 10 -10 H58 a10 10 0 0 1 10 10 V26 Z" fill={tone} stroke="rgb(0 0 0 / .25)" strokeWidth="1.5" />
      </motion.g>
      <rect x="8" y="26" width="60" height="32" rx="3" fill={tone} stroke="rgb(0 0 0 / .25)" strokeWidth="1.5" />
      <rect x="8" y="26" width="60" height="5" fill="rgb(0 0 0 / .14)" />
      <rect x="33" y="30" width="10" height="12" rx="2" fill="var(--bg-1)" stroke="rgb(0 0 0 / .25)" />
    </svg>
  );
}

const OUTCOME_TONE: Record<ChestOutcome["kind"], string> = { gain: "text-ok", pct: "text-ok", mult: "text-signal", steal: "text-warn", lose: "text-bad", nothing: "text-fg-3" };

export function ChestModal({ onPick, result, onClose }: { onPick: (i: number) => void; result: { outcomes: ChestOutcome[]; chosen: number; detail: string; delta: number; total: number } | null; onClose: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const tones = ["#C9A35B", "#7C9CC9", "#86AE86"];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[66] flex items-center justify-center px-4" style={{ background: "var(--scrim)" }}>
      <motion.div initial={{ y: 12, scale: 0.97 }} animate={{ y: 0, scale: 1 }} className="w-full max-w-[520px] rounded-xl border border-line bg-bg-2 p-6 text-center shadow-[var(--shadow-pop)]">
        <p className="text-[12px] font-medium text-fg-3">Gold rush</p>
        <h2 className="mt-1 text-[18px] font-semibold">{result ? result.detail : "Pick a chest"}</h2>
        <p className="mt-1 text-[13px] text-fg-2">{result ? `You now have ${result.total.toLocaleString("en-IN")} points` : "Points here are for the game only. Your marks are not affected."}</p>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => {
            const isPicked = result ? result.chosen === i : picked === i;
            const o = result?.outcomes[i];
            return (
              <motion.button
                key={i}
                type="button"
                disabled={!!result || picked !== null}
                whileHover={!result && picked === null ? { y: -4 } : undefined}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setPicked(i);
                  onPick(i);
                }}
                className={cx(
                  "flex flex-col items-center gap-2 rounded-lg border px-2 py-4 transition-colors",
                  isPicked ? "border-signal bg-signal-bg" : "border-line bg-bg-1",
                  result && !isPicked && "opacity-60",
                )}
              >
                <motion.div animate={picked === i && !result ? { rotate: [0, -4, 4, -3, 3, 0] } : {}} transition={{ duration: 0.6, repeat: picked === i && !result ? Infinity : 0 }}>
                  <ChestGlyph open={!!result} tone={tones[i]!} />
                </motion.div>
                <AnimatePresence>
                  {o ? (
                    <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: isPicked ? 0.1 : 0.35 }} className={cx("text-[12px] font-medium", OUTCOME_TONE[o.kind])}>
                      {o.label}
                    </motion.span>
                  ) : (
                    <span className="text-[12px] text-fg-3">Chest {i + 1}</span>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>
        {result ? (
          <Button variant="primary" className="mt-6" onClick={onClose}>
            Continue
          </Button>
        ) : null}
      </motion.div>
    </motion.div>
  );
}

// ───────── Leaderboard ─────────
function BoardLine({ r, mode, highlightTop = true }: { r: BoardRow; mode: Board["mode"]; highlightTop?: boolean }) {
  const top3 = highlightTop && r.rank <= 3;
  return (
    <motion.li
      layout="position"
      transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
      className={cx("flex items-center gap-2.5 rounded-md px-2.5 py-2", r.me ? "bg-signal-bg ring-1 ring-signal/50" : top3 ? "bg-bg-3" : "")}
      style={top3 && !r.me ? { boxShadow: `inset 3px 0 0 ${MEDAL[r.rank - 1]}` } : undefined}
    >
      <RankBadge rank={r.rank} />
      <Avatar seed={r.avatar} size={26} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={cx("truncate text-[13px]", top3 || r.me ? "font-semibold" : "")}>{r.name}</span>
          {r.me ? <span className="text-[11px] text-signal">you</span> : null}
          {r.rank === 1 ? <Crown size={13} strokeWidth={1.75} style={{ color: MEDAL[0] }} /> : null}
        </span>
        {mode === "race" ? (
          <span className="mt-1 block h-1 overflow-hidden rounded-full bg-bg-3">
            <motion.span className="block h-full rounded-full bg-signal" initial={false} animate={{ width: `${r.progress * 100}%` }} transition={{ duration: 0.5 }} />
          </span>
        ) : (
          <TeamDot team={r.team} withName />
        )}
      </span>
      <CountUp value={r.points} className="mono tnum text-[13px] font-medium" />
    </motion.li>
  );
}

export function BoardPanel({ board, title = "Leaderboard" }: { board: Board | null; title?: ReactNode }) {
  if (!board) return <p className="px-3 py-6 text-center text-[12px] text-fg-3">Loading the leaderboard…</p>;
  const inTop = board.top.some((r) => r.me);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <h3 className="flex items-center gap-1.5 text-[13px] font-semibold">
            <Trophy size={14} strokeWidth={1.5} className="text-fg-2" /> {title}
          </h3>
          <span className="mono tnum text-[11px] text-fg-3">{board.players} players</span>
        </div>
        {board.hidden ? (
          <p className="rounded-md border border-line bg-bg-2 px-3 py-4 text-center text-[12px] text-fg-3">Your teacher has hidden the leaderboard for this room.</p>
        ) : (
          <ul className="space-y-1">
            {board.top.map((r) => (
              <BoardLine key={`${r.name}-${r.avatar}`} r={r} mode={board.mode} />
            ))}
            {!inTop && board.me ? (
              <>
                <li className="py-0.5 text-center text-[11px] text-fg-3">· · ·</li>
                <BoardLine r={board.me} mode={board.mode} />
              </>
            ) : null}
          </ul>
        )}
      </div>
      {board.teams.length ? (
        <div>
          <h3 className="mb-2 px-1 text-[13px] font-semibold">Teams</h3>
          <ul className="space-y-1.5">
            {board.teams.map((t, i) => {
              const max = Math.max(1, ...board.teams.map((x) => (board.mode === "race" ? x.progress : x.points)));
              const val = board.mode === "race" ? t.progress : t.points;
              const mine = board.me?.team === t.index;
              return (
                <motion.li layout="position" key={t.index} className={cx("rounded-md px-2.5 py-2", mine ? "bg-signal-bg ring-1 ring-signal/40" : "bg-bg-2")}>
                  <div className="flex items-center gap-2 text-[13px]">
                    <RankBadge rank={i + 1} size={20} />
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
                    <span className="font-medium">{t.name}</span>
                    {mine ? <span className="text-[11px] text-signal">your team</span> : null}
                    <span className="mono tnum ml-auto text-[12px]">{board.mode === "race" ? `${Math.round(t.progress * 100)}%` : `${t.points.toLocaleString("en-IN")} avg`}</span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-bg-3">
                    <motion.div className="h-full rounded-full" style={{ background: t.color }} initial={false} animate={{ width: `${(val / max) * 100}%` }} transition={{ duration: 0.5 }} />
                  </div>
                  <p className="mono tnum mt-1 text-[11px] text-fg-3">
                    {t.members} member{t.members === 1 ? "" : "s"} · {t.total.toLocaleString("en-IN")} total
                  </p>
                </motion.li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {board.feed.length ? (
        <div>
          <h3 className="mb-2 px-1 text-[13px] font-semibold">Game feed</h3>
          <ul className="space-y-1">
            <AnimatePresence initial={false}>
              {board.feed.slice(0, 6).map((f) => (
                <motion.li key={`${f.at}-${f.text}`} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className={cx("flex items-center gap-2 px-1 text-[12px]", f.to === "me" ? "text-bad" : "text-fg-2")}>
                  {f.kind === "steal" ? <Swords size={12} strokeWidth={1.5} /> : f.kind === "streak" ? <Flame size={12} strokeWidth={1.5} /> : <Trophy size={12} strokeWidth={1.5} />}
                  {f.to === "me" ? `${f.text.replace(/ from .*/, "")} from you` : f.text}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// ───────── Avatar picker ─────────
export function AvatarPicker({ reg, value, onChange }: { reg: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="grid grid-cols-6 gap-2">
      {Array.from({ length: 12 }, (_, i) => (
        <motion.button
          key={i}
          type="button"
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => onChange(i)}
          aria-label={`Avatar ${i + 1}`}
          aria-pressed={value === i}
          className={cx("flex items-center justify-center rounded-lg border p-1.5 transition-colors", value === i ? "border-signal bg-signal-bg" : "border-line hover:bg-bg-3")}
        >
          <Avatar seed={avatarSeed(reg, i)} size={40} />
        </motion.button>
      ))}
    </div>
  );
}

export function GuideSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      data-tour="guide"
      onClick={() => onChange(!on)}
      className={cx("inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[12px] transition-colors", on ? "border-signal/40 bg-signal-bg text-signal" : "border-line text-fg-2 hover:text-fg-1")}
      title="Show or hide the how-to-answer guide"
    >
      <HelpCircle size={13} strokeWidth={1.5} />
      Guide {on ? "on" : "off"}
    </button>
  );
}

export function CloseX({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-md text-fg-2 hover:bg-bg-3">
      <X size={16} strokeWidth={1.5} />
    </button>
  );
}

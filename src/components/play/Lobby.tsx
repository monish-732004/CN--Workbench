"use client";

import { Check, Clock4, EyeOff, HelpCircle, Maximize2, MonitorOff, ShieldCheck, Trophy } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { avatarSeed, GAME_MODES, TEAMS, type AttemptPublic, type RoomPublic } from "@/engine/model";
import { formatCode, minutes } from "@/lib/format";
import { Avatar } from "../Avatar";
import { Button, cx } from "../ui";
import { AvatarPicker, GuideSwitch } from "./game";

export function Lobby({
  attempt,
  room,
  onBegin,
  busy,
  fsSupported,
  error,
  guideOn,
  onGuide,
  onAvatar,
}: {
  attempt: AttemptPublic;
  room: RoomPublic;
  onBegin: () => void;
  busy: boolean;
  fsSupported: boolean;
  error: string | null;
  guideOn: boolean;
  onGuide: (v: boolean) => void;
  onAvatar: (v: number) => void;
}) {
  const [ack, setAck] = useState(false);
  const team = attempt.team !== null && attempt.team !== undefined ? TEAMS[attempt.team] : null;
  const mode = GAME_MODES[room.game?.mode ?? "classic"];
  const live = room.phase === "live" || room.phase === "grace";
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-48px)] max-w-[720px] flex-col justify-center px-4 py-10">
      <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="rounded-lg border border-line bg-bg-1">
        <header className="flex items-center gap-3 border-b border-line px-6 py-5">
          <motion.div key={attempt.avatar} initial={{ scale: 0.85 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}>
            <Avatar seed={avatarSeed(attempt.regNo, attempt.avatar ?? 0)} size={40} />
          </motion.div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{attempt.name}</p>
            <p className="mono tnum text-[12px] text-fg-2">{attempt.regNo}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="mono tnum text-[13px] font-medium">{formatCode(room.code)}</p>
            <p className="text-[12px] text-fg-3">{room.title}</p>
          </div>
        </header>

        <div className="px-6 py-5">
          <div className="flex items-center gap-2 text-[13px]">
            {live ? (
              <>
                <span className="h-2 w-2 rounded-full bg-ok" />
                <span className="font-medium">The room is live.</span>
                <span className="text-fg-2">
                  {room.items} questions · {minutes(room.durationSec)}
                </span>
              </>
            ) : room.phase === "waiting" ? (
              <>
                <motion.span className="h-2 w-2 rounded-full bg-fg-3" animate={{ opacity: [0.35, 1, 0.35] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />
                <span className="font-medium">Waiting for your teacher to start the room.</span>
              </>
            ) : (
              <span className="text-fg-2">This room has closed.</span>
            )}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto]">
            <div>
              <h2 className="text-[13px] font-semibold">Pick your avatar</h2>
              <p className="mt-0.5 text-[12px] text-fg-3">Shown next to your name on the leaderboard.</p>
              <div className="mt-2.5">
                <AvatarPicker reg={attempt.regNo} value={attempt.avatar ?? 0} onChange={onAvatar} />
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:w-[220px]">
              {team ? (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-md border border-line px-3 py-2.5" style={{ boxShadow: `inset 3px 0 0 ${team.color}` }}>
                  <p className="text-[11px] text-fg-3">Your team</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[14px] font-semibold">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: team.color }} />
                    {team.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-fg-3">Your points count toward the team average.</p>
                </motion.div>
              ) : null}
              <div className="rounded-md border border-line px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-[11px] text-fg-3">
                  <Trophy size={12} strokeWidth={1.5} /> Game mode
                </p>
                <p className="mt-0.5 text-[14px] font-semibold">{mode.label}</p>
                <p className="mt-0.5 text-[11px] text-fg-3">{mode.blurb}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-md border border-line bg-bg-2 px-3 py-2.5">
            <HelpCircle size={15} strokeWidth={1.5} className="mt-0.5 shrink-0 text-signal" />
            <p className="flex-1 text-[12px] text-fg-2">
              <span className="font-medium text-fg-1">New to the interface?</span> With the guide on, you get a short tour when you start and a how-to-answer box above every question. Turn it off
              here, or with the <span className="font-medium text-fg-1">Guide</span> switch in the top bar during the quiz.
            </p>
            <GuideSwitch on={guideOn} onChange={onGuide} />
          </div>

          <h2 className="mt-6 text-[13px] font-semibold">Before you begin</h2>
          <ul className="mt-2 space-y-2.5 text-[13px] text-fg-2">
            <li className="flex gap-3">
              <Maximize2 size={15} strokeWidth={1.5} className="mt-0.5 shrink-0 text-fg-3" />
              The quiz runs in full screen. If you leave full screen, the questions are hidden until you return. The timer keeps running.
            </li>
            <li className="flex gap-3">
              <EyeOff size={15} strokeWidth={1.5} className="mt-0.5 shrink-0 text-fg-3" />
              Switching tabs or apps, leaving the window, copying, pasting and right-clicking are recorded with timestamps and shown to your teacher.
            </li>
            <li className="flex gap-3">
              <Clock4 size={15} strokeWidth={1.5} className="mt-0.5 shrink-0 text-fg-3" />
              Each question shows an expected time and number of moves. Many wrong checks or random clicking are marked as trial-and-error.
            </li>
            <li className="flex gap-3">
              <MonitorOff size={15} strokeWidth={1.5} className="mt-0.5 shrink-0 text-fg-3" />
              Your values are different from your neighbours&apos;. Your work is saved as you go; if the connection drops, keep working.
            </li>
          </ul>

          <label className="mt-6 flex cursor-pointer items-start gap-3 text-[13px]">
            <button
              type="button"
              role="checkbox"
              aria-checked={ack}
              onClick={() => setAck(!ack)}
              className={cx("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors", ack ? "border-signal bg-signal text-white" : "border-line-strong")}
            >
              {ack ? <Check size={12} strokeWidth={2.5} /> : null}
            </button>
            <span onClick={() => setAck(!ack)}>I understand what is recorded during this quiz and why.</span>
          </label>

          {!fsSupported ? (
            <p className="mt-4 rounded-md border border-warn/35 bg-warn-bg px-3 py-2 text-[12px] text-warn">
              This browser cannot enter full screen. You can continue, but your attempt will be marked as taken on a limited device. Use a laptop or desktop if you can.
            </p>
          ) : null}
          {error ? <p className="mt-4 text-[12px] text-bad">{error}</p> : null}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
          <span className="inline-flex items-center gap-1.5 text-[12px] text-fg-3">
            <ShieldCheck size={14} strokeWidth={1.5} /> Your register number is your identity for this room.
          </span>
          <Button variant="primary" size="lg" disabled={!ack || !live || busy} onClick={onBegin}>
            <Maximize2 size={15} strokeWidth={1.5} />
            {busy ? "Starting…" : fsSupported ? "Enter full screen and begin" : "Begin"}
          </Button>
        </footer>
      </motion.section>
    </main>
  );
}

"use client";

import { Check, Clock4, EyeOff, Maximize2, MonitorOff, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import type { AttemptPublic, RoomPublic } from "@/engine/model";
import { formatCode, minutes } from "@/lib/format";
import { Avatar } from "../Avatar";
import { Button, cx } from "../ui";

export function Lobby({ attempt, room, onBegin, busy, fsSupported, error }: { attempt: AttemptPublic; room: RoomPublic; onBegin: () => void; busy: boolean; fsSupported: boolean; error: string | null }) {
  const [ack, setAck] = useState(false);
  const live = room.phase === "live" || room.phase === "grace";
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-48px)] max-w-[720px] flex-col justify-center px-4 py-10">
      <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="rounded-lg border border-line bg-bg-1">
        <header className="flex items-center gap-3 border-b border-line px-6 py-5">
          <Avatar seed={attempt.regNo} size={40} />
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

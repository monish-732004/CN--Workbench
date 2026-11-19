"use client";

import { Crown, Flame, QrCode, Swords, Trophy } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import QRCode from "qrcode";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { LogoMark } from "@/components/chrome";
import { CountUp, MEDAL } from "@/components/play/game";
import { cx } from "@/components/ui";
import { GAME_MODES, type Board, type RoomPublic } from "@/engine/model";
import { api, hostKeyFor } from "@/lib/client";
import { formatCode, minutes, mmss } from "@/lib/format";

type View = "join" | "board";

export default function Present() {
  const params = useParams<{ code: string }>();
  const code = String(params.code ?? "").toUpperCase();
  const [room, setRoom] = useState<RoomPublic | null>(null);
  const [joined, setJoined] = useState<number | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [view, setView] = useState<View | null>(null);
  const offset = useRef(0);

  useEffect(() => {
    const prev = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", "dark");
    setOrigin(window.location.origin);
    void QRCode.toDataURL(`${window.location.origin}/?code=${code}`, { margin: 1, width: 320, color: { dark: "#0a0c0f", light: "#e8ebef" } }).then(setQr);
    return () => {
      if (prev) document.documentElement.setAttribute("data-theme", prev);
      else document.documentElement.removeAttribute("data-theme");
    };
  }, [code]);

  useEffect(() => {
    const key = hostKeyFor(code);
    const tick = async () => {
      try {
        const r = await api<RoomPublic>(`/api/rooms/${code}`);
        offset.current = r.serverNow - Date.now();
        setRoom(r);
        const b = await api<Board & { phase: string }>(`/api/rooms/${code}/board`, { headers: key ? { "x-host-key": key } : {} });
        setBoard(b);
        setJoined(b.players);
      } catch {
        /* keep last state */
      }
    };
    void tick();
    const t = window.setInterval(tick, 3000);
    const c = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(t);
      window.clearInterval(c);
    };
  }, [code]);

  const serverNow = now + offset.current;
  const remaining = room?.endAt ? (room.endAt - serverNow) / 1000 : null;
  const host = origin.replace(/^https?:\/\//, "");
  // Default: join screen while waiting, leaderboard once the room is running.
  const shown: View = view ?? (room && room.phase !== "waiting" ? "board" : "join");
  const status = room ? (room.phase === "waiting" ? "Waiting to start" : room.phase === "live" ? "Live" : room.phase === "grace" ? "Grace period" : "Final standings") : "…";

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg-0 text-fg-1">
      <header className="flex items-center gap-3 px-10 pt-7">
        <LogoMark size={26} />
        <span className="text-[18px] font-semibold">CN Workbench</span>
        <span className="ml-4 truncate text-[18px] text-fg-2">
          {room?.title}
          {room?.section ? ` · ${room.section}` : ""}
        </span>
        <div className="ml-auto inline-flex rounded-md border border-line p-0.5 text-[14px]">
          {(["join", "board"] as View[]).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} className={cx("inline-flex items-center gap-1.5 rounded px-3 py-1.5", shown === v ? "bg-bg-3 text-fg-1" : "text-fg-2 hover:text-fg-1")}>
              {v === "join" ? <QrCode size={15} strokeWidth={1.5} /> : <Trophy size={15} strokeWidth={1.5} />}
              {v === "join" ? "Join" : "Leaderboard"}
            </button>
          ))}
        </div>
      </header>

      {shown === "join" ? (
        <main className="flex flex-1 items-center justify-center gap-20 px-10">
          <div>
            <p className="text-[22px] text-fg-2">Join at</p>
            <p className="mono mt-1 text-[34px] font-medium">{host || "…"}</p>
            <p className="mt-10 text-[22px] text-fg-2">Room code</p>
            <p className="mono tnum text-[128px] leading-[1.05] font-semibold tracking-[0.06em]">{formatCode(code)}</p>
            <p className="mt-8 text-[20px] text-fg-2">Enter your register number and name. Use a laptop or lab desktop.</p>
          </div>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`QR code for ${host}/?code=${code}`} width={320} height={320} className="rounded-lg border border-line" />
          ) : (
            <div className="h-[320px] w-[320px] rounded-lg border border-line" />
          )}
        </main>
      ) : (
        <BoardStage board={board} closed={room?.phase === "closed"} />
      )}

      <footer className="grid grid-cols-4 gap-px border-t border-line bg-line">
        <div className="bg-bg-0 px-10 py-5">
          <p className="text-[15px] text-fg-3">Status</p>
          <p className="text-[26px] font-semibold">{status}</p>
        </div>
        <div className="bg-bg-0 px-10 py-5">
          <p className="text-[15px] text-fg-3">{room?.phase === "waiting" ? "Session length" : "Time remaining"}</p>
          <p className="mono tnum text-[26px] font-semibold">{room ? (room.phase === "waiting" ? minutes(room.durationSec) : remaining !== null ? mmss(Math.max(0, remaining)) : "–") : "…"}</p>
        </div>
        <div className="bg-bg-0 px-10 py-5">
          <p className="text-[15px] text-fg-3">Players</p>
          <p className="mono tnum text-[26px] font-semibold">{joined ?? "–"}</p>
        </div>
        <div className="bg-bg-0 px-10 py-5">
          <p className="text-[15px] text-fg-3">Room code</p>
          <p className="mono tnum text-[26px] font-semibold tracking-[0.04em]">{formatCode(code)}</p>
        </div>
      </footer>
    </div>
  );
}

function BoardStage({ board, closed }: { board: Board | null; closed: boolean }) {
  if (!board) return <main className="flex flex-1 items-center justify-center text-[18px] text-fg-3">Loading the leaderboard…</main>;
  if (board.hidden) return <main className="flex flex-1 items-center justify-center text-[18px] text-fg-3">The leaderboard is hidden. Open this screen from the teacher&apos;s browser to show it.</main>;
  const podium = board.top.slice(0, 3);
  const rest = board.top.slice(3, 10);
  const race = board.mode === "race";
  return (
    <main className="grid min-h-0 flex-1 gap-8 overflow-hidden px-10 py-5 xl:grid-cols-[1.35fr_1fr]">
      <section className="flex min-h-0 flex-col">
        <p className="flex items-center gap-2 text-[16px] text-fg-2">
          <Trophy size={17} strokeWidth={1.5} /> {closed ? "Final standings" : "Top 10"} · {GAME_MODES[board.mode].label}
        </p>
        {board.top.length === 0 ? (
          <p className="mt-10 text-[20px] text-fg-3">Points appear as soon as students verify their first step.</p>
        ) : (
          <>
            <div className="mt-3 flex items-end justify-center gap-5">
              {[1, 0, 2].map((pos) => {
                const r = podium[pos];
                if (!r) return <div key={pos} className="w-[200px]" />;
                const h = [132, 100, 78][pos]!;
                return (
                  <motion.div key={pos} layout initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (2 - pos) * 0.12, type: "spring", stiffness: 240, damping: 24 }} className="flex w-[200px] flex-col items-center">
                    {pos === 0 ? <Crown size={26} strokeWidth={1.5} style={{ color: MEDAL[0] }} className="mb-1" /> : null}
                    <AnimatePresence mode="popLayout">
                      <motion.div key={r.name + r.avatar} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} className="flex flex-col items-center">
                        <Avatar seed={r.avatar} size={pos === 0 ? 64 : 52} />
                        <p className="mt-2 max-w-[200px] truncate text-[20px] font-semibold">{r.name}</p>
                      </motion.div>
                    </AnimatePresence>
                    <CountUp value={r.points} className="mono tnum text-[18px] text-fg-2" />
                    <div className="mt-3 flex w-full items-start justify-center rounded-t-lg border border-b-0 border-line bg-bg-2 pt-3" style={{ height: h, boxShadow: `inset 0 4px 0 ${MEDAL[pos]}` }}>
                      <span className="mono tnum text-[34px] font-semibold" style={{ color: MEDAL[pos] }}>
                        {pos + 1}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            <LayoutGroup>
              <ul className="mt-4 grid min-h-0 gap-1 overflow-hidden border-t border-line pt-3">
                {rest.map((r) => (
                  <motion.li layout="position" transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }} key={r.name + r.avatar} className="flex items-center gap-4 rounded-md bg-bg-1 px-4 py-1.5">
                    <span className="mono tnum w-8 text-[20px] text-fg-3">{r.rank}</span>
                    <Avatar seed={r.avatar} size={30} />
                    <span className="min-w-0 flex-1 truncate text-[20px]">{r.name}</span>
                    {race ? (
                      <span className="h-2 w-40 overflow-hidden rounded-full bg-bg-3">
                        <motion.span className="block h-full rounded-full bg-signal" initial={false} animate={{ width: `${r.progress * 100}%` }} />
                      </span>
                    ) : null}
                    <CountUp value={r.points} className="mono tnum w-28 text-right text-[20px] font-medium" />
                  </motion.li>
                ))}
              </ul>
            </LayoutGroup>
          </>
        )}
      </section>

      <section className="flex min-h-0 flex-col gap-6">
        {board.teams.length ? (
          <div>
            <p className="text-[16px] text-fg-2">Teams · {race ? "average progress" : "average points"}</p>
            <LayoutGroup>
              <ul className="mt-3 space-y-3">
                {board.teams.map((t, i) => {
                  const max = Math.max(1, ...board.teams.map((x) => (race ? x.progress : x.points)));
                  const val = race ? t.progress : t.points;
                  return (
                    <motion.li layout="position" key={t.index} className="rounded-lg bg-bg-1 px-4 py-3">
                      <div className="flex items-center gap-3 text-[20px]">
                        <span className="mono tnum w-6 text-fg-3">{i + 1}</span>
                        <span className="h-3.5 w-3.5 rounded-full" style={{ background: t.color }} />
                        <span className="font-semibold">{t.name}</span>
                        <span className="text-[15px] text-fg-3">{t.members}</span>
                        <span className="mono tnum ml-auto">{race ? `${Math.round(t.progress * 100)}%` : t.points.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-bg-3">
                        <motion.div className="h-full rounded-full" style={{ background: t.color }} initial={false} animate={{ width: `${(val / max) * 100}%` }} transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }} />
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            </LayoutGroup>
          </div>
        ) : null}
        {board.feed.length ? (
          <div>
            <p className="text-[16px] text-fg-2">Moments</p>
            <ul className="mt-3 space-y-2">
              <AnimatePresence initial={false}>
                {board.feed.slice(0, 6).map((f) => (
                  <motion.li key={`${f.at}-${f.text}`} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 text-[18px] text-fg-1">
                    <span className="text-fg-3">{f.kind === "steal" ? <Swords size={18} strokeWidth={1.5} /> : f.kind === "streak" ? <Flame size={18} strokeWidth={1.5} /> : <Trophy size={18} strokeWidth={1.5} />}</span>
                    {f.text}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
        ) : null}
      </section>
    </main>
  );
}

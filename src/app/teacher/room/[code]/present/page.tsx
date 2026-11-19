"use client";

import QRCode from "qrcode";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/chrome";
import type { RoomPublic } from "@/engine/model";
import { api, hostKeyFor } from "@/lib/client";
import { formatCode, minutes, mmss } from "@/lib/format";

export default function Present() {
  const params = useParams<{ code: string }>();
  const code = String(params.code ?? "").toUpperCase();
  const [room, setRoom] = useState<RoomPublic | null>(null);
  const [joined, setJoined] = useState<number | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [now, setNow] = useState(() => Date.now());
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
        if (key) {
          const h = await api<{ attempts: unknown[] }>(`/api/rooms/${code}/host`, { headers: { "x-host-key": key } });
          setJoined(h.attempts.length);
        }
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

  return (
    <div className="flex min-h-dvh flex-col bg-bg-0 text-fg-1">
      <header className="flex items-center gap-3 px-10 pt-8">
        <LogoMark size={26} />
        <span className="text-[18px] font-semibold">CN Workbench</span>
        <span className="ml-4 text-[18px] text-fg-2">
          {room?.title}
          {room?.section ? ` · ${room.section}` : ""}
        </span>
      </header>
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
      <footer className="grid grid-cols-3 gap-px border-t border-line bg-line">
        <div className="bg-bg-0 px-10 py-6">
          <p className="text-[16px] text-fg-3">Status</p>
          <p className="text-[30px] font-semibold">{room ? (room.phase === "waiting" ? "Waiting to start" : room.phase === "live" ? "Live" : room.phase === "grace" ? "Grace period" : "Closed") : "…"}</p>
        </div>
        <div className="bg-bg-0 px-10 py-6">
          <p className="text-[16px] text-fg-3">{room?.phase === "waiting" ? "Session length" : "Time remaining"}</p>
          <p className="mono tnum text-[30px] font-semibold">{room ? (room.phase === "waiting" ? minutes(room.durationSec) : remaining !== null ? mmss(Math.max(0, remaining)) : "–") : "…"}</p>
        </div>
        <div className="bg-bg-0 px-10 py-6">
          <p className="text-[16px] text-fg-3">Joined</p>
          <p className="mono tnum text-[30px] font-semibold">{joined ?? "–"}</p>
        </div>
      </footer>
    </div>
  );
}

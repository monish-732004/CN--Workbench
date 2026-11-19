"use client";

import { ArrowLeft, Check, Copy, MonitorPlay, Play, Plus, Square } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TOPIC_BY_ID } from "@/engine/catalog";
import { DEFAULT_SCORING, type ScoringConfig } from "@/engine/model";
import { api, ApiError, hostKeyFor, rememberHostRoom } from "@/lib/client";
import { formatCode, minutes, mmss } from "@/lib/format";
import { ThemeToggle, Wordmark } from "../chrome";
import { Button, cx, Input, Segmented, Spinner, Tag } from "../ui";
import { LiveView } from "./LiveView";
import { ResultsView } from "./ResultsView";
import { scoreAll, type HostData } from "./types";

type Tab = "live" | "results";

export function RoomClient({ code }: { code: string }) {
  const [hostKey, setHostKey] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<HostData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("live");
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cfgDraft, setCfgDraft] = useState<ScoringConfig | null>(null);
  const offset = useRef(0);

  useEffect(() => {
    const m = /[#&]k=([A-Za-z0-9_-]+)/.exec(window.location.hash);
    if (m) {
      const k = m[1]!;
      rememberHostRoom({ code, hostKey: k, title: "Shared room", section: "", createdAt: Date.now() });
      history.replaceState(null, "", window.location.pathname);
      setHostKey(k);
    } else setHostKey(hostKeyFor(code));
    setReady(true);
  }, [code]);

  const load = useCallback(async () => {
    if (!hostKey) return;
    try {
      const d = await api<HostData>(`/api/rooms/${code}/host`, { headers: { "x-host-key": hostKey } });
      offset.current = d.room.serverNow - Date.now();
      setData(d);
      setError(null);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }, [code, hostKey]);

  useEffect(() => {
    if (!hostKey) return;
    void load();
    const t = window.setInterval(load, 2500);
    return () => window.clearInterval(t);
  }, [hostKey, load]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const action = async (body: Record<string, unknown>, label: string) => {
    if (!hostKey) return;
    setBusy(label);
    try {
      await api(`/api/rooms/${code}/host`, { body, headers: { "x-host-key": hostKey } });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const cfg = cfgDraft ?? data?.room.scoring ?? DEFAULT_SCORING;
  const serverNow = now + offset.current;
  const scored = useMemo(() => (data ? scoreAll(data, cfg, serverNow) : []), [data, cfg, serverNow]);

  if (!ready) return null;

  if (!hostKey) {
    return <MissingKey code={code} onKey={(k) => setHostKey(k)} />;
  }

  if (!data) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-[13px] text-fg-3">
        {error ? <span className="text-bad">{error}</span> : (<><Spinner className="mr-2" /> Loading room…</>)}
      </div>
    );
  }

  const room = data.room;
  const endAt = room.endedEarlyAt ?? room.endAt;
  const remaining = endAt ? (endAt - serverNow) / 1000 : room.durationSec;
  const graceEnd = room.endAt && room.late.mode !== "lock" ? room.endAt + room.late.graceMin * 60_000 : null;
  const phaseTag =
    room.phase === "waiting" ? <Tag>Not started</Tag> : room.phase === "live" ? <Tag tone="ok">Live</Tag> : room.phase === "grace" ? <Tag tone="warn">Grace period</Tag> : <Tag>Closed</Tag>;

  const shareLink = () => {
    const url = `${window.location.origin}/teacher/room/${code}#k=${hostKey}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-bg-0/95">
        <div className="mx-auto flex h-12 max-w-[1600px] items-center gap-3 px-4">
          <Wordmark href="/teacher" />
          <span className="text-fg-3">/</span>
          <Link href="/teacher" className="inline-flex items-center gap-1 text-[13px] text-fg-2 hover:text-fg-1">
            <ArrowLeft size={14} strokeWidth={1.5} /> Rooms
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {data.storage === "memory" ? (
              <span title="Room data lives in server memory. On Vercel, connect Upstash Redis so every request sees the same data.">
                <Tag tone="warn">Demo storage</Tag>
              </span>
            ) : null}
            <ThemeToggle />
          </div>
        </div>
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[18px] font-semibold tracking-[-0.01em]">{room.title}</h1>
              {phaseTag}
            </div>
            <p className="text-[12px] text-fg-2">
              <span className="mono tnum text-fg-1">{formatCode(code)}</span>
              {room.section ? ` · Section ${room.section}` : ""} · {room.slots.length} questions · {room.topics.map((t) => TOPIC_BY_ID[t]?.title).join(", ")}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="mr-2 text-right">
              <p className="text-[11px] text-fg-3">{room.phase === "waiting" ? "Session" : room.phase === "grace" ? "Grace ends in" : room.phase === "closed" ? "Ended" : "Remaining"}</p>
              <p className={cx("mono tnum text-[18px] font-medium leading-6", room.phase === "live" && remaining <= 60 ? "text-bad" : room.phase === "live" && remaining <= 300 ? "text-warn" : room.phase === "grace" ? "text-warn" : "text-fg-1")}>
                {room.phase === "waiting"
                  ? minutes(room.durationSec)
                  : room.phase === "grace" && graceEnd
                    ? mmss((graceEnd - serverNow) / 1000)
                    : room.phase === "closed"
                      ? "—"
                      : mmss(Math.max(0, remaining))}
              </p>
            </div>
            <Link href={`/teacher/room/${code}/present`} target="_blank">
              <Button variant="secondary">
                <MonitorPlay size={14} strokeWidth={1.5} /> Present
              </Button>
            </Link>
            <Button variant="ghost" onClick={shareLink} title="Copy a link that opens this dashboard on another device">
              {copied ? <Check size={14} strokeWidth={1.5} /> : <Copy size={14} strokeWidth={1.5} />}
              {copied ? "Copied" : "Host link"}
            </Button>
            {room.phase === "waiting" ? (
              <Button variant="primary" disabled={!!busy} onClick={() => void action({ action: "start" }, "start")}>
                <Play size={14} strokeWidth={1.5} /> {busy === "start" ? "Starting…" : "Start now"}
              </Button>
            ) : null}
            {room.phase === "live" || room.phase === "grace" ? (
              <>
                <Button variant="secondary" disabled={!!busy} onClick={() => void action({ action: "extend", minutes: 5 }, "extend")}>
                  <Plus size={14} strokeWidth={1.5} /> 5 min
                </Button>
                {confirmEnd ? (
                  <>
                    <Button variant="ghost" onClick={() => setConfirmEnd(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        setConfirmEnd(false);
                        void action({ action: "end" }, "end");
                      }}
                    >
                      End and submit all
                    </Button>
                  </>
                ) : (
                  <Button variant="danger" onClick={() => setConfirmEnd(true)}>
                    <Square size={13} strokeWidth={1.5} /> End
                  </Button>
                )}
              </>
            ) : null}
            {room.phase === "closed" ? (
              <Button variant="secondary" disabled={!!busy} onClick={() => void action({ action: "extend", minutes: 5 }, "extend")} title="Reopen for 5 more minutes">
                <Plus size={14} strokeWidth={1.5} /> Reopen 5 min
              </Button>
            ) : null}
          </div>
        </div>
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 pb-2">
          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: "live", label: "Live" },
              { value: "results", label: "Results and export" },
            ]}
          />
          {error ? <span className="text-[12px] text-bad">{error}</span> : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-4">
        {tab === "live" ? (
          <LiveView data={data} scored={scored} now={serverNow} hostKey={hostKey} />
        ) : (
          <ResultsView
            data={data}
            scored={scored}
            cfg={cfg}
            dirty={!!cfgDraft}
            setCfg={setCfgDraft}
            onSave={async () => {
              if (!cfgDraft) return;
              await action({ action: "scoring", scoring: cfgDraft }, "scoring");
              setCfgDraft(null);
            }}
            onExcuse={(reg, eventId, undo) => void action({ action: "excuse", reg, eventId, undo }, "excuse")}
            hostKey={hostKey}
          />
        )}
      </main>
    </div>
  );
}

function MissingKey({ code, onKey }: { code: string; onKey: (k: string) => void }) {
  const [k, setK] = useState("");
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-[460px] rounded-lg border border-line bg-bg-1 p-6">
        <h1 className="text-[16px] font-semibold">Host key needed</h1>
        <p className="mt-2 text-[13px] text-fg-2">
          Room <span className="mono">{formatCode(code)}</span> was created on another browser. Open the host link from that browser (Host link button), or paste its key here.
        </p>
        <div className="mt-4 flex gap-2">
          <Input mono value={k} onChange={(e) => setK(e.target.value.trim())} placeholder="Host key" />
          <Button
            variant="primary"
            disabled={k.length < 10}
            onClick={() => {
              rememberHostRoom({ code, hostKey: k, title: "Shared room", section: "", createdAt: Date.now() });
              onKey(k);
            }}
          >
            Open
          </Button>
        </div>
      </div>
    </div>
  );
}

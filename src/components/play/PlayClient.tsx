"use client";

import { ArrowLeft, ArrowRight, CheckCheck, Circle, CircleDot, CircleCheck, Flame, Maximize2, Minimize2, Radio, RadioTower, Trophy, WifiOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DIFFICULTY_LABEL } from "@/engine/catalog";
import { avatarSeed, TEAMS, type AttemptPublic, type Board, type ChestOutcome, type RoomPublic } from "@/engine/model";
import { itemAccuracy } from "@/engine/scoring";
import { api, ApiError, createQueue, lsDel, lsGet, lsSet } from "@/lib/client";
import { formatCode, mmss } from "@/lib/format";
import { enterFullscreen, fullscreenSupported, useIntegrity, type SensorEvent } from "@/lib/integrity";
import { Avatar } from "../Avatar";
import { LogoMark, ThemeToggle } from "../chrome";
import { Button, cx, Spinner } from "../ui";
import { BoardPanel, ChestModal, CloseX, CountUp, GuideCard, GuideSwitch, ScoreBurst, Tour, type Burst, type TourStep } from "./game";
import { guideFor } from "./guides";
import type { Verdict } from "./kit";
import { Lobby } from "./Lobby";
import { Summary } from "./Summary";
import { TemplateHost } from "./TemplateHost";

interface Session {
  regNo: string;
  name: string;
  token: string;
}
interface LocalStats {
  activeMs: number;
  moves: number;
  undos: number;
  resets: number;
  maxOscillation: number;
}

type Phase = "loading" | "lobby" | "work" | "done" | "replaced" | "error";

export function PlayClient({ code }: { code: string }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [attempt, setAttempt] = useState<AttemptPublic | null>(null);
  const [room, setRoom] = useState<RoomPublic | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [drafts, setDrafts] = useState<Record<number, unknown>>({});
  const [verdicts, setVerdicts] = useState<Record<number, Record<string, Verdict>>>({});
  const [pending, setPending] = useState<{ idx: number; cp: string } | null>(null);
  const [isFs, setIsFs] = useState(true);
  const [online, setOnline] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [beginBusy, setBeginBusy] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [awaySince, setAwaySince] = useState<number | null>(null);
  // Game layer
  const [guideOn, setGuideOnState] = useState(true);
  const [tourOpen, setTourOpen] = useState(false);
  const [burst, setBurst] = useState<Burst | null>(null);
  const [chestId, setChestId] = useState<string | null>(null);
  const [chestResult, setChestResult] = useState<{ outcomes: ChestOutcome[]; chosen: number; detail: string; delta: number; total: number } | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [boardOpen, setBoardOpen] = useState(false);
  const [myPoints, setMyPoints] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const burstSeq = useRef(0);

  const offset = useRef(0);
  const stats = useRef<Record<number, LocalStats>>({});
  const osc = useRef<Record<number, Record<string, { last?: string; prev?: string; rev: number }>>>({});
  const queue = useMemo(() => createQueue(), []);
  const fsOk = useMemo(() => (typeof window === "undefined" ? true : fullscreenSupported()), []);
  const draftKey = session ? `cnwb:draft:${code}:${session.regNo}` : null;

  const showToast = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast((t) => (t === m ? null : t)), 3500);
  }, []);

  const post = useCallback(
    <T,>(action: string, body: Record<string, unknown> = {}) => {
      if (!session) return Promise.reject(new ApiError(0, "No session"));
      return queue(() => api<T>(`/api/play/${action}`, { body: { code, regNo: session.regNo, ...body }, headers: { "x-attempt-token": session.token } }));
    },
    [code, queue, session],
  );

  const statsPayload = () => Object.fromEntries(Object.entries(stats.current).map(([k, v]) => [k, { ...v, activeMs: Math.round(v.activeMs) }]));

  const absorb = useCallback((a: AttemptPublic, r: RoomPublic) => {
    offset.current = r.serverNow - Date.now();
    a.items.forEach((it, i) => {
      const s = stats.current[i] ?? { activeMs: 0, moves: 0, undos: 0, resets: 0, maxOscillation: 0 };
      stats.current[i] = {
        activeMs: Math.max(s.activeMs, it.stats.activeMs),
        moves: Math.max(s.moves, it.stats.moves),
        undos: Math.max(s.undos, it.stats.undos),
        resets: Math.max(s.resets, it.stats.resets),
        maxOscillation: Math.max(s.maxOscillation, it.stats.maxOscillation),
      };
    });
    setAttempt(a);
    setRoom(r);
    if (a.status === "submitted" || r.phase === "closed") setPhase("done");
    else if (a.status === "lobby") setPhase("lobby");
    else setPhase("work");
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await post<{ attempt: AttemptPublic; room: RoomPublic }>("state", {
        fullscreen: !!document.fullscreenElement,
        visible: !document.hidden,
        stats: statsPayload(),
      });
      setOnline(true);
      absorb(res.attempt, res.room);
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 401) setPhase("replaced");
      else if (err.status === 404) {
        lsDel(`cnwb:session:${code}`);
        router.replace(`/?code=${code}`);
      } else {
        setOnline(false);
        setError(err.message);
        setPhase((p) => (p === "loading" ? "error" : p));
      }
    }
  }, [absorb, code, post, router]);

  // Session bootstrap
  useEffect(() => {
    const s = lsGet<Session | null>(`cnwb:session:${code}`, null);
    if (!s) {
      router.replace(`/?code=${code}`);
      return;
    }
    setSession(s);
    setCurrent(lsGet<number>(`cnwb:current:${code}:${s.regNo}`, 0));
    setDrafts(lsGet<Record<number, unknown>>(`cnwb:draft:${code}:${s.regNo}`, {}));
  }, [code, router]);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  // Guidance: on by default, remembered per device.
  useEffect(() => {
    setGuideOnState(lsGet<boolean>("cnwb:guide", true));
  }, []);
  const setGuideOn = (v: boolean) => {
    setGuideOnState(v);
    lsSet("cnwb:guide", v);
    showToast(v ? "Guide on. Instructions appear above each question." : "Guide off. Turn it back on with the Guide switch in the top bar.");
  };
  useEffect(() => {
    if (phase === "work" && guideOn && isFs && !lsGet<boolean>("cnwb:toured", false)) setTourOpen(true);
  }, [phase, guideOn, isFs]);
  const endTour = () => {
    setTourOpen(false);
    lsSet("cnwb:toured", true);
  };

  // Leaderboard: separate, slower poll so it stays cheap on the free Redis tier.
  const loadBoard = useCallback(async () => {
    if (!session) return;
    try {
      const b = await api<Board>("/api/play/board", { body: { code, regNo: session.regNo }, headers: { "x-attempt-token": session.token } });
      setBoard(b);
      if (b.me) setMyPoints(b.me.points);
    } catch {
      /* the board is best-effort */
    }
  }, [code, session]);
  useEffect(() => {
    if (!session || (phase !== "work" && phase !== "done" && phase !== "lobby")) return;
    void loadBoard();
    const t = window.setInterval(loadBoard, boardOpen ? 4000 : 8000);
    return () => window.clearInterval(t);
  }, [phase, session, loadBoard, boardOpen]);
  useEffect(() => {
    if (attempt?.chestPending && attempt.chestId && !chestResult) setChestId(attempt.chestId);
  }, [attempt?.chestPending, attempt?.chestId, chestResult]);

  // Persist drafts and position locally (survives refresh and network drops)
  useEffect(() => {
    if (!draftKey) return;
    const t = window.setTimeout(() => lsSet(draftKey, drafts), 400);
    return () => window.clearTimeout(t);
  }, [drafts, draftKey]);
  useEffect(() => {
    if (session) lsSet(`cnwb:current:${code}:${session.regNo}`, current);
  }, [current, code, session]);

  // Clock
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Heartbeat: telemetry + room state. Plain HTTPS polling works on any network.
  const sync = useCallback(async () => {
    if (!session || phase === "done" || phase === "replaced") return;
    try {
      const res = await post<{ status: string; room: RoomPublic }>("sync", { stats: statsPayload(), fullscreen: !!document.fullscreenElement, visible: !document.hidden });
      setOnline(true);
      offset.current = res.room.serverNow - Date.now();
      setRoom(res.room);
      if (res.room.phase === "closed" || (attempt && res.status !== attempt.status)) void load();
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 401) setPhase("replaced");
      else setOnline(false);
    }
  }, [attempt, load, phase, post, session]);

  useEffect(() => {
    if (!session || phase === "loading") return;
    const t = window.setInterval(sync, phase === "lobby" ? 3000 : 5000);
    return () => window.clearInterval(t);
  }, [phase, session, sync]);

  // Active time per question: counted only while visible and in full screen.
  useEffect(() => {
    if (phase !== "work") return;
    let last = performance.now();
    const t = window.setInterval(() => {
      const nowP = performance.now();
      const dt = nowP - last;
      last = nowP;
      const it = attempt?.items[current];
      if (!it || it.submitted || document.hidden) return;
      if (fsOk && !document.fullscreenElement) return;
      const s = (stats.current[current] ??= { activeMs: 0, moves: 0, undos: 0, resets: 0, maxOscillation: 0 });
      s.activeMs += Math.min(dt, 5000);
    }, 1000);
    return () => window.clearInterval(t);
  }, [phase, current, attempt, fsOk]);

  // Integrity sensors
  useIntegrity({
    active: phase === "work",
    onEvent: (e: SensorEvent) => {
      post("events", { events: [{ ...e, itemIndex: current }] }).catch(() => undefined);
    },
    onStateChange: () => {
      const fs = !!document.fullscreenElement;
      setIsFs(fs);
      setAwaySince((a) => (fs ? null : (a ?? Date.now())));
      void sync();
    },
    onFlush: (events) => {
      if (!session) return;
      try {
        navigator.sendBeacon("/api/play/events", new Blob([JSON.stringify({ code, regNo: session.regNo, token: session.token, events })], { type: "application/json" }));
      } catch {
        /* ignore */
      }
    },
  });

  useEffect(() => {
    if (phase === "work") setIsFs(!fsOk || !!document.fullscreenElement);
  }, [phase, fsOk]);

  async function begin() {
    setBeginBusy(true);
    setError(null);
    if (fsOk) {
      const ok = await enterFullscreen();
      if (!ok) {
        setError("Full screen was blocked. Allow it and try again.");
        setBeginBusy(false);
        return;
      }
    }
    try {
      const res = await post<{ attempt: AttemptPublic; room: RoomPublic }>("begin");
      absorb(res.attempt, res.room);
      setIsFs(!fsOk || !!document.fullscreenElement);
    } catch (e) {
      setError((e as Error).message);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    } finally {
      setBeginBusy(false);
    }
  }

  const move = (idx: number) => (element: string, value?: string) => {
    const s = (stats.current[idx] ??= { activeMs: 0, moves: 0, undos: 0, resets: 0, maxOscillation: 0 });
    s.moves += 1;
    if (value !== undefined) {
      const m = (osc.current[idx] ??= {});
      const tr = (m[element] ??= { rev: 0 });
      if (tr.last !== undefined && tr.prev !== undefined && value === tr.prev && value !== tr.last) tr.rev += 1;
      tr.prev = tr.last;
      tr.last = value;
      s.maxOscillation = Math.max(s.maxOscillation, Math.floor(tr.rev / 2));
    }
  };

  async function check(idx: number, cp: string, response: unknown) {
    setPending({ idx, cp });
    try {
      const res = await post<{ verdict: Verdict }>("check", { itemIndex: idx, checkpointId: cp, response, stats: statsPayload() });
      const v = res.verdict;
      setVerdicts((all) => ({ ...all, [idx]: { ...(all[idx] ?? {}), [cp]: v } }));
      const before = attempt?.items[idx];
      const complete = !!before && Object.entries(before.cp).every(([k, c]) => (k === cp ? v.status === "correct" || v.locked : c.correct || c.locked));
      setAttempt((a) => {
        if (!a) return a;
        const items = a.items.slice();
        const it = { ...items[idx]! };
        const prev = it.cp[cp]!;
        it.cp = { ...it.cp, [cp]: { ...prev, checks: v.checks, wrong: v.wrong, locked: v.locked, correct: v.status === "correct", score: v.score ?? (v.status === "correct" ? 1 : prev.score) } };
        items[idx] = it;
        const game = v.award ? { ...a.game, streak: v.award.streak, byItem: { ...a.game.byItem, [idx]: (a.game.byItem[idx] ?? 0) + v.award.points } } : a.game;
        return { ...a, items, game, chestPending: !!v.chest, chestId: v.chest?.id };
      });
      if (v.award) {
        setMyPoints(v.award.total);
        setStreak(v.award.streak);
        if (v.award.points > 0) {
          const onItem = (attempt?.game.byItem[idx] ?? 0) + v.award.points;
          const b: Burst = { id: ++burstSeq.current, points: v.award.points, parts: v.award.parts, streak: v.award.streak, complete: complete && before ? { title: before.title, total: onItem } : undefined };
          setBurst(b);
          window.setTimeout(() => setBurst((x) => (x?.id === b.id ? null : x)), complete ? 2600 : 1900);
        }
      }
      if (v.chest) {
        const id = v.chest.id;
        window.setTimeout(() => setChestId(id), v.award?.points ? 1100 : 0);
      }
      void loadBoard();
      setOnline(true);
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 401) setPhase("replaced");
      else if (err.status === 410) void load();
      else showToast(err.message);
      if (err.status === 0) setOnline(false);
    } finally {
      setPending(null);
    }
  }

  async function submitItem(idx: number) {
    try {
      const res = await post<{ attempt: AttemptPublic; room: RoomPublic }>("submit", { itemIndex: idx, stats: statsPayload() });
      absorb(res.attempt, res.room);
      const next = res.attempt.items.findIndex((it, i) => !it.submitted && i > idx);
      const any = next >= 0 ? next : res.attempt.items.findIndex((it) => !it.submitted);
      if (any >= 0) setCurrent(any);
      void loadBoard();
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setConfirmSubmit(false);
    }
  }

  async function openChest(choice: number) {
    if (!chestId) return;
    try {
      const res = await post<{ result: { outcomes: ChestOutcome[]; chosen: number; detail: string; delta: number; total: number } }>("chest", { id: chestId, choice });
      setChestResult(res.result);
      setMyPoints(res.result.total);
      setAttempt((a) => (a ? { ...a, chestPending: false, chestId: undefined } : a));
      void loadBoard();
    } catch (e) {
      showToast((e as Error).message);
      setChestId(null);
      void load();
    }
  }

  async function finish() {
    try {
      const res = await post<{ attempt: AttemptPublic; room: RoomPublic }>("submit", { finish: true, stats: statsPayload() });
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      absorb(res.attempt, res.room);
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setConfirmFinish(false);
    }
  }

  // ───────── Render ─────────
  if (phase === "loading" || !session) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-[13px] text-fg-3">
        <Spinner className="mr-2" /> Loading your attempt…
      </div>
    );
  }

  if (phase === "replaced") {
    return (
      <CenteredNote title="This session was opened on another device">
        Your register number was used to join this room from another browser, so this window can no longer submit work. Continue on the other device, or rejoin here.
        <div className="mt-4">
          <Button
            variant="primary"
            onClick={() => {
              lsDel(`cnwb:session:${code}`);
              router.replace(`/?code=${code}`);
            }}
          >
            Rejoin on this device
          </Button>
        </div>
      </CenteredNote>
    );
  }

  if (phase === "error" || !attempt || !room) {
    return (
      <CenteredNote title="Can't load the room">
        {error ?? "Something went wrong."}
        <div className="mt-4">
          <Button variant="primary" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      </CenteredNote>
    );
  }

  if (phase === "done") {
    return (
      <div className="min-h-dvh">
        <SlimBar code={code} />
        <Summary attempt={attempt} room={room} board={board} />
      </div>
    );
  }

  if (phase === "lobby") {
    return (
      <div className="min-h-dvh">
        <SlimBar code={code} />
        <Lobby
          attempt={attempt}
          room={room}
          onBegin={begin}
          busy={beginBusy}
          fsSupported={fsOk}
          error={error}
          guideOn={guideOn}
          onGuide={setGuideOn}
          onAvatar={async (v) => {
            setAttempt({ ...attempt, avatar: v });
            try {
              await post("profile", { avatar: v });
            } catch (e) {
              showToast((e as Error).message);
            }
          }}
        />
      </div>
    );
  }

  // Workbench
  const items = attempt.items;
  const idx = Math.min(current, items.length - 1);
  const item = items[idx]!;
  const s = stats.current[idx] ?? { activeMs: 0, moves: 0, undos: 0, resets: 0, maxOscillation: 0 };
  const serverNow = now + offset.current;
  const remaining = room.endAt ? (room.endAt - serverNow) / 1000 : room.durationSec;
  const graceLeft = room.graceEndAt ? (room.graceEndAt - serverNow) / 1000 : 0;
  const inGrace = room.phase === "grace" || (remaining <= 0 && graceLeft > 0);
  const timerTone = inGrace ? "warn" : remaining <= 60 ? "bad" : remaining <= 300 ? "warn" : "neutral";
  const checks = Object.values(item.cp).reduce((a, c) => a + c.checks, 0);
  const wrong = Object.values(item.cp).reduce((a, c) => a + c.wrong, 0);
  const unanswered = items.filter((it) => !it.submitted && Object.values(it.cp).every((c) => c.checks === 0)).length;
  const locked = item.submitted;
  const guide = guideOn ? guideFor(item.templateId, item.templateId === "custom" ? (item.view as { type?: string }).type : undefined) : null;
  const myAvatar = avatarSeed(attempt.regNo, attempt.avatar ?? 0);
  const team = attempt.team !== null && attempt.team !== undefined ? TEAMS[attempt.team] : null;
  const showRank = board && !board.hidden && board.me;
  const tourSteps: TourStep[] = [
    { selector: '[data-tour="rail"]', title: "Your questions", text: "Every question is listed here. Jump between them in any order. Each one shows the points you have earned on it." },
    { selector: '[data-tour="timer"]', title: "Timers", text: "Room is the time left for everyone. Question is the time you have spent on this question, against a benchmark." },
    { selector: '[data-tour="canvas"]', title: "The question", text: "Questions are interactive: you click, drag, flip bits or type. Your numbers differ from your neighbours', so work them out yourself." },
    { selector: "[data-tour-check]", title: "Check each step", text: "Each step has its own Check button and up to 4 checks. A verified step earns points. Fewer tries, more speed and a streak earn more." },
    { selector: '[data-tour="points"]', title: "Points and rank", text: "Your game points and class rank. Click to open the live leaderboard. Points are for the game; your marks come from accuracy and efficiency." },
    { selector: '[data-tour="submit"]', title: "Submit when done", text: "Submit question locks that question. Finish attempt submits everything." },
    { selector: '[data-tour="guide"]', title: "Turning the guide off", text: "This switch controls the how-to-answer box above each question. Click it to turn the guide off once you are comfortable. Click it again any time to bring it back." },
  ];
  const watermark = `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='260' height='140'><text x='10' y='80' transform='rotate(-18 130 70)' font-family='monospace' font-size='14' fill='#808080' fill-opacity='0.07'>${attempt.regNo}</text></svg>`,
  )}")`;

  return (
    <div className="flex h-dvh flex-col overflow-hidden no-select">
      {/* Telemetry bar */}
      <header className="flex h-11 shrink-0 items-center gap-4 border-b border-line bg-bg-2 px-3">
        <LogoMark />
        <span className="mono tnum text-[12px] text-fg-2">{formatCode(code)}</span>
        <span className="h-4 w-px bg-line" />
        <span className="min-w-0 truncate text-[13px]">
          <span className="mono tnum text-fg-3">
            {idx + 1}/{items.length}
          </span>{" "}
          <span className="font-medium">{item.title}</span> <span className="text-[12px] text-fg-3">· {DIFFICULTY_LABEL[item.difficulty]}</span>
        </span>
        <div className="ml-auto flex items-center gap-5 text-[12px]">
          <button
            type="button"
            data-tour="points"
            onClick={() => setBoardOpen(true)}
            className="inline-flex h-7 items-center gap-2 rounded-md border border-line bg-bg-1 px-2 transition-colors hover:border-line-strong"
            title="Open the leaderboard"
          >
            <Trophy size={13} strokeWidth={1.5} className="text-fg-2" />
            <CountUp value={myPoints ?? 0} className="mono tnum text-[13px] font-semibold" />
            <span className="text-fg-3">pts</span>
            {showRank ? (
              <span className="mono tnum text-fg-2">
                #{board.me!.rank}
                <span className="text-fg-3">/{board.players}</span>
              </span>
            ) : null}
            <AnimatePresence>
              {streak >= 2 ? (
                <motion.span key={streak} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-0.5 text-warn">
                  <Flame size={12} strokeWidth={1.75} />
                  <span className="mono tnum">{streak}</span>
                </motion.span>
              ) : null}
            </AnimatePresence>
          </button>
          <span data-tour="timer" className="inline-flex items-center gap-5">
          <Metric label={inGrace ? "Late" : "Room"} tone={timerTone} value={inGrace ? `+${mmss(Math.max(0, -remaining))}` : mmss(Math.max(0, remaining))} />
          <Metric label="Question" value={mmss(s.activeMs / 1000)} sub={`/ ${mmss(item.expectedSec)}`} tone={s.activeMs / 1000 > item.expectedSec ? "warn" : "neutral"} />
          </span>
          <Metric label="Moves" value={String(s.moves)} sub={`/ ${item.optimalMoves}`} />
          <Metric label="Checks" value={String(checks)} sub={wrong ? `· ${wrong} wrong` : ""} tone={wrong >= 3 ? "warn" : "neutral"} />
          <span className={cx("inline-flex items-center gap-1", isFs ? "text-fg-2" : "text-bad")} title={isFs ? "Full screen" : "Not in full screen"}>
            {isFs ? <Maximize2 size={14} strokeWidth={1.5} /> : <Minimize2 size={14} strokeWidth={1.5} />}
            <span className="hidden lg:inline">{isFs ? "Locked" : "Unlocked"}</span>
          </span>
          <span className={cx("inline-flex items-center gap-1", online ? "text-ok" : "text-warn")} title={online ? "Connected" : "Reconnecting"}>
            {online ? <Radio size={14} strokeWidth={1.5} /> : <RadioTower size={14} strokeWidth={1.5} />}
            <span className="hidden lg:inline">{online ? "Live" : "Reconnecting"}</span>
          </span>
          <GuideSwitch on={guideOn} onChange={setGuideOn} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Question rail */}
        <aside data-tour="rail" className="hidden w-60 shrink-0 flex-col border-r border-line bg-bg-1 md:flex">
          <div className="flex items-center gap-2.5 border-b border-line px-3 py-3">
            <Avatar seed={myAvatar} size={28} presence={online ? "online" : "away"} />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium">{attempt.name}</p>
              <p className="mono tnum truncate text-[11px] text-fg-3">{attempt.regNo}</p>
            </div>
            {team ? (
              <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-sm border border-line px-1.5 py-0.5 text-[11px] text-fg-2" title="Your team">
                <span className="h-2 w-2 rounded-full" style={{ background: team.color }} />
                {team.name}
              </span>
            ) : null}
          </div>
          <nav className="min-h-0 flex-1 overflow-auto py-1" aria-label="Questions">
            {items.map((it, i) => {
              const acc = itemAccuracy(it);
              const started = Object.values(it.cp).some((c) => c.checks > 0) || (stats.current[i]?.moves ?? 0) > 0;
              const Icon = it.submitted ? CircleCheck : started ? CircleDot : Circle;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrent(i)}
                  className={cx("relative flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors", i === idx ? "bg-signal-bg" : "hover:bg-bg-3")}
                >
                  {i === idx ? <motion.span layoutId="rail" className="absolute top-1 bottom-1 left-0 w-[2px] rounded-full bg-signal" /> : null}
                  <Icon size={15} strokeWidth={1.5} className={cx(it.submitted ? "text-fg-1" : started ? "text-signal" : "text-fg-3")} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px]">
                      <span className="mono tnum mr-1.5 text-[11px] text-fg-3">{i + 1}</span>
                      {it.title}
                    </span>
                    <span className="block text-[11px] text-fg-3">
                      {DIFFICULTY_LABEL[it.difficulty]}
                      {it.submitted ? " · submitted" : acc > 0 ? ` · ${Math.round(acc * 100)}% verified` : ""}
                    </span>
                  </span>
                  {attempt.game?.byItem[i] ? (
                    <motion.span key={attempt.game.byItem[i]} initial={{ scale: 1.25, color: "var(--ok)" }} animate={{ scale: 1, color: "var(--fg-2)" }} transition={{ duration: 0.6 }} className="mono tnum text-[11px]">
                      +{attempt.game.byItem[i]}
                    </motion.span>
                  ) : null}
                </button>
              );
            })}
          </nav>
          <div className="border-t border-line p-3">
            <Button variant="primary" className="w-full" onClick={() => setConfirmFinish(true)}>
              <CheckCheck size={15} strokeWidth={1.5} /> Finish attempt
            </Button>
          </div>
        </aside>

        {/* Canvas */}
        <main data-tour="canvas" className="relative min-w-0 flex-1 overflow-auto bg-bg-0" style={{ backgroundImage: watermark }}>
          <AnimatePresence mode="wait">
            <motion.div key={idx} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }} className="mx-auto max-w-[1160px] px-5 py-5">
              {guide && !locked ? <GuideCard key={item.templateId + idx} guide={guide} onHide={() => setGuideOn(false)} /> : null}
              {locked ? <p className="mb-3 rounded-md border border-line bg-bg-3 px-3 py-2 text-[12px] text-fg-2">This question is submitted. Its answers are locked.</p> : null}
              <TemplateHost
                templateId={item.templateId}
                view={item.view}
                item={item}
                draft={drafts[idx]}
                setDraft={(d) => setDrafts((all) => ({ ...all, [idx]: d }))}
                move={move(idx)}
                check={(cp, r) => void check(idx, cp, r)}
                pending={pending?.idx === idx ? pending.cp : null}
                verdicts={verdicts[idx] ?? {}}
                locked={locked}
              />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Action bar */}
      <footer className="flex h-12 shrink-0 items-center gap-2 border-t border-line bg-bg-2 px-3">
        <Button variant="ghost" disabled={idx === 0} onClick={() => setCurrent(idx - 1)}>
          <ArrowLeft size={14} strokeWidth={1.5} /> Previous
        </Button>
        <Button variant="ghost" disabled={idx === items.length - 1} onClick={() => setCurrent(idx + 1)}>
          Next <ArrowRight size={14} strokeWidth={1.5} />
        </Button>
        <span className="ml-3 hidden text-[12px] text-fg-3 sm:inline">
          Benchmark: about <span className="mono tnum">{mmss(item.expectedSec)}</span> and <span className="mono tnum">{item.optimalMoves}</span> moves
        </span>
        <div data-tour="submit" className="ml-auto flex items-center gap-2">
          <Button variant="secondary" className="md:hidden" onClick={() => setConfirmFinish(true)}>
            Finish
          </Button>
          {!locked ? (
            confirmSubmit ? (
              <>
                <span className="text-[12px] text-fg-2">Lock this question?</span>
                <Button variant="ghost" onClick={() => setConfirmSubmit(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={() => void submitItem(idx)}>
                  Submit question
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={() => setConfirmSubmit(true)}>
                Submit question
              </Button>
            )
          ) : null}
        </div>
      </footer>

      {/* Integrity pause overlay */}
      <AnimatePresence>
        {fsOk && !isFs ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="fixed inset-0 z-50 flex items-center justify-center bg-bg-0/[0.985] px-4">
            <div className="max-w-[440px] text-center">
              <Minimize2 size={22} strokeWidth={1.5} className="mx-auto text-fg-2" />
              <h2 className="mt-3 text-[18px] font-semibold">Assessment paused</h2>
              <p className="mt-2 text-[13px] text-fg-2">You left full screen. This has been recorded and the room timer is still running. Return to full screen to continue.</p>
              <Button
                variant="primary"
                size="lg"
                className="mt-5"
                onClick={async () => {
                  await enterFullscreen();
                  setIsFs(!!document.fullscreenElement);
                }}
              >
                <Maximize2 size={15} strokeWidth={1.5} /> Return to full screen
              </Button>
              {awaySince ? <p className="mono tnum mt-4 text-[12px] text-fg-3">Away {mmss((now - awaySince) / 1000)}</p> : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Finish dialog */}
      <AnimatePresence>
        {confirmFinish ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 flex items-center justify-center px-4" style={{ background: "var(--scrim)" }}>
            <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.16 }} className="w-full max-w-[440px] rounded-lg border border-line bg-bg-2 p-5 shadow-[var(--shadow-pop)]">
              <h2 className="text-[16px] font-semibold">Finish your attempt?</h2>
              <p className="mt-2 text-[13px] text-fg-2">
                All questions will be locked and submitted.
                {unanswered > 0 ? ` ${unanswered} question${unanswered === 1 ? " has" : "s have"} no checks yet.` : ""}
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setConfirmFinish(false)}>
                  Keep working
                </Button>
                <Button variant="primary" onClick={() => void finish()}>
                  Finish and submit
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Points popup, chests, leaderboard, tour */}
      <ScoreBurst burst={burst} />
      <AnimatePresence>
        {chestId ? (
          <ChestModal
            key={chestId}
            onPick={(i) => void openChest(i)}
            result={chestResult}
            onClose={() => {
              setChestId(null);
              setChestResult(null);
            }}
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {boardOpen ? (
          <>
            <motion.div key="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[45]" style={{ background: "var(--scrim)" }} onClick={() => setBoardOpen(false)} />
            <motion.aside
              key="drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="fixed top-0 right-0 bottom-0 z-[46] flex w-full max-w-[380px] flex-col border-l border-line bg-bg-1"
              aria-label="Leaderboard"
            >
              <header className="flex h-11 items-center gap-2 border-b border-line px-3">
                <span className="text-[13px] font-semibold">Live standings</span>
                <span className="text-[11px] text-fg-3">updates after every check</span>
                <span className="ml-auto" />
                <CloseX onClick={() => setBoardOpen(false)} />
              </header>
              <div className="min-h-0 flex-1 overflow-auto p-3">
                <BoardPanel board={board} />
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
      {tourOpen && (!fsOk || isFs) ? <Tour steps={tourSteps} onDone={endTour} /> : null}

      {/* Toast */}
      <AnimatePresence>
        {toast ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed right-4 bottom-16 z-[60] flex max-w-[360px] items-center gap-2 rounded-lg border border-line bg-bg-2 px-3 py-2.5 text-[13px] shadow-[var(--shadow-pop)]"
            role="status"
          >
            {!online ? <WifiOff size={14} strokeWidth={1.5} className="text-warn" /> : null}
            {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Metric({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub?: string; tone?: "neutral" | "warn" | "bad" }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-fg-3">{label}</span>
      <span className={cx("mono tnum text-[13px] font-medium", tone === "warn" && "text-warn", tone === "bad" && "text-bad", tone === "neutral" && "text-fg-1")}>{value}</span>
      {sub ? <span className="mono tnum text-fg-3">{sub}</span> : null}
    </span>
  );
}

function SlimBar({ code }: { code: string }) {
  return (
    <header className="flex h-12 items-center gap-3 border-b border-line px-4">
      <LogoMark />
      <span className="text-[13px] font-semibold">CN Workbench</span>
      <span className="mono tnum text-[12px] text-fg-3">{formatCode(code)}</span>
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}

function CenteredNote({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-[460px] rounded-lg border border-line bg-bg-1 p-6">
        <h1 className="text-[16px] font-semibold">{title}</h1>
        <div className="mt-2 text-[13px] text-fg-2">{children}</div>
      </div>
    </div>
  );
}

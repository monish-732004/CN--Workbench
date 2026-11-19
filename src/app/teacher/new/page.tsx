"use client";

import { Check, Coins, Flag, Minus, Plus, Trophy, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { TopBar } from "@/components/chrome";
import { QuestionBuilder, toPayload, useQuestionLibrary, checkQuestion } from "@/components/teacher/QuestionBuilder";
import { Button, cx, Field, Input, Segmented } from "@/components/ui";
import { buildSlots, DIFFICULTY_LABEL, estimateSeconds, isCustomSlot, TOPIC_BY_ID, TOPICS, UNITS } from "@/engine/catalog";
import { GAME_MODES, TEAMS, type GameMode } from "@/engine/model";
import type { Difficulty } from "@/engine/types";
import { api, rememberHostRoom } from "@/lib/client";
import { minutes } from "@/lib/format";

type DurationMode = "1.25" | "1.5" | "custom";
type LateMode = "flag" | "penalise" | "lock";

export default function NewRoom() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [section, setSection] = useState("");
  const [topics, setTopics] = useState<string[]>(["mask", "vlsm", "crc"]);
  const [mix, setMix] = useState<Record<Difficulty, number>>({ easy: 2, medium: 2, hard: 1 });
  const [durationMode, setDurationMode] = useState<DurationMode>("1.25");
  const [customMin, setCustomMin] = useState(50);
  const [lateMode, setLateMode] = useState<LateMode>("flag");
  const [graceMin, setGraceMin] = useState(10);
  const [feedback, setFeedback] = useState<"binary" | "checkpoint">("binary");
  const [gameMode, setGameMode] = useState<GameMode>("classic");
  const [showBoard, setShowBoard] = useState(true);
  const [teamsOn, setTeamsOn] = useState(false);
  const [teamCount, setTeamCount] = useState(4);
  const [lib, setLib] = useQuestionLibrary();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const custom = useMemo(() => lib.filter((q) => q.include && !checkQuestion(q)).map(toPayload), [lib]);
  const slots = useMemo(() => buildSlots(topics, mix, custom), [topics, mix, custom]);
  const est = estimateSeconds(slots, custom);
  const durationSec = durationMode === "custom" ? customMin * 60 : Math.ceil((est * Number(durationMode)) / 60) * 60;
  const total = mix.easy + mix.medium + mix.hard;

  const toggle = (id: string) => setTopics((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  const toggleUnit = (u: number) => {
    const ids = TOPICS.filter((t) => t.unit === u).map((t) => t.id);
    const all = ids.every((id) => topics.includes(id));
    setTopics((t) => (all ? t.filter((x) => !ids.includes(x)) : [...new Set([...t, ...ids])]));
  };

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ code: string; hostKey: string }>("/api/rooms", {
        body: {
          title,
          section,
          topics,
          mix: topics.length ? mix : { easy: 0, medium: 0, hard: 0 },
          durationMode,
          customMinutes: customMin,
          lateMode,
          graceMin,
          feedback,
          game: { mode: gameMode, leaderboard: showBoard, teams: teamsOn ? teamCount : 0 },
          custom,
        },
      });
      rememberHostRoom({ code: res.code, hostKey: res.hostKey, title: title || "Class quiz", section, createdAt: Date.now() });
      router.push(`/teacher/room/${res.code}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh">
      <TopBar>
        <span className="text-[13px] text-fg-3">/</span>
        <span className="text-[13px] text-fg-2">Teacher console</span>
        <span className="text-[13px] text-fg-3">/</span>
        <span className="text-[13px] font-medium">New room</span>
      </TopBar>
      <main className="mx-auto grid max-w-[1200px] gap-5 px-4 py-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="rounded-lg border border-line bg-bg-1 p-5">
            <h2 className="text-[14px] font-semibold">Details</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_200px]">
              <Field label="Title">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Unit 2 · Subnetting check" />
              </Field>
              <Field label="Section">
                <Input value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. K2" />
              </Field>
            </div>
          </section>

          <section className="rounded-lg border border-line bg-bg-1">
            <header className="flex items-center justify-between border-b border-line px-5 py-3">
              <div>
                <h2 className="text-[14px] font-semibold">Scope</h2>
                <p className="text-[12px] text-fg-3">Tick what you taught. Questions rotate across the selected topics.</p>
              </div>
              <span className="tnum text-[12px] text-fg-2">{topics.length} selected</span>
            </header>
            <div className="divide-y divide-line">
              {UNITS.map((u) => {
                const unitTopics = TOPICS.filter((t) => t.unit === u.id);
                const allOn = unitTopics.every((t) => topics.includes(t.id));
                return (
                  <div key={u.id} className="px-5 py-3">
                    <button type="button" onClick={() => toggleUnit(u.id)} className="group flex w-full items-center gap-2 text-left">
                      <span className="mono tnum text-[11px] text-fg-3">U{u.id}</span>
                      <span className="text-[13px] font-medium">{u.title}</span>
                      <span className="ml-auto text-[12px] text-fg-3 group-hover:text-fg-1">{allOn ? "Clear unit" : "Select unit"}</span>
                    </button>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {unitTopics.map((t) => {
                        const on = topics.includes(t.id);
                        return (
                          <button
                            type="button"
                            key={t.id}
                            onClick={() => toggle(t.id)}
                            aria-pressed={on}
                            className={cx(
                              "flex items-start gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
                              on ? "border-signal/50 bg-signal-bg" : "border-line hover:bg-bg-3",
                            )}
                          >
                            <span className={cx("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border", on ? "border-signal bg-signal text-white" : "border-line-strong")}>
                              {on ? <Check size={12} strokeWidth={2.5} /> : null}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[13px] font-medium">{t.title}</span>
                              <span className="block text-[12px] text-fg-2">{t.mechanic}</span>
                              <span className="mono tnum mt-0.5 block text-[11px] text-fg-3">
                                {Math.round(t.expected.easy / 60 * 10) / 10}–{Math.round((t.expected.hard / 60) * 10) / 10} min
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <QuestionBuilder lib={lib} setLib={setLib} />

          <section className="rounded-lg border border-line bg-bg-1">
            <header className="border-b border-line px-5 py-3">
              <h2 className="text-[14px] font-semibold">Game</h2>
              <p className="text-[12px] text-fg-3">Points, leaderboard and teams are for engagement. Marks still come from accuracy and efficiency only.</p>
            </header>
            <div className="grid gap-2 px-5 pt-4 sm:grid-cols-3">
              {(Object.keys(GAME_MODES) as GameMode[]).map((m) => {
                const on = gameMode === m;
                const Icon = m === "classic" ? Trophy : m === "gold" ? Coins : Flag;
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setGameMode(m)}
                    className={cx("rounded-md border px-3 py-2.5 text-left transition-colors", on ? "border-signal/60 bg-signal-bg" : "border-line hover:bg-bg-3")}
                  >
                    <span className="flex items-center gap-1.5 text-[13px] font-medium">
                      <Icon size={14} strokeWidth={1.5} className={on ? "text-signal" : "text-fg-3"} />
                      {GAME_MODES[m].label}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-fg-2">{GAME_MODES[m].blurb}</span>
                  </button>
                );
              })}
            </div>
            <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
              <ToggleRow on={showBoard} onChange={setShowBoard} title="Show leaderboard to students" text="Top 10, each student's own rank and team standings, updated after every check. Off: students see only their own points." />
              <div>
                <ToggleRow on={teamsOn} onChange={setTeamsOn} title="Team mode" text="Students are split into teams as they join. A team's score is the average of its members, so team size doesn't matter." />
                {teamsOn ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3 pl-11">
                    <div className="inline-flex items-center rounded-md border border-line-strong">
                      <button type="button" aria-label="Fewer teams" disabled={teamCount <= 2} className="flex h-8 w-8 items-center justify-center text-fg-2 hover:text-fg-1 disabled:opacity-30" onClick={() => setTeamCount((n) => n - 1)}>
                        <Minus size={14} strokeWidth={1.5} />
                      </button>
                      <span className="mono tnum w-8 text-center text-[14px]">{teamCount}</span>
                      <button type="button" aria-label="More teams" disabled={teamCount >= 8} className="flex h-8 w-8 items-center justify-center text-fg-2 hover:text-fg-1 disabled:opacity-30" onClick={() => setTeamCount((n) => n + 1)}>
                        <Plus size={14} strokeWidth={1.5} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {TEAMS.slice(0, teamCount).map((t) => (
                        <span key={t.name} className="inline-flex items-center gap-1 rounded-sm border border-line px-1.5 py-0.5 text-[11px] text-fg-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="grid gap-5 md:grid-cols-2">
            <div className="rounded-lg border border-line bg-bg-1 p-5">
              <h2 className="text-[14px] font-semibold">Difficulty mix</h2>
              <p className="text-[12px] text-fg-3">Platform questions per level · max 15 in total{topics.length ? "" : " · no topics selected"}</p>
              <div className="mt-4 space-y-2">
                {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                  <div key={d} className="flex items-center gap-3">
                    <span className="w-16 text-[13px]">{DIFFICULTY_LABEL[d]}</span>
                    <div className="inline-flex items-center rounded-md border border-line-strong">
                      <button type="button" aria-label={`Fewer ${d}`} className="flex h-8 w-8 items-center justify-center text-fg-2 hover:text-fg-1" onClick={() => setMix((m) => ({ ...m, [d]: Math.max(0, m[d] - 1) }))}>
                        <Minus size={14} strokeWidth={1.5} />
                      </button>
                      <span className="mono tnum w-8 text-center text-[14px]">{mix[d]}</span>
                      <button
                        type="button"
                        aria-label={`More ${d}`}
                        className="flex h-8 w-8 items-center justify-center text-fg-2 hover:text-fg-1 disabled:opacity-30"
                        disabled={total >= 15}
                        onClick={() => setMix((m) => ({ ...m, [d]: m[d] + 1 }))}
                      >
                        <Plus size={14} strokeWidth={1.5} />
                      </button>
                    </div>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-3">
                      <div className={cx("h-full rounded-full transition-[width] duration-200", d === "easy" ? "bg-cat-3" : d === "medium" ? "bg-cat-2" : "bg-cat-4")} style={{ width: `${(mix[d] / 15) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-line bg-bg-1 p-5">
              <h2 className="text-[14px] font-semibold">Session window</h2>
              <p className="text-[12px] text-fg-3">Based on the estimated solve time of this paper</p>
              <div className="mt-4 space-y-3">
                <Segmented<DurationMode>
                  value={durationMode}
                  onChange={setDurationMode}
                  options={[
                    { value: "1.25", label: "1.25×" },
                    { value: "1.5", label: "1.5×" },
                    { value: "custom", label: "Custom" },
                  ]}
                />
                {durationMode === "custom" ? (
                  <Field label="Minutes">
                    <Input mono type="number" min={5} max={240} value={customMin} onChange={(e) => setCustomMin(Number(e.target.value))} className="w-28" />
                  </Field>
                ) : null}
                <dl className="grid grid-cols-2 gap-y-1 text-[13px]">
                  <dt className="text-fg-2">Estimated</dt>
                  <dd className="mono tnum text-right">{minutes(est)}</dd>
                  <dt className="text-fg-2">Session</dt>
                  <dd className="mono tnum text-right font-medium">{minutes(durationSec)}</dd>
                </dl>
              </div>
            </div>
          </section>

          <section className="grid gap-5 md:grid-cols-2">
            <div className="rounded-lg border border-line bg-bg-1 p-5">
              <h2 className="text-[14px] font-semibold">Late submissions</h2>
              <div className="mt-3 space-y-3">
                <Segmented<LateMode>
                  value={lateMode}
                  onChange={setLateMode}
                  options={[
                    { value: "flag", label: "Accept, flag" },
                    { value: "penalise", label: "Accept, deduct" },
                    { value: "lock", label: "Hard lock" },
                  ]}
                />
                <p className="text-[12px] text-fg-2">
                  {lateMode === "flag" && "Work after the end time is accepted and marked late. No deduction."}
                  {lateMode === "penalise" && "Late work loses 2% per started 5 minutes (cap 30%). Adjustable in Results."}
                  {lateMode === "lock" && "Attempts auto-submit at the end time. Nothing after it counts."}
                </p>
                {lateMode !== "lock" ? (
                  <Field label="Grace after end (minutes)">
                    <Input mono type="number" min={0} max={60} value={graceMin} onChange={(e) => setGraceMin(Number(e.target.value))} className="w-28" />
                  </Field>
                ) : null}
              </div>
            </div>
            <div className="rounded-lg border border-line bg-bg-1 p-5">
              <h2 className="text-[14px] font-semibold">Feedback to students</h2>
              <div className="mt-3 space-y-3">
                <Segmented<"binary" | "checkpoint">
                  value={feedback}
                  onChange={setFeedback}
                  options={[
                    { value: "binary", label: "Correct / incorrect" },
                    { value: "checkpoint", label: "Show which fields" },
                  ]}
                />
                <p className="text-[12px] text-fg-2">
                  {feedback === "binary" ? "Each check says only whether the step is right. Harder to guess your way through." : "Wrong fields are outlined after a check. More guidance, more room for trial and error."}
                </p>
                <p className="text-[12px] text-fg-3">Each checkpoint allows 4 checks.</p>
              </div>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-16 lg:self-start">
          <div className="rounded-lg border border-line bg-bg-1">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-[14px] font-semibold">Paper</h2>
              <p className="text-[12px] text-fg-3">Same topics and levels for everyone. Values, options and order differ per student.</p>
            </div>
            <ol className="max-h-[46vh] divide-y divide-line overflow-auto">
              {slots.length === 0 ? (
                <li className="px-5 py-6 text-[13px] text-fg-3">Select topics and add questions.</li>
              ) : (
                slots.map((s, i) => (
                  <li key={i} className="flex items-center gap-3 px-5 py-2 text-[13px]">
                    <span className="mono tnum w-5 text-[11px] text-fg-3">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {isCustomSlot(s) ? (
                        <>
                          <span className="mr-1.5 rounded-sm border border-line px-1 text-[10px] text-fg-3">Own</span>
                          {custom.find((c) => `custom:${c.id}` === s.topicId)?.title}
                        </>
                      ) : (
                        TOPIC_BY_ID[s.topicId]?.title
                      )}
                    </span>
                    <span className={cx("text-[11px] font-medium", s.difficulty === "easy" ? "text-cat-3" : s.difficulty === "medium" ? "text-cat-2" : "text-cat-4")}>{DIFFICULTY_LABEL[s.difficulty]}</span>
                  </li>
                ))
              )}
            </ol>
            <div className="space-y-3 border-t border-line px-5 py-4">
              <div className="flex justify-between text-[13px]">
                <span className="text-fg-2">Questions</span>
                <span className="mono tnum">{slots.length}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-fg-2">Session</span>
                <span className="mono tnum">{minutes(durationSec)}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-fg-2">Game</span>
                <span className="inline-flex items-center gap-1.5">
                  {GAME_MODES[gameMode].label}
                  {teamsOn ? (
                    <span className="inline-flex items-center gap-1 text-fg-2">
                      · <Users size={13} strokeWidth={1.5} /> {teamCount} teams
                    </span>
                  ) : null}
                </span>
              </div>
              {slots.length > 25 ? <p className="text-[12px] text-bad">A room can have at most 25 questions.</p> : null}
              {error ? <p className="text-[12px] text-bad">{error}</p> : null}
              <Button variant="primary" size="lg" className="w-full" disabled={busy || slots.length === 0 || slots.length > 25} onClick={create}>
                {busy ? "Creating…" : "Create room"}
              </Button>
              <p className="text-[12px] text-fg-3">The room opens in a waiting state. Start it when the class is ready.</p>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

function ToggleRow({ on, onChange, title, text }: { on: boolean; onChange: (v: boolean) => void; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={title}
        onClick={() => onChange(!on)}
        className={cx("relative mt-0.5 h-5 w-8 shrink-0 rounded-full border transition-colors", on ? "border-signal bg-signal" : "border-line-strong bg-bg-3")}
      >
        <span className={cx("absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-[left] duration-150", on ? "left-[14px]" : "left-0.5")} />
      </button>
      <div>
        <p className="text-[13px] font-medium">{title}</p>
        <p className="text-[12px] text-fg-2">{text}</p>
      </div>
    </div>
  );
}

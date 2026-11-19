"use client";

import { Download, FileSpreadsheet, FileText, RotateCcw, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, type ReactNode } from "react";
import { DIFFICULTY_LABEL } from "@/engine/catalog";
import { avatarSeed, DEFAULT_SCORING, INTEGRITY_LABEL, type ScoringConfig } from "@/engine/model";
import { misconceptionText } from "@/engine/misconceptions";
import { severity, TE_RULE_TEXT } from "@/engine/scoring";
import { exportCsv, exportPdf, exportXlsx } from "@/lib/export";
import { clockTime, mmss, pct } from "@/lib/format";
import { Avatar } from "../Avatar";
import { Button, cx, EmptyState, Meter, Panel, Segmented, Tag } from "../ui";
import { EVENT_ICON, TIER_TAG } from "./LiveView";
import type { HostData, Scored } from "./types";

type SortKey = "marks" | "name" | "reg";

export function ResultsView({
  data,
  scored,
  cfg,
  dirty,
  setCfg,
  onSave,
  onExcuse,
}: {
  data: HostData;
  scored: Scored[];
  cfg: ScoringConfig;
  dirty: boolean;
  setCfg: (c: ScoringConfig | null) => void;
  onSave: () => Promise<void>;
  onExcuse: (reg: string, eventId: string, undo: boolean) => void;
  hostKey: string;
}) {
  const [sort, setSort] = useState<SortKey>("marks");
  const [open, setOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const rows = useMemo(() => {
    const r = scored.slice();
    if (sort === "name") r.sort((a, b) => a.a.name.localeCompare(b.a.name));
    else if (sort === "reg") r.sort((a, b) => a.a.regNo.localeCompare(b.a.regNo));
    else r.sort((a, b) => b.s.marks - a.s.marks || b.s.score - a.s.score);
    return r;
  }, [scored, sort]);
  const upd = (patch: (c: ScoringConfig) => ScoringConfig) => setCfg(patch(structuredClone(cfg)));
  const meta = { code: data.room.code, title: data.room.title, section: data.room.section, startAt: data.room.startAt, cfg };
  const mean = rows.length ? rows.reduce((s, x) => s + x.s.marks, 0) / rows.length : 0;

  const mistakes = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of scored) {
      const seen = new Set<string>();
      x.s.items.forEach((it) => it.misconceptions.forEach((t) => seen.add(t)));
      seen.forEach((t) => m.set(t, (m.get(t) ?? 0) + 1));
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [scored]);

  const selected = rows.find((x) => x.a.regNo === open) ?? null;

  const doExport = async (kind: "csv" | "xlsx" | "pdf") => {
    setExporting(kind);
    try {
      if (kind === "csv") exportCsv(rows, meta);
      else if (kind === "xlsx") await exportXlsx(rows, meta);
      else await exportPdf(rows, meta);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
      <div className="space-y-4">
        <Panel
          title="Judging criteria"
          actions={
            <button type="button" className="inline-flex items-center gap-1 text-[12px] text-fg-3 hover:text-fg-1" onClick={() => setCfg(structuredClone(DEFAULT_SCORING))}>
              <RotateCcw size={12} strokeWidth={1.5} /> Defaults
            </button>
          }
          bodyClass="p-4 space-y-5"
        >
          <Group title="Difficulty weights" hint="How much each level counts">
            <div className="grid grid-cols-3 gap-2">
              {(["easy", "medium", "hard"] as const).map((d) => (
                <NumberBox key={d} label={DIFFICULTY_LABEL[d]} value={cfg.weights[d]} step={0.5} min={0} max={10} onChange={(v) => upd((c) => ((c.weights[d] = v), c))} />
              ))}
            </div>
          </Group>

          <Group
            title="Efficiency"
            hint="Time, moves and wrong checks against the benchmark"
            right={<Switch on={cfg.efficiency.enabled} onChange={(v) => upd((c) => ((c.efficiency.enabled = v), c))} label="Apply efficiency" />}
          >
            <div className={cx("space-y-2", !cfg.efficiency.enabled && "pointer-events-none opacity-45")}>
              <Slider label="Time" value={cfg.efficiency.time} onChange={(v) => upd((c) => ((c.efficiency.time = v), c))} />
              <Slider label="Moves" value={cfg.efficiency.moves} onChange={(v) => upd((c) => ((c.efficiency.moves = v), c))} />
              <Slider label="Wrong checks" value={cfg.efficiency.wrong} onChange={(v) => upd((c) => ((c.efficiency.wrong = v), c))} />
              <label className="flex items-center justify-between pt-1 text-[12px] text-fg-2">
                Clean-mastery bonus (+5%)
                <Switch on={cfg.efficiency.bonus} onChange={(v) => upd((c) => ((c.efficiency.bonus = v), c))} label="Clean-mastery bonus" />
              </label>
            </div>
          </Group>

          <Group title="Integrity" hint="Full-screen exits, tab switches and other events">
            <Segmented
              size="sm"
              value={cfg.integrity.mode}
              onChange={(v) => upd((c) => ((c.integrity.mode = v), c))}
              options={[
                { value: "enforced", label: "Reduces score" },
                { value: "advisory", label: "Shown only" },
              ]}
            />
            <div className={cx("mt-2 grid grid-cols-2 gap-2", cfg.integrity.mode === "advisory" && "opacity-45")}>
              <NumberBox label="Lowest factor" value={cfg.integrity.floor} step={0.05} min={0} max={1} onChange={(v) => upd((c) => ((c.integrity.floor = v), c))} />
              <NumberBox label="Strictness ×" value={cfg.integrity.scale} step={0.25} min={0} max={3} onChange={(v) => upd((c) => ((c.integrity.scale = v), c))} />
            </div>
          </Group>

          <Group title="Late submissions">
            <Segmented
              size="sm"
              value={cfg.late.mode}
              onChange={(v) => upd((c) => ((c.late.mode = v), c))}
              options={[
                { value: "none", label: "No deduction" },
                { value: "penalise", label: "Deduct" },
              ]}
            />
            {cfg.late.mode === "penalise" ? (
              <div className="mt-2 grid grid-cols-3 gap-2">
                <NumberBox label="% per step" value={cfg.late.ratePct} step={1} min={0} max={50} onChange={(v) => upd((c) => ((c.late.ratePct = v), c))} />
                <NumberBox label="Step (min)" value={cfg.late.stepMin} step={1} min={1} max={60} onChange={(v) => upd((c) => ((c.late.stepMin = v), c))} />
                <NumberBox label="Cap %" value={cfg.late.capPct} step={5} min={0} max={100} onChange={(v) => upd((c) => ((c.late.capPct = v), c))} />
              </div>
            ) : null}
          </Group>

          <Group title="Marks">
            <div className="grid grid-cols-2 gap-2">
              <NumberBox label="Out of" value={cfg.maxMarks} step={1} min={1} max={100} onChange={(v) => upd((c) => ((c.maxMarks = v), c))} />
              <label className="block">
                <span className="mb-1 block text-[11px] text-fg-3">Round to</span>
                <select
                  value={cfg.rounding}
                  onChange={(e) => upd((c) => ((c.rounding = Number(e.target.value)), c))}
                  className="mono h-8 w-full rounded-md border border-line-strong bg-bg-1 px-2 text-[13px] outline-none focus:border-signal"
                >
                  {[0, 0.1, 0.25, 0.5, 1].map((r) => (
                    <option key={r} value={r}>
                      {r === 0 ? "No rounding" : r}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Group>

          <div className="flex items-center justify-between gap-2 border-t border-line pt-4">
            <span className="text-[12px] text-fg-3">{dirty ? "Preview: not saved yet" : "Saved with this room"}</span>
            <div className="flex gap-2">
              {dirty ? (
                <Button size="sm" variant="ghost" onClick={() => setCfg(null)}>
                  Discard
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="primary"
                disabled={!dirty || saving}
                onClick={async () => {
                  setSaving(true);
                  await onSave();
                  setSaving(false);
                }}
              >
                {saving ? "Saving…" : "Save criteria"}
              </Button>
            </div>
          </div>
        </Panel>

        <Panel title="Common mistakes" bodyClass="p-2">
          {mistakes.length === 0 ? (
            <p className="px-2 py-3 text-[12px] text-fg-3">Patterns appear once students make checks.</p>
          ) : (
            <ul>
              {mistakes.map(([tag, n]) => (
                <li key={tag} className="flex items-center gap-3 rounded-md px-2 py-1.5">
                  <span className="mono tnum w-6 text-right text-[12px] text-fg-1">{n}</span>
                  <span className="min-w-0 flex-1 text-[12px] text-fg-2">{misconceptionText(tag)}</span>
                  <Meter value={n / Math.max(1, scored.length)} className="w-14" />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title={`Marks · ${rows.length} student${rows.length === 1 ? "" : "s"}`}
        actions={
          <div className="flex items-center gap-2">
            <span className="hidden text-[12px] text-fg-3 md:inline">
              Mean <span className="mono tnum text-fg-1">{mean.toFixed(2)}</span> / {cfg.maxMarks}
            </span>
            <Segmented
              size="sm"
              value={sort}
              onChange={setSort}
              options={[
                { value: "marks", label: "Marks" },
                { value: "reg", label: "Reg. no" },
                { value: "name", label: "Name" },
              ]}
            />
            <Button size="sm" variant="secondary" disabled={!rows.length || !!exporting} onClick={() => void doExport("csv")}>
              <Download size={13} strokeWidth={1.5} /> CSV
            </Button>
            <Button size="sm" variant="secondary" disabled={!rows.length || !!exporting} onClick={() => void doExport("xlsx")}>
              <FileSpreadsheet size={13} strokeWidth={1.5} /> Excel
            </Button>
            <Button size="sm" variant="secondary" disabled={!rows.length || !!exporting} onClick={() => void doExport("pdf")}>
              <FileText size={13} strokeWidth={1.5} /> PDF
            </Button>
          </div>
        }
        bodyClass="overflow-auto"
      >
        {rows.length === 0 ? (
          <EmptyState>No attempts yet.</EmptyState>
        ) : (
          <table className="w-full min-w-[900px] text-[13px]">
            <thead className="sticky top-0 z-10 bg-bg-1">
              <tr className="border-b border-line-strong text-left text-[11px] text-fg-2">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Student</th>
                <th className="px-3 py-2 text-right font-medium">Marks</th>
                <th className="px-3 py-2 text-right font-medium">Score</th>
                <th className="px-3 py-2 font-medium">Accuracy</th>
                <th className="px-3 py-2 text-right font-medium">Mastery</th>
                <th className="px-3 py-2 font-medium">Integrity</th>
                <th className="px-3 py-2 text-right font-medium">Late</th>
                <th className="px-3 py-2 text-right font-medium">T&amp;E</th>
                <th className="px-3 py-2 text-right font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x, i) => (
                <tr key={x.a.regNo} onClick={() => setOpen(x.a.regNo)} className="cursor-pointer border-b border-line transition-colors last:border-b-0 hover:bg-bg-3">
                  <td className="mono tnum px-3 py-2 text-fg-3">{i + 1}</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2.5">
                      <Avatar seed={avatarSeed(x.a.regNo, x.a.avatar ?? 0)} size={26} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{x.a.name}</span>
                        <span className="mono tnum block text-[11px] text-fg-3">{x.a.regNo}</span>
                      </span>
                    </span>
                  </td>
                  <td className="mono tnum px-3 py-2 text-right text-[15px] font-semibold">{x.s.marks}</td>
                  <td className="mono tnum px-3 py-2 text-right">{x.s.score.toFixed(1)}</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <Meter value={x.s.accuracy} tone={x.s.accuracy > 0.85 ? "ok" : undefined} className="w-16" />
                      <span className="mono tnum text-[12px]">{pct(x.s.accuracy, 0)}</span>
                    </span>
                  </td>
                  <td className="mono tnum px-3 py-2 text-right">{pct(x.s.mastery, 0)}</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      {TIER_TAG[x.s.tier]}
                      <span className="mono tnum text-[12px] text-fg-2">{x.s.integrity.toFixed(2)}</span>
                    </span>
                  </td>
                  <td className="mono tnum px-3 py-2 text-right">{x.s.lateSec ? <span className="text-warn">{mmss(x.s.lateSec)}</span> : <span className="text-fg-3">–</span>}</td>
                  <td className="mono tnum px-3 py-2 text-right">{x.s.teItems ? <span className="text-warn">{x.s.teItems}</span> : <span className="text-fg-3">0</span>}</td>
                  <td className="mono tnum px-3 py-2 text-right text-fg-2">{mmss(x.s.timeSec)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <AnimatePresence>
        {selected ? (
          <>
            <motion.div key="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-30" style={{ background: "var(--scrim)" }} onClick={() => setOpen(null)} />
            <motion.aside
              key="drawer"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
              className="fixed top-0 right-0 bottom-0 z-40 flex w-full max-w-[640px] flex-col border-l border-line bg-bg-1 shadow-[var(--shadow-pop)]"
            >
              <StudentDetail x={selected} excused={data.room.excused[selected.a.regNo] ?? []} onClose={() => setOpen(null)} onExcuse={onExcuse} />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function StudentDetail({ x, excused, onClose, onExcuse }: { x: Scored; excused: string[]; onClose: () => void; onExcuse: (reg: string, id: string, undo: boolean) => void }) {
  const ex = new Set(excused);
  return (
    <>
      <header className="flex items-center gap-3 border-b border-line px-5 py-4">
        <Avatar seed={avatarSeed(x.a.regNo, x.a.avatar ?? 0)} size={40} presence={x.presence} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{x.a.name}</p>
          <p className="mono tnum text-[12px] text-fg-2">{x.a.regNo}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {TIER_TAG[x.s.tier]}
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-md text-fg-2 hover:bg-bg-3">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      </header>
      <div className="grid grid-cols-4 gap-px border-b border-line bg-line">
        {[
          ["Marks", String(x.s.marks)],
          ["Accuracy", pct(x.s.accuracy, 0)],
          ["Integrity", x.s.integrity.toFixed(2)],
          ["Late", x.s.lateSec ? mmss(x.s.lateSec) : "–"],
        ].map(([k, v]) => (
          <div key={k} className="bg-bg-1 px-4 py-3">
            <p className="text-[11px] text-fg-3">{k}</p>
            <p className="mono tnum text-[18px] font-semibold">{v}</p>
          </div>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <section className="px-5 py-4">
          <h3 className="text-[13px] font-semibold">Questions</h3>
          <div className="mt-2 space-y-2">
            {x.s.items
              .slice()
              .sort((a, b) => a.index - b.index)
              .map((it) => (
                <div key={it.index} className="rounded-md border border-line px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="mono tnum text-[11px] text-fg-3">{it.index + 1}</span>
                    <span className="text-[13px] font-medium">{it.title}</span>
                    <span className="text-[11px] text-fg-3">{DIFFICULTY_LABEL[it.difficulty]}</span>
                    <span className="ml-auto mono tnum text-[13px]">{pct(it.accuracy, 0)}</span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-4 gap-2 text-[11px] text-fg-2">
                    <span>
                      Time <span className="mono tnum text-fg-1">{mmss(it.timeSec)}</span> / {mmss(it.expectedSec)}
                    </span>
                    <span>
                      Moves <span className="mono tnum text-fg-1">{it.moves}</span> / {it.optimalMoves}
                    </span>
                    <span>
                      Checks <span className="mono tnum text-fg-1">{it.checks}</span> · {it.wrongChecks} wrong
                    </span>
                    <span>
                      Efficiency <span className="mono tnum text-fg-1">{it.efficiency.toFixed(2)}</span>
                    </span>
                  </div>
                  {it.te.length || it.misconceptions.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {it.te.map((r) => (
                        <Tag key={r} tone="warn">
                          {TE_RULE_TEXT[r]}
                        </Tag>
                      ))}
                      {it.misconceptions.map((m) => (
                        <Tag key={m}>{misconceptionText(m)}</Tag>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
          </div>
        </section>
        <section className="border-t border-line px-5 py-4">
          <h3 className="text-[13px] font-semibold">Integrity events</h3>
          <p className="text-[12px] text-fg-3">Excuse an event if it was not misconduct (for example, the projector cable disconnected). Excused events no longer reduce the score.</p>
          {x.a.integrity.length === 0 ? (
            <p className="mt-3 text-[12px] text-fg-3">None recorded.</p>
          ) : (
            <ul className="mt-2">
              {x.a.integrity
                .slice()
                .reverse()
                .map((e) => {
                  const isEx = ex.has(e.id);
                  return (
                    <li key={e.id} className={cx("flex items-center gap-2 border-b border-line py-2 text-[12px] last:border-b-0", isEx && "opacity-55")}>
                      <span className="text-fg-3">{EVENT_ICON[e.type]}</span>
                      <span className="mono tnum w-16 text-fg-3">{clockTime(e.at)}</span>
                      <span className={cx("flex-1", isEx && "line-through")}>{INTEGRITY_LABEL[e.type]}</span>
                      {e.durationMs ? <span className="mono tnum text-fg-2">{mmss(e.durationMs / 1000)}</span> : null}
                      <span className="mono tnum w-12 text-right text-fg-3">−{severity(e).toFixed(3)}</span>
                      <Button size="sm" variant="ghost" onClick={() => onExcuse(x.a.regNo, e.id, isEx)}>
                        {isEx ? "Restore" : "Excuse"}
                      </Button>
                    </li>
                  );
                })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function Group({ title, hint, right, children }: { title: string; hint?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-[12px] font-semibold text-fg-1">{title}</p>
          {hint ? <p className="text-[11px] text-fg-3">{hint}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function NumberBox({ label, value, onChange, step, min, max }: { label: string; value: number; onChange: (v: number) => void; step: number; min: number; max: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-fg-3">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
        }}
        className="mono tnum h-8 w-full rounded-md border border-line-strong bg-bg-1 px-2 text-[13px] outline-none focus:border-signal"
      />
    </label>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-24 text-[12px] text-fg-2">{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-[var(--signal)]" />
      <span className="mono tnum w-9 text-right text-[12px]">{value.toFixed(2)}</span>
    </label>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cx("relative h-5 w-9 shrink-0 rounded-full border transition-colors", on ? "border-signal bg-signal" : "border-line-strong bg-bg-3")}>
      <motion.span className="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm" initial={false} animate={{ left: on ? 18 : 2 }} transition={{ duration: 0.14 }} />
    </button>
  );
}

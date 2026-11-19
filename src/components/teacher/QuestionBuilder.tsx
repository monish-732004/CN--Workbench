"use client";

import { Check, Copy, Download, GripVertical, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CUSTOM_TYPE_LABEL, validateCustom, type CustomQuestion, type CustomType } from "@/engine/custom";
import { DIFFICULTY_LABEL } from "@/engine/catalog";
import { evaluate, substitute } from "@/engine/expr";
import type { Difficulty } from "@/engine/types";
import { lsGet, lsSet } from "@/lib/client";
import { Button, cx, Field, Input, Segmented } from "../ui";

/** A question in the teacher's library. `include` marks it for the room being created. */
export interface LibQuestion extends CustomQuestion {
  include: boolean;
}

const LIB_KEY = "cnwb:qlib";
const newId = () => `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function blank(type: CustomType = "mcq"): LibQuestion {
  return {
    id: newId(),
    include: true,
    type,
    title: "",
    prompt: "",
    difficulty: "medium",
    unit: 0,
    options: [
      { text: "", correct: true },
      { text: "", correct: false },
      { text: "", correct: false },
      { text: "", correct: false },
    ],
    vars: [{ name: "n", min: 2, max: 10, step: 1 }],
    formula: "",
    tolerance: 0,
    unitLabel: "",
    accepted: [],
    steps: ["", "", ""],
  };
}

const SAMPLES: LibQuestion[] = [
  {
    ...blank("numeric"),
    id: "sample-tx",
    title: "Transmission delay",
    prompt: "A {L} byte frame is sent on a {R} Mbps link. What is the transmission delay in microseconds?",
    difficulty: "easy",
    unit: 1,
    vars: [
      { name: "L", min: 500, max: 1500, step: 100 },
      { name: "R", min: 10, max: 100, step: 10 },
    ],
    formula: "L * 8 / R",
    tolerance: 0.5,
    unitLabel: "µs",
    include: false,
  },
  {
    ...blank("mcq"),
    id: "sample-arp",
    title: "ARP request",
    prompt: "An ARP request frame is sent to which destination MAC address?",
    difficulty: "easy",
    unit: 2,
    options: [
      { text: "FF:FF:FF:FF:FF:FF", correct: true },
      { text: "The MAC address of the default gateway", correct: false },
      { text: "00:00:00:00:00:00", correct: false },
      { text: "01:00:5E:00:00:01", correct: false },
    ],
    include: false,
  },
];

export function useQuestionLibrary() {
  const [lib, setLib] = useState<LibQuestion[]>([]);
  const loaded = useRef(false);
  useEffect(() => {
    setLib(lsGet<LibQuestion[]>(LIB_KEY, []));
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (loaded.current) lsSet(LIB_KEY, lib);
  }, [lib]);
  return [lib, setLib] as const;
}

/** Strip editor-only fields and the parts that don't belong to the question's type. */
export function toPayload(q: LibQuestion): CustomQuestion {
  const base = { id: q.id, type: q.type, title: q.title, prompt: q.prompt, difficulty: q.difficulty, unit: q.unit };
  switch (q.type) {
    case "mcq":
    case "msq":
      return { ...base, options: (q.options ?? []).filter((o) => o.text.trim()) };
    case "numeric":
      return { ...base, vars: q.vars, formula: q.formula, tolerance: q.tolerance, unitLabel: q.unitLabel };
    case "text":
      return { ...base, accepted: q.accepted };
    case "order":
      return { ...base, steps: (q.steps ?? []).filter((s) => s.trim()) };
  }
}

export function checkQuestion(q: LibQuestion): string | null {
  const r = validateCustom(toPayload(q), 0);
  return typeof r === "string" ? r.replace(/^Question 1: /, "") : null;
}

const TYPES: CustomType[] = ["mcq", "msq", "numeric", "text", "order"];

export function QuestionBuilder({ lib, setLib }: { lib: LibQuestion[]; setLib: (f: (l: LibQuestion[]) => LibQuestion[]) => void }) {
  const [editing, setEditing] = useState<LibQuestion | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const included = lib.filter((q) => q.include).length;

  const save = (q: LibQuestion) => {
    setLib((l) => (l.some((x) => x.id === q.id) ? l.map((x) => (x.id === q.id ? q : x)) : [...l, q]));
    setEditing(null);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(lib.map(toPayload), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "cn-workbench-questions.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (f: File) => {
    setImportErr(null);
    try {
      const data = JSON.parse(await f.text());
      if (!Array.isArray(data)) throw new Error("Expected a list of questions.");
      const added: LibQuestion[] = [];
      for (const [i, raw] of data.entries()) {
        const v = validateCustom(raw, i);
        if (typeof v === "string") throw new Error(v);
        added.push({ ...blank(v.type), ...v, id: newId(), include: true });
      }
      setLib((l) => [...l, ...added]);
    } catch (e) {
      setImportErr((e as Error).message);
    }
  };

  return (
    <section className="rounded-lg border border-line bg-bg-1">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-semibold">Your own questions</h2>
          <p className="text-[12px] text-fg-3">Write MCQ, multiple-select, numeric, short-answer or ordering questions. Options and steps are shuffled per student; numeric questions draw different values for each student.</p>
        </div>
        <span className="tnum text-[12px] text-fg-2">
          {included} in this room · {lib.length} saved
        </span>
      </header>

      {lib.length ? (
        <ul className="divide-y divide-line">
          <AnimatePresence initial={false}>
            {lib.map((q) => {
              const err = checkQuestion(q);
              return (
                <motion.li key={q.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 px-5 py-2.5">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={q.include}
                    aria-label={`Include ${q.title || "question"} in this room`}
                    disabled={!!err}
                    onClick={() => setLib((l) => l.map((x) => (x.id === q.id ? { ...x, include: !x.include } : x)))}
                    className={cx("flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border disabled:opacity-40", q.include && !err ? "border-signal bg-signal text-white" : "border-line-strong")}
                  >
                    {q.include && !err ? <Check size={12} strokeWidth={2.5} /> : null}
                  </button>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{q.title || q.prompt || "Untitled question"}</span>
                    <span className="block truncate text-[12px] text-fg-3">
                      {CUSTOM_TYPE_LABEL[q.type]} · {DIFFICULTY_LABEL[q.difficulty]}
                      {q.unit ? ` · Unit ${q.unit}` : ""}
                      {err ? <span className="text-bad"> · {err}</span> : null}
                    </span>
                  </span>
                  <button type="button" aria-label="Edit" onClick={() => setEditing({ ...blank(q.type), ...q })} className="flex h-7 w-7 items-center justify-center rounded-md text-fg-2 hover:bg-bg-3 hover:text-fg-1">
                    <Pencil size={14} strokeWidth={1.5} />
                  </button>
                  <button type="button" aria-label="Duplicate" onClick={() => setLib((l) => [...l, { ...q, id: newId(), title: q.title ? `${q.title} (copy)` : "" }])} className="flex h-7 w-7 items-center justify-center rounded-md text-fg-2 hover:bg-bg-3 hover:text-fg-1">
                    <Copy size={14} strokeWidth={1.5} />
                  </button>
                  <button type="button" aria-label="Delete" onClick={() => setLib((l) => l.filter((x) => x.id !== q.id))} className="flex h-7 w-7 items-center justify-center rounded-md text-fg-2 hover:bg-bad-bg hover:text-bad">
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      ) : (
        <div className="px-5 py-5 text-[13px] text-fg-2">
          No questions yet. Questions you write are saved in this browser and can be reused in later rooms.
          <button type="button" className="ml-1 text-signal hover:underline" onClick={() => setLib(() => SAMPLES.map((s) => ({ ...s, id: newId() })))}>
            Load two examples
          </button>
        </div>
      )}

      <footer className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
        <Button size="sm" variant="primary" onClick={() => setEditing(blank())}>
          <Plus size={14} strokeWidth={1.5} /> New question
        </Button>
        <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
          <Upload size={14} strokeWidth={1.5} /> Import
        </Button>
        <Button size="sm" variant="ghost" disabled={!lib.length} onClick={exportJson}>
          <Download size={14} strokeWidth={1.5} /> Export
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importJson(f);
            e.target.value = "";
          }}
        />
        {importErr ? <span className="text-[12px] text-bad">{importErr}</span> : null}
        <span className="ml-auto text-[12px] text-fg-3">Up to 20 per room</span>
      </footer>

      <AnimatePresence>{editing ? <Editor key={editing.id} initial={editing} onCancel={() => setEditing(null)} onSave={save} /> : null}</AnimatePresence>
    </section>
  );
}

// ───────── Editor dialog ─────────
function Editor({ initial, onCancel, onSave }: { initial: LibQuestion; onCancel: () => void; onSave: (q: LibQuestion) => void }) {
  const [q, setQ] = useState<LibQuestion>(initial);
  const [tried, setTried] = useState(false);
  const set = (patch: Partial<LibQuestion>) => setQ((x) => ({ ...x, ...patch }));
  const err = checkQuestion(q);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-start justify-center overflow-auto px-4 py-8" style={{ background: "var(--scrim)" }}>
      <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 6, opacity: 0 }} transition={{ duration: 0.16 }} className="w-full max-w-[760px] rounded-lg border border-line bg-bg-2 shadow-[var(--shadow-pop)]">
        <header className="flex items-center gap-3 border-b border-line px-5 py-3">
          <h2 className="text-[14px] font-semibold">{initial.title || initial.prompt ? "Edit question" : "New question"}</h2>
          <button type="button" onClick={onCancel} aria-label="Close" className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-fg-2 hover:bg-bg-3">
            <X size={16} strokeWidth={1.5} />
          </button>
        </header>
        <div className="space-y-4 px-5 py-4">
          <div className="overflow-x-auto">
            <Segmented<CustomType> value={q.type} onChange={(type) => set({ type })} options={TYPES.map((t) => ({ value: t, label: CUSTOM_TYPE_LABEL[t].replace(" (random values)", "") }))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_150px_120px]">
            <Field label="Short title" hint="Shown in the question list">
              <Input value={q.title} maxLength={60} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. ARP request" />
            </Field>
            <Field label="Difficulty">
              <select value={q.difficulty} onChange={(e) => set({ difficulty: e.target.value as Difficulty })} className="h-9 w-full rounded-md border border-line-strong bg-bg-1 px-2 text-[13px]">
                {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_LABEL[d]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Unit">
              <select value={q.unit} onChange={(e) => set({ unit: Number(e.target.value) })} className="h-9 w-full rounded-md border border-line-strong bg-bg-1 px-2 text-[13px]">
                <option value={0}>General</option>
                {[1, 2, 3, 4, 5].map((u) => (
                  <option key={u} value={u}>
                    Unit {u}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Question" hint={q.type === "numeric" ? "Write variables in braces, e.g. {L}; each student gets their own values" : undefined}>
            <textarea
              value={q.prompt}
              onChange={(e) => set({ prompt: e.target.value })}
              rows={3}
              maxLength={1500}
              className="w-full resize-y rounded-md border border-line-strong bg-bg-1 px-3 py-2 text-[13px] outline-none focus:border-signal"
              placeholder={q.type === "numeric" ? "A {L} byte frame is sent on a {R} Mbps link. Transmission delay in µs?" : "Type the question"}
            />
          </Field>

          {q.type === "mcq" || q.type === "msq" ? <OptionsEditor q={q} set={set} /> : null}
          {q.type === "numeric" ? <NumericEditor q={q} set={set} /> : null}
          {q.type === "text" ? (
            <Field label="Accepted answers" hint="One per line. Case and extra spaces are ignored.">
              <textarea
                value={(q.accepted ?? []).join("\n")}
                onChange={(e) => set({ accepted: e.target.value.split("\n") })}
                rows={3}
                className="mono w-full resize-y rounded-md border border-line-strong bg-bg-1 px-3 py-2 text-[13px] outline-none focus:border-signal"
                placeholder={"Address Resolution Protocol\nARP"}
              />
            </Field>
          ) : null}
          {q.type === "order" ? <StepsEditor q={q} set={set} /> : null}
        </div>
        <footer className="flex items-center gap-3 border-t border-line px-5 py-3">
          {tried && err ? <span className="text-[12px] text-bad">{err}</span> : <span className="text-[12px] text-fg-3">Saved to this browser&apos;s question library.</span>}
          <span className="ml-auto" />
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setTried(true);
              if (!err) onSave({ ...q, include: true });
            }}
          >
            Save question
          </Button>
        </footer>
      </motion.div>
    </motion.div>
  );
}

function OptionsEditor({ q, set }: { q: LibQuestion; set: (p: Partial<LibQuestion>) => void }) {
  const opts = q.options ?? [];
  const multi = q.type === "msq";
  const update = (i: number, patch: Partial<{ text: string; correct: boolean }>) => {
    let next = opts.map((o, j) => (j === i ? { ...o, ...patch } : o));
    if (!multi && patch.correct) next = next.map((o, j) => ({ ...o, correct: j === i }));
    set({ options: next });
  };
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-medium text-fg-2">Options · {multi ? "tick every correct option" : "tick the one correct option"}</p>
      <div className="space-y-1.5">
        {opts.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              type="button"
              aria-label={`Mark option ${i + 1} correct`}
              aria-pressed={o.correct}
              onClick={() => update(i, { correct: multi ? !o.correct : true })}
              className={cx("flex h-6 w-6 shrink-0 items-center justify-center border transition-colors", multi ? "rounded-sm" : "rounded-full", o.correct ? "border-ok bg-ok text-white" : "border-line-strong text-fg-3 hover:border-ok")}
            >
              {o.correct ? <Check size={13} strokeWidth={2.5} /> : null}
            </button>
            <Input value={o.text} maxLength={300} onChange={(e) => update(i, { text: e.target.value })} placeholder={`Option ${i + 1}`} className="flex-1" />
            <button type="button" aria-label="Remove option" disabled={opts.length <= 2} onClick={() => set({ options: opts.filter((_, j) => j !== i) })} className="flex h-7 w-7 items-center justify-center rounded-md text-fg-3 hover:text-bad disabled:opacity-30">
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>
        ))}
      </div>
      <Button size="sm" variant="ghost" className="mt-2" disabled={opts.length >= 8} onClick={() => set({ options: [...opts, { text: "", correct: false }] })}>
        <Plus size={14} strokeWidth={1.5} /> Add option
      </Button>
      <p className="mt-1 text-[12px] text-fg-3">Students see the options in a different order each.</p>
    </div>
  );
}

function NumericEditor({ q, set }: { q: LibQuestion; set: (p: Partial<LibQuestion>) => void }) {
  const vars = q.vars ?? [];
  const [seed, setSeed] = useState(0);
  const updateVar = (i: number, patch: Partial<{ name: string; min: number; max: number; step: number }>) => set({ vars: vars.map((v, j) => (j === i ? { ...v, ...patch } : v)) });
  const sample = useMemo(() => {
    const vals: Record<string, number> = {};
    let r = seed * 9301 + 49297;
    for (const v of vars) {
      if (!v.name) continue;
      const n = Math.max(0, Math.floor((v.max - v.min) / (v.step || 1)));
      r = (r * 9301 + 49297) % 233280;
      vals[v.name] = +(v.min + Math.floor((r / 233280) * (n + 1)) * (v.step || 1)).toFixed(6);
    }
    try {
      const ans = evaluate(q.formula ?? "", vals);
      return { vals, prompt: substitute(q.prompt, vals), ans: Number.isFinite(ans) ? ans : null, err: null as string | null };
    } catch (e) {
      return { vals, prompt: substitute(q.prompt, vals), ans: null, err: (e as Error).message };
    }
  }, [vars, q.formula, q.prompt, seed]);

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-[12px] font-medium text-fg-2">Variables · each student gets a random value in the range</p>
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-1.5 text-[11px] text-fg-3">
          <span>Name</span>
          <span>Min</span>
          <span>Max</span>
          <span>Step</span>
          <span />
          {vars.map((v, i) => (
            <div key={i} className="contents">
              <Input mono value={v.name} onChange={(e) => updateVar(i, { name: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })} placeholder="L" />
              <Input mono type="number" value={v.min} onChange={(e) => updateVar(i, { min: Number(e.target.value) })} />
              <Input mono type="number" value={v.max} onChange={(e) => updateVar(i, { max: Number(e.target.value) })} />
              <Input mono type="number" value={v.step} onChange={(e) => updateVar(i, { step: Number(e.target.value) })} />
              <button type="button" aria-label="Remove variable" onClick={() => set({ vars: vars.filter((_, j) => j !== i) })} className="flex h-9 w-7 items-center justify-center text-fg-3 hover:text-bad">
                <X size={14} strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
        <Button size="sm" variant="ghost" className="mt-2" disabled={vars.length >= 6} onClick={() => set({ vars: [...vars, { name: "", min: 1, max: 10, step: 1 }] })}>
          <Plus size={14} strokeWidth={1.5} /> Add variable
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_120px_100px]">
        <Field label="Answer formula" hint="+ − * / ^ ( ), and log2 ln log10 sqrt ceil floor round abs min max pow">
          <Input mono value={q.formula ?? ""} onChange={(e) => set({ formula: e.target.value })} placeholder="L * 8 / R" />
        </Field>
        <Field label="Tolerance ±">
          <Input mono type="number" min={0} step="any" value={q.tolerance ?? 0} onChange={(e) => set({ tolerance: Number(e.target.value) })} />
        </Field>
        <Field label="Unit">
          <Input value={q.unitLabel ?? ""} maxLength={20} onChange={(e) => set({ unitLabel: e.target.value })} placeholder="µs" />
        </Field>
      </div>
      <div className="rounded-md border border-line bg-bg-1 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <p className="text-[12px] font-medium text-fg-2">Preview for one student</p>
          <button type="button" className="ml-auto text-[12px] text-signal hover:underline" onClick={() => setSeed((s) => s + 1)}>
            Another student
          </button>
        </div>
        <p className="mt-1.5 text-[13px]">{sample.prompt || <span className="text-fg-3">Write the question to see a preview.</span>}</p>
        <p className="mono tnum mt-1.5 text-[12px] text-fg-2">
          {Object.entries(sample.vals)
            .map(([k, v]) => `${k} = ${v}`)
            .join("   ")}
          {"   →   "}
          {sample.err ? <span className="text-bad">{sample.err}</span> : sample.ans !== null ? <span className="text-ok">answer {+sample.ans.toFixed(6)} {q.unitLabel}</span> : "—"}
        </p>
      </div>
    </div>
  );
}

function StepsEditor({ q, set }: { q: LibQuestion; set: (p: Partial<LibQuestion>) => void }) {
  const steps = q.steps ?? [];
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= steps.length) return;
    const next = steps.slice();
    [next[i], next[j]] = [next[j]!, next[i]!];
    set({ steps: next });
  };
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-medium text-fg-2">Steps in the correct order · students get them shuffled</p>
      <div className="space-y-1.5">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="mono tnum w-5 text-right text-[12px] text-fg-3">{i + 1}</span>
            <Input value={s} maxLength={200} onChange={(e) => set({ steps: steps.map((x, j) => (j === i ? e.target.value : x)) })} placeholder={`Step ${i + 1}`} className="flex-1" />
            <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="flex h-7 w-7 items-center justify-center rounded-md text-fg-3 hover:text-fg-1 disabled:opacity-30">
              <GripVertical size={14} strokeWidth={1.5} className="rotate-90" />
            </button>
            <button type="button" aria-label="Remove step" disabled={steps.length <= 3} onClick={() => set({ steps: steps.filter((_, j) => j !== i) })} className="flex h-7 w-7 items-center justify-center rounded-md text-fg-3 hover:text-bad disabled:opacity-30">
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>
        ))}
      </div>
      <Button size="sm" variant="ghost" className="mt-2" disabled={steps.length >= 10} onClick={() => set({ steps: [...steps, ""] })}>
        <Plus size={14} strokeWidth={1.5} /> Add step
      </Button>
    </div>
  );
}

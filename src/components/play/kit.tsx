"use client";

import { AlertTriangle, CheckCircle2, CircleDashed, Lock, XCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import type { AttemptItem, CpState } from "@/engine/model";
import type { CheckpointDef } from "@/engine/types";
import { Button, cx, Spinner } from "../ui";

export interface Verdict {
  checkpointId: string;
  status: "correct" | "incorrect" | "partial";
  score?: number;
  fields?: Record<string, boolean>;
  checks: number;
  wrong: number;
  checksLeft: number;
  locked: boolean;
  award?: { points: number; parts: string[]; streak: number; total: number };
  chest?: { id: string };
}

export interface TplProps<V = any, D = any> {
  view: V;
  item: AttemptItem;
  draft: D | undefined;
  setDraft: (d: D) => void;
  /** Count a committed move. `element`+`value` feed oscillation (trial-and-error) detection. */
  move: (element: string, value?: string) => void;
  check: (checkpointId: string, response: unknown) => void;
  pending: string | null;
  verdicts: Record<string, Verdict | undefined>;
  locked: boolean;
}

/** Field-level feedback is only present under "checkpoint" feedback. */
export function fieldState(v: Verdict | undefined, key: string): "ok" | "bad" | null {
  if (!v?.fields || !(key in v.fields)) return null;
  return v.fields[key] ? "ok" : "bad";
}

export function cpOf(item: AttemptItem, id: string): { def: CheckpointDef; state: CpState } | null {
  const def = item.checkpoints.find((c) => c.id === id);
  if (!def) return null;
  return { def, state: item.cp[id]! };
}

export function CheckpointBar({
  tp,
  id,
  ready,
  getResponse,
  hint,
}: {
  tp: TplProps;
  id: string;
  ready: boolean;
  getResponse: () => unknown;
  hint?: ReactNode;
}) {
  const cp = cpOf(tp.item, id);
  if (!cp) return null;
  const { def, state } = cp;
  const v = tp.verdicts[id];
  const pending = tp.pending === id;
  const locked = state.locked || tp.locked;
  let tone: "ok" | "bad" | "warn" | "neutral" = "neutral";
  let label = "Not checked";
  let icon = <CircleDashed size={14} strokeWidth={1.5} />;
  if (state.correct) {
    tone = "ok";
    label = "Verified";
    icon = <CheckCircle2 size={14} strokeWidth={1.5} />;
  } else if (state.checks > 0) {
    tone = state.locked ? "bad" : "warn";
    label = state.locked ? "Locked" : v?.status === "partial" && v.score !== undefined ? `Partly right · ${Math.round(v.score * 100)}%` : "Incorrect";
    icon = state.locked ? <Lock size={14} strokeWidth={1.5} /> : <XCircle size={14} strokeWidth={1.5} />;
  }
  const left = Math.max(0, 4 - state.checks);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-[13px] font-medium text-fg-1">{def.title}</span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={label}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.14 }}
            className={cx(
              "inline-flex h-5 items-center gap-1 rounded-sm border px-1.5 text-[11px] font-medium",
              tone === "ok" && "border-ok/35 bg-ok-bg text-ok",
              tone === "bad" && "border-bad/35 bg-bad-bg text-bad",
              tone === "warn" && "border-warn/35 bg-warn-bg text-warn",
              tone === "neutral" && "border-line bg-bg-3 text-fg-2",
            )}
          >
            {icon}
            {label}
          </motion.span>
        </AnimatePresence>
        {state.wrong >= 3 && !state.correct ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-warn" title="Several wrong checks on this step">
            <AlertTriangle size={12} strokeWidth={1.5} /> Trial-and-error pattern
          </span>
        ) : null}
      </div>
      <div className="ml-auto flex items-center gap-3">
        {hint ? <span className="text-[12px] text-fg-3">{hint}</span> : null}
        {!state.correct && !locked ? <span className="mono tnum text-[11px] text-fg-3">{left} check{left === 1 ? "" : "s"} left</span> : null}
        {!state.correct && !locked ? (
          <Button data-tour-check size="sm" variant="primary" disabled={!ready || pending || !!tp.pending} onClick={() => tp.check(id, getResponse())}>
            {pending ? <Spinner /> : null}
            {pending ? "Checking" : "Check"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function Card({ title, aside, children, className }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-lg border border-line bg-bg-1 p-4", className)}>
      {title ? (
        <header className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-[13px] font-semibold">{title}</h3>
          {aside}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Given({ items }: { items: { k: string; v: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-[auto_1fr_auto_1fr]">
      {items.map((x) => (
        <div key={x.k} className="contents">
          <dt className="text-fg-2">{x.k}</dt>
          <dd className="mono tnum text-fg-1">{x.v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Bit({
  value,
  onClick,
  readOnly,
  tone,
  dim,
  size = "md",
  label,
}: {
  value: string;
  onClick?: () => void;
  readOnly?: boolean;
  tone?: "ok" | "bad" | "signal" | null;
  dim?: boolean;
  size?: "xs" | "sm" | "md";
  label?: string;
}) {
  const base = size === "xs" ? "h-7 w-[22px] text-[13px]" : size === "sm" ? "h-7 w-6 text-[13px]" : "h-8 w-7 text-[15px]";
  return (
    <button
      type="button"
      disabled={readOnly || !onClick}
      onClick={onClick}
      aria-label={label}
      className={cx(
        "mono tnum inline-flex shrink-0 items-center justify-center rounded-sm border transition-colors duration-100",
        base,
        readOnly ? "cursor-default border-transparent" : "cursor-pointer border-line-strong hover:border-signal",
        value === "1" ? "bg-bg-3 font-semibold text-fg-1" : value === "0" ? "bg-bg-1 text-fg-2" : "bg-bg-1 text-fg-3",
        tone === "ok" && "border-ok",
        tone === "bad" && "border-bad",
        tone === "signal" && "border-signal bg-signal-bg",
        dim && "opacity-55",
      )}
    >
      {value || "·"}
    </button>
  );
}

export function MonoInput({ value, onChange, onCommit, placeholder, state, className, width, disabled, label, inputMode }: {
  value: string;
  onChange: (v: string) => void;
  onCommit?: (v: string) => void;
  placeholder?: string;
  state?: "ok" | "bad" | null;
  className?: string;
  width?: string;
  disabled?: boolean;
  label?: string;
  inputMode?: "numeric" | "decimal" | "text";
}) {
  return (
    <input
      aria-label={label}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      inputMode={inputMode}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onCommit?.(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      onPaste={(e) => e.preventDefault()}
      autoComplete="off"
      spellCheck={false}
      className={cx(
        "mono tnum h-8 rounded-md border bg-bg-1 px-2 text-[13px] text-fg-1 outline-none transition-colors placeholder:text-fg-3 focus:border-signal disabled:opacity-60",
        state === "ok" ? "border-ok" : state === "bad" ? "border-bad" : "border-line-strong",
        width ?? "w-36",
        className,
      )}
    />
  );
}

export function Prompt({ children }: { children: ReactNode }) {
  return <div className="text-[14px] leading-[22px] text-fg-1">{children}</div>;
}

"use client";

import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";

export function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "signal";
type Size = "sm" | "md" | "lg";

const V: Record<Variant, string> = {
  primary: "bg-ink text-ink-fg hover:opacity-90 border border-transparent",
  secondary: "bg-bg-1 text-fg-1 border border-line-strong hover:bg-bg-3",
  ghost: "bg-transparent text-fg-2 hover:text-fg-1 hover:bg-bg-3 border border-transparent",
  danger: "bg-bg-1 text-bad border border-bad/40 hover:bg-bad-bg",
  signal: "bg-signal text-white hover:opacity-90 border border-transparent",
};
const S: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[12px] gap-1.5",
  md: "h-8 px-3 text-[13px] gap-1.5",
  lg: "h-10 px-4 text-[14px] gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }>(
  function Button({ variant = "secondary", size = "md", className, ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={cx(
          "inline-flex select-none items-center justify-center rounded-md font-medium whitespace-nowrap transition-[background,opacity,color] duration-[80ms] active:translate-y-px disabled:pointer-events-none disabled:opacity-45",
          V[variant],
          S[size],
          className,
        )}
        {...rest}
      />
    );
  },
);

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx("inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-2 transition-colors hover:bg-bg-3 hover:text-fg-1 disabled:opacity-40", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { mono?: boolean; state?: "ok" | "bad" | null }>(
  function Input({ className, mono, state, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cx(
          "h-8 w-full rounded-md border bg-bg-1 px-2.5 text-[13px] text-fg-1 placeholder:text-fg-3 outline-none transition-colors focus:border-signal",
          state === "ok" ? "border-ok" : state === "bad" ? "border-bad" : "border-line-strong",
          mono && "mono tnum",
          className,
        )}
        {...rest}
      />
    );
  },
);

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-[12px] font-medium text-fg-2">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[12px] text-fg-3">{hint}</span> : null}
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div role="radiogroup" className={cx("inline-flex rounded-md border border-line bg-bg-3 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-[3px] px-2.5 font-medium transition-colors",
            size === "sm" ? "h-6 text-[12px]" : "h-7 text-[13px]",
            value === o.value ? "bg-bg-1 text-fg-1 shadow-[0_0_0_1px_var(--border-1)]" : "text-fg-2 hover:text-fg-1",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export type Tone = "ok" | "warn" | "bad" | "neutral" | "signal";
const TONE: Record<Tone, string> = {
  ok: "text-ok bg-ok-bg border-ok/35",
  warn: "text-warn bg-warn-bg border-warn/35",
  bad: "text-bad bg-bad-bg border-bad/35",
  neutral: "text-fg-2 bg-bg-3 border-line",
  signal: "text-signal bg-signal-bg border-signal/35",
};

export function Tag({ tone = "neutral", icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex h-5 items-center gap-1 rounded-sm border px-1.5 text-[11px] font-medium whitespace-nowrap", TONE[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

export function Dot({ tone = "neutral", className }: { tone?: Tone; className?: string }) {
  const c = { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad", neutral: "bg-fg-3", signal: "bg-signal" }[tone];
  return <span className={cx("inline-block h-1.5 w-1.5 rounded-full", c, className)} />;
}

export function Panel({ title, actions, children, className, bodyClass }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cx("flex min-h-0 flex-col rounded-lg border border-line bg-bg-1", className)}>
      {title ? (
        <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-line px-3">
          <h3 className="text-[13px] font-semibold text-fg-1">{title}</h3>
          {actions}
        </header>
      ) : null}
      <div className={cx("min-h-0 flex-1", bodyClass)}>{children}</div>
    </section>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="mono inline-flex h-[18px] items-center rounded-sm border border-line px-1 text-[11px] text-fg-2">{children}</kbd>;
}

export function Meter({ value, tone, className }: { value: number; tone?: Tone; className?: string }) {
  const c = tone === "ok" ? "bg-ok" : tone === "warn" ? "bg-warn" : tone === "bad" ? "bg-bad" : tone === "signal" ? "bg-signal" : "bg-fg-2";
  return (
    <div className={cx("h-1 w-full overflow-hidden rounded-full bg-bg-3", className)}>
      <div className={cx("h-full rounded-full transition-[width] duration-300 ease-out", c)} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cx("inline-block h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-r-transparent", className)} aria-hidden />;
}

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center text-[13px] text-fg-2">
      <p>{children}</p>
      {action}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cx("h-px w-full bg-line", className)} />;
}

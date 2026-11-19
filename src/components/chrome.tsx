"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "./ui";

export function LogoMark({ size = 20 }: { size?: number }) {
  // Three nodes and two links: a tiny network, drawn with 1.5px strokes.
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="0.75" y="0.75" width="18.5" height="18.5" rx="4" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
      <path d="M6 13.5 L10 6.5 L14 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="13.5" r="1.9" fill="currentColor" />
      <circle cx="10" cy="6.5" r="1.9" fill="var(--signal)" />
      <circle cx="14" cy="13.5" r="1.9" fill="currentColor" />
    </svg>
  );
}

const HOLD_MS = 900;

/**
 * Logo link. A click goes to `href`; pressing and holding for ~0.9 s opens `longPressHref`
 * (the teacher console), so the entry point stays out of sight on the student-facing page.
 * Works with mouse, touch, and keyboard (hold Enter or Space).
 */
export function Wordmark({ href = "/", longPressHref = "/teacher" }: { href?: string; longPressHref?: string | null }) {
  const router = useRouter();
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);
  const fired = useRef(false);

  const start = () => {
    if (!longPressHref || timer.current !== null) return;
    fired.current = false;
    setHolding(true);
    timer.current = window.setTimeout(() => {
      fired.current = true;
      timer.current = null;
      setHolding(false);
      if (navigator.vibrate) navigator.vibrate(12);
      router.push(longPressHref);
    }, HOLD_MS);
  };
  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  useEffect(() => cancel, []);

  return (
    <Link
      href={href}
      draggable={false}
      onPointerDown={(e) => {
        if (e.button === 0) start();
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          const wasFired = fired.current;
          cancel();
          if (!wasFired) router.push(href);
        }
      }}
      onClick={(e) => {
        // A completed long press already navigated; swallow the trailing click.
        if (fired.current) {
          e.preventDefault();
          fired.current = false;
        }
      }}
      onContextMenu={(e) => {
        if (longPressHref) e.preventDefault();
      }}
      className="inline-flex select-none items-center gap-2 text-fg-1 [-webkit-touch-callout:none]"
    >
      <span className="relative inline-flex">
        <LogoMark />
        {longPressHref ? (
          <svg className="pointer-events-none absolute -inset-[3px]" width={26} height={26} viewBox="0 0 26 26" aria-hidden>
            <rect
              x="1"
              y="1"
              width="24"
              height="24"
              rx="6.5"
              fill="none"
              stroke="var(--signal)"
              strokeWidth="1.5"
              pathLength={100}
              strokeDasharray="100"
              style={{
                strokeDashoffset: holding ? 0 : 100,
                opacity: holding ? 1 : 0,
                transition: holding ? `stroke-dashoffset ${HOLD_MS}ms linear, opacity 80ms` : "stroke-dashoffset 120ms ease-out, opacity 120ms",
              }}
            />
          </svg>
        ) : null}
      </span>
      <span className="text-[13px] font-semibold tracking-[-0.01em]">CN Workbench</span>
    </Link>
  );
}

type Theme = "system" | "light" | "dark";

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    try {
      const t = localStorage.getItem("cnwb:theme");
      if (t === "light" || t === "dark") setTheme(t);
    } catch {
      /* ignore */
    }
  }, []);
  const apply = (t: Theme) => {
    setTheme(t);
    try {
      if (t === "system") {
        localStorage.removeItem("cnwb:theme");
        document.documentElement.removeAttribute("data-theme");
      } else {
        localStorage.setItem("cnwb:theme", t);
        document.documentElement.setAttribute("data-theme", t);
      }
    } catch {
      /* ignore */
    }
  };
  const opts: { v: Theme; icon: ReactNode; label: string }[] = [
    { v: "light", icon: <Sun size={14} strokeWidth={1.5} />, label: "Light theme" },
    { v: "system", icon: <Monitor size={14} strokeWidth={1.5} />, label: "System theme" },
    { v: "dark", icon: <Moon size={14} strokeWidth={1.5} />, label: "Dark theme" },
  ];
  return (
    <div className={cx("inline-flex rounded-md border border-line bg-bg-3 p-0.5", className)} role="radiogroup" aria-label="Theme">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={theme === o.v}
          aria-label={o.label}
          title={o.label}
          onClick={() => apply(o.v)}
          className={cx("flex h-6 w-7 items-center justify-center rounded-[3px] transition-colors", theme === o.v ? "bg-bg-1 text-fg-1 shadow-[0_0_0_1px_var(--border-1)]" : "text-fg-3 hover:text-fg-1")}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}

export function TopBar({ children, right }: { children?: ReactNode; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg-0/90 backdrop-saturate-150">
      <div className="mx-auto flex h-12 max-w-[1400px] items-center gap-4 px-4">
        <Wordmark />
        <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
        <div className="flex items-center gap-2">
          {right}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

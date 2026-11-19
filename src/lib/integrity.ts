"use client";

import { useEffect, useRef } from "react";
import type { IntegrityType } from "@/engine/model";

export interface SensorEvent {
  type: IntegrityType;
  at: number;
  durationMs?: number;
}

/**
 * Browser integrity sensors. They deter and record; they cannot prevent everything,
 * and events are reported as observations ("suspected" where heuristic).
 */
export function useIntegrity(opts: { active: boolean; onEvent: (e: SensorEvent) => void; onStateChange: () => void; onFlush: (events: SensorEvent[]) => void }) {
  const ref = useRef(opts);
  ref.current = opts;

  useEffect(() => {
    if (!opts.active) return;
    let fsExitAt: number | null = document.fullscreenElement ? null : null;
    let hiddenAt: number | null = null;
    let blurAt: number | null = null;
    let hiddenSinceBlur = false;
    const last: Record<string, number> = {};
    const emit = (type: IntegrityType, at: number, durationMs?: number, throttleMs = 0) => {
      const now = Date.now();
      if (throttleMs && last[type] && now - last[type]! < throttleMs) return;
      last[type] = now;
      ref.current.onEvent({ type, at, durationMs });
    };

    const onFs = () => {
      const now = Date.now();
      if (!document.fullscreenElement) fsExitAt = now;
      else if (fsExitAt) {
        emit("fullscreen_exit", fsExitAt, now - fsExitAt);
        fsExitAt = null;
      }
      ref.current.onStateChange();
    };
    const onVis = () => {
      const now = Date.now();
      if (document.hidden) {
        hiddenAt = now;
        hiddenSinceBlur = true;
      } else if (hiddenAt) {
        emit("tab_hidden", hiddenAt, now - hiddenAt);
        hiddenAt = null;
      }
      ref.current.onStateChange();
    };
    const onBlur = () => {
      blurAt = Date.now();
      hiddenSinceBlur = false;
    };
    const onFocus = () => {
      const now = Date.now();
      if (blurAt && !hiddenSinceBlur) emit("window_blur", blurAt, now - blurAt);
      blurAt = null;
      ref.current.onStateChange();
    };
    const onClip = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      // Typing fields block paste themselves; still record clipboard use anywhere.
      e.preventDefault();
      if (t) emit("clipboard_attempt", Date.now(), undefined, 2000);
    };
    const onCtx = (e: MouseEvent) => {
      e.preventDefault();
      emit("context_menu", Date.now(), undefined, 5000);
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === "F12" || (mod && e.shiftKey && ["i", "j", "c"].includes(k)) || (mod && k === "u") || (e.metaKey && e.altKey && ["i", "j", "c"].includes(k))) {
        e.preventDefault();
        emit("devtools_suspected", Date.now(), undefined, 10000);
      } else if (mod && k === "p") {
        e.preventDefault();
        emit("print_attempt", Date.now(), undefined, 5000);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") emit("print_attempt", Date.now(), undefined, 5000);
    };
    const onPrint = () => emit("print_attempt", Date.now(), undefined, 5000);
    const onHide = () => {
      const now = Date.now();
      const pending: SensorEvent[] = [];
      if (fsExitAt) pending.push({ type: "fullscreen_exit", at: fsExitAt, durationMs: now - fsExitAt });
      if (hiddenAt) pending.push({ type: "tab_hidden", at: hiddenAt, durationMs: now - hiddenAt });
      if (pending.length) ref.current.onFlush(pending);
    };

    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("copy", onClip, true);
    document.addEventListener("cut", onClip, true);
    document.addEventListener("paste", onClip, true);
    document.addEventListener("contextmenu", onCtx, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("beforeprint", onPrint);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("copy", onClip, true);
      document.removeEventListener("cut", onClip, true);
      document.removeEventListener("paste", onClip, true);
      document.removeEventListener("contextmenu", onCtx, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("beforeprint", onPrint);
      window.removeEventListener("pagehide", onHide);
    };
  }, [opts.active]);
}

export function fullscreenSupported() {
  return typeof document !== "undefined" && !!document.documentElement.requestFullscreen && document.fullscreenEnabled !== false;
}

export async function enterFullscreen() {
  try {
    await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    return true;
  } catch {
    return false;
  }
}

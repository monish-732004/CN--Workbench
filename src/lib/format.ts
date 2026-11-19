export function mmss(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function minutes(sec: number): string {
  const m = Math.round(sec / 60);
  return `${m} min`;
}

export function pct(x: number, digits = 1): string {
  if (!Number.isFinite(x)) return "–";
  return `${(x * 100).toFixed(digits).replace(/\.0$/, "")}%`;
}

export function num(x: number, digits = 2): string {
  if (!Number.isFinite(x)) return "–";
  return Number(x.toFixed(digits)).toString();
}

export function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export function relTime(ms: number, now: number): string {
  const d = Math.max(0, Math.round((now - ms) / 1000));
  if (d < 5) return "just now";
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  return `${Math.floor(d / 3600)}h ago`;
}

export function formatCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
}

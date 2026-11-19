import { memo } from "react";

/**
 * Deterministic geometric avatar (Bauhaus-style) from a register number.
 * Muted earth tones that read well in both themes; no faces, no gradients.
 */
const PALETTE = ["#C9A35B", "#7C9CC9", "#86AE86", "#C98466", "#97A3B5", "#AFAE66", "#B48C8C", "#6FA5A0", "#D2B48C", "#8C9DB5", "#A38FB0", "#5E8C7A"];

function hash(s: string): number[] {
  let h = 2166136261;
  const out: number[] = [];
  for (let k = 0; k < 8; k++) {
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
    h = Math.imul(h ^ (k * 0x9e3779b9), 2246822507) >>> 0;
    out.push(h);
  }
  return out;
}

function pickDistinct(n: number[], count: number) {
  const idx: number[] = [];
  let i = 0;
  while (idx.length < count) {
    const c = n[i % n.length]! % PALETTE.length;
    const v = (c + i) % PALETTE.length;
    if (!idx.includes(v)) idx.push(v);
    i++;
  }
  return idx.map((x) => PALETTE[x]!);
}

export type Presence = "online" | "away" | "offline" | "done";

export const Avatar = memo(function Avatar({ seed, size = 28, presence, title }: { seed: string; size?: number; presence?: Presence; title?: string }) {
  const h = hash(seed || "?");
  const [bg, c1, c2] = pickDistinct(h, 3);
  const id = `av-${seed.replace(/[^a-zA-Z0-9]/g, "")}-${size}`;
  const kind = h[3]! % 4;
  const rot = [0, 15, 30, 45, 60][h[4]! % 5];
  const cx = 12 + (h[5]! % 16);
  const cy = 12 + (h[6]! % 16);
  const r = 9 + (h[7]! % 6);
  const presenceColor = presence === "online" ? "var(--ok)" : presence === "away" ? "var(--warn)" : presence === "done" ? "var(--signal)" : "var(--fg-3)";
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} title={title}>
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden role="img">
        <defs>
          <clipPath id={id}>
            <circle cx="20" cy="20" r="20" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${id})`}>
          <rect width="40" height="40" fill={bg} />
          {kind === 0 && (
            <>
              <circle cx={cx} cy={cy} r={r} fill={c1} />
              <rect x="20" y="-4" width="26" height="26" fill={c2} transform={`rotate(${rot} 20 20)`} opacity="0.92" />
            </>
          )}
          {kind === 1 && (
            <>
              <rect x="-6" y="20" width="52" height="24" fill={c1} transform={`rotate(${rot} 20 20)`} />
              <circle cx={40 - cx} cy={cy - 4} r={r - 2} fill={c2} />
            </>
          )}
          {kind === 2 && (
            <>
              <path d={`M0 40 L${cx + 10} 4 L40 40 Z`} fill={c1} />
              <circle cx={40 - cx} cy="12" r={r - 3} fill={c2} />
            </>
          )}
          {kind === 3 && (
            <>
              <path d={`M0 0 A40 40 0 0 1 40 40 L0 40 Z`} fill={c1} transform={`rotate(${rot * 2} 20 20)`} />
              <rect x={cx - 6} y={cy - 6} width="14" height="14" fill={c2} transform={`rotate(${rot} ${cx} ${cy})`} />
            </>
          )}
        </g>
        <circle cx="20" cy="20" r="19.5" fill="none" stroke="rgb(0 0 0 / 0.10)" />
      </svg>
      {presence ? (
        <span
          className="absolute -right-0.5 -bottom-0.5 rounded-full border-2 border-bg-1"
          style={{ width: Math.max(8, size * 0.32), height: Math.max(8, size * 0.32), background: presenceColor }}
          aria-label={presence}
        />
      ) : null}
    </span>
  );
});

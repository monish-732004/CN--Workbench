/** IPv6 helpers: expand, RFC 5952 compression, block classification, EUI-64. */

export function expandV6(s: string): number[] | null {
  const t = s.trim().toLowerCase();
  if (!/^[0-9a-f:]+$/.test(t) || (t.match(/::/g) ?? []).length > 1) return null;
  const [head, tail] = t.includes("::") ? t.split("::") : [t, null];
  const h = head ? head.split(":") : [];
  const tl = tail !== null && tail !== undefined ? (tail ? tail.split(":") : []) : null;
  const parts = tl === null ? h : [...h, ...Array(8 - h.length - tl.length).fill("0"), ...tl];
  if (parts.length !== 8) return null;
  const out: number[] = [];
  for (const p of parts) {
    if (!/^[0-9a-f]{1,4}$/.test(p)) return null;
    out.push(parseInt(p, 16));
  }
  return out;
}

export function fullV6(h: number[]): string {
  return h.map((x) => x.toString(16).toUpperCase().padStart(4, "0")).join(":");
}

/** RFC 5952: lowercase, no leading zeros, longest zero run (≥2) → "::", leftmost on ties. */
export function compressV6(h: number[]): string {
  let best = -1;
  let bestLen = 0;
  for (let i = 0; i < 8; ) {
    if (h[i] !== 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && h[j] === 0) j++;
    if (j - i > bestLen) {
      best = i;
      bestLen = j - i;
    }
    i = j;
  }
  const hex = h.map((x) => x.toString(16));
  if (bestLen < 2) return hex.join(":");
  return `${hex.slice(0, best).join(":")}::${hex.slice(best + bestLen).join(":")}`;
}

export function v6Type(h: number[]): string {
  const first = h[0]!;
  if (first >> 8 === 0xff) return "Multicast";
  if ((first & 0xffc0) === 0xfe80) return "Link local";
  if ((first & 0xfe00) === 0xfc00) return "Unique local";
  if ((first & 0xe000) === 0x2000) return "Global unicast";
  return "Special";
}

/** EUI-64 interface ID from a MAC: insert FFFE, flip the U/L bit. Returns 4 lowercase hextets. */
export function eui64(mac: string): string {
  const b = mac.split(/[:-]/).map((x) => parseInt(x, 16));
  b[0] = b[0]! ^ 0x02;
  const x = [b[0]!, b[1]!, b[2]!, 0xff, 0xfe, b[3]!, b[4]!, b[5]!];
  const words: string[] = [];
  for (let i = 0; i < 8; i += 2) words.push(((x[i]! << 8) | x[i + 1]!).toString(16));
  return words.join(":");
}

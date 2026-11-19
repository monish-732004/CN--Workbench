/**
 * sfc32: 128-bit state, 32-bit integer ops only, so instances are bit-identical
 * on every JS engine. Seeded from 16 bytes (derived server-side with HMAC).
 */
export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: Uint8Array) {
    if (seed.length < 16) throw new Error("Rng seed must be 16 bytes");
    const v = new DataView(seed.buffer, seed.byteOffset, 16);
    this.a = v.getUint32(0);
    this.b = v.getUint32(4);
    this.c = v.getUint32(8);
    this.d = v.getUint32(12);
    for (let i = 0; i < 15; i++) this.u32();
  }

  u32(): number {
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    t = (t + this.d) | 0;
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Unbiased integer in [lo, hi]. */
  int(lo: number, hi: number): number {
    const span = hi - lo + 1;
    if (span <= 0) throw new Error(`bad range ${lo}..${hi}`);
    const limit = Math.floor(0x100000000 / span) * span;
    let x: number;
    do {
      x = this.u32();
    } while (x >= limit);
    return lo + (x % span);
  }

  bool(): boolean {
    return (this.u32() & 1) === 1;
  }

  pick<T>(xs: readonly T[]): T {
    return xs[this.int(0, xs.length - 1)]!;
  }

  shuffle<T>(xs: readonly T[]): T[] {
    const a = xs.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  }

  /** k distinct items. */
  sample<T>(xs: readonly T[], k: number): T[] {
    return this.shuffle(xs).slice(0, k);
  }
}

/** Deterministic seed from a string, for tests and client-side previews only (not secret). */
export function seedFromString(s: string): Uint8Array {
  const out = new Uint8Array(16);
  let h1 = 0x811c9dc5,
    h2 = 0x01000193,
    h3 = 0x9e3779b9,
    h4 = 0x85ebca6b;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
    h3 = Math.imul(h3 ^ c, 0x27d4eb2d);
    h4 = Math.imul(h4 ^ c, 0x165667b1);
  }
  const v = new DataView(out.buffer);
  v.setUint32(0, h1 >>> 0);
  v.setUint32(4, h2 >>> 0);
  v.setUint32(8, h3 >>> 0);
  v.setUint32(12, h4 >>> 0);
  return out;
}

/** Pure IPv4 helpers. All addresses are unsigned 32-bit numbers. */

export function ipToInt(ip: string): number {
  const p = ip.trim().split(".");
  if (p.length !== 4) return NaN;
  let n = 0;
  for (const part of p) {
    if (!/^\d{1,3}$/.test(part)) return NaN;
    const v = Number(part);
    if (v > 255) return NaN;
    n = n * 256 + v;
  }
  return n >>> 0;
}

export function intToIp(n: number): string {
  n = n >>> 0;
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

export function maskInt(prefix: number): number {
  if (prefix <= 0) return 0;
  if (prefix >= 32) return 0xffffffff;
  return (0xffffffff << (32 - prefix)) >>> 0;
}

export function networkOf(ip: number, prefix: number): number {
  return (ip & maskInt(prefix)) >>> 0;
}

export function broadcastOf(ip: number, prefix: number): number {
  return (ip | ~maskInt(prefix)) >>> 0;
}

export function blockSize(prefix: number): number {
  return 2 ** (32 - prefix);
}

export function toBits(n: number, width = 32): string {
  return (n >>> 0).toString(2).padStart(32, "0").slice(32 - width);
}

export function bitsToInt(bits: string): number {
  return parseInt(bits, 2) >>> 0;
}

export function inPrefix(ip: number, net: number, prefix: number): boolean {
  return networkOf(ip, prefix) === (net >>> 0);
}

export function classOf(firstOctet: number): "A" | "B" | "C" | "D" | "E" {
  if (firstOctet < 128) return "A";
  if (firstOctet < 192) return "B";
  if (firstOctet < 224) return "C";
  if (firstOctet < 240) return "D";
  return "E";
}

/** Smallest prefix whose usable host count (2^h - 2) covers `hosts`. */
export function prefixForHosts(hosts: number): number {
  let h = 2;
  while (2 ** h - 2 < hosts) h++;
  return 32 - h;
}

export function fmtInt(n: number): string {
  return n.toLocaleString("en-IN");
}

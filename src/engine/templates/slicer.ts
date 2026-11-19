import type { Rng } from "../rng";
import { blockSize, intToIp, ipToInt, maskInt, prefixForHosts } from "../net";
import { fraction, type Difficulty, type Template } from "../types";

export interface Req {
  id: string;
  label: string;
  hosts: number;
}

export interface SlicerParams {
  d: Difficulty;
  parent: number;
  parentPrefix: number;
  reqs: Req[]; // shown in this (shuffled) order
}

export interface PlacedSubnet {
  id: string;
  prefix: number;
  offset: number; // addresses from parent start
}

export interface SlicerSolution {
  subnets: (PlacedSubnet & { network: string; first: string; last: string; broadcast: string; mask: string })[];
}

const LAN_NAMES = ["CSE Lab", "ECE Lab", "Admin", "Library", "Hostel", "Faculty", "Research", "Exam Cell", "Placement", "Mech Lab", "Civil Lab", "Auditorium"];

function hostsForPrefix(rng: Rng, prefix: number): number {
  const h = 32 - prefix;
  if (h === 2) return 2;
  const lo = 2 ** (h - 1) - 1; // smallest count that needs h host bits
  const hi = 2 ** h - 2;
  return rng.int(lo, hi);
}

/** Canonical VLSM (as taught): largest first, each in the lowest free aligned block. Ties keep input order. */
function canonical(p: SlicerParams): PlacedSubnet[] {
  const sized = p.reqs.map((r, i) => ({ id: r.id, prefix: prefixForHosts(r.hosts), i }));
  sized.sort((a, b) => a.prefix - b.prefix || a.i - b.i);
  let offset = 0;
  return sized.map((s) => {
    const placed = { id: s.id, prefix: s.prefix, offset };
    offset += blockSize(s.prefix);
    return placed;
  });
}

export function rangesFor(parent: number, prefix: number, offset: number) {
  const net = (parent + offset) >>> 0;
  const size = blockSize(prefix);
  return {
    network: intToIp(net),
    first: intToIp(net + 1),
    last: intToIp(net + size - 2),
    broadcast: intToIp(net + size - 1),
    mask: intToIp(maskInt(prefix)),
  };
}

function valid(p: SlicerParams, blocks: PlacedSubnet[]) {
  const parentSize = blockSize(p.parentPrefix);
  const issues = new Set<string>();
  const spans: [number, number][] = [];
  for (const b of blocks) {
    const size = blockSize(b.prefix);
    if (!Number.isInteger(b.offset) || b.offset < 0 || b.offset + size > parentSize) issues.add("vlsm.out-of-block");
    if (b.offset % size !== 0) issues.add("vlsm.unaligned");
    const need = p.reqs.find((r) => r.id === b.id)!.hosts;
    if (2 ** (32 - b.prefix) - 2 < need) issues.add("vlsm.too-small");
    spans.push([b.offset, b.offset + size]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < spans.length; i++) if (spans[i]![0] < spans[i - 1]![1]) issues.add("vlsm.overlap");
  return issues;
}

function parseBlocks(r: any, p: SlicerParams): PlacedSubnet[] | null {
  const src = r?.blocks;
  if (!src || typeof src !== "object") return null;
  const out: PlacedSubnet[] = [];
  for (const req of p.reqs) {
    const b = src[req.id];
    if (!b || !Number.isFinite(Number(b.offset)) || !Number.isFinite(Number(b.prefix))) return null;
    out.push({ id: req.id, prefix: Number(b.prefix), offset: Number(b.offset) });
  }
  return out;
}

export const slicer: Template<SlicerParams, SlicerSolution> = {
  id: "slicer",
  generate(rng, d) {
    const parentPrefix = d === "hard" ? rng.pick([22, 23]) : 24;
    const lanCount = d === "easy" ? 3 : d === "medium" ? 4 : 5;
    const wanCount = d === "easy" ? 0 : d === "medium" ? 1 : 2;
    const parentSize = blockSize(parentPrefix);
    for (let attempt = 0; attempt < 300; attempt++) {
      const choices = parentPrefix === 24 ? [25, 26, 27, 28, 29] : parentPrefix === 23 ? [24, 25, 26, 27, 28, 29] : [23, 24, 25, 26, 27, 28];
      const prefixes = Array.from({ length: lanCount }, () => rng.pick(choices));
      const used = prefixes.reduce((s, x) => s + blockSize(x), 0) + wanCount * 4;
      if (used > parentSize || used < parentSize * 0.55) continue;
      if (new Set(prefixes).size < Math.min(3, lanCount)) continue; // keep sizes varied
      const names = rng.sample(LAN_NAMES, lanCount);
      const reqs: Req[] = prefixes.map((px, i) => ({ id: `L${i}`, label: names[i]!, hosts: hostsForPrefix(rng, px) }));
      for (let w = 0; w < wanCount; w++) reqs.push({ id: `W${w}`, label: `WAN link ${w + 1}`, hosts: 2 });
      let parent: number;
      if (parentPrefix === 24) parent = ipToInt(`192.168.${rng.int(0, 255)}.0`);
      else {
        const third = rng.int(0, 255 >> (24 - parentPrefix)) << (24 - parentPrefix);
        parent = rng.bool() ? ipToInt(`10.${rng.int(0, 255)}.${third}.0`) : ipToInt(`172.${rng.int(16, 31)}.${third}.0`);
      }
      return { d, parent, parentPrefix, reqs: rng.shuffle(reqs) };
    }
    return {
      d,
      parent: ipToInt("192.168.40.0"),
      parentPrefix: 24,
      reqs: [
        { id: "L0", label: "CSE Lab", hosts: 60 },
        { id: "L1", label: "Admin", hosts: 28 },
        { id: "L2", label: "Library", hosts: 12 },
      ],
    };
  },
  solve(p) {
    return { subnets: canonical(p).map((c) => ({ ...c, ...rangesFor(p.parent, c.prefix, c.offset) })) };
  },
  view(p) {
    return {
      parent: intToIp(p.parent),
      parentPrefix: p.parentPrefix,
      parentSize: blockSize(p.parentPrefix),
      reqs: p.reqs,
    };
  },
  checkpoints() {
    return [
      { id: "sizing", title: "Size each subnet", weight: 0.3 },
      { id: "placement", title: "Place the blocks", weight: 0.3 },
      { id: "ranges", title: "Host ranges", weight: 0.4 },
    ];
  },
  grade(p, s, cp, r) {
    if (cp === "sizing") {
      const fields: Record<string, boolean> = {};
      let hits = 0;
      const mis = new Set<string>();
      for (const req of p.reqs) {
        const got = Number(r?.prefixes?.[req.id]);
        const want = prefixForHosts(req.hosts);
        const ok = got === want;
        fields[req.id] = ok;
        if (ok) hits++;
        else if (Number.isFinite(got) && got > want && 2 ** (32 - got) >= req.hosts) mis.add("subnet.usable-off-by-two");
        else if (Number.isFinite(got) && got > want) mis.add("vlsm.too-small");
        else if (Number.isFinite(got) && got < want) mis.add("vlsm.oversized");
      }
      return { score: fraction(hits, p.reqs.length), misconceptions: [...mis], fields };
    }
    const blocks = parseBlocks(r, p);
    if (!blocks) return { score: 0, misconceptions: ["vlsm.incomplete"] };
    const issues = valid(p, blocks);
    const canon = s.subnets;
    const key = (b: { prefix: number; offset: number }) => `${b.prefix}@${b.offset}`;
    const canonSet = new Map<string, number>();
    canon.forEach((c) => canonSet.set(key(c), (canonSet.get(key(c)) ?? 0) + 1));
    if (cp === "placement") {
      const sizesRight = blocks.every((b) => b.prefix === prefixForHosts(p.reqs.find((q) => q.id === b.id)!.hosts));
      const layoutSame = blocks.every((b) => {
        const k = key(b);
        const n = canonSet.get(k) ?? 0;
        if (n <= 0) return false;
        canonSet.set(k, n - 1);
        return true;
      });
      if (issues.size === 0 && sizesRight && layoutSame) return { score: 1, misconceptions: [] };
      if (issues.size === 0) return { score: 0.5, misconceptions: ["vlsm.non-canonical-order"] };
      const fields: Record<string, boolean> = {};
      let hits = 0;
      for (const b of blocks) {
        const c = canon.find((x) => x.id === b.id)!;
        const ok = c.prefix === b.prefix && c.offset === b.offset;
        fields[b.id] = ok;
        if (ok) hits++;
      }
      return { score: 0.6 * fraction(hits, blocks.length), misconceptions: [...issues], fields };
    }
    if (cp === "ranges") {
      const fields: Record<string, boolean> = {};
      let earned = 0;
      let total = 0;
      for (const b of blocks) {
        const c = canon.find((x) => x.id === b.id)!;
        const exact = c.prefix === b.prefix && c.offset === b.offset;
        const blockOk = b.offset % blockSize(b.prefix) === 0;
        const want = exact ? rangesFor(p.parent, c.prefix, c.offset) : blockOk ? rangesFor(p.parent, b.prefix, b.offset) : null;
        for (const f of ["first", "last", "broadcast"] as const) {
          total++;
          const got = String(r?.ranges?.[b.id]?.[f] ?? "").trim();
          const ok = !!want && got === want[f];
          fields[`${b.id}.${f}`] = ok;
          if (ok) earned += exact ? 1 : 0.75; // error carried forward from a non-canonical block
        }
      }
      const mis: string[] = [];
      for (const b of blocks) {
        const w = rangesFor(p.parent, b.prefix, b.offset);
        const got = r?.ranges?.[b.id];
        if (got && got.broadcast === w.last) mis.push("subnet.broadcast-off-by-one");
        if (got && got.first === w.network) mis.push("subnet.first-is-network");
      }
      return { score: total ? earned / total : 0, misconceptions: [...new Set(mis)], fields };
    }
    return { score: 0, misconceptions: [] };
  },
  optimalMoves(p) {
    return p.reqs.length * 5;
  },
  key(p) {
    return `${p.parent}/${p.parentPrefix}|${p.reqs.map((r) => r.hosts).sort((a, b) => a - b).join(",")}`;
  },
};

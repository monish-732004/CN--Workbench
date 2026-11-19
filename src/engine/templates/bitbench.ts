import type { Rng } from "../rng";
import { broadcastOf, classOf, intToIp, maskInt, networkOf, toBits } from "../net";
import type { Difficulty, Template } from "../types";

export interface BitbenchParams {
  d: Difficulty;
  ip: number;
  prefix: number;
}

export interface BitbenchSolution {
  prefix: number;
  network: number;
  broadcast: number;
  total: number;
  usable: number;
  cls: string;
}

function firstOctet(rng: Rng): number {
  const cls = rng.int(0, 2);
  if (cls === 0) return rng.int(1, 126);
  if (cls === 1) return rng.int(128, 191);
  return rng.int(192, 223);
}

export const bitbench: Template<BitbenchParams, BitbenchSolution> = {
  id: "bitbench",
  generate(rng, d) {
    const [lo, hi] = d === "easy" ? [24, 29] : d === "medium" ? [17, 23] : [9, 16];
    for (let i = 0; i < 100; i++) {
      const prefix = rng.int(lo, hi);
      const ip = ((firstOctet(rng) << 24) | (rng.int(0, 255) << 16) | (rng.int(0, 255) << 8) | rng.int(0, 255)) >>> 0;
      const host = ip & ~maskInt(prefix);
      const hostMax = (~maskInt(prefix)) >>> 0;
      // Not the network or broadcast address itself, and a mix of 0s and 1s in the host part.
      if (host === 0 || (host >>> 0) === hostMax) continue;
      return { d, ip, prefix };
    }
    return { d, ip: 0xac162596, prefix: 27 }; // 172.22.37.150/27
  },
  solve(p) {
    const total = 2 ** (32 - p.prefix);
    return {
      prefix: p.prefix,
      network: networkOf(p.ip, p.prefix),
      broadcast: broadcastOf(p.ip, p.prefix),
      total,
      usable: total - 2,
      cls: classOf(p.ip >>> 24),
    };
  },
  view(p) {
    return {
      ip: intToIp(p.ip),
      ipBits: toBits(p.ip),
      // Easy gives /n directly; medium and hard give the dotted mask so the boundary must be found.
      maskText: p.d === "easy" ? `/${p.prefix}` : intToIp(maskInt(p.prefix)),
      prefixGiven: p.d === "easy" ? p.prefix : null,
    };
  },
  checkpoints(p) {
    if (p.d === "easy")
      return [
        { id: "network", title: "Network address", weight: 0.35 },
        { id: "broadcast", title: "Broadcast address", weight: 0.35 },
        { id: "counts", title: "Address counts", weight: 0.3 },
      ];
    return [
      { id: "boundary", title: "Prefix boundary", weight: 0.2 },
      { id: "network", title: "Network address", weight: 0.3 },
      { id: "broadcast", title: "Broadcast address", weight: 0.3 },
      { id: "counts", title: "Address counts", weight: 0.2 },
    ];
  },
  grade(p, s, cp, r) {
    if (cp === "boundary") {
      const ok = Number(r?.prefix) === s.prefix;
      return { score: ok ? 1 : 0, misconceptions: ok ? [] : ["mask.boundary"], fields: { prefix: ok } };
    }
    if (cp === "network" || cp === "broadcast") {
      const bits = String(r?.bits ?? "");
      const target = toBits(cp === "network" ? s.network : s.broadcast);
      const ok = bits === target;
      const mis: string[] = [];
      if (!ok) {
        if (cp === "network" && bits === toBits(s.broadcast)) mis.push("mask.and-vs-or");
        if (cp === "broadcast" && bits === toBits(s.network)) mis.push("mask.and-vs-or");
        if (bits.slice(0, s.prefix) !== toBits(p.ip).slice(0, s.prefix)) mis.push("mask.changed-network-bits");
      }
      return { score: ok ? 1 : 0, misconceptions: mis, fields: { bits: ok } };
    }
    if (cp === "counts") {
      const total = Number(String(r?.total ?? "").replace(/[, ]/g, ""));
      const usable = Number(String(r?.usable ?? "").replace(/[, ]/g, ""));
      const okT = total === s.total;
      const okU = usable === s.usable;
      const mis: string[] = [];
      if (!okU && usable === s.total) mis.push("subnet.usable-off-by-two");
      return { score: ((okT ? 1 : 0) + (okU ? 1 : 0)) / 2, misconceptions: mis, fields: { total: okT, usable: okU } };
    }
    return { score: 0, misconceptions: [] };
  },
  optimalMoves(p) {
    return (p.d === "easy" ? 0 : 1) + (32 - p.prefix) + 2;
  },
  key(p) {
    return `${p.ip}/${p.prefix}`;
  },
};

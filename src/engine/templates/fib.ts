import type { Rng } from "../rng";
import { blockSize, inPrefix, intToIp, ipToInt } from "../net";
import { fraction, type Difficulty, type Template } from "../types";

export interface Route {
  net: number;
  len: number;
  iface: string;
  nextHop: string | null;
}

export interface FibParams {
  d: Difficulty;
  routes: Route[]; // display order (shuffled)
  packets: number[];
}

export interface FibSolution {
  out: string[]; // iface or "drop"
}

const IFACES = ["Gi0/0", "Gi0/1", "Gi0/2", "Se0/0/0", "Se0/0/1", "Se0/1/0"];

function lpm(routes: Route[], ip: number): Route | null {
  let best: Route | null = null;
  for (const r of routes) if (inPrefix(ip, r.net, r.len) && (!best || r.len > best.len)) best = r;
  return best;
}

function hostIn(rng: Rng, net: number, len: number, exclude: { net: number; len: number }[] = []): number {
  const size = blockSize(len);
  for (let i = 0; i < 500; i++) {
    const ip = (net + rng.int(1, size - 2)) >>> 0;
    if (!exclude.some((e) => inPrefix(ip, e.net, e.len))) return ip;
  }
  return (net + 1) >>> 0;
}

function subBlock(rng: Rng, net: number, len: number, subLen: number): number {
  const count = 2 ** (subLen - len);
  return (net + rng.int(0, count - 1) * blockSize(subLen)) >>> 0;
}

export const fib: Template<FibParams, FibSolution> = {
  id: "fib",
  generate(rng, d) {
    const ifaces = rng.shuffle(IFACES);
    let k = 0;
    const mk = (net: number, len: number): Route => {
      const iface = ifaces[k++ % ifaces.length]!;
      const nextHop = iface.startsWith("Se") ? `172.16.${rng.int(1, 254)}.${rng.pick([1, 2])}` : rng.bool() ? `10.255.${rng.int(0, 255)}.1` : null;
      return { net: net >>> 0, len, iface, nextHop };
    };
    const routes: Route[] = [];
    const packets: number[] = [];
    if (d === "easy") {
      const X = ipToInt(`10.${rng.int(1, 254)}.0.0`);
      const Y = subBlock(rng, X, 16, 24);
      const Z = ipToInt(`172.${rng.int(16, 31)}.${rng.int(0, 255)}.0`);
      routes.push(mk(X, 16), mk(Y, 24), mk(Z, 24), mk(0, 0));
      packets.push(hostIn(rng, Y, 24), hostIn(rng, X, 16, [{ net: Y, len: 24 }]), hostIn(rng, Z, 24), ipToInt(`198.51.100.${rng.int(1, 254)}`));
    } else if (d === "medium") {
      const A = ipToInt(`10.${rng.int(1, 254)}.${rng.int(0, 63) * 4}.0`);
      const B = subBlock(rng, A, 22, 24);
      const cLen = rng.pick([25, 26]);
      const C = subBlock(rng, B, 24, cLen);
      const D = ipToInt(`172.${rng.int(16, 31)}.${rng.int(0, 255)}.0`);
      routes.push(mk(A, 22), mk(B, 24), mk(C, cLen), mk(D, 24), mk(0, 0));
      packets.push(
        hostIn(rng, C, cLen),
        hostIn(rng, B, 24, [{ net: C, len: cLen }]),
        hostIn(rng, A, 22, [{ net: B, len: 24 }]),
        hostIn(rng, D, 24),
        ipToInt(`203.0.113.${rng.int(1, 254)}`),
      );
    } else {
      const A = ipToInt(`10.${rng.int(1, 254)}.${rng.int(0, 31) * 8}.0`);
      const B = subBlock(rng, A, 21, 23);
      const C = subBlock(rng, B, 23, 26);
      const D = subBlock(rng, C, 26, 28);
      const E = ipToInt(`172.${rng.int(16, 31)}.${rng.int(0, 255)}.0`);
      routes.push(mk(A, 21), mk(B, 23), mk(C, 26), mk(D, 28), mk(E, 24));
      packets.push(
        hostIn(rng, D, 28),
        hostIn(rng, C, 26, [{ net: D, len: 28 }]),
        hostIn(rng, B, 23, [{ net: C, len: 26 }]),
        hostIn(rng, A, 21, [{ net: B, len: 23 }]),
        hostIn(rng, E, 24),
        ipToInt(`192.0.2.${rng.int(1, 254)}`), // no route and no default: drop
      );
    }
    return { d, routes: rng.shuffle(routes), packets: rng.shuffle(packets) };
  },
  solve(p) {
    return { out: p.packets.map((ip) => lpm(p.routes, ip)?.iface ?? "drop") };
  },
  view(p) {
    return {
      routes: p.routes.map((r) => ({ prefix: r.len === 0 ? "0.0.0.0/0" : `${intToIp(r.net)}/${r.len}`, iface: r.iface, nextHop: r.nextHop })),
      packets: p.packets.map(intToIp),
      ifaces: [...new Set(p.routes.map((r) => r.iface))].sort(),
      hasDefault: p.routes.some((r) => r.len === 0),
    };
  },
  checkpoints() {
    return [{ id: "forward", title: "Forwarding decisions", weight: 1 }];
  },
  grade(p, s, _cp, r) {
    const fields: Record<string, boolean> = {};
    let hits = 0;
    const mis = new Set<string>();
    p.packets.forEach((ip, i) => {
      const got = r?.out?.[i];
      const ok = got === s.out[i];
      fields[`p${i + 1}`] = ok;
      if (ok) {
        hits++;
        return;
      }
      const matches = p.routes.filter((rt) => inPrefix(ip, rt.net, rt.len));
      if (matches[0] && got === matches[0].iface) mis.add("lpm.first-match");
      const shortest = matches.slice().sort((a, b) => a.len - b.len)[0];
      if (shortest && got === shortest.iface && shortest.len > 0) mis.add("lpm.shortest-match");
      if (shortest && shortest.len === 0 && got === shortest.iface) mis.add("lpm.default-preferred");
      if (got === "drop" && matches.length) mis.add("lpm.dropped-routable");
    });
    return { score: fraction(hits, p.packets.length), misconceptions: [...mis], fields };
  },
  optimalMoves(p) {
    return p.packets.length;
  },
  key(p) {
    return p.routes.map((r) => `${r.net}/${r.len}`).sort().join(",");
  },
};

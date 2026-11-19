import type { Rng } from "../rng";
import { fraction, type Difficulty, type Template } from "../types";

export type Edge = [string, string, number];

export interface SpfParams {
  d: Difficulty;
  nodes: string[];
  edges: Edge[];
  root: string;
}

export interface SpfSolution {
  order: string[];
  dist: Record<string, number>;
  pred: Record<string, string>;
  nextHop: Record<string, string>;
  improvements: number;
}

/** Dijkstra that also reports whether the run was free of ties (unique picks and unique paths). */
export function dijkstra(p: Pick<SpfParams, "nodes" | "edges" | "root">): SpfSolution & { clean: boolean } {
  const adj = new Map<string, [string, number][]>();
  p.nodes.forEach((n) => adj.set(n, []));
  for (const [a, b, w] of p.edges) {
    adj.get(a)!.push([b, w]);
    adj.get(b)!.push([a, w]);
  }
  const D: Record<string, number> = {};
  const pred: Record<string, string> = {};
  const done = new Set<string>([p.root]);
  p.nodes.forEach((n) => (D[n] = Infinity));
  D[p.root] = 0;
  let clean = true;
  let improvements = 0;
  for (const [x, w] of adj.get(p.root)!) {
    D[x] = w;
    pred[x] = p.root;
  }
  const order: string[] = [];
  while (done.size < p.nodes.length) {
    const cand = p.nodes.filter((n) => !done.has(n)).sort((a, b) => D[a]! - D[b]!);
    const w = cand[0]!;
    if (!Number.isFinite(D[w]!)) {
      clean = false;
      break;
    }
    if (cand[1] && D[cand[1]] === D[w]) clean = false;
    done.add(w);
    order.push(w);
    for (const [x, c] of adj.get(w)!) {
      if (done.has(x)) continue;
      const nd = D[w]! + c;
      if (nd < D[x]!) {
        if (Number.isFinite(D[x]!)) improvements++;
        D[x] = nd;
        pred[x] = w;
      } else if (nd === D[x]) clean = false;
    }
  }
  const nextHop: Record<string, string> = {};
  for (const n of p.nodes) {
    if (n === p.root || !pred[n]) continue;
    let cur = n;
    while (pred[cur] !== p.root) cur = pred[cur]!;
    nextHop[n] = cur;
  }
  return { order, dist: D, pred, nextHop, improvements, clean };
}

export const spf: Template<SpfParams, SpfSolution> = {
  id: "spf",
  generate(rng: Rng, d) {
    const n = d === "easy" ? 5 : d === "medium" ? 6 : 7;
    const extra = d === "easy" ? 2 : d === "medium" ? 3 : 5;
    const minImprove = d === "easy" ? 1 : d === "medium" ? 2 : 3;
    const labels = "ABCDEFG".slice(0, n).split("");
    for (let attempt = 0; attempt < 2000; attempt++) {
      const edges: Edge[] = [];
      const has = (a: string, b: string) => edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
      for (let i = 1; i < n; i++) {
        // Tree edges join near neighbours on the drawn ring (labels are laid out in order) to limit crossings.
        const j = Math.max(0, i - rng.int(1, 2));
        edges.push([labels[j]!, labels[i]!, rng.int(1, 9)]);
      }
      if (rng.bool()) {
        const last = labels[n - 1]!;
        if (!has("A", last)) edges.push(["A", last, rng.int(1, 9)]);
      }
      let tries = 0;
      while (edges.length < n - 1 + extra && tries++ < 50) {
        const i = rng.int(0, n - 1);
        const gap = rng.int(2, 3);
        const a = labels[i]!;
        const b = labels[(i + gap) % n]!;
        if (a !== b && !has(a, b)) edges.push([a, b, rng.int(1, 9)]);
      }
      const res = dijkstra({ nodes: labels, edges, root: "A" });
      if (res.clean && res.improvements >= minImprove && res.order.length === n - 1) {
        return { d, nodes: labels, edges, root: "A" };
      }
    }
    return {
      d,
      nodes: ["A", "B", "C", "D", "E", "F"],
      edges: [["A", "B", 4], ["A", "C", 1], ["C", "B", 2], ["B", "D", 5], ["C", "D", 8], ["C", "E", 9], ["D", "E", 2], ["D", "F", 6], ["E", "F", 3]],
      root: "A",
    };
  },
  solve(p) {
    const { clean: _c, ...s } = dijkstra(p);
    return s;
  },
  view(p) {
    return { nodes: p.nodes, edges: p.edges, root: p.root, askNextHop: p.d !== "easy" };
  },
  checkpoints(p) {
    if (p.d === "easy")
      return [
        { id: "order", title: "Order nodes join the tree", weight: 0.5 },
        { id: "distances", title: "Shortest distances", weight: 0.5 },
      ];
    return [
      { id: "order", title: "Order nodes join the tree", weight: 0.35 },
      { id: "distances", title: "Shortest distances", weight: 0.35 },
      { id: "nexthops", title: `${p.root}'s forwarding table`, weight: 0.3 },
    ];
  },
  grade(p, s, cp, r) {
    const targets = p.nodes.filter((n) => n !== p.root);
    if (cp === "order") {
      const got: unknown[] = Array.isArray(r?.order) ? r.order : [];
      let hits = 0;
      const fields: Record<string, boolean> = {};
      s.order.forEach((n, i) => {
        const ok = got[i] === n;
        fields[`#${i + 1}`] = ok;
        if (ok) hits++;
      });
      return { score: fraction(hits, s.order.length), misconceptions: hits < s.order.length ? ["dijkstra.picked-non-min"] : [], fields };
    }
    if (cp === "distances") {
      let hits = 0;
      const fields: Record<string, boolean> = {};
      const mis = new Set<string>();
      for (const n of targets) {
        const got = Number(r?.distances?.[n]);
        const ok = got === s.dist[n];
        fields[n] = ok;
        if (ok) hits++;
        else {
          const direct = p.edges.find(([a, b]) => (a === p.root && b === n) || (b === p.root && a === n));
          if (direct && got === direct[2]) mis.add("dijkstra.no-relaxation");
        }
      }
      return { score: fraction(hits, targets.length), misconceptions: [...mis], fields };
    }
    if (cp === "nexthops") {
      let hits = 0;
      const fields: Record<string, boolean> = {};
      const mis = new Set<string>();
      for (const n of targets) {
        const got = r?.nexthops?.[n];
        const ok = got === s.nextHop[n];
        fields[n] = ok;
        if (ok) hits++;
        else if (got === s.pred[n]) mis.add("dijkstra.next-hop-is-predecessor");
      }
      return { score: fraction(hits, targets.length), misconceptions: [...mis], fields };
    }
    return { score: 0, misconceptions: [] };
  },
  optimalMoves(p) {
    const k = p.nodes.length - 1;
    return p.d === "easy" ? 2 * k : 3 * k;
  },
  key(p) {
    return p.edges.map(([a, b, w]) => `${a}${b}${w}`).sort().join(",");
  },
};

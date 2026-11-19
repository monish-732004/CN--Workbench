import type { Rng } from "../rng";
import { fraction, type Difficulty, type Template } from "../types";

/**
 * RIP update at router B on receiving C's response (Forouzan §20.3, slide U3 p.80):
 * add 1 hop, set next router = C, then keep the old route except when
 *  (1) the destination is new → add, (2) the new cost is lower → replace,
 *  (3) the new cost is higher but the next router is the same → replace.
 * Directly connected networks cost 1 hop. 16 = infinity.
 */
type Case = "direct" | "add" | "lower" | "sameNextHigher" | "sameNextInfinity" | "keepHigher" | "notAdvertised" | "refresh";

export interface OldRow {
  dest: string;
  next: string | null;
  cost: number;
}
export interface AdvRow {
  dest: string;
  cost: number;
}

export interface VectorsParams {
  d: Difficulty;
  me: string;
  from: string;
  others: string[];
  old: OldRow[];
  adv: AdvRow[];
  cases: Record<string, Case>;
}

export type Action = "keep" | "replace" | "add";
export interface VecRow {
  dest: string;
  actions: Action[];
  next: string | null;
  cost: number;
}
export interface VectorsSolution {
  rows: VecRow[];
}

const CASES: Record<Difficulty, Case[]> = {
  easy: ["direct", "add", "lower", "keepHigher"],
  medium: ["direct", "add", "lower", "sameNextHigher", "keepHigher", "notAdvertised"],
  hard: ["direct", "add", "lower", "sameNextHigher", "sameNextInfinity", "keepHigher", "refresh"],
};

export const vectors: Template<VectorsParams, VectorsSolution> = {
  id: "vectors",
  generate(rng: Rng, d) {
    const others = d === "hard" ? ["A", "D"] : ["A"];
    const cases = rng.shuffle(CASES[d]);
    const dests = Array.from({ length: cases.length }, (_, i) => `N${i + 1}`);
    const old: OldRow[] = [];
    const adv: AdvRow[] = [];
    const caseMap: Record<string, Case> = {};
    cases.forEach((c, i) => {
      const dest = dests[i]!;
      caseMap[dest] = c;
      const other = rng.pick(others);
      switch (c) {
        case "direct":
          old.push({ dest, next: null, cost: 1 });
          adv.push({ dest, cost: rng.int(1, 4) });
          break;
        case "add":
          adv.push({ dest, cost: rng.int(1, 6) });
          break;
        case "lower": {
          const x = rng.int(4, 9);
          old.push({ dest, next: other, cost: x });
          adv.push({ dest, cost: rng.int(1, x - 2) });
          break;
        }
        case "sameNextHigher": {
          const x = rng.int(2, 5);
          old.push({ dest, next: "C", cost: x });
          adv.push({ dest, cost: rng.int(x, x + 5) });
          break;
        }
        case "sameNextInfinity": {
          old.push({ dest, next: "C", cost: rng.int(3, 6) });
          adv.push({ dest, cost: rng.pick([15, 16]) });
          break;
        }
        case "keepHigher": {
          const x = rng.int(2, 6);
          old.push({ dest, next: other, cost: x });
          adv.push({ dest, cost: rng.int(x - 1, x + 4) });
          break;
        }
        case "notAdvertised":
          old.push({ dest, next: other, cost: rng.int(2, 7) });
          break;
        case "refresh": {
          const x = rng.int(2, 6);
          old.push({ dest, next: "C", cost: x });
          adv.push({ dest, cost: x - 1 });
          break;
        }
      }
    });
    const byDest = (a: { dest: string }, b: { dest: string }) => Number(a.dest.slice(1)) - Number(b.dest.slice(1));
    return { d, me: "B", from: "C", others, old: old.sort(byDest), adv: adv.sort(byDest), cases: caseMap };
  },
  solve(p) {
    const dests = [...new Set([...p.old.map((o) => o.dest), ...p.adv.map((a) => a.dest)])].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
    const rows: VecRow[] = dests.map((dest) => {
      const o = p.old.find((x) => x.dest === dest);
      const a = p.adv.find((x) => x.dest === dest);
      if (!a) return { dest, actions: ["keep"], next: o!.next, cost: o!.cost };
      const nc = Math.min(16, a.cost + 1);
      if (!o) return { dest, actions: ["add"], next: p.from, cost: nc };
      if (nc < o.cost) return { dest, actions: ["replace"], next: p.from, cost: nc };
      if (o.next === p.from) {
        if (nc === o.cost) return { dest, actions: ["keep", "replace"], next: p.from, cost: nc };
        return { dest, actions: ["replace"], next: p.from, cost: nc };
      }
      return { dest, actions: ["keep"], next: o.next, cost: o.cost };
    });
    return { rows };
  },
  view(p) {
    return { me: p.me, from: p.from, neighbours: [...p.others, p.from].sort(), old: p.old, adv: p.adv };
  },
  checkpoints() {
    return [{ id: "table", title: "Updated forwarding table", weight: 1 }];
  },
  grade(p, s, _cp, r) {
    const fields: Record<string, boolean> = {};
    const mis = new Set<string>();
    let hits = 0;
    for (const row of s.rows) {
      const got = r?.rows?.[row.dest] ?? {};
      const next = got.next === "" || got.next === undefined ? null : got.next;
      const cost = Number(got.cost);
      const ok = row.actions.includes(got.action) && next === row.next && cost === row.cost;
      fields[row.dest] = ok;
      if (ok) hits++;
      else {
        const c = p.cases[row.dest];
        const a = p.adv.find((x) => x.dest === row.dest);
        if (a && cost === a.cost && next === p.from) mis.add("rip.no-plus-one");
        if ((c === "sameNextHigher" || c === "sameNextInfinity") && got.action === "keep") mis.add("rip.rule3-ignored");
        if (c === "sameNextInfinity" && cost > 16) mis.add("rip.16-is-infinity");
        if (c === "direct" && got.action !== "keep") mis.add("rip.replaced-direct");
      }
    }
    return { score: fraction(hits, s.rows.length), misconceptions: [...mis], fields };
  },
  optimalMoves(p) {
    const s = vectors.solve(p);
    const changed = s.rows.filter((r) => !r.actions.includes("keep")).length;
    return changed * 3;
  },
  key(p) {
    return JSON.stringify([p.old, p.adv]);
  },
};

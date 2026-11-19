/* Engine self-check: golden tests from the course slides + property tests over seeds. Run: npm run test:engine */
import { TEMPLATES } from "../src/engine/registry";
import { Rng, seedFromString } from "../src/engine/rng";
import { DIFFICULTIES } from "../src/engine/types";
import { decode, encode } from "../src/engine/templates/hamming";
import { crc } from "../src/engine/templates/crc";
import { rangesFor } from "../src/engine/templates/slicer";
import { toBits } from "../src/engine/net";
import { scoreAttempt } from "../src/engine/scoring";
import { DEFAULT_SCORING } from "../src/engine/model";
import { perfectResponse } from "./perfect";
import { resolveMode, TOPICS } from "../src/engine/catalog";
import { customAnswer, customKey, generateCustom, gradeCustom, validateCustom } from "../src/engine/custom";
import { evaluate } from "../src/engine/expr";
import { stuff, unstuff } from "../src/engine/templates/stuffing";
import { compressV6, expandV6, eui64 } from "../src/engine/ipv6";

eq("bit stuffing (U4)", stuff("0111111011111100").stuffed, "011111010111110100");
eq("bit unstuffing", unstuff("1011111001111100").unstuffed, "10111110111110");
eq("ipv6 compress tie → leftmost", compressV6(expandV6("2001:0DB8:0000:0000:0A40:0000:0000:00F1")!), "2001:db8::a40:0:0:f1");
eq("eui-64", eui64("00:1A:2B:3C:4D:5E"), "21a:2bff:fe3c:4d5e");

let failures = 0;
function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) {
    failures++;
    console.log(`FAIL ${name}\n  got:  ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`);
  }
}

// ── Golden tests (values verified independently of the slides) ──
eq("hamming encode 1011011 (U4 p.123)", encode("1011011"), "10101010111");
eq("hamming decode 10101000111 (U4 p.127)", decode("10101000111").errorPos, 5);
eq("hamming encode 0110 (U4 p.129)", encode("0110"), "0110011");
eq("hamming decode 0110111 (U4 p.135)", decode("0110111").errorPos, 3);
eq("hamming encode 1101", encode("1101"), "1100110");
eq("hamming decode 1011001", decode("1011001"), { syndrome: "111", errorPos: 7, corrected: "0011001", dataword: "0010" });
eq("crc 1001 / 1011 (Forouzan Fig 10.6)", crc.solve({ d: "medium", data: "1001", gen: "1011" }).remainder, "110");
eq("crc 1101011 / 1011", crc.solve({ d: "medium", data: "1101011", gen: "1011" }).codeword, "1101011110");
eq("crc 1010001101 / 110101 (U4 p.107)", crc.solve({ d: "hard", data: "1010001101", gen: "110101" }).remainder, "01110");
eq("vlsm 192.168.10.0 A/26", rangesFor(0xc0a80a00, 26, 0), { network: "192.168.10.0", first: "192.168.10.1", last: "192.168.10.62", broadcast: "192.168.10.63", mask: "255.255.255.192" });
eq("bits", toBits(0xa7c7aa52).slice(24), "01010010");

// PRD §8.5 worked example: S = 79.20 → 8.0 / 10
{
  const mk = (difficulty: "easy" | "medium" | "hard", acc: number, t: number, te: number, m: number, mo: number, w: number) => ({
    index: 0, slot: 0, topicId: "x", templateId: "x", difficulty, title: "x", expectedSec: te, optimalMoves: mo,
    checkpoints: [{ id: "a", title: "a", weight: 1 }],
    cp: { a: { score: acc, checks: w + 1, wrong: w, correct: acc === 1, locked: false, misconceptions: [] } },
    stats: { activeMs: t * 1000, moves: m, undos: 0, resets: 0, maxOscillation: 0, checkLog: [] },
    submitted: true,
  });
  const res = scoreAttempt(
    {
      status: "submitted",
      submittedAt: 1_000_000 + 180_000,
      integrity: [
        { id: "1", type: "tab_hidden", at: 0, durationMs: 12000 },
        { id: "2", type: "window_blur", at: 0, durationMs: 3000 },
      ],
      items: [mk("easy", 1, 80, 90, 10, 8, 0), mk("medium", 0.75, 420, 300, 30, 16, 3), mk("hard", 1, 500, 600, 25, 22, 1)],
    },
    { endAt: 1_000_000, cfg: { ...DEFAULT_SCORING, late: { mode: "penalise", ratePct: 2, stepMin: 5, capPct: 30 } }, now: 0 },
  );
  eq("PRD worked example S", res.score.toFixed(2), "79.20");
  eq("PRD worked example marks", res.marks, 8);
}

// ── Property tests: the solver's own answer must score 1.0 on every checkpoint ──
const SEEDS = 300;
// Every catalogue topic (template + mode) at every difficulty
const runs = TOPICS.map((tp) => ({ name: tp.mode ? `${tp.template}:${tp.mode}` : tp.template, id: tp.template as string, topic: tp }));
for (const { name, id, topic } of runs) {
  const t = TEMPLATES[topic.template];
  for (const d of DIFFICULTIES) {
    const keys = new Set<string>();
    const mode = resolveMode(topic, d);
    for (let i = 0; i < SEEDS; i++) {
      const p = t.generate(new Rng(seedFromString(`${name}|${d}|${i}`)), d, mode);
      // Determinism: same seed → same params
      const p2 = t.generate(new Rng(seedFromString(`${name}|${d}|${i}`)), d, mode);
      if (JSON.stringify(p) !== JSON.stringify(p2)) {
        failures++;
        console.log(`FAIL ${id}/${d} non-deterministic at seed ${i}`);
      }
      keys.add(t.key(p));
      const s = t.solve(p);
      for (const c of t.checkpoints(p)) {
        const g = t.grade(p, s, c.id, perfectResponse(id, p, s, c.id));
        if (Math.abs(g.score - 1) > 1e-9) {
          failures++;
          if (failures < 15) console.log(`FAIL ${id}/${d} seed ${i} checkpoint ${c.id} score ${g.score}`, JSON.stringify(p).slice(0, 300));
        }
      }
      // Secrecy: the public view must not be identical to a full solution leaf for key answers
      const v = JSON.stringify(t.view(p));
      if (id === "bitbench" && v.includes(toBits((s as any).network))) {
        failures++;
        console.log(`FAIL ${id}/${d} leaks network bits`);
      }
      if (t.optimalMoves(p, s) <= 0) {
        failures++;
        console.log(`FAIL ${id}/${d} optimalMoves <= 0`);
      }
    }
    console.log(`${name.padEnd(18)} ${d.padEnd(7)} distinct ${keys.size}/${SEEDS}`);
  }
}

// ── Teacher questions ──
{
  const q = validateCustom(
    { type: "numeric", prompt: "Propagation over {d} km at 2e8 m/s in ms?", vars: [{ name: "d", min: 100, max: 5000, step: 100 }], formula: "d*1000/2e8*1000", tolerance: 0.001, difficulty: "easy" },
    0,
  );
  if (typeof q === "string") {
    failures++;
    console.log("FAIL custom validate", q);
  } else {
    const keys = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const p = generateCustom(q, new Rng(seedFromString(`c${i}`)));
      keys.add(customKey(p));
      const ans = customAnswer(p)!;
      eq(`custom numeric ${i}`, gradeCustom(p, { value: String(ans) }).score, 1);
      if (i === 0) eq("custom numeric value", ans, (p.vars.d! * 1000 * 1000) / 2e8);
    }
    console.log(`custom numeric      distinct ${keys.size}/100`);
  }
  const mcq = validateCustom({ type: "mcq", prompt: "Which layer routes?", options: [{ text: "Network", correct: true }, { text: "Transport" }, { text: "Physical" }, { text: "Session" }] }, 1) as any;
  const pm = generateCustom(mcq, new Rng(seedFromString("m")));
  eq("custom mcq correct", gradeCustom(pm, { choice: "o0" }).score, 1);
  eq("custom mcq wrong", gradeCustom(pm, { choice: "o1" }).score, 0);
  eq("expr", evaluate("2^3 + log2(1024) - max(1, 4) * (3 % 2)", {}), 14);
  eq("custom rejects bad formula", typeof validateCustom({ type: "numeric", prompt: "x?", formula: "foo(", vars: [] }, 2), "string");
}

console.log(failures ? `\n${failures} failure(s)` : "\nAll engine checks passed");
process.exit(failures ? 1 : 0);

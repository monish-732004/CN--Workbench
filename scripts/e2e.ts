/* End-to-end API test against a running server. Run: npx tsx scripts/e2e.ts [baseUrl] */
import { DEFAULT_SCORING } from "../src/engine/model";
import { scoreAttempt } from "../src/engine/scoring";
import { TOPICS } from "../src/engine/catalog";
import { perfectResponse } from "./perfect";

const BASE = process.argv[2] ?? "http://localhost:3100";
let failures = 0;
const ok = (cond: unknown, name: string, extra?: unknown) => {
  if (!cond) {
    failures++;
    console.log(`FAIL ${name}`, extra ?? "");
  } else console.log(`ok   ${name}`);
};

async function call(path: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(BASE + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json().catch(() => ({}))) as any };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) break;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }

  // Teacher creates a room covering every topic
  const create = await call("/api/rooms", {
    title: "E2E check",
    section: "K2",
    topics: TOPICS.map((t) => t.id),
    mix: { easy: 4, medium: 4, hard: 3 },
    durationMode: "1.25",
    lateMode: "flag",
    graceMin: 10,
    feedback: "checkpoint",
  });
  ok(create.status === 200 && create.data.code?.length === 6, "create room", create.data);
  const code: string = create.data.code;
  const host = { "x-host-key": create.data.hostKey };

  const pub = await call(`/api/rooms/${code}`);
  ok(pub.data.phase === "waiting" && pub.data.items === 11, "room waiting with 11 items", pub.data);
  ok((await call(`/api/rooms/${code}/host`, undefined, { "x-host-key": "wrong" })).status === 403, "wrong host key rejected");

  // Students join
  const students = [
    { regNo: "RA2311003010001", name: "Asha Raman" },
    { regNo: "RA2311003010002", name: "Bharath K" },
    { regNo: "RA2311003010003", name: "Charu S" },
  ];
  const tokens: Record<string, string> = {};
  for (const s of students) {
    const j = await call("/api/play/join", { code, ...s });
    ok(j.status === 200 && j.data.token, `join ${s.regNo}`, j.data);
    tokens[s.regNo] = j.data.token;
    const leak = JSON.stringify(j.data.attempt).includes('"solution"') || JSON.stringify(j.data.attempt).includes('"params"');
    ok(!leak, `no params/solution in student payload ${s.regNo}`);
  }
  ok((await call("/api/play/join", { code, regNo: "bad id!", name: "X" })).status === 400, "invalid register number rejected");

  const st = (reg: string) => ({ "x-attempt-token": tokens[reg]! });
  const A = students[0]!.regNo;
  const B = students[1]!.regNo;
  const C = students[2]!.regNo;

  ok((await call("/api/play/begin", { code, regNo: A }, st(A))).status === 409, "cannot begin before start");
  ok((await call(`/api/rooms/${code}/host`, { action: "start" }, host)).status === 200, "teacher starts room");
  for (const r of [A, B, C]) ok((await call("/api/play/begin", { code, regNo: r }, st(r))).status === 200, `begin ${r}`);

  // Uniqueness: same slot, different instances across students
  const details: Record<string, any> = {};
  for (const r of [A, B, C]) details[r] = (await call(`/api/rooms/${code}/host/attempt?reg=${r}`, undefined, host)).data;
  const dups: string[] = [];
  for (let slot = 0; slot < 11; slot++) {
    const its = [A, B, C].map((r) => details[r].items.find((it: any) => it.slot === slot));
    if (new Set(its.map((it: any) => it.key)).size < its.length) dups.push(`${its[0].templateId}/${its[0].difficulty}`);
  }
  // Cable pinouts are recall items with a tiny answer space (documented as low-entropy); all others must be unique.
  ok(dups.filter((x) => !x.startsWith("pinout")).length === 0, "every slot has distinct instances across 3 students (except pinout recall)", dups);
  const orders = [A, B, C].map((r) => details[r].items.map((it: any) => it.slot).join(","));
  ok(new Set(orders).size > 1, "question order differs between students", orders);

  // Student A solves everything perfectly
  let allCorrect = true;
  for (const it of details[A].items) {
    for (const cp of it.checkpoints) {
      const resp = perfectResponse(it.templateId, it.params, it.solution, cp.id);
      let res = await call("/api/play/check", { code, regNo: A, itemIndex: it.index, checkpointId: cp.id, response: resp, stats: { [it.index]: { moves: it.optimalMoves, activeMs: it.expectedSec * 600 } } }, st(A));
      if (res.status === 429) {
        await sleep(1300);
        res = await call("/api/play/check", { code, regNo: A, itemIndex: it.index, checkpointId: cp.id, response: resp }, st(A));
      }
      if (res.data?.verdict?.status !== "correct") {
        allCorrect = false;
        console.log("  not correct:", it.templateId, cp.id, res.status, res.data);
      }
      await sleep(1250);
    }
  }
  ok(allCorrect, "perfect answers verified for every template through the API");

  // Student B: one wrong check, then rate limit, then integrity events
  const bItem = details[B].items[0];
  const bcp = bItem.checkpoints[0].id;
  const wrong = await call("/api/play/check", { code, regNo: B, itemIndex: 0, checkpointId: bcp, response: {} }, st(B));
  ok(wrong.data?.verdict?.status === "incorrect" && wrong.data.verdict.checksLeft === 3, "wrong answer counted", wrong.data);
  const fast = await call("/api/play/check", { code, regNo: B, itemIndex: 0, checkpointId: bcp, response: {} }, st(B));
  ok(fast.status === 429, "rapid re-check rate limited");
  const ev = await call(
    "/api/play/events",
    { code, regNo: B, events: [{ type: "tab_hidden", at: Date.now() - 13000, durationMs: 12000 }, { type: "window_blur", at: Date.now() - 5000, durationMs: 3000 }, { type: "bogus" }] },
    st(B),
  );
  ok(ev.status === 200, "integrity events accepted");

  // Student C rejoins from another device: old token dies, multi_session recorded
  const old = tokens[C]!;
  await call("/api/play/sync", { code, regNo: C, fullscreen: true, visible: true }, st(C));
  const rj = await call("/api/play/join", { code, regNo: C, name: "Charu S" });
  tokens[C] = rj.data.token;
  ok((await call("/api/play/state", { code, regNo: C }, { "x-attempt-token": old })).status === 401, "old session rejected after rejoin");

  // A finishes
  ok((await call("/api/play/submit", { code, regNo: A, finish: true }, st(A))).data.attempt?.status === "submitted", "A submits");

  // Teacher view
  const h1 = (await call(`/api/rooms/${code}/host`, undefined, host)).data;
  const sumA = h1.attempts.find((a: any) => a.regNo === A);
  const sumB = h1.attempts.find((a: any) => a.regNo === B);
  const sumC = h1.attempts.find((a: any) => a.regNo === C);
  ok(!JSON.stringify(h1).includes('"solution"'), "dashboard payload carries no solutions");
  const sA = scoreAttempt(sumA, { endAt: h1.room.endAt, cfg: DEFAULT_SCORING, now: Date.now() });
  ok(Math.abs(sA.accuracy - 1) < 1e-9, "A accuracy 100%", sA.accuracy);
  ok(sA.score > 95 && sA.marks >= 9.5, "A score/marks high", { score: sA.score, marks: sA.marks });
  const sB = scoreAttempt(sumB, { endAt: h1.room.endAt, cfg: DEFAULT_SCORING, now: Date.now() });
  ok(sB.counts.tab === 1 && sB.counts.blur === 1 && Math.abs(sB.integrity - 0.916) < 1e-9, "B integrity 0.916 (tab 12 s + blur 3 s)", sB);
  ok(sumC.integrity.some((e: any) => e.type === "multi_session"), "C multi_session recorded");

  // Teacher saves criteria and excuses B's tab switch
  const tabEv = sumB.integrity.find((e: any) => e.type === "tab_hidden");
  ok((await call(`/api/rooms/${code}/host`, { action: "excuse", reg: B, eventId: tabEv.id }, host)).status === 200, "excuse event");
  ok((await call(`/api/rooms/${code}/host`, { action: "scoring", scoring: { ...DEFAULT_SCORING, maxMarks: 20 } }, host)).data.room.scoring.maxMarks === 20, "save criteria");

  // End room → everyone auto-submitted, checks refused
  ok((await call(`/api/rooms/${code}/host`, { action: "end" }, host)).status === 200, "teacher ends room");
  const h2 = (await call(`/api/rooms/${code}/host`, undefined, host)).data;
  ok(h2.room.phase === "closed" && h2.attempts.every((a: any) => a.status === "submitted"), "all attempts submitted after end", h2.attempts.map((a: any) => a.status));
  ok((await call("/api/play/check", { code, regNo: B, itemIndex: 0, checkpointId: bcp, response: {} }, st(B))).status === 410, "checks refused after close");
  const sB2 = scoreAttempt(h2.attempts.find((a: any) => a.regNo === B), { endAt: h2.room.endAt, excused: h2.room.excused[B], cfg: h2.room.scoring, now: Date.now() });
  ok(Math.abs(sB2.integrity - 0.98) < 1e-9, "excused event no longer counts (I = 0.98)", sB2.integrity);

  // Points from scenario 1: A solved everything, so A leads the board.
  const board1 = h2.board;
  ok(h2.points?.[A]?.rank === 1 && h2.points[A].points > 0, "A ranked first on points", h2.points);
  ok(board1 && board1.top.length === 3 && !board1.top.some((r: any) => "reg" in r), "host board has 3 rows without register numbers", board1?.top);

  await gameScenario();

  console.log(failures ? `\n${failures} failure(s)` : "\nAll end-to-end checks passed");
  process.exit(failures ? 1 : 0);
}

/** Teacher questions, teams, gold rush chests and leaderboards. */
async function gameScenario() {
  console.log("\n— game scenario —");
  const custom = [
    {
      id: "arp",
      type: "mcq",
      title: "ARP request",
      prompt: "An ARP request is sent to which MAC address?",
      difficulty: "easy",
      unit: 2,
      options: [
        { text: "FF:FF:FF:FF:FF:FF", correct: true },
        { text: "Gateway MAC", correct: false },
        { text: "00:00:00:00:00:00", correct: false },
        { text: "01:00:5E:00:00:01", correct: false },
      ],
    },
    {
      id: "tx",
      type: "numeric",
      title: "Transmission delay",
      prompt: "A {L} byte frame on a {R} Mbps link. Transmission delay in µs?",
      difficulty: "medium",
      unit: 1,
      vars: [
        { name: "L", min: 500, max: 1500, step: 100 },
        { name: "R", min: 10, max: 100, step: 10 },
      ],
      formula: "L * 8 / R",
      tolerance: 0.5,
      unitLabel: "µs",
    },
    { id: "hs", type: "order", title: "Handshake", prompt: "Order the TCP handshake.", difficulty: "easy", unit: 5, steps: ["SYN", "SYN + ACK", "ACK"] },
    { id: "osi", type: "text", title: "OSI layer", prompt: "Which layer does routing?", difficulty: "easy", unit: 1, accepted: ["Network", "Layer 3"] },
  ];
  const bad = await call("/api/rooms", { title: "bad", topics: [], custom: [{ type: "mcq", prompt: "No options", options: [] }] });
  ok(bad.status === 400, "invalid teacher question rejected", bad.data);

  const create = await call("/api/rooms", {
    title: "Game check",
    topics: [],
    mix: { easy: 0, medium: 0, hard: 0 },
    durationMode: "1.5",
    lateMode: "flag",
    graceMin: 5,
    feedback: "binary",
    game: { mode: "gold", leaderboard: true, teams: 2 },
    custom,
  });
  ok(create.status === 200, "create custom-only gold room with 2 teams", create.data);
  const code: string = create.data.code;
  const host = { "x-host-key": create.data.hostKey };
  ok((await call(`/api/rooms/${code}`)).data.items === 4, "custom-only room has 4 questions");

  const regs = ["RA2311003010101", "RA2311003010102", "RA2311003010103", "RA2311003010104"];
  const tok: Record<string, string> = {};
  const teams: number[] = [];
  for (const [i, r] of regs.entries()) {
    const j = await call("/api/play/join", { code, regNo: r, name: `Player ${i + 1}` });
    tok[r] = j.data.token;
    teams.push(j.data.attempt.team);
  }
  ok(JSON.stringify(teams) === "[0,1,0,1]", "teams assigned round-robin", teams);
  const st = (r: string) => ({ "x-attempt-token": tok[r]! });
  const [P, Q] = regs as [string, string];

  const prof = await call("/api/play/profile", { code, regNo: P, avatar: 7 }, st(P));
  ok(prof.data.attempt?.avatar === 7, "avatar saved", prof.data);

  await call(`/api/rooms/${code}/host`, { action: "start" }, host);
  for (const r of regs) await call("/api/play/begin", { code, regNo: r }, st(r));

  const dP = (await call(`/api/rooms/${code}/host/attempt?reg=${P}`, undefined, host)).data;
  const dQ = (await call(`/api/rooms/${code}/host/attempt?reg=${Q}`, undefined, host)).data;
  const numP = dP.items.find((it: any) => it.params.q.id === "tx");
  const numQ = dQ.items.find((it: any) => it.params.q.id === "tx");
  ok(JSON.stringify(numP.params.vars) !== JSON.stringify(numQ.params.vars), "numeric question values differ per student", [numP.params.vars, numQ.params.vars]);
  const mcqP = dP.items.find((it: any) => it.params.q.id === "arp");
  const mcqQ = dQ.items.find((it: any) => it.params.q.id === "arp");
  ok(mcqP.params.order.join() !== mcqQ.params.order.join() || numP.params.order.join() !== numQ.params.order.join(), "option order differs per student");
  const pubP = (await call("/api/play/state", { code, regNo: P }, st(P))).data.attempt;
  ok(!JSON.stringify(pubP).includes("correct\":true") && !JSON.stringify(pubP).includes("formula"), "student payload hides answers and formula");

  const answer = (it: any) => {
    const q = it.params.q;
    if (q.type === "mcq") return { choice: `o${q.options.findIndex((o: any) => o.correct)}` };
    if (q.type === "numeric") return { value: String((it.params.vars.L * 8) / it.params.vars.R) };
    if (q.type === "order") return { order: q.steps.map((_: string, i: number) => `s${i}`) };
    return { text: " network " };
  };

  let totalPts = 0;
  let chestsOpened = 0;
  for (const it of dP.items) {
    await sleep(1250);
    const res = await call("/api/play/check", { code, regNo: P, itemIndex: it.index, checkpointId: "answer", response: answer(it) }, st(P));
    const v = res.data.verdict;
    ok(v?.status === "correct" && v.award?.points > 0, `custom ${it.params.q.type} correct with points`, res.data);
    if (!v?.chest) continue;
    if (chestsOpened === 0) {
      await sleep(1250);
      const blocked = await call("/api/play/check", { code, regNo: P, itemIndex: it.index, checkpointId: "answer", response: answer(it) }, st(P));
      ok(blocked.status === 409, "check blocked while a chest is pending");
      const stale = await call("/api/play/chest", { code, regNo: P, id: "nope", choice: 0 }, st(P));
      ok(stale.status === 409, "wrong chest id rejected");
    }
    const opened = await call("/api/play/chest", { code, regNo: P, id: v.chest.id, choice: 1 }, st(P));
    ok(opened.status === 200 && opened.data.result.outcomes.length === 3 && opened.data.result.chosen === 1, "chest opened", opened.data);
    totalPts = opened.data.result.total;
    chestsOpened++;
  }
  ok(chestsOpened === 4, "gold rush offers a chest after every verified step", chestsOpened);

  // Q gets one right
  const qi = dQ.items.find((it: any) => it.params.q.type === "text");
  await call("/api/play/check", { code, regNo: Q, itemIndex: qi.index, checkpointId: "answer", response: { text: "Layer 3" } }, st(Q));

  const bP = (await call("/api/play/board", { code, regNo: P }, st(P))).data;
  ok(bP.me?.points === totalPts && bP.top.length === 4 && bP.top.filter((r: any) => r.me).length === 1, "student board: own row, top list", bP);
  ok(bP.teams.length === 2 && bP.teams.every((t: any) => t.members === 2), "two teams of two on the board", bP.teams);
  ok(!JSON.stringify(bP).includes("RA23110030101"), "student board carries no register numbers");

  // Teacher moves a student, hides the board
  ok((await call(`/api/rooms/${code}/host`, { action: "team", reg: Q, team: 0 }, host)).status === 200, "teacher moves a student to another team");
  const bQ = (await call("/api/play/board", { code, regNo: Q }, st(Q))).data;
  ok(bQ.me?.team === 0 && bQ.teams.find((t: any) => t.index === 0)?.members === 3, "team change reflected", bQ.teams);
  await call(`/api/rooms/${code}/host`, { action: "leaderboard", visible: false }, host);
  const hidden = (await call("/api/play/board", { code, regNo: Q }, st(Q))).data;
  ok(hidden.hidden === true && hidden.top.length === 0 && hidden.me, "hidden board shows only own row", hidden);
  ok((await call(`/api/rooms/${code}/board`)).status === 403, "projector board needs host key when hidden");
  ok((await call(`/api/rooms/${code}/board`, undefined, host)).data.top?.length === 4, "projector board with host key");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

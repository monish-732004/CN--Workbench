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

  console.log(failures ? `\n${failures} failure(s)` : "\nAll end-to-end checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

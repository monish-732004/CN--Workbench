/* Visual smoke test: drives headless Edge through every screen and saves screenshots. Run: npx tsx scripts/shots.ts [baseUrl] [outDir] */
import { chromium, type Page } from "playwright-core";
import { mkdirSync } from "node:fs";
import { TOPICS } from "../src/engine/catalog";
import { perfectResponse } from "./perfect";

const BASE = process.argv[2] ?? "http://localhost:3100";
const OUT = process.argv[3] ?? "shots";
mkdirSync(OUT, { recursive: true });

async function call(path: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(BASE + path, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return (await res.json()) as any;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const NAMES = ["Asha Raman", "Bharath Kumar", "Charulatha S", "Dinesh Prabhu", "Esther Joseph", "Farhan Ali", "Gayathri N", "Harish V"];

async function shot(page: Page, name: string) {
  await sleep(450);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log("saved", name);
}

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const theme = process.env.THEME === "dark" ? "dark" : "light";
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  await page.goto(BASE + "/");
  await shot(page, `01-home-${theme}`);
  await page.goto(BASE + "/teacher/new");
  await shot(page, `02-new-room-${theme}`);

  const room = await call("/api/rooms", { title: "Unit 2–5 checkpoint", section: "K2", topics: TOPICS.map((t) => t.id), mix: { easy: 4, medium: 4, hard: 3 }, durationMode: "1.25", lateMode: "flag", graceMin: 10, feedback: "checkpoint" });
  const host = { "x-host-key": room.hostKey };
  await page.evaluate(([code, key]) => localStorage.setItem("cnwb:hostRooms", JSON.stringify([{ code, hostKey: key, title: "Unit 2–5 checkpoint", section: "K2", createdAt: Date.now() }])), [room.code, room.hostKey]);

  const toks: Record<string, string> = {};
  const regs: string[] = [];
  for (let i = 0; i < NAMES.length; i++) {
    const reg = `RA23110030100${String(10 + i * 7)}`;
    regs.push(reg);
    toks[reg] = (await call("/api/play/join", { code: room.code, regNo: reg, name: NAMES[i] })).token;
  }
  await page.goto(`${BASE}/teacher/room/${room.code}`);
  await shot(page, `03-room-waiting-${theme}`);
  await page.goto(`${BASE}/teacher/room/${room.code}/present`);
  await shot(page, `04-present`);

  await call(`/api/rooms/${room.code}/host`, { action: "start" }, host);
  // Simulate class activity
  for (let i = 1; i < regs.length; i++) {
    const reg = regs[i]!;
    const h = { "x-attempt-token": toks[reg]! };
    await call("/api/play/begin", { code: room.code, regNo: reg }, h);
    const det = await call(`/api/rooms/${room.code}/host/attempt?reg=${reg}`, undefined, host);
    const take = 2 + (i % 5);
    for (const it of det.items.slice(0, take)) {
      for (const cp of it.checkpoints) {
        const good = (i + it.index) % 4 !== 0;
        await call(
          "/api/play/check",
          { code: room.code, regNo: reg, itemIndex: it.index, checkpointId: cp.id, response: good ? perfectResponse(it.templateId, it.params, it.solution, cp.id) : {}, stats: { [it.index]: { moves: it.optimalMoves + i * 2, activeMs: it.expectedSec * (500 + i * 120) } } },
          h,
        );
        await sleep(1250);
      }
    }
    if (i % 3 === 0) await call("/api/play/events", { code: room.code, regNo: reg, events: [{ type: "tab_hidden", at: Date.now() - 20000, durationMs: 14000 }, { type: "fullscreen_exit", at: Date.now() - 9000, durationMs: 6000 }] }, h);
    if (i === 5) await call("/api/play/events", { code: room.code, regNo: reg, events: [{ type: "devtools_suspected", at: Date.now() }] }, h);
    if (i % 4 === 0) await call("/api/play/submit", { code: room.code, regNo: reg, finish: true }, h);
    else await call("/api/play/sync", { code: room.code, regNo: reg, fullscreen: i !== 2, visible: true }, h);
  }

  await page.goto(`${BASE}/teacher/room/${room.code}`);
  await sleep(1500);
  await shot(page, `05-room-live-${theme}`);
  await page.getByRole("radio", { name: "Results and export" }).click();
  await shot(page, `06-results-${theme}`);
  await page.locator("tbody tr").first().click();
  await shot(page, `07-results-drawer-${theme}`);

  // Student view, first student
  const s0 = regs[0]!;
  const sctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
  await sctx.addInitScript(
    ([code, reg, token]) => {
      localStorage.setItem(`cnwb:session:${code}`, JSON.stringify({ regNo: reg, name: "Asha Raman", token }));
    },
    [room.code, s0, toks[s0]!],
  );
  const sp = await sctx.newPage();
  await sp.goto(`${BASE}/play/${room.code}`);
  await shot(sp, `08-lobby-${theme}`);
  await sp.getByRole("checkbox").click();
  await sp.getByRole("button", { name: /begin/i }).click();
  await sleep(1500);
  const n = 11;
  for (let i = 0; i < n; i++) {
    await sp.locator('nav[aria-label="Questions"] button').nth(i).click();
    await sleep(350);
    const title = (await sp.locator('nav[aria-label="Questions"] button').nth(i).innerText()).split("\n").join(" ").replace(/[^a-z0-9]+/gi, "-").slice(0, 40);
    await shot(sp, `10-q${String(i + 1).padStart(2, "0")}-${title}-${theme}`);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

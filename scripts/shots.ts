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

const ARP = { id: "arp", type: "mcq", title: "ARP request", prompt: "An ARP request frame is sent to which destination MAC address?", difficulty: "easy", unit: 2, options: [{ text: "FF:FF:FF:FF:FF:FF", correct: true }, { text: "The MAC address of the default gateway", correct: false }, { text: "00:00:00:00:00:00", correct: false }, { text: "01:00:5E:00:00:01", correct: false }] };
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

  const room = await call("/api/rooms", { title: "Unit 2–5 checkpoint", section: "K2", topics: TOPICS.map((t) => t.id), mix: { easy: 4, medium: 4, hard: 3 }, durationMode: "1.25", lateMode: "flag", graceMin: 10, feedback: "checkpoint", game: { mode: "classic", leaderboard: true, teams: 3 }, custom: [ARP] });
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
  await page.keyboard.press("Escape");
  await page.goto(`${BASE}/teacher/room/${room.code}`);
  await sleep(1200);
  await page.getByRole("radio", { name: "Game and teams" }).click();
  await shot(page, `07b-game-tab-${theme}`);
  await page.goto(`${BASE}/teacher/room/${room.code}/present`);
  await sleep(1500);
  await shot(page, `04b-present-board`);

  // Question builder
  await page.goto(BASE + "/teacher/new");
  await page.evaluate(() => localStorage.removeItem("cnwb:qlib"));
  await page.reload();
  await page.getByRole("button", { name: "Load two examples" }).click();
  await page.getByRole("heading", { name: "Your own questions" }).scrollIntoViewIfNeeded();
  await shot(page, `02b-builder-${theme}`);
  await page.getByRole("button", { name: "Edit" }).first().click();
  await shot(page, `02c-builder-editor-${theme}`);
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("heading", { name: "Game" }).scrollIntoViewIfNeeded();
  await page.getByRole("switch", { name: "Team mode" }).click();
  await shot(page, `02d-game-settings-${theme}`);

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
  await sp.getByRole("button", { name: "Avatar 5" }).click();
  await sp.getByRole("checkbox").click();
  await shot(sp, `08b-lobby-avatar-${theme}`);
  await sp.getByRole("button", { name: /begin/i }).click();
  await sleep(1500);
  // First-run tour
  await shot(sp, `09a-tour-1-${theme}`);
  for (let k = 0; k < 3; k++) await sp.getByRole("dialog", { name: "Interface tour" }).getByRole("button", { name: "Next" }).click();
  await shot(sp, `09b-tour-4-${theme}`);
  for (let k = 0; k < 3; k++) await sp.getByRole("dialog", { name: "Interface tour" }).getByRole("button", { name: "Next" }).click();
  await shot(sp, `09c-tour-last-${theme}`);
  await sp.getByRole("button", { name: "Start answering" }).click();

  // Answer the teacher's MCQ through the UI to see the points popup
  const nav = sp.locator('nav[aria-label="Questions"] button');
  const n = await nav.count();
  for (let i = 0; i < n; i++) {
    if ((await nav.nth(i).innerText()).includes("ARP request")) {
      await nav.nth(i).click();
      await sleep(300);
      await sp.getByRole("button", { name: /FF:FF:FF:FF:FF:FF/ }).click();
      await sp.getByRole("button", { name: "Check", exact: true }).click();
      await sleep(250);
      await sp.screenshot({ path: `${OUT}/09d-score-burst-${theme}.png` });
      console.log("saved 09d-score-burst");
      await sleep(2500);
      await shot(sp, `09e-after-points-${theme}`);
      break;
    }
  }
  await sp.locator('[data-tour="points"]').click();
  await sleep(600);
  await shot(sp, `09f-leaderboard-drawer-${theme}`);
  await sp.getByRole("button", { name: "Close" }).click();
  await sleep(300);

  for (let i = 0; i < n; i++) {
    await sp.locator('nav[aria-label="Questions"] button').nth(i).click();
    await sleep(350);
    const title = (await sp.locator('nav[aria-label="Questions"] button').nth(i).innerText()).split("\n").join(" ").replace(/[^a-z0-9]+/gi, "-").slice(0, 40);
    await shot(sp, `10-q${String(i + 1).padStart(2, "0")}-${title}-${theme}`);
  }
  // Guide off, then finish and see the summary
  await sp.locator('[data-tour="guide"]').click();
  await shot(sp, `11-guide-off-${theme}`);
  await sp.getByRole("button", { name: "Finish attempt" }).click();
  await sp.getByRole("button", { name: "Finish and submit" }).click();
  await sleep(2500);
  await shot(sp, `12-summary-${theme}`);

  // Gold rush chest
  const gold = await call("/api/rooms", { title: "Gold rush", topics: [], mix: { easy: 0, medium: 0, hard: 0 }, durationMode: "1.5", lateMode: "flag", graceMin: 5, feedback: "binary", game: { mode: "gold", leaderboard: true, teams: 0 }, custom: [ARP] });
  await call(`/api/rooms/${gold.code}/host`, { action: "start" }, { "x-host-key": gold.hostKey });
  const gj = await call("/api/play/join", { code: gold.code, regNo: "RA2311003010999", name: "Asha Raman" });
  const gctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
  await gctx.addInitScript(
    ([code, token]) => {
      localStorage.setItem(`cnwb:session:${code}`, JSON.stringify({ regNo: "RA2311003010999", name: "Asha Raman", token }));
      localStorage.setItem("cnwb:toured", "true");
    },
    [gold.code, gj.token],
  );
  const gp = await gctx.newPage();
  await gp.goto(`${BASE}/play/${gold.code}`);
  await gp.getByRole("checkbox").click();
  await gp.getByRole("button", { name: /begin/i }).click();
  await sleep(1200);
  await gp.getByRole("button", { name: /FF:FF:FF:FF:FF:FF/ }).click();
  await gp.getByRole("button", { name: "Check", exact: true }).click();
  await sleep(1800);
  await shot(gp, `13a-chest-pick-${theme}`);
  await gp.getByRole("button", { name: /Chest 2/ }).click();
  await sleep(1200);
  await shot(gp, `13b-chest-result-${theme}`);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

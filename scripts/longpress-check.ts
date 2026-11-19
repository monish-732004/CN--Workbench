import { chromium } from "playwright-core";
const BASE = process.argv[2] ?? "http://localhost:3100";
const OUT = process.argv[3] ?? ".";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (let i = 0; i < 40; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await sleep(500); }
  const b = await chromium.launch({ channel: "msedge", headless: true });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto(BASE + "/");
  const text = await p.locator("body").innerText();
  console.log("home mentions teacher console:", /teacher console|open console/i.test(text));
  const logo = p.getByRole("link", { name: /CN Workbench/ }).first();
  const box = (await logo.boundingBox())!;
  // short click: stays on /
  await logo.click(); await sleep(600);
  console.log("after short click:", new URL(p.url()).pathname);
  // long press with mouse
  await p.mouse.move(box.x + 10, box.y + box.height / 2);
  await p.mouse.down(); await sleep(450);
  await p.screenshot({ path: `${OUT}/longpress-mid.png`, clip: { x: 0, y: 0, width: 400, height: 50 } });
  await sleep(700); await p.mouse.up(); await sleep(1200);
  console.log("after long press:", new URL(p.url()).pathname);
  // keyboard hold on home page
  await p.goto(BASE + "/"); await logo.focus();
  await p.keyboard.down("Enter"); await sleep(1200); await p.keyboard.up("Enter"); await sleep(1000);
  console.log("after Enter hold:", new URL(p.url()).pathname);
  await p.goto(BASE + "/"); await logo.focus();
  await p.keyboard.down("Enter"); await sleep(150); await p.keyboard.up("Enter"); await sleep(800);
  console.log("after Enter tap:", new URL(p.url()).pathname);
  await p.goto(BASE + "/"); await sleep(400);
  await p.screenshot({ path: `${OUT}/home-after.png` });
  await b.close();
})();

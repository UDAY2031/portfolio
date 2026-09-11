// Headless verification of the whole six-phase loop against the static export.
//
//   pnpm build
//   (cd out && python3 -m http.server 4173 --bind 127.0.0.1 &)
//   pnpm add -D playwright-core   # once; uses the system Chrome, no browser download
//   node scripts/verify.mjs       # BASE=http://host:port to point elsewhere
//
// Runs Chrome with SwiftShader (software WebGL, ~1–3 fps), so wall-clock
// budgets are generous: the simulation's per-frame delta is capped at 0.1 s,
// which makes drift and dwell run ~10× slower than on a real GPU. Timers
// (intro lines, captions) stretch about 2×. Checks: intro → void with no
// chrome, T → threshold caption → archive, HUD hidden / H toggle, deep links
// (room / reveal / freeze / quality), thread hover → assemble → release,
// zero-code milestone drop-in (temporary JSON, cleaned up), WebGL context
// loss recovery, beginReturn → closing lines → void, end-of-path dwell →
// return, and zero console errors.
import { chromium } from "playwright-core";
import fs from "node:fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const results = [];
const errors = [];
const ok = (name, pass, note = "") => { results.push({ name, pass, note }); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${note ? "  — " + note : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required", "--no-sandbox"],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.addInitScript(() => {
  window.__captions = [];
  const mo = new MutationObserver(() => {
    for (const el of document.querySelectorAll(".caption")) {
      const t = el.textContent || "";
      if (t && !window.__captions.includes(t)) window.__captions.push(t);
    }
  });
  addEventListener("DOMContentLoaded", () => mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true }));
});
const captions = () => page.evaluate(() => window.__captions || []);
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console.error: " + m.text()); });

const phase = () => page.evaluate(() => window.__journey?.getPhase());
const waitPhase = async (p, ms) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if ((await phase()) === p) return true; await sleep(400); }
  return false;
};

// ── 1. cold start: intro → void, no chrome ──────────────────────────────────
await page.goto(BASE + "/", { waitUntil: "load" });
await page.waitForFunction(() => !!window.__journey, null, { timeout: 30000 });
ok("boot: journey hook present", true);
ok("intro: phase starts at intro", (await phase()) === "intro", await phase());
const tIntro = Date.now(); const gotVoid = await waitPhase("void", 45000);
ok("intro → void automatically", gotVoid, `${Date.now() - tIntro}ms wall (7.6s nominal; software renderer stretches timers)`);
ok("no ENTER button / no visible nav chrome", (await page.locator("button").filter({ hasText: /enter/i }).count()) === 0 && (await page.locator(".hud").count()) === 0);
ok("corner sound glyph present", (await page.locator(".corner-sound").count()) === 1);
ok("canvas present", (await page.locator("canvas").count()) === 1);

// ── 2. threshold (T key) → archive ─────────────────────────────────────────
await page.keyboard.press("t");
ok("T triggers threshold from void", await waitPhase("threshold", 3000));
ok("threshold → archive automatically", await waitPhase("archive", 40000));
const thrCaps = await captions();
ok("threshold caption: the one line with the name, and only that line", thrCaps.length === 1 && /archive of Uday Kumar G begins\./.test(thrCaps[0]), JSON.stringify(thrCaps));
await sleep(3000);
const count = await page.evaluate(() => window.__journey.getReveal().length);
ok("archive: 10 milestone rooms configured", count === 10, `rooms=${count}`);
ok("archive: no HUD by default", (await page.locator(".hud").count()) === 0);
await page.keyboard.press("h");
await sleep(500);
ok("H reveals developer HUD with 10 room jumps + RETURN", (await page.locator(".hud").count()) === 1 && (await page.locator(".hud-nav__item").count()) === 11);
await page.keyboard.press("h");

// ── 3. deep link: parked, revealed, frozen ─────────────────────────────────
await page.goto(BASE + "/?phase=archive&room=07-products&reveal=1&freeze=1&quality=low", { waitUntil: "load" });
await page.waitForFunction(() => window.__journey?.getPhase() === "archive", null, { timeout: 30000 });
await sleep(5000);
const room = await page.evaluate(() => window.__journey.getRoom());
const rev = await page.evaluate(() => window.__journey.getReveal());
ok("deep link parks at room 07-products", room === 6, `room=${room}`);
ok("deep link reveal=1 → memory fully assembled", rev[6] === 1, `reveal=${rev[6]}`);
const rvs = await page.evaluate(() => [...document.querySelectorAll(".rv")].map((e) => ({ shown: e.style.display !== "none" && e.style.opacity === "1", text: e.textContent || "" })));
const shown = rvs.filter((r) => r.shown);
ok("exactly one memory plane open; it carries the Products memory (AURIZE, 23K+ counted up, links)", shown.length === 1 && /AURIZE/.test(shown[0].text) && /23K\+/.test(shown[0].text) && /GITHUB/.test(shown[0].text), `open=${shown.length}/${rvs.length}`);
const order = await page.evaluate(() => [...document.querySelectorAll(".rv")].filter((e) => e.style.display !== "none").flatMap((e) => [...e.querySelectorAll(".rv__stage")].map((st) => st.className.replace("rv__stage rv__stage--", ""))));
ok("reveal stages in spec order: title → desc → ach → metrics → tech → links", order.join(",") === "title,desc,ach,metrics,tech,links", order.join(","));
ok("reveal DOM carries links stage", (await page.locator(".rv a, a[href*='github'], a[href*='play.google']").count()) > 0);

// ── 4. thread interaction via pointer (hover → engage → reveal) ────────────
await page.goto(BASE + "/?phase=archive&room=01-beginning&freeze=1&quality=low", { waitUntil: "load" });
await page.waitForFunction(() => window.__journey?.getPhase() === "archive", null, { timeout: 30000 });
await sleep(4000);
let engaged = false;
const cols = [640, 520, 760, 400, 880, 300, 980, 200, 1080];
const rows = [400, 300, 500];
outer: for (const y of rows) for (const x of cols) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 0; i < 12; i++) {
    await sleep(700);
    const r = await page.evaluate(() => window.__journey.getReveal()[0]);
    if (r > 0.02) { engaged = true; break outer; }
  }
  await page.mouse.up();
}
ok("pointer on a thread engages it and the memory starts assembling", engaged);
if (engaged) {
  // hold on and wait for the assembly to complete
  const t1 = Date.now(); let full = 0;
  while (Date.now() - t1 < 40000) { full = await page.evaluate(() => window.__journey.getReveal()[0]); if (full >= 1) break; await sleep(500); }
  ok("held thread → memory assembles to 1.0", full >= 1, `reveal=${full.toFixed(2)}`);
  await page.mouse.up();
  await page.mouse.move(5, 5);
  await sleep(500);
  await page.mouse.move(1270, 790);
  const t2 = Date.now(); let back = 1;
  while (Date.now() - t2 < 40000) { back = await page.evaluate(() => window.__journey.getReveal()[0]); if (back <= 0) break; await sleep(500); }
  ok("released thread → memory reverses to 0", back <= 0, `reveal=${back.toFixed(2)}`);
}

// ── 5. zero-code milestone drop-in ─────────────────────────────────────────
const tmpJson = `${ROOT}/resources/milestones/11-verification-node.json`;
fs.writeFileSync(tmpJson, JSON.stringify({
  id: "11-verification-node", order: 11, title: "Verification Node Zeta",
  description: "A temporary room materialised by the headless verification.", dateRange: "now",
  metrics: [{ label: "CHECKS", value: "1" }], techStack: ["Playwright"], sources: ["verify.mjs"],
}, null, 2));
try {
  execSync("node scripts/build-resources.mjs", { cwd: ROOT, stdio: "pipe" });
  fs.copyFileSync(`${ROOT}/public/resources/manifest.json`, `${ROOT}/out/resources/manifest.json`);
  await page.goto(BASE + "/?phase=archive&room=11-verification-node&reveal=1&freeze=1&quality=low", { waitUntil: "load" });
  await page.waitForFunction(() => window.__journey?.getPhase() === "archive", null, { timeout: 30000 });
  await sleep(5000);
  const n = await page.evaluate(() => window.__journey.getReveal().length);
  const r = await page.evaluate(() => window.__journey.getRoom());
  const txt = await page.evaluate(() => document.body.innerText);
  ok("drop-in JSON → 11 rooms, parked at the new one, title rendered", n === 11 && r === 10 && /Verification Node Zeta/.test(txt), `rooms=${n} room=${r}`);
} finally {
  fs.unlinkSync(tmpJson);
  execSync("node scripts/build-resources.mjs", { cwd: ROOT, stdio: "pipe" });
  fs.copyFileSync(`${ROOT}/public/resources/manifest.json`, `${ROOT}/out/resources/manifest.json`);
}
const restored = JSON.parse(fs.readFileSync(`${ROOT}/out/resources/manifest.json`, "utf8")).milestones.length;
ok("manifest restored to 10 rooms after test", restored === 10, `rooms=${restored}`);

// ── 6. WebGL context loss → resumes in place ───────────────────────────────
await page.goto(BASE + "/?phase=archive&room=05-research&quality=low", { waitUntil: "load" });
await page.waitForFunction(() => window.__journey?.getPhase() === "archive", null, { timeout: 30000 });
await sleep(3000);
const before = await page.evaluate(() => window.__journey.getRoom());
const lost = await page.evaluate(() => window.__loseContext?.());
await sleep(4000);
const after = await page.evaluate(() => ({ p: window.__journey.getPhase(), r: window.__journey.getRoom() }));
ok("context loss → restored, same phase and room", lost === true && after.p === "archive" && after.r === before, `${before}→${after.r}`);

// ── 7. the return → space → closing lines → void (loop) ────────────────────
await page.goto(BASE + "/?phase=archive&room=10-future&quality=low", { waitUntil: "load" });
await page.waitForFunction(() => window.__journey?.getPhase() === "archive", null, { timeout: 30000 });
await sleep(3000);
await page.evaluate(() => window.__journey.beginReturn());
ok("beginReturn → phase return (archive dissolves, veil closes)", await waitPhase("return", 15000));
ok("return → void: the loop closes", await waitPhase("void", 45000));
const retCaps = await captions();
ok("closing line 1 shown", retCaps.some((c) => /None of this has happened yet\./.test(c)), JSON.stringify(retCaps));
ok("closing line 2 shown", retCaps.some((c) => /It's still being built\./.test(c)));
ok("only the two closing lines were shown", retCaps.length === 2);
ok("canvas still alive after loop", (await page.locator("canvas").count()) === 1);

// ── 8. quality tiers render every phase without errors ─────────────────────
for (const q of ["high", "low"]) for (const p of ["void", "crossing", "archive"]) {
  await page.goto(`${BASE}/?phase=${p}&quality=${q}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__journey, null, { timeout: 30000 });
  await sleep(2500);
}
ok("high & low tiers load void / crossing / archive", true);

// ── 9. dwell at the end of the path triggers the return by itself ──────────
await page.goto(BASE + "/?phase=archive&room=10-future&quality=low", { waitUntil: "load" });
await page.waitForFunction(() => window.__journey?.getPhase() === "archive", null, { timeout: 30000 });
await sleep(2000);
await page.evaluate(() => window.__journey.setU(0.992));
const tEnd = Date.now();
const autoReturn = await waitPhase("return", 180000);
ok("lingering at the end of the path → the return begins on its own", autoReturn, `${Math.round((Date.now() - tEnd) / 1000)}s wall`);

// ── 10. console cleanliness ────────────────────────────────────────────────
const real = errors.filter((e) => !/favicon|ERR_ABORTED|net::ERR_FAILED/i.test(e));
ok("zero unhandled page/console errors", real.length === 0, real.slice(0, 5).join(" | "));

await browser.close();
const fails = results.filter((r) => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} checks passed`);
process.exit(fails.length ? 1 : 0);

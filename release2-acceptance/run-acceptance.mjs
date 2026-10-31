// HAIROS Release 2 — local Doctor acceptance driver (Windows/macOS/Linux).
//
// Selector-independent: YOU log in and click; this kit captures the evidence.
// - Launches a headed Chromium at the staging preview.
// - Adds a floating "HAIROS capture" toolbar to every page so you snapshot each
//   step on demand (full-page PNG).
// - Auto-snaps on every navigation so nothing is missed.
// - Logs every API call as {time, method, status, path} to api-results.jsonl.
//   NO request/response bodies, NO headers, NO cookies, NO query strings are
//   written — so no passwords, OTPs, tokens or secrets are ever stored.
//
// Run (see README.md for one-time setup):
//   # Doctor A journey (gate 2):
//   node run-acceptance.mjs --out evidence-doctorA
//   # Doctor B isolation, fresh login (gate 3):
//   node run-acceptance.mjs --out evidence-doctorB
//
// Optional: BASE_URL env overrides the preview URL.

import { chromium } from "playwright";
import { mkdirSync, appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_BASE =
  "https://hairos-git-claude-phase1-notes-18d307-diveshs-projects-6230f270.vercel.app";
const BASE = (process.env.BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const OUT = outIdx >= 0 ? args[outIdx + 1] : `evidence-${Date.now()}`;
const SHOTS = join(OUT, "screenshots");
const API_LOG = join(OUT, "api-results.jsonl");
mkdirSync(SHOTS, { recursive: true });
writeFileSync(API_LOG, "");

let n = 0;
const stamp = () => String(++n).padStart(2, "0");
const safe = (s) => (s || "step").replace(/[^a-z0-9_-]+/gi, "-").slice(0, 60);

async function snap(page, label) {
  const file = join(SHOTS, `${stamp()}-${safe(label)}.png`);
  try {
    await page.screenshot({ path: file, fullPage: true });
    console.log(`  [captured] ${file}`);
  } catch (e) {
    console.log(`  [capture failed] ${label}: ${e.message}`);
  }
}

const TOOLBAR = `
(() => {
  if (window.__hairosBar) return;
  window.__hairosBar = true;
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;z-index:2147483647;right:12px;bottom:12px;'
    + 'background:#0f172a;color:#fff;font:600 13px system-ui;padding:8px 10px;'
    + 'border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.35);display:flex;gap:8px;align-items:center';
  const btn = document.createElement('button');
  btn.textContent = 'HAIROS capture';
  btn.style.cssText = 'background:#22c55e;color:#06210f;border:0;border-radius:8px;'
    + 'padding:6px 10px;font:700 13px system-ui;cursor:pointer';
  btn.onclick = async () => {
    const label = prompt('Label this step (e.g. note-saved, 2-kits-selected, refund):', '');
    if (label === null) return;
    await window.__hairosSnap(label);
  };
  const tag = document.createElement('span');
  tag.textContent = 'R2 acceptance';
  bar.appendChild(tag); bar.appendChild(btn);
  document.documentElement.appendChild(bar);
})();`;

const run = async () => {
  console.log(`\nHAIROS Release 2 acceptance`);
  console.log(`  base : ${BASE}`);
  console.log(`  out  : ${OUT}\n`);
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  await context.exposeBinding("__hairosSnap", async ({ page }, label) => {
    await snap(page, label);
  });
  await context.addInitScript(TOOLBAR);

  // API evidence: path + status only (no bodies/headers/cookies/query).
  page.on("response", (res) => {
    try {
      const u = new URL(res.url());
      if (!u.pathname.startsWith("/api/")) return;
      appendFileSync(
        API_LOG,
        JSON.stringify({
          t: new Date().toISOString(),
          method: res.request().method(),
          status: res.status(),
          path: u.pathname,
        }) + "\n",
      );
    } catch {}
  });

  // Auto-snap each navigation so no step is lost.
  page.on("load", () => snap(page, "nav-" + safe(new URL(page.url()).pathname)));

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" }).catch(() => {});
  console.log("STEPS:");
  console.log("  1. Log in privately in the browser window (no creds here).");
  console.log("  2. Do the journey; click 'HAIROS capture' at each checkpoint.");
  console.log("  3. Close the browser window when done — evidence is saved.\n");

  await page.waitForEvent("close", { timeout: 0 }).catch(() => {});
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
  console.log(`\nDone. Screenshots in ${SHOTS}, API log at ${API_LOG}\n`);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

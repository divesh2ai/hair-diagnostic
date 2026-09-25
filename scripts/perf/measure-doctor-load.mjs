// Dummy timing harness for the Doctor Dashboard + assessment-result open.
//
// The cloud session's egress policy blocks the Vercel preview host, so this
// could not be run from there. Run it locally (or anywhere the preview is
// reachable). It logs into the doctor surface, opens the dashboard, clicks the
// front deck card, and records the timings that matter:
//
//   • dashboard TTFB + DOMContentLoaded + first deck card painted
//   • /api/doctor/stats response time (the 15s poll transport)
//   • time from clicking "Review" to the assessment result being painted
//   • the review page's own /api/consultation/[id] (or SSR) timing
//
// Usage:
//   npm i -D playwright   # if not already present
//   BASE_URL="https://<preview>.vercel.app" \
//   DOCTOR_PHONE="98xxxxxxxx" OTP="123456" \
//   node scripts/perf/measure-doctor-load.mjs
//
// If the preview is behind Vercel deployment protection, set VERCEL_BYPASS to a
// protection-bypass token and it is appended as ?x-vercel-protection-bypass=.

import { chromium } from "playwright";

const BASE = process.env.BASE_URL?.replace(/\/$/, "");
if (!BASE) throw new Error("Set BASE_URL to the preview origin.");
const BYPASS = process.env.VERCEL_BYPASS
  ? `?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=${process.env.VERCEL_BYPASS}`
  : "";

const RUNS = Number(process.env.RUNS ?? 3);

function pctl(xs, p) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

const results = { dashboard: [], statsApi: [], reviewOpen: [], reviewApi: [] };

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

// Record the two API calls we care about, per navigation.
let statsMs = 0;
let reviewApiMs = 0;
page.on("requestfinished", async (req) => {
  const url = req.url();
  const t = req.timing();
  const dur = t.responseEnd - t.requestStart;
  if (url.includes("/api/doctor/stats")) statsMs = dur;
  if (/\/api\/consultation\/[^/]+($|\?)/.test(url)) reviewApiMs = dur;
});

// --- one-time login (mobile OTP). Adjust selectors to the real login form. ---
await page.goto(`${BASE}/login${BYPASS}`, { waitUntil: "domcontentloaded" });
if (process.env.DOCTOR_PHONE) {
  await page.fill('input[type="tel"], input[name="phone"]', process.env.DOCTOR_PHONE);
  await page.getByRole("button", { name: /otp|continue|send/i }).click();
  await page.fill('input[name="otp"], input[autocomplete="one-time-code"]', process.env.OTP ?? "");
  await page.getByRole("button", { name: /verify|login|continue/i }).click();
  await page.waitForURL(/\/doctor/, { timeout: 30_000 }).catch(() => {});
}

for (let i = 0; i < RUNS; i++) {
  statsMs = 0;
  reviewApiMs = 0;

  const t0 = Date.now();
  await page.goto(`${BASE}/doctor${BYPASS}`, { waitUntil: "domcontentloaded" });
  // First deck card visible == the dashboard is usable.
  await page
    .locator('[aria-label="Patient deck"] a, [aria-label*="Review"]')
    .first()
    .waitFor({ state: "visible", timeout: 30_000 })
    .catch(() => {});
  results.dashboard.push(Date.now() - t0);
  if (statsMs) results.statsApi.push(Math.round(statsMs));

  // Click the front card's Review CTA and time until the review has painted.
  const cta = page.locator('[aria-label^="Review"], a:has-text("Review")').first();
  if (await cta.count()) {
    const t1 = Date.now();
    await cta.click();
    await page.waitForURL(/\/doctor\/reports\//, { timeout: 30_000 }).catch(() => {});
    // ReviewHeader / Clinical summary painted == result is on screen.
    await page
      .getByRole("heading", { name: /clinical|attention|treatment|summary/i })
      .first()
      .waitFor({ state: "visible", timeout: 30_000 })
      .catch(() => {});
    results.reviewOpen.push(Date.now() - t1);
    if (reviewApiMs) results.reviewApi.push(Math.round(reviewApiMs));
  }
}

await browser.close();

const row = (name, xs) =>
  xs.length
    ? `${name.padEnd(22)} n=${xs.length}  p50=${pctl(xs, 50)}ms  p95=${pctl(xs, 95)}ms  max=${Math.max(...xs)}ms`
    : `${name.padEnd(22)} (no samples)`;

console.log("\n── Doctor load timings ──────────────────────────────");
console.log(row("Dashboard usable", results.dashboard));
console.log(row("/api/doctor/stats", results.statsApi));
console.log(row("Review open (click→paint)", results.reviewOpen));
console.log(row("/api/consultation SSR/API", results.reviewApi));
console.log("─────────────────────────────────────────────────────\n");

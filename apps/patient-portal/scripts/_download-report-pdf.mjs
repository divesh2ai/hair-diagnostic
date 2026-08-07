// Log in via dev button, then fetch the PDF and write to disk. Avoids
// leaking session tokens through shell args or intermediate files.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const origin = process.argv[2] || "http://localhost:4000";
const assessmentId = process.argv[3];
const outPath = process.argv[4];
if (!assessmentId || !outPath) { console.error("usage: node script <origin> <assessmentId> <out.pdf>"); process.exit(2); }

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${origin}/login`, { waitUntil: "load", timeout: 30_000 });
  const devButton = page.getByRole("button", { name: /Dev sign-in/i });
  if (await devButton.count() === 0) throw new Error("Dev sign-in button not present — dev auth not enabled in this env");
  await Promise.all([
    page.waitForURL(u => !/\/login/.test(u.pathname), { timeout: 30_000 }).catch(() => null),
    devButton.first().click(),
  ]);
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => null);
  // Warm the report page first so the loader authenticates properly
  const viewRes = await page.goto(`${origin}/reports/${assessmentId}/one-page`, { waitUntil: "load", timeout: 60_000 });
  if (!viewRes || !viewRes.ok()) console.error("viewer status:", viewRes?.status());
  // Fetch the PDF via the authenticated session
  const t0 = Date.now();
  const res = await page.request.get(`${origin}/api/reports/${assessmentId}/one-page/pdf`, { timeout: 120_000 });
  const buf = await res.body();
  writeFileSync(outPath, buf);
  console.log(JSON.stringify({ status: res.status(), sizeKB: (buf.length/1024)|0, cd: res.headers()["content-disposition"], ms: Date.now() - t0 }));
} finally {
  await browser.close();
}

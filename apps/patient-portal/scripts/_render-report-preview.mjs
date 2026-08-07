// Render the one-pager HTML directly with the given auth cookie and
// screenshot the .op-page element at A4 aspect for visual QA.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const cookie = process.env.SB_COOKIE;
const url = process.argv[2];
const out = process.argv[3];
if (!cookie || !url || !out) { console.error("usage: SB_COOKIE=... node script <url> <out.png>"); process.exit(2); }

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 830, height: 1180 },
    deviceScaleFactor: 1.6,
    extraHTTPHeaders: { cookie },
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "load", timeout: 60_000 });
  await page.waitForSelector("[data-one-page-report]", { timeout: 20_000 });
  await page.evaluate(async () => {
    await document.fonts?.ready;
    await Promise.all(Array.from(document.images).map(img => img.decode?.().catch(() => undefined) ?? Promise.resolve()));
    // Hide floating toolbar so it doesn't obscure the design.
    document.querySelectorAll(".op-actions-toolbar").forEach(el => el.remove());
  });
  const el = await page.locator("[data-one-page-report]");
  const buf = await el.screenshot({ type: "png" });
  writeFileSync(out, buf);
  console.log(JSON.stringify({ status: "ok", bytes: buf.length, out }));
} finally {
  await browser.close();
}

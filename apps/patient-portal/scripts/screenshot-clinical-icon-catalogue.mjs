#!/usr/bin/env node
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const outPath = resolve(
  process.argv[2] ?? "outputs/one-page-report/clinical-icon-catalogue.png",
);
const baseUrl = process.env.BASE_URL ?? "http://localhost:4000";

await mkdir(dirname(outPath), { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 1,
  });
  await page.goto(`${baseUrl}/dev/clinical-icon-catalogue`, {
    waitUntil: "load",
    timeout: 60_000,
  });
  await page.waitForSelector("main", { timeout: 30_000 });
  await page.evaluate(async () => {
    await document.fonts?.ready;
    await Promise.all(
      Array.from(document.images).map((image) => image.decode?.().catch(() => undefined)),
    );
  });
  await page.screenshot({ path: outPath, type: "png", fullPage: true });
  console.log(`[screenshot] wrote ${outPath}`);
} finally {
  await browser.close();
}

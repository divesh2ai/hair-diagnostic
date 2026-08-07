#!/usr/bin/env node
/**
 * Turn A screenshot script.
 * Loads the running dev server's /dev/report-fixture/<caseId>, waits for
 * fonts + images to settle, and writes a PNG at the A4 viewport used by
 * the real PDF renderer (1123x794 @ 96dpi).
 *
 * Usage: node scripts/screenshot-report-fixture.mjs ruchi [outPath]
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const caseId = process.argv[2] ?? "ruchi";
const defaultOut = resolve(
  process.env.SCRATCHPAD ??
    "C:/Users/ERA/AppData/Local/Temp/claude/D--Dr-Fact-Folder-RAG-Chatbot/7e47f025-7360-43c2-88fd-387caa4590b5/scratchpad",
  `report-fixture-${caseId}.png`,
);
const outPath = process.argv[3] ? resolve(process.argv[3]) : defaultOut;
const baseUrl = process.env.BASE_URL ?? "http://localhost:4000";

await mkdir(dirname(outPath), { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1123, height: 794 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const url = `${baseUrl}/dev/report-fixture/${caseId}`;
  console.log(`[screenshot] navigating to ${url}`);
  await page.goto(url, { waitUntil: "load", timeout: 60_000 });
  await page.waitForSelector("[data-one-page-report]", { timeout: 30_000 });
  await page.evaluate(async () => {
    await document.fonts?.ready;
    await Promise.all(
      Array.from(document.images).map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return img.decode?.().catch(() => undefined) ?? Promise.resolve();
      }),
    );
  });
  const root = page.locator("[data-one-page-report]");
  await root.screenshot({ path: outPath, type: "png" });
  console.log(`[screenshot] wrote ${outPath}`);
} finally {
  await browser.close();
}

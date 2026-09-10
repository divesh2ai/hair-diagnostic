/**
 * Prove the render stack works on THIS machine, without a database.
 *
 * ── Why this script exists ─────────────────────────────────────────────────
 * The full lifecycle — approve → PENDING row → worker → READY → share — needs a
 * database, and this repository's local environment points at a shared Supabase
 * project rather than a local Postgres. The parts of the pipeline that DON'T
 * need a database are exactly the parts that failed in production before, and
 * they can be verified here honestly:
 *
 *   • the browser launcher actually launches a Chromium,
 *   • the page reaches the readiness marker on its own,
 *   • fonts and images settle before capture,
 *   • the capture is a valid PNG at plausible dimensions,
 *   • the browser is closed afterwards.
 *
 * It renders /dev/report-fixture/<case>, which is the same OnePageHairReport
 * component the production render target uses, from a typed fixture.
 *
 *   npm run dev            # in another terminal, port 4000
 *   npx tsx scripts/verify-report-render.mts [caseId] [baseUrl]
 */

import { writeFileSync } from "node:fs";
import path from "node:path";
import { createRendererBrowser } from "../src/lib/reports/assets/browser";
import {
  ONE_PAGER_READY_ATTRIBUTE,
  ONE_PAGER_ROOT_SELECTOR,
  ONE_PAGER_VIEWPORT,
  validatePng,
} from "../src/lib/reports/assets/contract";

const caseId = process.argv[2] ?? "ruchi";
const baseUrl = process.argv[3] ?? "http://localhost:4000";
const target = `${baseUrl}/dev/report-fixture/${caseId}`;

async function main() {
  const started = Date.now();
  const { browser, environment, launchMs } = await createRendererBrowser();
  console.log(`launched  ${environment} chromium in ${launchMs}ms`);

  try {
    const context = await browser.newContext({
      viewport: { ...ONE_PAGER_VIEWPORT },
      deviceScaleFactor: 2,
      colorScheme: "light",
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.emulateMedia({ media: "print" });

    const navigateStart = Date.now();
    const response = await page.goto(target, { waitUntil: "load", timeout: 60_000 });
    console.log(`navigated ${response?.status()} in ${Date.now() - navigateStart}ms`);

    const readyStart = Date.now();
    await page.waitForSelector(`[${ONE_PAGER_READY_ATTRIBUTE}="true"]`, { timeout: 60_000 });
    console.log(`ready     marker fired after ${Date.now() - readyStart}ms`);

    const captureStart = Date.now();
    const bytes = new Uint8Array(
      await page.locator(ONE_PAGER_ROOT_SELECTOR).first().screenshot({ type: "png" }),
    );
    console.log(`captured  ${bytes.byteLength} bytes in ${Date.now() - captureStart}ms`);

    const validation = validatePng(bytes);
    if (!validation.ok) {
      console.error(`REJECTED  ${validation.reason}`);
      process.exitCode = 1;
      return;
    }
    console.log(`valid     PNG ${validation.width}x${validation.height}`);

    const out = path.resolve(process.cwd(), `one-pager-${caseId}.png`);
    writeFileSync(out, bytes);
    console.log(`written   ${out}`);
    console.log(`total     ${Date.now() - started}ms`);
  } finally {
    await browser.close().catch(() => undefined);
    console.log("closed    browser");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

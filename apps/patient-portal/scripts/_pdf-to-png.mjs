// Render PDF page 1 to PNG using Chromium's built-in PDF viewer via
// pdfjs-dist (bundled with playwright's chromium install path).
// Simpler: file:// the PDF in Chromium and screenshot the viewer.
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";

const pdfPath = process.argv[2];
const outPath = process.argv[3];
if (!pdfPath || !outPath) { console.error("usage: pdf-to-png.mjs <pdf> <png>"); process.exit(2); }

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 900, height: 1300 }, deviceScaleFactor: 1.5 });
  const page = await context.newPage();
  await page.goto(pathToFileURL(pdfPath).toString(), { waitUntil: "load", timeout: 60_000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: outPath, fullPage: true });
  console.log("wrote " + outPath);
} finally {
  await browser.close();
}

#!/usr/bin/env node
/**
 * Landscape-A4 PDF export for the dev fixture route. Bypasses the
 * authenticated /api/reports/[id]/one-page/pdf path so we can verify the
 * report pipeline against typed fixtures during the conference build-up.
 *
 * Usage: node scripts/pdf-report-fixture.mjs <caseId> [outPath]
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const caseId = process.argv[2] ?? "ruchi";
const scratchDefault =
  process.env.SCRATCHPAD ??
  "C:/Users/ERA/AppData/Local/Temp/claude/D--Dr-Fact-Folder-RAG-Chatbot/7e47f025-7360-43c2-88fd-387caa4590b5/scratchpad";
const outPath = process.argv[3]
  ? resolve(process.argv[3])
  : resolve(scratchDefault, `report-fixture-${caseId}.pdf`);
const baseUrl = process.env.BASE_URL ?? "http://localhost:4000";

await mkdir(dirname(outPath), { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1123, height: 794 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const url = `${baseUrl}/dev/report-fixture/${caseId}`;
  console.log(`[pdf] navigating to ${url}`);
  await page.emulateMedia({ media: "print" });
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
  // Landscape print clamp — mirrors the server render.ts patch so overflow
  // reveals itself rather than paginating a phantom second page.
  await page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    for (const el of [html, body]) {
      el.style.width = "297mm";
      el.style.height = "210mm";
      el.style.maxHeight = "210mm";
      el.style.margin = "0";
      el.style.padding = "0";
      el.style.overflow = "hidden";
    }
    const shell = document.querySelector(".op-report-shell");
    if (shell) {
      Object.assign(shell.style, {
        width: "297mm", height: "210mm", maxHeight: "210mm",
        margin: "0", padding: "0", overflow: "hidden", display: "block",
      });
    }
    const pageEl = document.querySelector("[data-one-page-report]");
    if (pageEl) {
      Object.assign(pageEl.style, {
        width: "297mm", height: "210mm", maxHeight: "210mm",
        margin: "0", overflow: "hidden",
      });
    }
  });
  // True overflow assertion — the sheet's `overflow: hidden` clamps
  // scrollHeight to clientHeight, so the naive check always passes even
  // when content is clipped. Temporarily promote the sheet and article to
  // overflow: visible, force layout, take honest measurements, then
  // restore. Also compare section bounding rects to the sheet's rect so we
  // catch content that spills past the printable bottom edge.
  const overflow = await page.evaluate(() => {
    const sheet = document.querySelector(".sheet");
    const article = document.querySelector("[data-one-page-report]");
    const footer = document.querySelector(".sheet .ft");
    const lower = document.querySelector(".sheet .lower");
    const sections = Array.from(document.querySelectorAll(".sheet > .hd, .sheet > .rowA, .sheet > .mapband, .sheet > .lower, .sheet > .ft"));
    if (!sheet || !article) return { ok: false, reason: "missing sheet or article root" };

    const savedSheet = sheet.style.overflow;
    const savedArticle = article.style.overflow;
    sheet.style.overflow = "visible";
    article.style.overflow = "visible";
    void article.offsetHeight; // force layout

    const sheetRect = sheet.getBoundingClientRect();
    const articleRect = article.getBoundingClientRect();
    const footerRect = footer ? footer.getBoundingClientRect() : null;
    const lowerRect = lower ? lower.getBoundingClientRect() : null;
    const sectionRects = sections.map((section) => {
      const rect = section.getBoundingClientRect();
      return { className: section.className, top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left };
    });
    const internalOverflows = Array.from(document.querySelectorAll(
      ".card, .map-cell, .support-row, .support-name, .topical-body, .topical-row, .topical-body-text, .topical-name, .recovery-grid, .rec-stage-grid, .daily-cols, .daily-col, .qr-row, .ft-cell",
    )).flatMap((element) => {
      const overflowX = element.scrollWidth - element.clientWidth;
      const overflowY = element.scrollHeight - element.clientHeight;
      if (overflowX <= 1 && overflowY <= 1) return [];
      return [{ className: element.className, overflowX, overflowY }];
    });

    const result = {
      sheet: { scrollHeight: sheet.scrollHeight, clientHeight: sheet.clientHeight, scrollWidth: sheet.scrollWidth, clientWidth: sheet.clientWidth },
      article: { scrollHeight: article.scrollHeight, clientHeight: article.clientHeight, scrollWidth: article.scrollWidth, clientWidth: article.clientWidth },
      articleBottom: articleRect.bottom, sheetBottom: sheetRect.bottom,
      footerBottom: footerRect?.bottom ?? null,
      lowerBottom: lowerRect?.bottom ?? null,
      sections: sectionRects,
      internalOverflows,
    };

    sheet.style.overflow = savedSheet;
    article.style.overflow = savedArticle;

    const problems = [];
    if (result.article.scrollHeight > result.article.clientHeight + 1) problems.push(`article scrollHeight ${result.article.scrollHeight} > clientHeight ${result.article.clientHeight}`);
    if (result.article.scrollWidth > result.article.clientWidth + 1) problems.push(`article scrollWidth ${result.article.scrollWidth} > clientWidth ${result.article.clientWidth}`);
    if (result.sheet.scrollHeight > result.sheet.clientHeight + 1) problems.push(`sheet scrollHeight ${result.sheet.scrollHeight} > clientHeight ${result.sheet.clientHeight}`);
    if (result.footerBottom !== null && result.footerBottom > result.sheetBottom + 1) problems.push(`footer extends past sheet bottom by ${(result.footerBottom - result.sheetBottom).toFixed(1)}px`);
    if (result.lowerBottom !== null && result.lowerBottom > result.sheetBottom + 1) problems.push(`lower grid extends past sheet bottom by ${(result.lowerBottom - result.sheetBottom).toFixed(1)}px`);
    for (const section of result.sections) {
      if (section.left < sheetRect.left - 1 || section.right > sheetRect.right + 1 || section.top < sheetRect.top - 1 || section.bottom > sheetRect.bottom + 1) {
        problems.push(`section ${section.className} exceeds the report bounds`);
      }
    }
    for (const item of result.internalOverflows) {
      problems.push(`internal overflow in ${item.className}: ${item.overflowX}px x ${item.overflowY}px`);
    }

    return { ...result, problems, ok: problems.length === 0 };
  });
  console.log(`[pdf] true-overflow measurements:`, JSON.stringify(overflow, null, 2));
  const metricsPath = outPath.replace(/\.pdf$/i, ".overflow.json");
  await writeFile(metricsPath, `${JSON.stringify(overflow, null, 2)}\n`, "utf8");
  console.log(`[pdf] wrote ${metricsPath}`);
  if (!overflow.ok) {
    console.error(`[pdf] FAIL: true overflow detected. Refusing to emit clipped PDF.`);
    overflow.problems?.forEach((p) => console.error(`  - ${p}`));
    process.exit(2);
  }
  await page.pdf({
    path: outPath,
    format: "A4",
    landscape: true,
    printBackground: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
    preferCSSPageSize: true,
    pageRanges: "1",
  });
  console.log(`[pdf] wrote ${outPath}`);
} finally {
  await browser.close();
}

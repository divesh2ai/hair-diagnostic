#!/usr/bin/env node
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://localhost:4000";
const cases = ["ruchi", "bhavna", "harsh"];
const browser = await chromium.launch({ headless: true });

try {
  for (const caseId of cases) {
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
    await page.goto(`${baseUrl}/dev/report-fixture/${caseId}`, {
      waitUntil: "load",
      timeout: 60_000,
    });
    await page.waitForSelector("[data-one-page-report]");
    const audit = await page.evaluate(async () => {
      await document.fonts?.ready;
      const sheet = document.querySelector("[data-one-page-report]");
      const failedImages = Array.from(sheet.querySelectorAll("img"))
        .filter((image) => !image.complete || image.naturalWidth === 0)
        .map((image) => image.getAttribute("src"));
      const overlaps = Array.from(sheet.querySelectorAll(".map-row"))
        .map((row, index) => {
          const trigger = row.querySelector(".map-trigger")?.getBoundingClientRect();
          const arrow = row.querySelector(".map-arrow")?.getBoundingClientRect();
          if (!trigger || !arrow) return null;
          return trigger.right > arrow.left || trigger.bottom < arrow.top || trigger.top > arrow.bottom
            ? null
            : index + 1;
        })
        .filter(Boolean);
      return {
        viewport: { width: innerWidth, height: innerHeight },
        sheet: {
          clientWidth: sheet.clientWidth,
          scrollWidth: sheet.scrollWidth,
          clientHeight: sheet.clientHeight,
          scrollHeight: sheet.scrollHeight,
        },
        failedImages,
        gradeImageCount: sheet.querySelectorAll('[data-asset-role="grade"]').length,
        gradeThumbnailCount: sheet.querySelectorAll(".grade-thumb img").length,
        supportShotWidths: Array.from(sheet.querySelectorAll(".support-shot"), (node) =>
          Math.round(node.getBoundingClientRect().width),
        ),
        snapshotPaths: Array.from(
          sheet.querySelectorAll(".clinical-option-icon-snapshot img"),
          (node) => node.getAttribute("src"),
        ),
        triggerArrowOverlaps: overlaps,
      };
    });
    console.log(JSON.stringify({ caseId, ...audit }));
    await page.close();
  }
} finally {
  await browser.close();
}

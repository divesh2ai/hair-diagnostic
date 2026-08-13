import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const outputDir = path.resolve(process.cwd(), "../../outputs/design-preview/assistant-companion");
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const browserErrors = [];
page.on("pageerror", (error) => browserErrors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
await page.addInitScript(() => localStorage.removeItem("drfact-companion-preferences"));
await page.goto("http://localhost:4000/assistant", { waitUntil: "networkidle" });
await page.locator("[data-companion-state]").waitFor();
await page.waitForTimeout(250);

async function show(state, anchorId, delay = 850) {
  await page.evaluate(({ state, anchorId }) => {
    window.dispatchEvent(new CustomEvent("drfact:companion", { detail: { state, anchorId } }));
  }, { state, anchorId });
  await page.waitForTimeout(delay);
  await page.screenshot({ path: path.join(outputDir, `${state}.png`) });
}

await show("roaming", "suggested-prompts", 1200);
await show("listening", "composer");
await show("thinking", "bottom-left");
await show("note-taking", "bottom-left");
await show("answering", "composer");
await show("guide-mode", "suggested-prompts");
await show("page-transition", "bottom-right", 260);

await page.evaluate(() => window.dispatchEvent(new CustomEvent("drfact:companion", { detail: { action: "minimize" } })));
await page.waitForTimeout(350);
await page.screenshot({ path: path.join(outputDir, "minimized.png") });

await page.setViewportSize({ width: 390, height: 844 });
await page.reload({ waitUntil: "networkidle" });
await page.evaluate(() => window.dispatchEvent(new CustomEvent("drfact:companion", { detail: { action: "restore" } })));
await page.locator("form[data-companion-anchor='composer']").scrollIntoViewIfNeeded();
await page.locator("#assistant-query").focus();
await page.waitForTimeout(650);
const mobileMetrics = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
await page.screenshot({ path: path.join(outputDir, "listening-mobile.png"), fullPage: true });

console.log(JSON.stringify({ outputDir, mobileMetrics, browserErrors }, null, 2));
await browser.close();
if (browserErrors.length) process.exitCode = 1;

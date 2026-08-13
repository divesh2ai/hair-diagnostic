import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const outputDir = path.resolve(process.cwd(), "../../outputs/design-preview/assistant-pet");
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
await page.goto("http://localhost:4000/assistant", { waitUntil: "networkidle" });
await page.locator('[data-state="idle"]').waitFor();

const pet = page.locator("[data-state]").first();
const composer = page.locator("form");
await page.locator("#assistant-query").fill("Hi");
await page.locator('[data-state="wave"]').waitFor();
await page.waitForTimeout(260);
await page.screenshot({ path: path.join(outputDir, "typed-hi-wave.png") });
await page.locator("#assistant-query").fill("");
for (const state of ["idle", "thinking", "answering", "caution", "wink", "wave", "dance"]) {
  await pet.evaluate((node, nextState) => node.setAttribute("data-state", nextState), state);
  await page.waitForTimeout(180);
  await composer.screenshot({ path: path.join(outputDir, `${state}.png`) });
  if (state === "wave") {
    await page.screenshot({ path: path.join(outputDir, "wave-full.png") });
    await page.waitForTimeout(420);
    await composer.screenshot({ path: path.join(outputDir, "wave-mid.png") });
    await page.screenshot({ path: path.join(outputDir, "wave-mid-full.png") });
  }
}

await page.getByRole("button", { name: "Minimize assistant companion" }).click();
await page.locator('[data-state="minimized"]').waitFor();
await composer.screenshot({ path: path.join(outputDir, "minimized.png") });

await page.setViewportSize({ width: 390, height: 844 });
await page.reload({ waitUntil: "networkidle" });
await page.locator('[data-state="idle"]').waitFor();
const mobileMetrics = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
await page.screenshot({ path: path.join(outputDir, "idle-mobile.png"), fullPage: true });

console.log(JSON.stringify({ outputDir, mobileMetrics }, null, 2));
await browser.close();

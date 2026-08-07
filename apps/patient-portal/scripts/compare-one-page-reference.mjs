import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.ONE_PAGE_BASE_URL || "http://localhost:4000";
const assessmentId = process.env.ONE_PAGE_ASSESSMENT_ID || "cmra9pjsw004y6okm12amvrxh";
const referencePath = path.resolve(process.env.ONE_PAGE_REFERENCE_IMAGE || "tests/visual/reference/approved-one-page.png");
const outputDir = path.resolve(process.env.ONE_PAGE_VISUAL_OUTPUT_DIR || "outputs/one-page-report");
const actualPath = path.join(outputDir, "visual-regression-actual.png");
const maxDiffRatio = Number(process.env.ONE_PAGE_MAX_DIFF_RATIO || "0.03");
const secret = process.env.ONE_PAGE_DEV_LOGIN_SECRET || process.env.DEV_LOGIN_SECRET;

if (!fs.existsSync(referencePath)) {
  console.error(`Approved reference image missing: ${referencePath}`);
  console.error("Set ONE_PAGE_REFERENCE_IMAGE or place the approved PNG at tests/visual/reference/approved-one-page.png.");
  process.exit(2);
}

fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1 });
  if (secret) {
    const login = await context.request.post(`${baseUrl}/api/dev/login`, {
      headers: { "x-dev-login-secret": secret },
      data: {},
    });
    if (!login.ok()) throw new Error(`Dev login failed with ${login.status()}`);
  }

  const page = await context.newPage();
  await page.emulateMedia({ media: "print" });
  const response = await page.goto(`${baseUrl}/reports/${assessmentId}/one-page`, { waitUntil: "networkidle", timeout: 60000 });
  if (!response?.ok()) throw new Error(`Report route returned ${response?.status() ?? "no response"}`);
  const report = page.locator("[data-one-page-report]");
  await report.waitFor({ timeout: 30000 });
  await report.screenshot({ path: actualPath });

  const referenceDataUrl = `data:image/png;base64,${fs.readFileSync(referencePath).toString("base64")}`;
  const actualDataUrl = `data:image/png;base64,${fs.readFileSync(actualPath).toString("base64")}`;

  const result = await page.evaluate(async ({ referenceDataUrl, actualDataUrl }) => {
    async function loadImage(src) {
      const img = new Image();
      img.decoding = "sync";
      img.src = src;
      await img.decode();
      return img;
    }

    const [reference, actual] = await Promise.all([loadImage(referenceDataUrl), loadImage(actualDataUrl)]);
    if (reference.naturalWidth !== actual.naturalWidth || reference.naturalHeight !== actual.naturalHeight) {
      return {
        widthMismatch: true,
        reference: { width: reference.naturalWidth, height: reference.naturalHeight },
        actual: { width: actual.naturalWidth, height: actual.naturalHeight },
        diffRatio: 1,
      };
    }

    const canvas = document.createElement("canvas");
    canvas.width = actual.naturalWidth;
    canvas.height = actual.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(reference, 0, 0);
    const ref = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(actual, 0, 0);
    const act = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    let different = 0;
    const pixels = canvas.width * canvas.height;
    for (let i = 0; i < ref.length; i += 4) {
      const delta = Math.abs(ref[i] - act[i]) + Math.abs(ref[i + 1] - act[i + 1]) + Math.abs(ref[i + 2] - act[i + 2]) + Math.abs(ref[i + 3] - act[i + 3]);
      if (delta > 48) different += 1;
    }
    return { widthMismatch: false, reference: { width: canvas.width, height: canvas.height }, actual: { width: canvas.width, height: canvas.height }, diffRatio: different / pixels };
  }, { referenceDataUrl, actualDataUrl });

  console.log(JSON.stringify({ actualPath, referencePath, ...result }, null, 2));
  if (result.widthMismatch || result.diffRatio > maxDiffRatio) {
    console.error(`Visual regression exceeded threshold ${maxDiffRatio}.`);
    process.exit(1);
  }
} finally {
  await browser.close();
}

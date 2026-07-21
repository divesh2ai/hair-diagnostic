import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.ASSESSMENT_V3_BASE_URL ?? 'http://127.0.0.1:4012';
const clinicSlug = process.env.ASSESSMENT_V3_CLINIC_SLUG ?? 'drfact';
const outDir = path.resolve('outputs/assessment-v3');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
await context.addInitScript(() => localStorage.clear());
const page = await context.newPage();
const consoleErrors = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => consoleErrors.push(error.message));

let submittedPayload = null;
await page.route('**/api/assessment/submit', async (route) => {
  submittedPayload = route.request().postDataJSON();
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      assessmentId: 'v3-browser-verification',
      previewToken: 'local-only',
    }),
  });
});

// Robustly leave a chapter-transition screen. In dev the button can exist in
// SSR HTML a beat before React attaches its handler, so we retry the click
// until the "Begin chapter" button actually detaches (i.e. a question renders).
async function clickBeginChapter() {
  const button = page.getByRole('button', { name: 'Begin chapter' });
  await button.waitFor({ state: 'visible' });
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await button.click();
    try {
      await page
        .getByRole('button', { name: 'Begin chapter' })
        .waitFor({ state: 'detached', timeout: 1000 });
      return;
    } catch {
      // Handler not attached yet — wait a beat and click again.
      await page.waitForTimeout(300);
    }
  }
  throw new Error('Begin chapter did not advance to a question');
}

const measurements = {};
async function measure(label) {
  measurements[label] = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    clippedText: Array.from(document.querySelectorAll('button strong, button small'))
      .filter((element) => element.scrollWidth > element.clientWidth)
      .map((element) => element.textContent?.trim()),
  }));
}

try {
  await page.goto(`${baseUrl}/q/${clinicSlug}/assessment-v3`, { waitUntil: 'networkidle' });
  await clickBeginChapter();
  await page.getByRole('heading', { level: 1 }).waitFor();

  await measure('1440x900-first-question');
  await page.screenshot({ path: path.join(outDir, '01-v3-desktop-question.png'), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await measure('390x844-first-question');
  await page.screenshot({ path: path.join(outDir, '02-v3-mobile-question.png'), fullPage: true });
  await page.setViewportSize({ width: 430, height: 932 });
  await measure('430x932-first-question');
  await page.setViewportSize({ width: 768, height: 1024 });
  await measure('768x1024-first-question');
  await page.setViewportSize({ width: 1440, height: 900 });

  const progressValues = [];
  const visitedQuestions = [];
  const chapterTitles = [];
  let multiCaptured = false;
  let nutritionCaptured = false;
  let finalCaptured = false;
  let exclusiveVerified = false;

  for (let iteration = 0; iteration < 120; iteration += 1) {
    const beginButton = page.getByRole('button', { name: 'Begin chapter' });
    if (await beginButton.count()) {
      const title = (await page.getByRole('heading', { level: 1 }).textContent())?.trim() ?? '';
      chapterTitles.push(title);
      if (/nutrition/i.test(title) && !nutritionCaptured) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await measure('1440x900-nutrition-transition');
        await page.screenshot({
          path: path.join(outDir, '04-nutrition-desktop-transition.png'),
          fullPage: true,
        });
        await page.setViewportSize({ width: 390, height: 844 });
        await measure('390x844-nutrition-transition');
        await page.screenshot({
          path: path.join(outDir, '05-nutrition-mobile-transition.png'),
          fullPage: true,
        });
        await page.setViewportSize({ width: 1440, height: 900 });
        nutritionCaptured = true;
      }
      await clickBeginChapter();
      await page.getByRole('heading', { level: 1 }).waitFor();
      continue;
    }

    const heading = page.getByRole('heading', { level: 1 });
    if (!(await heading.count())) throw new Error(`Missing question heading at ${iteration}`);
    const questionTitle = (await heading.textContent())?.trim() ?? '';
    visitedQuestions.push(questionTitle);
    progressValues.push(Number(await page.getByRole('progressbar').getAttribute('aria-valuenow')));

    const radios = page.getByRole('radio');
    const checkboxes = page.getByRole('checkbox');
    const radioCount = await radios.count();
    const checkboxCount = await checkboxes.count();

    if (checkboxCount > 0) {
      await checkboxes.nth(0).click();
      if (checkboxCount > 1) await checkboxes.nth(1).click();
      if (!multiCaptured) {
        await page.screenshot({
          path: path.join(outDir, '03-real-multi-select.png'),
          fullPage: true,
        });
        multiCaptured = true;
      }

      const noneLike = page
        .getByRole('checkbox')
        .filter({ hasText: /^(None|No |Not |I don't|Nothing)/i });
      const noneCount = await noneLike.count();
      // Only probe exclusivity when the none-like option is currently OFF, so
      // clicking it turns it ON and forces the others to deselect (rather than
      // toggling an already-selected exclusive option back off).
      if (
        !exclusiveVerified &&
        noneCount === 1 &&
        checkboxCount > 1 &&
        (await noneLike.getAttribute('aria-checked')) === 'false'
      ) {
        await noneLike.click();
        exclusiveVerified =
          (await page.locator('[role="checkbox"][aria-checked="true"]').count()) === 1;
      }

      // Guarantee a valid selection remains for this required question — an
      // exclusivity probe may have collapsed the set. Re-select if empty.
      if ((await page.locator('[role="checkbox"][aria-checked="true"]').count()) === 0) {
        await checkboxes.nth(0).click();
      }
    } else if (radioCount > 0) {
      await radios.nth(0).click();
    } else {
      const numberInput = page.locator('input[type="number"]');
      const textInput = page.locator('input[type="text"]');
      const textarea = page.locator('textarea');
      if (await numberInput.count()) {
        const min = Number(await numberInput.getAttribute('min'));
        await numberInput.fill(Number.isFinite(min) ? String(Math.max(min, 32)) : '32');
      } else if (await textInput.count()) {
        await textInput.fill(questionTitle.toLowerCase().includes('name') ? 'CEO Preview' : 'No');
      } else if (await textarea.count()) {
        await textarea.fill('No additional concerns for this preview.');
      } else {
        throw new Error(`Unsupported visible control for: ${questionTitle}`);
      }
    }

    const complete = page.getByRole('button', { name: 'Complete assessment' });
    if (await complete.count()) {
      await measure('1440x900-final-step');
      await page.screenshot({
        path: path.join(outDir, '06-final-assessment-step.png'),
        fullPage: true,
      });
      finalCaptured = true;
      await complete.click();
      await page.waitForURL('**/processing/v3-browser-verification**');
      break;
    }

    const continueButton = page.getByRole('button', { name: 'Continue' });
    if (!(await continueButton.count())) throw new Error(`Missing Continue for: ${questionTitle}`);
    if (!(await continueButton.isEnabled())) {
      throw new Error(`Continue disabled after answer: ${questionTitle}`);
    }
    await continueButton.click();
  }

  const result = {
    chapterTitles,
    visitedQuestionCount: visitedQuestions.length,
    firstQuestion: visitedQuestions[0],
    lastQuestion: visitedQuestions.at(-1),
    multiCaptured,
    nutritionCaptured,
    finalCaptured,
    exclusiveVerified,
    progressMonotonic: progressValues.every(
      (value, index) => index === 0 || value >= progressValues[index - 1],
    ),
    progressStart: progressValues[0],
    progressEnd: progressValues.at(-1),
    submittedPayloadKeys:
      submittedPayload && typeof submittedPayload === 'object'
        ? Object.keys(submittedPayload)
        : [],
    submittedClinicSlug: submittedPayload?.clinicSlug ?? null,
    submittedAnswerCount: Object.keys(submittedPayload?.answers ?? {}).length,
    measurements,
    consoleErrors,
  };

  fs.writeFileSync(
    path.join(outDir, 'verification-results.json'),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}

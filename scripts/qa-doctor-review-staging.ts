/**
 * Browser QA for Doctor Review V2 against staging.
 *
 * Drives a real browser through the real login path, so what is captured is
 * what a doctor would actually see — not a curl body or a component rendered in
 * isolation. Sessions are established through `/api/dev/login`, whose secret is
 * read from the environment and never printed, and the resulting cookies stay
 * inside the browser context; nothing sensitive reaches stdout.
 *
 * Captures the primary clinic-laptop viewport first (1366×768) because a layout
 * that only holds together at 1440 is not one a clinic can use, then repeats the
 * review at the wider and narrower sizes.
 *
 * Read-only: it opens and looks. It does not approve anything — approval is
 * exercised deliberately and separately.
 *
 *   npx tsx scripts/qa-doctor-review-staging.ts [baseUrl]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type BrowserContext } from "playwright";
import { PrismaClient } from "@prisma/client";
import { extractSupabaseRef, STAGING_SUPABASE_REF } from "../packages/shared/env/databaseTarget";

const prisma = new PrismaClient();
const BASE = process.argv[2] ?? "http://localhost:4000";
const OUT = path.resolve(__dirname, "..", ".tmp-staging-qa");

const DOCTOR_A = "dr.test.a@drfact.staging";

interface Shot {
  name: string;
  url: string;
  width: number;
  height: number;
}

const consoleErrors: string[] = [];

async function login(ctx: BrowserContext, email: string): Promise<void> {
  const secret = process.env.DEV_LOGIN_SECRET;
  if (!secret) throw new Error("DEV_LOGIN_SECRET not set.");
  const res = await ctx.request.post(`${BASE}/api/dev/login`, {
    headers: { "x-dev-login-secret": secret, "Content-Type": "application/json" },
    data: { email },
  });
  if (!res.ok()) throw new Error(`dev-login failed for ${email}: HTTP ${res.status()}`);
}

async function main(): Promise<void> {
  const ref = extractSupabaseRef(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (ref !== STAGING_SUPABASE_REF) {
    throw new Error(`Refusing: resolved ${ref ?? "unknown"}, expected staging.`);
  }
  mkdirSync(OUT, { recursive: true });
  console.log(`[qa] project → staging (${ref})`);
  console.log(`[qa] app     → ${BASE}`);

  // Pick real cases rather than hardcoding ids.
  const composable = await prisma.assessment.findMany({
    where: { deletedAt: null, clinic: { slug: "drfact-mumbai-test" } },
    orderBy: { submittedAt: "asc" },
    select: { id: true, rawResponses: true, patient: { select: { name: true } } },
  });
  const reviewable = composable.filter((a) => a.rawResponses !== null);
  const legacy = composable.find((a) => a.rawResponses === null);
  if (reviewable.length === 0) throw new Error("No composable assessment in clinic A.");

  const primary = reviewable[0];
  console.log(`[qa] review case  ${primary.id}`);
  console.log(`[qa] legacy case  ${legacy?.id ?? "(none)"}\n`);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  ctx.on("weberror", (e) => consoleErrors.push(String(e.error())));

  await login(ctx, DOCTOR_A);

  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
  });

  const shots: Shot[] = [
    { name: "01-doctor-dashboard-1366", url: `${BASE}/doctor`, width: 1366, height: 768 },
    { name: "02-review-queue-1366", url: `${BASE}/doctor/reports`, width: 1366, height: 768 },
    { name: "03-review-1366", url: `${BASE}/doctor/reports/${primary.id}`, width: 1366, height: 768 },
    { name: "04-review-1440", url: `${BASE}/doctor/reports/${primary.id}`, width: 1440, height: 900 },
    { name: "05-review-1024", url: `${BASE}/doctor/reports/${primary.id}`, width: 1024, height: 768 },
    { name: "06-review-mobile", url: `${BASE}/doctor/reports/${primary.id}`, width: 390, height: 844 },
  ];
  if (legacy) {
    shots.push({
      name: "07-legacy-degraded-1366",
      url: `${BASE}/doctor/reports/${legacy.id}`,
      width: 1366,
      height: 768,
    });
  }

  const report: string[] = [];

  for (const s of shots) {
    await page.setViewportSize({ width: s.width, height: s.height });
    const failedRequests: string[] = [];
    const onFailed = (r: import("playwright").Request) =>
      failedRequests.push(`${r.method()} ${new URL(r.url()).pathname} — ${r.failure()?.errorText ?? "?"}`);
    page.on("requestfailed", onFailed);

    const started = Date.now();
    let status = 0;
    let navError = "";
    try {
      const resp = await page.goto(s.url, { waitUntil: "domcontentloaded", timeout: 180_000 });
      status = resp?.status() ?? 0;
    } catch (e) {
      navError = e instanceof Error ? e.message.split("\n")[0] : String(e);
    }

    // Settle on the real end state rather than an arbitrary sleep: the review
    // composes its consultation on first open and the queue fetches after
    // mount, so a fixed 6s wait was measuring a loading spinner and calling it
    // a page. Wait for the network to go quiet, then for the word "Loading" to
    // leave the document — whichever resolves, the timeout is generous enough
    // that a genuinely stuck state still reports as stuck.
    await page.waitForLoadState("networkidle", { timeout: 120_000 }).catch(() => {});
    await page
      .waitForFunction(
        `!/Loading|Loading your queue/i.test(document.body.innerText)`,
        undefined,
        { timeout: 60_000 },
      )
      .catch(() => {});
    const elapsed = Date.now() - started;

    const title = await page.title();
    const bodyText = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
    const stillLoading = /Loading/i.test(bodyText);

    const metrics = (await page.evaluate(
      `({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })`,
    )) as { sw: number; cw: number };

    await page.screenshot({ path: path.join(OUT, `${s.name}.png`), fullPage: false });
    page.off("requestfailed", onFailed);

    const line =
      `${s.name.padEnd(28)} HTTP ${String(status).padStart(3)}  ${String(s.width).padStart(4)}px  ` +
      `sw=${metrics.sw} cw=${metrics.cw} hscroll=${metrics.sw > metrics.cw ? "YES" : "no"}  ` +
      `${String(elapsed).padStart(6)}ms  chars=${String(bodyText.length).padStart(5)}  ` +
      `${stillLoading ? "STILL-LOADING" : "settled"}${navError ? `  NAV-ERR: ${navError}` : ""}`;
    console.log(`  ${line}`);
    if (failedRequests.length) {
      for (const f of failedRequests.slice(0, 4)) console.log(`        failed: ${f}`);
    }
    report.push(
      `${line}\n  title: ${title}\n  failedRequests: ${failedRequests.length}\n  text : ${bodyText.slice(0, 500)}\n`,
    );
  }

  writeFileSync(path.join(OUT, "qa-report.txt"), report.join("\n"), "utf8");

  console.log(`\n[qa] console errors captured: ${consoleErrors.length}`);
  for (const e of consoleErrors.slice(0, 8)) console.log(`   - ${e}`);
  console.log(`\n[qa] screenshots + text in ${path.relative(process.cwd(), OUT)}`);

  await browser.close();
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());

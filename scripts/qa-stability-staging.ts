/**
 * Three-run stability QA for Doctor Review V2.
 *
 * ── Why three runs ──────────────────────────────────────────────────────────
 * One green run proves the page *can* render, not that it *does*. A previous
 * pass saw 1366 return HTTP 0 while 1440 succeeded, and a later pass saw 1440
 * and 390 settle with chrome but no review content — same code, different
 * result. That is the signature of a race, and a race is not something a single
 * sample can clear.
 *
 * ── Why a fresh context every run ───────────────────────────────────────────
 * Reusing a context lets run 1 warm the browser cache, the Next compilation
 * cache and the session, so runs 2 and 3 measure a much easier problem than a
 * doctor opening the app cold. Each run therefore gets its own browser context
 * and its own login, so all twelve are independent samples of the same cold-ish
 * path.
 *
 * ── What counts as PASS ─────────────────────────────────────────────────────
 * Not "the screenshot looked fine". A run passes only when navigation returned
 * 200, the consultation API returned 200, the review actually rendered its
 * findings heading, there is no horizontal overflow, and nothing failed on the
 * network or the console. Anything else is recorded as it happened.
 *
 * Read-only against the app.
 *
 *   npx tsx scripts/qa-stability-staging.ts [baseUrl]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser } from "playwright";
import { PrismaClient } from "@prisma/client";
import { extractSupabaseRef, STAGING_SUPABASE_REF } from "../packages/shared/env/databaseTarget";

const prisma = new PrismaClient();
const BASE = process.argv[2] ?? "http://localhost:4000";
const OUT = path.resolve(__dirname, "..", ".tmp-staging-qa");
const DOCTOR = "dr.test.a@drfact.staging";
const RUNS = 3;

const VIEWPORTS = [
  { w: 390, h: 844 },
  { w: 1024, h: 768 },
  { w: 1366, h: 768 },
  { w: 1440, h: 900 },
];

/** Proof the review actually rendered, not just that a shell painted. */
const RENDER_MARKER = "WHAT DR FACT FOUND";

interface RunResult {
  run: number;
  viewport: string;
  nav: number | "ERR";
  navError: string;
  appReady: boolean;
  consultationApi: number | "none";
  rendered: boolean;
  queueFinal: boolean;
  scrollWidth: number;
  clientWidth: number;
  overflow: boolean;
  consoleErrors: string[];
  failedRequests: string[];
  loadMs: number;
  timedOut: boolean;
}

function verdict(r: RunResult): boolean {
  return (
    r.nav === 200 &&
    r.appReady &&
    r.consultationApi === 200 &&
    r.rendered &&
    r.queueFinal &&
    !r.overflow &&
    !r.timedOut &&
    r.consoleErrors.length === 0 &&
    r.failedRequests.length === 0
  );
}

async function oneRun(
  browser: Browser,
  runNo: number,
  vp: { w: number; h: number },
  reviewUrl: string,
  queueUrl: string,
): Promise<RunResult> {
  // Fresh context => fresh cache, fresh storage, fresh session.
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const res: RunResult = {
    run: runNo,
    viewport: `${vp.w}x${vp.h}`,
    nav: "ERR",
    navError: "",
    appReady: false,
    consultationApi: "none",
    rendered: false,
    queueFinal: false,
    scrollWidth: 0,
    clientWidth: 0,
    overflow: false,
    consoleErrors: [],
    failedRequests: [],
    loadMs: 0,
    timedOut: false,
  };

  try {
    const secret = process.env.DEV_LOGIN_SECRET;
    if (!secret) throw new Error("DEV_LOGIN_SECRET not set.");
    const login = await ctx.request.post(`${BASE}/api/dev/login`, {
      headers: { "x-dev-login-secret": secret, "Content-Type": "application/json" },
      data: { email: DOCTOR },
    });
    if (!login.ok()) throw new Error(`dev-login HTTP ${login.status()}`);

    const page = await ctx.newPage();
    page.on("console", (m) => {
      if (m.type() === "error") res.consoleErrors.push(m.text().slice(0, 160));
    });
    page.on("requestfailed", (r) => {
      const t = r.failure()?.errorText ?? "?";
      // A prefetch cancelled by navigating away is not a defect.
      if (t.includes("ERR_ABORTED")) return;
      res.failedRequests.push(`${r.method()} ${new URL(r.url()).pathname} — ${t}`);
    });
    page.on("response", (r) => {
      if (r.url().includes("/api/consultation/")) res.consultationApi = r.status();
    });

    // ── Queue first: it must reach a final state, not spin ──────────────────
    await page.goto(queueUrl, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.waitForLoadState("networkidle", { timeout: 120_000 }).catch(() => {});
    const queueText = await page.locator("body").innerText().catch(() => "");
    // Either rows arrived ("N cases") or an explicit empty state did.
    res.queueFinal =
      !/Loading/i.test(queueText) && /\d+\s+cases?|caught up|no cases|no patients/i.test(queueText);

    // ── Review ──────────────────────────────────────────────────────────────
    const started = Date.now();
    try {
      const resp = await page.goto(reviewUrl, { waitUntil: "domcontentloaded", timeout: 180_000 });
      res.nav = resp?.status() ?? "ERR";
    } catch (e) {
      res.navError = e instanceof Error ? e.message.split("\n")[0] : String(e);
    }

    // Wait for the findings heading itself — the honest proof that the
    // consultation loaded AND V2 rendered it.
    try {
      await page.waitForFunction(
        `document.body.innerText.indexOf(${JSON.stringify(RENDER_MARKER)}) !== -1`,
        undefined,
        { timeout: 90_000 },
      );
      res.rendered = true;
    } catch {
      res.timedOut = true;
    }
    res.loadMs = Date.now() - started;

    const body = await page.locator("body").innerText().catch(() => "");
    res.appReady = /CONSULTATION REVIEW/i.test(body);

    const m = (await page.evaluate(
      `({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })`,
    )) as { sw: number; cw: number };
    res.scrollWidth = m.sw;
    res.clientWidth = m.cw;
    res.overflow = m.sw > m.cw;

    await page.screenshot({ path: path.join(OUT, `stability-${vp.w}-run${runNo}.png`) });
  } catch (e) {
    res.navError = res.navError || (e instanceof Error ? e.message.split("\n")[0] : String(e));
  } finally {
    await ctx.close();
  }
  return res;
}

async function main(): Promise<void> {
  const ref = extractSupabaseRef(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (ref !== STAGING_SUPABASE_REF) throw new Error(`Refusing: expected staging, got ${ref}`);
  mkdirSync(OUT, { recursive: true });

  const a = await prisma.assessment.findFirst({
    where: {
      deletedAt: null,
      clinic: { slug: "drfact-mumbai-test" },
      NOT: { rawResponses: { equals: null } },
      reviewDecision: "PENDING",
    },
    orderBy: { submittedAt: "asc" },
    select: { id: true },
  });
  if (!a) throw new Error("No pending composable assessment in clinic A.");

  const reviewUrl = `${BASE}/doctor/reports/${a.id}`;
  const queueUrl = `${BASE}/doctor/reports`;
  console.log(`[stability] staging (${ref})`);
  console.log(`[stability] review ${reviewUrl}`);
  console.log(`[stability] ${VIEWPORTS.length} viewports x ${RUNS} runs = ${VIEWPORTS.length * RUNS} independent runs\n`);

  const browser = await chromium.launch();
  const all: RunResult[] = [];

  for (const vp of VIEWPORTS) {
    for (let run = 1; run <= RUNS; run += 1) {
      const r = await oneRun(browser, run, vp, reviewUrl, queueUrl);
      all.push(r);
      const ok = verdict(r);
      console.log(
        `  ${r.viewport.padEnd(9)} run${run}  ${ok ? "PASS" : "FAIL"}  ` +
          `nav=${String(r.nav).padStart(3)} api=${String(r.consultationApi).padStart(4)} ` +
          `ready=${r.appReady ? "y" : "n"} render=${r.rendered ? "y" : "n"} queue=${r.queueFinal ? "y" : "n"} ` +
          `sw/cw=${r.scrollWidth}/${r.clientWidth} of=${r.overflow ? "YES" : "no"} ` +
          `${String(r.loadMs).padStart(6)}ms${r.timedOut ? " TIMEOUT" : ""}` +
          `${r.consoleErrors.length ? ` err=${r.consoleErrors.length}` : ""}` +
          `${r.failedRequests.length ? ` netfail=${r.failedRequests.length}` : ""}` +
          `${r.navError ? ` NAV:${r.navError.slice(0, 40)}` : ""}`,
      );
    }
  }
  await browser.close();

  console.log("\n| Viewport | Run 1 | Run 2 | Run 3 | Stability |");
  console.log("|---|---|---|---|---|");
  let passed = 0;
  let flaky = 0;
  for (const vp of VIEWPORTS) {
    const rs = all.filter((r) => r.viewport === `${vp.w}x${vp.h}`);
    const vs = rs.map(verdict);
    passed += vs.filter(Boolean).length;
    const allPass = vs.every(Boolean);
    const allFail = vs.every((v) => !v);
    const isFlaky = !allPass && !allFail;
    if (isFlaky) flaky += 1;
    console.log(
      `| ${vp.w}x${vp.h} | ${vs.map((v) => (v ? "PASS" : "FAIL")).join(" | ")} | ` +
        `${allPass ? "STABLE PASS" : isFlaky ? "FLAKY" : "STABLE FAIL"} |`,
    );
  }

  const total = all.length;
  console.log(`\nTotal runs: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${total - passed}`);
  console.log(`Flaky viewports: ${flaky}`);
  console.log(`Critical console errors: ${all.reduce((n, r) => n + r.consoleErrors.length, 0)}`);
  console.log(`Critical network failures: ${all.reduce((n, r) => n + r.failedRequests.length, 0)}`);

  const uniqueErrors = [...new Set(all.flatMap((r) => r.consoleErrors))];
  const uniqueNet = [...new Set(all.flatMap((r) => r.failedRequests))];
  if (uniqueErrors.length) {
    console.log("\nConsole errors seen:");
    for (const e of uniqueErrors.slice(0, 10)) console.log(`  - ${e}`);
  }
  if (uniqueNet.length) {
    console.log("\nNetwork failures seen:");
    for (const e of uniqueNet.slice(0, 10)) console.log(`  - ${e}`);
  }

  writeFileSync(path.join(OUT, "stability.json"), JSON.stringify(all, null, 2), "utf8");
  console.log(`\n[stability] ${passed}/${total} PASS — detail in .tmp-staging-qa/stability.json`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());

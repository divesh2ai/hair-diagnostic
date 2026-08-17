/**
 * Find what actually overflows horizontally, by measurement.
 *
 * A page-level `scrollWidth > clientWidth` says only that *something* is wider
 * than the viewport. Guessing which element it is — and "fixing" the wrong one,
 * or reaching for `overflow-x: hidden` — hides the defect instead of removing
 * it. So this walks every element, keeps the ones whose right edge crosses the
 * viewport, and reports the widest offenders with enough identity to find them
 * in source.
 *
 * Ancestors of an offender also appear wide, so the output is ordered by how
 * far each element sticks out and annotated with its depth: the true culprit is
 * usually the deepest element at the maximum overhang.
 *
 * Read-only. Diagnoses, changes nothing.
 *
 *   npx tsx scripts/qa-diagnose-overflow.ts [baseUrl]
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { extractSupabaseRef, STAGING_SUPABASE_REF } from "../packages/shared/env/databaseTarget";

const prisma = new PrismaClient();
const BASE = process.argv[2] ?? "http://localhost:4000";
const VIEWPORTS = [
  { w: 390, h: 844 },
  { w: 1024, h: 768 },
  { w: 1366, h: 768 },
  { w: 1440, h: 900 },
];

async function main(): Promise<void> {
  const ref = extractSupabaseRef(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (ref !== STAGING_SUPABASE_REF) throw new Error(`Refusing: expected staging, got ${ref}`);

  const a = await prisma.assessment.findFirst({
    where: { deletedAt: null, clinic: { slug: "drfact-mumbai-test" }, NOT: { rawResponses: { equals: null } } },
    orderBy: { submittedAt: "asc" },
    select: { id: true },
  });
  if (!a) throw new Error("No composable assessment in clinic A.");
  const url = `${BASE}/doctor/reports/${a.id}`;
  console.log(`[overflow] ${url}\n`);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const secret = process.env.DEV_LOGIN_SECRET;
  if (!secret) throw new Error("DEV_LOGIN_SECRET not set.");
  await ctx.request.post(`${BASE}/api/dev/login`, {
    headers: { "x-dev-login-secret": secret, "Content-Type": "application/json" },
    data: { email: "dr.test.a@drfact.staging" },
  });

  const page = await ctx.newPage();
  // Warm the route once so first-compile cost doesn't distort later loads.
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.waitForTimeout(15_000);

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.waitForTimeout(2500);

    // Passed as a STRING, not a function: tsx compiles with esbuild's
    // keepNames, which injects a `__name` helper into every function it
    // rewrites. That helper does not exist in the page, so a function form
    // dies with "__name is not defined" before measuring anything.
    const result = (await page.evaluate(`(function () {
      var docEl = document.documentElement;
      var vw = docEl.clientWidth;
      var offenders = [];
      var stack = [{ el: document.body, depth: 0 }];
      while (stack.length) {
        var cur = stack.pop();
        var el = cur.el;
        var r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > vw + 0.5) {
          offenders.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.getAttribute('class') || '').slice(0, 110),
            depth: cur.depth,
            right: Math.round(r.right),
            width: Math.round(r.width),
            overhang: Math.round(r.right - vw)
          });
        }
        for (var i = 0; i < el.children.length; i++) {
          stack.push({ el: el.children[i], depth: cur.depth + 1 });
        }
      }
      offenders.sort(function (x, y) { return (y.overhang - x.overhang) || (y.depth - x.depth); });
      return {
        vw: vw,
        scrollWidth: docEl.scrollWidth,
        clientWidth: docEl.clientWidth,
        overflow: docEl.scrollWidth > docEl.clientWidth,
        offenders: offenders.slice(0, 6)
      };
    })()`)) as {
      vw: number;
      scrollWidth: number;
      clientWidth: number;
      overflow: boolean;
      offenders: Array<{ tag: string; cls: string; depth: number; right: number; width: number; overhang: number }>;
    };

    console.log(
      `  ${vp.w}x${vp.h}  scrollWidth=${result.scrollWidth} clientWidth=${result.clientWidth} ` +
        `overflow=${result.overflow ? "YES" : "no"}`,
    );
    for (const o of result.offenders) {
      console.log(`      +${String(o.overhang).padStart(4)}px  d${o.depth}  <${o.tag}> w=${o.width}  ${o.cls}`);
    }
    if (result.offenders.length === 0) console.log("      (no element crosses the right edge)");
    console.log("");
  }

  await browser.close();
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());

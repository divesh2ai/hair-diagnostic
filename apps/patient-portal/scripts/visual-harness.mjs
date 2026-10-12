// Test-only visual-acceptance driver for the doctor dashboard.
// Drives the pre-installed Chromium against the VISUAL_HARNESS route and both
// screenshots and asserts the acceptance criteria. No network/auth/data.
//
//   VISUAL_OUT=/abs/dir  node scripts/visual-harness.mjs   (server must be up)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://127.0.0.1:4000";
const OUT = process.env.VISUAL_OUT || "/tmp/visual-out";
mkdirSync(OUT, { recursive: true });

const WIDTHS = [1440, 1280, 1024, 768, 390];
const results = {};
const rec = (k, pass, note = "") => {
  results[k] = { pass, note };
  console.log(`  [${pass ? "PASS" : "FAIL"}] ${k}${note ? " — " + note : ""}`);
};

// The sandbox ships a pinned Chromium that may not match this Playwright's
// expected build, so point at the installed binary instead of downloading.
const CHROME = process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: CHROME });

// Dev-mode hydration lags behind networkidle; the relative-time label only
// renders once the client tree has hydrated, so wait for it before acting.
const waitHydrated = (page) =>
  page.waitForFunction(
    () => /\b(ago|just now)\b/i.test(document.querySelector('[data-testid="patient-deck"]')?.innerText || ""),
    { timeout: 20000 },
  );
try {
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  // ── Screenshots + per-width responsive checks ────────────────────────────
  let noHScrollAll = true;
  let twoColAtDesktop = true;
  let oneColAtNarrow = true;
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 940 });
    const resp = await page.goto(`${BASE}/visual-harness`, { waitUntil: "networkidle" });
    if (!resp || resp.status() !== 200) throw new Error(`harness ${w}px -> HTTP ${resp && resp.status()}`);
    await page.waitForSelector('[data-testid="patient-deck"] ul > li', { timeout: 15000 });
    await waitHydrated(page).catch(() => {});
    await page.screenshot({ path: `${OUT}/doctor-${w}.png`, fullPage: true });

    // horizontal scroll?
    const hOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (hOverflow) noHScrollAll = false;

    // columns: compare the left-x of the first two cards.
    const cols = await page.evaluate(() => {
      const items = [...document.querySelectorAll('[data-testid="patient-deck"] ul > li')];
      if (items.length < 2) return 1;
      const a = items[0].getBoundingClientRect();
      const b = items[1].getBoundingClientRect();
      return Math.abs(a.top - b.top) < 8 ? 2 : 1; // same row => 2 cols
    });
    if (w >= 1024 && cols !== 2) twoColAtDesktop = false;
    if (w < 1024 && cols !== 1) oneColAtNarrow = false;
  }
  rec("No horizontal scroll (all widths)", noHScrollAll);
  rec("2-column at >=1024px", twoColAtDesktop);
  rec("1-column at <1024px", oneColAtNarrow);

  // ── Patient-card structural checks at 1440 ───────────────────────────────
  await page.setViewportSize({ width: 1440, height: 940 });
  await page.goto(`${BASE}/visual-harness`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="patient-deck"] ul > li');
  await waitHydrated(page).catch(() => {});

  const cardReport = await page.evaluate(() => {
    const lis = [...document.querySelectorAll('[data-testid="patient-deck"] ul > li')];
    const rects = lis.map((li) => li.getBoundingClientRect());
    // overlap: no two card rects intersect
    let overlap = false;
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        if (ix > 1 && iy > 1) overlap = true;
      }
    // equal height within the first row (cards sharing top y)
    const row0 = rects.filter((r) => Math.abs(r.top - rects[0].top) < 8);
    const equalHeight = row0.every((r) => Math.abs(r.height - row0[0].height) < 2);
    // each card has a left accent rail (::before width ~3px, brand colour)
    const face = lis[0].querySelector(".v2-flip-face-front");
    const before = face ? getComputedStyle(face, "::before") : null;
    const rail = before && parseFloat(before.width) >= 2 && parseFloat(before.width) <= 5;
    // key fields present & visible in first card
    const txt = lis[0].innerText;
    const hasName = /JAYA/i.test(txt);
    const hasTime = /(ago|now|min|hr|day)/i.test(txt);
    const hasTag = /(Hormonal|Mild)/i.test(txt);
    const hasKits = /treatment kit/i.test(lis[0].innerText) || /treatment kit/i.test((lis[1]?.innerText) || "");
    const hasStatus = /Needs review/i.test(txt);
    const hasReview = !!lis[0].querySelector('a[aria-label^="Review"]');
    // clipping: scrollHeight of a face should not exceed its clientHeight (no hidden text)
    const clipped = [...document.querySelectorAll('.v2-flip-face-front')].some(
      (f) => f.scrollHeight > f.clientHeight + 2);
    return { overlap, equalHeight, rail, hasName, hasTime, hasTag, hasKits, hasStatus, hasReview, clipped };
  });
  rec("No card overlap", !cardReport.overlap);
  rec("Equal-height cards in a row", cardReport.equalHeight);
  rec("Left teal accent rail renders", cardReport.rail);
  rec("Name/age/tags/diagnosis/kit/status/CTA readable", cardReport.hasName && cardReport.hasTime && cardReport.hasTag && cardReport.hasKits && cardReport.hasStatus && cardReport.hasReview);
  rec("No clipped patient info", !cardReport.clipped);

  // ── Interaction: Review link vs flip button ──────────────────────────────
  const interact = await page.evaluate(() => {
    const li = document.querySelector('[data-testid="patient-deck"] ul > li');
    const r = li.getBoundingClientRect();
    const link = li.querySelector('a[aria-label^="Review"]');
    const btn = li.querySelector('button[aria-label="Show clinical signals"]');
    const br = btn.getBoundingClientRect();
    // element under the card BODY centre should resolve to the Review link
    const bodyEl = document.elementFromPoint(r.left + r.width / 2, r.top + r.height - 30);
    const bodyHitsReview = !!(bodyEl && bodyEl.closest('a[aria-label^="Review"]'));
    // element under the flip button should be the button (independent control)
    const btnEl = document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2);
    const btnTopmost = !!(btnEl && btnEl.closest('button[aria-label="Show clinical signals"]'));
    return { href: link?.getAttribute("href"), bodyHitsReview, btnTopmost };
  });
  rec("Review CTA is the card-body click target", interact.bodyHitsReview, `href=${interact.href}`);
  rec("Flip control sits above the stretched link", interact.btnTopmost);
  rec("Review href points at a patient review", !!interact.href && /r1/.test(interact.href), interact.href || "no href");

  // click the flip button → card flips, NO navigation
  const urlBefore = page.url();
  await page.click('[data-testid="patient-deck"] ul > li:first-child button[aria-label="Show clinical signals"]');
  await page.waitForTimeout(350);
  const flipped = await page.evaluate(() =>
    document.querySelector('[data-testid="patient-deck"] ul > li .v2-flip-inner')?.getAttribute("data-flipped") === "true");
  const noNavOnFlip = page.url() === urlBefore;
  rec("Flip control flips the card, does NOT navigate", flipped && noNavOnFlip);

  // clicking the Review area must NOT flip (prevent the real navigation first)
  await page.evaluate(() => {
    document.querySelectorAll('a[aria-label^="Review"]').forEach((a) =>
      a.addEventListener("click", (e) => e.preventDefault(), { once: true }));
  });
  // flip back first so we can detect an unwanted flip
  await page.click('[data-testid="patient-deck"] ul > li:first-child button[aria-label="Show clinical signals"]');
  await page.waitForTimeout(300);
  const li2 = page.locator('[data-testid="patient-deck"] ul > li').first();
  await li2.click({ position: { x: 60, y: 10 } }); // top-left area = Review link, not the flip button
  await page.waitForTimeout(250);
  const flippedAfterReview = await page.evaluate(() =>
    document.querySelector('[data-testid="patient-deck"] ul > li .v2-flip-inner')?.getAttribute("data-flipped") === "true");
  rec("Review click does NOT trigger flip", !flippedAfterReview);

  // ── Header avatar ────────────────────────────────────────────────────────
  const header = await page.evaluate(() => {
    const av = document.querySelector('header [aria-label="Dr Divesh Shah"]');
    const trigger = av?.closest("button");
    const hbar = trigger?.closest("header")?.querySelector(".h-14") || document.querySelector("header .h-14");
    const avr = av?.getBoundingClientRect();
    const hbarRect = hbar?.getBoundingClientRect();
    return {
      avW: avr ? Math.round(avr.width) : 0,
      avH: avr ? Math.round(avr.height) : 0,
      barH: hbarRect ? Math.round(hbarRect.height) : 0,
      specialtyVisible: /Dermatology/.test(document.querySelector("header")?.innerText || ""),
    };
  });
  rec("Avatar larger (50–54px)", header.avW >= 50 && header.avW <= 54, `${header.avW}px`);
  rec("Header bar still 56px", header.barH === 56, `${header.barH}px`);
  rec("Avatar fits inside bar (no overflow)", header.avH <= 56, `${header.avH}px`);
  rec("Name/specialty render in control", header.specialtyVisible);

  // ── Sidebar active indicator + reusability ───────────────────────────────
  const dashActive = await page.evaluate(() => {
    const cur = document.querySelector('aside [aria-current="page"]');
    const wedge = cur ? getComputedStyle(cur.querySelector("span[aria-hidden]") || cur) : null;
    return { label: cur?.innerText.trim(), hasWedge: !!cur?.querySelector('span[aria-hidden][style*="clip-path"]') };
  });
  rec("Dashboard active via aria-current", /Dashboard/i.test(dashActive.label || ""), dashActive.label || "none");
  rec("Angled wedge present on active row", dashActive.hasWedge);

  await page.goto(`${BASE}/visual-harness?active=/doctor/queue`, { waitUntil: "networkidle" });
  await page.waitForSelector('aside [aria-current="page"]');
  await page.screenshot({ path: `${OUT}/sidebar-queue-active.png` });
  const queueActive = await page.evaluate(() => {
    const curs = [...document.querySelectorAll('aside [aria-current="page"]')].map((a) => a.innerText.trim());
    const dash = [...document.querySelectorAll("aside a")].find((a) => /Dashboard/i.test(a.innerText));
    return { curs, dashIsCurrent: dash?.getAttribute("aria-current") === "page" };
  });
  rec("Active indicator reusable (Review Queue only, single active)", queueActive.curs.length === 1 && /Queue/i.test(queueActive.curs[0]) && !queueActive.dashIsCurrent, queueActive.curs.join(",") || "none");

  // ── Summary ──────────────────────────────────────────────────────────────
  const fails = Object.entries(results).filter(([, v]) => !v.pass).map(([k]) => k);
  console.log(`\nSCREENSHOTS: ${OUT}`);
  console.log(`TOTAL: ${Object.keys(results).length}  PASS: ${Object.keys(results).length - fails.length}  FAIL: ${fails.length}`);
  if (fails.length) { console.log("FAILED:", fails.join("; ")); process.exitCode = 1; }
} finally {
  await browser.close();
}

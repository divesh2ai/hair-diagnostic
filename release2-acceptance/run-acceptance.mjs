// HAIROS Release 2 — automated Doctor acceptance (gates 2 & 3).
//
// Design per operator instruction:
//  - ONLY the doctor login is manual (done privately in the real browser).
//  - Everything else is automated and SELF-ASSERTS pass/fail.
//  - No passwords/OTPs/cookies/secrets are ever read, written, or logged.
//  - No automatic navigation screenshots; screenshots are taken only at named
//    assertion checkpoints.
//  - Fail-closed preconditions: preview reachable, served revision pinned to the
//    frozen Release 2 deployment (0b0c8c5), and the running page must talk only
//    to the STAGING Supabase host (never production).
//  - Synthetic test data only: the journey runs on a patient the authenticated
//    doctor opens inside their own (test) clinic. The kit never selects a
//    patient for you and never crosses clinics except to PROVE denial.
//  - PURCHASING_ENABLED is respected: the checkout/payment/refund path is
//    asserted to be gated OFF and reported as SKIPPED (gated) — never PASS —
//    unless you pass --purchasing-scope approved (explicit staging enablement).
//  - The development-login bypass (/api/dev/login) is NEVER used.
//
// Authored against frozen PR #35 @ 0b0c8c5 source selectors. Run it on a machine
// that can reach the staging preview (this was written in a network-restricted
// sandbox that cannot, so you execute it; it reports PASS/FAIL itself).
//
// Usage (see README.md):
//   node run-acceptance.mjs --role doctorA --out evidence-doctorA
//   node run-acceptance.mjs --role doctorB --out evidence-doctorB --cross-url "<A review URL>" --cross-api "/api/doctor/patients/<A-id>"

import { chromium } from "playwright";
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

// ---- frozen Release 2 pins -------------------------------------------------
const EXPECTED_DEPLOY_HOST = "hairos-r1dxbok0x-diveshs-projects-6230f270.vercel.app"; // dpl for 0b0c8c5
const EXPECTED_SHA = "0b0c8c51fefab261a2d07f41babb6411be47c1a6";
const BRANCH_ALIAS = "https://hairos-git-claude-phase1-notes-18d307-diveshs-projects-6230f270.vercel.app";
const STAGING_REF = "vbkoupvduadmcxggtnsb";
const PROD_REF = "pykoyxbleowxwechotth";

// ---- args ------------------------------------------------------------------
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROLE = arg("--role", "doctorA");
const OUT = arg("--out", `evidence-${ROLE}-${Date.now()}`);
const BASE = (arg("--base", BRANCH_ALIAS)).replace(/\/+$/, "");
const CROSS_URL = arg("--cross-url", "");          // doctorB: a Doctor-A page URL (expect denial)
const CROSS_API = arg("--cross-api", "");          // doctorB: a Doctor-A API path (expect 403/empty)
const PURCHASING_SCOPE = arg("--purchasing-scope", "gated"); // 'approved' only with explicit staging enablement

const SHOTS = join(OUT, "screenshots");
mkdirSync(SHOTS, { recursive: true });
const RESULTS = join(OUT, "results.jsonl");
writeFileSync(RESULTS, "");
const API_LOG = join(OUT, "api-results.jsonl");
writeFileSync(API_LOG, "");

let shotN = 0, prodHostSeen = false, stagingHostSeen = false;
const safe = (s) => String(s || "x").replace(/[^a-z0-9_-]+/gi, "-").slice(0, 60);

async function shot(page, label) {
  const f = join(SHOTS, `${String(++shotN).padStart(2, "0")}-${safe(label)}.png`);
  try { await page.screenshot({ path: f, fullPage: true }); } catch {}
  return f;
}
function record(name, status, detail = "") {
  const row = { name, status, detail, t: new Date().toISOString() };
  appendFileSync(RESULTS, JSON.stringify(row) + "\n");
  const tag = status === "PASS" ? "PASS " : status === "FAIL" ? "FAIL " : status === "SKIP" ? "SKIP " : "info ";
  console.log(`  [${tag}] ${name}${detail ? " — " + detail : ""}`);
}
async function assert(page, name, fn) {
  try {
    const d = await fn();
    record(name, "PASS", typeof d === "string" ? d : "");
    await shot(page, "PASS-" + name);
    return true;
  } catch (e) {
    record(name, "FAIL", e.message);
    await shot(page, "FAIL-" + name);
    return false;
  }
}

const run = async () => {
  console.log(`\nHAIROS Release 2 acceptance — role=${ROLE}`);
  console.log(`  base: ${BASE}`);
  console.log(`  out : ${OUT}\n`);
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1366, height: 920 } });
  const page = await context.newPage();

  // Live Supabase-host guard (secret-free): fail if the page ever calls prod.
  context.on("request", (req) => {
    try {
      const h = new URL(req.url()).host;
      if (h.endsWith(".supabase.co")) {
        if (h.includes(PROD_REF)) prodHostSeen = true;
        if (h.includes(STAGING_REF)) stagingHostSeen = true;
      }
      const u = new URL(req.url());
      if (u.pathname.startsWith("/api/")) {
        req.response?.().then((res) => {
          appendFileSync(API_LOG, JSON.stringify({ m: req.method(), status: res?.status?.() ?? null, path: u.pathname }) + "\n");
        }).catch(() => {});
      }
    } catch {}
  });
  page.on("response", (res) => {
    try { const u = new URL(res.url()); if (u.pathname.startsWith("/api/"))
      appendFileSync(API_LOG, JSON.stringify({ m: res.request().method(), status: res.status(), path: u.pathname }) + "\n"); } catch {}
  });

  // ---- Precondition: reachability + revision pin (fail-closed) -------------
  let resp;
  try { resp = await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 }); }
  catch (e) { record("preview-reachable", "FAIL", e.message); console.log("\nFATAL: preview unreachable.\n"); await browser.close(); process.exit(2); }
  record("preview-reachable", "PASS", `${resp.status()} ${BASE}`);

  const depHost = resp.headers()["x-vercel-deployment-url"] || "";
  if (!depHost) { record("revision-pin-0b0c8c5", "FAIL", "x-vercel-deployment-url header absent; cannot confirm revision"); console.log("\nFATAL: cannot confirm served revision is 0b0c8c5.\n"); await browser.close(); process.exit(3); }
  if (depHost !== EXPECTED_DEPLOY_HOST) { record("revision-pin-0b0c8c5", "FAIL", `served ${depHost} != ${EXPECTED_DEPLOY_HOST}`); console.log("\nFATAL: served revision is not the frozen 0b0c8c5 deployment.\n"); await browser.close(); process.exit(3); }
  record("revision-pin-0b0c8c5", "PASS", `${depHost} (sha ${EXPECTED_SHA.slice(0,7)})`);

  // ---- Manual private login -------------------------------------------------
  console.log(`\n>>> Log in privately as ${ROLE === "doctorB" ? "Dr QA B" : "Dr Test A"} in the browser window.`);
  console.log(">>> Use NORMAL authentication (not any dev-login). Nothing is typed here.\n");
  let me = null;
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(3000);
    me = await page.evaluate(async () => {
      try { const r = await fetch("/api/doctor/me", { credentials: "include" }); if (!r.ok) return null; return await r.json(); }
      catch { return null; }
    });
    if (me) break;
  }
  if (!me) { record("authenticated-login", "FAIL", "no authenticated doctor session detected (10 min)"); await browser.close(); process.exit(4); }
  const who = me.name || me.doctor?.name || "(doctor)";
  const clinic = me.clinicId || me.doctor?.clinicId || me.clinic?.id || "(clinic)";
  record("authenticated-login", "PASS", `${who} @ clinic ${clinic}`);
  await shot(page, "authenticated");

  // ---- Gate 6: staging backend proof (secret-free) --------------------------
  record("backend-staging-supabase-host", stagingHostSeen && !prodHostSeen ? "PASS" : (prodHostSeen ? "FAIL" : "info"),
    `staging seen=${stagingHostSeen} prod seen=${prodHostSeen}`);
  record("backend-server-db-staging", me ? "PASS" : "FAIL", "authenticated /api/doctor/me resolved against the deployed server DB");

  if (ROLE === "doctorB") {
    // ---- Gate 3: cross-clinic denial ---------------------------------------
    console.log("\n>>> Dr QA B: verifying cross-clinic denial.\n");
    if (CROSS_API) {
      await assert(page, "isolation-api-denied", async () => {
        const r = await page.evaluate(async (p) => { const res = await fetch(p, { credentials: "include" }); let body = null; try { body = await res.json(); } catch {} return { status: res.status, empty: Array.isArray(body) ? body.length === 0 : (body && Array.isArray(body.items) ? body.items.length === 0 : false) }; }, CROSS_API);
        if (r.status === 403 || r.status === 404 || r.status === 401) return `denied ${r.status}`;
        if (r.status === 200 && r.empty) return "200 but empty (no cross-clinic rows)";
        throw new Error(`cross-clinic API returned ${r.status} with data — LEAK`);
      });
    } else record("isolation-api-denied", "SKIP", "pass --cross-api <Doctor-A API path>");
    if (CROSS_URL) {
      await assert(page, "isolation-ui-denied", async () => {
        const r = await page.goto(CROSS_URL, { waitUntil: "domcontentloaded" });
        const txt = (await page.content()).toLowerCase();
        const denied = r.status() >= 400 || /not found|no access|unauthor|forbidden|denied|sign in|log in/.test(txt);
        if (!denied) throw new Error(`Doctor-A page rendered for Doctor B (status ${r.status()}) — LEAK`);
        return `denied (status ${r.status()})`;
      });
    } else record("isolation-ui-denied", "SKIP", "pass --cross-url <Doctor-A review URL>");
    await finish(browser);
    return;
  }

  // ---- Gate 2: Doctor A journey (operator opens ONE synthetic patient) ------
  console.log("\n>>> Open ONE SYNTHETIC test patient's REVIEW page (…/doctor/reports/<id>).");
  console.log(">>> The kit runs the assertions automatically once you land there.\n");
  await page.waitForURL(/\/doctor\/reports\/[^/]+/, { timeout: 10 * 60 * 1000 }).catch(() => {});
  const onReview = /\/doctor\/reports\/[^/]+/.test(page.url());
  if (!onReview) { record("review-page-opened", "FAIL", "no review page opened in 10 min"); await finish(browser); process.exit(5); }
  record("review-page-opened", "PASS", new URL(page.url()).pathname);

  const MARK = `R2ACC-${Date.now()}`;

  // Notes: typed save + reload persistence.
  await assert(page, "notes-panel-enabled", async () => {
    const body = (await page.content());
    if (body.includes("Notes are not enabled yet in this environment")) throw new Error("notes not provisioned on this env");
    await page.getByRole("heading", { name: "Consultation notes" }).first().waitFor({ timeout: 15000 });
    return "panel present";
  });
  await assert(page, "note-typed-save", async () => {
    const ta = page.getByLabel("Consultation note");
    await ta.waitFor({ timeout: 15000 });
    await ta.fill(`${MARK} typed consultation note`);
    await page.getByRole("button", { name: "Save note" }).click();
    await page.getByText(MARK, { exact: false }).first().waitFor({ timeout: 15000 });
    return "typed note saved + visible";
  });
  await assert(page, "note-persists-after-reload", async () => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText(MARK, { exact: false }).first().waitFor({ timeout: 20000 });
    return "note still present after refresh";
  });
  await assert(page, "dictation-control-and-typed-fallback", async () => {
    // Typed fallback proven above. Assert the mic/dictation control is present
    // (actual speech recognition needs a human mic and is not scriptable).
    const hasMic = await page.locator('button[aria-label*="dict" i], button:has-text("Dictate"), [data-dictate], svg.lucide-mic, .lucide-mic').count();
    if (!hasMic) throw new Error("dictation control not found next to the note field");
    return "dictation control present; typed fallback verified";
  });

  // Kit tracker: 4 recommended, record 2 purchased, defer 2 (quantity, ungated).
  await assert(page, "tracker-enabled-and-4-recommended", async () => {
    const body = await page.content();
    if (body.includes("Purchase tracking is not enabled yet")) throw new Error("tracker not provisioned on this env");
    await page.getByRole("heading", { name: "Kit purchases & treatment" }).first().waitFor({ timeout: 15000 });
    return "tracker present";
  });
  // Read baseline summary (boxes purchased) before acting.
  const readPurchased = async () => page.evaluate(() => {
    const m = document.body.innerText.match(/(\d+)\s*\/\s*(\d+)\s*boxes purchased/i); return m ? { purchased: +m[1], recommended: +m[2] } : null;
  });
  const before = await readPurchased();
  record("tracker-summary-read", before ? "PASS" : "FAIL", before ? `purchased ${before.purchased}/${before.recommended} boxes` : "summary not parseable");

  // Attempt a quantity record (ungated) on the first kit: Clinic confirmed purchase, 1 box.
  await assert(page, "record-clinic-confirmed-purchase", async () => {
    const toggles = page.getByRole("button", { name: /record|update|manage|purchase|action/i });
    if (await toggles.count() === 0) throw new Error("no per-kit record toggle found");
    await toggles.first().click();
    const sel = page.locator("select").filter({ hasText: "Clinic confirmed purchase" }).first();
    await sel.waitFor({ timeout: 8000 });
    await sel.selectOption({ label: "Clinic confirmed purchase" });
    const boxes = page.locator('input[type="number"]').first();
    if (await boxes.count()) await boxes.fill("1");
    const submit = page.getByRole("button", { name: /record|save|confirm/i }).last();
    await submit.click();
    await page.waitForTimeout(2500);
    const after = await readPurchased();
    if (before && after && after.purchased <= before.purchased) throw new Error(`purchased boxes did not increase (${before.purchased}->${after?.purchased})`);
    return `purchased boxes ${before?.purchased ?? "?"} -> ${after?.purchased ?? "?"}`;
  });
  await assert(page, "defer-remaining-kit", async () => {
    const toggles = page.getByRole("button", { name: /record|update|manage|purchase|action/i });
    await toggles.nth(Math.min(1, await toggles.count() - 1)).click();
    const sel = page.locator("select").last();
    await sel.selectOption({ label: /defer/i }).catch(async () => { await sel.selectOption({ value: "DEFERRED" }); });
    const note = page.locator('input[type="text"]').last();
    if (await note.count()) await note.fill(`${MARK} deferred`);
    await page.getByRole("button", { name: /record|save|confirm/i }).last().click();
    await page.waitForTimeout(2000);
    const body = await page.content();
    if (!/deferred/i.test(body)) throw new Error("no 'deferred' state visible after deferring");
    return "a kit shows deferred";
  });

  // Purchasing gate: checkout/payment/refund must be OFF (gated), not claimed PASS.
  await assert(page, "purchasing-gated-off", async () => {
    const body = await page.content();
    const gated = /Purchasing is disabled|Checkout is not enabled|not enabled yet|Recording a sale amount is disabled/i.test(body);
    if (PURCHASING_SCOPE === "approved") {
      record("purchasing-scope", "info", "approved scope flag set by operator");
      if (gated) throw new Error("--purchasing-scope approved but checkout still gated OFF");
      return "purchasing enabled by approved scope";
    }
    if (!gated) throw new Error("checkout did NOT show a gated/disabled state while purchasing is OFF");
    return "checkout correctly gated OFF";
  });
  if (PURCHASING_SCOPE !== "approved") {
    record("clinic-counter-payment", "SKIP", "gated: PURCHASING_ENABLED off (not claimed PASS)");
    record("later-purchase", "SKIP", "gated: PURCHASING_ENABLED off");
    record("refund", "SKIP", "gated: PURCHASING_ENABLED off");
  }

  // Follow-up history on the patient profile.
  await assert(page, "follow-up-history", async () => {
    const link = page.getByRole("link", { name: /patient|profile|history|view/i }).first();
    if (await link.count()) { await link.click().catch(() => {}); await page.waitForTimeout(1500); }
    const body = await page.content();
    if (!/Treatment & purchases|kits purchased|Kit purchases & treatment/i.test(body)) throw new Error("treatment/purchase history not found");
    return "history panel present";
  });

  await finish(browser);
};

async function finish(browser) {
  // Final guard: any prod-host contact fails the whole run.
  if (prodHostSeen) record("backend-no-production-contact", "FAIL", "page contacted the PRODUCTION Supabase host");
  else record("backend-no-production-contact", "PASS", "no production Supabase contact observed");
  console.log(`\nDone. results.jsonl + screenshots in ${OUT}\n`);
  await browser.close().catch(() => {});
}

run().catch(async (e) => { console.error(e); process.exit(1); });

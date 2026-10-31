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
//    asserted to be gated OFF. The money-path steps are NOT automated here and
//    are reported MANUAL — never PASS. (No --purchasing-scope bypass.)
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

// Expected authenticated identities — must resolve via the deployed /api/doctor/me.
const IDENTITY = {
  doctorA: { id: "cmsuip6ue0006u6hzrn4iiwr3", slug: "drfact-mumbai-test", label: "Dr Test A" },
  doctorB: { id: "cmsv8xwwc00016a4k4oxcpqhn", slug: "drfact-pune-test", label: "Dr QA B" },
};

// ---- args ------------------------------------------------------------------
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROLE = arg("--role", "doctorA");
const OUT = arg("--out", `evidence-${ROLE}-${Date.now()}`);
const BASE = (arg("--base", BRANCH_ALIAS)).replace(/\/+$/, "");
const CROSS_URL = arg("--cross-url", "");          // doctorB: a Doctor-A page URL (expect denial)
const CROSS_API = arg("--cross-api", "");          // doctorB: a Doctor-A API path (expect 403/empty)

const SHOTS = join(OUT, "screenshots");
mkdirSync(SHOTS, { recursive: true });
const RESULTS = join(OUT, "results.jsonl");
writeFileSync(RESULTS, "");
const API_LOG = join(OUT, "api-results.jsonl");
writeFileSync(API_LOG, "");

let shotN = 0, prodHostSeen = false, stagingHostSeen = false, hadFail = false;
const safe = (s) => String(s || "x").replace(/[^a-z0-9_-]+/gi, "-").slice(0, 60);
// Next.js buildId from page HTML — a revision fingerprint independent of headers.
const buildIdOf = (html) => {
  const m = String(html).match(/"buildId"\s*:\s*"([^"]+)"/)
    || String(html).match(/\/_next\/static\/([^/"]+)\/_(?:buildManifest|ssgManifest)/);
  return m ? m[1] : null;
};

async function shot(page, label) {
  const f = join(SHOTS, `${String(++shotN).padStart(2, "0")}-${safe(label)}.png`);
  try { await page.screenshot({ path: f, fullPage: true }); } catch {}
  return f;
}
function record(name, status, detail = "") {
  if (status === "FAIL") hadFail = true;            // any mandatory FAIL -> nonzero exit
  const row = { name, status, detail, t: new Date().toISOString() };
  appendFileSync(RESULTS, JSON.stringify(row) + "\n");
  // SKIP and MANUAL are never counted as PASS.
  const tag = { PASS: "PASS ", FAIL: "FAIL ", SKIP: "SKIP ", MANUAL: "MANL " }[status] || "info ";
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

  // Revision pin — two independent checks; never rely solely on the header.
  const depHost = resp.headers()["x-vercel-deployment-url"] || "";
  const headerOk = depHost === EXPECTED_DEPLOY_HOST;
  if (depHost && !headerOk) { record("revision-pin-header", "FAIL", `served ${depHost} != ${EXPECTED_DEPLOY_HOST}`); console.log("\nFATAL: served revision is not the frozen 0b0c8c5 deployment.\n"); await browser.close(); process.exit(3); }
  record("revision-pin-header", headerOk ? "PASS" : "info", headerOk ? depHost : "x-vercel-deployment-url absent; using buildId pin");
  // Independent buildId fingerprint: BASE must serve the same Next build as the
  // immutable 0b0c8c5 deployment URL (fetched server-side, no CORS).
  let baseBuild = null, pinBuild = null;
  try { baseBuild = buildIdOf(await resp.text()); } catch {}
  try { const r = await context.request.get(`https://${EXPECTED_DEPLOY_HOST}/login`, { timeout: 30000 }); if (r.ok()) pinBuild = buildIdOf(await r.text()); } catch {}
  if (baseBuild && pinBuild) {
    if (baseBuild !== pinBuild) { record("revision-pin-buildid", "FAIL", `base build ${baseBuild} != 0b0c8c5 build ${pinBuild}`); console.log("\nFATAL: base does not serve the 0b0c8c5 build.\n"); await browser.close(); process.exit(3); }
    record("revision-pin-buildid", "PASS", `buildId ${baseBuild} == 0b0c8c5 deployment`);
  } else if (headerOk) {
    record("revision-pin-buildid", "info", "buildId unavailable; header pin confirmed");
  } else {
    record("revision-pin-0b0c8c5", "FAIL", "cannot confirm revision by header or buildId"); console.log("\nFATAL: cannot confirm served revision is 0b0c8c5.\n"); await browser.close(); process.exit(3);
  }

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
  const exp = IDENTITY[ROLE] || IDENTITY.doctorA;
  const gotId = me?.doctor?.id ?? null;        // from the actual /api/doctor/me shape
  const gotSlug = me?.clinic?.slug ?? null;
  const gotName = me?.doctor?.name ?? "(doctor)";
  await shot(page, "authenticated");
  if (gotId === exp.id && gotSlug === exp.slug) {
    record("identity-matches-staging", "PASS", `${gotName} · doctor.id=${gotId} · clinic.slug=${gotSlug}`);
  } else {
    record("identity-matches-staging", "FAIL", `expected id=${exp.id} slug=${exp.slug}; got id=${gotId} slug=${gotSlug}`);
    console.log("\nFATAL: authenticated identity does not match the expected staging doctor/clinic.\n");
    await finish(browser);
    return;
  }

  // ---- Gate 6: staging backend proof (secret-free) --------------------------
  record("backend-staging-supabase-host", stagingHostSeen && !prodHostSeen ? "PASS" : (prodHostSeen ? "FAIL" : "info"),
    `staging seen=${stagingHostSeen} prod seen=${prodHostSeen}`);
  record("backend-server-db-staging", gotSlug === exp.slug ? "PASS" : "FAIL", `server /api/doctor/me resolved clinic.slug=${gotSlug} against the deployed DB`);

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
  await assert(page, "dictation-control-present", async () => {
    const hasMic = await page.locator('button[aria-label*="dict" i], button:has-text("Dictate"), [data-dictate], svg.lucide-mic, .lucide-mic').count();
    if (!hasMic) throw new Error("dictation control not found next to the note field");
    return "mic/dictation control present; typed fallback already verified";
  });
  record("speech-recognition-human-check", "MANUAL", "genuine microphone speech recognition is not scriptable — requires a human mic test; attach a short clip/screenshot");

  // Kit tracker: EXACTLY 4 recommended; record 2 purchases + 2 deferrals (quantity/clinical, ungated); assert remaining.
  const readSummary = async () => page.evaluate(() => {
    const t = document.body.innerText;
    const kp = t.match(/(\d+)\s*\/\s*(\d+)\s*kits purchased/i);
    const bx = t.match(/(\d+)\s*\/\s*(\d+)\s*boxes purchased/i);
    const rd = t.match(/(\d+)\s*remaining\s*·\s*(\d+)\s*deferred\s*·\s*(\d+)\s*declined/i);
    return {
      purchasedKits: kp ? +kp[1] : null, recommendedKits: kp ? +kp[2] : null,
      purchasedBoxes: bx ? +bx[1] : null, recommendedBoxes: bx ? +bx[2] : null,
      remainingKits: rd ? +rd[1] : null, deferredKits: rd ? +rd[2] : null, declinedKits: rd ? +rd[3] : null,
    };
  });
  // Per-kit action helper (row-scoped so it is selector-robust): open the Nth
  // kit row's form, choose eventType by VALUE, set boxes, submit.
  const kitRow = (idx) => page.locator("li", { hasText: "catalog" }).nth(idx);
  const act = async (idx, value, boxes, reason) => {
    const row = kitRow(idx);
    await row.waitFor({ timeout: 10000 });
    await row.getByRole("button").first().click();
    const sel = row.locator("select").first();
    await sel.waitFor({ timeout: 8000 });
    await sel.selectOption({ value });
    if (boxes != null) { const b = row.locator('input[type="number"]').first(); if (await b.count()) await b.fill(String(boxes)); }
    if (reason != null) { const n = row.locator('input[type="text"]').last(); if (await n.count()) await n.fill(reason); }
    await row.getByRole("button").last().click();
    await page.waitForTimeout(2000);
  };
  await assert(page, "tracker-enabled", async () => {
    const body = await page.content();
    if (body.includes("Purchase tracking is not enabled yet")) throw new Error("tracker not provisioned on this env");
    await page.getByRole("heading", { name: "Kit purchases & treatment" }).first().waitFor({ timeout: 15000 });
    return "tracker present";
  });
  await assert(page, "exactly-4-recommended-kits", async () => {
    const s = await readSummary();
    const rows = await page.locator("li", { hasText: "catalog" }).count();
    if (s.recommendedKits !== 4) throw new Error(`summary recommendedKits=${s.recommendedKits} (need exactly 4 — open a synthetic 4-kit approved plan)`);
    if (rows !== 4) throw new Error(`found ${rows} kit rows (need 4)`);
    return `recommendedKits=4, rows=4`;
  });
  await assert(page, "record-two-purchases", async () => {
    await act(0, "PURCHASE_CONFIRMED_BY_CLINIC", 1, null);
    await act(1, "PURCHASE_CONFIRMED_BY_CLINIC", 1, null);
    const s = await readSummary();
    if (s.purchasedKits !== 2) throw new Error(`purchasedKits=${s.purchasedKits} after 2 purchases (need 2)`);
    return `purchasedKits=2 · boxes=${s.purchasedBoxes}/${s.recommendedBoxes}`;
  });
  await assert(page, "record-two-deferrals", async () => {
    await act(2, "DEFERRED", null, `${MARK} deferred`);
    await act(3, "DEFERRED", null, `${MARK} deferred`);
    const s = await readSummary();
    if (s.deferredKits !== 2) throw new Error(`deferredKits=${s.deferredKits} after 2 deferrals (need 2)`);
    return `deferredKits=2`;
  });
  await assert(page, "remaining-quantities-correct", async () => {
    const s = await readSummary();
    if (s.purchasedKits !== 2 || s.deferredKits !== 2 || s.remainingKits !== 0)
      throw new Error(`purchased=${s.purchasedKits} deferred=${s.deferredKits} remaining=${s.remainingKits} (need 2 / 2 / 0 of 4)`);
    return `4 recommended → 2 purchased, 2 deferred, 0 remaining`;
  });

  // Purchasing gate: checkout/payment/refund must be OFF. Money-path steps are
  // NOT automated by this kit; they are reported MANUAL, never PASS.
  await assert(page, "purchasing-gated-off", async () => {
    const body = await page.content();
    const gated = /Purchasing is disabled|Checkout is not enabled|not enabled yet|Recording a sale amount is disabled/i.test(body);
    if (!gated) throw new Error("checkout did NOT show a gated/disabled state while purchasing is OFF");
    return "checkout correctly gated OFF";
  });
  record("clinic-counter-payment", "MANUAL", "money path not automated here; needs approved staging purchasing + human check");
  record("later-purchase", "MANUAL", "money path not automated here");
  record("refund", "MANUAL", "money path not automated here");

  // Follow-up: navigate to the ACTUAL patient profile and assert note + history there.
  await assert(page, "open-patient-profile", async () => {
    let href = await page.evaluate(() => { const a = document.querySelector('a[href*="/doctor/patients/"]'); return a ? a.getAttribute("href") : null; });
    if (!href) {
      const pid = await page.evaluate(async () => {
        try { const r = await fetch(location.pathname.replace("/doctor/reports/", "/api/doctor/journey/"), { credentials: "include" }); const j = await r.json(); return j?.patientId || j?.patient?.id || null; } catch { return null; }
      });
      if (pid) href = `/doctor/patients/${pid}`;
    }
    if (!href) throw new Error("could not resolve the patient profile link from the review page");
    await page.goto(new URL(href, page.url()).toString(), { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/doctor\/patients\/[^/]+/, { timeout: 15000 });
    return new URL(page.url()).pathname;
  });
  await assert(page, "profile-shows-saved-note", async () => {
    await page.getByText(MARK, { exact: false }).first().waitFor({ timeout: 20000 });
    return "saved note visible on the patient profile";
  });
  await assert(page, "profile-shows-kit-history", async () => {
    const body = await page.content();
    if (!/Treatment & purchases|kits purchased/i.test(body)) throw new Error("kit/treatment history not found on profile");
    return "treatment & purchase history present on profile";
  });

  await finish(browser);
};

async function finish(browser) {
  // Final guard: any prod-host contact fails the whole run.
  if (prodHostSeen) record("backend-no-production-contact", "FAIL", "page contacted the PRODUCTION Supabase host");
  else record("backend-no-production-contact", "PASS", "no production Supabase contact observed");
  await browser.close().catch(() => {});
  console.log(`\nDone. results.jsonl + screenshots in ${OUT}`);
  console.log(hadFail ? "RESULT: FAIL — one or more mandatory checks failed (exit 1)\n" : "RESULT: PASS — no mandatory failures; MANUAL/SKIP items noted (exit 0)\n");
  process.exit(hadFail ? 1 : 0);   // mandatory FAIL => nonzero; SKIP/MANUAL never count as PASS
}

run().catch(async (e) => { console.error(e); process.exit(1); });

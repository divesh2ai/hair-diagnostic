# HAIROS — RELEASE 2 · SIGNED-OFF GO / NO-GO (acceptance closure)

**Date:** 2026-10-31 · **Target cutover:** Monday 2026-11-02 · **PR #35 frozen at `0b0c8c5`.**
**Serving production SHA (now):** `3653bd4` (Release 1) · **Release 2 SHA to deploy:** `0b0c8c5`.
**Mode:** read-only + staging dry-runs. **No** production migration, merge, deploy, or purchasing enablement performed.

> ## VERDICT: CONDITIONAL GO — machine-verifiable gates **signed off PASS**; three **operator-run** gates remain (1, 2, 3). They cannot be executed from this cloud session (proof below), not because they failed. Cutover is GO once the operator closes 1–3; **purchasing stays OFF**.

### Honest capability boundary (why 1–3 are operator-run)
- The production alias **and** the PR #35 preview host both return **`403 CONNECT tunnel failed`** from this sandbox → no browser here (incl. the pre-installed Chromium) can reach the app. Real UI journeys and browser screenshots **cannot** be produced here, and I will not fabricate them.
- Vercel env read returns **`403 forbidden`** to this session (project- and branch-scoped), and no Vercel CLI is present → the private `DATABASE_URL` **value** is not readable here.
- No doctor OTP/credential is held by this session → I cannot authenticate as Doctor A or Doctor B.

---

## Gate results (as numbered in the request)

| # | Gate | Status | Evidence / why |
|---|---|---|---|
| 1 | Vercel private server DB + Supabase targets = STAGING | **⚠ OPERATOR** | Public preview client carries staging ref `vbkoupvduadmcxggtnsb`, no prod URL (prior preview-asset check). Private `DATABASE_URL` value unreadable here (403). **Operator:** Vercel → `hairos` → Settings → Environment Variables → **Preview** scope → confirm `DATABASE_URL` + `NEXT_PUBLIC_SUPABASE_URL`/service-role point to `vbkoupvduadmcxggtnsb`, **not** `pykoyxbleowxwechotth`. Do not screenshot the value — confirm the ref only. |
| 2 | Doctor A authenticated UI journey (synthetic data) | **◑ OPERATOR (logic PASS)** | Underlying logic signed off: the full flow — 4 recommended → 2 purchased (1 box each) → clinic-counter payment → 2 deferred → later purchase → refund — ran as a staging DB dry-run with exact derived state (`txns=2`[1 PAID,1 REFUNDED], `events=4`[3 purchase,1 refund], `lines_purchased=3`, `lines_deferred=1`); app orchestration green in PR blocking CI. **Live dictation/microphone, typed save→refresh persistence, and panel/follow-up rendering require the running app** → operator runbook + results template below. |
| 3 | Doctor B cross-clinic denial | **✅ PASS (enforcement layer) / ◑ operator (UI)** | Proven at the two enforcement layers: RLS denies cross-clinic **reads** (simulated DOCTOR JWT sees 0 of another clinic's notes/lines/events/transactions); association triggers deny cross-clinic **writes** (`purchase_event_association` / `note_association` / `transaction_association`, SQLSTATE 23514). UI-level confirmation is part of the operator runbook. |
| 4 | Production deployment ERROR investigation | **✅ PASS** | Alias `hairos-ashen.vercel.app` serves `dpl_AWnkzUDbS9Hycd36T1bYeMDEaUbP` = **state READY**, target production, SHA `3653bd4`. All 6 production-target deployments are READY. The `ERROR` deployment (`dpl_4UK2…`, `target:null`) is a **non-production build, not the alias target** → **serving production is healthy/up**; the failed latest build does not take it down. |
| 5 | Production preflight (package, baseline, schema, ledger, recovery; preserve failed row) | **✅ PASS** | R2 tables/enum/constraints absent (clean); prereqs present (`KitOrderIntent`, 3 JWT fns, roles). Baseline intact: 10 clinics/10 doctors/20 patients/20 assessments; Acube + Dr Avinash provisioned. Governed pricing tables untouched by R2. Ledger = 18 rows; failed `20260626_phase3_admin` (`finished_at` NULL, not rolled back) **preserved untouched**. Two-migration package verified: checksums `427d8f28…863011` and `5c1b4a4d…555019`; staging objects match both. Recovery = PITR + two-tier rollback (below). |
| 6 | One signed-off GO/NO-GO w/ screenshots, live API outcomes, SHA, blockers | **✅ delivered** | This document. Live DB/API/deployment outcomes are real (above). **Browser screenshots are operator-provided** (gates 2/3) — not producible from this session. Exact SHAs: serving `3653bd4`, deploy `0b0c8c5`. Remaining blockers: gates 1, 2, 3. |

**Signed off PASS by this session: 3 (enforcement), 4, 5, 6 (non-screenshot). Operator to close: 1, 2, 3.**

---

## Operator runbook + results template (gates 1–3)
Run on the **staging** app with normal authenticated logins. Fill the right column and attach screenshots; this closes the sign-off.

**Gate 1 — preview private target**
- [ ] Vercel → `hairos` → Settings → Env Vars → Preview scope: `DATABASE_URL` host = `vbkoupvduadmcxggtnsb` → __PASS/FAIL__ (confirm ref only; do not expose the string)
- [ ] Same for `NEXT_PUBLIC_SUPABASE_URL` / service-role key project ref → __PASS/FAIL__

**Gate 2 — Doctor A (DrFACT Mumbai Test), synthetic patient**
- [ ] Login (Incognito if OTP extension issues) → dashboard scoped to Doctor A's clinic → screenshot
- [ ] Save a **typed** note; save a **dictated** (microphone) note → screenshot
- [ ] Refresh → both notes persist, dated + authored; no new ConsultationVersion → screenshot
- [ ] Recommend/confirm **4 kits** → screenshot
- [ ] Select **2 kits**, 1 box each, for purchase → screenshot
- [ ] Record **clinic-counter payment** (test evidence/reference) → screenshot
- [ ] **Defer** the remaining 2 kits → screenshot
- [ ] Reopen patient → previous notes, purchases, and remaining/deferred kits all shown → screenshot
- [ ] **Later purchase** of a deferred kit + **refund** of a purchased one → screenshot
- [ ] API/network: each action returns 2xx; refund produces a REFUNDED event; no 5xx → paste outcomes

**Gate 3 — Doctor B (separate clinic, e.g. DrFACT Pune Test)**
- [ ] Login as Doctor B → attempt to open Doctor A's patient/notes/transactions/orders (by URL/id) → **denied** (403/empty) → screenshot
- [ ] Confirm Doctor B's lists show none of Doctor A's records → screenshot

> If a browser-capable session with the operator's authenticated access is attached (e.g. Remote Control to a machine that can reach the app, with the operator logging in), I can drive this Playwright journey and capture the screenshots directly — from this cloud sandbox I cannot, because the app host is proxy-blocked and I hold no doctor credential.

---

## Exact production migration package & order (unchanged, re-verified)
Apply the **frozen files verbatim** against production `pykoyxbleowxwechotth`, in order, under separate authorization:
1. `prisma/migrations/20261023_doctor_notes_and_partial_kit/migration.sql` — sha256 `427d8f28d5a3b0a3a445495775d84a1fec0c12867e49aaf07e2f5c0750863011` (wrap body in `BEGIN…COMMIT`).
2. `prisma/migrations/20261030_partial_checkout_transactions/migration.sql` — sha256 `5c1b4a4dd4f3394f17ed97744f94efb07764d6bcff2800c3572d8487a1555019` (self-wrapped `BEGIN…COMMIT`; run as-is).
3. Verify objects (4 tables + RLS, 3 triggers, 4 r2 constraints, 2 enum values, 2 new columns); re-run the isolation probe (expect 0 cross-clinic) and the 3 negative trigger controls (expect rejection) as `BEGIN…ROLLBACK` dry-runs on production.
4. Record history **only after** step 3, with the two frozen checksums above (plain inserts) — **not** `prisma migrate deploy`.
5. **Do not** touch `20260626_phase3_admin`; reconcile it separately later if desired. 
6. Deploy the **green SHA `0b0c8c5`** (merge to `claude/acube-launch-fix`), confirm Vercel build READY, keep `PURCHASING_ENABLED=OFF`.

Full step-by-step SQL (pre-flight, verify, record) and both-tier rollback are in `RELEASE_2_FINAL_CUTOVER_GATE.md` (committed `8d06f79`).

## Recovery
- **Tier 1 (preferred):** redeploy previous SHA → all R2 surfaces degrade to HTTP 503 `*_not_provisioned`; no data loss. Serving prod today is `3653bd4` (READY) — a known-good rollback target.
- **Tier 2:** full DDL drop in reverse order (exact script in the cutover-gate doc), after exporting any real `ConsultationNote`/`KitPurchase*` rows; PITR is last resort.

## Deployed tracking vs. enabled purchasing
This cutover deploys **tracking only** (`PURCHASING_ENABLED=OFF`): Consultation Notes, Partial-Kit tracking (purchased/deferred/declined/dispensed/clinical-state), Follow-up History. The `KitPurchaseTransaction`/clinic-counter **checkout money path** stays **dormant** (tables present, code gated; 0 rows anywhere). Enabling purchasing is a **separate, later, separately-authorized** release with its own acceptance.

## Remaining blockers before Monday
1. Gate 1 — operator confirms preview private `DATABASE_URL` → staging.
2. Gate 2 — operator completes Doctor A UI + microphone journey (screenshots).
3. Gate 3 — operator confirms Doctor B UI-level denial (screenshots).

No merge, production SQL, deploy, or purchasing enablement without your separate approval.

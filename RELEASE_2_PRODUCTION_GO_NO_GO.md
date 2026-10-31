# HAIROS — RELEASE 2 · PRODUCTION GO / NO-GO REPORT

**Date:** 2026-10-31 · **Mode:** Production release preparation — read-only. No production writes, no migration, no merge, no deploy, no purchasing enablement performed.
**Target first clinic:** Acube Aesthetics · **Features:** Doctor Consultation Notes, Partial Kit Purchase tracking, Follow-up / Treatment History.
**PR:** divesh2ai/hair-diagnostic#35 · **head `0b0c8c5`** · base `claude/acube-launch-fix` (`3653bd4`).

> **VERDICT: CONDITIONAL GO** — the schema change and app are production-safe (additive, all prerequisites present in prod, cross-clinic isolation proven, existing records untouched, purchasing stays OFF). Two conditions must close first: **(G1)** one authenticated staging acceptance of the three doctor-facing features via Dr Test A (script in §2 — cannot be driven from this sandbox); **(G2)** the money/checkout path (`KitPurchaseTransaction`) remains behind `PURCHASING_ENABLED=off` in production until separately accepted — it has never been exercised at runtime. See §8.

---

## Evidence basis
Read-only SQL against Supabase **production `pykoyxbleowxwechotth`** and **staging `vbkoupvduadmcxggtnsb`**, git inspection of the PR head, and simulated-JWT RLS probes. The live web app was **not** fetched from this environment (outbound to `*.vercel.app` is proxy-blocked here); app-UI items are marked accordingly.

---

## 1. Scope freeze (P1) — FROZEN
Release 2 = PR #35 at **`0b0c8c5`**, 41 files, +4555/−195. No further features, redesigns, or staging cycles.

**Two migrations (ordered):**
| # | Migration | Lines | Nature |
|---|---|---|---|
| 1 | `20261023_doctor_notes_and_partial_kit` | 280 | Purely additive: 4 enums, 3 tables (`ConsultationNote`, `KitPurchaseLine`, `KitPurchaseEvent`), FKs, CHECKs, clinic-scoped RLS + grants. |
| 2 | `20261030_partial_checkout_transactions` | 91 | Additive **but touches existing tables**: adds 2 enum values to `KitPurchaseEventType`; new table `KitPurchaseTransaction`; 2 new columns on `KitPurchaseEvent`; **UNIQUE constraints on existing `KitOrderIntent` and `Assessment`**; composite FKs on `KitPurchaseLine`; 1 trigger function + 3 BEFORE-INSERT/UPDATE association triggers. Wrapped in one transaction with `lock_timeout=3s`, `statement_timeout=30s`. |

**Dependency:** #2 depends on #1's objects → **#1 must be applied before #2**.

**⚠ Scope note — migration #2's triggers touch the *live* write paths.** The three association triggers (`release2_event_associations`, `release2_note_associations`, `release2_transaction_associations`) fire on **every** `KitPurchaseEvent` / `ConsultationNote` insert, not only on the dormant checkout/transaction path. So even with purchasing OFF, they are active on the Notes + Partial-Kit features that go live. This is precisely why one authenticated write on staging **after** migration #2 (installed 2026-10-30) is required before cutover — to prove the triggers do not reject legitimate doctor writes (Gate G1).

**Feature-to-code map (frozen):**
- Notes: `lib/notes/*`, `api/doctor/consultation-notes/*`, `components/doctor/ConsultationNotesPanel.tsx`.
- Partial kit tracking: `lib/commerce/{kitPurchaseModel,purchaseStore,patientOrders}.ts`, `api/doctor/orders/[intentId]/purchase`, `components/doctor/{KitPurchaseTracker,PatientTreatmentHistory}.tsx`, `api/doctor/patients/[id]/treatment-history`.
- Checkout transactions (Codex): `lib/commerce/{partialCheckout,transactionStore}.ts`, `api/doctor/orders/[intentId]/transactions`, `components/doctor/PartialKitCheckout.tsx`, and **modifications to `api/cart/[assessmentId]/{checkout,quantity}`, `api/payments/webhook`, `lib/payments/paymentStore.ts`** — money path, gated by `PURCHASING_ENABLED`.

---

## 2. Staging acceptance + clinic isolation (P2)
**QA doctors confirmed on staging:** Dr Test A → *DrFACT Mumbai Test* (`cmsuip5jk0000u6hz3hqduv8y`); Dr QA B → *DrFACT Pune Test* (`staging-qa-clinic-b`). Two distinct clinics.

**Migrations installed on staging (Prisma ledger):** `20260918_doctor_phone_identity` (10-28), `20261023_doctor_notes_and_partial_kit` (10-28), `20261030_partial_checkout_transactions` (10-30 11:41).

**Migration integrity — staging objects match the frozen SQL; ledger checksum is drifted (hygiene, not schema):**
- **Migration #1** staging checksum `427d8f28…863011` **== frozen file** `427d8f28…863011`. ✅ byte-identical.
- **Migration #2** staging checksum `cddba5f2…874d` **≠ frozen file** `5c1b4a4d…555019` (and staging `applied_steps_count=0`), i.e. the ledger row was hand-reconciled with a stale checksum. **However, the resulting schema objects on staging match the frozen head variant exactly:** both `r2_*` UNIQUE constraints present, both `r2_line_*` composite FKs present, the superseded `release2_line_associations` trigger correctly **absent**, the three `release2_{event,note,transaction}_associations` triggers present, both new enum values present, both new `KitPurchaseEvent` columns present. So staging runs the same schema the frozen SQL produces; only the recorded checksum drifts. **Production must record `5c1b4a4d…555019` (the frozen file's real checksum), not staging's stale value; optionally correct staging's ledger row to match.**

**Clinic isolation — PASS (proven at the RLS layer).** Simulated `authenticated` DOCTOR JWTs:
| Viewer | Own R2 rows | Other clinic visible |
|---|---|---|
| Clinic `cdfc…` | 4 lines / 1 note / 4 events | **0** of `cmtihp…` |
| Clinic `cmtihp…` | 1 line / 1 note / 1 event | **0** of `cdfc…` |
| Dr Test A clinic `cmsuip5jk…` | 0 | **0** of either (sees nothing) |

Isolation holds across all four tables including `KitPurchaseTransaction`. App-layer scoping (every store query carries `clinicId`/`kitOrderIntentId` in WHERE) is locked by source-contract tests in `tests/doctor/kit-purchase-corrections.test.ts`.

**NOT TESTED from sandbox (→ Gate G1):** authenticated UI acceptance as Dr Test A — dictation + typed fallback, save→refresh persistence, notes/tracker/history panels rendering, recording a partial purchase. Also **`KitPurchaseTransaction` has 0 rows anywhere** → the checkout-transaction path has never run.

**Acceptance script for the running staging app (Dr Test A):**
1. Sign in as Dr Test A (Chrome Incognito if extensions interfere with OTP) → confirm dashboard scopes to DrFACT Mumbai Test.
2. Open a patient under review → add a consultation note by dictation, then by typing; save; refresh → note persists, dated + authored, and **no new ConsultationVersion** was minted.
3. On an approved order → record a partial purchase (e.g. 2 of 4 kits), defer one, decline one → tracker shows recommended vs purchased/remaining; dates recorded.
4. Open the patient profile → Follow-up/Treatment History shows recommended + obtained across visits.
5. Sign in as **Dr QA B** (Pune Test) → confirm **none** of Dr Test A's notes/lines/events are visible.
6. (Only if checkout is to be accepted) exercise `PartialKitCheckout` with `PURCHASING_ENABLED=on` on staging → one `KitPurchaseTransaction` row appears; verify isolation again.

---

## 3. Preview backend target (P3) — PARTIAL
| Layer | Result | Evidence |
|---|---|---|
| Preview **public client** → staging | **PASS** | The PR preview's public `/login` assets carry the staging ref `vbkoupvduadmcxggtnsb`; **no production Supabase URL** appears (verified in Codex's `docs/releases/release-2-readiness.md`, "Live environment checks"). |
| Preview **server `DATABASE_URL`** → staging | **UNVERIFIED** | Vercel env read is **forbidden to this session** (403 `projectEnvVars`), and no Vercel CLI is installed here. The private server DB target cannot be confirmed from this environment. |

**Action for the operator (closes P3):** in Vercel → project `hairos` → Settings → Environment Variables, confirm the **Preview**-scoped `DATABASE_URL` / server Supabase connection string points to `vbkoupvduadmcxggtnsb` (staging), not `pykoyxbleowxwechotth` (production).

---

## 4. Production schema & migration preflight (P4) — PASS (read-only)
| Check | Result | Evidence |
|---|---|---|
| R2 tables absent in prod | **PASS** | `ConsultationNote`, `KitPurchaseLine`, `KitPurchaseEvent`, `KitPurchaseTransaction` do not exist. |
| R2 migration names absent | **PASS** | None of `20261023` / `20261030` in `_prisma_migrations`. |
| R2 enum / constraints absent | **PASS** | `KitPurchaseEventType` enum = 0; `r2_*` constraints = 0. |
| Prereq tables present | **PASS** | `KitOrderIntent` present; `Clinic`/`Patient`/`Assessment`/`Doctor` present. |
| Prereq functions present | **PASS** | `jwt_is_super_admin`, `jwt_user_role`, `jwt_is_clinic_member` all present (SECURITY DEFINER, read `request.jwt.claims`). |
| Prereq roles present | **PASS** | `authenticated`, `service_role` present. |

**⚠ Production Prisma ledger is stale/inconsistent (pre-existing, not caused by R2):**
- Only 18 rows; **last real entry is 2026-09-11** (`20260626_*`). Production's live schema is far newer, so **schema is advanced by `prisma db push`/direct DDL, not `migrate deploy`.**
- **Dangling failed migration:** `20260626_phase3_admin` has `finished_at = NULL`, `rolled_back = false` → Prisma "failed" state. **A `prisma migrate deploy` would refuse (P3009)** and would also try to replay ~35 already-applied migrations.
- **Consequence:** the R2 production path must **apply the two migration SQL files directly**, then optionally record them in `_prisma_migrations` as plain inserts (as was done on staging). Do **not** run `prisma migrate deploy` against production. (The dangling `phase3_admin` row is a separate pre-existing hygiene item — not a Release 2 blocker.)

---

## 5. Existing production records / logins / pricing / isolation preserved (P5) — PASS
| Check | Result | Evidence |
|---|---|---|
| Baseline records intact | **PASS** | 10 clinics (all active), 10 doctors, 20 patients, 20 assessments. R2 adds only new empty tables — no existing row/column/table is altered by migration #1; migration #2 only **adds** unique constraints/columns (no data change) and these are guaranteed to succeed (composite keys on existing PKs). |
| Acube Aesthetics present | **PASS** | Clinic `acube-aesthetics` (`ccf1d8f1911e95f18366d848c`), active. |
| Acube doctor present & provisioned | **PASS** | Dr Avinash Agarwal (`c3d13b725f9e74c709f1839e8`), active, provisioning ACTIVE, isPrimary. ⚠ `supabasePhoneUserId` unlinked — email login, or phone-OTP identity not yet linked (links on first OTP login; **not** an R2 blocker). |
| Governed kit pricing untouched | **PASS** | R2 migrations reference none of `Kit`/`KitPrice`/`KitProduct`/`ProductPrice`/`ProductPriceVersion`. Kit identity/pricing is governed in-app by string kit IDs (prod `Kit`/`KitPrice` tables are empty by design; `KitOrderIntent`=11). |
| Doctor logins unaffected | **PASS** | No change to auth tables, JWT hook, or identities. RLS policies are additive (new tables only). |
| Clinic isolation unchanged | **PASS** | New policies mirror the existing clinic-scoped pattern; no existing policy modified. Cross-clinic isolation proven in §2. |

---

## 6. Production migration order & deployment package (P6)

**Pre-cutover (read-only re-check):** re-confirm §4 (R2 tables/enum/constraints still absent; prereqs present).

**Step 1 — apply migration #1** (`20261023_doctor_notes_and_partial_kit/migration.sql`) via Supabase SQL (service_role). Purely additive.

**Step 2 — apply migration #2** (`20261030_partial_checkout_transactions/migration.sql`) via Supabase SQL. Self-contained transaction (`BEGIN … COMMIT`) with `lock_timeout=3s` / `statement_timeout=30s`; enum `ADD VALUE IF NOT EXISTS` is safe.

**Step 3 — record in ledger (optional, for traceability; mirrors staging):** insert one `_prisma_migrations` row per migration. Use the **frozen-file checksums**:
- `20261023_doctor_notes_and_partial_kit` → `427d8f28d5a3b0a3a445495775d84a1fec0c12867e49aaf07e2f5c0750863011`
- `20261030_partial_checkout_transactions` → `5c1b4a4dd4f3394f17ed97744f94efb07764d6bcff2800c3572d8487a1555019` (**not** staging's stale `cddba5f2…`).

Do **not** attempt `migrate deploy` (blocked by the dangling `20260626_phase3_admin` row and would replay ~35 already-applied migrations).

**Step 4 — deploy app:** promote the Release 2 commit (PR #35 head once merged to `claude/acube-launch-fix`) on Vercel production.

**Step 5 — environment / flags:** **`PURCHASING_ENABLED` stays OFF.** With it off, Notes + Partial Kit tracking (quantity/dispense/clinical-state) + Follow-up History are live; money events and the `KitPurchaseTransaction` checkout path stay dormant. No other env change required.

**Step 6 — post-cutover verification (read-only):** confirm 4 tables + RLS present; run the §2 JWT isolation probe on production (expect 0 cross-clinic); confirm Acube counts unchanged; have Dr Avinash open the dashboard and add one note + record one partial-kit action.

**Rollback:** drop in reverse (`KitPurchaseTransaction` → drop added `KitPurchaseEvent` columns/trigger/fn → `KitPurchaseEvent` → `KitPurchaseLine` → `ConsultationNote` → the 4 enums; and drop the `r2_*` unique constraints on `KitOrderIntent`/`Assessment`). **Export `KitPurchase*` first if any real purchase has been recorded.** Until applied, all new surfaces already degrade to HTTP 503 `*_not_provisioned`, so a non-deploy is itself safe.

---

## 7. CI / build state
PR #35 head `0b0c8c5`: **Release gate (blocking) = green**; Vercel preview = **Ready** (production build succeeds); "Legacy baseline (informational)" red by design (`continue-on-error`, documented). No merge conflict (`mergeable_state: unstable` = checks only).

**Build reconciliation:** Codex's readiness doc recorded a *local* production-build failure (Google `next/font` in `apps/patient-portal/src/app/layout.tsx`) at the head it audited (`64285c2`). Current head `0b0c8c5` is two commits later and its Vercel preview is **Ready** with the blocking Release gate green — i.e. the build is certified on Vercel for the current head. **Action:** deploy exactly the green SHA (`0b0c8c5`, or the merge commit that carries it) and reconfirm its Vercel build before promotion.

---

## 8. Genuine blockers & recommendation — CONDITIONAL GO

Everything **structurally** required for a safe cutover is already GREEN: additive migration whose every prerequisite object is present in production; cross-clinic isolation proven at the RLS layer across all four tables; existing clinics/doctors/patients/pricing/logins untouched; blocking CI green; a precise non-`migrate deploy` apply plan. What is **not** yet proven is runtime behaviour of the live write paths under migration #2's triggers — and that can only be shown on the running app, which this sandbox cannot reach.

**ONE hard blocker — must pass before cutover:**
1. **G1 — Authenticated staging acceptance of the three live features, post-migration-#2, via Dr Test A, with isolation re-checked as Dr QA B.** Run the §2 script on the staging app. This is the single functional gate: it proves dictation/typed notes + partial-kit recording persist, panels render, and — critically — that migration #2's association triggers accept legitimate doctor writes rather than rejecting them. Could not be executed here (app host proxy-blocked, no browser). *Independently, Codex's readiness doc also gates on this and currently reads NO-GO for the same reason.*

**Conditions that must hold at cutover (verify, then proceed):**
2. **G2 — `PURCHASING_ENABLED` stays OFF in production.** The `KitPurchaseTransaction` / clinic-counter checkout money path (new) has never run at runtime (0 rows anywhere) and changes commerce/payment code; order-level fulfilment/summary screens are not yet reconciled to transaction-level accounting. Purchasing OFF keeps all of this dormant. Enabling it later is a **separate** release requiring its own acceptance (§2 step 6).
3. **P3 — confirm the Preview *server* `DATABASE_URL` points to staging** (§3; public client already verified to staging). One-line Vercel settings check.
4. **Deploy the green SHA** `0b0c8c5` and reconfirm its Vercel build (§7).

**Not blockers (awareness only):** stale/failed production Prisma ledger incl. the dangling `20260626_phase3_admin` row (§4 — handled by applying the two SQL files directly, never `migrate deploy`); Acube doctor's unlinked `supabasePhoneUserId` (links on first OTP login); staging's drifted migration-#2 ledger checksum (§2 — staging *objects* match the frozen SQL; record the correct checksum in production and optionally fix staging).

**Bottom line:** **CONDITIONAL GO** — approve the production cutover (both migrations in order, app deploy, purchasing OFF) **as soon as G1 passes on staging** and conditions 2–4 are confirmed. Until then it is a hold on exactly one piece of runtime evidence, not on design or data safety. No production migration, merge, deploy, or purchasing enablement will be performed without your explicit authorization.

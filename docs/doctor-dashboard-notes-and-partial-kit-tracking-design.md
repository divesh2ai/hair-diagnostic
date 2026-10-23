# HAIROS — Doctor Dashboard: Consultation Notes & Partial Kit Tracking

**Status:** AUDIT + DESIGN ONLY — awaiting approval. No production writes, migrations, merges, or deploys. Clinical engine untouched.
**Date:** 2026-10-23 (revised against real source)
**Audited source:** `apps/patient-portal` on branch **`claude/acube-launch-fix`** (HEAD `0227041`) — the actual HairOS Next.js app. Prisma schema `prisma/schema.prisma`.
**Correction:** the first revision of this doc was written against the wrong branch (an HTML demo) and the staging DB alone. It is superseded. Everything below is grounded in the real TypeScript with file:line references.

### Settled decisions (from the product owner)
1. Same repository — no separate repo needed.
2. Staging RLS remediation handled **separately** from these features (tracked in `prisma/staging-security-repair.generated.sql`; out of scope here).
3. Preserve existing kit IDs and governed pricing; **do not invent prices**.
4. Doctor-controlled mic dictation with editable text, typed fallback, **no stored raw audio** by default.

---

## 1. What already exists (so we don't rebuild it)

### Feature A — notes & dictation
- **Doctor notes today** are a typed-only textarea in `DoctorReviewClient` → `DoctorNotesBlock` (`app/doctor/reports/[assessmentId]/DoctorReviewClient.tsx:1098‑1175`). Saving calls `addNote()` (`:487‑536`), which PATCHes `app/api/consultation/[assessmentId]/route.ts`. That route **appends a new immutable `ConsultationVersion`** and emits `DOCTOR_REVIEW_COMPLETED` + `CONSULTATION_UPDATED` (`route.ts:1‑12`). The note itself is a `DoctorNote` `{ id, doctorId, body, createdAt, visibleToPatient }` appended to `consultation.doctorNotes` inside the version `content` (`:495‑509`).
- **Dictation is already built and reusable**: `components/shared/VoiceDictateButton.tsx` — Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`), continuous + interim results, appends recognised text to a bound value, **silently hidden when unsupported**, and **stores no audio** (transcription is client-side only). A sibling `components/skin-fact/VoiceTextField.tsx` wraps a textarea + mic with a "Listening…" status and an error-to-typed fallback.
- **Author identity** is available server-side via `requireDoctorContext()` / `lib/auth` (`doctor.id`, `doctor.clinicId`, name).

### Feature B — kit recommendation & post-approval ops
- **`KitOrderIntent`** (`schema.prisma:1621‑1680`) is the **immutable clinical authorization** — its own comment says it is "NOT billing, inventory, payments, or fulfilment." `kitIds` is the approved prescription; `quantities` is a `{ kitId: number }` map (dispense **boxes**, default `2` = two-month protocol, `lib/commerce/kitQuantity.ts`). Idempotent per `@@unique([consultationId, consultationVersionId])`. Created by `lib/consultation/approveAndCreateOrder.ts`. Quantity edits go through `api/cart/[assessmentId]/quantity/route.ts` and **never touch `kitIds`**.
- **Order-level treatment start** lives on the intent: `treatmentStartedAt/By/Source` (`schema.prisma:1662‑1667`), recorded **write-once** by `POST /api/doctor/orders/[intentId]/treatment-start` → `recordTreatmentStart()` (`lib/fulfilment/fulfilmentStore.ts:428`). Its contract (`treatment-start/route.ts:14‑37`) is explicit: the start date is **stated by a human**, never derived from approval/payment/delivery — it is THE follow-up anchor.
- **Payment & fulfilment** (`KitOrderPayment`, `ClinicKitFulfilment`, `schema.prisma:1749‑1847`) are **order-level**, modeled but in the **unapplied** migration `prisma/migrations/20260829_post_approval_workflow`. They are read via **raw-SQL stores** (`lib/payments/paymentStore.ts`, `lib/fulfilment/fulfilmentStore.ts`) that catch "relation/column does not exist" and throw `*NotProvisionedError` → routes return **503 + a stable reason code** until the migration is applied. Tenant scope (`clinicId`) is always in the SQL `WHERE`, not a prior read.
- **Purchasing is OFF by default** (`lib/commerce/purchasingGate.ts`): HairOS launches as a doctor-supervised **clinical-recommendation** platform. `assertPurchasingEnabled()` fails closed on every money-moving write. Approval + `KitOrderIntent` are explicitly *not* a sale; `CLINIC_COUNTER` is the Wave-0 "paid at the desk" source. Prices/names/packshots stay visible regardless.
- **Patient history surface**: `app/doctor/patients/[id]/page.tsx` shows only an **Assessment timeline** (from `GET /api/doctor/patients/[id]`). This is the natural home for a date-wise notes + treatment/purchase history.
- **Audit**: `lib/audit/writeAuditLog.ts` (`writeAuditLog`) is used by every write path; reuse it.

---

## 2. Current-versus-required matrix (corrected)

### Feature A — date-wise consultation notes, voice dictation, attribution, follow-up history

| Requirement | Current | Gap |
|---|---|---|
| Voice dictation with editable text | Dictation exists (`VoiceDictateButton`) but is **not wired** into the doctor-notes textarea | Wire existing component into the notes field |
| Typed fallback | Notes are typed-only today; dictation hides itself when unsupported | Already satisfied by reuse |
| No stored raw audio | Web Speech API stores none | Keep; make it an explicit invariant |
| Date-wise history for future consultations | Notes are per-assessment, inside the version `content`; no cross-visit timeline | New dated, patient-scoped note store + history surface |
| Author attribution | Only `doctorId` is stored; no name; UI shows just a timestamp | Store author id + **name snapshot**; show author |
| Separate from approved `ConsultationVersion` snapshots | **Violated** — every note creates a new `ConsultationVersion` + fires consultation events | Move notes to a dedicated store off the version/approval/event path |
| Secure clinic scoping | Consultation routes are clinic-scoped via `requireDoctorContext` | Apply the same scoping to the new store (tenant in `WHERE`) |
| No AI/clinical inference from notes | Notes are inert text today | Keep inert: never read by the engine, never emits a `ConsultationEvent` |

### Feature B — partial kit purchase & longitudinal tracking

| Requirement | Current | Gap |
|---|---|---|
| Preserve full approved plan | `KitOrderIntent.kitIds` + `quantities` (immutable) | None — keep unchanged |
| Record actual purchased quantities (item-level) | Only *recommended/dispense* `quantities`; no purchased qty | New per-kit purchase line + dated event ledger |
| Deferred / declined / substituted / discontinued per item | No such states | Per-line lifecycle status + controlled transitions |
| Purchase dates, repeat purchases on new dates, no double counting | Order-level only; a repeat would need a 2nd intent | Append-only dated events; purchased/remaining **derived** |
| Treatment-start dates | Order-level, write-once (`treatmentStartedAt`) | Keep as THE anchor; add per-kit `TREATMENT_STARTED` events where a kit starts on its own date |
| Remaining items visible, not treated as paid/owed | A kit is in the intent or not | Lines default `RECOMMENDED`; remaining = recommended − purchased |
| Governed prices + recorded sale values | `KitPrice` (versioned: `mrp`, `gstPercent`, `doctorPrice`); `KitOrderPayment.amountMinor` (order-level) | Reference governed price per line; record actual sale on the event; **invent nothing** |
| Keep kit-priority / plan rules unchanged | Produced by the engine into the intent | None — do not touch the engine |
| Never assume all kits bought/started | Nothing asserts purchase today | Default `RECOMMENDED`; purchase/start only via explicit events |

**Headline:** Feature A is mostly *wiring + relocation* of things that exist (dictation component, author context, audit) plus a small dated store. Feature B adds **item-level** granularity beneath the untouched order-level recommendation, following the repo's existing "unapplied migration + raw store that degrades to not-provisioned" pattern.

---

## 3. Exact schema, migration, API, and file changes

Additive only. No change to `KitOrderIntent`, `ConsultationVersion`, pricing/catalog tables, or the orchestrator. One new migration, shipped **unapplied**, consistent with the repo's freeze convention; new raw stores degrade to "not provisioned" until it is applied.

### 3.1 Prisma (`prisma/schema.prisma`) + new migration `prisma/migrations/<date>_doctor_notes_and_partial_kit/`

```prisma
model ConsultationNote {                 // Feature A — dated, authored, off the version lifecycle
  id             String   @id @default(cuid())
  clinicId       String                              // tenant scope (WHERE, not a prior read)
  patientId      String
  assessmentId   String?                             // the visit this note belongs to
  consultationId String?                             // soft link, NOT written into any version
  authorDoctorId String
  authorName     String                              // attribution survives later doctor edits
  noteDate       DateTime @default(now())            // the clinical date; editable within policy
  body           String   @db.Text
  inputMode      String                              // "DICTATION" | "TYPED" (writer-constrained, no enum churn)
  language       String   @default("en")
  status         String   @default("SAVED")          // "SAVED" | "AMENDED" | "DELETED"
  supersedesId   String?                             // corrections append, never overwrite
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@index([clinicId, patientId, noteDate])
  @@index([assessmentId])
}

model KitPurchaseLine {                   // Feature B — one per recommended kit; preserves the plan
  id               String   @id @default(cuid())
  kitOrderIntentId String
  clinicId         String
  assessmentId     String
  patientId        String
  kitId            String                            // matches a value in KitOrderIntent.kitIds (unchanged)
  kitLabel         String                            // display snapshot at approval
  recommendedQty   Int                               // from quantities / DEFAULT_KIT_QUANTITY
  lineStatus       String   @default("RECOMMENDED")  // RECOMMENDED|PARTIALLY_PURCHASED|PURCHASED|DEFERRED|DECLINED|SUBSTITUTED|DISCONTINUED
  substituteKitId  String?
  controlReason    String?                           // required for DEFERRED/DECLINED/SUBSTITUTED/DISCONTINUED
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  @@unique([kitOrderIntentId, kitId])
  @@index([clinicId, patientId])
  @@index([assessmentId])
}

model KitPurchaseEvent {                  // Feature B — append-only, dated ledger
  id                 String   @id @default(cuid())
  kitPurchaseLineId  String
  clinicId           String
  assessmentId       String
  eventType          String                          // PURCHASED|DISPENSED|DEFERRED|DECLINED|SUBSTITUTED|DISCONTINUED|TREATMENT_STARTED|REFUNDED
  quantity           Int?
  catalogUnitMinor   Int?                             // governed price snapshot from KitPrice (minor units); null if none
  saleValueMinor     Int?                             // actual recorded sale; null if not a sale
  currency           String   @default("INR")
  kitPriceId         String?                          // provenance → KitPrice row used
  occurredAt         DateTime                         // the event DATE (supports later purchases)
  recordedByDoctorId String
  note               String?
  createdAt          DateTime @default(now())
  @@index([kitPurchaseLineId, occurredAt])
  @@index([assessmentId, occurredAt])
}
```
Derivations (never stored as mutable totals): `purchasedQty(line) = Σ PURCHASED.quantity − Σ REFUNDED.quantity`, clamped `[0, recommendedQty]`; `remaining = recommendedQty − purchasedQty`. One `KitOrderIntent` still exists per approval; repeat purchases are new dated events — no second intent, no double count.

### 3.2 New raw-SQL stores (mirror `paymentStore.ts` / `fulfilmentStore.ts`)
- `apps/patient-portal/src/lib/notes/noteStore.ts` — `guardedNotes()`, `NOTES_NOT_PROVISIONED`, `createNote`, `listNotesForPatient`, `listNotesForAssessment`, `amendNote`. Tenant `clinicId` in every `WHERE`. Degrades to 503 before the migration is applied.
- `apps/patient-portal/src/lib/commerce/purchaseStore.ts` — `guardedPurchase()`, `PURCHASE_NOT_PROVISIONED`, `ensurePurchaseLines(intentId)` (backfill one line per `kitIds`), `appendPurchaseEvent`, `setLineStatus`, `readPurchaseState(assessmentId)` (lines + events + derived). `assertPurchasingEnabled()` is called **only** when an event records money (`saleValueMinor` set); recording quantity/date/clinical status is a dispensing record and does not require purchasing to be on.

### 3.3 API routes
Feature A:
- `app/api/doctor/consultation-notes/route.ts` — `POST` create `{ patientId, assessmentId?, body, inputMode, language, noteDate? }` (clinic from session), `GET ?patientId=` / `?assessmentId=` dated history.
- `app/api/doctor/consultation-notes/[id]/route.ts` — `PATCH` author-only amend (appends an `AMENDED` successor).
- **Repoint** the existing note save: `addNote()` in `DoctorReviewClient.tsx` posts to the notes route instead of the consultation `PATCH`, so saving a note no longer mints a `ConsultationVersion` or fires consultation events. Legacy `content.doctorNotes` is rendered **read-only**.

Feature B:
- `app/api/doctor/orders/[intentId]/purchase/route.ts` — `GET` lines+events+derived; `POST` append an event (purchase/dispense/defer/decline/substitute/discontinue/treatment-started) with `occurredAt`; `PATCH` line status with required reason.
- Extend `app/api/doctor/patients/[id]` (or add `/treatment-history/route.ts`) to return the merged date-wise history (visits, notes, purchase events, treatment start).

### 3.4 UI (reuse, don't rebuild)
- `components/shared/VoiceDictateButton.tsx` — reused as-is in the notes panel.
- `app/doctor/reports/[assessmentId]/DoctorReviewClient.tsx` — `DoctorNotesBlock` gains the mic (dictation + typed) and writes to the new store; a new **Partial Kit panel** shows recommended vs purchased vs deferred vs remaining + a dated timeline, with a `[+ event]` form and controlled defer/decline/substitute actions.
- `app/doctor/patients/[id]/page.tsx` + its API — add a date-wise **Consultation notes** list and a **Treatment & purchase history** section beside the assessment timeline.
- Audit every note write and purchase event via existing `writeAuditLog`.

---

## 4. Phase 1 (minimal) implementation plan

**In scope:**
- Feature A: `ConsultationNote` model + unapplied migration + `noteStore.ts`; notes API; repoint `addNote()`; dictation via `VoiceDictateButton`; author attribution; dated history on the patient profile. Legacy notes read-only.
- Feature B: `KitPurchaseLine` + `KitPurchaseEvent` models + unapplied migration + `purchaseStore.ts`; `ensurePurchaseLines` backfill; purchase/defer/decline/substitute/treatment-started events (quantities, dates, clinical status); derived purchased/remaining; governed price shown from `KitPrice` when present, **no invented prices**; history surfaces. With purchasing OFF, no chargeable rows are created — `saleValueMinor` stays null unless `PURCHASING_ENABLED`.

**Out of scope (later):** online payment capture/refund wiring, follow-up scheduling/reminders, catalog population, migrating legacy in-content notes.

**Affected files (exact):**
- `prisma/schema.prisma`; new `prisma/migrations/<date>_doctor_notes_and_partial_kit/migration.sql` (shipped unapplied).
- New: `src/lib/notes/noteStore.ts`, `src/lib/commerce/purchaseStore.ts`, `src/app/api/doctor/consultation-notes/route.ts` (+`[id]/route.ts`), `src/app/api/doctor/orders/[intentId]/purchase/route.ts`.
- Changed: `src/app/doctor/reports/[assessmentId]/DoctorReviewClient.tsx` (notes block + kit panel), `src/app/doctor/patients/[id]/page.tsx` and `src/app/api/doctor/patients/[id]/route.ts` (history).
- Reused: `src/components/shared/VoiceDictateButton.tsx`, `src/lib/auth` (`requireDoctorContext`), `src/lib/audit/writeAuditLog.ts`, `src/lib/commerce/purchasingGate.ts`, `src/lib/commerce/kitQuantity.ts`.

**Acceptance criteria:**
- A doctor can dictate or type a note, edit it, and save it against the right patient/visit; it appears in a date-wise history with author name; saving it creates **no** `ConsultationVersion` and emits **no** consultation event; no audio is stored.
- For a multi-kit plan, a doctor can record 1 purchased today and 2 more on a later date, mark kits deferred/declined with a reason, and see purchased-vs-recommended, remaining, and a dated timeline — no duplicate intent, no double counting, unpurchased kits never shown as paid/owed.
- `KitOrderIntent.kitIds`/`quantities`, kit priority, the treatment plan, approved consultations, and historic orders are unchanged; the clinical engine is untouched.
- Before the migration is applied, every new surface returns a clean "not provisioned" (503) and the app still boots — matching the payment/fulfilment stores.

---

## 5. Staging test strategy (`hairos-staging` only; synthetic data; no real audio, no production purchases)

Apply the new migration **on staging only**, then:
1. **Two patients, same name, same clinic** — notes/purchases never cross; scoping is by `patientId`, not name.
2. **Same name across two clinics** — clinic A cannot read clinic B's notes/events; a forged `clinicId` in the body is ignored (clinic from session, tenant in `WHERE`).
3. **Multiple doctors** — Dr A dictates, Dr B types; both show with correct author names; Dr B amending Dr A's note creates an `AMENDED` successor, not an overwrite.
4. **Partial purchase** — 4 kits recommended, 1 purchased today → "1 of 4"; 3 remain `RECOMMENDED`, not shown as owed/delivered.
5. **Repeat visit, later purchase** — +2 kits 3 weeks later → events append to the same intent; purchased = 3 of 4; no 2nd intent, no double count.
6. **Deferred → later purchased** — defer (reason) then purchase; timeline shows both in date order; status resolves to `PURCHASED`.
7. **Declined / substituted / discontinued** — reason captured; substitute recorded; none counted as a sale.
8. **Treatment start** — order-level `treatmentStartedAt` still the follow-up anchor; a per-kit `TREATMENT_STARTED` event records a kit that starts on its own date without changing the anchor.
9. **Dictation + fallback** — Chrome dictates; Firefox/denied-permission falls back to typing; save works either way; `inputMode` recorded; no audio persisted anywhere.
10. **Engine isolation** — saving a note creates no `ConsultationVersion`, emits no `ConsultationEvent`, and does not alter `KitOrderIntent`.
11. **Not-provisioned degrade** — with the migration un-applied, the notes and purchase surfaces return 503 with their reason codes and the app boots normally.
12. **Governed price** — with `KitPrice` present the event form shows the catalog price; with none, quantity/date are recorded and no price is invented; with `PURCHASING_ENABLED` unset, no chargeable row is created.
13. **Audit** — every note and purchase event writes an `AuditLog` row with correct actor/clinic.

---

## 6. Guardrails honored
No production writes, migrations, merges, or deploys. Clinical engine, kit-selection priority, approved consultations, and historic transactions untouched. `KitOrderIntent`/`kitIds`/governed pricing preserved; no invented prices. Dictation reuses the existing Web-Speech component with no raw-audio storage. Staging RLS remediation is tracked separately (decision 2). **No feature will be built until this plan is approved.**

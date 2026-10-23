# HAIROS — Doctor Dashboard: Consultation Notes & Partial Kit Tracking

**Status:** AUDIT + DESIGN ONLY — awaiting approval. No production writes, migrations, merges or deploys performed.
**Date:** 2026-10-23
**Scope:** `apps/patient-portal` (production: `https://hairos-ashen.vercel.app`, Vercel project `hairos`)
**Backends inspected (read-only):** Supabase `hairos-staging` (`vbkoupvduadmcxggtnsb`). Production (`drfact-hairos-production`) shares the same Prisma schema and was **not** modified or deeply read.

---

## 0. Audit method, confidence, and a blocking gap

### What was inspected
The live staging database schema was read in full (read-only): all 83 `public` tables with columns, foreign keys, enums, and row counts, plus the structure of `ConsultationVersion.content` and `KitOrderIntent.quantities`. This is authoritative for the **data model, authorization surface, and schema-change** deliverables (1, 3, 4, 5, 7).

### Blocking gap — application source code is not in the provided repository
The GitHub repo in scope for this session, `divesh2ai/hair-diagnostic`, contains **only** a static HTML demo (`Dr. FACT`, `index.html`) and the `next-saas-stripe-starter` boilerplate zip. It does **not** contain `apps/patient-portal`, `DoctorReviewClient.tsx`, `approveAndCreateOrder`, the doctor orders/pricing API routes, or any of the named TypeScript. The production Next.js app is deployed on Vercel from a different git repository that was not made available to this session.

**Consequence:** the file-level items in the brief's "Audit existing functionality first" list (the exact code in `DoctorReviewClient.tsx`, how `approveAndCreateOrder` writes `KitOrderIntent`, the pricing API shape, the current notes UI) are inferred from the database schema and the data they produce, not read directly. Everything stated about *tables, columns, enums, and data* is verified. Everything stated about *code wiring* is a well-grounded inference and is marked **[inferred from schema]** where it matters. To finalize the Phase 1 file list (deliverable 8) with exact paths and function names, point this session at the application repository (grant access, or `add_repo`).

---

## 1. Current-versus-required capability matrix

### Feature A — Microphone consultation notes

| # | Requirement | Current state (from schema/data) | Gap | Verdict |
|---|---|---|---|---|
| A1 | Save a brief consultation summary against the correct patient and dated visit | `doctorNotes` exists **only as a key inside `ConsultationVersion.content` (jsonb)** — the immutable AI snapshot. `ClinicVisit` (100 rows) anchors a dated encounter (`startedAt`, `assessmentId`, `clinicId`, `displayName`). | No standalone, dated, per-visit note entity. Notes are welded to a specific approved/version snapshot. | **Partial / wrong home** |
| A2 | Mic start/stop with status + live transcription preview | No audio/transcription fields, tables, or (observable) pipeline anywhere in schema. | Entire capture + preview layer missing. | **Missing** |
| A3 | Manual editing before saving | N/A — no note editor entity distinct from the snapshot. | Needs an editable draft note. | **Missing** |
| A4 | Typed-note fallback when speech recognition unavailable | N/A | Needs an `inputMode` concept; note body must accept typed text. | **Missing** |
| A5 | Date-wise note history for future consultations | `ConsultationVersion` is versioned, but that is snapshot history, not visit-note history; `ClinicVisit.startedAt` gives dates. | No queryable per-patient dated note timeline. | **Missing** |
| A6 | Author attribution + secure clinic scoping | `ConsultationVersion.createdBy/approvedBy` exist; `Doctor`, `ClinicMember`, clinic-scoped RLS exist on consultation tables. | Author exists only at snapshot granularity; a note needs its own author snapshot. | **Partial (reusable)** |
| A7 | Avoid permanent raw-audio storage by default | No audio stored today (no capability exists). | Must be an explicit non-goal / default-off design choice. | **Met by absence; must stay explicit** |
| A8 | No AI diagnosis / auto kit changes / clinical decisions from transcript | Clinical engine writes `ConsultationVersion`/`KitOrderIntent`; notes are inert text today. | Keep the new note strictly non-clinical: never feeds the engine, never mutates kits. | **Design constraint** |
| A9 | Keep routine visit notes separate from approved `ConsultationVersion` snapshots | **Violated today** — notes live inside `ConsultationVersion.content`. | Needs a separate table outside the snapshot/approval lifecycle. | **Missing (core ask)** |

### Feature B — Partial kit purchase & longitudinal tracking

| # | Requirement | Current state (from schema/data) | Gap | Verdict |
|---|---|---|---|---|
| B1 | Preserve the full approved treatment recommendation | `KitOrderIntent` captures the whole recommendation: `kitIds` (text[]), `quantities` (jsonb), bound to `consultationVersionId`. One intent per consultation (81 intents / 81 assessments; 78 multi-kit). | None — this is the durable recommendation record. **Keep unchanged.** | **Met** |
| B2 | Separately record item-level purchased quantities | Purchased quantity is **not represented at all**. `quantities` holds *recommended* amounts only. | No per-kit purchased-quantity store. | **Missing** |
| B3 | Record payment, purchase, dispensing, delivery, treatment-start **independently** | `KitOrderPayment` (order-level), `ClinicKitFulfilment` (order-level lifecycle: requested→confirmed→packed→dispatched→delivered→acknowledged), `KitOrderIntent.treatmentStartedAt/By/Source` (order-level). | All events are **whole-order**, not per item; cannot say "kit 1 delivered, kit 3 not purchased." | **Partial (order-level only)** |
| B4 | Keep unpurchased kits visible without treating them as paid/delivered/outstanding | A kit is either in the intent or not; no "recommended-but-not-purchased" state. | Needs an explicit per-kit status that is neither paid nor an open invoice. | **Missing** |
| B5 | Support later purchases on new dates without duplicate orders or double counting | Only order-level status `READY_FOR_FULFILMENT`/`CANCELLED`. A second purchase would require a second intent (duplicate) or overwrite. | Needs an append-only, dated purchase ledger keyed per item. | **Missing** |
| B6 | Track deferred / declined / substituted / discontinued with clinical controls | No such states exist. `RecommendationFeedback` (0 rows) captures doctor disagreement with the engine, not purchase outcomes. | Needs per-item lifecycle states + controlled transitions. | **Missing** |
| B7 | Display date-wise patient treatment history | `AuditLog` (5,481 rows) records events but is an audit store, not a patient-facing timeline; `ClinicVisit`, `ConsultationEvent` are dated. | No consolidated per-patient, date-ordered purchase/treatment timeline. | **Missing (derivable once B2/B5 exist)** |
| B8 | Actual amounts via governed catalog prices + recorded sale values | Governed pricing modeled in `KitPrice` (`mrp`, `gstPercent`, `doctorPrice`, `effectiveFrom/Until`, `provenance`, versioned) and `ProductPrice` — but **0 rows** (unpopulated). `KitOrderPayment.amountMinor` holds an order-level actual (2 rows). | Price catalog not yet populated; no per-line price snapshot or recorded sale value per item. | **Infra exists, unpopulated** |
| B9 | Keep kit-priority & treatment-plan rules unchanged | Rules are produced by the clinical engine into `ConsultationVersion`/`KitOrderIntent`. | None — this is a hard "do not touch." | **Constraint** |
| B10 | Never assume all recommended kits were bought/started | Nothing currently asserts purchase, so no false assumption exists — but there is also no place to record the truth. | Default every item to `RECOMMENDED`; purchase/start only via explicit events. | **Design constraint** |

**Headline:** the *recommendation* side (B1, B9) and the *order-level* commerce scaffolding (B3 partial) already exist and are good. Both features' real gap is **granularity and separation**: Feature A needs notes lifted *out of* the approved snapshot into a dated, authored entity; Feature B needs tracking lifted *down from* the order to the **individual kit item**, as an append-only dated ledger.

---

## 2. Proposed Doctor Dashboard UI

Both features attach to the existing doctor patient-profile / assessment-timeline view. No change to the clinical review (`DoctorReviewClient`) approval flow itself.

### A. Consultation Notes panel (per patient, per visit)
```
┌─ Patient: <name> · <clinic> ──────────────────────────── Visit: 23 Oct 2026 ─┐
│ Consultation Notes                                   [ Dictate ●] [ Type ⌨ ] │
│                                                                              │
│  ● Recording 00:14   (waveform)      [Stop ■]   status: listening…          │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ live transcript preview … (editable textarea)                       │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│  Language: [EN ▾]   Input: Dictation · editable before save                  │
│                                              [ Discard ]   [ Save note ]     │
├──────────────────────────────────────────────────────────────────────────── │
│ Note history (date-wise)                                                     │
│  • 23 Oct 2026 · Dr. A. Rao · typed      "Patient reports reduced shedding…" │
│  • 12 Sep 2026 · Dr. A. Rao · dictated   "Started HAIR FACT TE GOLD…"        │
└──────────────────────────────────────────────────────────────────────────────┘
```
- **Dictate**: uses the browser Web Speech API (client-side, no server audio). Shows start/stop, elapsed time, and a live interim transcript. On stop, the transcript lands in the editable textarea.
- **Type**: identical textarea, skips the mic. Shown as default when `SpeechRecognition` is unavailable (Safari/iOS, denied permission).
- **Save** persists edited text + metadata (author, date, inputMode, language). Raw audio is **never uploaded** by default.
- **Note history** lists prior notes for the patient, newest first, with date, author, and input mode. Read-only; a note is editable only by its author within a short window, otherwise append-a-correction.
- Clear separator and copy: *"Visit notes are private clinic documentation and are not part of the patient's AI report."*

### B. Partial Kit Tracking panel (per approved recommendation)
```
┌─ Recommended treatment (approved 12 Sep 2026, v3) ──────── 4 kits recommended ┐
│ Kit                         Rec. qty  Purchased  Status        Actions       │
│ HAIR FACT TE GOLD              1          1       ✅ Purchased  [+ event ▾]   │
│ IRON UP GOLD                   1          1       🚚 Delivered  [+ event ▾]   │
│ PRO FACT META B                1          0       ⏸ Deferred    [+ event ▾]   │
│ HAIR FACT HBR                  1          0       ✖ Declined    [reason…]     │
│                                                                              │
│ Purchased 2 of 4 · ₹X,XXX recorded · 2 deferred/declined · not an invoice    │
├─ Timeline ────────────────────────────────────────────────────────────────  │
│  23 Oct 2026  Purchased IRON UP GOLD ×1  ₹___ (catalog ₹___) · counter · Dr.A│
│  23 Oct 2026  Treatment started: HAIR FACT TE GOLD                           │
│  12 Sep 2026  Deferred PRO FACT META B (cost) · Dr. A                        │
│  12 Sep 2026  Purchased HAIR FACT TE GOLD ×1  ₹___ · counter · Dr. A         │
│                                              [ Record a later purchase + ]    │
└──────────────────────────────────────────────────────────────────────────────┘
```
- Row per **recommended** kit (always shows all 4 — unpurchased stay visible).
- "Purchased" column = sum of purchase events, never assumed. Status badge reflects per-item lifecycle.
- **[+ event]** opens a small dated form: event type (Payment / Purchase / Dispense / Deliver / Start treatment / Defer / Decline / Substitute / Discontinue), quantity, recorded sale amount (prefilled from governed catalog price when available), payment linkage, note.
- **Record a later purchase** adds a new dated event to the *same* recommendation — no new order, no duplicate.
- Deferred/declined/substituted/discontinued require a reason; substituted asks for the replacement kit; discontinued is a controlled (clinical) action.
- Footer never phrases unpurchased items as money owed.

---

## 3. Exact minimal schema and API changes

Guiding principle: **additive only.** No column is altered or dropped on `Consultation`, `ConsultationVersion`, `KitOrderIntent`, `KitOrderPayment`, `ClinicKitFulfilment`, or any pricing/catalog table. The clinical engine and kit-selection path are untouched.

### 3.1 Feature A — new table `ConsultationNote` (routine visit notes, separate from snapshots)

```
ConsultationNote
  id                text PK
  clinicId          text  NOT NULL  -> Clinic.id        (clinic isolation)
  patientId         text  NOT NULL  -> Patient.id
  assessmentId      text  NULL      -> Assessment.id     (ties note to the visit)
  clinicVisitId     text  NULL      -> ClinicVisit.id    (preferred dated anchor)
  consultationId    text  NULL      -> Consultation.id   (optional soft link, NOT into the version)
  authorDoctorId    text  NOT NULL  -> Doctor.id
  authorNameSnapshot text NOT NULL                      (attribution survives doctor edits)
  noteDate          timestamptz NOT NULL                (the visit date; defaults to now)
  body              text  NOT NULL                      (edited transcript or typed text)
  inputMode         enum  NoteInputMode{ DICTATION, TYPED }
  language          text  NOT NULL default 'en'
  status            enum  NoteStatus{ DRAFT, SAVED, AMENDED, DELETED }
  supersedesNoteId  text  NULL  -> ConsultationNote.id   (corrections = append, not overwrite)
  audioRetained     boolean NOT NULL default false       (always false by default; no raw audio)
  audioRef          text  NULL                            (reserved; unused unless clinic opts in)
  createdAt         timestamptz default now()
  updatedAt         timestamptz
  deletedAt         timestamptz NULL                      (soft delete)
  -- RLS ENABLED, clinic-scoped policy mirroring Consultation
  -- indexes: (patientId, noteDate desc), (clinicId, noteDate desc), (assessmentId)
```
Notes are **never** written into `ConsultationVersion.content`. The existing `content.doctorNotes` key is left as-is for historical snapshots (read-only legacy); the new panel reads/writes `ConsultationNote`.

### 3.2 Feature B — two new tables: per-item line + append-only event ledger

`KitPurchaseLine` — one row per **recommended** kit, created from the approved `KitOrderIntent`. Preserves the recommendation and carries per-item lifecycle state.
```
KitPurchaseLine
  id                 text PK
  kitOrderIntentId   text NOT NULL -> KitOrderIntent.id
  clinicId           text NOT NULL -> Clinic.id
  assessmentId       text NOT NULL -> Assessment.id
  patientId          text NOT NULL -> Patient.id
  kitId              text NOT NULL        (matches a value in KitOrderIntent.kitIds; free-form today)
  kitLabelSnapshot   text NOT NULL        (display name captured at approval)
  recommendedQty     integer NOT NULL     (from KitOrderIntent.quantities)
  lineStatus         enum KitLineStatus{ RECOMMENDED, PARTIALLY_PURCHASED, PURCHASED,
                                         DEFERRED, DECLINED, SUBSTITUTED, DISCONTINUED }
                                         default RECOMMENDED
  substituteKitId    text NULL
  controlReason      text NULL            (required for DEFERRED/DECLINED/SUBSTITUTED/DISCONTINUED)
  createdAt/updatedAt timestamptz
  UNIQUE (kitOrderIntentId, kitId)
  -- RLS ENABLED, clinic-scoped
```

`KitPurchaseEvent` — immutable, dated ledger. Every purchase/payment/dispense/delivery/start/defer is one row. "Purchased qty" and "what remains" are **derived** from this, never stored as a mutable total.
```
KitPurchaseEvent
  id                 text PK
  kitPurchaseLineId  text NOT NULL -> KitPurchaseLine.id
  clinicId           text NOT NULL -> Clinic.id
  assessmentId       text NOT NULL -> Assessment.id
  eventType          enum KitPurchaseEventType{ PAYMENT_RECORDED, PURCHASED, DISPENSED,
                                                DELIVERED, TREATMENT_STARTED, DEFERRED,
                                                DECLINED, SUBSTITUTED, DISCONTINUED, REFUNDED }
  quantity           integer NULL          (for PURCHASED/DISPENSED/REFUNDED)
  catalogUnitMinor   integer NULL          (governed price snapshot from KitPrice at event time)
  saleValueMinor     integer NULL          (actual recorded sale)
  currency           text default 'INR'
  kitPriceVersionId  text NULL -> KitPrice.id   (provenance of the governed price used)
  kitOrderPaymentId  text NULL -> KitOrderPayment.id  (links to existing order-level payment if any)
  occurredAt         timestamptz NOT NULL  (the event DATE — supports later purchases)
  recordedByDoctorId text NOT NULL -> Doctor.id
  note               text NULL
  createdAt          timestamptz default now()
  -- append-only (no updates/deletes; corrections = compensating event, e.g. REFUNDED)
  -- RLS ENABLED, clinic-scoped; index (kitPurchaseLineId, occurredAt), (assessmentId, occurredAt)
```

**Double-counting / duplicate-order safety:** there is still exactly one `KitOrderIntent` per approved recommendation. Purchases accumulate as events under lines. `purchasedQty(line) = Σ PURCHASED.quantity − Σ REFUNDED.quantity`, clamped to `[0, recommendedQty]` for display; a later purchase is a new event with a later `occurredAt`. No new intent is ever created for a repeat purchase.

### 3.3 Security fix bundled with the migration (see §5)
Enable RLS + clinic policies on the already-shipped order tables the features touch: `KitOrderPayment`, `ClinicKitFulfilment`, `Appointment` (and ideally `PaymentTransaction`, `CatalogOrder*`). Presented as SQL for approval; not auto-applied.

### 3.4 API changes (Next.js route handlers / server actions — paths to confirm against app repo)
Feature A:
- `POST /api/doctor/consultation-notes` — create a note (clinicId derived from session, never client). Body: `{ patientId, assessmentId?, clinicVisitId?, body, inputMode, language }`.
- `GET /api/doctor/consultation-notes?patientId=…` — dated history, clinic-scoped.
- `PATCH /api/doctor/consultation-notes/:id` — author-only, short window, else creates an `AMENDED` successor.
- Transcription is **client-side only** (Web Speech API); no transcription endpoint, no audio upload.

Feature B:
- `POST /api/doctor/kit-purchase/backfill-lines` (internal, idempotent) — ensure `KitPurchaseLine` rows exist for a given `kitOrderIntentId`.
- `POST /api/doctor/kit-purchase/:lineId/events` — append a `KitPurchaseEvent` (dated). Validates clinic, doctor, event type transitions, price provenance.
- `PATCH /api/doctor/kit-purchase/:lineId/status` — controlled status change (defer/decline/substitute/discontinue) with required reason.
- `GET /api/doctor/kit-purchase?assessmentId=…` — returns lines + derived purchased/remaining + event timeline.
- Governed price read reuses the existing pricing API over `KitPrice`/`ProductPrice` (read-only); **no change to pricing logic.**

---

## 4. Data model for dated encounters and item-level purchase events

```
Patient ──< Assessment ──1:1── ClinicVisit (startedAt = the dated encounter)
   │             │
   │             ├──< Consultation ──< ConsultationVersion (approved snapshots; immutable)
   │             │                         └─ content.doctorNotes  (legacy, read-only)
   │             │
   │             ├──< ConsultationNote      [NEW]  (dated, authored, non-clinical)   ← Feature A
   │             │
   │             └──< KitOrderIntent (approved recommendation: kitIds[], quantities)  ← unchanged
   │                      │
   │                      ├──< KitPurchaseLine  [NEW] (one per recommended kit)       ← Feature B
   │                      │        └──< KitPurchaseEvent [NEW] (dated ledger)
   │                      ├──── KitOrderPayment (order-level, existing)
   │                      └──── ClinicKitFulfilment (order-level lifecycle, existing)
   │
   └─ "date-wise treatment history" = union of ClinicVisit.startedAt,
       ConsultationNote.noteDate, KitPurchaseEvent.occurredAt, ClinicKitFulfilment.*At,
       ordered by date (a read-only projection; no new storage).
```
- **Dated encounter** = `ClinicVisit` (already exists). Notes and purchase events both carry their own date (`noteDate`, `occurredAt`) so they survive even where a `ClinicVisit` row is absent.
- **Item-level purchase** = `KitPurchaseLine` (state) + `KitPurchaseEvent` (history). Recommendation stays whole in `KitOrderIntent`.
- **Remaining / deferred** is always derived (recommended − purchased), never a stored mutable count — eliminates double counting.

---

## 5. Clinic isolation, author attribution, privacy & audit

- **Clinic isolation:** every new table carries `clinicId NOT NULL` and gets **RLS enabled** with the same clinic-scoped policy pattern used by `Consultation`/`KitOrderIntent` (which have RLS on). `clinicId` is always derived from the authenticated session/doctor, never trusted from the request body. This directly addresses the "different patients sharing a name" risk — scoping is by id + clinic, not by name.
- **Author attribution:** `ConsultationNote.authorDoctorId` + `authorNameSnapshot`; `KitPurchaseEvent.recordedByDoctorId`. Snapshots of the author name/role are stored so attribution is stable even if a doctor record later changes (mirrors how `AuditLog` already snapshots `actorName`/`actorRoleSnapshot`).
- **Privacy / audio:** raw audio is **never persisted by default** (`audioRetained=false`, no upload path, transcription client-side). Only the doctor-edited text is stored. This satisfies A7 and keeps the feature out of audio-retention/consent complexity.
- **No clinical inference:** `ConsultationNote` is inert text — it is never read by the clinical engine, never triggers a `ConsultationEvent`, never alters `KitOrderIntent`. Enforced by keeping it off the engine's read paths and documented as an invariant.
- **Audit:** reuse the existing `AuditLog` (5,481 rows, rich: actor snapshot, before/after state, clinicId, requestId, source). Emit `AuditLog` entries for note create/amend/delete and every `KitPurchaseEvent`/line-status change. No new audit infrastructure needed.
- **⚠ Pre-existing security finding (must be surfaced):** the Supabase advisor reports **RLS is disabled on 17 tables**, including the ones these features build on — `KitOrderPayment`, `ClinicKitFulfilment`, `Appointment`, `PaymentTransaction`, `CatalogOrder`, `CatalogOrderItem`, `CatalogShipment*`. With the anon key, these are fully readable/writable cross-clinic. **Recommendation:** enable RLS + clinic policies on at least `KitOrderPayment`, `ClinicKitFulfilment`, `Appointment` as part of Phase 1 (SQL provided for your approval; not auto-applied, because enabling RLS without policies would block all access). The new tables ship with RLS from day one.

---

## 6. Staging test scenarios

All to be run against **staging** only, with synthetic data; no real patient audio, no production test purchases.

1. **Two patients, same name, same clinic** — notes and purchases for "Rahul Sharma" #1 never appear under "Rahul Sharma" #2; scoping proven by `patientId`, not name.
2. **Same name across two clinics** — clinic A doctor cannot read clinic B's notes/events (RLS). Attempt cross-clinic `clinicId` in request body → rejected (server derives clinic from session).
3. **Multiple doctors on one patient** — Dr. A dictates a note, Dr. B types one; both appear in the dated history with correct, stable author attribution; Dr. B cannot silently edit Dr. A's note (gets an `AMENDED` successor).
4. **Partial purchase (the core case)** — 4 kits recommended; patient buys 1 today. Row shows Purchased 1 of 4; 3 remain visible as `RECOMMENDED`, not shown as owed/delivered.
5. **Repeat visit, later purchase** — 3 weeks later the patient buys 2 more kits. New dated events append to the *same* recommendation; no second `KitOrderIntent`; purchased total = 3 of 4; no double count.
6. **Deferred → later purchased** — a kit marked `DEFERRED` (reason recorded) is later purchased; timeline shows both events in date order; status resolves to `PURCHASED`.
7. **Declined & substituted** — one kit declined (reason), one substituted for another kit (replacement recorded); discontinued requires the controlled action; none of these are counted as sales.
8. **Mic unavailable** — simulate Safari/iOS / denied permission → UI falls back to typed note; save still works; `inputMode=TYPED`.
9. **Governed price** — with `KitPrice` populated for a clinic, the event form prefills catalog unit price; recorded `saleValueMinor` can differ and both are stored; with `KitPrice` empty, price fields are entered manually and flagged as un-governed.
10. **Audit** — every note and purchase event produces an `AuditLog` row with correct actor/clinic; no raw audio exists anywhere after a dictation.
11. **Engine isolation** — saving/editing a note produces **no** `ConsultationEvent`, no change to `KitOrderIntent`, no new `ConsultationVersion`.

---

## 7. Migration & rollback strategy (preserves historical orders)

**Migration (additive, Prisma):**
1. Create enums (`NoteInputMode`, `NoteStatus`, `KitLineStatus`, `KitPurchaseEventType`) and tables (`ConsultationNote`, `KitPurchaseLine`, `KitPurchaseEvent`) with RLS enabled + clinic policies. No change to any existing table.
2. **Backfill (idempotent, read-then-insert):** for each existing `KitOrderIntent`, insert one `KitPurchaseLine` per `kitId` with `recommendedQty` from `quantities` and `lineStatus=RECOMMENDED`. Insert **no** purchase events — nothing is assumed bought (satisfies B10). Existing `KitOrderPayment` rows (2) may optionally seed a `PAYMENT_RECORDED`/`PURCHASED` event **only if** a human confirms the mapping; default is to leave them order-level and untouched.
3. Separately (own reviewed migration), enable RLS + policies on `KitOrderPayment`, `ClinicKitFulfilment`, `Appointment`.
4. Legacy `ConsultationVersion.content.doctorNotes` is left intact and shown read-only; no data is moved out of snapshots.

**Rollback:** because the migration is purely additive, rollback is `DROP TABLE KitPurchaseEvent, KitPurchaseLine, ConsultationNote` + drop the new enums. **No historical order, payment, fulfilment, consultation, or snapshot is altered or deleted at any point**, so rollback cannot lose historic transactions. The RLS-enable migration rolls back by disabling RLS on those three tables (restoring prior — insecure — behavior). Run on staging, verify scenarios §6, then production in a maintenance window.

---

## 8. Phase 1 implementation plan

Phase 1 deliberately ships the **safe core** and defers anything that touches money movement or the clinical engine.

**In scope (Phase 1):**
- A: `ConsultationNote` table + RLS, create/list/amend APIs, dashboard Notes panel with Web Speech dictation + typed fallback + dated history. No audio storage.
- B: `KitPurchaseLine` + `KitPurchaseEvent` tables + RLS, backfill, append-event / status APIs, dashboard Partial Kit panel + timeline, derived purchased/remaining. Prices read from `KitPrice` when present, manual + flagged when absent.
- Security: enable RLS + clinic policies on `KitOrderPayment`, `ClinicKitFulfilment`, `Appointment` (presented for approval).

**Out of scope (later phases):** populating the governed price catalog (`Kit`/`KitPrice` ingestion), online payment capture/refund wiring, substitution against a real `Kit` FK (keep free-form `kitId` until the catalog is populated), patient-facing timeline.

**Affected files — to confirm against the application repo (not in this session):** [inferred]
- `prisma/schema.prisma` + a new migration under `prisma/migrations/`.
- `apps/patient-portal` doctor dashboard: the patient-profile / `DoctorReviewClient.tsx` neighborhood — add two panels (co-located components, e.g. `ConsultationNotes/` and `KitPurchaseTracker/`).
- New API routes/server actions under the doctor API segment (alongside whatever hosts `approveAndCreateOrder` and the pricing API).
- Shared auth/clinic-scoping helper (reuse the existing session→clinic resolver used by consultation routes).

**Acceptance criteria:**
- A doctor can dictate or type a note, edit it, and save it against the right patient and visit date; it appears in that patient's dated note history; it is **not** in any `ConsultationVersion`; no audio is stored; attribution is correct; another clinic cannot see it.
- For a 4-kit recommendation, a doctor can record that 1 was purchased today and 2 more on a later date, mark 1 deferred/declined with a reason, and see purchased-vs-recommended, remaining, and a date-ordered timeline — with no duplicate order and no double counting, and unpurchased kits never shown as paid/owed/delivered.
- Saving notes or purchase events never alters `KitOrderIntent`, kit priority, the treatment plan, approved consultations, or historic transactions.
- All new tables enforce clinic isolation via RLS; every write emits an `AuditLog` entry.

---

### Open questions for approval
1. Can the **application repository** (the Next.js app Vercel deploys) be granted to this session so the Phase 1 file list and `approveAndCreateOrder` wiring can be made exact?
2. OK to include the **RLS-enable** migration for `KitOrderPayment`/`ClinicKitFulfilment`/`Appointment` in Phase 1, or handle separately?
3. Keep kit identity as **free-form `kitId` strings** for Phase 1 (catalog unpopulated), migrating to a `Kit` FK when the price catalog is ingested — agreed?
4. Web Speech API (browser-native, no server, no audio) acceptable for dictation, or is a server STT required later (which would reopen the audio-retention/consent questions)?

**No feature will be built until this plan is approved.**

# Design note — Sequential kit pickup & the `KitDispense` model

**Status:** Draft for review — **no schema migration until approved.**
**Author:** Claude Code (session)  ·  **Date:** 2026‑09‑29
**Scope:** Track kits dispensed to a patient one phase at a time (e.g. one kit per 2 months) and surface a *pending‑kit* tracker to doctors and reception. This note describes the model and integration only; it does **not** apply a migration.

---

## 0. Problem

A single approved order recommends up to five kits, but the patient does **not** take them all at once. The clinical protocol is already sequential — one kit for ~2 months, then the next — yet the system has no notion of *which kit the patient is currently on*, *what is due next*, or *what is overdue*. Reception cannot see who to call back, and there is no adherence signal.

The good news: the sequence itself already exists (see §1). What is missing is per‑kit **fulfilment state over time** and the surfaces that show it.

---

## 1. Current protocol sequencing — where phase order already lives

Phase order is authored, not invented here:

- **Source of truth — the sequencer.** `src/packages/ai-engine/kit-scorer/protocolSequencer.ts` defines `PROTOCOL_SEQUENCER: Record<DiagnosisKey, ProtocolEntry>`, where each entry has an ordered `phases: string[]` and a clinical `rationale` (explicit "Phase 1 / Phase 2" language). Example: `phases: ['HAIR FACT TE GOLD', 'PHENOTYPE INFLAMATION', 'MPHL']` — "TE GOLD stops active shedding first (non‑negotiable Phase 1); Phenotype clears inflammation in Phase 2 …".
- **Per‑consultation — the treatment plan.** When a consultation is composed, this becomes `Consultation…content.treatmentPlan.kitPhases[]`, each element carrying a `kitId` **and an explicit `phase` number**.
- **At approval — the order snapshot.** `apps/patient-portal/src/lib/consultation/approveAndCreateOrder.ts` → `extractKitIds()` sorts `kitPhases` by `phase` and flattens them into `KitOrderIntent.kitIds: string[]` (order preserved, phase numbers dropped).

**Implication:** the ordered sequence is available in two places — the consultation content (authoritative, with phase numbers) and `KitOrderIntent.kitIds` (ordered but phase numbers flattened). The fulfilment model should read phase numbers from the consultation `kitPhases` at creation/backfill time and fall back to `kitIds` array index when a phase number is absent.

---

## 2. Current `KitOrderIntent` structure

`prisma/schema.prisma` → `model KitOrderIntent` (the immutable clinical‑authorization snapshot; its own header says it is "NOT billing … or fulfilment"):

| Field | Type | Notes |
|---|---|---|
| `id` | cuid | PK |
| `consultationId` / `consultationVersionId` | FK | unique together — one intent per approved version |
| `assessmentId`, `clinicId`, `doctorId` | FK | tenancy + attribution |
| `kitIds` | `String[]` | final ordered lineup (phase‑sorted snapshot) |
| `quantities` | `Json?` | `{ kitId: number }` map; each kit **defaults to a 2‑box / 2‑month supply** (`lib/commerce/kitQuantity.DEFAULT_KIT_QUANTITY = 2`) |
| `status` | `KitOrderStatus` | `READY_FOR_FULFILMENT` \| `CANCELLED` |
| `fulfilmentMode` | `KitFulfilmentMode?` | `PATIENT` \| `CLINIC` (destination of the kits) |
| `treatmentStartedAt` | `DateTime?` | **"THE follow‑up anchor"** — explicitly designed for Day‑30/60/90 checkpoints, deliberately *not* derived from approval/payment/delivery |
| `treatmentStartedBy` / `treatmentStartSource` | `String?` | who/how the start was recorded (writer‑constrained, no enum) |
| `payment` | `KitOrderPayment?` | order‑level commercial state |
| `fulfilment` | `ClinicKitFulfilment?` | order‑level **logistics** lifecycle |

**Already‑present but unapplied ops layer** (migration `20260829_post_approval_workflow`, held behind the 2026‑08‑20 baseline freeze; readers use raw SQL that degrades to "not provisioned"):

- `ClinicKitFulfilment` — one **per order**, lifecycle `REQUESTED → CONFIRMED → PACKED → DISPATCHED → DELIVERED → ACKNOWLEDGED` (+ `CANCELLED`), path enforced by `lib/fulfilment/stateMachine.ts`. **This is shipping the box, not dispensing kits over time.**
- `KitOrderPayment` — one per order, `PENDING → PAID/FAILED/REFUNDED`.

> **Key relationship.** `ClinicKitFulfilment` answers "did the order's stock physically arrive?"; the new `KitDispense` answers "which kit is the patient currently on, and what's due next?" They are **orthogonal and complementary** — a clinic‑fulfilled order is delivered once, then dispensed to the patient phase by phase. `KitDispense` does not replace `ClinicKitFulfilment`.

---

## 3. Proposed `KitDispense` model

One row **per kit per order** (i.e. per phase).

```prisma
model KitDispense {
  id String @id @default(cuid())

  kitOrderIntentId String
  kitOrderIntent   KitOrderIntent @relation(fields: [kitOrderIntentId], references: [id])

  // Denormalised for RLS/tenant checks and ops queries — mirrors the pattern
  // KitOrderPayment/ClinicKitFulfilment already use ("read a column on this row
  // instead of joining out to reach a clinicId").
  clinicId     String
  clinic       Clinic     @relation(fields: [clinicId], references: [id])
  assessmentId String
  assessment   Assessment @relation(fields: [assessmentId], references: [id])

  kitId       String   // canonical/clinical kit id, from kitPhases[].kitId
  phaseIndex  Int      // 0-based sequence position (from kitPhases[].phase)
  supplyMonths Int     @default(2)  // from quantities[kitId] (boxes = months)

  status       KitDispenseStatus @default(PENDING)
  dueAt        DateTime?          // computed; null until treatmentStartedAt is set
  dispensedAt  DateTime?
  dispensedBy  String?            // Doctor.id
  dispenseSource String?          // writer-constrained, e.g. "DOCTOR_RECORDED" / "RECEPTION_RECORDED"
  skippedReason String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([kitOrderIntentId, phaseIndex])  // idempotent create/backfill
  @@index([clinicId, status, dueAt])         // reception "due/overdue" worklist
  @@index([kitOrderIntentId])
  @@index([assessmentId])
}

enum KitDispenseStatus {
  PENDING     // awaiting its turn or awaiting collection
  DISPENSED   // handed to the patient / patient started this kit
  COMPLETED   // supply period elapsed; the next phase becomes active
  SKIPPED     // doctor chose to skip this phase (reason recorded)
  CANCELLED   // parent order cancelled
}
```

Add the back‑relation on `KitOrderIntent`: `dispenses KitDispense[]`.

**"Due now / Overdue" are derived, not stored.** A row stays `PENDING` until someone acts; whether it is *On track / Due now / Overdue* is computed at read time from `status` + `dueAt` + today. This avoids a scheduler whose only job is to flip `PENDING → DUE`, and keeps the stored lifecycle honest (a state only changes when a human dispenses/skips or the order cancels).

---

## 4. Exact status lifecycle

Only one phase is "active" (collectible) at a time — the lowest `phaseIndex` not yet `DISPENSED`/`SKIPPED`.

```
PENDING ──dispense──▶ DISPENSED ──supply elapsed / next dispensed──▶ COMPLETED
   │
   ├──skip (reason)──▶ SKIPPED        (terminal)
   │
   └──order cancelled──▶ CANCELLED    (terminal, from any non-terminal state)
```

- **PENDING → DISPENSED** — doctor/reception records the hand‑over. Stamps `dispensedAt`, `dispensedBy`, `dispenseSource`. On this transition, the **next** phase's `dueAt` is (re)computed from *this* `dispensedAt` (roll‑forward — see §5).
- **DISPENSED → COMPLETED** — set when `dispensedAt + supplyMonths` has elapsed **or** when the next phase is dispensed (whichever first). `COMPLETED` is a convenience terminal for "this phase is fully behind us"; it is not required for the next phase to activate.
- **PENDING → SKIPPED** — doctor decides a phase is not needed; `skippedReason` required. The next phase activates immediately.
- **any non‑terminal → CANCELLED** — when the parent `KitOrderIntent` is `CANCELLED`, all its non‑terminal dispenses cascade to `CANCELLED`.

Transitions are enforced in a small `lib/fulfilment/dispenseStateMachine.ts` (same posture as the existing `stateMachine.ts`: the enum constrains the value, the state machine constrains the path — no backward edges, no jumping straight to `COMPLETED`).

**Derived display state** (read‑time, not stored):
| Condition | Chip |
|---|---|
| active `PENDING`, `dueAt` in the future | **On track** |
| active `PENDING`, `dueAt` within the "due" window (e.g. ≤ today) | **Due now** |
| active `PENDING`, `dueAt` < today − grace | **Overdue** |
| no active `PENDING` (all dispensed/skipped) | **Complete** |
| `treatmentStartedAt` null | **Not started** |

---

## 5. Due‑date source

Anchor: **`KitOrderIntent.treatmentStartedAt`** — the field explicitly built as the follow‑up anchor for Day‑30/60/90 checkpoints. If it is `null`, the schedule is **inactive** (`dueAt` = null, chip = "Not started"); reception records the start (via the existing `treatmentStartedAt` capture) to activate it.

Two candidate schedules:

1. **Planned (fixed from start):** `dueAt(phase N) = treatmentStartedAt + Σ supplyMonths(phase < N)`. With uniform 2‑month supply, `dueAt(N) = treatmentStartedAt + 2N months`. Simple, but a late pickup leaves every later date stale.
2. **Roll‑forward (recommended):** phase 0 `dueAt = treatmentStartedAt`; when phase N is dispensed, `dueAt(phase N+1) = dispensedAt(N) + supplyMonths(N)`. Due dates follow the patient's *actual* cadence, so a delay shifts subsequent phases instead of stacking them all overdue.

Recommend **roll‑forward**, seeding phase 0 from `treatmentStartedAt`. `supplyMonths` comes from `quantities[kitId]` (boxes = months), defaulting to 2.

---

## 6. Doctor / reception UI

Must show **more than a count**: `Next kit`, `due date`, `X / Y dispensed`, and an `On track / Due now / Overdue` chip.

- **Order Summary & Patients list** (`apps/patient-portal/src/lib/doctor/orderSummary/{query.ts,present.ts}`, `app/doctor/patients`): add a **Fulfilment** column, e.g.
  > **Next: Phenotype Inflammation · due 12 Nov**  |  `2 / 5 dispensed`  |  **Due now**
- **Review / order page** (`app/doctor/reports/[assessmentId]` and the cart's `ClinicOrderView.tsx`): a **phase timeline** — each kit with its `dueAt`, a dispensed ✓/date, and a **"Mark dispensed"** action enabled only on the current active phase; a **"Skip phase"** action (reason required) for doctors.
- **Reception worklist:** a clinic‑scoped list of active `PENDING` dispenses with `dueAt ≤ today` (+ overdue), driven by the `@@index([clinicId, status, dueAt])`. This is the "who do we call today" view.

Writes go through a thin API (e.g. `POST /api/dispense/[intentId]/[phaseIndex]`) that validates the transition, stamps the actor, and writes the audit row (§7). Reception vs doctor is distinguished only by `dispenseSource`; both may mark dispensed.

---

## 7. Audit requirements

- **On the row:** `dispensedBy` + `dispenseSource` + `dispensedAt` are the immutable attribution (same shape as `treatmentStartedBy/Source`).
- **AuditLog (append‑only):** every action writes a row via the existing `writeAuditLog` path, mirroring `KIT_ORDER_INTENT_CREATED`. New actions:
  - `KIT_DISPENSED` — `{ kitId, phaseIndex, dueAt, dispensedAt }`
  - `KIT_DISPENSE_SKIPPED` — `{ kitId, phaseIndex, reason }`
  - `KIT_SCHEDULE_STARTED` — when `treatmentStartedAt` is first set (may already be audited by the post‑approval workflow; reuse if so)
  - `KIT_DISPENSE_REMINDER_SENT` — see §10
  Each carries `actorId`, `clinicId`, `assessmentId`. No dispense is mutated in place without an audit row; corrections are new rows, never edits.

---

## 8. Migration / backfill strategy

- **Migration** adds `KitDispense` + `KitDispenseStatus` + indexes + **RLS policies** (§9). Follow the established **schema‑drift‑tolerant** pattern of `20260829_post_approval_workflow`: reach the table through a `lib/fulfilment/dispenseStore.ts` that talks raw SQL and answers "not provisioned" if the table is absent, so the app compiles and boots whether or not the migration is applied (respects the baseline‑freeze convention).
- **Backfill** (one‑off script under `scripts/`, gated per‑clinic like the existing seed/QA scripts, run with the service role):
  1. For each `KitOrderIntent` (start with `READY_FOR_FULFILMENT`), read the consultation's `treatmentPlan.kitPhases` for phase numbers; fall back to `kitIds` array index when absent.
  2. Create one `PENDING` `KitDispense` per kit with `phaseIndex`, `supplyMonths` (from `quantities`, default 2), denormalised `clinicId`/`assessmentId`.
  3. Compute `dueAt` from `treatmentStartedAt` when present (roll‑forward seed); leave `null` otherwise ("Not started").
  4. `CANCELLED` orders → create rows as `CANCELLED` (or skip) so history is consistent.
  - Idempotent via `@@unique([kitOrderIntentId, phaseIndex])`; safe to re‑run and to run incrementally per clinic.

---

## 9. Tenant / RLS implications

RLS is **on** across tenant tables (89 policies in the migration history; `Clinic`, `ClinicInvitation`, `PlatformSettings`, etc. all `ENABLE ROW LEVEL SECURITY`). `KitDispense` must therefore:

- carry a **denormalised `clinicId`** column (so a policy reads a column on the row, not a join) — the same reasoning `KitOrderPayment` documents;
- ship `SELECT` and `MODIFY` **RLS policies** scoped to the caller's clinic, cloned from the `KitOrderPayment` / `ClinicKitFulfilment` policy shape, with the existing super‑admin/platform bypass;
- be written by the app under the authenticated clinic user (so the actor is attributable and the policy applies), and by the **backfill** under the elevated service role only.

Result: cross‑clinic reads are impossible at the DB layer, matching how `loadDashboardStats` already scopes every dashboard read by `clinicId`. The reminder job (§10) runs server‑side and must set the tenant context per clinic (or run as service role with an explicit `clinicId` filter) rather than relying on an ambient session.

---

## 10. WhatsApp reminder integration

Reuse the existing delivery stack — `lib/delivery/whatsappSender.ts`, `sendPatientLink.ts`, `whatsappProvider.ts`, `deliveryStore.ts`, `whatsappConfigHealth.ts`:

- A scheduled job (the existing routine/trigger infra, or a cron) queries `KitDispense` where `status = PENDING` and `dueAt` falls in a reminder window — e.g. **T‑3 days**, **due today**, **overdue +N** — per clinic.
- For each, send a templated message ("Your next kit — *Phenotype Inflammation* — is due on *12 Nov*. Visit <clinic> to collect.") via `whatsappSender`, gated by `whatsappConfigHealth` and patient opt‑out.
- Record the send in `deliveryStore` and an `AuditLog` (`KIT_DISPENSE_REMINDER_SENT`), and **de‑duplicate** so at most one reminder per phase per window (a `remindedAt`/window marker, or a delivery‑store lookup).

This is the adherence lever: partial pickup is a drop‑off risk (patients forget phase 2), and an automated nudge protects both the clinical outcome and the repeat‑purchase revenue. Arguably higher value than the column itself.

---

## 11. Reporting impact

- **Dashboard** (`lib/doctor/dashboardStats.ts`): optional clinic‑scoped tiles — "Awaiting next kit" (active `PENDING`) and "Overdue pickups" (`PENDING`, `dueAt` < today), styled like the existing `pending` / `kitOrders` / `needsAttention` counts (absent‑when‑zero for the overdue tile).
- **Order Summary exports** (`orderSummary/{present.ts,csv.ts,workbook.ts}`): add columns — *Next kit*, *Due date*, *Dispensed X of Y*, *Status* — to the CSV and workbook.
- **New "Fulfilment worklist"** report: due‑today / overdue across the clinic (the reception view, exportable).
- **Adherence analytics:** dispense timestamps unlock the Day‑30/60/90 metrics `treatmentStartedAt` was designed for (time‑to‑phase‑2, completion rate, overdue rate by kit).
- **No change to the clinical one‑pager / patient report** — dispensing is an operational fact, not a clinical one.

---

## 12. Open decisions (for the review)

1. **Roll‑forward vs planned** due dates (§5) — recommend roll‑forward.
2. **Derive vs store** "Due/Overdue" (§3/§4) — recommend derive.
3. **Partial‑quantity pickup** (patient takes 1 of 2 boxes of a phase) — out of scope v1? Or split `supplyMonths`/quantity per dispense?
4. **Skip** — always require a reason; does a skipped phase still bill/ship?
5. **Reminder cadence & windows** (§10) — T‑3 / due / overdue+N, and per‑clinic overrides?
6. Does `KitDispense` reference the `ClinicKitFulfilment` that delivered its stock (link the two), or stay independent?

---

**Requested action:** review §3–§9 (the schema, lifecycle, and RLS) and the §12 decisions. **On approval**, the first implementation slice is the migration + `dispenseStore` + "Mark dispensed" action; the summary column and reminders follow. No migration will be written until this is approved.

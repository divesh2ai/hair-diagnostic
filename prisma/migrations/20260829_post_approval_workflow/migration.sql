-- Post-approval operational workflow: patient delivery, payment, clinic kit
-- fulfilment, and the treatment-start anchor.
--
-- NOT APPLIED YET. Written under the 2026-08-20 baseline freeze, following the
-- precedent set by prisma/migrations/20260821_appointments: the feature ships
-- complete and reviewable while the canonical Supabase environment is still
-- being chosen, and every reader talks to these objects over raw SQL so the
-- application compiles and boots whether or not they exist. Until someone runs
-- this, the post-approval surfaces report "not provisioned" (HTTP 503 with a
-- stable reason code) rather than throwing — see:
--
--   lib/fulfilment/fulfilmentStore.ts
--   lib/payments/paymentStore.ts
--   lib/delivery/deliveryStore.ts
--
-- Applying this migration is the entire switch-on step. No application code
-- changes with it.
--
-- ── Additive and backward compatible ───────────────────────────────────────
-- Every statement is CREATE or ADD COLUMN. Nothing is dropped, renamed, or
-- retyped, and every new column is nullable or carries a default, so existing
-- rows remain valid without a backfill. No historical migration is touched.
--
-- ── Rollback ───────────────────────────────────────────────────────────────
-- Reverse order, and safe because nothing here is a dependency of the existing
-- clinical path:
--
--   DROP TABLE "ClinicKitFulfilment";
--   DROP TABLE "KitOrderPayment";
--   DROP TYPE  "KitFulfilmentStatus";
--   DROP TYPE  "KitFulfilmentMode";
--   DROP TYPE  "KitOrderPaymentStatus";
--   DROP TYPE  "KitOrderPaymentSource";
--   ALTER TABLE "KitOrderIntent"   DROP COLUMN "fulfilmentMode", ... ;
--   ALTER TABLE "WhatsappDelivery" DROP COLUMN "subject", ... ;
--
-- Dropping the two tables discards payment and fulfilment history, which is
-- commercial and operational record — export before rolling back in any
-- environment that has taken a real order.

--------------------------------------------------------------------------
-- ENUMS
--------------------------------------------------------------------------

-- Where the approved kits physically go. Deliberately NOT assumed to be
-- CLINIC forever: direct-to-patient dispatch is a real Wave-1 shape, so the
-- destination is recorded per order rather than hard-coded in a handler.
CREATE TYPE "KitFulfilmentMode" AS ENUM ('PATIENT', 'CLINIC');

-- Ops-side lifecycle of one clinic kit supply request. The legal transitions
-- are enforced in lib/fulfilment/stateMachine.ts, not by this type — an enum
-- can constrain the VALUE but not the PATH, and the path is the part that
-- matters (a request must not jump straight to DELIVERED).
CREATE TYPE "KitFulfilmentStatus" AS ENUM (
  'REQUESTED',
  'CONFIRMED',
  'PACKED',
  'DISPATCHED',
  'DELIVERED',
  'ACKNOWLEDGED',
  'CANCELLED'
);

-- Payment state. PENDING exists so "checkout was started" is distinguishable
-- from "no one has tried yet"; a row is only ever PAID through an
-- authoritative server-side confirmation (see KitOrderPaymentSource).
CREATE TYPE "KitOrderPaymentStatus" AS ENUM (
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED'
);

-- WHO said this was paid. This is the security boundary of the whole commerce
-- path, so it is a persisted column rather than an implicit assumption:
--
--   PROVIDER_WEBHOOK — a payment provider's signed server-to-server callback,
--                      signature-verified before it is trusted.
--   CLINIC_COUNTER   — an authenticated clinic user recorded a payment taken
--                      at the desk. Genuinely authoritative for Wave 0, where
--                      clinics collect by card/UPI/cash in person, and it is
--                      attributable because the actor is on the row.
--
-- There is deliberately no PATIENT_DECLARED or CLIENT_REDIRECT member. A
-- browser cannot mark an order paid under any code path.
CREATE TYPE "KitOrderPaymentSource" AS ENUM (
  'PROVIDER_WEBHOOK',
  'CLINIC_COUNTER'
);

--------------------------------------------------------------------------
-- KitOrderIntent — additive columns
--------------------------------------------------------------------------
--
-- Why here rather than in a new table: the doctor's approved kit lineup IS the
-- order, and both facts below are properties of that order — where it should
-- be sent, and when the patient actually began taking it. A separate
-- "order settings" table would be a second row that can disagree with the
-- first about a single order.

-- Destination for this order's kits. NULL = never captured, which is the
-- honest state for every intent created before this column existed; it is not
-- backfilled. Readers resolve NULL through one documented Wave-0 default in
-- lib/fulfilment/fulfilmentMode.ts rather than each guessing for themselves.
ALTER TABLE "KitOrderIntent" ADD COLUMN "fulfilmentMode" "KitFulfilmentMode";

-- THE follow-up anchor. Deliberately its own column and NOT derived from
-- approval, payment or delivery dates: for a clinic-supplied kit the patient
-- starts days after delivery, and inferring a start date would silently
-- mis-date every Day-30 / Day-60 / Day-90 checkpoint built on it later.
ALTER TABLE "KitOrderIntent" ADD COLUMN "treatmentStartedAt" TIMESTAMP(3);
-- Doctor.id of whoever recorded the start. Nullable because the column is
-- nullable — a NULL start has no recorder.
ALTER TABLE "KitOrderIntent" ADD COLUMN "treatmentStartedBy" TEXT;
-- How the start date was established, e.g. 'DOCTOR_RECORDED'. Free text rather
-- than an enum so a later source can be added without a migration; the writer
-- constrains the values.
ALTER TABLE "KitOrderIntent" ADD COLUMN "treatmentStartSource" TEXT;

CREATE INDEX "KitOrderIntent_clinicId_treatmentStartedAt_idx"
  ON "KitOrderIntent" ("clinicId", "treatmentStartedAt");

--------------------------------------------------------------------------
-- WhatsappDelivery — additive columns
--------------------------------------------------------------------------
--
-- The table already models "a WhatsApp message about an assessment", which is
-- exactly what sending a report or a cart link is. Extending it is preferred
-- over a competing PatientDelivery table: two tables recording deliveries is
-- how "was the report sent?" acquires two different answers.

-- WHICH business object was sent: 'REPORT' | 'CART'. Nullable because rows
-- predating this column recorded only report delivery; NULL is read as
-- "unspecified", never silently as REPORT.
ALTER TABLE "WhatsappDelivery" ADD COLUMN "subject" TEXT;

-- Tenant + actor attribution. The table could previously only be joined to a
-- clinic through Assessment, which makes "this clinic's failed sends" a join
-- across the whole assessment table; and it recorded no sender at all, so a
-- message to a patient had no attributable author.
ALTER TABLE "WhatsappDelivery" ADD COLUMN "clinicId" TEXT;
ALTER TABLE "WhatsappDelivery" ADD COLUMN "sentByDoctorId" TEXT;

-- SENT and READ are distinct instants from `deliveredAt`, which the existing
-- code sets on hand-off. Only statuses the provider actually reports are ever
-- written here — see lib/delivery/whatsappProvider.ts.
ALTER TABLE "WhatsappDelivery" ADD COLUMN "sentAt" TIMESTAMP(3);
ALTER TABLE "WhatsappDelivery" ADD COLUMN "readAt" TIMESTAMP(3);

-- The provider's own status string, kept verbatim for support triage. Never
-- parsed into business logic — `status` is the state the application reasons
-- about.
ALTER TABLE "WhatsappDelivery" ADD COLUMN "providerStatus" TEXT;

CREATE INDEX "WhatsappDelivery_assessmentId_subject_idx"
  ON "WhatsappDelivery" ("assessmentId", "subject");
CREATE INDEX "WhatsappDelivery_clinicId_status_idx"
  ON "WhatsappDelivery" ("clinicId", "status");

--------------------------------------------------------------------------
-- KitOrderPayment
--------------------------------------------------------------------------
--
-- ── Why a new table ────────────────────────────────────────────────────────
-- Nothing in the schema models money. KitOrderIntent's own comment states it
-- is "NOT billing, inventory, payments, or fulfilment — just the least amount
-- of state needed for ops to act on the doctor's authorization", and putting a
-- payment status on it would contradict that and mix a clinical authorization
-- with a commercial fact that can be refunded, retried, or reconciled
-- independently.

CREATE TABLE "KitOrderPayment" (
    "id"                TEXT NOT NULL,

    -- The order being paid for. UNIQUE, not just indexed: one order has one
    -- payment record, and that constraint is what makes the whole
    -- confirmation path idempotent at the database level rather than in a
    -- handler's if-statement. A retried webhook cannot create a second row.
    "kitOrderIntentId"  TEXT NOT NULL,

    -- Denormalised tenant + case keys. Present so ops queries ("paid orders
    -- awaiting fulfilment at this clinic") and every tenant check read a
    -- column on this row instead of joining out to reach a clinicId.
    "clinicId"          TEXT NOT NULL,
    "assessmentId"      TEXT NOT NULL,

    "status"            "KitOrderPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "source"            "KitOrderPaymentSource",

    -- Minor units (paise). Integer on purpose: a float rupee amount is a
    -- rounding error waiting to be reconciled against a bank statement.
    "amountMinor"       INTEGER,
    "currency"          TEXT NOT NULL DEFAULT 'INR',

    -- Provider identity. `providerRef` is the provider's own payment id.
    -- The pair is UNIQUE so the same provider event replayed twice — the
    -- normal behaviour of every payment gateway's retry policy — is rejected
    -- by the database rather than by a race-prone read-then-write.
    "provider"          TEXT,
    "providerRef"       TEXT,

    -- Who recorded a CLINIC_COUNTER payment. NULL for webhook rows: no human
    -- took that action, and naming one would be a false attribution.
    "recordedByDoctorId" TEXT,

    "checkoutStartedAt" TIMESTAMP(3),
    "paidAt"            TIMESTAMP(3),
    "failedAt"          TIMESTAMP(3),
    "lastError"         TEXT,

    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitOrderPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KitOrderPayment_kitOrderIntentId_key"
  ON "KitOrderPayment" ("kitOrderIntentId");
CREATE UNIQUE INDEX "KitOrderPayment_provider_providerRef_key"
  ON "KitOrderPayment" ("provider", "providerRef");
CREATE INDEX "KitOrderPayment_clinicId_status_idx"
  ON "KitOrderPayment" ("clinicId", "status");
CREATE INDEX "KitOrderPayment_assessmentId_idx"
  ON "KitOrderPayment" ("assessmentId");

ALTER TABLE "KitOrderPayment"
  ADD CONSTRAINT "KitOrderPayment_kitOrderIntentId_fkey"
  FOREIGN KEY ("kitOrderIntentId") REFERENCES "KitOrderIntent"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "KitOrderPayment"
  ADD CONSTRAINT "KitOrderPayment_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "KitOrderPayment"
  ADD CONSTRAINT "KitOrderPayment_assessmentId_fkey"
  FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

--------------------------------------------------------------------------
-- ClinicKitFulfilment
--------------------------------------------------------------------------
--
-- ── Why a new table ────────────────────────────────────────────────────────
-- KitOrderStatus has exactly two members, READY_FOR_FULFILMENT and CANCELLED,
-- and the intent row is an immutable snapshot of a clinical authorization.
-- Ops fulfilment is a mutable operational process with six states, six
-- timestamps and its own actors; driving it by mutating the doctor's
-- authorization row would destroy the audit-stable snapshot that row exists
-- to be.
--
-- ── What is deliberately NOT here ──────────────────────────────────────────
-- No patient name, no phone, no clinical content, no kit lineup. The lineup
-- lives on KitOrderIntent and is read through the relationship. Ops needs to
-- know WHICH order to pack, not what the patient's scalp looks like.

CREATE TABLE "ClinicKitFulfilment" (
    "id"                TEXT NOT NULL,

    -- One fulfilment per order. UNIQUE for the same reason as on
    -- KitOrderPayment: it is what makes "create a fulfilment request when
    -- payment is confirmed" idempotent under duplicate webhooks, without a
    -- read-then-write window two concurrent callbacks could both pass.
    "kitOrderIntentId"  TEXT NOT NULL,

    "clinicId"          TEXT NOT NULL,
    "doctorId"          TEXT NOT NULL,
    "assessmentId"      TEXT NOT NULL,

    "mode"              "KitFulfilmentMode"   NOT NULL DEFAULT 'CLINIC',
    "status"            "KitFulfilmentStatus" NOT NULL DEFAULT 'REQUESTED',

    -- One timestamp per business state. Kept as discrete columns rather than a
    -- single `statusChangedAt` because ops SLA questions are asked about
    -- specific legs ("how long between CONFIRMED and DISPATCHED"), which a
    -- single mutable column cannot answer after the fact.
    "requestedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt"       TIMESTAMP(3),
    "packedAt"          TIMESTAMP(3),
    "dispatchedAt"      TIMESTAMP(3),
    "deliveredAt"       TIMESTAMP(3),
    "acknowledgedAt"    TIMESTAMP(3),
    "cancelledAt"       TIMESTAMP(3),

    -- Who acknowledged receipt at the clinic, and free-text ops context
    -- (courier, waybill). Never clinical content.
    "acknowledgedByDoctorId" TEXT,
    "notes"             TEXT,

    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicKitFulfilment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClinicKitFulfilment_kitOrderIntentId_key"
  ON "ClinicKitFulfilment" ("kitOrderIntentId");
CREATE INDEX "ClinicKitFulfilment_clinicId_status_idx"
  ON "ClinicKitFulfilment" ("clinicId", "status");
-- The Ops queue: "everything not finished, oldest first", across tenants.
CREATE INDEX "ClinicKitFulfilment_status_requestedAt_idx"
  ON "ClinicKitFulfilment" ("status", "requestedAt");
CREATE INDEX "ClinicKitFulfilment_assessmentId_idx"
  ON "ClinicKitFulfilment" ("assessmentId");

ALTER TABLE "ClinicKitFulfilment"
  ADD CONSTRAINT "ClinicKitFulfilment_kitOrderIntentId_fkey"
  FOREIGN KEY ("kitOrderIntentId") REFERENCES "KitOrderIntent"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClinicKitFulfilment"
  ADD CONSTRAINT "ClinicKitFulfilment_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClinicKitFulfilment"
  ADD CONSTRAINT "ClinicKitFulfilment_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClinicKitFulfilment"
  ADD CONSTRAINT "ClinicKitFulfilment_assessmentId_fkey"
  FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

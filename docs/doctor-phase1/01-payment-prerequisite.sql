-- REVIEW CANDIDATE ONLY. Production approval and restore-tested backup required.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
CREATE TYPE "KitOrderPaymentStatus" AS ENUM (
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED'
);
CREATE TYPE "KitOrderPaymentSource" AS ENUM (
  'PROVIDER_WEBHOOK',
  'CLINIC_COUNTER'
);
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

ALTER TABLE public."KitOrderPayment" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."KitOrderPayment" FROM PUBLIC, anon, authenticated;
COMMIT;


-- Phase 1: doctor consultation notes + partial kit purchase tracking.
--
-- NOT APPLIED YET. Written under the same baseline-freeze precedent as
-- prisma/migrations/20260829_post_approval_workflow and 20260821_appointments:
-- the feature ships complete and reviewable while readers talk to these objects
-- over raw SQL, so the application compiles and boots whether or not the tables
-- exist. Until someone runs this, the new surfaces report "not provisioned"
-- (HTTP 503 with a stable reason code) rather than throwing — see:
--
--   lib/notes/noteStore.ts
--   lib/commerce/purchaseStore.ts
--
-- Applying this migration is the entire switch-on step. No application code
-- changes with it.
--
-- ── Additive and backward compatible ───────────────────────────────────────
-- Every statement is CREATE. Nothing is dropped, renamed, or retyped; no
-- existing table or row is touched; no historical migration is altered. Foreign
-- keys reference existing tables but add no columns to them.
--
-- ── Rollback ───────────────────────────────────────────────────────────────
-- Reverse order, safe because nothing here is a dependency of the clinical path:
--
--   DROP TABLE "KitPurchaseEvent";
--   DROP TABLE "KitPurchaseLine";
--   DROP TABLE "ConsultationNote";
--   DROP TYPE  "KitPurchaseEventType";
--   DROP TYPE  "KitPurchaseLineStatus";
--   DROP TYPE  "ConsultationNoteStatus";
--   DROP TYPE  "ConsultationNoteInputMode";
--
-- Dropping KitPurchaseEvent/KitPurchaseLine discards purchase history, which is
-- operational/commercial record — export before rolling back in any environment
-- that has recorded a real purchase.

--------------------------------------------------------------------------
-- ENUMS
--------------------------------------------------------------------------

CREATE TYPE "ConsultationNoteInputMode" AS ENUM ('DICTATION', 'TYPED');
CREATE TYPE "ConsultationNoteStatus"    AS ENUM ('ACTIVE', 'AMENDED', 'DELETED');

CREATE TYPE "KitPurchaseLineStatus" AS ENUM (
  'RECOMMENDED',
  'PARTIALLY_PURCHASED',
  'PURCHASED',
  'DEFERRED',
  'DECLINED',
  'SUBSTITUTED',
  'DISCONTINUED'
);

-- Distinct purchase/treatment events. Modelled as separate members rather than
-- one "purchased" flag so a patient-stated purchase is never silently promoted
-- to a clinic-confirmed sale or a recorded payment.
CREATE TYPE "KitPurchaseEventType" AS ENUM (
  'PURCHASE_REPORTED_BY_PATIENT',
  'PURCHASE_CONFIRMED_BY_CLINIC',
  'PAYMENT_RECORDED',
  'DISPENSED',
  'TREATMENT_STARTED',
  'DEFERRED',
  'DECLINED',
  'SUBSTITUTED',
  'DISCONTINUED',
  'REFUNDED',
  'RETURNED'
);

--------------------------------------------------------------------------
-- ConsultationNote — routine, dated, authored visit note
--------------------------------------------------------------------------
--
-- Deliberately separate from ConsultationVersion: a visit note is clinic
-- documentation, not part of the approved AI snapshot or its approval
-- lifecycle. Raw audio is never stored; only the doctor-edited transcript.
CREATE TABLE "ConsultationNote" (
    "id"             TEXT NOT NULL,
    "clinicId"       TEXT NOT NULL,
    "patientId"      TEXT NOT NULL,
    "assessmentId"   TEXT,
    "consultationId" TEXT,
    "authorDoctorId" TEXT NOT NULL,
    "authorName"     TEXT NOT NULL,
    "noteDate"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "body"           TEXT NOT NULL,
    "inputMode"      "ConsultationNoteInputMode" NOT NULL DEFAULT 'TYPED',
    "language"       TEXT NOT NULL DEFAULT 'en-IN',
    "status"         "ConsultationNoteStatus" NOT NULL DEFAULT 'ACTIVE',
    "supersedesId"   TEXT,
    "audioRetained"  BOOLEAN NOT NULL DEFAULT false,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    "deletedAt"      TIMESTAMP(3),

    CONSTRAINT "ConsultationNote_pkey" PRIMARY KEY ("id"),
    -- A note must carry text. Trimmed length is enforced in the writer; the DB
    -- guarantees non-empty so an empty row can never be persisted.
    CONSTRAINT "ConsultationNote_body_nonempty" CHECK (length(btrim("body")) > 0)
);

ALTER TABLE "ConsultationNote"
  ADD CONSTRAINT "ConsultationNote_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConsultationNote"
  ADD CONSTRAINT "ConsultationNote_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConsultationNote"
  ADD CONSTRAINT "ConsultationNote_assessmentId_fkey"
  FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsultationNote"
  ADD CONSTRAINT "ConsultationNote_authorDoctorId_fkey"
  FOREIGN KEY ("authorDoctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConsultationNote"
  ADD CONSTRAINT "ConsultationNote_supersedesId_fkey"
  FOREIGN KEY ("supersedesId") REFERENCES "ConsultationNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ConsultationNote_clinicId_patientId_noteDate_idx"
  ON "ConsultationNote" ("clinicId", "patientId", "noteDate");
CREATE INDEX "ConsultationNote_assessmentId_idx"
  ON "ConsultationNote" ("assessmentId");
CREATE INDEX "ConsultationNote_clinicId_noteDate_idx"
  ON "ConsultationNote" ("clinicId", "noteDate");

--------------------------------------------------------------------------
-- KitPurchaseLine — one line per recommended kit; preserves the full plan
--------------------------------------------------------------------------
CREATE TABLE "KitPurchaseLine" (
    "id"               TEXT NOT NULL,
    "kitOrderIntentId" TEXT NOT NULL,
    "clinicId"         TEXT NOT NULL,
    "assessmentId"     TEXT NOT NULL,
    "patientId"        TEXT NOT NULL,
    "kitId"            TEXT NOT NULL,
    "kitLabel"         TEXT NOT NULL,
    "recommendedBoxes" INTEGER NOT NULL,
    "lineStatus"       "KitPurchaseLineStatus" NOT NULL DEFAULT 'RECOMMENDED',
    "substituteKitId"  TEXT,
    "controlReason"    TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitPurchaseLine_pkey" PRIMARY KEY ("id"),
    -- Box quantity is a count, never negative. Zero is allowed (a kit recorded
    -- with no box quantity defaults upstream, but the column stays honest).
    CONSTRAINT "KitPurchaseLine_recommendedBoxes_nonneg" CHECK ("recommendedBoxes" >= 0)
);

-- One line per (order, kit): the constraint that makes line creation idempotent
-- under duplicate backfills, and the key a purchase event joins against.
CREATE UNIQUE INDEX "KitPurchaseLine_kitOrderIntentId_kitId_key"
  ON "KitPurchaseLine" ("kitOrderIntentId", "kitId");
CREATE INDEX "KitPurchaseLine_clinicId_patientId_idx"
  ON "KitPurchaseLine" ("clinicId", "patientId");
CREATE INDEX "KitPurchaseLine_assessmentId_idx"
  ON "KitPurchaseLine" ("assessmentId");

ALTER TABLE "KitPurchaseLine"
  ADD CONSTRAINT "KitPurchaseLine_kitOrderIntentId_fkey"
  FOREIGN KEY ("kitOrderIntentId") REFERENCES "KitOrderIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KitPurchaseLine"
  ADD CONSTRAINT "KitPurchaseLine_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KitPurchaseLine"
  ADD CONSTRAINT "KitPurchaseLine_assessmentId_fkey"
  FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KitPurchaseLine"
  ADD CONSTRAINT "KitPurchaseLine_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

--------------------------------------------------------------------------
-- KitPurchaseEvent — append-only dated ledger
--------------------------------------------------------------------------
CREATE TABLE "KitPurchaseEvent" (
    "id"                TEXT NOT NULL,
    "kitPurchaseLineId" TEXT NOT NULL,
    "clinicId"          TEXT NOT NULL,
    "assessmentId"      TEXT NOT NULL,
    "eventType"         "KitPurchaseEventType" NOT NULL,
    "boxes"             INTEGER,
    "catalogUnitMinor"  INTEGER,
    "saleValueMinor"    INTEGER,
    "currency"          TEXT NOT NULL DEFAULT 'INR',
    "kitOrderPaymentId" TEXT,
    "occurredAt"        TIMESTAMP(3) NOT NULL,
    "recordedByDoctorId" TEXT NOT NULL,
    "note"              TEXT,
    "clientEventId"     TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitPurchaseEvent_pkey" PRIMARY KEY ("id"),
    -- Box counts and money are never negative; a reversal is its own event
    -- type (REFUNDED/RETURNED), not a negative quantity.
    CONSTRAINT "KitPurchaseEvent_boxes_nonneg" CHECK ("boxes" IS NULL OR "boxes" >= 0),
    CONSTRAINT "KitPurchaseEvent_sale_nonneg"  CHECK ("saleValueMinor" IS NULL OR "saleValueMinor" >= 0),
    CONSTRAINT "KitPurchaseEvent_catalog_nonneg" CHECK ("catalogUnitMinor" IS NULL OR "catalogUnitMinor" >= 0)
);

-- Idempotent event recording: a retried submit carrying the same clientEventId
-- for the same line collapses to one row (ON CONFLICT DO NOTHING in the store).
-- NULLs are distinct in Postgres, so events without a key are never blocked.
CREATE UNIQUE INDEX "KitPurchaseEvent_line_clientEventId_key"
  ON "KitPurchaseEvent" ("kitPurchaseLineId", "clientEventId");
CREATE INDEX "KitPurchaseEvent_line_occurredAt_idx"
  ON "KitPurchaseEvent" ("kitPurchaseLineId", "occurredAt");
CREATE INDEX "KitPurchaseEvent_assessmentId_occurredAt_idx"
  ON "KitPurchaseEvent" ("assessmentId", "occurredAt");
CREATE INDEX "KitPurchaseEvent_clinicId_occurredAt_idx"
  ON "KitPurchaseEvent" ("clinicId", "occurredAt");

ALTER TABLE "KitPurchaseEvent"
  ADD CONSTRAINT "KitPurchaseEvent_kitPurchaseLineId_fkey"
  FOREIGN KEY ("kitPurchaseLineId") REFERENCES "KitPurchaseLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KitPurchaseEvent"
  ADD CONSTRAINT "KitPurchaseEvent_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KitPurchaseEvent"
  ADD CONSTRAINT "KitPurchaseEvent_assessmentId_fkey"
  FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KitPurchaseEvent"
  ADD CONSTRAINT "KitPurchaseEvent_recordedByDoctorId_fkey"
  FOREIGN KEY ("recordedByDoctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

--------------------------------------------------------------------------
-- ROW LEVEL SECURITY
--------------------------------------------------------------------------
--
-- Defense-in-depth for the anon/authenticated Supabase roles, matching the
-- clinic-scoped policy pattern used on Consultation and the knowledge tables
-- (see 20260721_five_kit_real_slice). The application connects over a direct
-- Postgres role and additionally scopes every query by clinicId in the WHERE
-- clause; these policies ensure a leaked anon/authenticated key still cannot
-- read or write across tenants. service_role retains full access for the
-- server. The JWT helpers (public.jwt_is_super_admin / jwt_user_role /
-- jwt_is_clinic_member) are created by the platform-foundation migration.

ALTER TABLE "ConsultationNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KitPurchaseLine"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KitPurchaseEvent" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ConsultationNote_clinic_select" ON "ConsultationNote"
  FOR SELECT TO authenticated
  USING (public.jwt_is_super_admin()
         OR (public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN','STAFF')
             AND public.jwt_is_clinic_member("clinicId")));
CREATE POLICY "ConsultationNote_clinic_write" ON "ConsultationNote"
  FOR ALL TO authenticated
  USING (public.jwt_is_super_admin()
         OR (public.jwt_user_role() = 'DOCTOR' AND public.jwt_is_clinic_member("clinicId")))
  WITH CHECK (public.jwt_is_super_admin()
         OR (public.jwt_user_role() = 'DOCTOR' AND public.jwt_is_clinic_member("clinicId")));

CREATE POLICY "KitPurchaseLine_clinic_select" ON "KitPurchaseLine"
  FOR SELECT TO authenticated
  USING (public.jwt_is_super_admin()
         OR (public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN','STAFF')
             AND public.jwt_is_clinic_member("clinicId")));
CREATE POLICY "KitPurchaseLine_clinic_write" ON "KitPurchaseLine"
  FOR ALL TO authenticated
  USING (public.jwt_is_super_admin()
         OR (public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN') AND public.jwt_is_clinic_member("clinicId")))
  WITH CHECK (public.jwt_is_super_admin()
         OR (public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN') AND public.jwt_is_clinic_member("clinicId")));

CREATE POLICY "KitPurchaseEvent_clinic_select" ON "KitPurchaseEvent"
  FOR SELECT TO authenticated
  USING (public.jwt_is_super_admin()
         OR (public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN','STAFF')
             AND public.jwt_is_clinic_member("clinicId")));
CREATE POLICY "KitPurchaseEvent_clinic_write" ON "KitPurchaseEvent"
  FOR ALL TO authenticated
  USING (public.jwt_is_super_admin()
         OR (public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN') AND public.jwt_is_clinic_member("clinicId")))
  WITH CHECK (public.jwt_is_super_admin()
         OR (public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN') AND public.jwt_is_clinic_member("clinicId")));

GRANT SELECT, INSERT, UPDATE ON "ConsultationNote" TO authenticated;
GRANT SELECT, INSERT, UPDATE ON "KitPurchaseLine"  TO authenticated;
GRANT SELECT, INSERT          ON "KitPurchaseEvent" TO authenticated;
GRANT ALL ON "ConsultationNote", "KitPurchaseLine", "KitPurchaseEvent" TO service_role;

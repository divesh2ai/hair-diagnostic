-- ============================================================================
-- Release 2 — ATOMIC production apply bundle (A + B + C in ONE transaction)
-- ============================================================================
-- Fail-safe against inter-step direct-write exposure: the new tables are never
-- visible to any other session (anon/authenticated via PostgREST) until the
-- single COMMIT, by which point migration C's REVOKEs are already in effect.
-- Any failure rolls the whole bundle back -> no tables created, clean recovery.
-- Run as ONE transaction (psql \i / Supabase SQL editor Run). Do NOT let an
-- outer runner also wrap it; this file owns the transaction.
-- Component provenance (original reviewed checksums, unchanged):
--   A 20261023_doctor_notes_and_partial_kit  sha256 427d8f28...863011 (matches staging)
--   B 20261030_partial_checkout_transactions sha256 5c1b4a4d...555019
--   C 20261031_release2_grant_hardening      sha256 (see package table)
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

-- ---- A ---------------------------------------------------------------------
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

-- ---- B --------------------------------------------------------------------
-- REVIEWED STAGING-ONLY CANDIDATE. Original 3ea5381 is preserved separately.
-- Execute as one transaction; new enum values must not be used before COMMIT.
-- Release 2. Additive; apply to staging first. Never rewrite the Phase 1 ledger.
ALTER TYPE "KitPurchaseEventType" ADD VALUE IF NOT EXISTS 'EXTERNALLY_OBTAINED';
ALTER TYPE "KitPurchaseEventType" ADD VALUE IF NOT EXISTS 'CONTINUED';

CREATE TABLE "KitPurchaseTransaction" (
  "id" TEXT PRIMARY KEY,
  "kitOrderIntentId" TEXT NOT NULL REFERENCES "KitOrderIntent"("id") ON DELETE RESTRICT,
  "clinicId" TEXT NOT NULL REFERENCES "Clinic"("id") ON DELETE RESTRICT,
  "assessmentId" TEXT NOT NULL REFERENCES "Assessment"("id") ON DELETE RESTRICT,
  "clientTransactionId" TEXT NOT NULL,
  "selection" JSONB NOT NULL CHECK (jsonb_typeof("selection") = 'array' AND jsonb_array_length("selection") > 0),
  "amountMinor" INTEGER NOT NULL CHECK ("amountMinor" > 0),
  "currency" TEXT NOT NULL DEFAULT 'INR' CHECK ("currency" = 'INR'),
  "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','PAID','CANCELLED','REFUNDED')),
  "reference" TEXT,
  "recordedByDoctorId" TEXT REFERENCES "Doctor"("id") ON DELETE RESTRICT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3),
  "refundedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("kitOrderIntentId", "clientTransactionId"),
  UNIQUE ("clinicId", "reference")
);
CREATE INDEX "KitPurchaseTransaction_clinic_intent_idx" ON "KitPurchaseTransaction" ("clinicId", "kitOrderIntentId", "createdAt");
ALTER TABLE "KitPurchaseEvent" ADD COLUMN "transactionId" TEXT REFERENCES "KitPurchaseTransaction"("id") ON DELETE RESTRICT;
ALTER TABLE "KitPurchaseEvent" ADD COLUMN "substituteKitId" TEXT;
CREATE INDEX "KitPurchaseEvent_transactionId_idx" ON "KitPurchaseEvent"("transactionId");

ALTER TABLE "KitPurchaseTransaction" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "KitPurchaseTransaction_clinic_select" ON "KitPurchaseTransaction"
  FOR SELECT TO authenticated USING (
    public.jwt_is_super_admin() OR
    (public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN','STAFF') AND public.jwt_is_clinic_member("clinicId"))
  );
-- Money transitions are server-only. A browser JWT cannot self-assert PAID.
GRANT SELECT ON "KitPurchaseTransaction" TO authenticated;
GRANT ALL ON "KitPurchaseTransaction" TO service_role;

-- RLS-independent relational integrity for purchase lines. Parent primary IDs
-- already guarantee these composite keys are unique. No parent SELECT policy
-- or privilege is widened, and no SECURITY DEFINER function is introduced.
ALTER TABLE "KitOrderIntent" ADD CONSTRAINT "r2_order_clinic_assessment_key"
  UNIQUE ("id", "clinicId", "assessmentId");
ALTER TABLE "Assessment" ADD CONSTRAINT "r2_assessment_clinic_patient_key"
  UNIQUE ("id", "clinicId", "patientId");
ALTER TABLE "KitPurchaseLine" ADD CONSTRAINT "r2_line_order_clinic_assessment_fkey"
  FOREIGN KEY ("kitOrderIntentId", "clinicId", "assessmentId")
  REFERENCES "KitOrderIntent" ("id", "clinicId", "assessmentId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KitPurchaseLine" ADD CONSTRAINT "r2_line_assessment_clinic_patient_fkey"
  FOREIGN KEY ("assessmentId", "clinicId", "patientId")
  REFERENCES "Assessment" ("id", "clinicId", "patientId") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Kit-array membership is intentionally not revalidated on legacy status edits.
-- The application validates new materialisation and checkout against approved
-- kitIds. Historical lines for removed kits retain their facts and control history.

-- Enforce tenant associations even for direct PostgREST writes to Phase 1 tables.
CREATE FUNCTION public.check_release2_associations() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'KitPurchaseEvent' THEN
    IF NOT EXISTS (SELECT 1 FROM public."KitPurchaseLine" l WHERE l.id=NEW."kitPurchaseLineId"
      AND l."clinicId"=NEW."clinicId" AND l."assessmentId"=NEW."assessmentId")
      OR NOT EXISTS (SELECT 1 FROM public."Doctor" d WHERE d.id=NEW."recordedByDoctorId" AND d."clinicId"=NEW."clinicId")
      OR (NEW."transactionId" IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public."KitPurchaseTransaction" t JOIN public."KitPurchaseLine" l ON l.id=NEW."kitPurchaseLineId"
        WHERE t.id=NEW."transactionId" AND t."clinicId"=NEW."clinicId" AND t."kitOrderIntentId"=l."kitOrderIntentId"))
    THEN RAISE EXCEPTION 'purchase_event_association' USING ERRCODE='23514'; END IF;
  ELSIF TG_TABLE_NAME = 'ConsultationNote' THEN
    IF NOT EXISTS (SELECT 1 FROM public."Patient" p WHERE p.id=NEW."patientId" AND p."clinicId"=NEW."clinicId")
      OR NOT EXISTS (SELECT 1 FROM public."Doctor" d WHERE d.id=NEW."authorDoctorId" AND d."clinicId"=NEW."clinicId")
      OR (NEW."assessmentId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."Assessment" a WHERE a.id=NEW."assessmentId" AND a."clinicId"=NEW."clinicId" AND a."patientId"=NEW."patientId"))
    THEN RAISE EXCEPTION 'note_association' USING ERRCODE='23514'; END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public."KitOrderIntent" i WHERE i.id=NEW."kitOrderIntentId"
      AND i."clinicId"=NEW."clinicId" AND i."assessmentId"=NEW."assessmentId")
      OR (NEW."recordedByDoctorId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."Doctor" d WHERE d.id=NEW."recordedByDoctorId" AND d."clinicId"=NEW."clinicId"))
    THEN RAISE EXCEPTION 'transaction_association' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER release2_event_associations BEFORE INSERT ON "KitPurchaseEvent" FOR EACH ROW EXECUTE FUNCTION public.check_release2_associations();
CREATE TRIGGER release2_note_associations BEFORE INSERT OR UPDATE ON "ConsultationNote" FOR EACH ROW EXECUTE FUNCTION public.check_release2_associations();
CREATE TRIGGER release2_transaction_associations BEFORE INSERT OR UPDATE ON "KitPurchaseTransaction" FOR EACH ROW EXECUTE FUNCTION public.check_release2_associations();

-- ---- C (hardening; runs before COMMIT, so no committed exposure) ----------
-- Release 2 — production privilege hardening (migration C).
--
-- WHY THIS EXISTS (production-specific):
-- Production's public-schema DEFAULT PRIVILEGES auto-grant ALL table privileges
-- to roles `anon` and `authenticated` on every newly CREATEd table (verified:
-- pg_default_acl shows anon=arwdDxtm/postgres). Migrations A and B therefore
-- leave the new Release-2 tables writable by anon/authenticated at the GRANT
-- level (RLS still gates rows, but defense-in-depth requires the privilege be
-- removed too). This migration reproduces the hardened grant posture observed
-- on hairos-staging for the financial tables and additionally closes the
-- ConsultationNote anon leak that staging still carries.
--
-- Net effect:
--   * anon / PUBLIC        -> NO privileges on any Release-2 table.
--   * authenticated        -> SELECT only on ALL FOUR Release-2 tables, including
--                             ConsultationNote. The browser-held authenticated JWT can
--                             read (clinic-scoped under RLS) but can never write directly.
--                             Server-side note authoring/amend + auditing are UNAFFECTED:
--                             the app writes ConsultationNote via Prisma raw SQL over
--                             DATABASE_URL (a direct privileged Postgres role), and the
--                             server runtime uses service_role — neither is `authenticated`.
--   * service_role         -> full access (server runtime).
--
-- Idempotent and non-destructive: only GRANT/REVOKE, no data touched. Safe to
-- re-run. Wrapped in a single transaction with short lock/statement timeouts.


-- 1) Remove anonymous and PUBLIC access entirely from all Release-2 tables.
REVOKE ALL ON TABLE "ConsultationNote", "KitPurchaseLine", "KitPurchaseEvent", "KitPurchaseTransaction" FROM anon;
REVOKE ALL ON TABLE "ConsultationNote", "KitPurchaseLine", "KitPurchaseEvent", "KitPurchaseTransaction" FROM PUBLIC;

-- 2) Financial facts: authenticated may READ only. Every write (INSERT of a
--    purchase/payment event, status transition) is performed by the server
--    using service_role. A browser-held authenticated JWT cannot write.
REVOKE ALL ON TABLE "KitPurchaseLine"        FROM authenticated;
REVOKE ALL ON TABLE "KitPurchaseEvent"       FROM authenticated;
REVOKE ALL ON TABLE "KitPurchaseTransaction" FROM authenticated;
GRANT SELECT ON TABLE "KitPurchaseLine"        TO authenticated;
GRANT SELECT ON TABLE "KitPurchaseEvent"       TO authenticated;
GRANT SELECT ON TABLE "KitPurchaseTransaction" TO authenticated;

-- 3) Clinical notes: authenticated may READ only (clinic-scoped under RLS).
--    All note writes (create/amend) are performed server-side via Prisma over
--    DATABASE_URL / service_role, never by the browser authenticated JWT.
REVOKE ALL ON TABLE "ConsultationNote" FROM authenticated;
GRANT SELECT ON TABLE "ConsultationNote" TO authenticated;

-- 4) Server runtime retains full access.
GRANT ALL ON TABLE "ConsultationNote", "KitPurchaseLine", "KitPurchaseEvent", "KitPurchaseTransaction" TO service_role;

COMMIT;

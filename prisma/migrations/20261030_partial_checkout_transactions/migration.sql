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

-- Enforce tenant associations even for direct PostgREST writes to Phase 1 tables.
CREATE FUNCTION public.check_release2_associations() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'KitPurchaseLine' THEN
    IF NOT EXISTS (SELECT 1 FROM "KitOrderIntent" i JOIN "Consultation" c ON c.id=i."consultationId"
      WHERE i.id=NEW."kitOrderIntentId" AND i."clinicId"=NEW."clinicId"
        AND i."assessmentId"=NEW."assessmentId" AND c."patientId"=NEW."patientId"
        AND NEW."kitId"=ANY(i."kitIds")) THEN RAISE EXCEPTION 'purchase_line_association' USING ERRCODE='23514'; END IF;
  ELSIF TG_TABLE_NAME = 'KitPurchaseEvent' THEN
    IF NOT EXISTS (SELECT 1 FROM "KitPurchaseLine" l WHERE l.id=NEW."kitPurchaseLineId"
      AND l."clinicId"=NEW."clinicId" AND l."assessmentId"=NEW."assessmentId")
      OR NOT EXISTS (SELECT 1 FROM "Doctor" d WHERE d.id=NEW."recordedByDoctorId" AND d."clinicId"=NEW."clinicId")
      OR (NEW."transactionId" IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM "KitPurchaseTransaction" t JOIN "KitPurchaseLine" l ON l.id=NEW."kitPurchaseLineId"
        WHERE t.id=NEW."transactionId" AND t."clinicId"=NEW."clinicId" AND t."kitOrderIntentId"=l."kitOrderIntentId"))
    THEN RAISE EXCEPTION 'purchase_event_association' USING ERRCODE='23514'; END IF;
  ELSIF TG_TABLE_NAME = 'ConsultationNote' THEN
    IF NOT EXISTS (SELECT 1 FROM "Patient" p WHERE p.id=NEW."patientId" AND p."clinicId"=NEW."clinicId")
      OR NOT EXISTS (SELECT 1 FROM "Doctor" d WHERE d.id=NEW."authorDoctorId" AND d."clinicId"=NEW."clinicId")
      OR (NEW."assessmentId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Assessment" a WHERE a.id=NEW."assessmentId" AND a."clinicId"=NEW."clinicId" AND a."patientId"=NEW."patientId"))
    THEN RAISE EXCEPTION 'note_association' USING ERRCODE='23514'; END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM "KitOrderIntent" i WHERE i.id=NEW."kitOrderIntentId"
      AND i."clinicId"=NEW."clinicId" AND i."assessmentId"=NEW."assessmentId")
      OR (NEW."recordedByDoctorId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Doctor" d WHERE d.id=NEW."recordedByDoctorId" AND d."clinicId"=NEW."clinicId"))
    THEN RAISE EXCEPTION 'transaction_association' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER release2_line_associations BEFORE INSERT OR UPDATE ON "KitPurchaseLine" FOR EACH ROW EXECUTE FUNCTION public.check_release2_associations();
CREATE TRIGGER release2_event_associations BEFORE INSERT ON "KitPurchaseEvent" FOR EACH ROW EXECUTE FUNCTION public.check_release2_associations();
CREATE TRIGGER release2_note_associations BEFORE INSERT OR UPDATE ON "ConsultationNote" FOR EACH ROW EXECUTE FUNCTION public.check_release2_associations();
CREATE TRIGGER release2_transaction_associations BEFORE INSERT OR UPDATE ON "KitPurchaseTransaction" FOR EACH ROW EXECUTE FUNCTION public.check_release2_associations();

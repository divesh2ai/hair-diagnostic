-- ============================================================================
-- PROPOSED — B4 RLS remediation for the 17 RLS-disabled public tables
-- STAGING ONLY · FOR REVIEW · NOT APPLIED · DO NOT PLACE IN prisma/migrations/
-- ============================================================================
--
-- Supabase's linter (0013_rls_disabled_in_public) flags 17 tables in `public`
-- that are exposed through PostgREST to the `anon` / `authenticated` roles with
-- RLS OFF — every row readable/writable by anyone holding the anon key. The
-- most sensitive is `ReportAsset` (patient report assets). This script brings
-- those tables in line with the ~40 tables already protected by
-- `prisma/staging-security-repair.generated.sql`, reusing the SAME
-- `jwt_is_super_admin()` / `jwt_is_clinic_member(text)` helpers.
--
-- WHY THIS IS SAFE FOR THE APP
--   The app connects via Prisma using the service-role / direct Postgres
--   connection, which BYPASSES RLS. Enabling RLS + policies therefore changes
--   nothing for server-side app queries; it only closes the anon/authenticated
--   PostgREST door that should never have been open. This is exactly how the
--   already-protected tables behave today.
--
-- REVIEW NOTES / OPEN QUESTIONS (flagged, do not apply blind)
--   • Tier 1 tables carry a direct `clinicId` → clean, high-confidence scoping.
--   • Tier 2 (commerce) tables scope via `doctorId`→Doctor.clinicId or via a
--     parent row. They are currently EMPTY and purchasing is gated off, so they
--     are lower urgency; their policies use new SECURITY DEFINER helpers so the
--     cross-table lookup is not itself RLS-filtered. Confirm the doctor→clinic
--     ownership model is the intended tenancy boundary for commerce before
--     applying.
--   • Every policy grants SUPER_ADMIN full access and clinic members access to
--     their own clinic's rows, matching PlatformSettings/Clinic/Subscription.
--   • Run the anon-key negative test (see tests/admin/rls-remediation-proposal
--     notes) against staging AFTER applying, then re-run the Supabase advisor.
--   • Production was NOT inspected; check it separately before any prod change.
--
-- Idempotent: DROP POLICY IF EXISTS before each CREATE. ENABLE ROW LEVEL
-- SECURITY is a no-op if already on.
-- ============================================================================

BEGIN;

-- ── New SECURITY DEFINER helpers for indirectly-scoped tables ───────────────
-- SECURITY DEFINER so the ownership lookup runs without being re-filtered by
-- the referenced table's own RLS. STABLE + pinned search_path, matching the
-- existing jwt_* helpers.

CREATE OR REPLACE FUNCTION public.jwt_is_member_of_doctor_clinic(target_doctor_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT target_doctor_id IS NOT NULL
     AND public.jwt_is_clinic_member(
           (SELECT d."clinicId" FROM "Doctor" d WHERE d."id" = target_doctor_id)
         );
$$;

CREATE OR REPLACE FUNCTION public.jwt_is_member_of_order_clinic(target_order_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.jwt_is_member_of_doctor_clinic(
           (SELECT o."doctorId" FROM "CatalogOrder" o WHERE o."id" = target_order_id)
         );
$$;

-- ── TIER 1 — direct clinicId (high confidence) ──────────────────────────────

-- ReportAsset (159 rows on staging — patient report assets; most sensitive)
ALTER TABLE "ReportAsset" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ReportAsset_select" ON "ReportAsset";
CREATE POLICY "ReportAsset_select" ON "ReportAsset" FOR SELECT TO authenticated
  USING (public.jwt_is_super_admin() OR public.jwt_is_clinic_member("clinicId"));
DROP POLICY IF EXISTS "ReportAsset_modify" ON "ReportAsset";
CREATE POLICY "ReportAsset_modify" ON "ReportAsset" FOR ALL TO authenticated
  USING (public.jwt_is_super_admin() OR public.jwt_is_clinic_member("clinicId"))
  WITH CHECK (public.jwt_is_super_admin() OR public.jwt_is_clinic_member("clinicId"));

-- SupportTicket
ALTER TABLE "SupportTicket" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "SupportTicket_select" ON "SupportTicket";
CREATE POLICY "SupportTicket_select" ON "SupportTicket" FOR SELECT TO authenticated
  USING (public.jwt_is_super_admin() OR public.jwt_is_clinic_member("clinicId"));
DROP POLICY IF EXISTS "SupportTicket_modify" ON "SupportTicket";
CREATE POLICY "SupportTicket_modify" ON "SupportTicket" FOR ALL TO authenticated
  USING (public.jwt_is_super_admin() OR public.jwt_is_clinic_member("clinicId"))
  WITH CHECK (public.jwt_is_super_admin() OR public.jwt_is_clinic_member("clinicId"));

-- KitOrderPayment
ALTER TABLE "KitOrderPayment" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "KitOrderPayment_select" ON "KitOrderPayment";
CREATE POLICY "KitOrderPayment_select" ON "KitOrderPayment" FOR SELECT TO authenticated
  USING (public.jwt_is_super_admin() OR public.jwt_is_clinic_member("clinicId"));
DROP POLICY IF EXISTS "KitOrderPayment_modify" ON "KitOrderPayment";
CREATE POLICY "KitOrderPayment_modify" ON "KitOrderPayment" FOR ALL TO authenticated
  USING (public.jwt_is_super_admin() OR public.jwt_is_clinic_member("clinicId"))
  WITH CHECK (public.jwt_is_super_admin() OR public.jwt_is_clinic_member("clinicId"));

-- ClinicKitFulfilment
ALTER TABLE "ClinicKitFulfilment" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ClinicKitFulfilment_select" ON "ClinicKitFulfilment";
CREATE POLICY "ClinicKitFulfilment_select" ON "ClinicKitFulfilment" FOR SELECT TO authenticated
  USING (public.jwt_is_super_admin() OR public.jwt_is_clinic_member("clinicId"));
DROP POLICY IF EXISTS "ClinicKitFulfilment_modify" ON "ClinicKitFulfilment";
CREATE POLICY "ClinicKitFulfilment_modify" ON "ClinicKitFulfilment" FOR ALL TO authenticated
  USING (public.jwt_is_super_admin() OR public.jwt_is_clinic_member("clinicId"))
  WITH CHECK (public.jwt_is_super_admin() OR public.jwt_is_clinic_member("clinicId"));

-- Appointment
ALTER TABLE "Appointment" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Appointment_select" ON "Appointment";
CREATE POLICY "Appointment_select" ON "Appointment" FOR SELECT TO authenticated
  USING (public.jwt_is_super_admin() OR public.jwt_is_clinic_member("clinicId"));
DROP POLICY IF EXISTS "Appointment_modify" ON "Appointment";
CREATE POLICY "Appointment_modify" ON "Appointment" FOR ALL TO authenticated
  USING (public.jwt_is_super_admin() OR public.jwt_is_clinic_member("clinicId"))
  WITH CHECK (public.jwt_is_super_admin() OR public.jwt_is_clinic_member("clinicId"));

-- Brochure
ALTER TABLE "Brochure" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Brochure_select" ON "Brochure";
CREATE POLICY "Brochure_select" ON "Brochure" FOR SELECT TO authenticated
  USING (public.jwt_is_super_admin() OR public.jwt_is_clinic_member("clinicId"));
DROP POLICY IF EXISTS "Brochure_modify" ON "Brochure";
CREATE POLICY "Brochure_modify" ON "Brochure" FOR ALL TO authenticated
  USING (public.jwt_is_super_admin() OR public.jwt_is_clinic_member("clinicId"))
  WITH CHECK (public.jwt_is_super_admin() OR public.jwt_is_clinic_member("clinicId"));

-- ── TIER 1 children — scope via parent's clinicId ───────────────────────────

-- BrochureHotspot → Brochure.clinicId
ALTER TABLE "BrochureHotspot" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "BrochureHotspot_all" ON "BrochureHotspot";
CREATE POLICY "BrochureHotspot_all" ON "BrochureHotspot" FOR ALL TO authenticated
  USING (public.jwt_is_super_admin() OR public.jwt_is_clinic_member(
           (SELECT b."clinicId" FROM "Brochure" b WHERE b."id" = "brochureId")))
  WITH CHECK (public.jwt_is_super_admin() OR public.jwt_is_clinic_member(
           (SELECT b."clinicId" FROM "Brochure" b WHERE b."id" = "brochureId")));

-- SupportMessage → SupportTicket.clinicId
ALTER TABLE "SupportMessage" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "SupportMessage_all" ON "SupportMessage";
CREATE POLICY "SupportMessage_all" ON "SupportMessage" FOR ALL TO authenticated
  USING (public.jwt_is_super_admin() OR public.jwt_is_clinic_member(
           (SELECT t."clinicId" FROM "SupportTicket" t WHERE t."id" = "ticketId")))
  WITH CHECK (public.jwt_is_super_admin() OR public.jwt_is_clinic_member(
           (SELECT t."clinicId" FROM "SupportTicket" t WHERE t."id" = "ticketId")));

-- ── TIER 2 — commerce (doctor-scoped; currently empty + purchasing gated) ────
-- Confirm doctor→clinic is the intended tenancy boundary before applying.

-- DoctorAddress → Doctor.clinicId
ALTER TABLE "DoctorAddress" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "DoctorAddress_all" ON "DoctorAddress";
CREATE POLICY "DoctorAddress_all" ON "DoctorAddress" FOR ALL TO authenticated
  USING (public.jwt_is_super_admin() OR public.jwt_is_member_of_doctor_clinic("doctorId"))
  WITH CHECK (public.jwt_is_super_admin() OR public.jwt_is_member_of_doctor_clinic("doctorId"));

-- CatalogCart → Doctor.clinicId
ALTER TABLE "CatalogCart" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CatalogCart_all" ON "CatalogCart";
CREATE POLICY "CatalogCart_all" ON "CatalogCart" FOR ALL TO authenticated
  USING (public.jwt_is_super_admin() OR public.jwt_is_member_of_doctor_clinic("doctorId"))
  WITH CHECK (public.jwt_is_super_admin() OR public.jwt_is_member_of_doctor_clinic("doctorId"));

-- CatalogCartItem → CatalogCart.doctorId → Doctor.clinicId
ALTER TABLE "CatalogCartItem" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CatalogCartItem_all" ON "CatalogCartItem";
CREATE POLICY "CatalogCartItem_all" ON "CatalogCartItem" FOR ALL TO authenticated
  USING (public.jwt_is_super_admin() OR public.jwt_is_member_of_doctor_clinic(
           (SELECT c."doctorId" FROM "CatalogCart" c WHERE c."id" = "cartId")))
  WITH CHECK (public.jwt_is_super_admin() OR public.jwt_is_member_of_doctor_clinic(
           (SELECT c."doctorId" FROM "CatalogCart" c WHERE c."id" = "cartId")));

-- CatalogOrder → Doctor.clinicId
ALTER TABLE "CatalogOrder" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CatalogOrder_all" ON "CatalogOrder";
CREATE POLICY "CatalogOrder_all" ON "CatalogOrder" FOR ALL TO authenticated
  USING (public.jwt_is_super_admin() OR public.jwt_is_member_of_doctor_clinic("doctorId"))
  WITH CHECK (public.jwt_is_super_admin() OR public.jwt_is_member_of_doctor_clinic("doctorId"));

-- CatalogOrderItem → CatalogOrder
ALTER TABLE "CatalogOrderItem" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CatalogOrderItem_all" ON "CatalogOrderItem";
CREATE POLICY "CatalogOrderItem_all" ON "CatalogOrderItem" FOR ALL TO authenticated
  USING (public.jwt_is_super_admin() OR public.jwt_is_member_of_order_clinic("orderId"))
  WITH CHECK (public.jwt_is_super_admin() OR public.jwt_is_member_of_order_clinic("orderId"));

-- PaymentTransaction → CatalogOrder
ALTER TABLE "PaymentTransaction" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "PaymentTransaction_all" ON "PaymentTransaction";
CREATE POLICY "PaymentTransaction_all" ON "PaymentTransaction" FOR ALL TO authenticated
  USING (public.jwt_is_super_admin() OR public.jwt_is_member_of_order_clinic("orderId"))
  WITH CHECK (public.jwt_is_super_admin() OR public.jwt_is_member_of_order_clinic("orderId"));

-- CatalogShipment → CatalogOrder
ALTER TABLE "CatalogShipment" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CatalogShipment_all" ON "CatalogShipment";
CREATE POLICY "CatalogShipment_all" ON "CatalogShipment" FOR ALL TO authenticated
  USING (public.jwt_is_super_admin() OR public.jwt_is_member_of_order_clinic("orderId"))
  WITH CHECK (public.jwt_is_super_admin() OR public.jwt_is_member_of_order_clinic("orderId"));

-- CatalogShipmentEvent → CatalogShipment → CatalogOrder
ALTER TABLE "CatalogShipmentEvent" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CatalogShipmentEvent_all" ON "CatalogShipmentEvent";
CREATE POLICY "CatalogShipmentEvent_all" ON "CatalogShipmentEvent" FOR ALL TO authenticated
  USING (public.jwt_is_super_admin() OR public.jwt_is_member_of_order_clinic(
           (SELECT s."orderId" FROM "CatalogShipment" s WHERE s."id" = "shipmentId")))
  WITH CHECK (public.jwt_is_super_admin() OR public.jwt_is_member_of_order_clinic(
           (SELECT s."orderId" FROM "CatalogShipment" s WHERE s."id" = "shipmentId")));

-- CatalogueEvent → Doctor.clinicId (analytics; doctorId nullable → super-admin only when null)
ALTER TABLE "CatalogueEvent" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CatalogueEvent_all" ON "CatalogueEvent";
CREATE POLICY "CatalogueEvent_all" ON "CatalogueEvent" FOR ALL TO authenticated
  USING (public.jwt_is_super_admin() OR public.jwt_is_member_of_doctor_clinic("doctorId"))
  WITH CHECK (public.jwt_is_super_admin() OR public.jwt_is_member_of_doctor_clinic("doctorId"));

COMMIT;

-- ── Post-apply verification (run manually; do not include in the apply) ──────
--   1. SELECT advisor: expect 0 rows for rls_disabled_in_public.
--   2. anon-key negative test: with the anon key (no JWT), `select * from
--      "ReportAsset"` must return 0 rows / be denied.
--   3. authenticated cross-clinic test: a DOCTOR JWT for clinic A must see 0
--      rows of clinic B's ReportAsset/SupportTicket.
--   4. app smoke test: Prisma/service-role reads are unchanged (RLS bypassed).

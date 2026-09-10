-- Production WhatsApp report delivery: patient consent + two delivery states
-- the provider layer needed and did not have a place to record.
--
-- Follows the 20260829_post_approval_workflow / 20260907_report_asset_pipeline
-- precedent: additive only, every reader that touches these columns already
-- goes over raw SQL guarded by DeliveryNotProvisionedError (see
-- lib/delivery/deliveryStore.ts), so the app compiles and boots whether or not
-- this has been applied yet in a given environment.
--
-- Applying this migration is the entire switch-on step for:
--   * WhatsApp consent gating (lib/delivery/sendPatientLink.ts)
--   * distinguishing "credentials missing" (CONFIGURATION_ERROR) and
--     "blocked, no consent" (BLOCKED_NO_CONSENT) from a genuine provider
--     FAILED, which the doctor UI's retry-eligibility depends on
--     (lib/delivery/deliveryStore.ts, DecisionBar.tsx)
--
-- ── Why no new value for READ ────────────────────────────────────────────────
-- Deliberately not adding one. `WhatsappDelivery.readAt` (added in
-- 20260829_post_approval_workflow) already answers "has this been read, and
-- when" — a null there means "never told", which is honest, where a status
-- enum member would have to assert something about a message nobody has
-- reported on yet. Keeping that design rather than duplicating it as a status.
--
-- ── Rollback ─────────────────────────────────────────────────────────────────
-- Postgres cannot drop a single enum value. Reversing this cleanly requires
-- recreating "DeliveryStatus" without the two new members (rename old type,
-- create new one, migrate the column, drop the old type) — only necessary if
-- a row has actually been written with one of these statuses; until then
-- dropping the three Patient columns is sufficient:
--   ALTER TABLE "Patient" DROP COLUMN "whatsappConsent",
--                         DROP COLUMN "whatsappConsentAt",
--                         DROP COLUMN "whatsappConsentSource";

--------------------------------------------------------------------------
-- ENUM — two new terminal states for WhatsappDelivery.status
--------------------------------------------------------------------------

-- Selected provider is unreachable/unusable because credentials for the
-- resolved sender (central or clinic-specific) are missing or invalid. Never
-- the same row as FAILED: a doctor's UI must not offer "Retry WhatsApp" for a
-- deployment issue nobody but an operator can fix, and CONFIGURATION_ERROR is
-- how the retry-eligibility check tells the two apart.
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'CONFIGURATION_ERROR';

-- The patient has not given WhatsApp consent (or it was never captured).
-- Written INSTEAD OF calling the provider — a BLOCKED_NO_CONSENT row proves an
-- automated send was attempted and correctly refused, without ever having
-- contacted Meta.
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'BLOCKED_NO_CONSENT';

--------------------------------------------------------------------------
-- Patient — WhatsApp consent
--------------------------------------------------------------------------

-- Explicit opt-in, captured at intake (or later, from the doctor workspace).
-- Defaults false: automated delivery must never fire for a patient who has
-- not been asked, which a default of true would silently allow for every
-- historical row the moment this migration runs.
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "whatsappConsent" BOOLEAN NOT NULL DEFAULT false;

-- When consent was recorded. Null on every row until a real consent event
-- happens — including all pre-existing patients, whose consent this
-- migration does not, and must not, invent.
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "whatsappConsentAt" TIMESTAMP(3);

-- Free-form provenance ("intake_form_v1", "doctor_workspace_manual", …) — not
-- an enum, because the set of places consent can be captured will grow (a
-- clinic-QR flow, a patient portal toggle) and each is a deployment fact, not
-- a schema decision.
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "whatsappConsentSource" TEXT;

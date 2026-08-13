-- Slice 1 — invitation lifecycle hardening.
--
-- Two nullable/defaulted columns support the Resend operation:
--   • resendCount enforces the P0 per-invitation ceiling (10)
--   • lastResentAt enforces the 60s cool-down + participates in the CAS
--     that prevents two concurrent Resend clicks from both delivering.
--
-- No enum change (kept PENDING / ACCEPTED / EXPIRED / REVOKED).
-- No consumedAt / attempts / deletedAt (activation slice may add them).

ALTER TABLE "ClinicInvitation"
  ADD COLUMN "resendCount"  INTEGER   NOT NULL DEFAULT 0,
  ADD COLUMN "lastResentAt" TIMESTAMP(3);

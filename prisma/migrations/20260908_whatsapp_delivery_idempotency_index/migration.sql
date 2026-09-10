-- Close a real concurrency race exposed by the staging operationalization
-- gate: two simultaneous "Share" requests for the same (assessment, subject,
-- consultationVersionId) both passed `findExistingSuccessfulDelivery`'s
-- SELECT before either had written a row, so both proceeded to call the
-- provider and both wrote a SENT row. Live-reproduced against staging:
--   2 requests in → 2 SENT rows, 2 distinct provider message ids, both
--   responses reporting `alreadySent: false`.
--
-- ── The fix, and why a partial index ─────────────────────────────────────────
-- The application-level check (SELECT, then branch, then INSERT) cannot be
-- made atomic without a database constraint — that is what "checked before
-- you have a row" always allows a caller to slip through concurrently. A
-- unique index moves the actual serialization to Postgres: the SECOND insert
-- for the same tuple fails immediately, rather than succeeding and leaving
-- two winners.
--
-- Scoped to `consultationVersionId IS NOT NULL` and status IN
-- ('PENDING','SENT','DELIVERED') — deliberately NOT every status:
--   * NULL consultationVersionId is CART (approval is read from the order,
--     not a version) — sendPatientLink.ts already documents that CART is out
--     of scope for this idempotency check, and NULL never collides with NULL
--     in a unique index, so this index leaves that behaviour untouched.
--   * Excluding FAILED / CONFIGURATION_ERROR / BLOCKED_NO_CONSENT is what
--     keeps retry working: a doctor pressing "Retry WhatsApp" after a FAILED
--     attempt must be able to open a NEW row for the same tuple. Only an
--     in-flight (PENDING) or already-successful (SENT/DELIVERED) row blocks a
--     second one.
--
-- ── Application-side ──────────────────────────────────────────────────────
-- `consultationVersionId` is now written on the INSERT itself, not only in
-- the later provenance update — see deliveryStore.ts's createDelivery. The
-- losing side of a race catches the resulting unique-violation
-- (`DeliveryRaceLostError`) and reads back the winner's row instead of
-- throwing — see sendPatientLink.ts.
--
-- ── Rollback ─────────────────────────────────────────────────────────────────
--   DROP INDEX IF EXISTS "WhatsappDelivery_idempotency_key";

CREATE UNIQUE INDEX IF NOT EXISTS "WhatsappDelivery_idempotency_key"
  ON "WhatsappDelivery" ("assessmentId", "subject", "consultationVersionId")
  WHERE "consultationVersionId" IS NOT NULL
    AND "status" IN ('PENDING', 'SENT', 'DELIVERED');

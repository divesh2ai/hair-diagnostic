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

BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

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

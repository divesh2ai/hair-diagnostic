-- Audit Event V2 — EXPAND ONLY (SA-2A Phase 1)
--
-- Additive and reversible. This migration adds nullable columns and three
-- indexes. It does NOT:
--   * drop or rename any column
--   * convert any column to NOT NULL
--   * rewrite, backfill or delete any row
--   * add a foreign key to the new snapshot columns
--   * install a trigger, an enum, retention or hash chaining
--   * change `action` from TEXT
--
-- Every added column is nullable with no DEFAULT, so on PostgreSQL 11+ each
-- ADD COLUMN is a catalogue-only change: no table rewrite, no long lock, and
-- no cost proportional to row count.
--
-- Rollback is `ALTER TABLE "AuditLog" DROP COLUMN …` for each column plus
-- `DROP INDEX` for each index. No data is lost by rolling back, because no
-- data is written by this migration.

-- ── Event identity ──────────────────────────────────────────────────────────
-- Nullable with no default on purpose. NULL means "written before event
-- versioning existed" — a fact about the row. Defaulting historical rows to 1
-- would have been an assertion about events nobody inspected.
ALTER TABLE "AuditLog" ADD COLUMN "eventVersion" INTEGER;

-- Timezone-aware successor to createdAt, which is `timestamp without time
-- zone`. createdAt is deliberately NOT altered: changing a column type rewrites
-- the table, and rewriting audit history is the one thing this table must never
-- do. Readers coalesce occurredAt -> createdAt.
ALTER TABLE "AuditLog" ADD COLUMN "occurredAt" TIMESTAMPTZ(3);

-- ── Frozen actor snapshot ───────────────────────────────────────────────────
-- The existing "actorRole" column is NOT redefined. Its semantics were never
-- contractual (null on ~10% of rows), so the historical claim gets its own
-- clearly named column rather than a silent reinterpretation.
ALTER TABLE "AuditLog" ADD COLUMN "actorName" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "actorEmail" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "actorRoleSnapshot" "SystemRole";

-- ── Frozen clinic snapshot ──────────────────────────────────────────────────
-- Plain scalars. NO FOREIGN KEY, by design: AuditLog_assessmentId_fkey is
-- ON DELETE SET NULL and demonstrates exactly the failure being avoided —
-- deleting the operational record silently erases the audit attribution. Audit
-- evidence must outlive the record it describes.
ALTER TABLE "AuditLog" ADD COLUMN "clinicId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "clinicName" TEXT;

-- ── Entity snapshot ─────────────────────────────────────────────────────────
-- A short human-readable label frozen at write time, so an event stays
-- meaningful after its subject is deleted. Never a serialized entity.
ALTER TABLE "AuditLog" ADD COLUMN "entityLabel" TEXT;

-- ── Change evidence ─────────────────────────────────────────────────────────
-- Named beforeState/afterState rather than before/after: this table is queried
-- by hand during investigations and `before` is a keyword in enough SQL
-- contexts to make an ad-hoc unquoted query fail confusingly.
ALTER TABLE "AuditLog" ADD COLUMN "beforeState" JSONB;
ALTER TABLE "AuditLog" ADD COLUMN "afterState" JSONB;

-- ── Request context ─────────────────────────────────────────────────────────
-- Only the two fields the design justified. ipAddress, userAgent and
-- correlationId were evaluated and declined.
ALTER TABLE "AuditLog" ADD COLUMN "requestId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "source" TEXT;

-- ── Indexes ─────────────────────────────────────────────────────────────────
-- NOTE FOR PRODUCTION: Prisma runs a migration inside a transaction, so
-- CREATE INDEX CONCURRENTLY cannot be used here. On a production-sized
-- AuditLog these three CREATE INDEX statements take an ACCESS SHARE-blocking
-- lock for their duration and should be created concurrently, out of band,
-- before this migration is marked applied there.

-- Serves the audit console's default view: no filter, ORDER BY createdAt DESC,
-- plus its COUNT(*). That query is the most-run in the product and today no
-- index serves it at all.
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt" DESC);

-- Serves "everything that happened in clinic X, most recent first" — the core
-- tenant-investigation query, and unanswerable today because clinicId does not
-- exist. Leading column is the new snapshot, so this index only becomes
-- selective once writers populate it.
CREATE INDEX "AuditLog_clinicId_createdAt_idx" ON "AuditLog"("clinicId", "createdAt" DESC);

-- Serves the console's action filter, and also the DISTINCT-action facet that
-- keeps pre-canonical legacy actions selectable: Postgres can satisfy that
-- facet index-only rather than scanning the table.
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt" DESC);

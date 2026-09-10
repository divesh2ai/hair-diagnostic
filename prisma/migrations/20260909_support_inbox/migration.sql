-- FACT Support Inbox — doctor ↔ Super Admin support ticket system.
--
-- Additive only: every statement is CREATE TYPE or CREATE TABLE.
-- Nothing is dropped, renamed, or retyped.
-- The application boots and works correctly before this migration is applied;
-- every API route that touches these tables catches the 42P01/42703 Postgres
-- error codes and returns a 503 rather than a 500.
--
-- ── What this adds ────────────────────────────────────────────────────────────
--   SupportTicketCategory  — seven governed categories
--   SupportTicketPriority  — NORMAL / HIGH / URGENT
--   SupportTicketStatus    — OPEN → IN_PROGRESS → RESOLVED → CLOSED
--   SupportTicket          — one row per doctor support request
--   SupportMessage         — one row per reply in a thread
--
-- ── Design decisions ─────────────────────────────────────────────────────────
-- doctorLastSeenAt / adminLastSeenAt track when each party last opened the
-- thread. Unread count = messages after that timestamp by the other party.
-- This is simpler than a per-message read receipt and correct for a two-party
-- (doctor ↔ admin) channel.
--
-- No FK from SupportTicket to Assessment / Consultation: those tables live in
-- the application's Prisma schema and the support ticket stores only the ID
-- as a scalar so a deleted assessment does not cascade into the support history.
--
-- ── Rollback ─────────────────────────────────────────────────────────────────
--   DROP TABLE "SupportMessage";
--   DROP TABLE "SupportTicket";
--   DROP TYPE "SupportTicketStatus";
--   DROP TYPE "SupportTicketPriority";
--   DROP TYPE "SupportTicketCategory";

--------------------------------------------------------------------------
-- ENUMS
--------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "SupportTicketCategory" AS ENUM (
    'PATIENT_ASSESSMENT',
    'REPORT',
    'KIT_PRESCRIPTION',
    'WHATSAPP',
    'LOGIN_ACCESS',
    'TECHNICAL_ISSUE',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SupportTicketPriority" AS ENUM (
    'NORMAL',
    'HIGH',
    'URGENT'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SupportTicketStatus" AS ENUM (
    'OPEN',
    'IN_PROGRESS',
    'RESOLVED',
    'CLOSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

--------------------------------------------------------------------------
-- SupportTicket
--------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "SupportTicket" (
  "id"              TEXT NOT NULL,

  -- The doctor who opened the request.
  "doctorId"        TEXT NOT NULL,
  "clinicId"        TEXT NOT NULL,

  "category"        "SupportTicketCategory" NOT NULL,
  "priority"        "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
  "status"          "SupportTicketStatus"   NOT NULL DEFAULT 'OPEN',

  "subject"         TEXT NOT NULL,

  -- Optional clinical context — auto-attached when raised from a case screen.
  -- Stored as plain scalars; no FK so a deleted assessment does not cascade.
  "assessmentId"    TEXT,
  "consultationId"  TEXT,
  "reportVersionId" TEXT,
  -- Route the doctor was on when they raised the ticket.
  "raisedFromRoute" TEXT,

  -- Unread tracking: timestamp of when each party last viewed the thread.
  -- NULL = never viewed. Unread = messages from the other party created after
  -- this timestamp.
  "doctorLastSeenAt" TIMESTAMP(3),
  "adminLastSeenAt"  TIMESTAMP(3),

  "resolvedAt"      TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

--------------------------------------------------------------------------
-- SupportMessage
--------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "SupportMessage" (
  "id"         TEXT NOT NULL,

  "ticketId"   TEXT NOT NULL,

  -- Author identity frozen at write time.
  "authorId"   TEXT NOT NULL,   -- supabaseUserId of the sender
  "authorName" TEXT NOT NULL,
  "authorRole" TEXT NOT NULL,   -- DOCTOR | SUPER_ADMIN

  "body"       TEXT NOT NULL,

  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id"),

  CONSTRAINT "SupportMessage_ticketId_fkey"
    FOREIGN KEY ("ticketId")
    REFERENCES "SupportTicket"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

--------------------------------------------------------------------------
-- INDEXES
--------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "SupportTicket_doctorId_idx"
  ON "SupportTicket" ("doctorId");

CREATE INDEX IF NOT EXISTS "SupportTicket_clinicId_idx"
  ON "SupportTicket" ("clinicId");

CREATE INDEX IF NOT EXISTS "SupportTicket_status_createdAt_idx"
  ON "SupportTicket" ("status", "createdAt");

CREATE INDEX IF NOT EXISTS "SupportTicket_createdAt_idx"
  ON "SupportTicket" ("createdAt" DESC);

CREATE INDEX IF NOT EXISTS "SupportMessage_ticketId_createdAt_idx"
  ON "SupportMessage" ("ticketId", "createdAt");

-- Migration: add_whatsapp_session
-- This SQL creates a WhatsappSession table compatible with the Prisma model.

CREATE TABLE IF NOT EXISTS "WhatsappSession" (
  "id" TEXT PRIMARY KEY,
  "waId" TEXT NOT NULL UNIQUE,
  "sessionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add foreign key constraint to existing Session table
ALTER TABLE IF EXISTS "WhatsappSession"
  ADD CONSTRAINT fk_whatsapp_session_session
  FOREIGN KEY ("sessionId") REFERENCES "Session"(id) ON DELETE CASCADE;

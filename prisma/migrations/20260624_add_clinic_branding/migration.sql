-- Branding columns for clinic-branded landing pages.
-- All nullable so existing clinics keep working untouched; the landing
-- page falls back to HairOS chrome when fields are unset.

ALTER TABLE "Clinic"
  ADD COLUMN IF NOT EXISTS "logoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "tagline" TEXT;

ALTER TABLE "Doctor"
  ADD COLUMN IF NOT EXISTS "photoUrl"    TEXT,
  ADD COLUMN IF NOT EXISTS "credentials" TEXT,
  ADD COLUMN IF NOT EXISTS "bio"         TEXT,
  ADD COLUMN IF NOT EXISTS "isPrimary"   BOOLEAN NOT NULL DEFAULT false;

-- Per-doctor workspace-identity accent (badge theme). Nullable — null
-- renders the default theme. Server-persisted so a doctor's pick survives
-- across devices, browsers, and Vercel preview URLs.

ALTER TABLE "Doctor"
  ADD COLUMN "badgeTheme" TEXT;

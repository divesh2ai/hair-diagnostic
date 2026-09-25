-- Mobile-OTP login: a doctor's PHONE Supabase identity.
--
-- Supabase mints a separate auth user for phone sign-in and for email
-- sign-in. One human doctor therefore holds two auth uids, while
-- "Doctor"."supabaseUserId" can name only one of them — so whichever channel
-- linked second was refused for ever (resolveOrLinkDoctorByPhone returned
-- `supabaseUserId_conflict` and signed the doctor straight back out).
--
-- Additive and reversible: a new nullable column. Nothing is backfilled here,
-- because a link may only be created by a doctor proving control of the
-- phone number a Super-Admin already provisioned on their Doctor row.
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "supabasePhoneUserId" TEXT;

-- Same guarantee "supabaseUserId" carries: one auth identity may never name
-- two Doctor rows. NULLs stay distinct under a unique index, so any number of
-- doctors may remain unlinked.
CREATE UNIQUE INDEX IF NOT EXISTS "Doctor_supabasePhoneUserId_key"
  ON "Doctor" ("supabasePhoneUserId");

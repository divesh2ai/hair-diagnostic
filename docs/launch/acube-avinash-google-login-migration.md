# Acube Aesthetics — Dr Avinash Agarwal Google-Login Migration (P0)

**Status:** PROPOSED — not executed. No production auth mapping, database record,
or deployment has been changed by this document. Execution requires separate
explicit authorization.

**Scope:** exactly one doctor at one clinic. Isolated from the Super Admin
redesign and all unrelated PRs.

---

## 1. Objective

Make Google Login the primary authentication method for Dr Avinash Agarwal's
Acube Aesthetics doctor dashboard, with no Twilio/SMS dependency, while
preserving doctor identity, clinic isolation, and all patient history.

## 2. Verified production facts (read-only, captured 2026-10-29)

Project: `pykoyxbleowxwechotth` (`drfact-hairos-production`).

| Fact | Value |
| --- | --- |
| Doctor row id | `c3d13b725f9e74c709f1839e8` ("Dr Avinash Agarwal") |
| Clinic | `acube-aesthetics` / "Acube Aesthetics" (`ccf1d8f1911e95f18366d848c`) |
| `isActive` / `provisioningStatus` | `true` / `ACTIVE` |
| `Doctor.supabaseUserId` | `dacc52cf-7848-41fb-913c-700737ac5c51` (phone identity) |
| `Doctor.supabasePhoneUserId` | `NULL` |
| `Doctor.email` | placeholder on reserved `.invalid` TLD — **not a real/Google mailbox** |
| `Doctor.phone` | present |
| auth.users `dacc52cf` | providers `["phone"]`; phone-confirmed; **no email, no Google identity** |
| auth.users carrying the Doctor's email | **none** (no duplicate/orphan to collide with) |
| Acube patients / assessments / doctors | 7 / 7 / 1 |
| History FKs to Doctor | `Assessment.reviewingDoctorId`, `Patient.doctorId`, `KitOrderIntent.doctorId`, `RecommendationFeedback.doctorId` — all reference **`Doctor.id`**, never the auth UID |

## 3. Root cause

On "Continue with Google", Supabase mints a **new** auth user (new uid `G`, his
real Google email, `google` provider). The JWT hook
(`supabase/functions/custom_access_token_hook.sql`) Doctor branch then fails to
match: `supabaseUserId`/`supabasePhoneUserId` don't equal `G`, and the
`email`/`phone` pre-link fallbacks are gated behind `supabaseUserId IS NULL`
— which is false, because `supabaseUserId` already holds the phone uid. No role
claim is emitted → `proxy.ts` treats the session as forbidden → the doctor is
bounced to `/login?reason=forbidden`.

This is a **data/linking gap, not a code bug**: identity resolution already
matches either column (`doctorAuthIdentityWhere`), so a correctly-linked Google
uid resolves normally.

## 4. Can the existing UID be preserved via account linking?

Only conditionally and fragile:

- **Automatic linking** (same confirmed email) cannot fire — `dacc52cf` has no
  email. It would require first writing his real Google email (confirmed) onto
  `dacc52cf` AND automatic-linking being enabled project-wide (a GoTrue console
  setting not readable via SQL).
- **Manual `linkIdentity`** requires a prior signed-in session (phone OTP) —
  the exact Twilio dependency being removed.

Therefore the plan uses a **deterministic controlled transition** (below) and
keeps the phone uid as a preserved fallback rather than the canonical identity.

## 5. Migration — Google-canonical transition

### 5.1 Verified ownership gate (perform first)

1. Confirm Dr Avinash's exact Google address out-of-band (with him / clinic).
2. Have **Avinash** complete "Continue with Google" once from his own device.
   This mints auth user `G` (provider `google`, his real email). He is expected
   to be bounced to `/login?reason=forbidden` at this pre-link stage.
3. Read back and confirm `G` before any write:

```sql
-- Expect exactly one row: provider google, email == the confirmed address,
-- created moments ago. Capture <G> = u.id.
SELECT u.id, u.email, u.created_at,
       (SELECT array_agg(i.provider) FROM auth.identities i WHERE i.user_id = u.id) AS providers
FROM auth.users u
WHERE lower(u.email) = lower('<avinash-real-google-email>');
```

Do not proceed unless this returns the expected single Google user.

### 5.2 The write (single guarded statement, in a transaction)

```sql
BEGIN;

-- Optimistic-locked on the current phone uid so a concurrent change aborts us.
UPDATE public."Doctor"
SET "supabaseUserId"      = '<G>',
    "supabasePhoneUserId" = 'dacc52cf-7848-41fb-913c-700737ac5c51',
    email                 = '<avinash-real-google-email>'
WHERE id = 'c3d13b725f9e74c709f1839e8'
  AND "supabaseUserId" = 'dacc52cf-7848-41fb-913c-700737ac5c51';
-- Expect: UPDATE 1. If UPDATE 0, STOP and investigate (do not retry blindly).

-- Audit trail (align to the project's writeAuditLog schema).
INSERT INTO public."AuditLog" ("action","entityType","entityId","actorType","clinicId","metadata")
VALUES ('DOCTOR_GOOGLE_IDENTITY_LINKED','Doctor','c3d13b725f9e74c709f1839e8',
        'migration','ccf1d8f1911e95f18366d848c',
        jsonb_build_object('fromUid','dacc52cf-7848-41fb-913c-700737ac5c51','toUid','<G>'));

COMMIT;
```

Notes:
- `clinicId`, `isActive`, `provisioningStatus` untouched. `Doctor.id` stable, so
  all 7 patients and 7 assessments remain linked.
- `email` placeholder replaced with his **real** address — no placeholder used
  for Google auth.
- The phone uid `dacc52cf` is preserved in `supabasePhoneUserId` and is **not
  deleted**; the phone channel still resolves if Twilio is ever restored.
- Verify the `AuditLog` column names against `prisma/schema.prisma` before
  running; adjust if the project's audit table differs.

### 5.3 Confirm

Avinash signs in with Google again → uid `G` → hook emits `DOCTOR` → `/doctor`.

## 6. Rollback (single statement, fully reversible)

```sql
UPDATE public."Doctor"
SET "supabaseUserId"      = 'dacc52cf-7848-41fb-913c-700737ac5c51',
    "supabasePhoneUserId" = NULL,
    email                 = '<original-placeholder-email>'
WHERE id = 'c3d13b725f9e74c709f1839e8';
```

Leave auth user `G` in place — it grants nothing once no Doctor row names it.
Capture `<original-placeholder-email>` from §2 before migrating.

## 7. Verification matrix (run on `hairos-staging` first, then post-migration)

- [ ] `/doctor` loads for Avinash via Google
- [ ] Patient deck shows exactly 7 patients
- [ ] All 7 existing assessments open
- [ ] Report access works
- [ ] Doctor review flow works
- [ ] Kit records visible
- [ ] **Clinic isolation**: only Acube data is visible; no cross-clinic rows
- [ ] Session persists across refresh
- [ ] Logout returns to `/login`
- [ ] **An unrelated Google account → `/login?reason=forbidden`, zero Acube data**
- [ ] **Super Admin Google login still lands `/admin`** (regression)

## 8. Code change shipped with this PR

`apps/patient-portal/src/app/login/page.tsx`: the Mobile (phone-OTP) tab is
rendered only when the live provider probe confirms SMS is configured
(`phoneOtpAvailable === true`). While pending or disabled — the current
Twilio-less state — the switcher is hidden, so doctors are never shown a broken
channel. Google stays primary; Email remains the fallback. No server, auth, or
data behaviour changes.

## 9. Out of scope / on hold

- Super Admin redesign — on hold.
- Repeatable all-clinic Google onboarding workflow — to be proposed only after
  Acube passes.
- Stale provenance comment in the hook mirror header (references project
  `gwkgopbscdftpitppgwe`, not current prod/staging) — doc-only follow-up.

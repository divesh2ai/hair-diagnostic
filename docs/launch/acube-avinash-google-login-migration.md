# Acube Aesthetics — Dr Avinash Agarwal Google-Login Migration (P0)

**Status:** PROPOSED — validated by a synthetic staging rehearsal; **not executed in
production**. No production auth mapping, database record, or deployment has been
changed. Execution requires separate explicit authorization (see §9).

**Scope:** exactly one doctor at one clinic. Does not touch Super Admin auth or any
other doctor.

**Target:** production `pykoyxbleowxwechotth` (`drfact-hairos-production`).
**Rehearsal:** staging `vbkoupvduadmcxggtnsb` (synthetic data only; no real Acube
records are ever copied to staging).

---

## 1. Verified production facts (read-only, 2026-10-29)

| Fact | Value |
| --- | --- |
| Doctor row id | `c3d13b725f9e74c709f1839e8` ("Dr Avinash Agarwal") |
| Clinic | `acube-aesthetics` / "Acube Aesthetics" (`ccf1d8f1911e95f18366d848c`) |
| `isActive` / `provisioningStatus` | `true` / `ACTIVE` |
| `Doctor.supabaseUserId` | `dacc52cf-7848-41fb-913c-700737ac5c51` (phone identity) |
| `Doctor.supabasePhoneUserId` | `NULL` |
| `Doctor.email` | placeholder on reserved `.invalid` TLD — not a real/Google mailbox |
| auth.users `dacc52cf` | providers `["phone"]`; phone-confirmed; no email, no Google identity |
| auth.users carrying that email | none (no duplicate/orphan to collide with) |
| **Phone UID exclusivity** | `dacc52cf` appears in **1** place only — this Doctor row. 0 in OrganizationMember / ClinicMember / Patient. |
| Acube patients / assessments / doctors | 7 / 7 / 1 |
| History FKs to Doctor | `Assessment.reviewingDoctorId`, `Patient.doctorId`, `KitOrderIntent.doctorId`, `RecommendationFeedback.doctorId` → all reference **`Doctor.id`**, never the auth UID |
| Production auth providers in use | phone ×6 (doctors), email+google ×1 (Super Admin — both identities linked) |

## 2. Staging vs production schema diff (tables the migration writes)

`AuditLog` — **identical** in both: `id` is **NOT NULL with no DB default** (Prisma
generates the `cuid()` client-side, so a raw `INSERT` must supply `id`); `action`,
`entityType`, `entityId` NOT NULL no default; `createdAt` defaults `now()`; `clinicId`
nullable.

`Doctor` — identical **except**: `email` is **NOT NULL in production** but nullable in
staging. This is why the production row holds a `@hairos.invalid` placeholder rather than
`NULL`. The migration replaces that placeholder with the real Google address, which keeps
the NOT NULL constraint satisfied. `updatedAt` is NOT NULL with no default in both, so raw
`UPDATE`/`INSERT` must set it explicitly.

## 3. Root cause

On "Continue with Google", Supabase mints a **new** auth user (uid `G`, real Google email,
`google` provider). The JWT hook Doctor branch doesn't match: `supabaseUserId`/
`supabasePhoneUserId` ≠ `G`, and the `email`/`phone` pre-link fallbacks are gated behind
`supabaseUserId IS NULL` — false, because the phone uid is already set. No role claim →
`proxy.ts` forbids → `/login?reason=forbidden`. Data/linking gap, not a code bug.

## 4. Migration — Google-canonical transition (guarded, atomic)

### 4.1 Verified-ownership gate (perform first, before any write)

1. Confirm Dr Avinash's exact Google address out-of-band.
2. Have **Avinash** complete "Continue with Google" once from his own device to mint auth
   user `G` (provider `google`, his real email). He is expected to hit
   `/login?reason=forbidden` at this pre-link stage. **Per current authorization this step
   is NOT yet to be performed** — it creates a production auth identity and waits on final
   approval (§9).
3. Confirm `G` read-only before any write:

```sql
-- Expect exactly one row: provider google, email == the confirmed address,
-- created moments ago. Capture <G> = u.id.
SELECT u.id, u.email, u.created_at,
       (SELECT array_agg(i.provider) FROM auth.identities i WHERE i.user_id = u.id) AS providers
FROM auth.users u
WHERE lower(u.email) = lower('<avinash-real-google-email>');
```

### 4.2 The write — single atomic block, self-aborting

Run as one statement. Every guard `RAISE`s, which aborts the whole block (Doctor update
**and** audit insert roll back together). Substitute `<G>` and `<avinash-real-google-email>`.

```sql
DO $$
DECLARE
  v_target_id      text := 'c3d13b725f9e74c709f1839e8';              -- Dr Avinash's Doctor.id (stable)
  v_old_phone_uid  text := 'dacc52cf-7848-41fb-913c-700737ac5c51';   -- current phone uid
  v_new_google_uid text := '<G>';                                    -- uid from §4.1
  v_new_email      text := '<avinash-real-google-email>';            -- real address, never a placeholder
  v_clinic         text;
  v_n              int;
  v_audit_id       text := 'mig_' || replace(gen_random_uuid()::text, '-', '');  -- unique AuditLog.id
BEGIN
  -- Identity-ownership guards: the Google uid must not already be linked anywhere.
  IF EXISTS (SELECT 1 FROM public."Doctor"
             WHERE ("supabaseUserId"=v_new_google_uid OR "supabasePhoneUserId"=v_new_google_uid)
               AND id<>v_target_id) THEN RAISE EXCEPTION 'ABORT: google uid already linked to another Doctor'; END IF;
  IF EXISTS (SELECT 1 FROM public."ClinicMember" WHERE "supabaseUserId"=v_new_google_uid)
     THEN RAISE EXCEPTION 'ABORT: google uid already a ClinicMember'; END IF;
  IF EXISTS (SELECT 1 FROM public."OrganizationMember" WHERE "supabaseUserId"=v_new_google_uid)
     THEN RAISE EXCEPTION 'ABORT: google uid already an OrganizationMember'; END IF;

  -- The old phone uid must be exclusive to the one intended Doctor.
  IF (SELECT count(*) FROM public."Doctor"
      WHERE "supabaseUserId"=v_old_phone_uid OR "supabasePhoneUserId"=v_old_phone_uid) <> 1
     THEN RAISE EXCEPTION 'ABORT: phone uid not exclusive to one Doctor'; END IF;
  IF EXISTS (SELECT 1 FROM public."OrganizationMember" WHERE "supabaseUserId"=v_old_phone_uid)
     OR EXISTS (SELECT 1 FROM public."ClinicMember" WHERE "supabaseUserId"=v_old_phone_uid)
     THEN RAISE EXCEPTION 'ABORT: phone uid also a privileged/clinic member'; END IF;

  -- Guarded, optimistic-locked write; exactly one row or abort.
  UPDATE public."Doctor"
     SET "supabaseUserId"=v_new_google_uid,
         "supabasePhoneUserId"=v_old_phone_uid,   -- phone identity preserved as fallback
         email=v_new_email,                        -- replaces the @hairos.invalid placeholder
         "updatedAt"=now()
   WHERE id=v_target_id
     AND "supabaseUserId"=v_old_phone_uid
     AND "supabasePhoneUserId" IS NULL
  RETURNING "clinicId" INTO v_clinic;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'ABORT: expected exactly 1 Doctor row updated, got %', v_n; END IF;

  -- Audit (explicit unique id; clinic in metadata, matching writeAuditLog which drops the column).
  INSERT INTO public."AuditLog"(id,action,"entityType","entityId","actorId","actorType",source,metadata,"createdAt")
  VALUES (v_audit_id,'DOCTOR_GOOGLE_IDENTITY_LINKED','Doctor',v_target_id,v_new_google_uid,'system','script',
          jsonb_build_object('fromUid',v_old_phone_uid,'toUid',v_new_google_uid,'clinicId',v_clinic,'emailReplacedPlaceholder',true),
          now());
END $$;
```

> **App-convention alternative (preferred where an app/Prisma runtime is available):** run
> the equivalent inside `prisma.$transaction`, calling `prisma.doctor.updateMany({...})` and
> asserting `count === 1`, then `writeAuditLog({ action: "DOCTOR_GOOGLE_IDENTITY_LINKED",
> entityType: "Doctor", entityId, actorType: "system", metadata: {...}, prismaClient: tx })`.
> `writeAuditLog` generates the `cuid()` id natively. The `DOCTOR_GOOGLE_IDENTITY_LINKED`
> action was added to `src/lib/audit/actions.ts` in this PR so it is type-valid and
> filterable in the audit console.

### 4.3 Confirm (read-only, before asking Avinash to sign in again)

```sql
-- Expect user_role=DOCTOR, clinic_id=ccf1d8f1911e95f18366d848c
SELECT public.custom_access_token_hook(jsonb_build_object('user_id','<G>','claims','{}'::jsonb))->'claims';
```

Then Avinash signs in with Google → uid `G` → DOCTOR → `/doctor`.

## 5. Rollback — optimistic-locked, self-aborting

Won't overwrite a later legitimate change: the `WHERE` matches only the exact migrated
state, and the block aborts (changes nothing) if it isn't found.

```sql
DO $$
DECLARE v_n int;
BEGIN
  UPDATE public."Doctor"
     SET "supabaseUserId"='dacc52cf-7848-41fb-913c-700737ac5c51',
         "supabasePhoneUserId"=NULL,
         email='<original-@hairos.invalid-placeholder>',
         "updatedAt"=now()
   WHERE id='c3d13b725f9e74c709f1839e8'
     AND "supabaseUserId"='<G>'
     AND "supabasePhoneUserId"='dacc52cf-7848-41fb-913c-700737ac5c51'
     AND email='<avinash-real-google-email>';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'ABORT rollback: expected 1 row, got % (state changed since migration)', v_n; END IF;
END $$;
```

Capture `<original-@hairos.invalid-placeholder>` from §1 before migrating. Leave auth user
`G` in place — it grants nothing once no Doctor row names it.

## 6. Staging rehearsal evidence (synthetic, 2026-10-29) — PASS

Executed against staging with throwaway `REH_`-prefixed fixtures (two clinics A/B, two
doctors, patients + an assessment; Doctor A mirrored Avinash's exact starting state incl. a
non-null placeholder email). The procedure above was run verbatim.

| Check | Result |
| --- | --- |
| Pre-migration: Google uid resolves | `user_role=NULL` (locked out) — reproduces prod |
| Pre-migration: phone uid resolves | `DOCTOR`, clinic A |
| Post-migration: Google uid (hook) | **`DOCTOR`, clinic A** |
| Post-migration: phone uid (hook) | `DOCTOR` (retained identity still resolves) |
| Post-migration: unrelated Google uid | `NULL` (denied) |
| `/doctor` guard (`doctorAuthIdentityWhere`, active only) | resolves to Doctor A, clinic A |
| Clinic isolation (Google uid → clinic B rows) | **0** |
| History preserved (patients / assessments still linked to same `Doctor.id`) | 2 / 1 |
| Row state after migration | `supabaseUserId=G · supabasePhoneUserId=phone · email=real` |
| Audit row written (explicit id) | 1 |
| Rollback → Google uid | `NULL` (locked out again) |
| Rollback → phone uid | `DOCTOR` |
| Rollback → row state | original state restored exactly |
| Stale rollback vs later legitimate edit | matched **0 rows**; legitimate edit preserved |

## 7. Post-authorization production verification (§9 gate)

- [ ] Google Login reaches `/doctor` for Avinash
- [ ] Original **7** Acube patient records visible
- [ ] **7** assessments open; report access; doctor review; kit records
- [ ] **Clinic isolation**: only Acube data; an unrelated Google account → `/login?reason=forbidden`, zero Acube data
- [ ] Session persists across refresh; logout → `/login`
- [ ] Rollback readiness confirmed (dry-run the §5 `WHERE` returns the single row)
- [ ] Super Admin Google login still lands `/admin` (regression)

## 8. Security considerations / open items

- **Retained phone identity (finding 6).** `supabasePhoneUserId=dacc52cf` is kept for
  identity continuity and audit, and still resolves to `DOCTOR` via the hook. Unintended
  phone login is currently prevented by two independent layers: (a) the project's SMS/OTP
  provider gates phone sign-in (login UI hides the Mobile tab when the live probe reports it
  unavailable — shipped in this PR), and (b) Google is the primary channel. If hard
  isolation is preferred over continuity, set `supabasePhoneUserId=NULL` in §4.2 instead —
  then only Google resolves. **Decision required.**
- **Email-OTP channel (finding 7).** The login page gates the *phone* tab on a live probe,
  but the *Email* OTP channel is still shown unconditionally and would present a broken
  channel if SMTP is unconfigured. Production data shows no doctor uses email OTP (only the
  Super Admin, who uses Google). Recommended fix: gate the Email channel behind an explicit
  ops-controlled availability signal so only confirmed-working channels appear, Google
  always. **Not shipped in this PR** because it changes the shared login UI for all clinics;
  **decision required** before it touches other doctors.
- **Hook provenance.** The checked-in hook mirror header cites project `gwkgopbscdftpitppgwe`
  (neither current prod nor staging). Doc-only correction.

## 9. Readiness & the exact approval required

The procedure is **ready for execution** and has passed a full synthetic staging rehearsal
including rollback. Production is untouched.

**Blocking approval needed, in order:**
1. **Authorize the verified-ownership step (§4.1):** permission to have Dr Avinash perform
   the first production Google sign-in (this creates auth user `G` in production).
2. Provide/confirm his **real Google email**.
3. **Authorize the §4.2 write** against `pykoyxbleowxwechotth`.
4. Decide the two open items in §8 (retain vs drop the phone identity; email-OTP gating).

Nothing in steps 1–3 runs without your explicit go-ahead.

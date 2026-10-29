# Acube Aesthetics — Google Authentication Design & Dr Avinash Migration (P0)

**Status:** AUTHORITATIVE DESIGN. Procedure validated by a synthetic staging rehearsal;
**not executed in production**. No production auth mapping, database record, deployment, or
staff account has been created or changed. Execution requires separate explicit
authorization (§11). PR #44 remains a **DRAFT**.

**Target:** production `pykoyxbleowxwechotth` (`drfact-hairos-production`).
**Rehearsal:** staging `vbkoupvduadmcxggtnsb` (synthetic data only).

---

## 1. Authentication design decisions (authoritative)

1. **Dr Avinash's Doctor login is an individually-controlled Google account with 2-Step
   Verification.** Per his decision, the account may be the existing clinic-branded address
   **`acubeaestheticsclinic@gmail.com`** (verified Google UID
   `9b6afbc8-d69e-4e49-b44e-231c6aa136ba`) — a clinic-branded name is not itself a
   disqualifier — **provided it is first converted from a shared mailbox into an account only
   Dr Avinash controls.** The conversion is the §2 checklist.
2. **Until that checklist is confirmed, UID `9b6afbc8…` stays BLOCKED from DOCTOR access.**
   The migration cannot run while the account is still shared; the SQL enforces this with an
   explicit de-sharing gate that aborts unless the operator records confirmation (§6).
3. **Identity continuity preserved.** The migration keeps `Doctor.id`
   (`c3d13b725f9e74c709f1839e8`), `clinicId` (`ccf1d8f1911e95f18366d848c`), and all **7
   patients** and **7 assessments** unchanged — it writes only the two identity columns + the
   email on the single Doctor row. All history FKs to `Doctor.id`, never to the auth UID.
4. **Clinic staff get separate, restricted Google identities** with least-privilege
   `STAFF` / `CLINIC_ADMIN` roles (§8), each keyed to their **own** personal Google account —
   never the account that becomes the doctor login.
5. **No access from an unverified email match (§8.2).** A pre-provisioned ClinicMember/Doctor
   row is the authorization decision; it is created only after identity verification and
   approved clinic membership.
6. **Doctor-only clinical actions stay doctor-only (§9):** clinical review and treatment
   approval require a live Doctor row; staff roles route to `/clinic`, never `/doctor`.
7. **No Twilio/SMS and no Email-OTP dependency** for this restoration.
8. **Shared Doctor accounts are prohibited as a standing rule.** A doctor login must be an
   individually-controlled account. This specific address is permitted *only* because it is
   being converted to Dr Avinash's exclusive control (§2); the general prohibition on shared
   / multi-person doctor logins remains in force for every clinic.

## 2. De-sharing precondition checklist (must be signed off before §6 runs)

UID `9b6afbc8…` is unblocked for DOCTOR access only after **all** are confirmed and recorded
(who confirmed, when):

- [x] **(1) Exclusive control** — CONFIRMED 2026-10-29: Dr Avinash will exclusively control
  `acubeaestheticsclinic@gmail.com`. (Conditions 2–4 below still to be recorded.)
- [ ] **(2) Shared access revoked** — all other staff access, active sessions, and account
  **recovery** access (recovery email/phone, app passwords, delegated/forwarding access) have
  been removed from the account. **This also includes the existing HairOS/Supabase app
  sessions for the UID** (12 active sessions / 13 refresh tokens observed 2026-10-29) — see
  §6a; once the UID is linked, any surviving session becomes a live DOCTOR session, so they
  must be cleared so only a fresh post-de-sharing login by Dr Avinash gains access.
- [ ] **(3) 2-Step Verification** — 2SV is enabled and its device/credentials are solely
  Dr Avinash's.
- [ ] **(4) Staff re-homed** — any staff who used this mailbox now have their **own** separate
  Google identities (§8); none depends on this account for HairOS access.

These are Google-account and operational facts that cannot be verified from Supabase; they
require the named operator's explicit out-of-band sign-off, recorded in the migration audit
(§6, `metadata.desharing`). Until then, the gate in §6 aborts.

## 3. Verified production facts (read-only, 2026-10-29)

| Fact | Value |
| --- | --- |
| Doctor row id | `c3d13b725f9e74c709f1839e8` ("Dr Avinash Agarwal") |
| Clinic | `acube-aesthetics` (`ccf1d8f1911e95f18366d848c`) |
| `isActive` / `provisioningStatus` | `true` / `ACTIVE` |
| `Doctor.supabaseUserId` | `dacc52cf-7848-41fb-913c-700737ac5c51` (phone) — **unchanged** |
| `Doctor.supabasePhoneUserId` | `NULL` |
| `Doctor.email` | `@hairos.invalid` placeholder |
| Target Google UID `9b6afbc8…` | provider `google`, email `acubeaestheticsclinic@gmail.com` confirmed; 0 Doctor/ClinicMember/OrganizationMember/Patient links |
| Phone UID exclusivity | `dacc52cf` in 1 place only — this Doctor row |
| Acube members | only the Doctor row (0 ClinicMember, 0 OrganizationMember) |
| Acube patients / assessments | 8 / 8 as of 2026-10-29 re-verify (was 7/7 at first audit — live clinic activity added one; the migration touches no Patient/Assessment rows, so all are preserved whatever the count) |

## 4. Schema diff (prod vs staging)
`AuditLog.id` NOT NULL, no default (supply it). `Doctor.email` NOT NULL in prod (placeholder
exists for this reason; migration replaces it). `updatedAt` NOT NULL, no default (set it).

## 5. Root cause
A Google sign-in mints a new uid; the hook's Doctor email/phone fallbacks are gated behind
`supabaseUserId IS NULL` (false here), so no role is emitted → `/login?reason=forbidden`.
Linking the uid to the Doctor row resolves it.

## 6. Doctor migration — guarded, atomic, de-sharing-gated (NOT executed)

Set `v_desharing_confirmed := true` **only** once the §2 checklist is fully signed off, and
fill `v_desharing_by` with who confirmed it.

### 6a. Cutover session revocation (run immediately before the mapping, same authorized window)
UID `9b6afbc8…` holds **12 live sessions across 6 distinct IPs / 2 user agents, all aal1**, and
**12 live refresh tokens** (2026-10-29), with no server-side session expiry (`not_after` NULL)
— confirming shared, multi-device use. They grant nothing while the UID is unlinked, but a live
refresh token would mint a DOCTOR access token the moment the mapping lands. Revoke them
**before** linking, via a supported mechanism:

- **Primary (supported):** Supabase Dashboard → Authentication → Users → this user → **Sign
  out user (global)**; or Admin API `supabase.auth.admin.signOut('<uid>', 'global')` /
  `POST /auth/v1/admin/users/<uid>/logout {"scope":"global"}`. This revokes sessions and
  refresh tokens through GoTrue. Requires the service-role key / dashboard; it is an operator
  action, not performed through the SQL MCP.
- **Verify (read-only SQL):** confirm nothing live remains — expect `0 / 0`:
  ```sql
  SELECT (SELECT count(*) FROM auth.sessions       WHERE user_id='9b6afbc8-d69e-4e49-b44e-231c6aa136ba'::uuid)              AS sessions,
         (SELECT count(*) FROM auth.refresh_tokens WHERE user_id='9b6afbc8-d69e-4e49-b44e-231c6aa136ba' AND NOT revoked)   AS live_refresh_tokens;
  ```
- **Fallback only (never the sole mechanism):** if the admin path is unavailable,
  `DELETE FROM auth.refresh_tokens WHERE user_id='9b6afbc8-d69e-4e49-b44e-231c6aa136ba';`
  then `DELETE FROM auth.sessions WHERE user_id='9b6afbc8-d69e-4e49-b44e-231c6aa136ba'::uuid;`
  and re-run the verify query.

**Token-validity note.** Supabase access tokens (JWTs) are stateless: `getClaims()` /
`proxy.ts` validate signature + `exp` (default ~1h TTL) via JWKS and do **not** re-check
server-side revocation. Safe here only because of ordering — pre-link JWTs carry no
`user_role`, so they cannot reach `/doctor` even within their remaining life, and once refresh
tokens are revoked no DOCTOR JWT can be minted until Dr Avinash signs in afresh. Never link
before revocation + verification complete.

### 6b. The guarded mapping

```sql
DO $$
DECLARE
  v_target_id      text := 'c3d13b725f9e74c709f1839e8';
  v_old_phone_uid  text := 'dacc52cf-7848-41fb-913c-700737ac5c51';
  v_new_google_uid text := '9b6afbc8-d69e-4e49-b44e-231c6aa136ba';   -- VERIFIED shared-origin UID
  v_new_email      text := 'acubeaestheticsclinic@gmail.com';         -- now Dr Avinash's sole-controlled login
  v_desharing_confirmed boolean := false;   -- FLIP to true ONLY after §2 checklist sign-off
  v_desharing_by   text := '<operator-who-confirmed-desharing>';
  v_old_supa text; v_old_phone text; v_old_email text; v_clinic text; v_n int;
  v_audit_id text := 'mig-c3d13b72-google-20261029';   -- FIXED id → exact rollback binding
BEGIN
  -- §1.2 gate: the shared-origin UID stays blocked until de-sharing is confirmed.
  IF NOT v_desharing_confirmed
     THEN RAISE EXCEPTION 'ABORT: de-sharing preconditions (doc §2) not confirmed; UID stays blocked from DOCTOR'; END IF;

  -- Capture ACTUAL originals before any change; lock the row.
  SELECT "supabaseUserId","supabasePhoneUserId",email,"clinicId"
    INTO v_old_supa, v_old_phone, v_old_email, v_clinic
    FROM public."Doctor" WHERE id=v_target_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ABORT: target Doctor not found'; END IF;
  IF v_old_supa <> v_old_phone_uid OR v_old_phone IS NOT NULL
     THEN RAISE EXCEPTION 'ABORT: target not in expected pre-migration state (supa=%, phone=%)', v_old_supa, v_old_phone; END IF;

  -- Ownership / conflict re-checks inside the transaction.
  IF EXISTS (SELECT 1 FROM public."Doctor" WHERE ("supabaseUserId"=v_new_google_uid OR "supabasePhoneUserId"=v_new_google_uid) AND id<>v_target_id)
     THEN RAISE EXCEPTION 'ABORT: google uid already linked to another Doctor'; END IF;
  IF EXISTS (SELECT 1 FROM public."ClinicMember"       WHERE "supabaseUserId"=v_new_google_uid) THEN RAISE EXCEPTION 'ABORT: google uid is a ClinicMember'; END IF;
  IF EXISTS (SELECT 1 FROM public."OrganizationMember" WHERE "supabaseUserId"=v_new_google_uid) THEN RAISE EXCEPTION 'ABORT: google uid is an OrganizationMember'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id=v_new_google_uid::uuid AND i.provider='google')
     THEN RAISE EXCEPTION 'ABORT: uid has no google identity'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users uu WHERE uu.id=v_new_google_uid::uuid AND lower(uu.email)=lower(v_new_email) AND uu.email_confirmed_at IS NOT NULL)
     THEN RAISE EXCEPTION 'ABORT: uid google email mismatch or unconfirmed'; END IF;
  IF (SELECT count(*) FROM public."Doctor" WHERE "supabaseUserId"=v_old_phone_uid OR "supabasePhoneUserId"=v_old_phone_uid) <> 1
     THEN RAISE EXCEPTION 'ABORT: phone uid not exclusive to one Doctor'; END IF;

  -- The write: Google canonical; phone UID retained for rollback; placeholder -> real email.
  UPDATE public."Doctor"
     SET "supabaseUserId"=v_new_google_uid, "supabasePhoneUserId"=v_old_phone_uid,
         email=v_new_email, "updatedAt"=now()
   WHERE id=v_target_id AND "supabaseUserId"=v_old_phone_uid AND "supabasePhoneUserId" IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'ABORT: expected exactly 1 Doctor row updated, got %', v_n; END IF;

  -- Exact-record audit: fixed id, ACTUAL originals in beforeState, de-sharing sign-off recorded.
  INSERT INTO public."AuditLog"(id,action,"entityType","entityId","actorId","actorType",source,metadata,"beforeState","afterState","createdAt")
  VALUES (v_audit_id,'DOCTOR_GOOGLE_IDENTITY_LINKED','Doctor',v_target_id,v_new_google_uid,'system','script',
          jsonb_build_object('clinicId',v_clinic,'fromUid',v_old_phone_uid,'toUid',v_new_google_uid,
                             'desharing',jsonb_build_object('confirmed',true,'by',v_desharing_by,'checklist','doc §2')),
          jsonb_build_object('supabaseUserId',v_old_supa,'supabasePhoneUserId',v_old_phone,'email',v_old_email),
          jsonb_build_object('supabaseUserId',v_new_google_uid,'supabasePhoneUserId',v_old_phone_uid,'email',v_new_email),
          now());
END $$;
```

The fixed `v_audit_id` makes the migration idempotent-safe (PK collision aborts a re-run) and
gives rollback an exact record to bind to.

## 7. Rollback — exact-record bound, email-change protected (NOT executed)

```sql
DO $$
DECLARE
  v_audit_id       text := 'mig-c3d13b72-google-20261029';
  v_google         text := '9b6afbc8-d69e-4e49-b44e-231c6aa136ba';
  v_phone          text := 'dacc52cf-7848-41fb-913c-700737ac5c51';
  v_migrated_email text := 'acubeaestheticsclinic@gmail.com';
  v_before jsonb; v_n int;
BEGIN
  SELECT "beforeState" INTO v_before FROM public."AuditLog" WHERE id = v_audit_id;   -- EXACT record
  IF v_before IS NULL THEN RAISE EXCEPTION 'ABORT rollback: migration audit record % not found', v_audit_id; END IF;
  UPDATE public."Doctor"
     SET "supabaseUserId"=v_before->>'supabaseUserId',
         "supabasePhoneUserId"=v_before->>'supabasePhoneUserId',   -- original NULL restored as NULL
         email=v_before->>'email', "updatedAt"=now()
   WHERE id='c3d13b725f9e74c709f1839e8'
     AND "supabaseUserId"=v_google AND "supabasePhoneUserId"=v_phone
     AND email=v_migrated_email;   -- refuses if email changed post-migration
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'ABORT rollback: expected 1 row, got % (state changed since migration)', v_n; END IF;
END $$;
```

## 8. Clinic staff onboarding — individual Google accounts, least privilege

### 8.1 Model
Each staff member who needs portal access gets their **own** ClinicMember row for the Acube
clinic, keyed to their **own** personal Google email, with the smallest role: `STAFF` by
default, `CLINIC_ADMIN` only for a clinic manager. The hook links the uid by email on first
sign-in; staff land on `/clinic`, never `/doctor`. Today there are **zero** ClinicMember rows,
so nothing is over-privileged; add rows individually, for named people only. No staff identity
is ever `acubeaestheticsclinic@gmail.com` (that account becomes the doctor login).

### 8.2 No access from an unverified email match
The hook's email match is only the link mechanism; the authorization is the deliberate
creation of the pre-provisioned row, done only after identity verification and approved clinic
membership. Never create rows speculatively, in bulk, or from an unverified/shared address.
Staff-provisioning SQL is produced per named person at onboarding, under the same
explicit-authorization gate.

## 9. Clinic isolation & doctor-only clinical approvals
- **Isolation:** every clinic-scoped role carries `clinic_id`; `proxy.ts` + the `assert*`
  tenant guards scope all queries to that clinic. Another clinic's member, or an unrelated
  Google account, resolves to no Acube row and sees no Acube data.
- **Doctor-only:** `DOCTOR` is emitted only from a live Doctor row; `/doctor` + `/api/doctor/*`
  require it. Clinical review and treatment approval are restricted to the authorized doctor;
  `STAFF`/`CLINIC_ADMIN` cannot perform them.

## 10. Staging rehearsal evidence (synthetic, 2026-10-29) — PASS
The guarded migration + rollback were rehearsed on staging with throwaway `REH_` fixtures.
Pre-migration Google uid → no role (lockout reproduced); post-migration Google uid → DOCTOR +
intended clinic; retained phone uid → DOCTOR; unrelated uid → denied; `/doctor` guard resolved
to the right doctor+clinic; 0 cross-clinic leakage; patients/assessments stayed linked to the
unchanged `Doctor.id`; exact-id audit written; rollback restored the exact original state and
re-locked the Google uid; a stale rollback against a later legitimate edit matched 0 rows. The
only production difference is the de-sharing gate (§6) and the identity source; the mechanism
is identical.

## 11. Readiness & the exact approval required
Ready; production untouched; **PR #44 stays DRAFT — no merge, deploy, staff accounts, or SQL
execution** without separate authorization.

**Immediate P0 path:**
1. Complete and record the §2 de-sharing checklist (conditions 1–4).
2. Revoke the UID's existing app sessions (§6a).
3. Flip `v_desharing_confirmed := true` in §6b and set `v_desharing_by`.
4. Your explicit **EXECUTE** for §6a + §6b.
5. Post-write read-only verification: hook → `DOCTOR` + Acube; `/doctor` shows all current
   Acube patients + assessments (8/8 as of 2026-10-29; the count equals whatever exists at
   cutover, since the migration never writes those rows); clinic isolation; session refresh;
   logout; rollback-readiness.

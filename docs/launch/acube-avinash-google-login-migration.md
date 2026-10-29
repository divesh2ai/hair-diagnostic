# Acube Aesthetics — Google Authentication Design & Dr Avinash Migration (P0)

**Status:** AUTHORITATIVE DESIGN. Procedure validated by a synthetic staging rehearsal;
**not executed in production**. No production auth mapping, database record, deployment, or
staff account has been created or changed. Execution requires separate explicit
authorization (see §10). PR #44 remains a **DRAFT**.

**Target:** production `pykoyxbleowxwechotth` (`drfact-hairos-production`).
**Rehearsal:** staging `vbkoupvduadmcxggtnsb` (synthetic data only; no real Acube records
are ever copied to staging).

---

## 1. Authentication design decisions (authoritative)

1. **Dr Avinash logs in with an individually-controlled personal Google account** that has
   **2-Step Verification enabled**. He is the sole controller of its credentials and 2FA
   device. A shared or clinic-branded mailbox is never a doctor login identity.
2. **`acubeaestheticsclinic@gmail.com` and its existing Google UID
   `9b6afbc8-d69e-4e49-b44e-231c6aa136ba` are PROHIBITED from receiving DOCTOR
   permissions.** This address is accessible to multiple clinic staff; binding doctor-level
   clinical access to it would let anyone with mailbox access authenticate as the doctor.
   The migration SQL enforces this with a hard denylist guard (§5). The orphan `auth.users`
   row for this address grants nothing today (no app record references it) and must never be
   linked to a Doctor row.
3. **Identity continuity preserved.** The migration keeps `Doctor.id`
   (`c3d13b725f9e74c709f1839e8`), `clinicId` (`ccf1d8f1911e95f18366d848c`), and all **7
   patients** and **7 assessments** unchanged — it touches only the two identity columns and
   the email on the single Doctor row. All history FKs to `Doctor.id`, never to the auth UID.
4. **Clinic staff use their own individual Google accounts** with least-privilege
   `STAFF` / `CLINIC_ADMIN` roles (§7). No staff role is ever attached to the shared mailbox.
5. **No automatic access from an unverified email match (§7.2).** A pre-provisioned
   ClinicMember/Doctor row is itself the authorization decision and is created only after
   identity verification and approved clinic membership — never speculatively, never from an
   unverified address.
6. **Doctor-only clinical actions stay doctor-only (§8).** Clinical review and treatment
   approval require a live Doctor row; staff roles route to `/clinic` and can never reach
   `/doctor` or `/api/doctor/*`.
7. **The shared clinic Gmail is a contact address only (§9)** — e.g. `Clinic.email` for
   reception — never a login identity for any role.
8. **No Twilio / SMS and no Email-OTP dependency** for this restoration. Google is the
   primary (and, for the doctor, sole) authentication channel.

## 2. Verified production facts (read-only, 2026-10-29)

| Fact | Value |
| --- | --- |
| Doctor row id | `c3d13b725f9e74c709f1839e8` ("Dr Avinash Agarwal") |
| Clinic | `acube-aesthetics` / "Acube Aesthetics" (`ccf1d8f1911e95f18366d848c`) |
| `isActive` / `provisioningStatus` | `true` / `ACTIVE` |
| `Doctor.supabaseUserId` | `dacc52cf-7848-41fb-913c-700737ac5c51` (phone identity) — **unchanged** |
| `Doctor.supabasePhoneUserId` | `NULL` |
| `Doctor.email` | placeholder on reserved `.invalid` TLD |
| Phone UID exclusivity | `dacc52cf` appears in 1 place only — this Doctor row |
| Acube members | **only** the Doctor row — 0 ClinicMember, 0 OrganizationMember rows |
| Shared mailbox references | 0 in Doctor/ClinicMember/OrganizationMember; 1 orphan `auth.users` row (grants nothing) |
| Acube patients / assessments | 7 / 7 |
| History FKs to Doctor | `Assessment.reviewingDoctorId`, `Patient.doctorId`, `KitOrderIntent.doctorId`, `RecommendationFeedback.doctorId` → all reference **`Doctor.id`** |

## 3. Staging vs production schema diff (tables the migration writes)

`AuditLog` — identical in both: `id` is **NOT NULL, no DB default** (Prisma generates the
`cuid()` client-side, so a raw `INSERT` must supply `id`). `Doctor` — identical **except**
`email` is **NOT NULL in production** (nullable in staging); this is why the row holds a
`@hairos.invalid` placeholder rather than `NULL`. `updatedAt` is NOT NULL with no default in
both, so raw writes must set it.

## 4. Root cause

On "Continue with Google", Supabase mints a **new** auth user (uid `G`, the sign-in email,
`google` provider). The JWT hook's Doctor branch doesn't match: `supabaseUserId` /
`supabasePhoneUserId` ≠ `G`, and the `email` / `phone` pre-link fallbacks are gated behind
`supabaseUserId IS NULL` — false, because the phone uid is already set. No role claim →
`proxy.ts` forbids → `/login?reason=forbidden`. Data/linking gap, not a code bug.

## 5. Doctor migration — guarded, atomic, personal-UID only

### 5.1 Verified-ownership gate (perform first; not executed until §10)
1. Confirm Dr Avinash's **personal** Google address (2FA ON, sole controller) out-of-band.
2. He completes "Continue with Google" with that personal account on production `/login`
   (expect `/login?reason=forbidden` pre-link — normal). This mints his personal uid `G`.
3. Read-only verification before any write (bind email↔uid, provider `google`, confirmed,
   zero Doctor/ClinicMember/OrganizationMember/Patient links, **and not the shared mailbox**):

```sql
WITH g AS (SELECT '<G_personal>'::uuid AS uid, '<avinash-personal-email>' AS email)
SELECT
  (SELECT lower(u.email)=lower(g.email) FROM auth.users u, g WHERE u.id=g.uid)              AS email_matches_uid,
  (SELECT u.email_confirmed_at IS NOT NULL FROM auth.users u, g WHERE u.id=g.uid)           AS email_confirmed,
  (SELECT array_agg(i.provider) FROM auth.identities i, g WHERE i.user_id=g.uid)            AS providers,
  (SELECT count(*) FROM public."Doctor" d, g WHERE d."supabaseUserId"=g.uid::text OR d."supabasePhoneUserId"=g.uid::text) AS g_doctor_links,
  (SELECT count(*) FROM public."ClinicMember" m, g WHERE m."supabaseUserId"=g.uid::text)    AS g_clinicmember_links,
  (SELECT count(*) FROM public."OrganizationMember" m, g WHERE m."supabaseUserId"=g.uid::text) AS g_orgmember_links,
  (lower('<avinash-personal-email>') <> 'acubeaestheticsclinic@gmail.com')                  AS not_shared_mailbox;
-- PASS gate: email_matches_uid, email_confirmed, providers⊇{google}, all link counts 0, not_shared_mailbox=true.
```

### 5.2 The write — single atomic block, self-aborting (NOT executed)

```sql
DO $$
DECLARE
  v_target_id      text := 'c3d13b725f9e74c709f1839e8';
  v_old_phone_uid  text := 'dacc52cf-7848-41fb-913c-700737ac5c51';
  v_new_google_uid text := '<G_personal>';              -- Avinash's PERSONAL Google UID (from §5.1)
  v_new_email      text := '<avinash-personal-email>';  -- personal address; NOT the clinic mailbox
  v_old_supa text; v_old_phone text; v_old_email text; v_clinic text; v_n int;
  v_audit_id text := 'mig-c3d13b72-google-personal-20261029';   -- FIXED id → exact rollback binding
BEGIN
  -- Hard denylist (design §1.2): the shared clinic mailbox may never be a doctor login.
  IF lower(v_new_email) = 'acubeaestheticsclinic@gmail.com'
     THEN RAISE EXCEPTION 'ABORT: shared clinic mailbox must not be a doctor login identity'; END IF;
  IF v_new_google_uid = '9b6afbc8-d69e-4e49-b44e-231c6aa136ba'
     THEN RAISE EXCEPTION 'ABORT: shared clinic Google UID is prohibited from DOCTOR permissions'; END IF;

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

  -- The write: personal Google canonical; phone UID retained for rollback; placeholder -> real email.
  UPDATE public."Doctor"
     SET "supabaseUserId"=v_new_google_uid, "supabasePhoneUserId"=v_old_phone_uid,
         email=v_new_email, "updatedAt"=now()
   WHERE id=v_target_id AND "supabaseUserId"=v_old_phone_uid AND "supabasePhoneUserId" IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'ABORT: expected exactly 1 Doctor row updated, got %', v_n; END IF;

  -- Exact-record audit: fixed id, ACTUAL originals in beforeState.
  INSERT INTO public."AuditLog"(id,action,"entityType","entityId","actorId","actorType",source,metadata,"beforeState","afterState","createdAt")
  VALUES (v_audit_id,'DOCTOR_GOOGLE_IDENTITY_LINKED','Doctor',v_target_id,v_new_google_uid,'system','script',
          jsonb_build_object('clinicId',v_clinic,'fromUid',v_old_phone_uid,'toUid',v_new_google_uid),
          jsonb_build_object('supabaseUserId',v_old_supa,'supabasePhoneUserId',v_old_phone,'email',v_old_email),
          jsonb_build_object('supabaseUserId',v_new_google_uid,'supabasePhoneUserId',v_old_phone_uid,'email',v_new_email),
          now());
END $$;
```

The fixed `v_audit_id` also makes the migration idempotent-safe: a re-run collides on the
AuditLog primary key and aborts, and the optimistic `WHERE` no-matches once migrated.

## 6. Rollback — exact-record bound, email-change protected (NOT executed)

```sql
DO $$
DECLARE
  v_audit_id       text := 'mig-c3d13b72-google-personal-20261029';
  v_google         text := '<G_personal>';
  v_phone          text := 'dacc52cf-7848-41fb-913c-700737ac5c51';
  v_migrated_email text := '<avinash-personal-email>';
  v_before jsonb; v_n int;
BEGIN
  SELECT "beforeState" INTO v_before FROM public."AuditLog" WHERE id = v_audit_id;   -- EXACT record, not latest-matching
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

## 7. Clinic staff onboarding — individual Google accounts, least privilege

### 7.1 Model
Each staff member who needs portal access gets **their own** ClinicMember row for the Acube
clinic, keyed to **their own** personal Google email, with the smallest role that fits:
- `STAFF` — default; operational access to `/clinic`, no clinical approval authority.
- `CLINIC_ADMIN` — only for a clinic manager who must manage the clinic (doctors, settings).

On the member's first Google sign-in, the JWT hook links their uid by email and emits the
clinic-scoped role + `clinic_id`. Staff land on `/clinic`; they can never reach `/doctor`.
Today there are **zero** ClinicMember rows for Acube, so nothing is over-privileged; add rows
individually, on request, for named people only.

### 7.2 No access from an unverified email match
The hook's email match is only the *link mechanism*; the *authorization decision* is the
deliberate creation of the pre-provisioned row. Therefore:
- Create a ClinicMember row **only after** verifying the person's identity and confirming
  approved clinic membership (named individual, role approved by the clinic admin / Super
  Admin).
- Never create a row speculatively, in bulk, or from an unverified or shared address.
- Never attach any role to `acubeaestheticsclinic@gmail.com`.

Staff-provisioning SQL is intentionally **not** templated here; it is produced per named
person (email + role) at onboarding time, under the same explicit-authorization gate as the
Doctor migration.

## 8. Clinic isolation & doctor-only clinical approvals

- **Isolation:** every clinic-scoped role carries `clinic_id` from the hook; `proxy.ts` and
  the `assert*` tenant guards scope all queries to that clinic. A member of another clinic —
  or an unrelated Google account — resolves to no Acube row and sees no Acube data.
- **Doctor-only actions:** `DOCTOR` is emitted only from a live `Doctor` row (hook precedence
  step 2); `/doctor` and `/api/doctor/*` require that row (`loadDoctorShellData`). Clinical
  review and treatment approval are therefore restricted to the authorized doctor; `STAFF`
  and `CLINIC_ADMIN` cannot perform them.

## 9. Shared clinic Gmail — contact only
`acubeaestheticsclinic@gmail.com` may be used as a **contact** address (e.g. `Clinic.email`
reception contact) but never as a login identity for any role. It is prohibited from DOCTOR
permissions (§1.2) and must not back any ClinicMember/OrganizationMember row.

## 10. Staging rehearsal evidence (synthetic, 2026-10-29) — PASS

The guarded migration + rollback were rehearsed on staging with throwaway `REH_` fixtures
(Doctor A mirrored Avinash's exact starting state). Results: pre-migration Google uid → no
role (lockout reproduced); post-migration Google uid → **DOCTOR + intended clinic**; retained
phone uid → DOCTOR; unrelated uid → denied; `/doctor` guard resolved to the right doctor+
clinic; **0** cross-clinic leakage; patients/assessments stayed linked to the unchanged
`Doctor.id`; exact-id audit written; rollback restored the exact original state and re-locked
the Google uid; a stale rollback against a later legitimate edit matched **0 rows**. The
only change for production is the identity *source* (a personal Google account, not the shared
mailbox); the mechanism is identical.

## 11. Readiness & the exact approval required

Ready for execution; production untouched; **PR #44 stays DRAFT — do not merge, deploy,
create production staff accounts, or execute production SQL** without separate authorization.

**Immediate P0 path:**
1. Dr Avinash signs in with his **personal** (2FA) Google account → mints uid `G`.
2. Read-only verification (§5.1) fills `<G_personal>` / `<avinash-personal-email>`.
3. Your explicit **EXECUTE** for §5.2.
4. Post-write read-only verification: hook → `DOCTOR` + Acube; `/doctor` shows the 7 patients
   + 7 assessments; clinic isolation; session refresh; logout; rollback-readiness.

**Open follow-ups (non-blocking for the doctor restore):** staff onboarding per named person
(§7); optional cleanup of the orphan shared-mailbox `auth.users` row; the login-UI Email-OTP
gating hardening; and the stale hook-provenance comment.

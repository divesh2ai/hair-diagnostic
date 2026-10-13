# Doctor Mobile OTP — Flow Verification & Activation Procedure (Dr Avinash Agarwal)

**Status: Dr Avinash Agarwal is held at `CONTACT_REQUIRED`. No contact has been written. No activation
performed.** This document verifies the existing phone-based authentication path and specifies the exact,
reversible activation steps to run **only after** you supply the verified mobile number.

---

## 1. The phone-OTP doctor login path (verified, end-to-end)

Supabase mints a **separate auth user per channel** (a phone login carries `phone`/no `email`; an email
login the reverse), so one doctor can have two auth UIDs. The code accounts for this throughout.

```
Doctor opens /login  →  enters mobile  →  supabase.auth.signInWithOtp({ phone })
      │                                         (Supabase sends SMS OTP via the configured provider)
      ▼
Doctor enters code  →  supabase.auth.verifyOtp({ phone, token })   → fresh session cookie
      ▼
[A] Supabase fires custom_access_token_hook  →  the FIRST token already carries role=DOCTOR
      │   supabase/functions/custom_access_token_hook.sql, step 2 "Doctor" branch:
      │   matches when  Doctor.supabaseUserId IS NULL
      │                 AND digits(Doctor.phone) == digits(auth.users.phone)
      │                 AND Doctor.isActive AND Doctor.deletedAt IS NULL
      ▼
[B] Client POSTs /api/auth/phone-login/link (no body — reads the caller's OWN verified phone
      from the Supabase session)  →  resolveOrLinkDoctorByPhone()
      │   apps/patient-portal/src/lib/auth/phoneDoctorLink.ts
      ▼
    Writes back once, idempotently:  Doctor.supabasePhoneUserId = uid,  provisioningStatus = ACTIVE
      ▼
Doctor reaches /doctor workspace (requireDoctorContext matches on EITHER identity column)
```

**Safety properties confirmed in code (not asserted — read):**

- **Never auto-creates a doctor.** A verified phone that matches no provisioned `Doctor` row is refused
  (`reason: "unregistered"`, audited `DOCTOR_PHONE_LOGIN_DENIED_UNREGISTERED`). *"OTP verification proves
  control of a phone number; it proves nothing about clinical authorization."* Only a Super-Admin-provisioned
  row may reach the workspace.
- **Full-number match only.** `digitsOnly()` compares every digit; `+91XXXXXXXXXX` (DB) vs `91XXXXXXXXXX`
  (Supabase) reconcile cleanly. No suffix/fuzzy matching.
- **Fail-closed on conflicts.** A different phone identity already owning the row → `409 conflict`
  (`DOCTOR_PHONE_LOGIN_DENIED_CONFLICT`). A deactivated doctor → `403 inactive` (distinct from
  "unregistered", so "we closed your account" is never reported as "unknown number").
- **Email stays a working fallback.** The phone identity is *attached alongside* an existing email
  identity, never replacing it (the mobile-login defect fixed for drfact-mumbai, migration
  `20260918_doctor_phone_identity`).
- **`@unique` on both identity columns** → an auth identity can never name two doctor rows; clinic
  isolation preserved.

The matching logic exists in **two places that must agree**: the claims hook (SQL, in-DB, authorization-bearing)
and `resolveOrLinkDoctorByPhone` (app, write-back). Both strip non-digits and match the full number.

## 2. The provisioning state machine (why CONTACT_REQUIRED is the correct hold)

`apps/patient-portal/src/lib/doctor/provisioning.ts` derives status rather than storing it:

| `contactStatus` | Condition | Can invite / log in? |
|---|---|---|
| **`CONTACT_REQUIRED`** | no `email` and no `phone` on file | **No — the correct hold state for Dr Avinash** |
| `UNCONFIRMED` | a contact is on file but `provisioningStatus` still `CONTACT_REQUIRED` (recorded from an unverified source, not human-confirmed) | No |
| `CONFIRMED` | a human confirmed the contact is personally the doctor's | Yes |

`dashboardAccess` is true **only** when a Supabase identity is actually linked AND the row is active AND
not soft-deleted — the same predicate `requireDoctorContext` enforces per request, so the console can
never promise access the API refuses. Today Dr Avinash has no linked identity → `dashboardAccess = false`,
`blockedReason = "No personal login contact on file - cannot invite"`.

## 3. Activation procedure — run ONLY after you provide the verified number

**Preconditions (all must hold before step 1):**

1. **Verified mobile number** for Dr Avinash, in full E.164 (`+91XXXXXXXXXX`), confirmed by a human as
   personally theirs (not a clinic landline — clinic numbers belong on `ClinicLocation.phone`).
2. A **`Doctor` row** for Dr Avinash exists, `isActive = true`, `deletedAt = null`, in the correct Acube
   clinic. (Verify with `scripts/verify-doctor-workspace.ts` / `scripts/verify-launch-cohort.ts`.)
3. The number is **not already** on another `Doctor` row (the column is `@unique`; the onboard script
   rejects shared numbers with *"X and Y share the mobile …"*).
4. **Supabase phone/SMS provider configured** for the target project (staging: `vbkoupvduadmcxggtnsb`),
   and `custom_access_token_hook` registered under Auth → Hooks. Without a provider, OTP SMS never sends.

**Steps (staging first; production is a separate, later authorisation):**

1. Add Dr Avinash's verified number to the launch contacts file consumed by
   `scripts/onboard-launch-clinics.ts` (the script writes `Doctor.email`/`Doctor.phone`; with a contact
   present it moves the row from `CONTACT_REQUIRED` to `READY_TO_INVITE` and **never demotes a live login**).
   → This is the single supported write path; do **not** hand-edit the DB.
2. Re-run the onboard/verify scripts against **staging** and confirm the row now reads
   `login: (none)  mobile: +91XXXXXXXXXX`, `provisioningStatus` advanced from `CONTACT_REQUIRED`.
3. Dr Avinash performs a real OTP login on staging `/login`:
   `signInWithOtp` → SMS → `verifyOtp` → client auto-calls `/api/auth/phone-login/link`.
4. Confirm the write-back: `Doctor.supabasePhoneUserId` now set, `provisioningStatus = ACTIVE`, audit row
   `DOCTOR_PHONE_LOGIN_LINKED` (or `DOCTOR_PHONE_IDENTITY_ATTACHED` if an email identity already existed).
5. Confirm `/doctor` loads for Dr Avinash and is scoped to the Acube clinic only.

**Rollback / hold:** until step 1 runs, the row stays `CONTACT_REQUIRED` and no login is possible — the
safe default. If activation must be undone, clear `Doctor.phone` and `supabasePhoneUserId` and set
`provisioningStatus = CONTACT_REQUIRED` (via the supported admin path), which returns the row to the hold state.

## 4. Pre-activation checks to run now (no number required)

- `tests/api/phone-doctor-link.test.ts` — the unit contract for `resolveOrLinkDoctorByPhone`
  (unregistered / inactive / conflict / first-link / attach-second-identity). **Note:** this file is
  among the suite's DB/collection-dependent tests and did not execute in this sandbox (no live Postgres);
  it must be run in a DB-backed environment (staging or local stack) as part of verification.
- `scripts/verify-staging-auth.ts`, `scripts/verify-doctor-workspace.ts` — confirm the hook is live and
  the Acube doctor cohort resolves, before any OTP attempt.

**Nothing in this document has been executed. Dr Avinash remains CONTACT_REQUIRED pending the verified number.**

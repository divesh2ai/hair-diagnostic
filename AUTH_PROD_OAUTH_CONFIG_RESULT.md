# P0 — Production Google OAuth: preflight result + config spec + deployment GO/NO-GO

**Date:** 2026-10-28 · Scope: **configuration preflight only.** No production code merged or deployed.
No clinic/doctor/patient/DB business records changed. Staging frozen. PR #42 untouched.

---

## 0. Important division of labour (read this first)

The production OAuth configuration lives in **two dashboards** — Google Cloud Console and the
Supabase **Auth** settings — plus a **private client secret**. Those are **not reachable or
editable from this session's tooling** (the Supabase connector exposes DB/SQL, migrations and
advisors, but **not** Auth provider / Site URL / redirect-allowlist settings; and the client secret
must never pass through me). So I have done everything that is safe and possible from here —
recorded the DB-side invariants, verified the exact `redirectTo`, pinned the deployment/rollback
identity, and written the precise values + reversible steps — and the **dashboard entry itself is
yours to perform**. I have changed nothing in production.

---

## 1. Production "before" snapshot (recorded — read-only)

**What I could read (DB, via SQL):**
- Super Admin `OrganizationMember`: `divesh2ai@gmail.com` → `supabaseUserId = d0cb37d1-7b24-4cc5-90f5-035f4f02d468`; matches `auth.users.id`; **identities = `email` only** (no Google yet); role SUPER_ADMIN, active.
- JWT access-token hook `public.custom_access_token_hook` present, `SECURITY DEFINER`, plpgsql — role is derived here from `OrganizationMember`, never from the Google email. **Preserve unchanged.**
- 7 production clinics, all ACTIVE (GH Derma, Acube, Tressze, Bala Clinic, Radiance, Dr. Aggarwal's Clinic, Dr. Sumit Ahuja).

**What I could NOT read (dashboard-only) — please record these verbatim BEFORE changing anything:**
- Supabase → Auth → Providers → **Google**: enabled? client ID? (secret: do not record anywhere)
- Supabase → Auth → URL Configuration → **Site URL** (current value)
- Supabase → Auth → URL Configuration → **Redirect allow-list** (current entries)
- Supabase → Auth → **identity linking** setting (automatic same-email linking on/off)
- Google Cloud → the OAuth 2.0 **Web client** (exists? current Authorized origins / redirect URIs)

(Keep a copy of the current values — that copy IS the reversal record for the dashboard side.)

## 2. Exact production values to enter

**Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Web client**
- Authorized JavaScript origin: `https://hairos-ashen.vercel.app`
- Authorized redirect URI: `https://pykoyxbleowxwechotth.supabase.co/auth/v1/callback`
  (this is Supabase's GoTrue callback — the only redirect URI Google needs; the app's
  `/auth/callback` is **not** a Google redirect URI.)

**Supabase (prod `pykoyxbleowxwechotth`) → Auth → Providers → Google**
- Enable; paste **Client ID** and **Client Secret** privately (never shared with me or in the repo).

**Supabase → Auth → URL Configuration**
- **Site URL:** leave exactly as-is. *If anything forces a Site URL change, STOP and report* (per your safeguard #5).
- **Redirect allow-list:** add an entry that matches the app callback. PR #37 builds (verified §3):
  - `https://hairos-ashen.vercel.app/auth/callback?next=%2Fpost-login`
  - `https://hairos-ashen.vercel.app/auth/callback?next=%2Fpost-login%3Fnext%3D%252Fadmin%252Fclinics`
  Supabase matches the **whole** `redirectTo` (query string included) and supports glob wildcards.
  Because the nested `next` is dynamic, a bare path will NOT match a URL carrying a query string —
  so add the robust least-privilege wildcard **`https://hairos-ashen.vercel.app/auth/callback*`**
  (or `https://hairos-ashen.vercel.app/auth/callback?**`). The two exact URLs above are what it must
  cover. Do not widen to `https://hairos-ashen.vercel.app/**`.
- **Identity linking:** confirm **automatic same-email linking is ON** (prerequisite — see §4).

## 3. `redirectTo` verified against PR #37 code (not assumed)

`login/page.tsx`:
```
nextPath  = nextParam ? `/post-login?next=${encodeURIComponent(nextParam)}` : "/post-login"
redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
```
On origin `https://hairos-ashen.vercel.app`:
- No deep link → `…/auth/callback?next=%2Fpost-login` ✓ (matches your URL #1)
- Deep link `/admin/clinics` (proxy sends `/login?next=/admin/clinics`) →
  `…/auth/callback?next=%2Fpost-login%3Fnext%3D%252Fadmin%252Fclinics` ✓ (matches your URL #2)

Chain: Google → GoTrue `/auth/v1/callback` → app `/auth/callback` (`exchangeCodeForSession`) →
`/post-login` (role routing) → `SUPER_ADMIN → /admin`.

## 4. Authorization preserved — UID mapping, not email

- `custom_access_token_hook` emits `user_role=SUPER_ADMIN` only when the JWT uid matches
  `OrganizationMember.supabaseUserId` (`d0cb37d1…`); the email fallback applies only when
  `supabaseUserId IS NULL`, which is **not** the case here. So Google email alone grants nothing.
- Therefore the Google identity must attach to the **existing uid `d0cb37d1…`**. That is what
  automatic same-email identity linking does (the email is already confirmed). **Staging proves the
  mechanism:** the staging SA carries a real `google` identity (`sub 114681157184278711007`) on the
  **same uid** as its SUPER_ADMIN `OrganizationMember`, linked 2026-10-26, signed in 2026-10-27.
- **Verify after first prod login:** prod SA identities should read `email,google` on uid
  `d0cb37d1…`. If instead a *new* uid appears, linking was off — do **not** relax the email rule;
  re-enable linking, or (separate, explicitly-approved step) repoint `OrganizationMember.supabaseUserId`
  to the new uid. Never set it NULL.
- Unauthorized Google account → new uid, no `OrganizationMember` match → no privileged claim →
  `proxy.ts` denies `/admin` + `/api/admin`.

## 5. Deployment identity, delta, rollback target (recorded)

- **Current production deployment (serves `hairos-ashen.vercel.app`):**
  `dpl_FsF23mz4tKEyf3s6ghyWjkjybuDZ` → `hairos-k1kc0m4am-diveshs-projects-6230f270.vercel.app`,
  target **production**, branch `claude/acube-launch-fix` @ **`0227041308bc3a86def47b0067bbe446e49de4a3`**.
- **This is the rollback target.** Rollback = re-point the `hairos-ashen.vercel.app` alias back to
  `dpl_FsF23mz4…`. No DB/schema change accompanies the hotfix, so nothing else to undo.
- **Hotfix delta (isolated):** PR #37 = **1 file**, `apps/patient-portal/src/app/login/page.tsx`
  (+76), based on `claude/acube-launch-fix`. No other files, no migrations, no doctor/clinic/patient
  code. Config change (OAuth) is independent of the code deploy and can be validated first.

## 6. Manual dashboard steps you must complete (I cannot)

1. Record current values (§1 "could not read").
2. Google Cloud: create/confirm the Web OAuth client with the origin + redirect URI in §2.
3. Supabase prod: enable Google provider, paste Client ID/Secret privately.
4. Supabase prod: add the `/auth/callback*` redirect entry; confirm Site URL unchanged; confirm
   same-email identity linking ON.
5. Tell me when done — I'll re-read the prod SA identities (read-only) to confirm linking resolved
   to uid `d0cb37d1…` on your first Google login, before any deploy-approval request.

## 7. Recommendation

- **Production OAuth configuration: GO** — values and steps are verified and isolated; the only
  risk (new-uid instead of linked-uid) is caught by the §4 post-login identity re-check, and the
  config is reversible by restoring the recorded dashboard values. **You perform the dashboard entry;
  I will verify the result read-only.**
- **Production code merge/deploy of PR #37: NO-GO / HOLD** — not authorized in this step. When you're
  ready, the deploy is low-risk (1-file delta; rollback = re-alias to `dpl_FsF23mz4…`), and I will
  request explicit authorization before merging or deploying anything.

Blockers remaining before a working prod login: dashboard config (§6, yours), then the authorized
code deploy of PR #37 (separate approval).

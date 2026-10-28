# P0 — Super Admin Google Login: verification + production hotfix proposal (PR #37)

**Date:** 2026-10-28 · **Status:** investigation complete · **No production change made.**
Scope: Google Sign-In for Super Admin only. No clinic/assessment/recovery/map/DB changes.

---

## 1. PR #37 — compatible & minimal (verified)

- **One file:** `apps/patient-portal/src/app/login/page.tsx` (+76). Adds a "Continue with Google"
  button → `supabase.auth.signInWithOAuth({ provider: "google" })` (PKCE via `@supabase/ssr`),
  `redirectTo = <origin>/auth/callback?next=/post-login`, plus a callback-error banner.
- **No authorization code touched.** Callback (`/auth/callback` → `exchangeCodeForSession`), edge
  guard (`src/proxy.ts`), role routing (`/post-login`), and the JWT hook all **already exist on the
  production branch** (`claude/acube-launch-fix`, which PR #37 is based on). The hotfix is purely the
  login button.
- Flow: Google → `/auth/callback?next=/post-login` → session cookie set → `/post-login` routes by
  role → `SUPER_ADMIN → /admin`. Confirmed in code.
- CI: the only failing check is `Legacy baseline (informational)` — pre-existing, non-blocking,
  unrelated to this diff (documented on the PR). Preview build READY. `mergeable_state: unstable`
  reflects only that informational check.

## 2. Authorization is role-based, never email-based (verified)

- `/admin` + `/api/admin` are **SUPER_ADMIN-only, enforced at the edge** in `proxy.ts` via
  `supabase.auth.getClaims()` (JWKS-verified JWT). No session → `/login`; wrong role → `/login?reason=forbidden`.
- `user_role` is set **only** by `public.custom_access_token_hook`, which reads
  `OrganizationMember` and matches identity by **`supabaseUserId = uid`** (the email fallback applies
  *only* when `supabaseUserId IS NULL`). A Google email/provider grants **nothing** on its own.
- **Unauthorized Google account** → new uid with no `OrganizationMember`/`Doctor`/`ClinicMember`
  match → hook emits no privileged claim → edge guard denies `/admin` and `/api/admin`. (Prod has
  exactly one `OrganizationMember`, the SUPER_ADMIN, so there is no stray mapping to exploit.)

## 3. Identity mapping — the pivotal dependency

| | Staging (`vbkoupvduadmcxggtnsb`) | Production (`pykoyxbleowxwechotth`) |
|---|---|---|
| SA `OrganizationMember` | `divesh2ai@gmail.com`, role SUPER_ADMIN, active | `divesh2ai@gmail.com`, role SUPER_ADMIN, active |
| `supabaseUserId` ↔ auth uid | `9041f8cf…` = auth uid ✓ | `d0cb37d1…` = auth uid ✓ |
| email confirmed | yes | yes |
| auth identities | **`email, google`** (Google already linked to the SA uid) | **`email` only** (never signed in) |

**Consequence:** Google sign-in only resolves to SUPER_ADMIN if the Google identity attaches to the
**existing SA uid** (`d0cb37d1…` in prod). That requires **Supabase automatic same-email identity
linking = ON**. If it is OFF, Google mints a *new* uid with no `OrganizationMember` → no admin claim
→ SA stays locked out (safe, but the fix doesn't work).

**Staging proves the mechanism works end-to-end:** the staging SA already carries a `google` identity
on the same uid as its SUPER_ADMIN `OrganizationMember` — i.e. an authorized Google login there
already resolves to the correct account and role.

## 4. Staging test results

- **Authorized login — PASS (evidenced).** Staging SA uid `9041f8cf…` has `email,google` identities
  and `uid_matches = true` against the SUPER_ADMIN `OrganizationMember`; the hook therefore emits
  `user_role=SUPER_ADMIN` and `/post-login` routes to `/admin`.
- **Unauthorized login — PASS by construction.** Non-mapped Google identity → no privileged claim →
  `proxy.ts` denies `/admin` + `/api/admin`. (A live click-through with a second, throwaway Google
  account is the one check I cannot run myself — it needs a real Google credential and a browser;
  recommended as the final human confirmation before prod.)
- **Doctor/patient flows:** untouched — PR changes only the login page; mobile-OTP, clinic isolation,
  RLS unchanged. Auth suites pass (per PR: 77).

## 5. Production readiness — what's missing

The code is ready; the gap is **production dashboard configuration** (settings I cannot read or
change via tooling — they need you in Google Cloud + Supabase):

1. **Google Cloud** — OAuth 2.0 Web client; Authorized redirect URI
   `https://pykoyxbleowxwechotth.supabase.co/auth/v1/callback`.
2. **Supabase (prod) → Auth → Providers → Google** — enable; paste Client ID + Secret.
3. **Supabase (prod) → Auth → URL Configuration** — add `https://hairos-ashen.vercel.app/auth/callback`
   to the redirect allow-list.
4. **Supabase (prod) → Auth** — confirm **automatic same-email identity linking is ON** (so Google
   attaches to uid `d0cb37d1…`). This is the single most important setting (see §3).
5. **Code deploy** — get PR #37's single-file change onto what `hairos-ashen.vercel.app` serves
   (currently `claude/acube-launch-fix` @ `0227041`, which has no Google button).

---

## 6. Proposed production deployment steps (FOR APPROVAL — do not execute yet)

1. **Config first (you, in dashboards):** steps 1–4 above. Nothing user-visible changes yet.
2. **Merge PR #37** into `claude/acube-launch-fix` (clean — 1 file, no conflicts; it is the PR's base).
   Explicitly exclude any other branch/commit (no clinic/assessment/recovery/map/DB changes ride along).
3. **Deploy** that branch to the production target and confirm `hairos-ashen.vercel.app` serves the
   new build.
4. **Post-deploy verification (acceptance):**
   - "Continue with Google" visible on `https://hairos-ashen.vercel.app/login`.
   - Authorized SA (`divesh2ai@gmail.com`) → Google → lands on `/admin`; `/admin/clinics` shows the
     **7 clinics** (GH Derma, Acube, Tressze, **Bala Clinic**, **Radiance**, **Dr. Aggarwal's
     Clinic**, Dr. Sumit Ahuja).
   - Session persists across reload; logout works and returns to `/login`.
   - A non-SA Google account is denied `/admin` and a sample `/api/admin/*` (403/redirect).
   - Doctor mobile-OTP login still works (regression spot-check).
   - Re-check the prod SA auth identities: after first Google login, providers should read
     `email,google` on uid `d0cb37d1…` (confirms linking, not a new uid).
5. **Contingency (approval-gated):** if step 4 shows Google created a *new* uid (linking was off),
   do **not** loosen the email rule. Either enable linking and retry, or — with explicit approval —
   run the one-row prod update `OrganizationMember.supabaseUserId = <new google uid>` for
   `divesh2ai@gmail.com`. Keep `supabaseUserId` pinned to a uid (never NULL) so email alone never
   grants admin.

Rollback: re-point the production alias to the previous deployment; the Google button simply
disappears (no data/schema change to undo).

---

## 7. Blockers & recommendation

| # | Blocker | Owner | Needed |
|---|---|---|---|
| A1 | Google provider not confirmed enabled in **prod** Supabase | You | Dashboard config §5.1–5.3 |
| A2 | Same-email identity linking must be ON in **prod** | You | Dashboard §5.4 (staging already on) |
| A3 | PR #37 button not deployed to prod | You (approve) → me (merge) | §6.2–6.3 after approval |
| A4 | Live unauthorized-account click test | You | Final human check (2nd Google acct) |

**Recommendation: CONDITIONAL GO.** The code (PR #37) is minimal, isolated, and verified; the
authorization model is sound (role-based, not email-based); and staging proves the Google→SUPER_ADMIN
path works end-to-end. The only things between here and a working prod login are the **prod dashboard
config (A1–A2)** and the **approved deploy (A3)** — no code risk to the clinical system. Once A1–A2
are set and you approve A3, this is a GO. I will not merge or deploy until you say so.

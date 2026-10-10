# HairOS Production Launch Readiness

**Verdict: NOT READY — hard blockers below.** Prepared read-only; no production
writes, no migration resolution, no seeding, no deployment were performed.

- Production Supabase: `drfact-hairos-production` / `pykoyxbleowxwechotth` (ap-south-1, ACTIVE_HEALTHY)
- Staging Supabase: `hairos-staging` / `vbkoupvduadmcxggtnsb` (isolated; 0 staging rows in prod)
- Vercel project: `hairos` (`prj_UPJJ2IOeo6xWlTuSAPz92ZyqhNRV`, team `team_mxyN3cO24XfuFVONUc85Twcz`)

---

## Exact blockers (ordered)

| # | Blocker | Evidence | Fix (needs approval; not done here) |
|---|---------|----------|--------------------------------------|
| B1 | **Vercel Production serves the demo, not HairOS** | All 3 production-target deployments are branch `main` @ `b31c2e33` *"fix(demo): polish dashboard founder walkthrough"*. `origin/main` tree = `index.html`, `DrFACT_v5_Demo.html`, demo zip. Project `live:false`. | Point the Vercel **Production Branch** at the HairOS release branch (the PR #22 line), set root dir `apps/patient-portal`, then deploy. Do NOT merge HairOS into `main` blindly — confirm the intended release branch first. |
| B2 | **Migration ledger drift — prod built by `prisma db push`, not `migrate deploy`** | Ledger: 18 rows, 12 finished, last finished `20260626_identity_alignment`; `20260626_phase3_admin` `finished_at=NULL`. Repo has **38** migrations — 26 never recorded. | Reconcile with `prisma migrate resolve` + `migrate deploy` in a controlled window (explicitly out of scope for this task). |
| B3 | **All RLS policies & most SQL functions missing in prod** | Prod `pg_policies` = **0**; repo migrations define **89** `CREATE POLICY`. Prod public functions = **1**; repo defines **12** (`jwt_is_super_admin` missing — defined in `20260626_platform_foundation`). 67 tables have RLS **enabled with zero policies** (default-deny for `anon`/`authenticated`). | Apply the migration-only SQL (policies + functions) via B2's `migrate deploy`. Until then any direct Supabase-client/RLS path is denied; app works only via Prisma owner connection. |
| B4 | **Production has no configuration data** | 0 Organizations, 0 Clinics, 0 OrganizationMembers, 0 Doctors, 0 auth users, 0 Kit/Product/Price, `PlatformSettings` singleton missing. | Run the reviewed bootstrap (§Bootstrap) + load the approved catalog — after B1–B3. |
| B5 | **TWO storage buckets missing** | `scripts/provision-storage.ts` declares **5** private buckets: `clinical-reports`, `clinical-images`, `doctor-avatars`, `one-pagers`, `report-assets`. Prod has only the first three → **`one-pagers` AND `report-assets` missing**. `one-pagers` holds the immutable approved-snapshot JSON (source of truth for renders); `report-assets` holds rendered PNG/PDF. | `npx tsx scripts/provision-storage.ts --allow-production` against prod. |
| B6 | **Vercel env wiring + Auth providers unverified** | Env values are policy-blocked from this session; Auth/GoTrue config is not in SQL. | Confirm in dashboards per §Preflight. The whole login is OTP — if prod Auth email/SMS is unconfigured, nobody can sign in. |

Security hardening for the dev-login / report-export bypass is **done** in PR #23
(preview-only, opt-in flag, constant-time secret, email allowlist, and — new —
refusal whenever the Supabase target is the production project). 52 unit tests pass.

---

## §3 Vercel Production branch — verification evidence

`list_deployments(target=production)` → 3 READY deployments, all:
```
githubCommitRef : main
githubCommitSha : b31c2e33880fa2e3c31e050c1684ee68b6b55519
githubCommitMessage: "fix(demo): polish dashboard founder walkthrough"
githubRepo/org  : divesh2ai/hair-diagnostic
```
`origin/main` HEAD `35592328 "Add files via upload"`; tree is the HTML demo + an
`apps/` dir, but the **production release commit `b31c2e33` is a demo commit** and
is not the HairOS head. Intended HairOS code = PR #22 line
(`claude/charming-maxwell-lberc4` ← `claude/remove-public-devlogin-secret` @ `9cda788`).
**Do not assume `main` is the release branch** — it is the demo. → B1.

## §4 Migration `20260626_phase3_admin` — applied vs not

Migration declares: `ClinicStatus` enum + `Clinic.status`; 7 Clinic branding
columns; 3 Doctor credential columns; `PlatformSettings` table + unique index +
singleton seed + RLS enable + 2 policies (`_select`, `_modify`) using
`public.jwt_is_super_admin()`.

| Object | In production? |
|--------|----------------|
| `ClinicStatus` enum | ✅ present |
| `Clinic.status` | ✅ present |
| Clinic branding cols (7) | ✅ 7/7 present |
| Doctor credential cols (3) | ✅ 3/3 present |
| `PlatformSettings` table | ✅ present |
| `PlatformSettings` RLS enabled | ✅ enabled |
| `PlatformSettings` singleton row | ❌ **missing** (0 rows) |
| `PlatformSettings_select` / `_modify` policies | ❌ **missing** (0 policies) |
| `public.jwt_is_super_admin()` | ❌ **missing** |
| Ledger row | `finished_at=NULL`, checksum `e0e3439b…` (started, never finished) |

**Conclusion:** schema-derived objects exist (via `db push`); the migration's
raw-SQL artifacts (function, policies, seed row) were never applied, and the
ledger records the migration as unfinished. This is the per-migration face of
B2/B3. **Ledger left unchanged as instructed.**

---

## Safe deployment sequence

1. **Security gate** — merge PR #22 then PR #23 (keep both unmerged until their
   checks pass and review is approved). Confirms the HairOS release branch.
2. **Point Vercel Production** at the HairOS release branch, root `apps/patient-portal`;
   do **not** deploy yet.
3. **DB reconciliation (maintenance window)** — resolve the ledger
   (`prisma migrate resolve`), `prisma migrate deploy` so the 89 policies + 12
   functions exist. Verify `pg_policies > 0` and `jwt_is_super_admin` present.
4. **Provision storage** — `scripts/provision-storage.ts` → creates `report-assets`.
5. **Preflight** — complete the checklist below (Auth, OTP, env, storage, PDF, WhatsApp).
6. **Bootstrap** — create auth users (Supabase Auth), then run `scripts/prod-bootstrap.sql`
   (steps 1–5), then load the approved Kit/Product/Price catalog (§catalog).
7. **Deploy** HairOS to Production; smoke-test `/login` → OTP → `/admin`, a report
   render + PDF, and a WhatsApp send in sandbox.
8. **Go-live** only when every §Preflight box is checked.

### §catalog
The approved Kit/Product/Price catalog is clinical data and is **not** templated
or invented here. Load it from the approved source (the `data/` catalog + the
`KitVersion`/`KitProduct`/`KitSchedule`/`Product`/`ProductPrice`/`KitPrice` graph)
via the repo's reviewed catalog seed or the Super Admin UI, after steps 1–6.

---

## §6 Preflight checklist (verify in dashboards before go-live)

**Supabase Auth (prod project)**
- [ ] Email OTP provider enabled and sending (login is OTP-only).
- [ ] Custom access token / JWT hook installed so `user_role` is injected (admin routing depends on it).
- [ ] `jwt_is_super_admin()` present (currently **missing** — B3).
- [ ] Site URL / redirect allowlist includes the production domain.

**Doctor mobile OTP**
- [ ] SMS provider configured (phone sign-in path `/api/auth/phone-otp-status` must report available).
- [ ] At least one doctor has a linked `supabasePhoneUserId` / phone identity, or the link route works end-to-end.

**Vercel environment variables (Production scope)** — confirm all point at the **production** project:
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `DATABASE_URL`, `DIRECT_URL` (same project as above — no split-brain)
- [ ] `NEXT_PUBLIC_APP_URL` = production URL
- [ ] `REPORT_SHARE_TOKEN_SECRET`, `REPORT_RENDER_WORKER_SECRET`, `CRON_SECRET` set
- [ ] `ALLOW_DEV_LOGIN` **unset** (and `DEV_LOGIN_SECRET` unset) in Production
- [ ] `VERCEL_AUTOMATION_BYPASS_SECRET` only where intended

**Report storage** (5 private buckets required by `scripts/provision-storage.ts`)
- [ ] `clinical-images`, `clinical-reports`, `doctor-avatars` present ✅ (verified)
- [ ] `one-pagers` present (currently **missing** — B5) and private.
- [ ] `report-assets` present (currently **missing** — B5) and private.

**Migrations** — see `docs/launch/MIGRATION_RECONCILIATION.md` for the full 38-migration matrix, the `phase3_admin`→`jwt_is_super_admin` ordering defect, and the fake-checksum `_prisma_migrations` self-inserts. Repo Prisma version: **5.22.0** (pin all commands to `npx --no-install prisma`).

**PDF generation**
- [ ] Serverless Chromium path works (`@sparticuz/chromium` + `playwright-core`); Node runtime, sufficient memory; a render produces a non-empty PDF.

**WhatsApp sharing**
- [ ] `WHATSAPP_PROVIDER`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_API_VERSION` set
- [ ] Approved templates exist: `WHATSAPP_TEMPLATE_REPORT`, `WHATSAPP_TEMPLATE_CART` (+ `WHATSAPP_TEMPLATE_LOCALE`)
- [ ] `WHATSAPP_WEBHOOK_VERIFY_TOKEN` / `WHATSAPP_WEBHOOK_SECRET` configured on the Meta webhook
- [ ] Keep `WHATSAPP_LIVE_SEND` / `WHATSAPP_AUTOMATION_ENABLED` off until a sandbox send is verified.

---

*Generated during production launch preparation. Read-only verification; all
mutations require explicit human approval.*

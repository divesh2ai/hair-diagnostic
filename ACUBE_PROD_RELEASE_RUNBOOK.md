# Acube — Production Release Runbook (hairos-ashen.vercel.app)

**Status: NO-GO.** Prepared for your explicit authorization. No production env/deploy/auth changes made by the agent. The only production DB changes already made (authorized): installed `custom_access_token_hook`, created Acube + Dr Avinash in `pykoyxbleowxwechotth`.

---

## P1 — HTTP 500 root cause (definitive, from Vercel runtime logs)

```
GET /api/clinics/acube-aesthetics  →  PrismaClientInitializationError
Error querying the database: FATAL: (ENOTFOUND) tenant/user postgres.gwkgopbscdftpitppgwe not found
```

- Production `DATABASE_URL` points at Supabase project **`gwkgopbscdftpitppgwe`** ("Dr Fact Project") which **no longer exists** (ENOTFOUND).
- The real production project is **`pykoyxbleowxwechotth`** (now provisioned with Acube/Avinash/hook).
- The deployed build is the **demo `b31c2e33`**, which predates the commit that corrected the project ref.
- **Correction:** repoint production env (`DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, keys) to `pykoyxbleowxwechotth` **and** deploy the approved build. Not fixable by DB writes.
- Note: agent cannot list/edit prod env (Vercel API returned **403 forbidden** for env listing) — these are console actions on your side.

---

## P2 — Production environment-variable checklist

Scope: `prod` = production runtime; `build` = needed at build time; `public` = `NEXT_PUBLIC_*` (exposed to browser). "Configured?" could **not** be verified by the agent (403 on env list) — verify each in Vercel → Project `hairos` → Settings → Environment Variables (Production). **Never print values.**

| Key | Purpose | Scope | Req | Safe validation (no value shown) |
|---|---|---|---|---|
| `DATABASE_URL` | Prisma runtime (pooled) → **must be `pykoyxbleowxwechotth`** | prod | ✅ | Host ends `…pykoyxbleowxwechotth.supabase.co` / pooler ref `postgres.pykoyxbleowxwechotth`; 500 log shows the wrong ref today |
| `DIRECT_URL` | Prisma migrations (direct 5432) → same project | build/prod | ✅ | Same ref as above; used by `prisma migrate deploy` |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser Supabase client | public | ✅ | `https://pykoyxbleowxwechotth.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser anon auth | public | ✅ | JWT `ref` claim = `pykoyxbleowxwechotth` (decode header only) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin (storage, raw SQL) | prod | ✅ | JWT `ref` = `pykoyxbleowxwechotth`; never log |
| `PRODUCTION_SUPABASE_REF` | DB-safety guard (`packages/shared/env/databaseTarget.ts`) | prod/build | ✅ | Must equal `pykoyxbleowxwechotth` (a prior commit fixed this from the dead `gwkgopbscdftpitppgwe`) |
| `REVIEW_TOKEN_SECRET` | Report/preview share-token HMAC | prod | ✅ | Set, ≥32 bytes; required in prod or the app throws |
| `CART_TOKEN_SECRET` | Patient cart link HMAC | prod | ✅ | Set, non-empty |
| `REPORT_SHARE_TOKEN_SECRET` | Report share link HMAC | prod | ✅ | Set, non-empty |
| `RENDER_TOKEN_SECRET` / `REPORT_RENDER_WORKER_SECRET` | PDF render worker auth | prod | ✅ (if PDF) | Set; match worker |
| `PAYMENT_WEBHOOK_SECRET` | Payment gateway webhook verify | prod | ⚪ (if payments) | Set |
| `CRON_SECRET` | Protects cron endpoints | prod | ✅ | Set |
| `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` (or `OPENAI_API_KEY`) | Orchestration/report narrative | prod | ✅ | Set; model reachable |
| `WHATSAPP_PROVIDER` / `WHATSAPP_ACCESS_TOKEN` (or `WHATSAPP_TOKEN`) / `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_API_VERSION` | WhatsApp report/cart sharing | prod | ✅ (gate) | Set; `WHATSAPP_AUTOMATION_ENABLED` + `WHATSAPP_LIVE_SEND` decide live sends |
| `WHATSAPP_TEMPLATE_REPORT` / `_CART` / `_LOCALE` / `WHATSAPP_WEBHOOK_VERIFY_TOKEN` / `WHATSAPP_WEBHOOK_SECRET` | WA templates + inbound verify | prod | ✅ (if WA) | Set; templates approved |
| `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` | Absolute links in reports/QR | public | ✅ | `https://hairos-ashen.vercel.app` (or final domain) |
| `FEATURE_DOCTOR_DASHBOARD` / `FEATURE_ADMIN_DASHBOARD` / `FEATURE_WHATSAPP` / `FEATURE_REVIEW_PATHWAY_SHADOW` | Feature gates | prod | ⚪ | As intended for launch |
| `DEFAULT_CLINIC_SLUG` | Fallback clinic | prod | ⚪ | **Leave UNSET** — no default-clinic fallback |
| **`ALLOW_DEV_LOGIN`** | Dev OTP bypass | prod | ✅ | **MUST be unset or `0`.** `/api/dev/login` must be unreachable in prod (guard also hard-blocks on prod runtime + prod DB) |
| `DEV_LOGIN_SECRET` / `DEV_LOGIN_ALLOWED_EMAILS` | Dev bypass creds | prod | ✅ | Unset in prod |

Supabase-Auth-side (NOT Vercel env — Supabase dashboard): **Twilio phone provider** (Account SID / Auth token or API key / Messaging Service SID), **phone confirmations enabled**, **Custom Access Token hook** registered → `public.custom_access_token_hook`. India: Twilio sender must be **TRAI-DLT-registered** (sender ID + OTP template).

---

## P3 — Database & OTP readiness (production `pykoyxbleowxwechotth`)

Already done (authorized, verified): Acube Aesthetics (slug `acube-aesthetics`, active) · Dr Avinash Agarwal (phone `+917506116161`, clinic=Acube, `READY_TO_INVITE`, primary) · `custom_access_token_hook` installed, `EXECUTE` granted to `supabase_auth_admin`, revoked from `anon/authenticated/public`. 1 clinic / 1 doctor — **no duplicates**.

**Register the hook (Supabase dashboard):** Authentication → Hooks → "Customize Access Token (JWT) Claims" → enable → `public.custom_access_token_hook`. Verify it runs by minting a token and checking `user_role`/`clinic_id` claims.

**Twilio / India SMS validation (no secrets printed):** Supabase → Auth → Providers → Phone = Twilio; send a test OTP to a +91 number; confirm delivery + DLT template compliance.

**Doctor.email nullable correction (PREPARED — DO NOT RUN until backup + approval):**
```sql
-- 1) BACKUP FIRST (Supabase PITR / snapshot).
-- 2) Make email nullable (brings prod in line with staging migration 20260901):
ALTER TABLE "Doctor" ALTER COLUMN "email" DROP NOT NULL;
-- 3) Remove the temporary placeholder on Dr Avinash:
UPDATE "Doctor" SET "email" = NULL
WHERE "email" = 'dr.avinash.acube+placeholder@hairos.invalid'
  AND "clinicId" = (SELECT id FROM "Clinic" WHERE slug='acube-aesthetics');
```
Prefer applying the real migration set via `prisma migrate deploy` with the production `DIRECT_URL` rather than a hand ALTER, so the migration ledger stays consistent. Deploying newer code does **NOT** auto-apply migrations — run `prisma migrate deploy` explicitly as a release step.

---

## P4 — Clinical sign-off

Draft PR (gated): **https://github.com/divesh2ai/hair-diagnostic/pull/27** (`claude/awesome-johnson-y7nwy2` → RC `claude/admiring-wright-v5lmck`). A GitHub review is **not** clinical approval. Do not merge without documented sign-off by a qualified clinical owner.

---

## P5 — Controlled release procedure

**Approved release commit = RC head AFTER clinical merge.** Today RC = `2b88e691` (security only). Approved release = that RC with PR #27 (`d16edef`) merged **after** clinical sign-off. Do **not** promote the demo `b31c2e33` or reuse staging/old-project creds.

Steps (your authorization required for each):
1. Clinical sign-off → merge PR #27 into RC → RC head = approved commit `X`.
2. Set production env per P2 (point at `pykoyxbleowxwechotth`; `ALLOW_DEV_LOGIN` off).
3. `prisma migrate deploy` against production `DIRECT_URL` (brings schema current incl. email-nullable). Verify `_prisma_migrations` advanced.
4. Apply the RLS/security layer if intended (`prisma/staging-security-repair.generated.sql`) — additive.
5. Build + deploy commit `X` to the `hairos` **production** target; alias `hairos-ashen` to it.
6. Register the Auth hook + confirm Twilio (P3).
7. Run P6 acceptance.

**Rollback:** Vercel → Deployments → the current production `dpl_FUhUJeSVB1…` (commit `b31c2e33`) is a rollback candidate → "Promote to Production" (or `vercel rollback`). DB: restore from the pre-release PITR snapshot taken in step P3. Env: revert changed keys. Because this is the first real provisioning, rollback = re-alias to the previous deployment + (if migrations ran) restore snapshot.

---

## P6 — Production acceptance gates (run only after deploy authorization)
1. Public `https://hairos-ashen.vercel.app/q/acube-aesthetics` loads the clinic (no 500).
2. Dr Avinash completes a real production OTP login.
3. One synthetic assessment submitted under Acube.
4. Claims `user_role=DOCTOR`, `clinic_id=`Acube; dashboard shows only Acube.
5. Clinical review + approval of that assessment.
6. PDF generation + protected storage + WhatsApp share.
7. Cross-clinic isolation + direct API authorization denials.
8. Declare GO only if all gates pass.

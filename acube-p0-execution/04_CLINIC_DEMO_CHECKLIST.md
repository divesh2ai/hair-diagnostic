# Acube Clinic Demonstration — Minimal Checklist (Synthetic Data) + Remaining Blockers

**Guardrails for the whole checklist:** synthetic patients only; staging Supabase
`vbkoupvduadmcxggtnsb` only (never production `gwkgopbscdftpitppgwe`); PR #24 stays unmerged;
production untouched. **Nothing below has been executed** — it is the procedure and the blocker list
for your authorisation.

## 1. Synthetic data that already exists (no PHI)

`scripts/seed-demo.ts` seeds a fully synthetic, idempotent cohort and is **hard-guarded**:
`assertSafeDatabaseTarget(...)`, refuses `VERCEL_ENV=production`, and requires `DEMO_SEED_ALLOW=1`.

- **10 synthetic patients** — e.g. "Aditi Sharma" / `+919821010001` … "Rahul Bhatt" / `+919821010010`
  (invented names, reserved `+9198210100xx` numbers).
- **Assessments across every dashboard state** — PENDING / QUEUED / REPORT_GENERATING / CLINICAL_READY /
  COMPLETED, with decisions PENDING / APPROVED / EDITS_REQUESTED, spanning the diagnoses a demo should
  show (Female & Male AGA, acute/postpartum/iron-deficiency TE, PCOS+Hypothyroid, Menopausal diffuse,
  Seborrheic dermatitis).
- Seeded into clinic `drfact-mumbai` with demo doctors `dr.rhea@drfact.demo` / `dr.arjun@drfact.demo`
  (`.demo` addresses, not real).

Run (staging only):
```
DEMO_SEED_ALLOW=1 npx tsx scripts/seed-demo.ts
npx tsx scripts/inspect-demo-seed.ts        # verify what landed
```

> ⚠️ The seed targets the `drfact-mumbai` demo clinic, **not** an Acube clinic / Dr Avinash. For an
> Acube-branded demo, decide one of: (a) demo on the existing `drfact-mumbai` synthetic clinic, or
> (b) provision a synthetic **Acube** clinic + synthetic doctor and extend the seed's clinic slug.
> Recommend (a) for the first demo — it needs no new provisioning. Flag your choice.

## 2. Minimal demo checklist (once staging is configured)

- [ ] Staging Supabase migrations applied; `custom_access_token_hook` registered (Auth → Hooks).
- [ ] Storage buckets provisioned: `npx tsx scripts/provision-storage.ts`.
- [ ] Demo cohort seeded + inspected (§1).
- [ ] A synthetic demo doctor can log in (email magic-link **or** phone OTP if an SMS provider is set).
- [ ] Walk the flow on the Preview URL: **patient assessment → doctor queue → open patient → review →
      deterministic kit recommendation → approve → PDF one-pager generated → (WhatsApp sandbox send)**.
- [ ] Confirm report PDF + one-pager are saved under the patient name in storage (PR #20 behaviour).
- [ ] Confirm doctor-order pricing flows through the cart authority — **no ₹5,500 fallback** (PR #19).
- [ ] **Clinical caveat to disclose during the demo:** a PCOS / thyroid / iron / alopecia-areata patient
      currently yields **no PRIMARY root cause** (doc 01). Either demo the AGA/TE cases (which elect a
      primary correctly) or hold the demo of endocrine/nutritional/autoimmune cases until the engine
      corrections are signed off.

## 3. Remaining blockers — exact dashboard actions

### Vercel (project `hairos`, team `diveshs-projects-6230f270`, root dir `apps/patient-portal`)

1. **Set Preview environment variables.** Dashboard → Project **hairos** → **Settings → Environment
   Variables** → scope **Preview** (and the branch, if using a Preview-branch scope). Add the 11 keys
   from `.env.staging.example` with **staging** values:
   `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`, `PORT`,
   `REVIEW_TOKEN_SECRET`, `ALLOW_DEV_LOGIN`, `DEV_LOGIN_SECRET`.
   - All Supabase values must be the **staging** project `vbkoupvduadmcxggtnsb` — not production.
   - `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` = the Preview URL.
2. **Deployment protection.** Settings → **Deployment Protection**. The Preview is currently protected
   (login wall). For the demo either (a) keep protection and share access with the demo audience, or
   (b) generate a **Protection Bypass for Automation** token for scripted E2E. Decide which.
3. **Redeploy** the PR #24 Preview after the env vars are set so they take effect (Deployments → latest
   Preview → Redeploy). Do **not** promote to Production.

### Supabase (staging project `vbkoupvduadmcxggtnsb`)

1. **Apply migrations** to staging (CI/`prisma migrate deploy`, or the SQL editor) so the schema matches
   `prisma/schema.prisma`, including the doctor phone-identity migrations.
2. **Register the access-token hook.** Dashboard → **Authentication → Hooks** → Custom Access Token →
   point at `public.custom_access_token_hook` (the canonical body is
   `supabase/functions/custom_access_token_hook.sql`). Without it, JWTs carry no `user_role`.
3. **Enable a phone/SMS provider** (only if demoing phone OTP). Dashboard → **Authentication → Providers
   → Phone** → configure the SMS gateway (e.g. Twilio/MSG91) with staging credentials. Store secrets via
   Supabase, never in the repo. *(Email magic-link needs no SMS provider — simplest first demo.)*
4. **Service-role key** → copy from **Project Settings → API** into the Vercel `SUPABASE_SERVICE_ROLE_KEY`
   Preview var (server-side only; never a `NEXT_PUBLIC_` var).
5. **Storage buckets** → run `scripts/provision-storage.ts`, or create the report/one-pager buckets in
   **Storage** to match what the pipeline expects.
6. **Dr Avinash** → leave at `CONTACT_REQUIRED` until you provide the verified number; then follow doc 02
   on **staging**. (A synthetic demo doctor can be used for the demo without touching Dr Avinash.)

### Still gated on you (not a dashboard action)

- **The 10 clinical-engine failures** (doc 01) — the production gate; needs your scenario sign-off.
- **Verified mobile number** for Dr Avinash — needed before OTP activation (doc 02).
- **Acube vs drfact-mumbai demo clinic** decision (§1).
- **Production** rollout — explicitly out of scope until you authorise; PR #24 stays unmerged.

## 4. What I can do without further credentials/authorisation

- Re-run and report the full non-DB test suite (done — doc 03).
- Model additional clinical corrections for your review (doc 01 §5), without applying them.
- Draft the Acube-clinic seed extension (synthetic) for your approval, if you choose option (b) in §1.

I have **not** changed any Vercel/Supabase setting, seeded any database, merged PR #24, or touched production.

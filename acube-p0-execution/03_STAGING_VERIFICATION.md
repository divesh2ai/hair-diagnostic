# Staging Verification — PR #24 (status + what ran + what is blocked)

**Scope honoured:** no production credentials used, no production patient data touched, PR #24 left
unmerged and draft. Only tests that do **not** require the live Vercel Preview were run.

## 1. PR #24 state (unchanged)

- `#24` — *"Acube P0 integration: verified missing corrections (#18, #19, #20, #21) onto candidate 8efd636"*
- head `claude/admiring-wright-v5lmck` → base `claude/gallant-darwin-cdltmd`; **draft**, `mergeable_state: clean`.
- 27 files, +1145 / −198. Vercel Preview deployed (bot comment): project `hairos`, root
  `apps/patient-portal`, preview `hairos-git-claude-admiring-wri-cd3a03-…vercel.app` — **behind Vercel
  protection; not exercised here.**
- **NO-GO for production stands**, per the PR's own GO/NO-GO: blocked by the deterministic-engine failures
  (see doc 01) and pending staging E2E.

## 2. Tests run in this sandbox (full `vitest run`, deps installed, Prisma client generated)

```
Test Files  68 failed | 133 passed (201)
Tests       15 failed | 2517 passed | 117 skipped (2649)
```

This matches PR #24's reported baseline (`2515 passed / 17 failed / 117 skipped`) within 2 tests — the
small delta is DB-backed tests that need a live Postgres this sandbox lacks.

**Read the two failure counts separately:**

- **15 failed *tests*** = real assertion failures. Breakdown:
  - **10 = clinical-engine family** (6 `cause-registry` + 4 `hair-evaluation-expanded` GAP) — the
    approved-engine calibration gap analysed in doc 01. **These are the production blocker.**
  - **5 = pre-existing, non-clinical**, all present on baseline `8efd636` (not introduced by #24):
    - `narrative-engine/doctorReport` — *"Follow-up priority higher for severe than mild"*
    - `narrative-engine/narrativePipeline` — *"Severe cases have longer recovery windows than mild"*
      (both are downstream of the engine not electing a PRIMARY/severity → same family, cosmetic ranking)
    - `tests/assistant/import-idempotency` — *"second complete import creates no duplicate governed records"*
    - `tests/post-approval/route-access-contracts` — cart token / doctor-session contract
    - `tests/skin/skin-questionnaire` — acne protocol persist/rehydrate
- **68 failed *files*** = overwhelmingly **collection/import errors**, not assertion failures — integration
  and API suites (`tests/api/**`, `tests/assessment-orchestrator/**`, admin suites) that require a live
  database / full Next.js server env. They cannot run in a credential-less sandbox and are **not evidence
  of regressions**. They must be run in the DB-backed staging/local stack.

**Green, clinically-relevant suites that DID run and pass** include: questionnaire exclusivity/flow
(`dietSingleChoice`, `hormonalFlow`, `hormonalRequired`, `miscarriageKits`), vertical separation /
skin-FACT isolation, order pricing, patient-report naming, narrative pipeline backward-compat — i.e. the
four integrated corrections (#18/#19/#20/#21) verify clean here, consistent with the PR.

## 3. The Acube assessment-to-report E2E — prerequisites (NOT executed; needs staging configured)

The live workflow (QR → assessment → Dr Avinash queue → review → deterministic kit recs → approval →
PDF → WhatsApp sandbox) **cannot run until staging is wired**, which requires dashboard actions outside
this session's safe scope (see doc 04 for exact steps). Blockers, specifically:

1. **Vercel Preview env vars** must be set for the `hairos` project (staging values only) — the keys in
   `.env.staging.example`: `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`,
   `NEXT_PUBLIC_SITE_URL`, `PORT`, `REVIEW_TOKEN_SECRET`, `ALLOW_DEV_LOGIN`, `DEV_LOGIN_SECRET`,
   all pointing at the **staging** Supabase project `vbkoupvduadmcxggtnsb` (never production `gwkgopbscdftpitppgwe`).
2. **Supabase staging** must have: migrations applied, `custom_access_token_hook` registered, storage
   buckets provisioned (`scripts/provision-storage.ts`), and a phone/SMS provider for OTP.
3. **Dr Avinash** must be activated on staging per doc 02 (still `CONTACT_REQUIRED` today).
4. **WhatsApp** in sandbox mode only.
5. **The 10 clinical-engine failures are a hard gate** — an E2E that routes a PCOS/thyroid/iron/AA
   patient will currently produce a report with **no PRIMARY root cause**, so the report content is not
   yet clinically valid to demonstrate. Resolve doc 01 (with your sign-off) before the E2E is meaningful.

Once (1)–(4) are configured and (5) is signed off, the E2E can be executed against staging. I have not
configured any of these — they need your authorisation and credentials via the dashboards in doc 04.

## 4. How to reproduce the sandbox test run

```
# in a checkout of claude/admiring-wright-v5lmck (PR #24 head)
npm install --ignore-scripts && npx prisma generate
npx vitest run                              # full suite
npx vitest run tests/ai-engine/cause-registry.test.ts \
               tests/assistant/hair-evaluation-expanded.test.ts   # the clinical family
```

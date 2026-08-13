# Staging environment plan

**Status (2026-08-12):** staging project **created**; environment separation
**blocked on two secrets**; migrations **not applied anywhere**.

| Phase | State |
|---|---|
| 1. Create staging project | ✅ `hairos-staging` / `vbkoupvduadmcxggtnsb` / ap-south-1 |
| 2. Separate environment variables | ⛔ needs staging DB password + `service_role` key |
| 3. Remove local → production coupling | ✅ guard shipped and failing closed |
| 4. Apply migrations to staging | ⛔ blocked by Phase 2 |
| 5–8. Seed, E2E, shared device, concurrency | ⛔ blocked by Phase 4 |

Production (`gwkgopbscdftpitppgwe`) has **not** been touched: no migration, no
schema change, no Vercel setting.

## The blocker, precisely

`create_project` generates the database password server-side and never returns
it, and the `service_role` key is not exposed through the management API either.
Both must be read from the Supabase dashboard by a human — and both are
credentials that should not travel through a chat transcript in any case.

Fill them into `.env.staging.example` (which already carries every non-secret
value) and Phases 4–8 can run end to end.

**Goal**

```
Vercel Preview      →  Staging Supabase   (synthetic data, migrations land here first)
Vercel Production   →  Production Supabase (real patients, untouched by this plan)
```

Today both environments read the same Supabase project, which is why there is
nowhere safe to apply the D1 / D2 / S2 migrations and walk an end-to-end intake.

---

## 1. Why a Supabase *branch* is not the answer here

Supabase preview branches are the obvious first thought and they are the wrong
tool for this particular need:

- A branch is created per git branch and torn down with it. Staging has to
  outlive a branch — it is where a QA walk-through, a clinic demo and a
  dermatologist review happen over days.
- Branches seed from the production schema. That is fine, but the seeding path
  has historically been the easiest way for production data to end up somewhere
  it should not be, and patient records are exactly what must never leave the
  production project.
- Branches are billed per running branch and need the Pro plan on the
  organisation.

A **second, permanent Supabase project** (`hairos-staging`) is the durable shape.
Branches remain useful later for throwaway schema experiments.

---

## 2. Variables that must differ between Preview and Production

Set these in Vercel under **Project → Settings → Environment Variables**, scoped
to the **Preview** environment only. Production keeps its current values.

| Variable | Production | Preview / staging | Notes |
|---|---|---|---|
| `DATABASE_URL` | prod pooled (`…pooler.supabase.com:6543`) | staging pooled | Runtime queries. Keep `?pgbouncer=true&connection_limit=1` as production has it. |
| `DIRECT_URL` | prod direct (`…supabase.co:5432`) | staging direct | Migrations only. Prisma requires it separately from the pooled URL. |
| `NEXT_PUBLIC_SUPABASE_URL` | prod project URL | staging project URL | **Public.** Baked into the client bundle — a preview build carrying the production URL is a real leak, not a config smell. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod anon key | staging anon key | Public, but it must match the URL above or auth silently fails. |
| `SUPABASE_SERVICE_ROLE_KEY` | prod service key | staging service key | Bypasses RLS. Never in a `NEXT_PUBLIC_*` name, never in the repo. |
| `NEXT_PUBLIC_APP_URL` | production domain | preview deployment URL | Used for invitation links. A staging invite pointing at production would walk a tester into real data. |
| `NEXT_PUBLIC_SITE_URL` | production domain | preview deployment URL | Same reasoning (`lib/invitations.ts`). |
| `REVIEW_TOKEN_SECRET` | prod secret | **different** staging secret | Signs review tokens *and* the D1 intake session token. Sharing it would let a staging-issued token authenticate against production. |
| `DEV_LOGIN_SECRET` / `NEXT_PUBLIC_DEV_LOGIN_SECRET` | unset | staging-only value | Dev login already refuses to run when `VERCEL_ENV === "production"` (`api/dev/login/route.ts`), so this is safe to enable on Preview and is what makes a staging walk-through possible without real accounts. |
| `ALLOW_DEV_LOGIN` / `NEXT_PUBLIC_ALLOW_DEV_LOGIN` | unset | `1` | Same. |

### Audit: what can actually reach a real person

Read from the code, not assumed. Every outbound path in the app:

| Path | Reaches a real person? | Behaviour with the variable unset |
|---|---|---|
| **WhatsApp** — `lib/notifications/index.ts` → `graph.facebook.com/.../messages` | **Yes.** The only live channel. | `if (!phoneNumberId \|\| !accessToken)` → logs, returns `provider_not_configured`, **no network call**. Fails closed. |
| **Email** — same module | No. Stub. | Logs `provider not configured`, returns soft failure. No provider wired. |
| **SMS / OTP** — same module | No. Stub. | Same. There is no SMS or OTP provider in the codebase at all. |
| **In-app notifications** | No. Stub. | Same; persistence not wired. |
| **Supabase Auth emails** | **Potentially.** Magic links / confirmations are sent by Supabase itself, not by this code. | Governed by the staging project's own SMTP settings. On the free plan the default sender only delivers to org members, but use synthetic addresses regardless. |
| **Storage** — buckets `clinical-images`, `doctor-avatars` | Follows `NEXT_PUBLIC_SUPABASE_URL`. | Isolated automatically once the URL points at staging — which is exactly why a split configuration is a blocking error in the guard. |
| **Invitation links** — `lib/invitations.ts` | Indirectly: the URL a person is sent. | Built from `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL`. If staging inherited the production domain, a staging invite would walk a tester into production. |
| **LLM / reranker** — `LLM_*`, `OPENAI_API_KEY`, `ASSISTANT_RERANK_*` | No. External, but not a person. | Costs money; keep identical to production so staging exercises the real engine. |
| **Webhooks / external report delivery** | **None found.** No outbound webhook, callback URL or report-delivery integration exists in the app today. | — |

The single control that matters: **leave `WHATSAPP_ACCESS_TOKEN` and
`WHATSAPP_PHONE_NUMBER_ID` unset on Preview and in staging.** That is not a
convention — the code branches on their presence and makes no network call
without them.

**Deliberately identical in both:** `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`,
`OPENAI_API_KEY`, `ASSISTANT_RERANK_*`, `RAG_DOCS_PATH`, `HAIROS_FIXTURES_DIR`.
These are model/knowledge configuration; staging must exercise the same clinical
engine as production or the walk-through proves nothing. Budget them
accordingly — staging runs cost real inference money.

**Decide explicitly, do not inherit:** `WHATSAPP_ACCESS_TOKEN`,
`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION`. Staging must NOT be able to
send a WhatsApp message to a real number. Either point these at a Meta test
number or leave them unset on Preview so the notification path no-ops.
Copying the production token into staging is the single most likely way this
plan messages an actual patient.

`CONFERENCE_MODE` stays unset in both unless a demo needs it.

---

## 3. Staging Supabase project setup

1. Create project `hairos-staging` in the same organisation
   (`sdbphxayzdljxtwpqrux`) and the same region as production — which today is
   **`ap-southeast-1`**, on Postgres 17, project `gwkgopbscdftpitppgwe`
   ("Dr Fact Project"). Matching the region keeps latency behaviour comparable;
   matching the Postgres major version matters because the S2 migration relies
   on a partial unique index.
2. Apply the schema from migrations, not from a production dump:
   ```bash
   DIRECT_URL="<staging direct url>" npx prisma migrate deploy
   ```
   This is also the first honest test of the D1 / D2 / S2 migrations — they run
   against an empty database in the order they will run in production.
3. Apply the JWT custom claims hook (`supabase/functions/custom_access_token_hook.sql`)
   and enable it under Auth → Hooks. Without it every staging login lands with
   no `clinic_id` and every scoped API returns 403.
4. Create the storage buckets the app writes to: `clinical-images` and
   `doctor-avatars`, with the same policies as production.
5. Seed synthetic data only — see below.

---

## 4. Data: synthetic only

**No production dump. No anonymised production dump.** Anonymisation of Indian
patient records with names, mobile numbers and free-text clinical answers is not
reliably reversible-proof, and the whole point of D1 is that the mobile number
*is* the identity key.

Existing seeds cover this:

```bash
npm run seed:demo          # clinic + doctor + demo patients
npm run seed:demo:inspect  # verify what landed
```

For a D1/D2 walk-through the staging seed additionally needs:

- one patient with a known mobile → exercises **RETURNING** and the visit-intent
  screen;
- **two** patients sharing one mobile → exercises **IDENTITY_AMBIGUOUS**, the
  quarantine, and `identityResolutionStatus = 'AMBIGUOUS'`;
- a clinic with **zero** `ClinicLocation` rows → exercises `locationSetup: NONE`;
- a clinic with two branches → exercises the primary-branch promotion path and
  the new partial unique index.

Use obviously fake numbers in the `+91 99999 0xxxx` range. They normalise
correctly (leading 9 is a valid TRAI mobile series) without being anyone's real
line.

---

## 5. Sequence

1. Create the staging Supabase project. **Requires explicit authorisation** —
   it adds cost and is not something to do silently.
2. Add the Preview-scoped variables above in Vercel.
3. `prisma migrate deploy` against staging `DIRECT_URL`.
4. Seed synthetic data.
5. Push the branch; Vercel builds a Preview against staging.
6. Walk D1 + D2 end to end: new patient, returning patient, ambiguous identity,
   and a clinic-location promotion race.
7. Only then promote the migrations to production, in the same order, with a
   `pg_dump` taken first.

---

## 6. Open items

- **Vercel plan.** Preview environment variables scoped separately from
  Production are available on Pro. Confirm the current plan before step 2.
- **Preview deployment protection.** Staging will hold synthetic PHI-shaped
  data. Keep Vercel's deployment protection on so preview URLs are not public.
- **Rate limiting.** `lib/rate-limit.ts` is an in-process Map. It behaves
  differently on a preview deployment (fewer, colder instances) than in
  production, so staging cannot validate abuse protection. See the note in that
  file — this is a known gap, not something staging will surface.

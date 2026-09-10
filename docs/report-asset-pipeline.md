# Report asset pipeline — one-pager rendering and delivery

How an approved consultation becomes a PNG the patient receives, what happens
when that fails, and what an operator has to do to switch it on.

## The shape of it

```
Doctor approves
      │
      ├─ ConsultationVersion → APPROVED            (immutable, already existed)
      ├─ one-pagers/{assessmentId}/v{n}.json       (immutable snapshot, already existed)
      └─ ReportAsset row → PENDING                 ← the enqueue IS this row
                │
                ├─ doorbell: POST /api/internal/report-assets/render   (latency)
                └─ sweep:    GET  /api/internal/report-assets/render   (durability, cron */5)
                                    │
                                    ▼
                          claim under a lease
                          re-authorise the source
                          mint a 3-minute render token
                          Chromium → /internal/render/one-pager/<token>
                          validate the PNG
                          store privately
                                    │
                          ┌─────────┴─────────┐
                       READY                FAILED
                          │                    │
        Share attaches the stored asset   Share sends the report LINK
        onePagerAttached: true            onePagerAttached: false
```

A rendering failure is never a clinical-report failure. The approval stands,
the snapshot stands, the patient still receives their report link, and the
doctor is told which of "still being prepared" and "could not be produced" they
are looking at.

## Switching it on

Three steps, in this order. Each is independently safe; the feature is simply
inert until all three are done.

### 1. Apply the migration

```
prisma/migrations/20260907_report_asset_pipeline
```

Additive only — `CREATE TABLE`, `CREATE TYPE`, `ADD COLUMN IF NOT EXISTS`, no
foreign keys, no drops, no backfill. Before it runs, every reader answers "not
provisioned" and report links still send.

### 2. Provision the buckets

```bash
npx tsx scripts/provision-storage.ts --dry-run
npx tsx scripts/provision-storage.ts
```

Adds two private buckets to the existing three:

| Bucket | Holds | Cap |
|---|---|---|
| `one-pagers` | the immutable JSON snapshot written at approval | 2 MB |
| `report-assets` | the rendered PNG a patient receives | 5 MB |

Both are PRIVATE. Objects are handed out only as signed URLs, and only ever for
ten minutes.

### 3. Set the environment

| Variable | Required | What it is |
|---|---|---|
| `RENDER_ORIGIN` | recommended | The origin the render worker points a browser at. Falls back to `NEXT_PUBLIC_APP_URL`, then `VERCEL_PROJECT_PRODUCTION_URL`, then `VERCEL_URL`. Set it explicitly in production: the platform value is the immutable per-deployment hostname, not the domain the clinic uses. |
| `REPORT_RENDER_WORKER_SECRET` | yes | Authorises the doorbell. Without it the doorbell is skipped and the sweep alone drives the queue — slower, not broken. |
| `CRON_SECRET` | yes | Authorises the scheduled sweep. Vercel sends it as `Authorization: Bearer …`. **Without this the sweep cannot run and nothing renders.** |
| `RENDER_TOKEN_SECRET` | recommended | Signs render tokens. Falls back through `REPORT_SHARE_TOKEN_SECRET` → `CART_TOKEN_SECRET` → `REVIEW_TOKEN_SECRET`. Setting it separately means the render surface can be rotated without invalidating patients' report links. |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | previews only | Lets the headless browser past Deployment Protection. Not needed on production domains. |
| `WHATSAPP_ATTACH_ONE_PAGER=0` | optional | Turns the attachment off without a deploy. The link still sends. |
| `RENDER_BROWSER_EXECUTABLE` / `RENDER_BROWSER_CHANNEL` | local only | Point the launcher at a specific local Chrome/Edge. |

The cron entry lives in `apps/patient-portal/vercel.json`. On a Hobby plan
Vercel will run it daily rather than every five minutes, which is not enough
for the retry schedule — this needs a plan with minute-level crons.

## Versioning

Two independent stamps, both part of the render key:

- `ONE_PAGER_TEMPLATE_VERSION` — the sheet's DESIGN. Bump it when a change
  alters what the one-pager says or how a clinician reads it.
- `ONE_PAGER_RENDERER_VERSION` — the rendering STACK.

Bumping either produces a new render key, therefore a new `ReportAsset` row and
a new storage object. **Historical artefacts are never re-rendered in place.** A
React component changing tomorrow cannot alter what a patient was handed last
month, and a delivery record copies the artefact's `sha256` so it keeps meaning
what it meant.

## Failure codes

| Code | Retried? | What it means |
|---|---|---|
| `BROWSER_LAUNCH_FAILED` | yes | No Chromium, or it would not start. |
| `RENDER_TIMEOUT` | yes | The page did not reach its readiness marker in time. |
| `REPORT_NOT_READY` | yes | The clinical narrative has not been composed yet. Resolves on its own. |
| `STORAGE_FAILED` | yes | The bucket was unreachable, missing, or refused the object. |
| `OUTPUT_INVALID` | yes | The capture was not a plausible PNG — blank, truncated, or a collapsed viewport. |
| `SOURCE_NOT_APPROVED` | **no** | The version is not APPROVED. No amount of waiting changes that. |
| `SNAPSHOT_INVALID` | **no** | The preserved sheet is absent or malformed. A retry reads the same broken input. |
| `AUTH_FAILED` | **no** | An authorisation invariant was violated. Retrying a refused access is not a recovery strategy. |
| `UNKNOWN_RENDER_ERROR` | yes | Unclassified. Look at `lastError`. |

Retry schedule: immediately, +15s, +60s, +5m, then FAILED. Four attempts across
about six minutes. `lastError` is redacted before it is stored — credential-
shaped strings and JWTs are stripped, and the message is capped at 500
characters.

## Operating it

`GET /api/admin/report-assets` (Super Admin) returns queue depth, success rate,
median and p95 render time, oldest pending, failure codes, and the alerts those
add up to. It contains no patient identifiers and no report content.

Alerts it raises:

| Alert | Threshold | What it means |
|---|---|---|
| `NOT_PROVISIONED` | table absent | Step 1 has not been done here. |
| `STORAGE_UNCONFIGURED` | no service key | Every render will fail. |
| `QUEUE_STALLED` | oldest pending > 15 min | Nothing is draining the queue — usually a missing `CRON_SECRET` or a cron that is not firing. |
| `RENDER_STUCK` | claimed > 10 min | Workers are dying mid-render. Leases expire after two minutes, so these rows do recover; the alert says the worker is unhealthy. |
| `FAILURE_RATE_HIGH` | < 80% over ≥ 5 attempts | Renders are failing for a common reason. Read `failureCodes`. |

### Recovering a FAILED artefact

`POST /api/consultation/<assessmentId>/one-pager` — a doctor or admin in that
clinic resets the retry budget and re-rings the doorbell. Deliberately manual:
an automatic retry that never stops hides the failure code behind a busy-looking
attempt count. It refuses to touch a READY artefact, because that artefact may
already have been delivered.

`GET` on the same path reports the artefact's state without exposing its bytes
or its storage path.

## Security notes

- The render target (`/internal/render/one-pager/<token>`) is addressed BY its
  credential. There is no assessment id, version or clinic anywhere in the
  request, so no caller can name a record to open. Every refusal is a 404.
- Render tokens live three minutes, name one artefact, and are domain-separated
  from cart, review and patient-report tokens — none validates in another's
  verifier.
- The renderer only ever visits an origin the server derived for itself, over
  https (or localhost in development). It accepts no URL and no headers from any
  caller, so it cannot be used as a request-forgery primitive.
- No session cookie travels into a render any more. The old implementation
  forwarded the doctor's live credential into the browser; nothing on the share
  or render path holds one now.
- Signed URLs are capped at ten minutes, in code, regardless of what a caller
  asks for.
- `ALLOW_DEV_LOGIN` is not used by any of this and must remain unset in any
  retained Preview or Production deployment.

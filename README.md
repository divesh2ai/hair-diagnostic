# HairOS Super Admin — Clinic Usage & Adoption Monitor

A single operational dashboard at **`/admin`** that lets a platform Super Admin
immediately see **which doctors have logged in, which clinics are receiving
patient assessments, which doctors are actually reviewing patients, and where
the workflow is blocked** — cleanly separating *database activation* from real
*doctor adoption*.

Built on the live `drfact-hairos-production` schema (Prisma/Postgres on
Supabase). This is a **read-only** implementation: it runs no migrations and
modifies no clinical records.

## Routes

| Route | Purpose |
| --- | --- |
| `/admin` | Primary monitor: KPI band, activation→adoption funnel, output/delivery, filters, per-clinic cards with actionable issues |
| `/admin/clinic/[slug]` | Per-clinic drilldown: identity & authentication, actionable issues, per-patient workflow table |

## Filters (requirement 3)

`Never logged in` · `Logged in / no reviews` · `Using HairOS` · `Pending reviews` · `Report issues`

## How data is resolved

- **Live path** (`lib/data.ts` → `loadLive`): server-side service-role client
  (`lib/supabase.ts`) aggregates `Clinic`, `Doctor`, `Assessment`,
  `KitOrderIntent`, `ReportAsset`, `WhatsappDelivery`, `Consultation*`, and
  resolves sign-ins/providers from `auth.users`. All logic server-side only.
- **Snapshot path** (`loadSnapshot`): a committed read-only extract
  (`lib/data/production-snapshot.json`) used for verification and offline
  rendering. Both paths share the exact same domain logic in `lib/metrics.ts`,
  so definitions never drift.

Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (see `.env.example`) to go live.

## Key definitions (requirement 6 — no invented usage)

- **Approved** = doctor review decision `APPROVED`, *not* automated processing
  reaching `COMPLETED`.
- **Doctor adoption** = a recorded sign-in **and** a real review action. A QR
  scan or completed processing is never counted as doctor usage.
- **Database activation** is tracked independently from doctor adoption.

## Authorization (requirement 5)

`lib/auth.ts#requireSuperAdmin` resolves the caller from the Supabase session
cookie and requires an owner/super-admin `OrganizationMember` role. Clinic rows
are only ever reachable by a platform Super Admin; patient names are masked to
initials.

## Run locally

```bash
npm install
npm run build && npm run start   # http://localhost:3000/admin
```

Regenerate screenshots (requires the server running on port 3100):

```bash
node scripts/screenshot.js docs/screenshots
```

See **[docs/ACCEPTANCE_REPORT.md](docs/ACCEPTANCE_REPORT.md)** for the verified
metrics and instrumentation gaps.

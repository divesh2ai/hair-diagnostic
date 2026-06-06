# HairOS — Production Architecture

**Status:** Working document  
**Stack:** Next.js App Router · Prisma · Supabase Postgres · Supabase Auth  
**Date:** 2026-05-27

---

## A. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        TENANT HIERARCHY                         │
│                                                                 │
│   Organization (DrFACT franchise / healthcare group)            │
│       └── Clinic (city/location unit — the billing tenant)      │
│               ├── Doctor    (clinician, Supabase auth user)     │
│               ├── Staff     (support role — future)             │
│               └── Patient   (end user, optional auth)           │
│                       └── Assessment (one per hair analysis)    │
│                               ├── AssessmentResponse (answers)  │
│                               ├── AIArtifact (engine outputs)   │
│                               ├── OrchestrationLog (pipeline)   │
│                               └── WhatsappDelivery              │
└─────────────────────────────────────────────────────────────────┘
```

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| Clinic is the billing unit | Clinics sign contracts; Org is just a grouping |
| Organization.organizationId is nullable on Clinic | Allows single-clinic deployments without Org overhead |
| Doctor.doctorId is optional on Patient | Patients may self-submit before doctor assignment |
| Supabase Auth = source of truth for identity | Do not duplicate password/session logic |
| API-level RBAC first, RLS later | Simpler to ship, easier to debug, RLS can layer on top |
| Single SystemRole enum | AdminRole + UserRole split caused type confusion at API boundaries |
| Soft deletion on Clinic, Doctor, Patient, Assessment | Compliance — healthcare data cannot be hard deleted |

---

## B. Environment Setup

### `.env` (production)

```bash
# Supabase connection pooler — use for ALL runtime queries
# Port 6543 = Transaction mode (pgBouncer) — required for serverless
DATABASE_URL="postgresql://postgres.gwkgopbscdftpitppgwe:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

# Direct connection — use ONLY for Prisma migrations (prisma migrate deploy)
# Port 5432 = Direct PostgreSQL — required because pgBouncer breaks DDL
DIRECT_URL="postgresql://postgres.gwkgopbscdftpitppgwe:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

# Supabase project
NEXT_PUBLIC_SUPABASE_URL="https://gwkgopbscdftpitppgwe.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."  # server-side only — never expose to client
```

### Why two database URLs?

- `DATABASE_URL` → pgBouncer Transaction Mode → handles thousands of concurrent serverless connections without exhausting Postgres connections
- `DIRECT_URL` → bypasses pgBouncer → required because `ALTER TYPE`, `CREATE TABLE`, and advisory locks used by Prisma Migrate do not work over pgBouncer

---

## C. Migration Plan

### Diagnosis

Your Supabase database currently has:
- `WhatsappSession` (from migration 0001)
- `OrchestrationLog`, `AnalyticsEvent`, `WhatsappDelivery` + Assessment column additions (from 20260521)
- Legacy tables: `User`, `Session`, `Message`, `Diagnosis`, `Recommendation` (from original app — likely applied manually)

**Missing from Supabase** (exist in schema.prisma only):
- `Organization`, `OrganizationMember`
- `Clinic`, `Doctor`, `Patient`, `PatientIdentifier`
- `Assessment`, `AssessmentResponse`, `AIArtifact`
- `UserProfile`, `Admin`, `AuditLog`

### Migration Execution Sequence

#### Step 0 — Baseline existing state (run once, right now)

```bash
# Pull actual Supabase schema into a baseline migration
# This tells Prisma "everything currently in DB is already applied"
npx prisma migrate diff \
  --from-empty \
  --to-url $DIRECT_URL \
  --script > prisma/migrations/00_baseline/migration.sql

# Mark baseline as applied without running it
npx prisma migrate resolve --applied 00_baseline
```

#### Step 1 — Verify schema is in sync

```bash
# This will show what Prisma wants to create vs what exists
npx prisma migrate diff \
  --from-url $DIRECT_URL \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

Review the diff output. You should see CREATE TABLE statements for all the missing models.

#### Step 2 — Create the migration

```bash
# Generates SQL migration file from schema diff
npx prisma migrate dev --name hairos_core_tables --create-only
```

Review the generated SQL in `prisma/migrations/[timestamp]_hairos_core_tables/migration.sql` before applying.

#### Step 3 — Apply to Supabase

```bash
# Apply to production Supabase (uses DIRECT_URL)
npx prisma migrate deploy
```

#### Step 4 — Regenerate Prisma client

```bash
npx prisma generate
```

#### Step 5 — Verify

```bash
npx prisma db pull --print  # Should show no drift
```

### Backward-Compatibility Notes

- `Assessment.doctorId` (removed) → replaced by `Assessment.reviewingDoctorId` (nullable). If you have existing Assessment rows with `doctorId`, the migration must backfill `reviewingDoctorId` from the old column before dropping it.
- `UserProfile` + `Admin` models (removed from schema) → If rows exist in Supabase, you need to decide whether to migrate them to `OrganizationMember` or keep them. Add them back to schema if they have data.
- `Patient.doctorId` changed from required → optional. This is a backward-compatible migration (just drops the NOT NULL constraint).

---

## D. API Structure

```
apps/
├── patient-portal/                    # Next.js — patient-facing
│   └── src/
│       ├── app/
│       │   ├── questionnaire/         # Submit flow
│       │   ├── status/[id]/           # "Your analysis is ready" only
│       │   └── api/
│       │       ├── assessment/
│       │       │   ├── submit/route.ts       # POST — create Assessment + kick pipeline
│       │       │   └── status/[id]/route.ts  # GET — status only (no clinical data)
│       │       └── auth/callback/route.ts
│       └── middleware.ts              # Validate patient JWT or clinic QR token
│
├── doctor-portal/                     # Next.js — doctor/admin-facing
│   └── src/
│       ├── app/
│       │   ├── dashboard/             # Doctor's assessment queue
│       │   ├── assessment/[id]/       # Full clinical report view
│       │   ├── patients/              # Patient list
│       │   └── api/
│       │       ├── assessment/
│       │       │   ├── [id]/route.ts         # GET full report (RBAC gated)
│       │       │   └── [id]/review/route.ts  # POST doctor sign-off
│       │       ├── patient/
│       │       │   └── [id]/route.ts
│       │       └── admin/
│       │           ├── clinic/route.ts
│       │           ├── doctor/route.ts
│       │           └── analytics/route.ts
│       └── middleware.ts              # Validate doctor/admin JWT, enforce clinic scope

src/                                   # Shared backend (existing)
├── packages/
│   ├── ai-engine/                     # All AI engines (do not restructure)
│   │   ├── clinical-engine/
│   │   ├── therapy-engine/
│   │   ├── questionnaire-engine/
│   │   └── narrative-engine (explanations)/
│   └── types/
├── services/
│   ├── AssessmentService.ts           # Create, update, fetch assessments
│   ├── OrchestrationService.ts        # Trigger and track AI pipeline
│   └── ReportService.ts              # RBAC-aware artifact fetching
└── prismaClient.ts                    # Singleton Prisma client
```

---

## E. RBAC Strategy

### Role Capabilities Matrix

| Capability | PATIENT | STAFF | DOCTOR | CLINIC_ADMIN | ORG_ADMIN | SUPER_ADMIN |
|-----------|---------|-------|--------|--------------|-----------|-------------|
| Submit questionnaire | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View own status | ✓ | — | — | — | — | — |
| View AIArtifacts | — | — | ✓ | ✓ | ✓ | ✓ |
| View ClinicalProfile | — | — | ✓ | ✓ | ✓ | ✓ |
| Manage Patients | — | read | ✓ | ✓ | ✓ | ✓ |
| Manage Doctors | — | — | — | ✓ | ✓ | ✓ |
| Manage Clinics | — | — | — | own only | ✓ | ✓ |
| Manage Organizations | — | — | — | — | own only | ✓ |
| View Analytics | — | — | read | ✓ | ✓ | ✓ |

### Implementation Pattern

```typescript
// src/lib/rbac.ts

import { SystemRole } from '@prisma/client'

type RoleSet = SystemRole[]

export const ROLES = {
  canViewClinicalArtifacts: [
    SystemRole.DOCTOR,
    SystemRole.CLINIC_ADMIN,
    SystemRole.ORG_ADMIN,
    SystemRole.SUPER_ADMIN,
  ] as RoleSet,

  canManageClinics: [
    SystemRole.CLINIC_ADMIN,
    SystemRole.ORG_ADMIN,
    SystemRole.SUPER_ADMIN,
  ] as RoleSet,

  canManageOrganizations: [
    SystemRole.ORG_ADMIN,
    SystemRole.SUPER_ADMIN,
  ] as RoleSet,
}

export function assertRole(userRole: SystemRole, allowed: RoleSet): void {
  if (!allowed.includes(userRole)) {
    throw new Error('FORBIDDEN')
  }
}

// Clinic-scope guard — every data query must be scoped to actor's clinic
export function assertClinicScope(
  actorClinicId: string,
  resourceClinicId: string
): void {
  if (actorClinicId !== resourceClinicId) {
    throw new Error('FORBIDDEN — cross-clinic access denied')
  }
}
```

```typescript
// Example: GET /api/assessment/[id] in doctor portal
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const actor = await getAuthenticatedActor(req) // reads Supabase JWT
  assertRole(actor.role, ROLES.canViewClinicalArtifacts)

  const assessment = await prisma.assessment.findUnique({
    where: { id: params.id },
    include: { artifacts: true, patient: true },
  })

  if (!assessment) return Response.json({ error: 'Not found' }, { status: 404 })

  // Clinic scope check — doctor can only see their clinic's assessments
  assertClinicScope(actor.clinicId, assessment.clinicId)

  return Response.json(assessment)
}
```

### How RBAC Works with Supabase Auth

1. Patient/Doctor/Admin logs in via Supabase Auth
2. Your API reads `supabaseUserId` from the JWT (`req.headers.authorization`)
3. Look up `Doctor` or `OrganizationMember` by `supabaseUserId` to get role + clinicId
4. Every query is scoped to that `clinicId`
5. No RLS needed at this stage — API-level enforcement is sufficient and auditable

---

## F. Supabase Integration Strategy

### Connection Architecture

```
Next.js Serverless Function
         │
         ▼
  Supabase pgBouncer          ← DATABASE_URL (port 6543)
  (Transaction Mode)          ← connection_limit=1 per function instance
         │
         ▼
  Postgres (Supabase)         ← 60 connections max on free tier
                              ← 200 connections on Pro tier
```

**Critical:** Set `connection_limit=1` in DATABASE_URL for serverless (each function instance needs only one connection to pgBouncer). Do NOT use `?pgbouncer=true` without `connection_limit=1` — it will exhaust Postgres connections under load.

### Prisma Client Singleton

```typescript
// src/prismaClient.ts

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

Never create `new PrismaClient()` outside this singleton. In Next.js dev mode, hot reload creates new instances on every file change — the singleton prevents connection pool exhaustion.

### Supabase Auth Integration

```typescript
// src/lib/auth.ts — server-side actor resolution

import { createServerClient } from '@supabase/ssr'
import { prisma } from '@/prismaClient'
import { SystemRole } from '@prisma/client'

export async function getAuthenticatedActor(req: Request) {
  const supabase = createServerClient(/* ... */)
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) throw new Error('UNAUTHENTICATED')

  // Try Doctor lookup first
  const doctor = await prisma.doctor.findUnique({
    where: { supabaseUserId: user.id },
    select: { id: true, clinicId: true, isActive: true },
  })

  if (doctor) {
    if (!doctor.isActive) throw new Error('ACCOUNT_DISABLED')
    return { supabaseUserId: user.id, id: doctor.id, role: SystemRole.DOCTOR, clinicId: doctor.clinicId }
  }

  // Try OrganizationMember lookup (admin roles)
  const member = await prisma.organizationMember.findUnique({
    where: { supabaseUserId: user.id },
    select: { id: true, role: true, organizationId: true, isActive: true },
  })

  if (member) {
    if (!member.isActive) throw new Error('ACCOUNT_DISABLED')
    return { supabaseUserId: user.id, id: member.id, role: member.role, organizationId: member.organizationId }
  }

  throw new Error('UNAUTHENTICATED — user not found in system')
}
```

---

## G. Assessment Submission Pipeline

### Patient Flow

```
1. Patient scans QR code at clinic
        ↓
2. Opens patient portal with ?clinicId=xxx&doctorId=yyy (optional)
        ↓
3. Completes questionnaire (21 questions, real protocol)
        ↓
4. POST /api/assessment/submit
   → Creates Patient record (if new)
   → Creates Assessment (status: PENDING)
   → Stores AssessmentResponses
   → Triggers orchestration async
        ↓
5. Patient sees: "Your hair analysis is being prepared..."
   Polls GET /api/assessment/status/[id]
   Returns: { status, completedAt } — NO clinical data
        ↓
6. Status becomes COMPLETED_WITH_REPORTS
   Patient sees: "Your analysis is ready. Your doctor will review it."
```

### AI Orchestration Pipeline

```
AssessmentService.submit()
        ↓
OrchestrationService.trigger(assessmentId)
        ↓
  ┌── Stage 1: clinical-engine        → AIArtifact(CLINICAL_REASONING)
  ├── Stage 2: therapy-engine         → AIArtifact(THERAPY_PLAN)
  ├── Stage 3: narrative-engine       → AIArtifact(NARRATIVES)
  └── Stage 4: kit-scorer             → AIArtifact(RECOMMENDATIONS)
        ↓
Assessment.status = COMPLETED_WITH_REPORTS
        ↓
WhatsappDelivery (optional — send notification to doctor)
```

### Report Access (Doctor)

```
Doctor opens dashboard
        ↓
GET /api/assessment/[id]
→ assertRole([DOCTOR, CLINIC_ADMIN, ...])
→ assertClinicScope(actor.clinicId, assessment.clinicId)
→ Returns: Assessment + all AIArtifacts
        ↓
Doctor sees: ClinicalProfile, SeverityAnalysis, TherapyPlan, Narratives
```

---

## H. Scaling Considerations

### Now (0–5k assessments/month)
- Single Supabase project, free or Pro tier
- Stateless Next.js API routes
- Prisma singleton + pgBouncer Transaction Mode
- No caching layer needed

### Phase 2 (5k–100k assessments/month)
- Add Redis (Upstash) for: orchestration state, rate limiting, deduplication
- Index `Assessment(clinicId, createdAt)` for clinic dashboard queries — already in schema
- Move AI orchestration to background queue (BullMQ on Upstash Redis or Supabase Edge Functions)
- Add Supabase Pro for 200 connections

### Phase 3 (100k+ assessments/month)
- Partition `AnalyticsEvent` by month (`createdAt`)
- Separate read replica for analytics queries
- Consider Supabase branching for staging environments
- Add `pgvector` extension for semantic search on clinical narratives

### What will NOT scale if ignored
- Not using `connection_limit=1` → Postgres connection exhaustion at ~50 concurrent users
- Not indexing `clinicId` on every tenant-scoped table → full table scans at 100k+ rows
- Running orchestration synchronously in API routes → 30s timeout failures
- Storing AI outputs as text in a `content TEXT` column → no structured querying

---

## I. What Should NOT Be Built Yet

| Feature | Reason to defer |
|---------|----------------|
| Row-Level Security (RLS) | API-level RBAC is sufficient and far simpler to debug. RLS adds complexity without benefit until you have external SQL clients accessing the DB directly |
| Kubernetes / ECS | Vercel/Railway handles scaling; premature infra adds ops burden |
| Separate analytics database | Supabase Postgres can handle analytics at this scale. Partition the table when rows exceed 10M |
| Multi-region Postgres | Supabase supports read replicas — defer until you have >5 clinics in different countries |
| WhatsApp API integration | Schema supports it (WhatsappDelivery, WhatsappSession). Build the integration when clinic demand exists |
| Patient self-serve portal | Scaffold is in schema (Patient.supabaseUserId). Build when you have patient demand |
| Microservices | Everything fits cleanly in a Next.js monorepo at this scale |
| Audit log pipeline (streaming) | AuditLog table is sufficient. Add streaming (Supabase Realtime / Kafka) at 1M+ events |

---

## I. Implementation Order

### Sprint 1 — Fix the crash (1–2 days)
1. Set `DIRECT_URL` in `.env`
2. Baseline existing Supabase state: `prisma migrate diff --from-empty --to-url $DIRECT_URL --script`
3. Run `prisma migrate dev --name hairos_core_tables`
4. Review generated SQL — confirm Clinic, Doctor, Patient, Assessment tables will be created
5. Run `prisma migrate deploy` against Supabase
6. Run `prisma generate`
7. Verify: `tx.clinic.findUnique()` no longer crashes

### Sprint 2 — Seed minimum viable data (1 day)
1. Create seed script: Organization → Clinic → Doctor
2. Run `npx prisma db seed`
3. Verify doctor can log in via Supabase Auth and their `supabaseUserId` is stored in `Doctor` table

### Sprint 3 — Assessment submission API (2–3 days)
1. `POST /api/assessment/submit` — create Patient + Assessment + AssessmentResponses
2. `GET /api/assessment/status/[id]` — return status only (no artifacts)
3. Wire to existing AI orchestration pipeline
4. Store results as `AIArtifact` rows

### Sprint 4 — Doctor report API (2–3 days)
1. `GET /api/assessment/[id]` — full report with RBAC gate
2. Doctor dashboard — list assessments for their clinic
3. RBAC middleware — `getAuthenticatedActor()` + `assertRole()` + `assertClinicScope()`

### Sprint 5 — Admin APIs (1–2 days)
1. Create Clinic
2. Create Doctor (create Supabase Auth user + Doctor record)
3. Assign Doctor to Assessment

### Sprint 6 — QR code flow (1 day)
1. Generate QR code per clinic: encodes `clinicId` + optional `doctorId`
2. Patient portal reads QR params and pre-fills clinic context on submission

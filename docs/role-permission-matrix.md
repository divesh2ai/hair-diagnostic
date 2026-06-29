# Role Permission Matrix — HairOS

**Required by addendum §8 before writing any RLS policy.**

This matrix is the single source of truth for what each role may do against each canonical table. RLS policies, API guards, and UI affordances must all conform to it.

## Roles

| Role | Scope | Identity | Where claim comes from |
|---|---|---|---|
| `SUPER_ADMIN` | Platform-wide | mobile + email required | `OrganizationMember.role = 'SUPER_ADMIN'` |
| `ORG_ADMIN` | One organization | mobile + email required | `OrganizationMember.role = 'ORG_ADMIN'` with `organization_id` claim |
| `CLINIC_ADMIN` | One clinic | mobile + email required | `ClinicMember.role = 'CLINIC_ADMIN'` with `clinic_id` claim |
| `DOCTOR` | One clinic + own patients | mobile + email required | `Doctor.supabaseUserId` with `clinic_id` claim |
| `STAFF` | One clinic, no clinical access | mobile + email required | `ClinicMember.role = 'STAFF'` with `clinic_id` claim |
| `PATIENT` | Own records | mobile required, email optional | `Patient.supabaseUserId` with `clinic_id` claim |
| `service_role` | Internal (Next.js server, edge functions) | — | Supabase service key |
| `anon` | Pre-auth public surfaces | — | Supabase anon key |

## Notation

- `R` = read (`SELECT`)
- `W` = create + update (`INSERT`, `UPDATE`)
- `D` = soft-delete (sets `deletedAt`) — never `DELETE FROM`
- `—` = denied
- `*` = scoped (qualifier in footnote)
- `s` = service_role bypass (server reads/writes via Prisma; RLS does not apply)

`service_role` always has full access (`s`) — it's how the Next.js server reaches the DB. The matrix below describes RLS rules for `authenticated` and `anon` Postgres roles.

## Tenant & identity tables

| Table | SUPER_ADMIN | ORG_ADMIN | CLINIC_ADMIN | DOCTOR | STAFF | PATIENT | anon |
|---|---|---|---|---|---|---|---|
| `Organization` | RWD | R¹ W¹ | R² | R² | R² | — | — |
| `OrganizationMember` | RWD | RWD¹ | R² | — | — | — | — |
| `Clinic` | RWD | RWD¹ | RW³ | R² | R² | R² | R⁴ (public landing) |
| `ClinicMember` | RWD | RWD¹ | RWD³ | R³ | R³ | — | — |
| `Doctor` | RWD | RWD¹ | RWD³ | R³ + W self | R³ | R³ (assigned only) | R⁴ (public landing) |
| `Patient` | R | R¹ | RW³ | RW⁵ | R³ | R self | — |
| `PatientIdentifier` | R | R¹ | RW³ | RW⁵ | R³ | R self | — |
| `ClinicInvitation` | RWD | RWD¹ | RWD³ | — | — | — | — |

¹ Within own `organization_id`.
² Read-only access to the org/clinic record they belong to.
³ Within own `clinic_id`.
⁴ Anonymous read of the public-facing fields of the clinic + its primary doctor only — surfaced by the `/q/[clinicSlug]` landing page. Filtered to active, non-deleted rows.
⁵ Doctor may read all patients in their clinic (clinic-shared queue) but only update patients explicitly assigned via `Patient.doctorId`.

## Clinical workflow tables

| Table | SUPER_ADMIN | ORG_ADMIN | CLINIC_ADMIN | DOCTOR | STAFF | PATIENT | anon |
|---|---|---|---|---|---|---|---|
| `Assessment` | R | R¹ | RW³ | RW⁵ | R³ | R self⁶ | W⁷ |
| `AssessmentResponse` | R | R¹ | R³ | R⁵ | — | R self⁶ | W⁷ |
| `AIArtifact` | R | R¹ | R³ | R⁵ | — | — ⁸ | — |
| `OrchestrationLog` | R | R¹ | R³ | R⁵ | — | — | — |
| `AssessmentEvent` | R | R¹ | R³ | R⁵ | — | — | — |
| `AnalyticsEvent` | R | R¹ | R³ | R³ (own clinic) | — | — | — |
| `AuditLog` | R | R¹ | R³ | — | — | — | — |
| `WhatsappDelivery` | R | R¹ | R³ | R³ | R³ | — | — |

⁶ Patient self-read keyed on `Patient.supabaseUserId = auth.uid()` joined through the Assessment.
⁷ Anonymous QR/landing flow: insert-only on `Assessment` + `AssessmentResponse` while a valid clinic slug + assessment-session token is present. Implemented via `service_role` server endpoint rather than direct anon write — anon RLS denies direct table writes.
⁸ Patients consume AI output through the rendered report view (server-side composes from `AIArtifact`); direct read is denied so artifact JSON internals never leak to clients.

## Invitation flow

| Action | SUPER_ADMIN | ORG_ADMIN | CLINIC_ADMIN | DOCTOR | STAFF | PATIENT | anon |
|---|---|---|---|---|---|---|---|
| Create org-scoped invite | ✅ | own org | — | — | — | — | — |
| Create clinic-scoped invite | ✅ | own org's clinics | own clinic | — | — | — | — |
| List invitations | all | own org + its clinics | own clinic | — | — | — | — |
| Revoke invitation | ✅ | own scope | own clinic | — | — | — | — |
| Preview invite by token | — | — | — | — | — | — | ✅ (token-gated) |
| Accept invite | requires signed-in Supabase user whose email or phone matches the invitation |

## Legacy chat tables (out of Phase 1 scope)

`User`, `Session`, `Message`, `Diagnosis`, `Recommendation`, `WhatsappSession` — **server-only**. No role gets `R/W` via RLS; all access via `service_role`. Default-deny RLS policies will be added in Phase 1.4 alongside the canonical surface.

## Storage buckets

| Bucket | SUPER_ADMIN | ORG_ADMIN | CLINIC_ADMIN | DOCTOR | STAFF | PATIENT | anon |
|---|---|---|---|---|---|---|---|
| `clinical-reports` (PDFs) | R | R¹ | R³ | R⁵ | R³ | R self⁶ (signed URL only) | — |

Path convention (enforced by storage RLS, written in Phase 1.4): `<clinicId>/<assessmentId>/<artifact>.pdf`. The bucket currently allows public reads — Phase 1.4 also flips it to private and switches the patient flow to signed URLs.

## Cross-cutting rules

1. **Soft delete:** every policy filters `deletedAt IS NULL`.
2. **Active-only:** policies on `Doctor`, `ClinicMember`, `OrganizationMember`, `Patient`, `Clinic`, `Organization` additionally require `isActive = true` for read by non-admins.
3. **Service role bypass:** `service_role` skips RLS by design. All server routes route through Prisma using the service key — RLS is the second line of defense, not the primary authz mechanism.
4. **JWT claims contract:** policies read `auth.jwt() ->> 'user_role'`, `auth.jwt() ->> 'clinic_id'`, `auth.jwt() ->> 'organization_id'`. Claims are emitted by `public.custom_access_token_hook` (see memory `project-jwt-custom-claims`).
5. **No `DELETE` from authenticated:** soft-delete only. The `service_role` bypass covers exceptional hard deletes (data subject erasure) via an audited migration.
6. **Patient identity:** patient self-reads use `auth.uid()` against `Patient.supabaseUserId`. Anon patient flow happens entirely via server endpoints — the patient is anonymous until the assessment completes and they claim it.

## Test fixtures required for Phase 1.4 validation

Per addendum §8 ("Validate using test users for every role"), Phase 1.4 must seed and run smoke tests against one user of each role:

| Role | Test fixture | Validates |
|---|---|---|
| SUPER_ADMIN | platform-wide list of clinics returns >1 | unrestricted read |
| ORG_ADMIN | reads only Clinic rows in own org | org-scope filter |
| CLINIC_ADMIN | cannot read patients in another clinic | clinic-scope filter |
| DOCTOR | reads assigned patients but cannot update others | dual-scope filter |
| STAFF | reads clinic patients but cannot read AIArtifact | role-based column gating |
| PATIENT | reads own assessment row + responses but not artifact | self-scope filter |
| anon (signed-in as nothing) | reads clinic landing fields but not patient list | public surface gating |

## Approval

OK to proceed to Phase 1.4 (RLS policy migration) on this matrix as written?

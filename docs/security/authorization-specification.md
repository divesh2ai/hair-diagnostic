# HairOS — Authorization & Security Specification (v1.0, FROZEN)

**Status:** Final pre-build specification — frozen on approval.
**Owner:** Principal Security Architect.
**Scope:** Definitive contract for Supabase RLS, API authorization, UI visibility, business workflow permissions, and audit logging across the HairOS platform.
**Out of scope:** SQL, Prisma definitions, application code.

---

## 0. Preface — Schema & Role Reconciliation

This spec uses the role set and table list defined in the addendum. The current Prisma schema differs in two places; both are reconciled by the **first migration of the implementation phase**, not by this spec:

| Spec name | Current code | Reconciliation |
|---|---|---|
| Roles: `RECEPTIONIST`, `PHOTOGRAPHER`, `SUPPORT` | absent from `SystemRole` enum | enum extended; existing `STAFF` → mapped per-row to `RECEPTIONIST` by default |
| Roles: `ORG_ADMIN` | present in enum | retired; existing ORG_ADMIN rows reassigned to `SUPER_ADMIN` of the same org (scope narrowing is deliberate per addendum) |
| Roles: `STAFF` | present in enum | retired in favor of `RECEPTIONIST` / `PHOTOGRAPHER` / `SUPPORT` |
| Table naming: `snake_case` per addendum | `PascalCase` in Prisma | this spec uses the **logical** snake_case names; the Prisma → Postgres mapping is unchanged (table-level `@@map` if any rename is later desired) |
| Tables: `assessment_images`, `report_reviews`, `treatments`, `treatment_catalog`, `orders`, `order_items`, `inventory`, `products`, `appointments`, `followups`, `videos`, `notifications`, `support_tickets`, `knowledge_base`, `validation_metrics`, `analytics_snapshots` | absent or partial | introduced in Phases 3–9 per the master plan; **this spec defines their authorization contract before they are built** |

The spec speaks in **logical entity names** below. Implementation maps each to its physical model.

---

## 1. Roles & Identity Model

### 1.1 Role taxonomy

| Role | Scope | Identity requirements | Source-of-truth row |
|---|---|---|---|
| `SUPER_ADMIN` | Platform-wide. May span organizations. | mobile (WhatsApp) + email required | `clinic_members.role = SUPER_ADMIN` with `organization_id` claim, or a global flag — see §1.4 |
| `CLINIC_ADMIN` | One clinic. May hold membership in multiple clinics (separate rows). | mobile + email required | `clinic_members.role = CLINIC_ADMIN` |
| `DOCTOR` | One clinic + own/assigned patients. | mobile + email required | `clinic_members.role = DOCTOR` (clinical attributes on the same row) |
| `RECEPTIONIST` | One clinic. Patient logistics; no clinical authoring. | mobile + email required | `clinic_members.role = RECEPTIONIST` |
| `PHOTOGRAPHER` | One clinic. Image capture, severely scoped. | mobile + email required | `clinic_members.role = PHOTOGRAPHER` |
| `SUPPORT` | Platform-wide read with audited write on tickets. | mobile + email required | `clinic_members.role = SUPPORT` with no clinic binding; `is_global = true` |
| `PATIENT` | Self only. | mobile required; email optional | `patients.supabase_user_id` |
| `service_role` | Internal — Next.js server, edge functions, migrations. | Supabase service key | not a database role row; bypasses RLS |

### 1.2 Multi-clinic membership

A single Supabase user MAY have multiple `clinic_members` rows across clinics. Their effective role for any request is determined by an explicit `clinic_id` selector (header, route param, or default = last-used). The custom JWT hook emits a **list of memberships** (`memberships: [{ clinic_id, organization_id, role }]`) **and** a primary `clinic_id` / `user_role` for routes that don't pass a selector.

### 1.3 Default selector & cross-clinic safety

- When a multi-clinic user does not pass a `clinic_id` selector, the **least-privileged** active membership wins (e.g., RECEPTIONIST over CLINIC_ADMIN). This biases toward safe default reads.
- Every API request that mutates state MUST carry an explicit `clinic_id` (path or header `x-clinic-id`); the membership for that clinic is the one evaluated.

### 1.4 SUPER_ADMIN

- A `SUPER_ADMIN` is a `clinic_members` row with `is_global = true` and no `clinic_id` binding required. The row may carry an `organization_id` (org-scoped super-admin) or null (platform super-admin).
- Platform `SUPER_ADMIN` (org=null) is reserved for HairOS platform staff. Cannot be created via the invitation flow; only via a service-role provisioning script.

### 1.5 Identity claims contract (JWT)

The custom_access_token_hook MUST emit the following top-level claims on every authenticated JWT:

| Claim | Type | Always present | Meaning |
|---|---|---|---|
| `sub` | uuid | yes | Supabase user id |
| `email` | text | when verified | user email |
| `phone` | text | when verified | user E.164 phone |
| `user_role` | enum | yes (else deny) | primary role per §1.3 selector rule |
| `clinic_id` | text (cuid) | for clinic-scoped primary | primary clinic |
| `organization_id` | text (cuid) | when derivable | organization owning `clinic_id` |
| `memberships` | json array | yes | full list `[{ clinic_id, organization_id, role, is_global }]` |
| `mfa_level` | int | yes | 0 or 1 (used by sensitive actions) |
| `session_id` | text | yes | for audit correlation |

Policies use `auth.jwt() ->> 'claim'`. No policy ever reads from `auth.users` directly — JWT is the trust boundary.

---

## 2. Cross-Cutting Security Rules (DELIVERABLE 7)

These rules govern every table, endpoint, screen, and workflow in this document. Conflicts resolve in favor of the rule with the higher number.

### 7.1 Least Privilege
Default for every (role × resource × operation) is **deny**. Every grant in this spec is positive enumeration; nothing is implicit.

### 7.2 Tenant / Organization / Clinic Isolation
- **Organization isolation:** a row is invisible across organizations unless an explicit cross-org grant exists (only `SUPER_ADMIN` and `service_role` cross orgs).
- **Clinic isolation:** within an organization, a row is invisible across clinics unless the actor's membership lists that clinic.
- **Patient isolation:** within a clinic, doctors with `assigned_only = true` see only `patients.assigned_doctor_id = self`. Default `false` (shared-queue model) — toggle per clinic in `clinics.privacy_mode`.

### 7.3 Soft Delete
- No `DELETE` is permitted by any application role on any clinical or identity table. Only `UPDATE ... SET deleted_at = now()`.
- Every SELECT policy filters `deleted_at IS NULL` unless the action is explicitly "View archived" (CLINIC_ADMIN only).
- Hard delete is a `service_role` operation, requires an `audit_logs` entry of type `HARD_DELETE`, and is reserved for GDPR/DPDPA data-subject erasure under a documented runbook.

### 7.4 Membership Validation
- Every authorization check resolves: `is the actor's membership for the requested clinic/org ACTIVE, not soft-deleted, and does its role permit the action?`
- A suspended clinic (`clinics.status = SUSPENDED`) denies all member actions except `SUPER_ADMIN` reads and `service_role`.
- An archived clinic (`clinics.status = ARCHIVED`) is read-only for everyone including `SUPER_ADMIN`; only `service_role` may unarchive.

### 7.5 JWT Claims Requirements
- JWT must carry `user_role` AND (for clinic-scoped roles) `clinic_id`, OR the request is denied 401.
- JWT must be verified server-side via Supabase JWKS on every request — no client-forwarded role headers are ever trusted.
- JWT TTL ≤ 1 hour. Refresh token TTL ≤ 30 days. Re-issued JWT picks up the latest memberships via the hook.

### 7.6 Service Role Usage
- Used by: Next.js server routes (Prisma over `DATABASE_URL`), Supabase edge functions, migration scripts, internal cron.
- MUST NOT be used in any code that runs on the client.
- Every server route that uses service_role MUST internally call `requireRole(...)` to re-validate the JWT — RLS is the second line of defense, not the only one.
- Service-role-only operations (hard delete, role promotion, billing adjustments) live in dedicated server routes that emit an `audit_logs` row before the operation.

### 7.7 Storage Bucket Isolation
- Path prefix is the trust boundary: `clinic-reports/<clinic_id>/<assessment_id>/<artifact>.pdf`.
- Storage RLS allows reads only when the actor's JWT `clinic_id` (or `memberships[].clinic_id`) prefix-matches the path.
- Patient reads of their own report use signed URLs minted by the server after a `requireRole(PATIENT)` check; direct anon reads are denied.

### 7.8 Webhook Authentication
- Every inbound webhook (Meta WhatsApp, HeyGen, payment gateway) validates an HMAC signature against a per-provider secret stored in Supabase Vault.
- Every webhook handler asserts `x-hairos-source` and a per-event nonce; reused nonces are rejected (§7.9).
- Webhook handlers MUST emit an `audit_logs` row with `actor_type = WEBHOOK_PROVIDER`.

### 7.9 Replay Protection
- All webhook payloads carry a `nonce`. A `webhook_replay_guard` table stores `{ provider, nonce, received_at }` with a 24-hour TTL; duplicate nonces are dropped.
- All token-bearing public endpoints (`/api/invitations/[token]/*`, future patient assessment links) accept a token only if its sha256 matches a `token_hash` with a pending status; reuse is impossible because the hash is invalidated on acceptance.

### 7.10 Rate Limiting
- Anonymous endpoints: 30 req/min per IP, 5 req/min per token.
- Authenticated endpoints: 120 req/min per Supabase user.
- Sensitive admin endpoints (invitation create, suspend clinic, role change, hard delete): 10 req/min per Supabase user.
- 429 responses include `Retry-After`. Repeated 429s emit an `audit_logs.SUSPICIOUS_RATE` event.

### 7.11 Invitation Expiry
- Default TTL 7 days, minimum 1 hour, maximum 30 days (enforced server-side).
- Expired invitations auto-flip to `EXPIRED` on the first failed accept attempt or by a scheduled job every 6 hours.
- Revoked invitations cannot be re-activated — issue a new one.
- Tokens are one-time-use; on `ACCEPTED` the hash is retained for audit linkage but cannot be reused.

### 7.12 MFA & step-up
- The following actions REQUIRE `mfa_level >= 1` (verified second factor in the current session):
  - Suspend / archive clinic
  - Create / promote SUPER_ADMIN
  - Approve treatment plan
  - Override AI diagnosis
  - Hard delete (service_role)
  - Bulk export of patient data
- Missing MFA returns HTTP 412 `mfa_required` with a hint to step-up.

### 7.13 Patient PII handling
- Patient `phone`, `email`, `address` are restricted from any logged payload. Audit log rows carry `patient_id`, never raw PII.
- AI engines receive a redacted snapshot — patient identifiers are replaced by `assessment_id` before any external LLM call.
- Image uploads strip EXIF (location/device) at the upload boundary.

---

## 3. DELIVERABLE 1 — Complete RLS Access Matrix

### 3.1 Notation

For each table, the matrix lists per role: `S` (SELECT), `I` (INSERT), `U` (UPDATE), `D` (DELETE). Each cell is either:

- **`—`** denied
- **`✓`** unconditional grant
- **`P:<predicate>`** grant guarded by predicate

Predicates use the following shorthand:
- `self`: row owned by `auth.uid()` (e.g., `patients.supabase_user_id = auth.uid()`)
- `member(clinic_id)`: `EXISTS (clinic_members where supabase_user_id = auth.uid() AND clinic_id = row.clinic_id AND role = <role> AND is_active AND deleted_at IS NULL)`
- `member_any(clinic_id)`: same but any active membership row
- `org_member(org_id)`: actor has membership in any clinic of that organization
- `assigned`: `row.assigned_doctor_id = auth.uid()` mapped through `clinic_members`
- `not_deleted`: `row.deleted_at IS NULL`
- `not_suspended`: clinic status not in (`SUSPENDED`, `ARCHIVED`)
- `active`: subject is active (clinics.is_active, doctor.is_active, etc.)
- `is_global`: actor has `clinic_members.is_global = true`

Every grant additionally enforces `not_deleted` AND `not_suspended` unless explicitly noted.

`service_role` row is omitted from each table — by §7.6 it bypasses RLS on every operation. `anon` row is included only where there is any anonymous access.

DELETE is **never** granted to authenticated roles per §7.3. The `D` column is `—` everywhere below; only `service_role` may DELETE, and only under §7.6 controls. The column is shown explicitly to leave no ambiguity.

### 3.2 Tenant tables

#### `organizations`

| Role | S | I | U | D |
|---|---|---|---|---|
| SUPER_ADMIN | ✓ | ✓ | ✓ | — |
| CLINIC_ADMIN | P: `org_member(id)` | — | — | — |
| DOCTOR / RECEPTIONIST / PHOTOGRAPHER | P: `org_member(id)` | — | — | — |
| SUPPORT | ✓ (read-only) | — | — | — |
| PATIENT | — | — | — | — |
| anon | — | — | — | — |

#### `clinics`

| Role | S | I | U | D |
|---|---|---|---|---|
| SUPER_ADMIN | ✓ | ✓ | ✓ | — |
| CLINIC_ADMIN | P: `member(id)` | — | P: `member(id)` (branding, hours, language; not `status`) | — |
| DOCTOR | P: `member_any(id)` | — | — | — |
| RECEPTIONIST | P: `member(id)` | — | — | — |
| PHOTOGRAPHER | P: `member(id)` | — | — | — |
| SUPPORT | ✓ | — | — | — |
| PATIENT | P: row belongs to an `assessment` the patient owns | — | — | — |
| anon | P: only public fields (`name, slug, logo_url, tagline, primary doctor`) and `is_active = true` | — | — | — |

The anon SELECT is implemented via a dedicated view (`v_clinic_public`) with a column-filtered RLS policy, OR by routing all anonymous clinic reads through a server endpoint with explicit field selection. The latter is preferred.

#### `users`

This is the application-layer "user profile" table layered over `auth.users` (which is owned by Supabase Auth and never directly accessed).

| Role | S | I | U | D |
|---|---|---|---|---|
| SUPER_ADMIN | ✓ | — | ✓ | — |
| CLINIC_ADMIN | P: subject is a `member(any_clinic_i_admin)` | — | P: subject is a `member(any_clinic_i_admin)`; cannot change role | — |
| DOCTOR / RECEPTIONIST / PHOTOGRAPHER | P: `id = auth.uid()` (self) | — | P: self, profile fields only | — |
| SUPPORT | ✓ | — | — | — |
| PATIENT | P: self | — | P: self | — |

#### `clinic_members`

| Role | S | I | U | D |
|---|---|---|---|---|
| SUPER_ADMIN | ✓ | ✓ | ✓ | — |
| CLINIC_ADMIN | P: `member(clinic_id)` | P: `member(clinic_id)` AND role ∈ {DOCTOR, RECEPTIONIST, PHOTOGRAPHER} | P: `member(clinic_id)` AND row.role ∈ {DOCTOR, RECEPTIONIST, PHOTOGRAPHER} | — |
| DOCTOR / RECEPTIONIST / PHOTOGRAPHER | P: own row OR rows with `clinic_id` actor belongs to (read only) | — | P: own row, profile fields only | — |
| SUPPORT | ✓ | — | — | — |
| PATIENT | — | — | — | — |

`is_global` rows are insertable/updatable only by `service_role`; the `SUPER_ADMIN` grant excludes the `is_global` column from UPDATE.

### 3.3 Patient & clinical core

#### `patients`

| Role | S | I | U | D |
|---|---|---|---|---|
| SUPER_ADMIN | ✓ | — | ✓ | — |
| CLINIC_ADMIN | P: `member(row.clinic_id)` | P: `member(row.clinic_id)` | P: `member(row.clinic_id)` | — |
| DOCTOR | P: `member(row.clinic_id)` AND (`clinic.privacy_mode != ASSIGNED_ONLY` OR `row.assigned_doctor_id = self`) | P: `member(row.clinic_id)` | P: same as SELECT predicate | — |
| RECEPTIONIST | P: `member(row.clinic_id)` | P: `member(row.clinic_id)` | P: `member(row.clinic_id)`, only non-clinical fields (`name`, `phone`, `email`, `address`, `appointment_pref`) | — |
| PHOTOGRAPHER | P: `member(row.clinic_id)` AND the patient has a pending assessment needing image capture | — | — | — |
| SUPPORT | P: only when actively assigned to a `support_tickets.patient_id` row owned by actor | — | — | — |
| PATIENT | P: `supabase_user_id = auth.uid()` | — | P: self, `phone, email, address` only | — |

#### `assessments`

| Role | S | I | U | D |
|---|---|---|---|---|
| SUPER_ADMIN | ✓ | — | ✓ | — |
| CLINIC_ADMIN | P: `member(row.clinic_id)` | — | P: `member(row.clinic_id)`, lifecycle fields only (see §5.1 state machine) | — |
| DOCTOR | P: `member(row.clinic_id)` AND (shared-queue OR `row.assigned_doctor_id = self`) | — | P: same as SELECT, only state-machine-permitted transitions | — |
| RECEPTIONIST | P: `member(row.clinic_id)` | P: `member(row.clinic_id)` AND `row.source IN (MANUAL, WEB)` | P: state-machine transitions limited to assignment + scheduling | — |
| PHOTOGRAPHER | P: `member(row.clinic_id)` AND `row.status IN (PENDING, IMAGES_REQUIRED)` | — | P: only `status = IMAGES_UPLOADED` transition | — |
| SUPPORT | P: linked to an open `support_tickets` row | — | — | — |
| PATIENT | P: `row.patient_id` resolves to self via `patients.supabase_user_id` | INSERT is service-role only (server-side after QR onboarding) | P: limited to `survey_response` columns while `status = QUESTIONNAIRE_IN_PROGRESS` | — |
| anon | — | — | — | — |

#### `assessment_images`

| Role | S | I | U | D |
|---|---|---|---|---|
| SUPER_ADMIN | ✓ | — | ✓ (only metadata) | — |
| CLINIC_ADMIN | P: `member(assessment.clinic_id)` | — | P: redact / archive only | — |
| DOCTOR | P: `member(assessment.clinic_id)` AND assessment visible per §3.3 | — | P: annotate only | — |
| RECEPTIONIST | P: `member(assessment.clinic_id)`, metadata only (no binary) | — | — | — |
| PHOTOGRAPHER | P: `member(assessment.clinic_id)` AND uploaded by self | P: `member(assessment.clinic_id)` | P: own row, metadata only | — |
| SUPPORT | — | — | — | — |
| PATIENT | P: own assessment, only **rendered/derived** images (no raw scalp images unless `assessment.share_raw_with_patient = true`) | INSERT via server upload endpoint only (anon-from-QR or self) | — | — |

#### `reports`

| Role | S | I | U | D |
|---|---|---|---|---|
| SUPER_ADMIN | ✓ | — | ✓ (state transitions) | — |
| CLINIC_ADMIN | P: `member(row.clinic_id)` | — | P: lifecycle transitions only | — |
| DOCTOR | P: `member(row.clinic_id)` AND visible per assessment rules | P: same predicate, only when `assessment.status = AI_REPORT_READY` | P: state-machine transitions (DRAFT → APPROVED, DRAFT → EDITS_REQUESTED, etc.) | — |
| RECEPTIONIST | P: `member(row.clinic_id)`, metadata only | — | — | — |
| PHOTOGRAPHER | — | — | — | — |
| SUPPORT | P: linked open ticket | — | — | — |
| PATIENT | P: `row.status = PUBLISHED_TO_PATIENT` AND assessment is self | — | — | — |

#### `report_reviews`

| Role | S | I | U | D |
|---|---|---|---|---|
| SUPER_ADMIN | ✓ | — | — | — |
| CLINIC_ADMIN | P: `member(report.clinic_id)` | — | — | — |
| DOCTOR | P: `member(report.clinic_id)` | P: own review row, only when `report.status = DRAFT` | P: own review row, immutable after submission | — |
| RECEPTIONIST | — | — | — | — |
| PHOTOGRAPHER | — | — | — | — |
| SUPPORT | P: linked ticket | — | — | — |
| PATIENT | — | — | — | — |

Reviews are append-only (no UPDATE after `submitted_at IS NOT NULL`). Revisions create new rows; the latest submitted row is the authoritative decision.

### 3.4 Treatment, ordering & inventory

#### `treatment_catalog`

| Role | S | I | U | D |
|---|---|---|---|---|
| SUPER_ADMIN | ✓ | ✓ | ✓ | — |
| CLINIC_ADMIN | ✓ (read-only) | — | — | — |
| DOCTOR | ✓ (read-only) | — | — | — |
| RECEPTIONIST | ✓ (read-only) | — | — | — |
| PHOTOGRAPHER | — | — | — | — |
| SUPPORT | ✓ (read-only) | — | — | — |
| PATIENT | — | — | — | — |

The catalog is platform-curated; clinic-specific overrides live on `treatments`.

#### `treatments`

A `treatment` is a doctor-authored prescription against a `report`.

| Role | S | I | U | D |
|---|---|---|---|---|
| SUPER_ADMIN | ✓ | — | ✓ | — |
| CLINIC_ADMIN | P: `member(row.clinic_id)` | — | P: lifecycle transitions only (not clinical content) | — |
| DOCTOR | P: `member(row.clinic_id)` | P: same; only when `report.status = APPROVED` | P: own draft until `APPROVED`; clinical revisions require a new revision row | — |
| RECEPTIONIST | P: `member(row.clinic_id)` | — | — | — |
| PHOTOGRAPHER | — | — | — | — |
| SUPPORT | P: linked ticket | — | — | — |
| PATIENT | P: `row.status = DISPATCHED` AND self | — | — | — |

#### `products`

| Role | S | I | U | D |
|---|---|---|---|---|
| SUPER_ADMIN | ✓ | ✓ | ✓ | — |
| CLINIC_ADMIN | ✓ (read-only) | — | — | — |
| DOCTOR / RECEPTIONIST / PHOTOGRAPHER / SUPPORT | ✓ (read-only) | — | — | — |
| PATIENT | — | — | — | — |

#### `inventory`

Per-clinic stock count for products.

| Role | S | I | U | D |
|---|---|---|---|---|
| SUPER_ADMIN | ✓ | ✓ | ✓ | — |
| CLINIC_ADMIN | P: `member(row.clinic_id)` | P: `member(row.clinic_id)` | P: `member(row.clinic_id)` | — |
| DOCTOR | P: `member(row.clinic_id)` | — | — | — |
| RECEPTIONIST | P: `member(row.clinic_id)` | — | P: `member(row.clinic_id)`, qty decrement on dispense only | — |
| PHOTOGRAPHER | — | — | — | — |
| SUPPORT | ✓ (read-only) | — | — | — |
| PATIENT | — | — | — | — |

#### `orders`

| Role | S | I | U | D |
|---|---|---|---|---|
| SUPER_ADMIN | ✓ | — | ✓ | — |
| CLINIC_ADMIN | P: `member(row.clinic_id)` | — | P: lifecycle transitions | — |
| DOCTOR | P: `member(row.clinic_id)` | — | — | — |
| RECEPTIONIST | P: `member(row.clinic_id)` | P: `member(row.clinic_id)`, only from an `APPROVED` treatment | P: lifecycle transitions (reserve, dispense, cancel) | — |
| PHOTOGRAPHER | — | — | — | — |
| SUPPORT | P: linked ticket | — | — | — |
| PATIENT | P: self | — | — | — |

#### `order_items`

Same as `orders` joined on the parent. RECEPTIONIST may UPDATE quantity only while `order.status = PENDING`.

### 3.5 Scheduling

#### `appointments`

| Role | S | I | U | D |
|---|---|---|---|---|
| SUPER_ADMIN | ✓ | — | ✓ | — |
| CLINIC_ADMIN | P: `member(row.clinic_id)` | P: same | P: same | — |
| DOCTOR | P: `member(row.clinic_id)` | P: same | P: same | — |
| RECEPTIONIST | P: `member(row.clinic_id)` | P: same | P: same | — |
| PHOTOGRAPHER | P: `member(row.clinic_id)` AND `row.type = IMAGE_CAPTURE` | — | P: own image-capture appointment, status only | — |
| SUPPORT | P: linked ticket | — | — | — |
| PATIENT | P: self | — | P: self, reschedule/cancel only | — |

#### `followups`

| Role | S | I | U | D |
|---|---|---|---|---|
| SUPER_ADMIN | ✓ | — | ✓ | — |
| CLINIC_ADMIN | P: `member(row.clinic_id)` | P: same | P: same | — |
| DOCTOR | P: `member(row.clinic_id)` | P: same | P: same | — |
| RECEPTIONIST | P: `member(row.clinic_id)` | P: same, only when scheduling logistics | P: same, scheduling fields | — |
| PHOTOGRAPHER | — | — | — | — |
| SUPPORT | P: linked ticket | — | — | — |
| PATIENT | P: self | — | P: self, ack only | — |

### 3.6 Media

#### `videos`

| Role | S | I | U | D |
|---|---|---|---|---|
| SUPER_ADMIN | ✓ | — | ✓ | — |
| CLINIC_ADMIN | P: `member(row.clinic_id)` | — | P: lifecycle | — |
| DOCTOR | P: `member(row.clinic_id)` | INSERT via server flow only (post-report-approval) | P: state transitions (approve/reject/regenerate); script edits create a revision | — |
| RECEPTIONIST | P: `member(row.clinic_id)`, metadata only | — | — | — |
| PHOTOGRAPHER | — | — | — | — |
| SUPPORT | P: linked ticket | — | — | — |
| PATIENT | P: own AND `status = PUBLISHED` | — | — | — |

### 3.7 Notifications & support

#### `notifications`

| Role | S | I | U | D |
|---|---|---|---|---|
| SUPER_ADMIN | ✓ | — | — | — |
| CLINIC_ADMIN | P: `member(row.clinic_id)` OR `row.recipient_user_id = auth.uid()` | — | P: own, mark-read only | — |
| DOCTOR / RECEPTIONIST / PHOTOGRAPHER | P: own (`recipient_user_id = auth.uid()`) OR `member(row.clinic_id)` AND `row.scope = CLINIC` | — | P: own, mark-read only | — |
| SUPPORT | ✓ (read-only) | — | — | — |
| PATIENT | P: own | — | P: own, mark-read only | — |

INSERT is service-role only — notifications are emitted by server-side events, never by clients.

#### `support_tickets`

| Role | S | I | U | D |
|---|---|---|---|---|
| SUPER_ADMIN | ✓ | — | ✓ | — |
| CLINIC_ADMIN | P: `member(row.clinic_id)` | P: same | P: same, status + notes | — |
| DOCTOR / RECEPTIONIST / PHOTOGRAPHER | P: `member(row.clinic_id)` AND opened by self OR assigned to self | P: same predicate | P: status + notes, on tickets assigned to self | — |
| SUPPORT | ✓ | P: any clinic | ✓ | — |
| PATIENT | P: opened by self | P: against own clinic | P: own, add comment only | — |

### 3.8 Operational & analytics

#### `audit_logs`

| Role | S | I | U | D |
|---|---|---|---|---|
| SUPER_ADMIN | ✓ | — | — | — |
| CLINIC_ADMIN | P: `member(row.clinic_id)`; only **non-platform** events | — | — | — |
| DOCTOR / RECEPTIONIST / PHOTOGRAPHER | — | — | — | — |
| SUPPORT | ✓ | — | — | — |
| PATIENT | — | — | — | — |

INSERT/UPDATE/DELETE are **forbidden** to every role including service_role (see §6.1 — only via the `append_audit(...)` SECURITY DEFINER function which whitelists the inserter).

#### `knowledge_base`

Platform-curated clinical knowledge (signal registry, kit catalog notes, ingredient mechanisms).

| Role | S | I | U | D |
|---|---|---|---|---|
| SUPER_ADMIN | ✓ | ✓ | ✓ | — |
| CLINIC_ADMIN | ✓ | — | — | — |
| DOCTOR | ✓ | — | — | — |
| RECEPTIONIST / PHOTOGRAPHER | P: published entries only | — | — | — |
| SUPPORT | ✓ | — | — | — |
| PATIENT | P: `entry.audience = PATIENT_FACING` | — | — | — |

#### `validation_metrics`

Output of the replay-corpus / validation engine.

| Role | S | I | U | D |
|---|---|---|---|---|
| SUPER_ADMIN | ✓ | — (service-role write) | — | — |
| CLINIC_ADMIN | P: aggregated, no per-case detail | — | — | — |
| DOCTOR | P: aggregated; per-case detail when `assessment.clinic_id` is theirs | — | — | — |
| RECEPTIONIST / PHOTOGRAPHER | — | — | — | — |
| SUPPORT | ✓ | — | — | — |
| PATIENT | — | — | — | — |

#### `analytics_snapshots`

Pre-computed dashboards.

| Role | S | I | U | D |
|---|---|---|---|---|
| SUPER_ADMIN | ✓ | — | — | — |
| CLINIC_ADMIN | P: `scope = CLINIC` AND `member(scope_id)` OR `scope = PLATFORM_PUBLIC` | — | — | — |
| DOCTOR / RECEPTIONIST / PHOTOGRAPHER | P: own-clinic + scope `CLINIC` | — | — | — |
| SUPPORT | ✓ | — | — | — |
| PATIENT | — | — | — | — |

### 3.9 service_role behavior

Per §7.6:
- `service_role` bypasses RLS on every table.
- The Next.js server connects via Prisma using the service key; therefore application code MUST call `requireRole(...)` / `requireClinicScope(...)` on every route handler — RLS is the second wall, not the only wall.
- Edge functions, scheduled jobs, and migrations also use `service_role`. They MUST emit `audit_logs` rows via `append_audit(...)` for any state-changing action.

---

## 4. DELIVERABLE 2 — Workflow Permission Matrix

Each action below is the unit of authorization at the API + workflow layer. Allowed roles, required state, required membership, and additional constraints are listed. Actions not in this matrix are denied by default.

### 4.1 Patient onboarding & assessment

| Action | Allowed Roles | Required state | Required membership | Additional constraints |
|---|---|---|---|---|
| Open clinic QR / public landing | anon | clinic `active`, not `SUSPENDED`/`ARCHIVED` | none | rate-limited per §7.10 |
| Create Assessment (anon QR onboarding) | anon (via server) | none | none | server validates clinic slug + emits assessment in `QUESTIONNAIRE_IN_PROGRESS` |
| Create Assessment (manual entry) | CLINIC_ADMIN, RECEPTIONIST | none | `member(clinic_id)` | — |
| Submit questionnaire responses | PATIENT (self) | assessment `QUESTIONNAIRE_IN_PROGRESS` | self | append-only |
| Upload Images | PATIENT (self via QR), PHOTOGRAPHER | assessment `IMAGES_REQUIRED` | self or `member(clinic_id)` | EXIF stripped, ≤25 MB, mime ∈ {jpeg, png} |
| Trigger AI Analysis | service_role (auto) on questionnaire complete | assessment `QUEUED_FOR_AI` | n/a | server-only |
| Re-trigger AI Analysis | CLINIC_ADMIN, DOCTOR | assessment `AI_FAILED` OR `AI_REPORT_READY` | `member(clinic_id)` | audit `AI_RETRIGGERED` |

### 4.2 Report

| Action | Allowed Roles | Required state | Required membership | Additional constraints |
|---|---|---|---|---|
| View AI Draft | CLINIC_ADMIN, DOCTOR | report `DRAFT` | `member(clinic_id)` | — |
| Edit Report (clinical content) | DOCTOR | report `DRAFT` OR `EDITS_REQUESTED` | `member(clinic_id)` | edits create a revision |
| Override AI Diagnosis | DOCTOR | report `DRAFT` | `member(clinic_id)` | MFA required (§7.12); audit `AI_OVERRIDE` |
| Approve Report | DOCTOR | report `DRAFT` | `member(clinic_id)` | audit `REPORT_APPROVED` |
| Request Edits | CLINIC_ADMIN, DOCTOR | report `DRAFT` | `member(clinic_id)` | sets `EDITS_REQUESTED`, returns to author |
| Publish to Patient | DOCTOR, CLINIC_ADMIN | report `APPROVED` | `member(clinic_id)` | triggers patient notification per §6.3 |
| Reopen Published Report | CLINIC_ADMIN | report `PUBLISHED_TO_PATIENT` | `member(clinic_id)` | creates revision, audit `REPORT_REOPENED` |
| Export Report PDF | DOCTOR, CLINIC_ADMIN, PATIENT (self) | report `APPROVED` (clinician) or `PUBLISHED_TO_PATIENT` (patient) | role-appropriate | signed URL, watermarked when patient |

### 4.3 Video

| Action | Allowed Roles | Required state | Required membership | Additional constraints |
|---|---|---|---|---|
| Generate Video | DOCTOR, CLINIC_ADMIN | report `APPROVED` AND video absent | `member(clinic_id)` | calls HeyGen via server; webhook updates state |
| Edit Video Script | DOCTOR | video `SCRIPT_DRAFT` | `member(clinic_id)` | edits create new draft, supersedes previous |
| Approve Video Script | DOCTOR | video `SCRIPT_READY_FOR_REVIEW` | `member(clinic_id)` | audit `VIDEO_SCRIPT_APPROVED` |
| Render Video | service_role (on script approval) | video `SCRIPT_APPROVED` | n/a | — |
| Publish Video to Patient | DOCTOR, CLINIC_ADMIN | video `RENDERED` | `member(clinic_id)` | triggers patient notification |
| View Published Video | PATIENT (self) | video `PUBLISHED` | self | — |

### 4.4 Treatment & order

| Action | Allowed Roles | Required state | Required membership | Additional constraints |
|---|---|---|---|---|
| Create Treatment | DOCTOR | report `APPROVED` | `member(clinic_id)` | references the approved report |
| Approve Treatment | DOCTOR | treatment `DRAFT` | `member(clinic_id)` | MFA required; audit `TREATMENT_APPROVED` |
| Revise Approved Treatment | DOCTOR | treatment `APPROVED` AND no `DISPATCHED` order | `member(clinic_id)` | creates new revision row |
| Create Order | RECEPTIONIST, CLINIC_ADMIN | treatment `APPROVED` | `member(clinic_id)` | order opens in `PENDING` |
| Reserve Inventory | RECEPTIONIST, CLINIC_ADMIN | order `PENDING` AND inventory sufficient | `member(clinic_id)` | atomic; inventory row UPDATE qty − reserved |
| Dispense Treatment | RECEPTIONIST, CLINIC_ADMIN | order `RESERVED` | `member(clinic_id)` | decrement inventory qty; audit `TREATMENT_DISPENSED` |
| Cancel Order | RECEPTIONIST, CLINIC_ADMIN | order `PENDING` OR `RESERVED` | `member(clinic_id)` | releases reserved qty |
| Refill Order (auto) | service_role | followup matched + last order ≥ 80% consumed | n/a | emits notification to patient + receptionist |

### 4.5 Scheduling

| Action | Allowed Roles | Required state | Required membership | Additional constraints |
|---|---|---|---|---|
| Schedule Appointment | RECEPTIONIST, CLINIC_ADMIN, DOCTOR | none | `member(clinic_id)` | conflict check on doctor + room |
| Schedule Follow-up | DOCTOR, RECEPTIONIST | treatment `APPROVED` | `member(clinic_id)` | — |
| Reschedule Own Appointment | PATIENT | appointment `SCHEDULED` AND > 24h from start | self | rate-limited 3/day |
| Cancel Appointment | RECEPTIONIST, CLINIC_ADMIN, PATIENT (self) | appointment `SCHEDULED` | role-appropriate | — |
| Confirm Patient Arrival | RECEPTIONIST | appointment `SCHEDULED` AND today | `member(clinic_id)` | flips `CHECKED_IN` |

### 4.6 Platform & administration

| Action | Allowed Roles | Required state | Required membership | Additional constraints |
|---|---|---|---|---|
| Create Organization | SUPER_ADMIN | none | platform | MFA; audit `ORG_CREATED` |
| Create Clinic | SUPER_ADMIN | none | platform OR org-super-admin | — |
| Suspend Clinic | SUPER_ADMIN | clinic `ACTIVE` | platform OR org-super-admin | MFA; audit `CLINIC_SUSPENDED` |
| Archive Clinic | SUPER_ADMIN | clinic `SUSPENDED` ≥ 30 days | platform | MFA; audit `CLINIC_ARCHIVED` |
| Invite Staff (DOCTOR/RECEPTIONIST/PHOTOGRAPHER) | CLINIC_ADMIN, SUPER_ADMIN | clinic `ACTIVE` | `member(clinic_id)` for CLINIC_ADMIN | rate-limited per §7.10 |
| Invite CLINIC_ADMIN | SUPER_ADMIN | clinic `ACTIVE` | platform OR org-super-admin | — |
| Promote to SUPER_ADMIN | SUPER_ADMIN (platform) | n/a | platform | MFA; audit `ROLE_PROMOTION` |
| Revoke Invitation | inviter's role OR superset | invitation `PENDING` | inviter's scope | — |
| Manage Treatment Catalog | SUPER_ADMIN | n/a | platform | audit `CATALOG_CHANGED` |
| Manage Knowledge Base | SUPER_ADMIN | n/a | platform | audit `KB_CHANGED` |
| View Validation Analytics | SUPER_ADMIN, SUPPORT, CLINIC_ADMIN (aggregated), DOCTOR (own clinic) | n/a | role-appropriate | — |
| View Audit Logs | SUPER_ADMIN, SUPPORT, CLINIC_ADMIN (own clinic, non-platform events) | n/a | role-appropriate | — |
| Bulk Export Patient Data | CLINIC_ADMIN | n/a | `member(clinic_id)` | MFA; audit `BULK_EXPORT`; rate-limited 1/day |
| Hard Delete (GDPR) | service_role only | n/a | n/a | invoked via documented runbook |

---

## 5. DELIVERABLE 3 — State-Based Authorization

State machines describe lifecycle for each entity. Transitions are the **only** legal state changes; any other UPDATE is denied (enforced by triggers + API validation).

### 5.1 `assessments`

States: `QUESTIONNAIRE_IN_PROGRESS` → `IMAGES_REQUIRED` → `QUEUED_FOR_AI` → `AI_REPORT_READY` → (terminal via report lifecycle) | `AI_FAILED` (recoverable) | `CANCELLED` (terminal)

| State | Allowed actions | Forbidden actions | Performed by |
|---|---|---|---|
| `QUESTIONNAIRE_IN_PROGRESS` | Edit responses, Cancel | Trigger AI, Upload images (until questionnaire requires) | PATIENT (responses), RECEPTIONIST/CLINIC_ADMIN (cancel) |
| `IMAGES_REQUIRED` | Upload Images, Cancel | Edit responses (locked) | PATIENT, PHOTOGRAPHER, RECEPTIONIST/CLINIC_ADMIN |
| `QUEUED_FOR_AI` | (none — passive wait) | All user actions | service_role advances |
| `AI_REPORT_READY` | Create/view report, Re-trigger AI | Cancel | DOCTOR/CLINIC_ADMIN |
| `AI_FAILED` | Re-trigger AI, Cancel | Create report | DOCTOR/CLINIC_ADMIN |
| `CANCELLED` (terminal) | (read-only) | All | — |

Revision rule: a `CANCELLED` assessment cannot be revived; a new assessment must be created. Audit `ASSESSMENT_CANCELLED` is mandatory on terminal entry.

### 5.2 `reports`

States: `DRAFT` ↔ `EDITS_REQUESTED` → `APPROVED` → `PUBLISHED_TO_PATIENT` (terminal-ish; reopenable into a new revision) | `REJECTED` (terminal)

| State | Allowed actions | Forbidden actions | Performed by |
|---|---|---|---|
| `DRAFT` | Edit, Approve, Request edits, Override AI, Reject | Publish to patient | DOCTOR (edit, approve, reject, override), CLINIC_ADMIN (request edits, reject) |
| `EDITS_REQUESTED` | Edit (returns to `DRAFT`), Reject | Approve, Publish | DOCTOR |
| `APPROVED` | Publish to patient, Generate video, Create treatment, Reopen (creates new revision) | Edit clinical content | DOCTOR, CLINIC_ADMIN |
| `PUBLISHED_TO_PATIENT` | View, Export, Reopen | Edit | DOCTOR/CLINIC_ADMIN (reopen), PATIENT (view, export) |
| `REJECTED` (terminal) | (read-only) | All edits | — |

Revision rule: editing an `APPROVED` or `PUBLISHED` report creates a new report revision row with `parent_report_id = previous.id`. Older revisions remain in `audit_logs` but become read-only.

### 5.3 `treatments`

States: `DRAFT` → `APPROVED` → `DISPATCHED` (via order) → `IN_USE` → `COMPLETED` (terminal) | `SUPERSEDED` (terminal — replaced by revision) | `CANCELLED` (terminal)

| State | Allowed actions | Forbidden actions | Performed by |
|---|---|---|---|
| `DRAFT` | Edit, Approve, Cancel | Create order | DOCTOR |
| `APPROVED` | Create order, Revise (→ SUPERSEDED on revision approval) | Edit clinical content directly | DOCTOR (revise), RECEPTIONIST/CLINIC_ADMIN (create order) |
| `DISPATCHED` | Mark in-use (auto when patient confirms first refill) | Edit, Cancel | service_role / patient confirmation |
| `IN_USE` | Schedule follow-up, Mark complete, Mark adverse | Edit, Cancel | DOCTOR |
| `COMPLETED` (terminal) | (read-only) | All edits | — |
| `SUPERSEDED` (terminal) | (read-only, pointer to next revision) | All | — |
| `CANCELLED` (terminal) | (read-only) | All | — |

### 5.4 `orders`

States: `PENDING` → `RESERVED` → `DISPATCHED` → `COMPLETED` (terminal) | `CANCELLED` (terminal — from PENDING/RESERVED)

| State | Allowed actions | Forbidden actions | Performed by |
|---|---|---|---|
| `PENDING` | Reserve inventory, Cancel, Edit qty | Dispense | RECEPTIONIST, CLINIC_ADMIN |
| `RESERVED` | Dispense, Cancel (releases qty) | Edit qty | RECEPTIONIST, CLINIC_ADMIN |
| `DISPATCHED` | Mark complete on patient confirmation, Issue refill | Edit, Cancel | service_role, RECEPTIONIST |
| `COMPLETED` (terminal) | (read-only) | All | — |
| `CANCELLED` (terminal) | (read-only) | All | — |

### 5.5 `videos`

States: `SCRIPT_DRAFT` → `SCRIPT_READY_FOR_REVIEW` → `SCRIPT_APPROVED` → `RENDERING` → `RENDERED` → `PUBLISHED` (terminal) | `RENDER_FAILED` (recoverable) | `REJECTED` (terminal)

| State | Allowed actions | Forbidden actions | Performed by |
|---|---|---|---|
| `SCRIPT_DRAFT` | Edit script, Submit for review, Reject | Render, Publish | DOCTOR |
| `SCRIPT_READY_FOR_REVIEW` | Approve, Request edits (→ DRAFT) | Render directly | DOCTOR |
| `SCRIPT_APPROVED` | (passive; server submits to HeyGen) | All user edits | service_role |
| `RENDERING` | (passive) | All | service_role / HeyGen webhook advances |
| `RENDERED` | Publish to patient, Reject (→ REJECTED) | Edit | DOCTOR, CLINIC_ADMIN |
| `RENDER_FAILED` | Regenerate, Reject | Publish | DOCTOR |
| `PUBLISHED` (terminal) | View, Withdraw (→ creates new revision starting at SCRIPT_DRAFT) | Edit existing | PATIENT (view), DOCTOR (withdraw) |
| `REJECTED` (terminal) | (read-only) | All | — |

### 5.6 `appointments`

States: `SCHEDULED` → `CHECKED_IN` → `COMPLETED` (terminal) | `NO_SHOW` (terminal) | `CANCELLED` (terminal) | `RESCHEDULED` (terminal, links to new appointment)

| State | Allowed actions | Forbidden actions | Performed by |
|---|---|---|---|
| `SCHEDULED` | Reschedule (creates new), Cancel, Check in (day-of) | Complete | RECEPTIONIST, CLINIC_ADMIN, DOCTOR, PATIENT (own reschedule/cancel) |
| `CHECKED_IN` | Mark complete, Mark no-show after timeout | Cancel | DOCTOR, RECEPTIONIST |
| `COMPLETED` (terminal) | View notes | Edit | — |
| `NO_SHOW` (terminal) | View | Edit | — |
| `CANCELLED` (terminal) | View | Edit | — |
| `RESCHEDULED` (terminal) | View, follow link to successor | Edit | — |

### 5.7 `support_tickets`

States: `OPEN` → `IN_PROGRESS` → `WAITING_ON_CUSTOMER` ↔ `IN_PROGRESS` → `RESOLVED` → `CLOSED` (terminal) | `REOPENED` (transient → IN_PROGRESS)

| State | Allowed actions | Forbidden actions | Performed by |
|---|---|---|---|
| `OPEN` | Assign, Comment, Triage | Resolve | SUPPORT, CLINIC_ADMIN |
| `IN_PROGRESS` | Comment, Move to waiting, Resolve | Reassign across orgs (SUPER_ADMIN only) | assigned staff |
| `WAITING_ON_CUSTOMER` | Comment, Resume | Resolve | patient (comment), staff (resume) |
| `RESOLVED` | Reopen (within 7 days), Close | Comment after close | requester (reopen), SUPPORT (close) |
| `CLOSED` (terminal) | View | All edits | — |
| `REOPENED` (transient) | (auto-advances to IN_PROGRESS) | — | — |

### 5.8 `notifications`

States: `QUEUED` → `SENT` → `DELIVERED` (terminal) | `READ` (terminal, optional) | `FAILED` (terminal-ish, retried up to 3x)

| State | Allowed actions | Forbidden actions | Performed by |
|---|---|---|---|
| `QUEUED` | (passive) | All user actions | service_role dispatches |
| `SENT` | Mark delivered (via provider webhook), Cancel | — | service_role |
| `DELIVERED` | Mark read | — | recipient |
| `READ` (terminal) | (no further action) | — | — |
| `FAILED` | Retry (max 3), Suppress | — | service_role |

Notifications are not user-creatable; they are emitted by lifecycle transitions enumerated in §6.3.

---

## 6. DELIVERABLE 6 — Audit Authorization

### 6.1 Immutability

- `audit_logs` is **append-only** at the platform level.
- No application role (including `SUPER_ADMIN`) may UPDATE or DELETE `audit_logs` rows.
- INSERT is permitted **only** via the `append_audit(...)` SECURITY DEFINER function, which itself rejects any caller other than `service_role`. Application routes call a thin server helper; clients have no path to insert.
- Hard deletion of `audit_logs` is forbidden even to `service_role` in normal operation. The only legal removal is via the data-retention sweeper that exports rows older than the retention window (configurable per event class) to cold storage, then runs a single audited TRUNCATE under a multi-person approval runbook.

### 6.2 Mandatory event classes

Every event below MUST emit exactly one `audit_logs` row. Failure to emit is a release-blocking bug.

| Event class | Trigger | Mandatory fields | Retention |
|---|---|---|---|
| **AUTH_SIGNIN** | Successful Supabase login | actor_id, method (password/magic/otp), ip, ua | 1 year |
| **AUTH_SIGNIN_FAILED** | 3 consecutive failed attempts | candidate_email/phone, ip, ua | 1 year |
| **AUTH_MFA_CHALLENGE** | MFA prompt issued/completed | actor_id, factor_type, result | 1 year |
| **ROLE_PROMOTION** | clinic_members.role change | actor_id, target_user_id, prev_role, new_role | indefinite |
| **CLINIC_SUSPENDED** / **CLINIC_ARCHIVED** | clinic status change | actor_id, clinic_id, prev_status, reason | indefinite |
| **PATIENT_ACCESS** | Any read of a patient PII column outside a same-clinic membership context | actor_id, patient_id, fields, reason | 7 years (regulatory) |
| **MEDICAL_RECORD_READ** | Any read of `assessments`, `reports`, `treatments` by a clinician | actor_id, assessment_id, role, clinic_id | 7 years |
| **MEDICAL_RECORD_EXPORT** | PDF export of report or any bulk patient export | actor_id, patient_id(s), report_id, format, recipient | 7 years |
| **REPORT_APPROVED** / **REPORT_REOPENED** / **REPORT_REJECTED** | state transition | actor_id, report_id, version, prev_state | 7 years |
| **AI_OVERRIDE** | Clinician changes any AI-asserted field | actor_id, report_id, field, ai_value, override_value, reason | 7 years |
| **TREATMENT_APPROVED** / **TREATMENT_DISPENSED** | state transition | actor_id, treatment_id, patient_id, products[] | 7 years |
| **INVENTORY_ADJUSTMENT** | Manual inventory edit (not dispense-driven) | actor_id, clinic_id, product_id, delta, reason | 3 years |
| **VIDEO_GENERATED** / **VIDEO_PUBLISHED** | state transition | actor_id, video_id, script_version | 3 years |
| **INVITATION_CREATED** / **INVITATION_ACCEPTED** / **INVITATION_REVOKED** | lifecycle | actor_id, invitation_id, channel, role, scope | 1 year |
| **HARD_DELETE** | Any service_role DELETE | actor_id (runbook signer), entity, entity_id, justification | indefinite |
| **BULK_EXPORT** | Any export ≥ 50 rows | actor_id, query_hash, row_count, filter | 7 years |
| **CONFIG_CHANGE** | Knowledge base, treatment catalog, RLS policy edits | actor_id, entity, diff_hash | indefinite |
| **WEBHOOK_RECEIVED** | Every inbound webhook | source, nonce, payload_hash, signature_ok | 90 days |
| **SUSPICIOUS_RATE** | Rate-limit breach beyond grace | actor_id (or ip), endpoint, count | 1 year |

### 6.3 Sensitive event escalation

The following events additionally emit a `notifications` row to the platform `SUPER_ADMIN` group:
- `ROLE_PROMOTION` to `SUPER_ADMIN`
- `CLINIC_SUSPENDED`, `CLINIC_ARCHIVED`
- `HARD_DELETE`
- `BULK_EXPORT` with row_count ≥ 500
- `AUTH_SIGNIN_FAILED` ≥ 3 in 10 minutes for the same actor

### 6.4 Audit chain integrity

- Each `audit_logs` row includes `prev_hash` = sha256 of the previous row's canonical serialization, forming a hash chain per partition (per day or per clinic).
- A daily job computes the head hash and persists it to an append-only ledger (Supabase Vault or external WORM bucket). Any tampering is detectable.

---

## 7. DELIVERABLE 4 — API Authorization Matrix

Authentication is **required** on every endpoint below unless explicitly noted as `anon`. Failure response defaults to: `401 unauthorized` (no session), `403 forbidden` (session but wrong role/scope), `404 not_found` (scope mismatch on an existing-but-invisible row — to avoid information leakage), `409 invalid_state` (state machine violation), `412 mfa_required` (step-up needed), `429 rate_limited`.

### 7.1 Public & onboarding

| Endpoint | Allowed Roles | Auth | Authorization rule | Ownership / clinic rule | Audit event | Default failure |
|---|---|---|---|---|---|---|
| `GET /q/[clinicSlug]` | anon | no | clinic.is_active AND status ∈ (ACTIVE) | — | none | 404 |
| `POST /api/assessment/start` | anon | no | clinic slug valid + rate-limit | — | none | 429 / 404 |
| `POST /api/assessment/submit` (responses) | anon (via session token) AND PATIENT (signed-in) | mixed | assessment session token OR `auth.uid() = patient` | — | none (lifecycle event) | 401/403 |
| `GET /api/clinics/[slug]` (public profile) | anon | no | column-filtered to public fields | — | none | 404 |

### 7.2 Doctor workspace

| Endpoint | Allowed Roles | Auth | Authorization rule | Ownership / clinic rule | Audit event | Default failure |
|---|---|---|---|---|---|---|
| `GET /api/doctor/queue` | DOCTOR, CLINIC_ADMIN | yes | role-and-clinic | `member(clinic_id)` | none | 403 |
| `GET /api/doctor/patients` | DOCTOR, CLINIC_ADMIN | yes | role-and-clinic; doctor shared-queue per `clinic.privacy_mode` | `member(clinic_id)` + assignment when ASSIGNED_ONLY | `PATIENT_ACCESS` on bulk | 403 |
| `GET /api/doctor/reports/[id]` | DOCTOR, CLINIC_ADMIN | yes | role-and-clinic | row.clinic_id = jwt.clinic_id | `MEDICAL_RECORD_READ` | 404 |
| `POST /api/doctor/reports/[id]/edit` | DOCTOR | yes | state ∈ (DRAFT, EDITS_REQUESTED) | row.clinic_id = jwt.clinic_id | none (lifecycle events handle) | 409 |
| `POST /api/doctor/reports/[id]/approve` | DOCTOR | yes | state = DRAFT; MFA | row.clinic_id = jwt.clinic_id | `REPORT_APPROVED` | 412 |
| `POST /api/doctor/reports/[id]/reject` | DOCTOR | yes | state ∈ (DRAFT, EDITS_REQUESTED) | row.clinic_id = jwt.clinic_id | `REPORT_REJECTED` | 409 |
| `POST /api/doctor/reports/[id]/override-ai` | DOCTOR | yes | state = DRAFT; MFA | row.clinic_id = jwt.clinic_id | `AI_OVERRIDE` | 412 |
| `POST /api/doctor/reports/[id]/publish` | DOCTOR, CLINIC_ADMIN | yes | state = APPROVED | row.clinic_id = jwt.clinic_id | `REPORT_APPROVED` | 409 |
| `GET /api/doctor/reports/[id]/pdf` | DOCTOR, CLINIC_ADMIN | yes | role-and-clinic | row.clinic_id = jwt.clinic_id | `MEDICAL_RECORD_EXPORT` | 403 |
| `POST /api/doctor/videos/[id]/script-approve` | DOCTOR | yes | state = SCRIPT_READY_FOR_REVIEW | row.clinic_id = jwt.clinic_id | `VIDEO_SCRIPT_APPROVED` | 409 |
| `POST /api/doctor/videos/[id]/publish` | DOCTOR, CLINIC_ADMIN | yes | state = RENDERED | row.clinic_id = jwt.clinic_id | `VIDEO_PUBLISHED` | 409 |
| `POST /api/doctor/treatments` | DOCTOR | yes | report.status = APPROVED | row.clinic_id = jwt.clinic_id | none | 409 |
| `POST /api/doctor/treatments/[id]/approve` | DOCTOR | yes | state = DRAFT; MFA | row.clinic_id = jwt.clinic_id | `TREATMENT_APPROVED` | 412 |

### 7.3 Clinic admin

| Endpoint | Allowed Roles | Auth | Authorization rule | Ownership / clinic rule | Audit event | Default failure |
|---|---|---|---|---|---|---|
| `POST /api/admin/invitations` | CLINIC_ADMIN, SUPER_ADMIN | yes | role of invitee allowed per §4.6 | invitee in `member(clinic_id)` scope | `INVITATION_CREATED` | 403 |
| `GET /api/admin/invitations` | CLINIC_ADMIN, SUPER_ADMIN | yes | scope-filter | per inviter scope | none | 403 |
| `DELETE /api/admin/invitations/[id]` | inviter scope | yes | invitation.status = PENDING | scope match | `INVITATION_REVOKED` | 403/409 |
| `POST /api/admin/clinic-members/[id]/role` | CLINIC_ADMIN, SUPER_ADMIN | yes | target role allowed; CLINIC_ADMIN cannot promote to SUPER_ADMIN | row.clinic_id = jwt.clinic_id | `ROLE_PROMOTION` | 403 |
| `POST /api/admin/clinic-members/[id]/deactivate` | CLINIC_ADMIN, SUPER_ADMIN | yes | not self | row.clinic_id = jwt.clinic_id | `ROLE_PROMOTION` (with delta) | 403 |
| `GET /api/admin/audit-logs` | CLINIC_ADMIN, SUPER_ADMIN, SUPPORT | yes | scope-filter | clinic-scoped for CLINIC_ADMIN | none | 403 |
| `POST /api/admin/bulk-export` | CLINIC_ADMIN | yes | MFA; daily quota | clinic-scoped | `BULK_EXPORT` | 412/429 |

### 7.4 Reception / scheduling

| Endpoint | Allowed Roles | Auth | Authorization rule | Ownership / clinic rule | Audit event | Default failure |
|---|---|---|---|---|---|---|
| `POST /api/reception/assessments` (manual create) | RECEPTIONIST, CLINIC_ADMIN | yes | clinic active | `member(clinic_id)` | none | 403 |
| `POST /api/reception/appointments` | RECEPTIONIST, CLINIC_ADMIN, DOCTOR | yes | conflict check | `member(clinic_id)` | none | 409 |
| `POST /api/reception/appointments/[id]/checkin` | RECEPTIONIST | yes | state = SCHEDULED AND today | `member(clinic_id)` | none | 409 |
| `POST /api/reception/orders` | RECEPTIONIST, CLINIC_ADMIN | yes | treatment.status = APPROVED | `member(clinic_id)` | none | 409 |
| `POST /api/reception/orders/[id]/reserve` | RECEPTIONIST, CLINIC_ADMIN | yes | state = PENDING AND inventory ok | `member(clinic_id)` | none | 409 |
| `POST /api/reception/orders/[id]/dispense` | RECEPTIONIST, CLINIC_ADMIN | yes | state = RESERVED | `member(clinic_id)` | `TREATMENT_DISPENSED` | 409 |

### 7.5 Photographer

| Endpoint | Allowed Roles | Auth | Authorization rule | Ownership / clinic rule | Audit event | Default failure |
|---|---|---|---|---|---|---|
| `GET /api/photo/queue` | PHOTOGRAPHER | yes | assessments in IMAGES_REQUIRED | `member(clinic_id)` | none | 403 |
| `POST /api/photo/upload` | PHOTOGRAPHER | yes | assessment state = IMAGES_REQUIRED | `member(clinic_id)` | none | 409 |

### 7.6 Patient portal

| Endpoint | Allowed Roles | Auth | Authorization rule | Ownership / clinic rule | Audit event | Default failure |
|---|---|---|---|---|---|---|
| `GET /api/me/assessments` | PATIENT | yes | own | self | none | 401 |
| `GET /api/me/reports/[id]` | PATIENT | yes | report.status = PUBLISHED AND own | self | none | 404 |
| `GET /api/me/reports/[id]/pdf` | PATIENT | yes | report.status = PUBLISHED AND own | self | `MEDICAL_RECORD_EXPORT` | 404 |
| `GET /api/me/videos/[id]` | PATIENT | yes | video.status = PUBLISHED AND own | self | none | 404 |
| `GET /api/me/orders` | PATIENT | yes | own | self | none | 401 |
| `POST /api/me/appointments/reschedule` | PATIENT | yes | > 24h before; rate-limit | self | none | 409/429 |

### 7.7 Support

| Endpoint | Allowed Roles | Auth | Authorization rule | Ownership / clinic rule | Audit event | Default failure |
|---|---|---|---|---|---|---|
| `GET /api/support/tickets` | SUPPORT, CLINIC_ADMIN | yes | scope filter | per role | none | 403 |
| `POST /api/support/tickets/[id]/assign` | SUPPORT | yes | assignee.role permits | — | none | 403 |
| `POST /api/support/tickets/[id]/access-patient` | SUPPORT | yes | open ticket linked; MFA | linked clinic only | `PATIENT_ACCESS` | 412 |

### 7.8 SUPER_ADMIN platform

| Endpoint | Allowed Roles | Auth | Authorization rule | Ownership / clinic rule | Audit event | Default failure |
|---|---|---|---|---|---|---|
| `POST /api/platform/organizations` | SUPER_ADMIN | yes | MFA | — | `ORG_CREATED` | 412 |
| `POST /api/platform/clinics` | SUPER_ADMIN | yes | MFA | — | none (clinic create) | 412 |
| `POST /api/platform/clinics/[id]/suspend` | SUPER_ADMIN | yes | MFA | — | `CLINIC_SUSPENDED` | 412 |
| `POST /api/platform/clinics/[id]/archive` | SUPER_ADMIN | yes | clinic suspended ≥ 30 days; MFA | — | `CLINIC_ARCHIVED` | 412 |
| `POST /api/platform/users/[id]/promote-super-admin` | SUPER_ADMIN | yes | MFA | — | `ROLE_PROMOTION` | 412 |
| `GET /api/platform/validation-metrics` | SUPER_ADMIN, SUPPORT | yes | — | — | none | 403 |
| `POST /api/platform/treatment-catalog` | SUPER_ADMIN | yes | MFA | — | `CONFIG_CHANGE` | 412 |
| `POST /api/platform/knowledge-base` | SUPER_ADMIN | yes | MFA | — | `CONFIG_CHANGE` | 412 |

### 7.9 Webhooks

| Endpoint | Allowed Roles | Auth | Authorization rule | Ownership / clinic rule | Audit event | Default failure |
|---|---|---|---|---|---|---|
| `POST /api/webhooks/whatsapp` | provider | HMAC | sig verify + nonce check | — | `WEBHOOK_RECEIVED` | 401/409 |
| `POST /api/webhooks/heygen` | provider | HMAC | sig verify + nonce check | — | `WEBHOOK_RECEIVED` | 401/409 |
| `POST /api/webhooks/payments` | provider | HMAC | sig verify + nonce check | — | `WEBHOOK_RECEIVED` | 401/409 |

---

## 8. DELIVERABLE 5 — UI Visibility Matrix

UI visibility is the **third** wall (after RLS and API). It exists for UX, not security; never rely on it for confidentiality.

### 8.1 Doctor Workspace (`/doctor/*`)

| Component | Visible roles | Hidden / disabled | Conditional |
|---|---|---|---|
| Top navigation | DOCTOR, CLINIC_ADMIN | RECEPTIONIST, PHOTOGRAPHER, PATIENT | — |
| Clinical Queue card | DOCTOR, CLINIC_ADMIN | others | empty when no assessments in `AI_REPORT_READY` |
| Patient Registry | DOCTOR, CLINIC_ADMIN | others | shared-queue or ASSIGNED_ONLY per clinic policy |
| Assessment Review pane | DOCTOR, CLINIC_ADMIN | others | only visible after `AI_REPORT_READY` |
| Approve / Reject / Edit buttons | DOCTOR | CLINIC_ADMIN sees disabled with tooltip | per state machine |
| Override AI button | DOCTOR | others | requires MFA-step-up modal |
| Treatment Builder | DOCTOR | others | only after report approved |
| Validation widgets (clinic-level) | DOCTOR, CLINIC_ADMIN | RECEPTIONIST/PHOTOGRAPHER | — |

### 8.2 Clinic Dashboard (`/clinic/*`)

| Component | Visible roles | Hidden / disabled | Conditional |
|---|---|---|---|
| Staff Management | CLINIC_ADMIN, SUPER_ADMIN | others | invite buttons hidden for non-admins |
| Inventory | CLINIC_ADMIN, RECEPTIONIST | DOCTOR sees read-only | qty-adjust requires CLINIC_ADMIN |
| Scheduling | CLINIC_ADMIN, RECEPTIONIST, DOCTOR | PHOTOGRAPHER sees own photo-capture slots only | — |
| Waiting Queue | CLINIC_ADMIN, RECEPTIONIST, DOCTOR | PHOTOGRAPHER | — |
| Audit Log viewer | CLINIC_ADMIN, SUPPORT | DOCTOR/RECEPTIONIST/PHOTOGRAPHER | excludes platform events |

### 8.3 Super Admin Dashboard (`/super/*`)

| Component | Visible roles | Hidden / disabled | Conditional |
|---|---|---|---|
| Organization & Clinic management | SUPER_ADMIN | all others | suspend/archive require MFA modal |
| Treatment Catalog editor | SUPER_ADMIN | all others | — |
| Knowledge Base editor | SUPER_ADMIN | all others | — |
| Validation Dashboard (platform) | SUPER_ADMIN, SUPPORT | all others | — |
| Platform Audit Viewer | SUPER_ADMIN, SUPPORT | all others | filter by event class + scope |

### 8.4 Patient Portal (`/me/*`)

| Component | Visible roles | Hidden / disabled | Conditional |
|---|---|---|---|
| Assessment Timeline | PATIENT (self) | all others | — |
| Reports list | PATIENT (self) | — | only `PUBLISHED_TO_PATIENT` rows appear |
| Treatment Plan | PATIENT (self) | — | only `DISPATCHED` and later |
| Progress Tracking | PATIENT (self) | — | requires first follow-up entry |
| Follow-ups inbox | PATIENT (self) | — | — |
| Order history | PATIENT (self) | — | — |

### 8.5 Treatment Ordering (`/orders/*`)

| Component | Visible roles | Hidden / disabled | Conditional |
|---|---|---|---|
| Create Order | RECEPTIONIST, CLINIC_ADMIN | DOCTOR sees read-only review of order draft | only when an APPROVED treatment exists |
| Reserve / Dispense buttons | RECEPTIONIST, CLINIC_ADMIN | DOCTOR | per state machine |
| Inventory levels | RECEPTIONIST, CLINIC_ADMIN | DOCTOR sees read-only | — |

### 8.6 Validation Dashboard (`/validation/*`)

| Component | Visible roles | Hidden / disabled | Conditional |
|---|---|---|---|
| Platform-level KPIs | SUPER_ADMIN, SUPPORT | others | — |
| Clinic-level KPIs | SUPER_ADMIN, SUPPORT, CLINIC_ADMIN | DOCTOR sees own clinic only | — |
| Failure registry per case | SUPER_ADMIN, SUPPORT | CLINIC_ADMIN sees own-clinic cases only | — |

### 8.7 Inventory (`/inventory`)

| Component | Visible roles | Hidden / disabled | Conditional |
|---|---|---|---|
| Stock levels | CLINIC_ADMIN, RECEPTIONIST, SUPPORT, DOCTOR (read-only) | PHOTOGRAPHER, PATIENT | clinic-scoped |
| Adjust stock | CLINIC_ADMIN | RECEPTIONIST disabled | requires reason |

### 8.8 Knowledge Base (`/kb/*`)

| Component | Visible roles | Hidden / disabled | Conditional |
|---|---|---|---|
| Read articles | DOCTOR, CLINIC_ADMIN, SUPPORT | RECEPTIONIST, PHOTOGRAPHER see published only; PATIENT sees PATIENT_FACING only | — |
| Edit articles | SUPER_ADMIN | all others | — |

### 8.9 Audit Viewer (`/audit`)

| Component | Visible roles | Hidden / disabled | Conditional |
|---|---|---|---|
| Search filters (event class, actor, scope) | SUPER_ADMIN, SUPPORT, CLINIC_ADMIN | DOCTOR/RECEPTIONIST/PHOTOGRAPHER | CLINIC_ADMIN sees own clinic only |
| Export to CSV | SUPER_ADMIN, SUPPORT | CLINIC_ADMIN disabled | counts as `BULK_EXPORT` for >50 rows |

### 8.10 Support Console (`/support/*`)

| Component | Visible roles | Hidden / disabled | Conditional |
|---|---|---|---|
| Ticket queue | SUPPORT, CLINIC_ADMIN | others | CLINIC_ADMIN sees own clinic only |
| Access Patient (linked) | SUPPORT | CLINIC_ADMIN sees only clinic patients | requires MFA + emits `PATIENT_ACCESS` |
| Suspend / Refund actions | SUPPORT | none | requires MFA |

### 8.11 Navigation access rules

| Top-level nav item | Visible roles |
|---|---|
| `/doctor` | DOCTOR, CLINIC_ADMIN |
| `/clinic` | CLINIC_ADMIN, RECEPTIONIST, DOCTOR (read-mostly) |
| `/reception` | RECEPTIONIST, CLINIC_ADMIN |
| `/photo` | PHOTOGRAPHER |
| `/super` | SUPER_ADMIN |
| `/support` | SUPPORT, CLINIC_ADMIN (tickets only) |
| `/me` | PATIENT |
| `/kb` | all signed-in roles |
| `/audit` | SUPER_ADMIN, SUPPORT, CLINIC_ADMIN |

---

## 9. Implementation prerequisites (non-blocking, called out for the build phase)

These are not part of the spec contract; they are the concrete tasks the implementation phase will discharge **before** writing the first RLS policy.

1. **Role enum reconciliation:** add `RECEPTIONIST | PHOTOGRAPHER | SUPPORT`; map existing `STAFF` to `RECEPTIONIST` (default) with a CSV review by a CLINIC_ADMIN; retire `ORG_ADMIN` by promoting existing rows to `SUPER_ADMIN` of the same org.
2. **JWT hook expansion:** emit `memberships[]`, `mfa_level`, `session_id`, and the multi-clinic selector logic (§1.2–1.5).
3. **`append_audit(...)` SECURITY DEFINER function:** the single insert path for `audit_logs`.
4. **`webhook_replay_guard` table:** per §7.9.
5. **`v_clinic_public` view OR a server-side public-clinic endpoint:** to back the anonymous landing surface without exposing raw `clinics` columns.
6. **Storage bucket flip:** `clinical-reports` from public to private; switch patient reads to signed URLs.
7. **MFA factor configuration:** enable Supabase Auth MFA (TOTP + recovery codes) and surface `mfa_level` to the hook.
8. **Policy seed kit:** test users for all 7 application roles, plus an automated smoke suite that asserts the 49 most consequential matrix cells (one per row × representative operation).

---

## 10. Approval

| Section | Approver | Sign-off |
|---|---|---|
| Roles & Identity (§1) | Product Lead | ☐ |
| Cross-cutting Security Rules (§2) | Security Lead | ☐ |
| RLS Access Matrix (§3) | Engineering Lead | ☐ |
| Workflow Permission Matrix (§4) | Clinical Lead | ☐ |
| State Machines (§5) | Engineering Lead | ☐ |
| Audit Authorization (§6) | Compliance Lead | ☐ |
| API Authorization Matrix (§7) | Engineering Lead | ☐ |
| UI Visibility Matrix (§8) | Design Lead | ☐ |

On full sign-off this document is **frozen**; subsequent changes require a versioned amendment.

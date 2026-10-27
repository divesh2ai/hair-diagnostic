# Production launch-readiness checklist

Gate for promoting the Super Admin command centre to real clinic rollout.
Do **not** promote to production without explicit authorization. Items marked
**NOT VERIFIED** require an authenticated browser session on the staging preview.

## A. Correctness & honesty
- [x] `Clinic.status = ACTIVE` is never presented as "launched" or "verified".
- [x] Readiness keeps DATABASE ACTIVE / ACCESS READY / OPERATIONALLY VERIFIED separate.
- [x] Operational tier reads "Verification pending" (no inference from activity).
- [ ] Rollout stage field added & real clinics promoted with evidence (Proposal A — needs approval).
- [ ] Golden-path verification record source exists (Proposal B — needs approval).

## B. Test-data separation
- [x] Deterministic classifier (explicit markers only) with unit tests.
- [x] Confirmed test/demo excluded from real-business metrics & network by default.
- [x] Explicit "show test/demo" filter preserves access to test data.
- [x] Production confirmed clean of test data (0 test, 0 uncertain of 7 clinics).
- [ ] Durable `isTestData` flag applied in **staging** and the 2 test clinics tagged (Proposal C — needs approval).
- [ ] If cleanup is wanted: deletion-impact report + exact record list produced and approved separately. **No deletion in this task.**

## C. Map
- [x] Basemap built from keyless OSM tiles; opens on India; degrades gracefully.
- [x] Clinics without coordinates listed in an actionable off-map list.
- [ ] **NOT VERIFIED:** OSM tiles actually paint in the authenticated preview (capture screenshot).
- [ ] **NOT VERIFIED:** at least one verified coordinate placed and a marker rendered.
- [ ] Production `ClinicLocation` rows exist (currently **0** — addresses/coords not yet loaded).

## D. Environment safety
- [x] Persistent server-derived STAGING/PRODUCTION badge (not client-settable).
- [x] Badge + write-guard both key off `DATABASE_URL` project ref.
- [x] Split-configuration (DB vs storage mismatch) surfaced.
- [x] Staging and production are distinct Supabase projects (tenant isolation).

## E. Validation
- [x] `tsc --noEmit` 0 errors; ESLint clean on touched files.
- [x] Vitest: no new regressions (+14 passing, 14 pre-existing failures unchanged).
- [x] Jest `admin-network` 17/17.
- [ ] **NOT VERIFIED:** Super Admin auth + role-based routing in a live browser.
- [ ] **NOT VERIFIED:** public clinic QR links resolve on the staging host.
- [ ] **NOT VERIFIED:** before/after screenshots attached to PR.

## F. Guardrails confirmed
- [x] No DB writes, no deletes, no migrations, no schema change applied.
- [x] PR #36 / #37 / #38 untouched.
- [x] No production deploy; clinical logic / patient records / isolation preserved.

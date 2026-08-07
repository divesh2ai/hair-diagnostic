# Stage 1 staging validation report

Date: 2026-07-18. No deployment or database migration was performed. No deterministic clinical rule was modified.

## Validation results

| Check | Result | Evidence |
|---|---|---|
| Prisma schema validation | PASS | `npx prisma validate`: schema valid |
| Prisma client generation | PASS with workaround | normal generation hit a locked Windows engine DLL; `--no-engine` regenerated types successfully |
| Migration SQL security contract | PASS | 30/30 tests: all 26 tables RLS-enabled, patient publication/effective-date filter, null-safe uniqueness, price overlap protection, tenant parent constraints, role grants |
| Stage 1 assistant golden tests | PASS | 60/60 |
| Release-mode tests | PASS | 6/6 |
| Importer idempotency | PASS | 1/1 double-run test; second invocation skipped and every entity count remained unchanged |
| Knowledge workflow | PASS | 3/3; review-stage chunks unavailable to patient retrieval |
| Combined Stage 1 suite | PASS | 100/100 across 5 files |
| Focused TypeScript: assistant/importer/workflow | PASS | zero errors |
| Focused TypeScript: internal trace UI | PASS | zero errors |
| Full repository TypeScript | FAIL (pre-existing) | unrelated legacy/orchestration/PDF/clinical errors; no error in Stage 1 assistant files |
| Full patient-portal TypeScript | FAIL (pre-existing) | unrelated admin/consultation/report errors; no error in Stage 1 assistant files |
| Patient portal production build | PASS | Next.js optimized build completed; `/assistant` and all three assistant APIs emitted |
| Deterministic kit-sequence suite | EXPECTED FAIL | 48 passed, 22 failed, unchanged; see failure matrix |

## Import double-run proof

The automated test invokes the exact `importStage1Pilot` function used by `npx tsx scripts/import-stage1-assistant.ts` twice against one persistent fake Prisma store. After run 1 and run 2, counts are identical: 1 ingestion run, 1 document, 1 document version, 5 kits, 5 kit versions, 5 prices, 23 products, 23 product aliases, 42 components, 42 schedules, and 35 chunks; aliases are also asserted from the complete normalized source set. The second result has `skipped: true` and the same ingestion-run ID.

The CLI was not run against the configured database because this staging task explicitly did not apply the migration or authorize writes to a live environment. The database-level null-safe unique indexes and importer `P2002` convergence protect concurrent repeats once the migration is applied.

## Release and publication state

- Server-enforced modes: `DISABLED`, `INTERNAL_PREVIEW`, `DOCTOR_ONLY`, `PATIENT_PILOT`, `PRODUCTION`.
- `PATIENT_PILOT` requires server-side clinic/user allowlisting.
- `PRODUCTION` disables provisional retrieval for every role.
- Internal trace is returned only to internal/doctor-authorized modes and shows intent, authorities, tools, source records/version/date/status, provisional status, safety decision, and escalation state.
- Knowledge states: `DRAFT`, `MEDICAL_REVIEW`, `MEDICAL_APPROVED`, `COMMERCIAL_APPROVED`, `PUBLISHED_INTERNAL`, `PUBLISHED_PATIENT`, `RETIRED`.
- Supplied document: `DRAFT`; version/chunks: `MEDICAL_REVIEW`; published chunks: 0.

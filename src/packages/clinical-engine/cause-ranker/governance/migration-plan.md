# Cause Ranker — Migration Plan (v1 Legacy Engine → v2 Cause Intelligence Layer)

**Status:** Sprint 1 / Week 3 deliverable. Frozen.
**Target cut-over:** end of Sprint 1 Week 4 (after Doctor Report Builder lands).

---

## Phase 0 — Pre-conditions (must be true before migration starts)

| # | Pre-condition | Verified by |
|---|---|---|
| 0.1 | Signal Registry v1.0.0 frozen and CI-green | `signals/validation-schema.json` + CI |
| 0.2 | Pathway Registry v1.0.0 frozen and CI-green | `pathways/validation-schema.json` + CI |
| 0.3 | Cause Registry v1.0.0 frozen and CI-green | `causes/validation-schema.json` + CI |
| 0.4 | Pathway Activation Engine emits PathwayGraph for all assessments | orchestrator stage `PATHWAY_ACTIVATION` completes 100% |
| 0.5 | Assessment schema carries `aiArtifacts[type=PATHWAY_GRAPH]` | Prisma migration applied |
| 0.6 | Assessment schema carries `aiArtifacts[type=CAUSE_RANK]` | Prisma migration applied (see Phase 1) |
| 0.7 | Legacy DiagnosisKey adapter exists and passes its unit tests | `legacy-adapter/diagnosisKeyAdapter.test.ts` |

If any pre-condition fails, migration is BLOCKED. Do not begin shadow-running.

---

## Phase 1 — Schema migration

### Prisma migration

Add the `CAUSE_RANK` and `CAUSE_GRAPH` artifact types and tighten the orchestrator stage enum:

```prisma
enum AIArtifactType {
  PATIENT_ANSWERS
  CLINICAL_PROFILE      // legacy v1 DiagnosisKey artifact (retained during dual-emit)
  PATHWAY_GRAPH         // v2 Sprint 1 Week 2
  CAUSE_RANK            // v2 Sprint 1 Week 3 — NEW
  CAUSE_GRAPH           // v2 Sprint 1 Week 3 — NEW
  CAUSE_EXPLANATION     // v2 Sprint 1 Week 3 — NEW (per top-N cause)
  RECOMMENDATIONS
  REPORT
}

enum AssessmentStage {
  QUEUED
  NORMALIZING
  RUNNING_CLINICAL_ENGINE
  COMPUTING_PATHWAYS      // v2 — NEW (replaces part of RUNNING_CLINICAL_ENGINE)
  RANKING_CAUSES          // v2 — NEW (Sprint 1 Week 3)
  GENERATING_RECOMMENDATIONS
  GENERATING_REPORT
  COMPLETED
  PARTIAL_FAILURE
}
```

Migration file path: `prisma/migrations/20260603_cause_ranker/migration.sql`.

Apply with:

```bash
npx prisma migrate dev --name cause_ranker
npx prisma generate
```

### Idempotency

`Assessment.aiArtifacts` retains its `@@unique([assessmentId, type])` constraint from the Production Maturity Layer (2026-05-27). Re-evaluation under a new engine version creates a parallel `CAUSE_RANK_REPLAY` type instead of overwriting.

---

## Phase 2 — Shadow run (read-only, 7 days)

Deploy the Cause Ranker behind a feature flag `CAUSE_RANKER_SHADOW_ENABLED`. When enabled:

1. Orchestrator continues to emit the legacy `CLINICAL_PROFILE` artifact as today.
2. AFTER `RUNNING_CLINICAL_ENGINE` completes, the orchestrator additionally invokes the Cause Ranker on the same `PathwayGraph` and writes the resulting `CAUSE_RANK`, `CAUSE_GRAPH`, and per-top-N `CAUSE_EXPLANATION` artifacts.
3. Downstream consumers (recommendations, report) STILL read from `CLINICAL_PROFILE`. The v2 artifacts are written but not yet consumed.
4. A daily parity job compares v1 `DiagnosisKey` against `diagnosisKeyAdapter(causeRank)`:

```bash
# Run nightly
npm run parity:check -- --days=1
```

The job reports per-DiagnosisKey acceptance rates. Failures > the acceptance bars defined in `legacy-parity-strategy.md` block progression to Phase 3.

### Shadow exit criteria

| Criterion | Threshold |
|---|---|
| Direct-mapping fixtures | ≥ 98% pass |
| Co-explanation fixtures | ≥ 95% pass |
| Downstream-eligibility fixtures | 100% pass |
| Not-a-cause fixtures | 100% pass |
| Production assessments shadow-emitting CAUSE_RANK | ≥ 10,000 |
| p99 latency budget | ≤ 4 ms |
| Zero P0 incidents | — |

---

## Phase 3 — Dual-emit cut-over (60 days)

The orchestrator continues to write BOTH `CLINICAL_PROFILE` (legacy) and `CAUSE_RANK` (v2) on every assessment. Downstream consumers switch ONE AT A TIME:

| Order | Consumer | Switch date | Verified by |
|---|---|---|---|
| 3.1 | Doctor Report Builder | Day 0 | Doctor preview page renders top-N causes |
| 3.2 | Recommendations Engine | Day 7 | Recommendation set parity ≥ 95% |
| 3.3 | Recovery Engine | Day 14 | Recovery prediction parity ≥ 90% |
| 3.4 | Patient Report projection | Day 21 | Patient narrative renders cause framings |
| 3.5 | WhatsApp digest | Day 28 | Daily clinic digest uses v2 fields |
| 3.6 | Analytics events | Day 35 | All `CauseLeader` events stamp `causeId` (not DiagnosisKey) |
| 3.7 | Admin dashboard | Day 45 | Admin views show cause distribution |
| 3.8 | Public clinic API | Day 60 | External API responses include CauseRank object |

A consumer that fails its parity check rolls back to reading `CLINICAL_PROFILE`. Migration does NOT block on a single consumer; each is independent.

---

## Phase 4 — Legacy deprecation

After Phase 3 completes:

| Day | Action |
|---|---|
| 60 | Stop writing `CLINICAL_PROFILE` artifact. Cause Ranker is the sole source of truth. |
| 90 | Legacy DiagnosisKey field deprecation warning logged on every read. |
| 180 | `Assessment.DiagnosisKey` column becomes nullable in the schema. |
| 365 | Schema migration drops the column. Legacy data is reconstructible via `diagnosisKeyAdapter` run against historic `CAUSE_RANK` artifacts. |

---

## Rollback Plan

At any point during Phases 2–4, set `CAUSE_RANKER_SHADOW_ENABLED=false` (Phase 2) or `CAUSE_RANKER_PRIMARY=false` (Phase 3+). The orchestrator falls back to the v1 legacy path:

- v2 artifacts continue to be written for analysis but are not read.
- Downstream consumers re-read from `CLINICAL_PROFILE`.
- p99 latency budget reverts to v1 baseline.

Rollback completes in < 60 seconds (feature-flag flip). No data migration required.

### Hard rollback (Phase 4+)

After Phase 4 day 60, `CLINICAL_PROFILE` is no longer being written. Hard rollback requires:

1. Re-enable `CLINICAL_PROFILE` writes (orchestrator code change, ≤ 2 hours).
2. Backfill `CLINICAL_PROFILE` for assessments since day 60 by running `diagnosisKeyAdapter` against their stored `CAUSE_RANK`.
3. Resume consumer reads from `CLINICAL_PROFILE`.

Document the trigger condition that justified hard rollback in a post-mortem.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Parity acceptance falls below threshold for one DiagnosisKey | medium | medium | Per-key acceptance bar; fix LLR tuning in `causes/registry.json` (minor version) and re-run parity. |
| Latency budget exceeded under load | low | medium | Bounded compute (10 causes × ≤20 references). Add LRU cache for softmax exponentials. Profile gates in CI. |
| Floating-point drift between V8 and SpiderMonkey | low | high | Bankers'-rounding at serialisation, tested across runtime targets. Replay invariant test. |
| Clinical-reviewer rejects a cause definition mid-migration | low | high | v1 path remains live throughout Phase 3; rollback flag flips in 60s. |
| Composite promotion fires too aggressively | medium | medium | `compositeRule.minimumDissentBetweenTopTwoCauses` tunable per minor release; parity fixture set covers all known MULTI cases. |
| Downstream consumer assumes single-cause framing | low | medium | All consumers updated in Phase 3 with explicit `verdict` handling; co-leads case is unit-tested in each consumer. |

---

## Communication Plan

- **Sprint 1 Week 3 demo** (end of week): show parity fixtures + shadow output to the clinical-systems team for sign-off.
- **Doctor preview ping** (Phase 3 day 0): invite a small panel of doctors to validate the new doctor report against their familiar v1 read.
- **Status page entries:** Phase 3 cut-over for each consumer.
- **Post-Phase-4 retrospective:** review parity outcomes per DiagnosisKey, capture LLR tuning learnings into v1.1.0 changelog.

---

## Owner

Clinical Intelligence Lead. Sign-off requirements:

- Cause Registry v1.0.0: clinical-reviewer + clinical-systems-architect.
- Cause Ranker engine v1.0.0: clinical-systems-architect + infra-lead (latency budget).
- Migration plan execution: clinical-systems-architect + product.

Migration completion is declared after Phase 4 day 60 with zero rollbacks pending.

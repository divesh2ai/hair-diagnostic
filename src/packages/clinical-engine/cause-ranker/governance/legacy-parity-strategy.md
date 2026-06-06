# Cause Ranker — Legacy Parity Strategy

**Status:** Sprint 1 / Week 3 deliverable. Frozen.
**Scope:** How the Cause Ranker output reconciles with the legacy 33-value `DiagnosisKey` enum used by the v1 clinical engine.

The legacy engine emits a single `DiagnosisKey` per patient. The v2 Cause Ranker emits a posterior distribution over 10 causes with dissent. **Parity is the contract that v2 reproduces v1's `DiagnosisKey` for every historic assessment in the parity-fixture corpus.**

---

## Parity Contract

For each of the 33 legacy `DiagnosisKey` values, exactly one of:

- A single v2 cause id (parity strategy `direct`).
- A pair of v2 cause ids that must co-lead (parity strategy `co-explanation`).
- A v2 *eligibility flag* that is independent of cause ranking (parity strategy `downstream-eligibility`).
- A v2 *non-cause artifact* (parity strategy `not-a-cause` — surfaced elsewhere).

Mapped on the registry side via `causes.registry.json#causes[].legacyMappings[]`. Each mapping declares:

```json
{ "legacyDiagnosisKey": "AGA_FEMALE_45", "parityStrategy": "co-explanation", "coWith": "hormonal-hair-loss" }
```

---

## DiagnosisKey → Cause Map (33 keys)

### Direct mappings (single leading cause)

| Legacy DiagnosisKey | v2 Leading Cause |
|---|---|
| AGA_MALE_123 | androgen-driven-miniaturization |
| AGA_MALE_45 | androgen-driven-miniaturization |
| ACUTE_TE | stress-driven-telogen-effluvium |
| CHRONIC_TE | stress-driven-telogen-effluvium |
| STRESS_TE | stress-driven-telogen-effluvium |
| POST_ILLNESS_TE | stress-driven-telogen-effluvium |
| NUTRITIONAL_TE | nutritional-hair-stress |
| IRON_DEFICIENCY | nutritional-hair-stress |
| VEGAN_NUTRITIONAL | nutritional-hair-stress |
| HYPOTHYROID_HAIRLOSS | hormonal-hair-loss |
| HYPERTHYROID_HAIRLOSS | hormonal-hair-loss |
| PCOS_HAIRLOSS | hormonal-hair-loss |
| MENOPAUSAL_HAIRLOSS | hormonal-hair-loss |
| PERIMENOPAUSE_HAIRLOSS | hormonal-hair-loss |
| METABOLIC_HAIRLOSS | metabolic-hair-dysfunction |
| PCOS_METABOLIC | metabolic-hair-dysfunction |
| ALOPECIA_AREATA | autoimmune-hair-loss |
| SCARRING_ALOPECIA | autoimmune-hair-loss |
| AUTOIMMUNE_HAIR | autoimmune-hair-loss |
| GUT_AXIS_HAIRLOSS | gut-hair-axis-dysfunction |
| SEBORRHEIC_DERMATITIS | inflammatory-scalp-dysfunction |
| INFLAMMATORY_SCALP | inflammatory-scalp-dysfunction |
| PSORIATIC_SCALP | inflammatory-scalp-dysfunction |
| SHAFT_DAMAGE | hair-shaft-damage-syndrome |
| CHEMICAL_DAMAGE | hair-shaft-damage-syndrome |
| HEAT_DAMAGE | hair-shaft-damage-syndrome |
| MULTI | multifactorial-hair-loss |
| MULTIFACTORIAL_HAIR | multifactorial-hair-loss |

### Co-explanation mappings (two causes must co-lead)

| Legacy DiagnosisKey | v2 Co-Leaders |
|---|---|
| AGA_FEMALE_123 | androgen-driven-miniaturization + hormonal-hair-loss |
| AGA_FEMALE_45  | androgen-driven-miniaturization + hormonal-hair-loss |
| POSTPARTUM_TE  | stress-driven-telogen-effluvium + hormonal-hair-loss |

### Downstream-eligibility mappings (NOT a cause)

| Legacy DiagnosisKey | v2 Routing |
|---|---|
| PREGNANCY | Surfaced via `eligibility/` registry. Cause modeling treats pregnancy-state as a precipitant signal feeding TE pathways; the eligibility gate is enforced by Recovery / Protocol layers. |
| AGA_GRADE45_LOCK | Surfaced via `eligibility/` registry as a severity floor. Cause ranking still emits androgen-driven-miniaturization as leader; the lock is a Protocol-Intelligence override. |

### Non-cause mappings

| Legacy DiagnosisKey | v2 Routing |
|---|---|
| CHRONIC_MEDICAL | Surfaced via patient-medical artifact; informs eligibility, never cause ranking. |
| EARLY_GREY | Pigmentation phenotype. Surfaced via narrative; not a hair-loss cause. |
| REGROW_ONLY | Goal-state, not a cause. Surfaced via objectives layer. |
| TRICHOTILLOMANIA | Behavioral. Surfaced via patient-medical artifact; routed to behavioral-care pathway. |

---

## Parity Verification

The parity-fixture corpus lives at:
`src/packages/clinical-engine/cause-ranker/fixtures/parity-vs-legacy/`

Each fixture file contains:

```json
{
  "fixtureId": "POSTPARTUM_TE.001",
  "legacyInput": { "...": "raw PatientAnswers + LegacyClinicalProfile" },
  "expectedLegacyKey": "POSTPARTUM_TE",
  "expectedV2Verdict": {
    "verdict": "co-leads",
    "coLeadingCauseIds": ["stress-driven-telogen-effluvium","hormonal-hair-loss"],
    "leadershipMargin": "<= 0.05"
  }
}
```

### Parity Gate

The Cause Ranker passes its parity gate when:

| Strategy | Acceptance Criterion |
|---|---|
| direct | v2 `leadingCauseId` == mapped cause id, and verdict ∈ {leads, leads-with-dissent}. |
| co-explanation | v2 verdict ∈ {co-leads, composite} AND both mapped cause ids ∈ `coLeadingCauseIds`. |
| downstream-eligibility | v2 emits the corresponding eligibility flag; cause ranking is informational only. |
| not-a-cause | v2 does NOT emit any of the 10 causes as a primary explanation for the legacy key; the legacy artifact is routed by Narrative or Eligibility. |

### Acceptance Bars

- **Direct fixtures:** ≥ 98% pass rate. <100% is permitted only for legacy data with known authoring errors documented in `parity-known-issues.md`.
- **Co-explanation fixtures:** ≥ 95% pass rate.
- **Downstream-eligibility fixtures:** 100% (no probabilistic component).
- **Not-a-cause fixtures:** 100% (structural routing).

Failing the parity gate blocks the v2 release. The gate runs as part of registry CI on every PR to `causes/`, `pathways/`, or `signals/`.

---

## Differences We Accept

There are documented cases where the v2 output is intentionally NOT byte-equal to the v1 `DiagnosisKey`:

1. **More precise causes.** v1's `MULTI` lumped together cases that v2 now correctly splits into two co-leaders. v2's output is richer.
2. **Dissent disclosure.** v1 always emitted a single key; v2 reveals dissent and co-leading. The legacy adapter still picks a single key for backward compat, but the underlying CauseRank carries more information.
3. **Composite promotion firing.** v1 emitted `MULTI` for any case with ≥3 active mechanisms; v2's `compositeRule` is stricter (also requires top-two dissent < 0.06). Some legacy `MULTI` cases now legitimately emit a single leading cause. These cases ARE expected to pass the parity gate via the `composite` verdict's `coLeadingCauseIds` containing the v1 dominant mechanism.
4. **Pregnancy + Grade-4/5 lock.** v1 conflated these with cause keys; v2 separates them into eligibility flags + cause ranking. Parity is asserted via the routing, not the legacy key.

These differences are deliberate. They are tested and documented per fixture file in `parity-known-issues.md` and reviewed by the clinical-systems team before each release.

---

## Adapter

The runtime adapter that projects `CauseRank` → `DiagnosisKey` (for any consumer still on the v1 contract) lives at:

`src/packages/clinical-engine/cause-ranker/legacy-adapter/diagnosisKeyAdapter.ts`

It is a stateless, deterministic function:

```
diagnosisKeyAdapter(causeRank, signals, pathwayGraph, eligibilityFlags): DiagnosisKey
```

Logic (in order):

1. If pregnancy-state signal fired with confidence ≥ 0.50 → emit `PREGNANCY`.
2. If grade45-severity-marker fired with confidence ≥ 0.60 AND leading cause is `androgen-driven-miniaturization` → emit `AGA_GRADE45_LOCK`.
3. If `compositePromotion.fired` → emit `MULTI`.
4. Else if `verdict == 'co-leads'` → look up the (leader, secondary) ordered pair in the co-explanation table; if matched, emit that key. Otherwise emit the leader's `direct` key.
5. Else emit the leader's `direct` key.

This adapter is purely a backward-compatibility shim. New consumers MUST read `CauseRank` directly.

---

## Sunset Plan

- **v1 ↔ v2 dual-emit window:** 60 days. Both `DiagnosisKey` and `CauseRank` are written to every assessment during this window.
- **v1 read deprecation:** 90 days after v2 cut-over. New consumers refuse to read `DiagnosisKey`.
- **v1 write removal:** 180 days after cut-over. `DiagnosisKey` field becomes nullable on `Assessment`.
- **v1 field removal:** 365 days. Schema migration drops the `DiagnosisKey` column. Legacy data continues to be reconstructible via the adapter run against the historic `CauseRank`.

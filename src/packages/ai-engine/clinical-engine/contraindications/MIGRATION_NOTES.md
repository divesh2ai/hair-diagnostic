# Contraindication & Therapy Block Migration Notes

Extracted from:
- `topical-engine.schema.json` → `recommendationEngine.decisionTree`, `autoInjectRules`, `hiddenCouplings`
- `clinical-engine.schema.json` → `conditionScoringEngine.absoluteLocks`, `dynamicTransitions`, `kitSignals`, `hiddenRules`
- `questionnaire.schema.json` → `skipLogic`, `dynamicFilterRule`, `scoringSignals`

Destination: `src/clinical-engine/contraindications/therapy_blocks.json`

---

## What Was Extracted

| Rule ID | Name | Source | Type |
|---|---|---|---|
| AC_001 | PREGNANCY_ABSOLUTE_LOCK | clinical-engine absoluteLocks | Kit hard stop |
| AC_002 | PREGNANCY_TOPICAL_BLOCK | topical-engine PREGNANCY_OVERRIDE | Topical hard stop |
| TC_001–007 | Product contraindications | topical-engine product + decisionTree | Per-product blocks |
| FR_001 | FINASTERIDE_PREGNANCY_BLOCK | topical-engine products | Topical block |
| FR_002 | FINASTERIDE_MALE_UNDER_18_BLOCK | topical-engine MALE_UNDER_18 | Topical block |
| KF_001 | PCOS_INGREDIENT_OVERLAP_FORBIDDEN | clinical-engine kitSignals | Kit combo block |
| KF_002 | META_B_HYPOTHYROID_FORBIDDEN_WITH_META_B | clinical-engine kitSignals | Kit combo block |
| KF_003 | META_B_PCOS_FORBIDDEN_WITH_META_B_HYPOTHYROID | clinical-engine kitSignals | Kit combo block |
| KF_004 | WEIGHT_LOSS_SHIELD_FULL_TE_GOLD_FORBIDDEN | clinical-engine protocolSequencer | Reduced scope |
| SR_001 | TE_GOLD_SUPPRESSION_REGROW_GOAL | clinical-engine DT_007, HR_004 | Kit suppression |
| SR_002 | TE_GOLD_SUPPRESSION_THINNING_ONLY | clinical-engine DT_006 | Kit suppression |
| SR_003 | TE_GOLD_SUPPRESSION_RULE_1A | clinical-engine rule1AOverride | Kit suppression + override |
| SR_004 | FPHL_AGE_GATE_UNDER_30 | clinical-engine DT_012 | Protocol override |
| SR_005 | HBR_KIT_SIGNAL_GATE | clinical-engine HR_007 | Kit gate |
| SR_006 | HBR_KIT_PROTOCOL_CAP_REMOVAL | clinical-engine DT_018 | Kit removal |
| SR_007 | OXIDATIVE_STRESS_TWO_SIGNAL_THRESHOLD | clinical-engine HR_006 | Kit gate |
| SR_008 | PRO_FACT_GI_GOLD_STRONG_SIGNAL_GATE | clinical-engine therapySignals | Kit gate |
| SR_009 | EARLY_GREY_AGE_GATE | questionnaire goal filterOpts | Option gate |
| SR_010 | GRADE_QUESTION_AA_SKIP | clinical-engine DT_016 | Question skip |
| SR_011 | HEALTHY9_SINGLE_KIT_ENFORCEMENT | clinical-engine protocolSequencer | Protocol lock |
| HR_001 | HORMONAL_QUESTION_FEMALE_ONLY | questionnaire hormonal skipLogic | Question gate |
| HR_002 | POSTPARTUM_OPTIONS_FEMALE_ONLY | questionnaire cause filterOpts | Option gate |
| HR_003 | THYROID_OPTION_RUNTIME_REMOVED | questionnaire hormonal runtimeModification | Runtime removal |
| HR_004 | FPHL_MPHL_KIT_GENDER_LOCK | clinical-engine DT_002, DT_003 | Gender gate |
| AG_001 | AGA_ABSOLUTE_LOCK_AGE_THRESHOLD | clinical-engine absoluteLocks | Protocol lock |
| AG_002 | FPHL_UNDER_30_PROTOCOL_OVERRIDE | clinical-engine DT_012 | Protocol override |
| AG_003 | ORAL_MINOXIDIL_OVER_60_CARDIAC_CAUTION | topical-engine MALE_OVER_55 | Caution flag |
| AG_004 | MALE_UNDER_18_FINASTERIDE_ABSOLUTE_BLOCK | topical-engine MALE_UNDER_18 | Topical block |
| AG_005 | EARLY_GREY_OPTION_AGE_CUTOFF | questionnaire goal filterOpts | Option hide |
| HT_001 | HYPERTENSION_TOPICAL_EARLY_RETURN | topical-engine HYPERTENSION_OVERRIDE | Topical hard stop |
| KC_001 | DYNAMIC_KIT_CAP_CALCULATION | clinical-engine DT_020 | Cap rule |
| HS_001–006 | Hidden safety rules | multiple sources | Safety flags |

---

## Logic Still Depending on Embedded Contraindication References

The following subsystems still perform contraindication checks **inline** and have **not** been migrated to read from `therapy_blocks.json` or call `validateContraindications()` / `checkTherapyEligibility()`.

### 1. `matchProtocol()` — absolute lock checks (inline)

```
Lines 4174, 4182, 4246-4253
```

PREGNANCY, EARLY_GREY, and AGA_GRADE45 absolute locks are hard-coded `if` blocks in `matchProtocol()`. They execute before the scoring loop and bypass everything. These are **not calling** `validateContraindications()`.

**Status:** These must remain embedded until `matchProtocol()` is refactored to accept an external pre-validation result.

### 2. `recommendTopicals()` — HYPERTENSION_OVERRIDE and PREGNANCY_OVERRIDE (inline)

```
topical-engine.schema.json lines 2373-2392, 2378-2392
```

Both early-return branches in `recommendTopicals()` check `isHypertension` and `isPregnancy` directly from derived patient flags. They are not calling `validateContraindications()`.

**Risk:** If `recommendTopicals()` is updated but the embedded logic is not migrated to use `validateContraindications()`, the two implementations can drift.

### 3. `autoInjectRules` — pregnancy check on AUTO_01 and AUTO_02 (inline)

```
AUTO_01_FBIWASH: trigger "NOT isPregnancy AND ..."
AUTO_02_EMUGROW_PATTERN: trigger "NOT isPregnancy AND ..."
```

Both rules check `isPregnancy` as an inline flag. They are not calling `isPregnantOrPlanning()` from `validateContraindications.ts`.

### 4. `getFunnelKits()` — TE GOLD suppression (inline)

```
Lines 3492-3508 (isRegrowGoal suppression)
Lines 4012-4019 (thinning-only suppression)
Lines 3925-3942 (active shedding promotion — overrides SR_001/SR_002)
```

All three TE GOLD rules are embedded in `getFunnelKits()`. SR_001 and SR_002 in `checkTherapyEligibility()` restate these rules but the calling code still uses the inline versions.

### 5. `getFunnelKits()` — forbidden kit combinations (inline)

```
Lines 3619-3628 (KF_001: PCOS diabetes upgrade)
Lines 3529-3535 (KF_002: META B HYPOTHYROID swap)
Lines 3640-3649 (KF_003: META B PCOS + HYPOTHYROID merge)
Lines 3895-4010 (KF_004: Shield + TE GOLD reduced scope)
```

All four forbidden combination resolutions are embedded. `checkTherapyEligibility()` detects the violations but does not yet drive the resolution logic in `getFunnelKits()`.

---

## Unresolved Dependencies

### DEP_C_001: `hasHypertension` structured field missing from `PatientAnswers`

Rule HT_001 (hypertension topical override) currently detects hypertension **only** via free-text keyword matching on `extra` and `medical_detail` fields. There is no structured `hasHypertension: boolean` field in `PatientAnswers`.

`validateContraindications.ts` checks `ans.hasHypertension === true` first (the fix) and falls back to free-text scanning. But until a structured `hasHypertension` field is wired to a checkbox in the medical question step, the structured path never fires.

**Resolution required:** Add `hasHypertension: boolean` to `PatientAnswers` interface. Wire it to a chronic conditions checkbox in Q4 (medical step, STEPS[12]) or to medical_detail parsing at intake time.

**Clinical risk (HS_006):** A hypertensive patient who does not mention 'hypertension' or 'blood pressure' in free-text will receive a standard Minoxidil recommendation — a potentially dangerous prescription.

### DEP_C_002: `planning_pregnancy` field not in questionnaire STEPS

Rule AC_002 reads `ans.planning_pregnancy`. This field is not asked in the questionnaire — it is inferred from free-text scanning (`extra`/`medical_detail` for 'conception'/'planning to conceive'). The structured boolean is never set from a checkbox.

**Resolution required:** Add 'Planning to conceive / conception' as a sub-option or follow-up to the hormonal question, or add explicit parsing logic at the intake normalisation layer.

### DEP_C_003: Rule 1A requires pre-computed `scores` map

`checkRule1AOverride()` in `checkTherapyEligibility.ts` requires the full `scores` map from `matchProtocol()`. This map is computed inside `matchProtocol()` and is not currently returned as part of the `ClinicalProfile` interface.

**Resolution required:** Expose `scores: Record<DiagnosisKey, number>` in `ClinicalProfile` or pass it explicitly from the orchestrator.

### DEP_C_004: `dominantKey` required for `SR_004` (FPHL under-30 block)

`checkFphlUnder30()` requires `dominantKey` to be passed from the clinical engine output. Currently `dominantKey` is accessible via `ClinicalProfile.primaryDiagnosis`. The caller must pass this value explicitly.

### DEP_C_005: `S._pcosStackHandled` global state flag (HS_004)

The PCOS precision stack guard flag (`S._pcosStackHandled`) is set on the global state object `S` inside `getFunnelKits()`. It prevents double PRO IMMUNE injection. This flag has not been extracted into a stateless function.

**Risk:** If `getFunnelKits()` is called more than once (e.g., in a retry flow or testing), the persisted flag incorrectly blocks PRO IMMUNE injection for non-PCOS subsequent calls.

**Resolution required:** Reset `S._pcosStackHandled` at the start of each `getFunnelKits()` invocation, or convert the PCOS stack logic to a pure function that returns the flag as part of its output.

---

## Missing Contraindication Coverage

The following clinical scenarios are **documented in the schema** but have **no corresponding rule** in `therapy_blocks.json` or the TypeScript validators because they are currently handled entirely by LLM narrative generation with no structured enforcement:

| Missing coverage | Source | Risk |
|---|---|---|
| HRT (Hormone Replacement Therapy) interaction with topical androgens | questionnaire hormonal options | LLM narrative only — no structured block |
| Scarring alopecia — permanent follicle damage | questionnaire immunity options | No kit block enforced; only a clinical note |
| Grade 4/5 prognosis addendum ("bald areas not regrowable") | questionnaire grade scoringSignals | Report note only — no kit filter |
| B12 deficiency effect on follicle matrix | questionnaire deficiency clinicalMappings | LLM flag only — no dedicated kit enforced |
| Vitamin D3 deficiency | questionnaire deficiency options | LLM flag only |
| Diabetes microvascular risk on recovery prognosis | clinical-engine riskSignals | Risk flag only — does not gate any kit |
| Alopecia Areata — unpredictable relapse/remission note | clinical-engine riskSignals | Clinical note only; no additional kit restriction |

---

## Invalid Mappings / Structural Gaps

### IMAP_001: `F-Emugrow MCR` has no database entry (propagated from products MIGRATION_NOTES)

Rule TC_004 (PVR_001) documents that F-Emugrow MCR (without Dutasteride) should be preferred over MCRD for females under 30. However, `F-Emugrow MCR` has no entry in `products.json`. `getProductByName('F-Emugrow MCR')` returns `undefined`.

**Effect:** `validateContraindications` correctly flags the MCR preference, but any downstream code that tries to resolve the product catalog entry for MCR will fail silently.

### IMAP_002: Pregnancy detection is split across two fields

`AC_001` checks `ans.hormonal` / `ans.is_pregnant`. `AC_002` checks `ans.planning_pregnancy`. Neither field is standardised in `PatientAnswers` — `is_pregnant` and `planning_pregnancy` are injected by the normalisation layer (`normalizePatientForTopicals`) but are not part of the questionnaire schema directly.

**Effect:** If the normalisation layer is bypassed (e.g., direct API calls), pregnancy will not be detected and HEALTHY-9 enforcement will not fire.

### IMAP_003: `validateContraindications` and `matchProtocol` are not yet wired together

`validateContraindications()` and `checkTherapyEligibility()` are standalone functions. They are **not called** by the existing orchestration layer (`diagnosis.ts`, `index.ts`, `scoreKits.ts`). The contraindication checks are still performed exclusively inline in `matchProtocol()` and `getFunnelKits()`.

**Migration path:**
1. Call `validateContraindications(ans)` at the start of `runClinicalPipeline()` — before `evaluateClinicalProfile()`
2. If `hasHardStop`, return the override immediately (HEALTHY-9 for pregnancy, hypertension message for HT)
3. Call `checkTherapyEligibility(ans, phases, dominantKey, scores)` after `protocolSequencer` lookup — before modifier injection
4. Remove duplicated inline checks from `matchProtocol()` and `getFunnelKits()` once the extracted validators are wired in

---

## Safe to Integrate Now

The following can be integrated immediately without modifying any existing logic:

- `validateContraindications()` — run before pipeline; safe to add as a pre-check that returns early if `hasHardStop`
- `isPregnantOrPlanning()` — drop-in replacement for `!isPregnancy` checks in `AUTO_01_FBIWASH` and `AUTO_02_EMUGROW_PATTERN`
- `getBlockedTopicals()` — use in `recommendTopicals()` to filter the final `recommended[]` array
- `checkTherapyEligibility()` with forbidden combination detection — run after `getFunnelKits()` as a post-check to catch any combination violations that slip through

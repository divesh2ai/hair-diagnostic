# HairOS V2 — Phase 0 Audit: CURRENT_STATE.md

> **Workspace:** `D:\Dr Fact Folder\RAG Chatbot`
> **Audit date:** 2026-06-02
> **Auditor:** Architecture Audit Pass (Phase 0, pre-implementation)
> **Scope:** Map everything that exists today against the V2 Clinical Reasoning Platform target, before any new code is written.

---

## 0. Method

Top-down read of `src/`, `src/packages/ai-engine/*`, `src/services/*`, `apps/patient-portal/`, schema JSON, and design-system spec. This audit is **not** a code review — it is an inventory of capabilities, abstractions, and gaps relative to the V2 target pipeline:

```
Answers → Signals → Pathways → Root Cause → Recovery → Objectives → Recommendations → Narrative → Report
```

What we already have is bolded against that pipeline at the bottom of each section.

---

## 1. Questionnaire Layer

### 1.1 Authoring Source of Truth

| File | Role |
|------|------|
| `src/packages/ai-engine/questionnaire-engine/schema/questionnaire.schema.json` | Canonical 21-question / 6-section schema, extracted from `DrFACT_revamp_v44.html`. Includes `scoringSignals[]`, `clinicalMappings[]`, `visibilityRules[]`, `skipLogic[]`, `dynamicFilterRule`, `mutualExclusivityRules`, `dependencies[]`, `validation`, `uiMetadata`. |
| `src/packages/ai-engine/questionnaire-engine/protocol/masterProtocol.ts` | Typed wrapper over the JSON (`SchemaQuestion`, `SchemaOption`, `SchemaScoringSignal`, etc.). |
| `src/packages/ai-engine/questionnaire-engine/schema/clinical-engine.schema.json` | 783-line companion schema (clinical answer → diagnosis mapping authored separately from runtime rules — **possible drift source, see §7**). |
| `src/packages/ai-engine/questionnaire-engine/schema/topical-engine.schema.json` | 594-line topical-selection schema (similar concern). |

### 1.2 Question Inventory (6 sections, 21 questions)

| Section | Questions |
|---------|-----------|
| `S1_PATIENT_IDENTITY` | name, age, goal, sex |
| `S2_HAIR_LOSS_ASSESSMENT` | duration, count, hairtype |
| `S3_SCALP_CONDITION` | scalp |
| `S4_MEDICAL_HISTORY` | cause, immunity, lifestyle, thyroid, medical, medical_detail, hormonal |
| `S5_NUTRITION_AND_DIET` | gut, deficiency, diet, treatment |
| `S6_GRADE_AND_ADDITIONAL` | grade, extra |

### 1.3 Runtime Question Engine

- `questionnaireEngine.ts` only normalises a submission into a `QuestionnaireProfile` (typed extract) — it does **not** drive the UI or evaluate signals.
- `src/packages/assessment-orchestrator/mapPortalAnswers.ts` + `src/packages/questionnaire-normalizer/` translate portal payloads to the legacy `PatientAnswers` shape consumed by the clinical engine.
- UI flow lives in `apps/patient-portal/src/components/questionnaire/` (18-step flow per `PROJECT_STATUS.md`).

### 1.4 Existing Per-Option Logic in JSON Schema

Every question carries:
- `scoringSignals[]` (e.g. `AGA_AGE_MODIFIER`, `AGA_GRADE45_LOCK`, `FPHL_AGE_GATE`, `GOAL_FILTER`)
- `clinicalMappings[]` (human-readable condition / implication pairs)

These are **descriptive metadata only** — none of these signal codes are referenced by the runtime engine. The clinical engine re-implements the same logic in TypeScript (see §2).

### 1.5 Question → Option → Existing Logic Mapping

| Question | Drives (today, via clinical engine) |
|----------|------|
| `age` | AGA score modifier (+5 if >30), AGA_4/5 hard lock (≥20), FPHL age gate (<30 → TE), goal filter |
| `goal` | `isRegrowGoal`, `hasHairGoal`, `hasGreyGoal` flags; gates regrow-only scoring path |
| `sex` | `isMale`, FPHL vs MPHL diagnosis split |
| `duration` | TE vs AGA weighting, `hasActiveShedding` |
| `count` | `hasActiveShedding`, `hasNoVisibleFall`, AGA-signal contribution |
| `hairtype` | AGA-signal markers (thinning, widening, parting) |
| `scalp` | Scalp-state derivation (OILY/DRY/DANDRUFF/INFLAMED/PSORIATIC/SENSITIVE/NORMAL), DHT root cause |
| `cause` | Root-cause derivation: STRESS, GENETICS, MEDICATION, ILLNESS, RAPID_WEIGHT_LOSS (GLP-1), POST_PARTUM, TRICHOTILLOMANIA |
| `immunity` | Root cause AUTOIMMUNE, PSORIATIC_SCALP |
| `lifestyle` | OXIDATIVE_STRESS, CIRCADIAN_DISRUPTION, METABOLIC, lifestyle scores |
| `thyroid` | HYPOTHYROID / HYPERTHYROID / DIABETES root cause + scoring |
| `hormonal` | PCOS / MENOPAUSE / PERI / POST-MENOPAUSE / POST_PARTUM / pregnancy lock |
| `gut` | GUT_MALABSORPTION → GUT_RESTORATION need |
| `deficiency` | IRON_DEFICIENCY → IRON_REPLETION need |
| `diet` | `isVeg` flag, nutritional cause |
| `treatment` | Shaft damage / barrier repair pathways |
| `grade` | Severity (MILD/MODERATE/SEVERE), AGA grade 4/5 lock |

---

## 2. Clinical Logic

Lives in `src/packages/ai-engine/clinical-engine/`.

### 2.1 Module Map

| File | Responsibility |
|------|----------------|
| `evaluateClinicalProfile.ts` | Orchestrator: flags → locks → score → derive → assemble `ClinicalProfile`. |
| `signals.ts` | Case-insensitive substring helpers (`signals(ans).cause('Stress')`, etc.) + `extractFlags()`. **Note: "signals" here means raw-answer accessors, not the V2 Clinical Signal Registry.** |
| `types.ts` | `ClinicalFlags`, `ClinicalProfile`, `ScoredDiagnosis`, `AbsoluteLockResult`. |
| `scoreConditions.ts` | Weighted scoring engine, regrow-only path, grade 4/5 override, dominant + secondary selection. |
| `deriveSignals.ts` | Derives `scalpStates`, `rootCauses`, `severity`. |
| `buildProtocol.ts` | Assembles `ClinicalProfile` from scored result + derived. |
| `buildTopicals.ts` | Topical recommendation builder. |
| `generateSnapshot.ts` | Replay/snapshot for regression. |
| `scoreConditions.ts` ← `rules/` | Per-condition modules: `agaRules`, `hormonalRules`, `metabolicRules`, `teRules`, `lifestyleRules`, `absoluteLocks`. |
| `contraindications/` | `validateContraindications.ts`, `checkTherapyEligibility.ts`, `therapy_blocks.json`. |
| `kits/products.json`, `loaders/loadProducts.ts` | Product registry. |
| `protocols/global.json` | Protocol catalog. |

### 2.2 Existing Domain Vocabulary (`src/packages/types/index.ts`)

- **`DiagnosisKey` — 33 enum values:** `AGA_MALE_123 / _45`, `AGA_FEMALE_123 / _45`, `TE_STRESS / NUTRITION / POSTPREG / DELIVERY / ILLNESS`, `THYROID_HYPO / HYPER`, `PCOS_ONLY / OBESITY`, `PERI_MENOPAUSE / MENOPAUSE / POST_MENOPAUSE`, `IRON_DEFICIENCY`, `ALOPECIA_AREATA`, `PREGNANCY`, `WEIGHT_LOSS`, `GUT_ISSUES`, `SCALP_INFLAM`, `HAIR_BREAKAGE`, `OXIDATIVE`, `NIGHT_SHIFT`, `FREQUENT_FLYING`, `DIABETES`, `CHRONIC_MEDICAL`, `TTM`, `ENDOMETRIOSIS`, `EARLY_GREY`, `MOUTH_ULCERS`, `MULTI`, `REGROW_ONLY`.
- **`ScalpState` — 7 values** (OILY/DRY/DANDRUFF/INFLAMED/PSORIATIC/SENSITIVE/NORMAL).
- **`RootCause` — 20 values** (STRESS, DHT, GENETICS, IRON_DEFICIENCY, HYPOTHYROID, HYPERTHYROID, PCOS, METABOLIC, POOR_NUTRITION, POST_PARTUM, GUT_MALABSORPTION, OXIDATIVE_STRESS, MEDICATION, ILLNESS, RAPID_WEIGHT_LOSS, AUTOIMMUNE, CIRCADIAN_DISRUPTION, TRICHOTILLOMANIA, HORMONAL_SHIFT, + DHT).
- **`TherapyNeed` — 19 values** (DHT_SUPPRESSION, INFLAMMATION_CONTROL, FOLLICLE_STIMULATION, METABOLIC_SUPPORT, IMMUNE_MODULATION, IRON_REPLETION, HORMONAL_REBALANCING, ANTIOXIDANT_SUPPORT, GUT_RESTORATION, THYROID_SUPPORT, CIRCADIAN_RESET, SHAFT_REPAIR, SHEDDING_ARREST, LACTATION_SUPPORT, MELANOCYTE_PROTECTION, ANDROGENIC_CORRECTION, NEUROLOGICAL_OCD_SUPPORT, WEIGHT_LOSS_RECOVERY, PREGNANCY_SUPPORT).
- **`Severity`** = MILD | MODERATE | SEVERE.

### 2.3 What Works

- Deterministic, pure functions (replayable from a fixed `PatientAnswers`).
- Severity, root cause, and scalp state derivation are first-class outputs.
- Locks (pregnancy, early grey, grade 4/5) sit before scoring — explainable precedence.
- Rule modules are per-category, easy to extend.

### 2.4 What's Missing vs. V2 Target

- **No Clinical Signal Registry.** The schema's `scoringSignals[]` codes exist as metadata but are not the runtime currency. The runtime "signal" helpers are raw-answer string matchers, not biologically-typed signals carrying `{category, biologicalSystem, severityWeight, confidenceWeight, narrativeMeaning}`.
- **No Biological Pathway layer.** Diagnoses (e.g. `AGA_MALE_45`) collapse pathway, severity, and patient cohort into one key. There is no `FollicularMiniaturization` / `TelogenCycleDisruption` / `ScalpInflammation` etc. as first-class objects.
- **No Root Cause confidence / supporting-signal trace.** `rootCauses: RootCause[]` is a flat array of enum strings — no `{rootCause, confidence, severity, supportingSignals}` envelope.
- **No Recovery Potential Engine.** Follicular reserve, stabilisation potential, progression risk, treatment responsiveness — none modelled.
- **No Treatment Objective layer.** Therapy needs (`TherapyNeed`) sit between diagnosis and product — but they are mechanistic ("DHT_SUPPRESSION") rather than goal-shaped ("Scalp Stabilisation", "Follicular Recovery", "Maintenance"). Useful, but not the V2 objective layer.
- **No Explainability Engine surface.** Rule traces exist inside `kit-scorer` (`RuleTrace[]`) but no cross-layer "Why we concluded X" object.

---

## 3. Recommendation Layer

Two cooperating packages.

### 3.1 `src/packages/ai-engine/recommendation-engine/`

Builders (one file each):

- `buildTherapyRouting`
- `buildTopicalSupport`, `buildTopicalRecommendations`
- `buildScalpSupport`
- `buildSerumSupport`, `buildSerumRecommendations`
- `buildProcedureSupport`, `buildProcedureRecommendations`
- `buildInternalProtocol`
- `buildProtocolTimeline`
- `buildUsageInstructions`
- `buildContraindicationWarnings`
- `buildExpectedOutcomes`
- `buildFullRecommendation` (top-level composer → `FullRecommendationResult`)
- `buildTherapyStack`

### 3.2 `src/packages/ai-engine/therapy-engine/`

- `mapTherapyNeeds.ts` — `ClinicalProfile → TherapyNeeds` (set + per-need reasons), driven by `needsMatrix.ts` (`DIAGNOSIS_TO_NEEDS`, `SECONDARY_NEEDS`).
- Decouples diagnoses from clinic-specific product portfolios. Multi-clinic ready.

### 3.3 `src/packages/ai-engine/kit-scorer/`

- `scoreKits.ts`, `resolveKit.ts`, `protocolSequencer.ts`, `adjunctProtocolEngine.ts`.
- `rules/` — `activeSheddingRule`, `glp1PrecedenceRule`, `greyGoalRule`, `metabolicModifierRule`, `pcosStackRule`, `proImmuneLastRule`, `regrowGoalRule`, `signalGatedInjectionRule`.
- `ranking/` — `kitCapCalculator`, `kitPrioritizer`.
- `RuleTrace[]` audit trail per recommendation. `AdjunctProtocol` (scalpCorrection, follicularSupport, barrierRepair, lifestyleInterventions, validationWarnings) is already modelled.

### 3.4 What Works

- The reasoning chain `Diagnosis → TherapyNeeds → Kits` already exists.
- Adjunct categories + rule trace give us much of the explainability scaffolding.
- Contraindications + therapy-eligibility checks are first-class.

### 3.5 What's Missing vs. V2 Target

- **No Treatment Objective Engine** as a discrete step. `TherapyNeed` is closest, but objectives in the V2 sense are coarser ("Scalp Stabilisation", "Maintenance"). A thin objective layer above `TherapyNeed` is needed.
- **No "why included" payload at product level.** `ScoredKit` carries `matchedNeeds + reasons[]`, but not `{biologicalMechanism, expectedContribution, expectedTimeline}`.
- **Three "Build…Support" + "Build…Recommendation" pairs** (topical, serum, procedure) look like in-progress refactor (see §7).

---

## 4. Report / Narrative Layer

`src/packages/ai-engine/narrative-engine/`.

### 4.1 Outputs

| Builder | Output |
|---------|--------|
| `buildDoctorReport` | Doctor report JSON |
| `buildPatientReport` | Patient report JSON |
| `buildPDFPayload` | PDF render payload (sections, tables, ingredient cards, charts) |
| `build3DAvatarScript` | Avatar scene + dialogue + emotion script |
| `buildDoctorDashboardCard` | Compact doctor dashboard card |
| `buildWhatsAppSummary` | WhatsApp summary |
| `buildFinalNarrative` | `buildPrognosisNarrative`, `buildTherapyExplanations`, `buildFollowupPlan` |

Driven by `narrativePipeline()` which validates input → builds all surfaces → returns `NarrativePipelineOutput` with metadata.

### 4.2 Supporting

- **Mappers:** `mapClinicalToNarrative`, `mapSeverityToTone`, `mapTherapyToTimeline`, `mapConditionToEducation`, `mapKitToNarrativeBundle`.
- **Formatters:** markdown, bold bullets, WhatsApp bullets, avatar speech.
- **Validators:** `validateNarrativeContext`, `validatePDFPayload`, `validateAvatarScript`.
- **Constants:** `DIAGNOSIS_LABELS`, `RECOVERY_WINDOWS`, `ROOT_CAUSE_LABELS`, `THERAPY_NEED_LABELS`, `THERAPY_NEED_PATIENT_LABELS`, `SEVERITY_CLINICAL_LABELS`, `MEDICAL_DISCLAIMERS`, `PATIENT_DISCLAIMERS`.

### 4.3 Parallel Surface: `src/packages/ai-engine/explanations/`

- `builders/`: `buildClinicalReasoning`, `buildDoctorSummary`, `buildKitExplanation`, `buildNarrative`, `buildPatientSummary`, `buildProtocolExplanation`.
- `composers/`: `composeClinicalNarrative`, `composeLifestylePlan`, `composePatientNarrative`, `composePrognosis`, `composeTherapyExplanation`.
- `dictionaries/`, `expansion/`, `templates/`.

**This overlaps narrative-engine substantially — see §7 (Duplicate).**

### 4.4 What Works

- Reports are already produced from `ClinicalProfile + TherapyPlan + KitRecommendation`, not directly from questionnaire answers. The V2 principle ("report consumes intelligence, never answers") is partially in place.
- Multi-surface fan-out (doctor / patient / PDF / avatar / WhatsApp / dashboard) is consistent.

### 4.5 What's Missing vs. V2 Target

- No three-layer Doctor / Patient / Biology narrative split as a formal contract — biology narrative is implicit inside explanations/templates.
- No Diet Intelligence or Lifestyle Intelligence as structured engines — `composeLifestylePlan` covers some of it as prose; no dietary cohort branching (Vegetarian / Vegan / Jain / Non-Veg / High-Protein / Regional) beyond the `isVeg` flag.
- No multi-language abstraction yet (i18n stub at `src/i18n/`); narratives still bake English strings into builders.

---

## 5. Adjacent Layers Worth Naming

| Path | Purpose | Status |
|------|---------|--------|
| `src/packages/orchestration/runAssessmentPipeline.ts` | End-to-end pipeline runner | Present |
| `src/packages/assessment-orchestrator/` | Portal answer mapping, narratives, persistence, validation, events | Present |
| `src/packages/ai-engine/pdf-engine/` | PDF templates + components + storage | Present |
| `src/packages/visual-recommendation-engine/` | Visual journey expansion | Present |
| `src/packages/ai-engine/avatar-engine/` | Avatar engine | Present |
| `src/packages/ai-engine/whatsapp-engine/` | WhatsApp engine | Present |
| `src/packages/ai-engine/knowledge-engine/` | KB, retrievers, mappers, schemas, validators, fixtures | Present |
| `src/packages/ai-engine/contracts/` | Cross-engine interface contracts | Present |
| `src/services/` | `assessmentService`, `diagnosis`, `productMapper`, `reportGenerationService`, `pdfGenerationService`, `whatsappDeliveryService`, `orchestrator`, `triage`, `rag`, `llm`, `conversation`, `response` | Present (some legacy) |
| `src/routes/` | `assessments`, `chat`, `diagnose`, `debugClinicalEngine`, `whatsappWebhook` | Present |

---

## 6. Design System

### 6.1 Canonical Specification

- **`design-system/NORTH_STAR_VISUAL_ASSESSMENT_SYSTEM_V1.md`** — Production spec (2026-06-01) for the visual assessment system: photography, illustration, layout, motion. Authoritative — do not modify.
- **`memory/project_hairos_architecture.md`** references a **HairOS Experience Bible (.docx, 2026-05-30)** with 10 design/UX principles — also authoritative.

### 6.2 Implemented Components (`apps/patient-portal/src/components/`)

- `ui/` — `button`, `card`, `input`, `label`, `progress`, `textarea` (shadcn-style primitives).
- `cinematic/` — `CinematicContainer`, `CinematicVisualPanel`.
- `transitions/` — `QuestionTransition`.
- Top-level dirs: `assessment/`, `feedback/`, `layout/`, `processing/`, `questionnaire/`, `sandbox/`, `shared/`, `upload/`, `visuals/`, `ErrorBoundary.tsx`.

### 6.3 Motion / Tokens

- Tailwind config at `apps/patient-portal/tailwind.config.ts`.
- Framer Motion in use (per `PROJECT_STATUS.md`).
- Global styles at `apps/patient-portal/src/styles/` + `app/globals.css`.

### 6.4 Posture

**Reuse only.** No changes during V2 intelligence work.

---

## 7. What Is Duplicate

| Duplication | Detail | Recommendation |
|-------------|--------|----------------|
| **Narrative engine vs. Explanations package** | `narrative-engine/` and `explanations/` both produce doctor / patient / clinical / kit / protocol narrative content (`buildDoctorReport` vs `buildDoctorSummary`, `composeClinicalNarrative` vs `mapClinicalToNarrative`, etc.). | Pick one canonical surface (recommend keeping `narrative-engine` as the runtime pipeline) and fold `explanations/` content into its mappers/composers OR repurpose `explanations/` strictly as the V2 Explainability Engine output. |
| **`scoringSignals` in JSON schema vs. TypeScript rules in `clinical-engine/rules/`** | The `questionnaire.schema.json` carries `scoringSignals[]` codes per option, but the runtime engine re-implements equivalent logic in TS rule modules. The codes are descriptive only. | Promote schema `scoringSignals` to the new Clinical Signal Registry — make them the single source of truth instead of metadata. |
| **`clinical-engine.schema.json` (783 lines) and `topical-engine.schema.json` (594 lines) vs. `clinical-engine/rules/*.ts`** | Two separate authorings of clinical reasoning. | Audit for drift; collapse into one authoritative source before adding the Pathway / Root Cause engines. |
| **`buildTopicalSupport` + `buildTopicalRecommendations` (and serum / procedure pairs)** | Pair-naming suggests parallel implementations. | Verify and merge during V2 product-reasoning refactor. |
| **`PatientAnswers` shape vs. `QuestionnaireProfile`** | Two different normalised views of the questionnaire submission. | Keep both for now (legacy clinical engine + new typed profile), but designate one as the input to the new Signal Registry. |
| **Two `clinical-engine` directories** | `src/clinical-engine/` (empty) and `src/packages/ai-engine/clinical-engine/` (full). | Remove the empty `src/clinical-engine/` directory. |

---

## 8. What Is Missing (Net-New for V2)

Mapped to the directive's phases:

| Phase | Missing artefact |
|-------|------------------|
| **Phase 1 — Clinical Signal Registry** | A first-class, typed registry of clinical signals with `{id, category, biologicalSystem, severityWeight, confidenceWeight, narrativeMeaning}` plus an `Answers → Signals` resolver that replaces the substring helpers in `signals.ts`. |
| **Phase 2 — Biological Pathway Engine** | Pathway objects (FollicularMiniaturization, TelogenCycleDisruption, ScalpInflammation, ImmuneDysregulation, HormonalDysregulation, MetabolicDysfunction, OxidativeStress, NutritionalLimitation, GutHairAxis, HairShaftDamage) with `{strength, confidence, supportingSignals, severity}`. |
| **Phase 3 — Root Cause Engine** | Structured cause output `{rootCause, confidence, severity, supportingSignals}` and the Primary / Secondary / Contributing taxonomy. Current `rootCauses: RootCause[]` is flat. |
| **Phase 4 — Recovery Potential Engine** | New: Follicular Reserve, Recovery Potential, Stabilisation Potential, Progression Risk, Treatment Responsiveness as structured intelligence (no narratives at this layer). |
| **Phase 5 — Treatment Objective Engine** | A goal layer above `TherapyNeed`: Scalp Stabilisation, Inflammation Reduction, Hormonal Support, Follicular Recovery, Growth Stimulation, Maintenance, Long-Term Preservation. |
| **Phase 6 — Product Reasoning Engine** | Per-product payload `{whyIncluded, biologicalMechanism, expectedContribution, expectedTimeline}` chained from RootCause → BiologicalDriver → Objective → Intervention → Product. |
| **Phase 7 — Narrative Engine (three layers)** | Formal Doctor / Patient / Biology narrative contracts; today these are mixed across `narrative-engine` and `explanations`. |
| **Phase 8 — Diet Intelligence** | Vegetarian / Vegan / Jain / Non-Veg / High-Protein / regional dietary engine producing diet risk signals, protein targets, micronutrient risks, growth-support foods, improvement plan. Current treatment of diet is `isVeg: boolean`. |
| **Phase 9 — Lifestyle Intelligence** | Sleep / Stress / Hydration / Exercise / Recovery assessments tied to follicular biology, not generic advice. |
| **Phase 10 — Explainability Engine** | Cross-layer "Why we concluded this" object exposing supporting signals, modifiers, confidence per conclusion. The pieces exist (kit `RuleTrace`, narrative mappers, schema clinicalMappings) but no unified surface. |
| **Globalisation** | Structured-JSON intelligence outputs decoupled from English narrative strings. Today narrative builders embed English. |

---

## 9. What Should Be Removed

| Target | Rationale |
|--------|-----------|
| Empty `src/clinical-engine/` directory | Dead path. Real engine is under `src/packages/ai-engine/clinical-engine/`. |
| `~$DrFACT_Condition_Mapping_Latest Final.xlsx` | Office lock file checked in by accident. |
| Drift-prone duplicate schemas (`clinical-engine.schema.json`, `topical-engine.schema.json`) once content is migrated into the Signal Registry + Pathway Engine | Will become misleading once V2 lands. |
| Whichever of `narrative-engine` ↔ `explanations` is *not* designated canonical | After consolidation. |

(No clinical engine code should be deleted yet — every behaviour must be migrated, not dropped.)

---

## 10. What Should Be Extended

These are the load-bearing assets to **extend, not rebuild**:

1. **`questionnaire.schema.json`** — promote `scoringSignals[]` to the Signal Registry's authoring layer.
2. **`clinical-engine/`** — keep `evaluateClinicalProfile` as the entry point; insert Signal Registry → Pathway → RootCause stages between `extractFlags` and `scoreConditions`.
3. **`therapy-engine/needsMatrix.ts`** — extend with the Treatment Objective layer (objectives → needs map).
4. **`kit-scorer/`** — extend `ScoredKit` to carry the V2 product-reasoning payload; keep `RuleTrace` as the seed of the Explainability Engine.
5. **`narrative-engine/`** — keep as the runtime pipeline; refactor to consume Intelligence outputs (Pathways / RootCauses / Recovery / Objectives) instead of `ClinicalProfile` directly.
6. **`recommendation-engine/`** — keep all `build*` builders; refactor inputs to consume Objectives + Product Reasoning rather than raw therapy needs.
7. **`contraindications/`** — unchanged; already cleanly separated.
8. **Design system + portal components** — reuse as-is.

---

## 11. Audit Outcome

- **The platform is genuinely production-grade and follows the V2 pipeline shape *in skeleton*.** Answers → Clinical Profile → Therapy Needs → Kit Scoring → Narrative is already the data flow. V2 is an intelligence-density and explainability upgrade, not a rewrite.
- **The clinical engine encodes biology implicitly inside `DiagnosisKey` + rule modules.** V2 needs the *implicit* knowledge made *explicit* via Signal Registry → Pathway → Root Cause → Recovery.
- **No stable subsystem requires rebuild.** Clinical rules, contraindications, kit scoring, narrative composition, PDF/avatar/WhatsApp surfaces, portal UI, and the design system are all reusable.
- **Largest risks:** schema-vs-runtime drift (§7), and the narrative ↔ explanations duplication. Both must be reconciled before the new intelligence layers are added on top, or V2 will inherit two parallel truths.

---

## 12. Recommended Sequencing (post-audit, pending approval)

1. **Reconcile duplicates** (§7) — pick canonical narrative surface; collapse the two clinical/topical JSON schemas; decide whether `scoringSignals` codes become runtime currency.
2. **Phase 1 — Clinical Signal Registry** — author registry from existing `scoringSignals[]` + rule-module logic; ship behind a feature flag; verify parity against current `ClinicalProfile` via existing replay/snapshot infrastructure.
3. **Phase 2–5** — layer Pathway → Root Cause → Recovery → Objective engines on top of the registry without disturbing `scoreConditions.ts`.
4. **Phase 6** — extend `ScoredKit` and recommendation builders to carry the product-reasoning payload.
5. **Phase 7** — refactor narrative pipeline to consume intelligence outputs; remove duplicated explanation surface.
6. **Phases 8–10** — Diet, Lifestyle, Explainability engines.
7. **Globalisation pass** — push English strings out of builders into a presentation/i18n layer.

No implementation begins until this audit is approved.

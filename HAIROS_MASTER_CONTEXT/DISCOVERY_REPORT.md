# DISCOVERY REPORT — HairOS Knowledge Surfaces

## Executive Summary
Inventory of every repository file that materially defines the questionnaire, signals, drivers, causes, scoring, kits, sequencing, narratives, video, and governance rules. Each entry tags which final master-context doc it feeds (03 = Questionnaire, 04 = Recommendation Engine, 05 = Kit Library, V = Validation, * = multiple). Code is treated as the canonical truth; docs are reference. Schema lives at `src/packages/ai-engine/questionnaire-engine/schema/questionnaire.schema.json` (3,238 lines). The clinical brain has three runtime layers — clinical-engine, cause-registry, kit-scorer — orchestrated by `evaluateClinicalProfile` and `protocolSequencer`. Governance is locked in `CONDITION_KIT_MAPPING_REFERENCE.md` (CKM, v2 2026-06-08) and supplemented by memory feedback files.

## 1. Questionnaire Surface (→ 03)

| File | Purpose |
|---|---|
| `src/packages/ai-engine/questionnaire-engine/schema/questionnaire.schema.json` | Single source of truth — 6 sections / 21 questions / all options, triggers, scoringSignals, clinicalMappings, dynamicFilterRule, mutualExclusivityRules, runtimeModification, skipLogic, visibility, sourceCodeReference |
| `src/packages/ai-engine/questionnaire-engine/protocol/masterProtocol.ts` | Typed wrapper exporting MasterProtocol |
| `src/packages/ai-engine/questionnaire-engine/types.ts` | Option / Question / Section types |
| `src/packages/ai-engine/questionnaire-engine/helpers.ts` | Schema helpers |
| `src/packages/ai-engine/questionnaire-engine/questionnaireEngine.ts` | Engine entrypoint |
| `apps/patient-portal/src/types/questionnaire.ts` | Frontend Question type contract |
| `apps/patient-portal/src/runtime/protocolAdapter.ts` | Schema → frontend Question[] adapter |
| `apps/patient-portal/src/runtime/protocolLoader.ts` | Runtime loader |
| `apps/patient-portal/src/runtime/visibilityEngine.ts` | Conditional visibility |
| `apps/patient-portal/src/runtime/skipEngine.ts` | Skip logic |
| `apps/patient-portal/src/runtime/optionFilterEngine.ts` | Dynamic option filter (e.g., age-based) |
| `apps/patient-portal/src/runtime/stepEngine.ts` | Step ordering |
| `apps/patient-portal/src/runtime/progressEngine.ts` | Progress computation |
| `apps/patient-portal/src/runtime/signalExtractor.ts` | Maps answers → signal flags |
| `apps/patient-portal/src/runtime/stepResolver.ts` | Replay frames (`buildReplayFrames`) |
| `apps/patient-portal/src/components/questionnaire/QuestionRenderer.tsx` | Question UI |
| `apps/patient-portal/src/config/questionnaire/questions.ts` | Legacy stub (now `[]`) — deprecated |
| `docs/BRANCHING_ENGINE_SPEC.md` | Branching contract |
| `docs/PROTOCOL_RUNTIME_ARCHITECTURE.md` | Runtime architecture |
| `HAIROS_SIGNAL_REGISTRY_V1.md` | Complete signal catalog (`HAIROS_SIGNAL_REGISTRY_V1.md`) |

## 2. Clinical Engine (→ 04, V)

| File | Purpose |
|---|---|
| `src/packages/ai-engine/clinical-engine/signals.ts` | Canonical signal accessors |
| `src/packages/ai-engine/clinical-engine/deriveSignals.ts` | Derives signals from PatientAnswers |
| `src/packages/ai-engine/clinical-engine/scoreConditions.ts` | DiagnosisKey scoring |
| `src/packages/ai-engine/clinical-engine/evaluateClinicalProfile.ts` | Orchestrator → ClinicalProfile |
| `src/packages/ai-engine/clinical-engine/types.ts` | DiagnosisKey + ClinicalProfile types |
| `src/packages/ai-engine/clinical-engine/buildProtocol.ts` | Phase plan builder |
| `src/packages/ai-engine/clinical-engine/buildTopicals.ts` | Topical add-on engine |
| `src/packages/ai-engine/clinical-engine/generateSnapshot.ts` | Snapshot for audit/replay |
| `src/packages/ai-engine/clinical-engine/rules/absoluteLocks.ts` | EARLY_GREY, PREGNANCY locks |
| `src/packages/ai-engine/clinical-engine/rules/agaRules.ts` | AGA G1–G3 vs G4–G5 routing |
| `src/packages/ai-engine/clinical-engine/rules/hormonalRules.ts` | PCOS / thyroid / menopause continuum |
| `src/packages/ai-engine/clinical-engine/rules/lifestyleRules.ts` | Sedentary / smoking / weight-loss |
| `src/packages/ai-engine/clinical-engine/rules/metabolicRules.ts` | META B family activation |
| `src/packages/ai-engine/clinical-engine/rules/teRules.ts` | Telogen Effluvium routing |
| `src/packages/ai-engine/clinical-engine/contraindications/checkTherapyEligibility.ts` | Therapy/ingredient eligibility gates |
| `src/packages/ai-engine/clinical-engine/contraindications/therapy_blocks.json` | Block list data |
| `src/packages/ai-engine/clinical-engine/kits/products.json` | Topical catalog (~14 SKUs) |
| `src/packages/ai-engine/clinical-engine/protocols/global.json` | Global protocol defaults |
| `src/packages/ai-engine/clinical-engine/loaders/loadProducts.ts` | Loader |
| `src/packages/ai-engine/clinical-engine/replay/` | Replay corpus |

## 3. Cause Registry (→ 04)

| File | Purpose |
|---|---|
| `src/packages/ai-engine/cause-registry/catalog.ts` | 10 root causes; Bayesian softmax; compositeRule for multifactorial |
| `src/packages/ai-engine/cause-registry/engine.ts` | Cause ranker |
| `src/packages/ai-engine/cause-registry/types.ts` | Cause id ↔ legacy enum types |

## 4. Kit Scorer (→ 04, 05)

| File | Purpose |
|---|---|
| `src/packages/ai-engine/kit-scorer/scoreKits.ts` | Kit scoring entrypoint |
| `src/packages/ai-engine/kit-scorer/resolveKit.ts` | Final kit id resolution (incl. VEG / MPHL/FPHL gender swap) |
| `src/packages/ai-engine/kit-scorer/protocolSequencer.ts` | PROTOCOL_SEQUENCER record (DiagnosisKey → phase order) |
| `src/packages/ai-engine/kit-scorer/adjunctProtocolEngine.ts` | Adjunct kit handling |
| `src/packages/ai-engine/kit-scorer/types.ts` | KitScorerContext types |
| `src/packages/ai-engine/kit-scorer/ranking/kitPrioritizer.ts` | Order surviving candidates |
| `src/packages/ai-engine/kit-scorer/ranking/kitCapCalculator.ts` | Kit cap (5–7 based on active signal count) |
| `src/packages/ai-engine/kit-scorer/rules/activeSheddingRule.ts` | TE GOLD gating (active shedding) |
| `src/packages/ai-engine/kit-scorer/rules/giGoldFinalGuardRule.ts` | Enforces GI GOLD trigger lock (GERD / IBS / Acid reflux / Crohn only) |
| `src/packages/ai-engine/kit-scorer/rules/giGoldSupersedesTeGoldRule.ts` | GI GOLD wins Phase 1 over TE GOLD |
| `src/packages/ai-engine/kit-scorer/rules/glp1PrecedenceRule.ts` | GLP-1 RWLS positioning |
| `src/packages/ai-engine/kit-scorer/rules/greyGoalRule.ts` | EARLY_GREY_LOCK / GREY_CO_CONDITION |
| `src/packages/ai-engine/kit-scorer/rules/ironUpInjectionRule.ts` | IRON UP GOLD injection (deficiency or heavy bleeding) |
| `src/packages/ai-engine/kit-scorer/rules/lactihealthInjectionRule.ts` | LACTIHEALTH for lactation |
| `src/packages/ai-engine/kit-scorer/rules/menopauseContinuumInjectionRule.ts` | Peri / Meno / Post-meno continuum (non-negotiable) |
| `src/packages/ai-engine/kit-scorer/rules/metabolicModifierRule.ts` | Metabolic kit modifier (Obesity/Sedentary/Crash) |
| `src/packages/ai-engine/kit-scorer/rules/pcosMetaBVariantRule.ts` | PCOS → META B PCOS variant |
| `src/packages/ai-engine/kit-scorer/rules/pcosStackRule.ts` | PCOS kit stacking |
| `src/packages/ai-engine/kit-scorer/rules/periMenopauseSupersedesTeGoldRule.ts` | Peri replaces TE GOLD |
| `src/packages/ai-engine/kit-scorer/rules/proImmuneLastRule.ts` | PRO IMMUNE always last in standard sequence |
| `src/packages/ai-engine/kit-scorer/rules/regrowGoalRule.ts` | Regrow-only path suppresses TE GOLD |
| `src/packages/ai-engine/kit-scorer/rules/signalGatedInjectionRule.ts` | Generic signal-gated kit injection |
| `src/packages/ai-engine/kit-scorer/rules/teGoldGatingRule.ts` | TE GOLD gating (non-active-shedding cases) |
| `src/packages/ai-engine/kit-scorer/rules/thyroidInjectionRule.ts` | Thyroid kit; PCOS+Hypo → plain META B (2026-06-17 lock) |

## 5. Narrative & Report Engines (→ 04, 05, V)

| File | Purpose |
|---|---|
| `src/packages/ai-engine/explanations/builders/buildKitExplanation.ts` | Kit-level explanation block |
| `src/packages/ai-engine/explanations/expansion/therapyNeedExpansions.ts` | Therapy-need expansions |
| `src/packages/ai-engine/explanations/composers/` | Block composers |
| `src/packages/ai-engine/explanations/dictionaries/` | Phrase/ingredient dictionaries |
| `src/packages/ai-engine/explanations/templates/` | Narrative templates |
| `src/packages/ai-engine/narrative-engine/buildFinalNarrative.ts` | Final narrative composer |
| `src/packages/ai-engine/narrative-engine/buildPatientReport.ts` | Patient report build |
| `src/packages/ai-engine/narrative-engine/buildDoctorReport.ts` | Doctor report build |
| `src/packages/ai-engine/narrative-engine/buildPDFPayload.ts` | PDF payload |
| `src/packages/ai-engine/narrative-engine/buildWhatsAppSummary.ts` | WhatsApp summary |
| `src/packages/ai-engine/narrative-engine/build3DAvatarScript.ts` | Avatar script (video script source) |
| `src/packages/ai-engine/narrative-engine/buildDoctorDashboardCard.ts` | Dashboard card |
| `src/packages/ai-engine/narrative-engine/narrativePipeline.ts` | Pipeline |
| `src/packages/ai-engine/narrative-engine/validators/` | Narrative validators |
| `src/packages/ai-engine/report-engine/v3/composeNarrativeV3.ts` | V3 composer |
| `src/packages/ai-engine/report-engine/v3/ingredientMechanisms.ts` | Ingredient → mechanism dictionary |
| `src/packages/ai-engine/report-engine/v3/kitBrandNames.ts` | Kit brand-name map |
| `src/packages/ai-engine/report-engine/v3/barrierMap.ts` | Barrier → root cause map |
| `src/packages/ai-engine/avatar-engine/` | 3D avatar / video script engine |

## 6. Governance / Canonical Docs (→ *)

| File | Purpose |
|---|---|
| `CONDITION_KIT_MAPPING_REFERENCE.md` | **Master Mapping v2 (2026-06-08)** — Q1–Q13 rule tables, HR-1..HR-6 hard rules, G-1..G-4 governance overrides, 30-kit master, phase sequencing, worked examples |
| `HAIROS_RECOMMENDATION_DECISION_ENGINE_CONSTITUTION.md` | RDE constitution — Root Cause → Objective → Capability → Intervention → Recommendation chain |
| `HAIROS_CLINICAL_INTELLIGENCE_MASTER_KNOWLEDGE_MODEL.md` | Clinical intelligence layer model |
| `HAIROS_SIGNAL_REGISTRY_V1.md` | Signal catalog (2,065 lines) |
| `HAIROS_REPORT_SYSTEM_SPECIFICATION.md` | Report system |
| `HAIROS_FOLLICULAR_BIOLOGY_INTELLIGENCE.md` | Follicular biology grounding |
| `HAIROS_INGREDIENT_INTELLIGENCE_MASTER_V1.md` | Ingredient knowledge |
| `HAIROS_CLINICAL_EXPLANATION_AND_NARRATIVE_ENGINE.md` | Narrative engine spec |
| `HAIROS_REFERENCE_EXECUTION_ENGINE_SPECIFICATION_V1.md` | Execution engine |
| `HAIROS_EXPLAINABILITY_AND_CLINICAL_TRUST_REMEDIATION_V1.md` | Trust / explainability spec |
| `HAIROS_CONSTITUTIONAL_TEST_CORPUS_V1.md` | Test corpus contract |
| `HAIROS_PHASE_5A_REGISTRY_GOVERNANCE_CONSTITUTION.md` | Registry governance |
| `HAIROS_PHASE_5B_REGISTRY_SPECIFICATION_CONSTITUTION.md` | Registry specification |
| `HAIROS_UX_CONTRACT_SPECIFICATION.md` | UX contract |
| `HAIROS_UX_CONTRACT_CONSTITUTIONAL_ENHANCEMENTS.md` | UX enhancements |
| `HAIROS_CLINICAL_EXECUTION_HARNESS_CEH_V1.md` | Execution harness |
| `NARRATIVE_GOVERNANCE_RULES.md` | Narrative governance |
| `SECTION_BY_SECTION_CONTENT_RULES.md` | Section content rules |
| `REPORT_PHILOSOPHY.md` | Report philosophy |
| `PATIENT_REPORT_V3_SPEC.md` / `DOCTOR_REPORT_V3_SPEC.md` / `DASHBOARD_V3_SPEC.md` | Report v3 specs |
| `CONSULTATION_EXPERIENCE_ARCHITECTURE.md` | Consultation experience |
| `CONTENT_EXPANSION_IMPLEMENTATION.md` | Content expansion |

## 7. Kit Catalog Source (→ 05)

| File | Purpose |
|---|---|
| `all-kits-info.txt` | 742-line kit clinical narratives (Diagnosis Insight, Therapeutic Strategy, Ingredients, Expected Response, Clinical Note) |
| `All Kits  Info.docx` | Binary master of `all-kits-info.txt` |
| `Kits & Product.xlsx` | Kit catalog master (binary) |
| `DrFACT_Protocol_Sequencer Final.xlsx` | Phase sequencer source (binary) |
| `DrFACT_Condition_Mapping_Latest Final.xlsx` | Condition→kit mapping source (binary) |
| `DrFACT_Condition_Mapping_Latest Final(AutoRecovered).xlsx` | Auto-recovered variant |
| `data/docs/DrFACT_Condition_Mapping_New.txt` | Flat export |
| `data/docs/DrFACT_Protocol_Sequencer updated.txt` | Flat export |
| `data/docs/Phenotype Kits Indications.txt` | Phenotype kit indications |

## 8. Memory-Locked Governance (→ *)

| File | Lock |
|---|---|
| `~/.claude/.../feedback_gi_gold_trigger.md` | PRO FACT GI GOLD only for GERD / IBS / Acid reflux / Crohn at Phase 1 |
| `~/.claude/.../feedback_kit_injection_rules.md` | F-PCOS -1 retired; HBR standalone-only; menopause continuum non-negotiable; PCOS + Hypo → plain META B |
| `~/.claude/.../feedback_narrative_patient_signals_only.md` | Narrative may reflect only patient-confirmed signals |
| `~/.claude/.../feedback_questionnaire_changes_2026_06_15.md` | Heavy bleeding (Female 18-50 → IRON UP P1); Pescatarian added; Scarring alopecia + Menopause removed; "peri" substring fix |

## 9. Frontend Surfaces (→ 03)

| File | Purpose |
|---|---|
| `apps/patient-portal/src/app/(public)/q/[clinicSlug]/page.tsx` | Public questionnaire entry |
| `apps/patient-portal/src/app/(public)/q/[clinicSlug]/preview/[assessmentId]/page.tsx` | Preview view |
| `apps/patient-portal/src/app/(public)/q/[clinicSlug]/processing/[assessmentId]/page.tsx` | Processing view |
| `apps/patient-portal/src/app/assessment/[id]/report/page.tsx` | Report viewer |
| `apps/patient-portal/src/components/report/ClinicalReportView.tsx` | Clinical report UI |
| `apps/patient-portal/src/components/assessment/AssessmentDashboard.tsx` | Assessment dashboard |
| `apps/patient-portal/src/lib/adapters/assessmentAdapter.ts` | Assessment adapter |
| `packages/shared/types/assessment.ts` | Shared assessment types |

## 10. Video / Avatar (→ 05, 09)

| File | Purpose |
|---|---|
| `src/packages/ai-engine/narrative-engine/build3DAvatarScript.ts` | Generates avatar/video script from clinical profile |
| `src/packages/ai-engine/avatar-engine/` | Avatar engine package |
| `HAIROS_MASTER_CONTEXT/09_VIDEO_ARCHITECTURE.md` | Video architecture (existing doc) |

No per-kit video block files were located in the kit-scorer or narrative-engine; video output is generated dynamically from the avatar script. Per-kit static video clips are **[MISSING]** from the repository.

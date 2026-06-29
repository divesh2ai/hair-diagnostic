# 08 — Report Architecture

## Executive Summary
The HairOS report is the platform's primary clinical artifact — the durable, signed, auditable rendering of intelligence into language. Five report types are defined ([`../HAIROS_REPORT_SYSTEM_SPECIFICATION.md`](../HAIROS_REPORT_SYSTEM_SPECIFICATION.md) §2: Patient · Doctor · Monitoring · Reassessment · Audit); the Patient report has 12 sections ([`../PATIENT_REPORT_V3_SPEC.md`](../PATIENT_REPORT_V3_SPEC.md)). Reports are produced by a deterministic narrative pipeline (Signals → Barriers → Strategy → Kits → Ingredients → Outlook → Lifestyle) implemented in `src/packages/ai-engine/{report-engine, narrative-engine, explanations}/`. The editorial filter is the five-question rule ([`../REPORT_PHILOSOPHY.md`](../REPORT_PHILOSOPHY.md) §3). Voice and leakage are governed by [`../NARRATIVE_GOVERNANCE_RULES.md`](../NARRATIVE_GOVERNANCE_RULES.md).

## 1. Report Types (binding)
Per [`../HAIROS_REPORT_SYSTEM_SPECIFICATION.md`](../HAIROS_REPORT_SYSTEM_SPECIFICATION.md) §2:

| Type | Audience | Purpose |
|---|---|---|
| Patient Report | Patient | State, causes, plan — language to act on |
| Doctor Report | Clinician | Review, override, chart inclusion |
| Monitoring Report | Patient + Doctor (layered) | Change vs baseline; honest noise floor |
| Reassessment Report | Patient + Doctor | Full re-derivation after interval/trigger |
| Audit Report | Medical director / Compliance | Full reconstructable trace |

## 2. Mandatory Section Sequence (binding for all reports)
Per spec §3.1:
1. Header & Identity Block
2. Executive Summary (deterministic projection)
3. Findings
4. Root Causes
5. Recommendations
6. Monitoring
7. Explanation Block
8. Image Evidence
9. Audit Footer

Source binding rule §3.3: every section must declare its upstream engine; no section without an intelligence source.

| Section | Sole upstream source |
|---|---|
| Executive Summary | Deterministic projection of Findings + Causes + Recommendations + Trust Layer |
| Findings | Signal Registry v1 |
| Root Causes | Root Cause Engine |
| Recommendations | Recommendation Decision Engine (RDE) |
| Monitoring | Trust Layer + RDE monitoring targets |
| Explanation Block | Clinical Explanation and Narrative Engine |
| Image Evidence | Validated image pipeline (UX Contract §image-validation) |
| Audit Footer | Canonical Ledger |

## 3. Patient Report V3 — 12 Sections
Per [`../PATIENT_REPORT_V3_SPEC.md`](../PATIENT_REPORT_V3_SPEC.md). 14–18 pp, ~12-minute read; patient-priority subset (§1, §2, §5, §11) ~3 minutes:
1. Current Hair Assessment (Q1) · 2. What We Found (top 5 findings) · 3. Understanding Your Hair Loss · 4. Root Cause Analysis (Primary / Secondary / Contributing) · 5. Treatment Priority Roadmap · 6. Personalized Protocol · 7. Topical Plan · 8. Lifestyle Prescription · 9. Ingredient Intelligence · 10. Monitoring Plan · 11. Expected Outcomes · 12. Doctor Notes.

## 4. Narrative Engine Architecture

### 4.1 Top-Level Composer (V3)
`src/packages/ai-engine/report-engine/v3/composeNarrativeV3.ts`. Deterministic, no AI. Chain:
```
Signals → Barriers → Strategy → Kits → Ingredients → Outlook → Lifestyle
```
Reads the V4 `ClinicalReport` (the structured source of truth) and re-voices for the patient lens.

Key supporting modules in `report-engine/v3/`:
- `barrierMap.ts` — V4 root-cause display name → BarrierDef. Includes special barriers (`SCALP_INFLAMMATION_BARRIER`, `SHAFT_BREAKAGE_BARRIER`).
- `ingredientMechanisms.ts` — ingredient → mechanism explanations.
- `kitBrandNames.ts` — internal kit id → patient-facing brand name.
- `types.ts` — `NarrativeReportV3`, `ClinicalSummarySection`, `RecoveryStrategySection`, `RecommendedKitsSection`, `RecoveryOutlookSection`, `DietLifestyleSection`.
- Caps: `MAX_FACTORS = 5`, `MAX_BARRIERS = 5`, `MIN_BARRIERS = 3`, `MAX_DIET_RECS = 5`.

### 4.2 Clinical Insight & Recovery Story
`src/packages/ai-engine/report-engine/buildClinicalInsightStory.ts` — FINAL PRODUCTION SPECIFICATION (most recent git commits: `dd4e844 Add Clinical Insight & Recovery Story narrative generator`, `6bb423a Wire Clinical Insight & Recovery Story into report UI and PDF`).

Four sections per story:
```
Selected Conditions → Biological Drivers → Hair Impact → Treatment Goals → Narrative
```
**Hard rules (binding):**
- HairOS is NOT diagnosing / assessing / measuring / grading. Voice uses "Based on the information you shared with us…", never "Assessment shows…".
- 2–5 drivers per story. Driver tiers are used internally to rank only; never displayed.
- Section 3 includes the canonical personalisation statement.
- Section 4 is structured Stabilisation → Recovery → Resilience; phase names never displayed.
- No timelines, no regrowth promises, no ingredient / kit / product vocabulary, no assessment / diagnosis language.

**Driver keys** (`DriverKey`): HORMONAL_METABOLIC · NUTRITIONAL · STRESS_SHEDDING · (+ others; see file lines 37–) — each carries `label`, `hairImpact`, `treatmentGoal`, `recognitionCue`.

Patient signals only (locked): the narrative must reflect only patient-confirmed signals; never inject Genetic-Pattern driver from internal AGA_* diagnosis routing. (`MEMORY.md` `feedback_narrative_patient_signals_only.md`.)

### 4.3 Other Builders (`src/packages/ai-engine/report-engine/`)
- `buildClinicalReport.ts` — assembles the canonical `ClinicalReport` (V4) consumed by `composeNarrativeV3`.
- `buildFinalClinicalAssessment.ts` — final assessment composer.
- `types.ts` — `ClinicalReport`, `RootCauseCondition`, etc.

### 4.4 Narrative Engine (broader)
`src/packages/ai-engine/narrative-engine/`:
- `narrativePipeline.ts` — orchestrator.
- `buildFinalNarrative.ts` — `buildPrognosisNarrative` → `PrognosisNarrative` with `RECOVERY_WINDOWS[primaryDiagnosis]`, timeline events via `mappers/mapTherapyToTimeline.ts`, severity tone via `mapSeverityToTone.ts`.
- `buildPatientReport.ts`, `buildDoctorReport.ts`, `buildDoctorDashboardCard.ts`, `buildWhatsAppSummary.ts`, `buildPDFPayload.ts`, `build3DAvatarScript.ts`.
- `mappers/mapClinicalToNarrative.ts`, `mapConditionToEducation.ts`, `mapKitToNarrativeBundle.ts`, `mapSeverityToTone.ts`, `mapTherapyToTimeline.ts`.
- `formatters/{formatAvatarSpeech,formatBulletList,formatDoctorSections,formatPatientSections,formatTimeline}.ts`.
- `validators/validateAvatarScript.ts`.
- `constants.ts` — `DIAGNOSIS_LABELS`, `ROOT_CAUSE_LABELS`, `RECOVERY_WINDOWS`, `THERAPY_NEED_LABELS`, `THERAPY_NEED_PATIENT_LABELS`, `FOLLOWUP_PRIORITY_BY_SEVERITY`.

### 4.5 Explanation Builders
`src/packages/ai-engine/explanations/builders/`:
- `buildPatientSummary.ts` · `buildDoctorSummary.ts`
- `buildKitExplanation.ts` · `buildProtocolExplanation.ts`
- `buildClinicalReasoning.ts` · `buildNarrative.ts`

Composers: `composers/` (per-audience prose assembly). Templates: `templates/{patient, doctor, prognosis, therapies, lifestyle}/`. Dictionaries: `dictionaries/`. Expansion: `expansion/therapyNeedExpansions.ts` (driver / therapy-need vocabulary).

## 5. Recovery Milestones
Defined in `narrative-engine/constants.ts → RECOVERY_WINDOWS` keyed by `DiagnosisKey`. Standard per-kit windows from `all-kits-info.txt`:
- W2–4: noticeable reduction in daily hair fall
- W6–8: improved strength, reduced shedding variability
- W10–12: visible early regrowth and cycle normalisation

Per ConsultationModel ([`../CONSULTATION_EXPERIENCE_ARCHITECTURE.md`](../CONSULTATION_EXPERIENCE_ARCHITECTURE.md) §2):
- `monitoring: MonitoringWindow[4]` → M0, M3, M6, M12
- `outcomes:   OutcomeWindow[4]` → 30, 90, 180, 365 days

## 6. Insight Generation Flow
```
ClinicalProfile (from evaluateClinicalProfile)
   + KitRecommendation (from kit-scorer)
   + PatientAnswers
                │
                ▼
   buildClinicalInsightStory()    → ClinicalInsightStory {drivers[], rootCauseAnalysis, narrative}
                │
                ▼
   composeNarrativeV3(ClinicalReport)
       │  Signals → Barriers → Strategy → Kits → Ingredients → Outlook → Lifestyle
       ▼
   NarrativeReportV3 {clinicalSummary, recoveryStrategy, recommendedKits, recoveryOutlook, dietLifestyle}
                │
                ▼
   buildPatientReport()  → patient PDF / web view
   buildDoctorReport()   → clinician one-pager
   buildWhatsAppSummary() → channel-specific extract
   build3DAvatarScript()  → avatar dialogue scenes
```

## 7. Section Generation Rules
- **Five-question filter** ([`../REPORT_PHILOSOPHY.md`](../REPORT_PHILOSOPHY.md) §3): every section maps to exactly one of the five questions; sections that don't are deleted.
- **Specificity pipeline** ([`../CONSULTATION_EXPERIENCE_ARCHITECTURE.md`](../CONSULTATION_EXPERIENCE_ARCHITECTURE.md) §6): candidate paragraph passes if it matches diagnosis, gender, severity, any required driver, no contraindicated driver. If no candidate remains, emit honest minimal section — never generic fallback.
- **Per-section rules:** [`../SECTION_BY_SECTION_CONTENT_RULES.md`](../SECTION_BY_SECTION_CONTENT_RULES.md).
- **Forbidden in patient view:** registry / pathway / signal / cause IDs · raw scores · enum strings · template variables · words "engine / pipeline / registry / score / artifact" ([`../NARRATIVE_GOVERNANCE_RULES.md`](../NARRATIVE_GOVERNANCE_RULES.md)).

## 8. Prompt Architecture
The narrative engine is **deterministic and AI-free** (`composeNarrativeV3.ts` line 5–6: *"Deterministic, no AI. Every line is grounded in the report's already-validated data; this module only re-voices and prunes for the patient lens."*).

There are **no LLM prompts** in the report pipeline. Personalization is done by:
- Lookup tables (`DIAGNOSIS_LABELS`, `ROOT_CAUSE_LABELS`, `THERAPY_NEED_PATIENT_LABELS`, etc.)
- Template fragments (`explanations/_fragmentUtils.ts`, `templates/`)
- Conditional inclusion filters (specificity pipeline)
- Tone modulation via `mapSeverityToTone.ts` (empathetic / warm / measured)

This is a deliberate design choice — it guarantees byte-identical reports for the same input (`HAIROS_REPORT_SYSTEM_SPECIFICATION.md` §1.5 reconstructability).

## 9. Rendering Surfaces (code)
- Patient web: `apps/patient-portal/src/app/assessment/[id]/report/page.tsx` + `components/report/{ClinicalReportView,PatientNarrativeV3,NarrativeSection,EnrichedKnowledge}.tsx`.
- PDF: `src/packages/ai-engine/pdf-engine/` + `buildPDFPayload.ts`.
- WhatsApp: `src/packages/ai-engine/whatsapp-engine/` + `buildWhatsAppSummary.ts`.
- Doctor dashboard card: `buildDoctorDashboardCard.ts`.
- Avatar script: `build3DAvatarScript.ts` (script only — no renderer; see `09_VIDEO_ARCHITECTURE.md`).

## 10. Tests / Fixtures
- `src/packages/ai-engine/narrative-engine/tests/{narrativePipeline,avatarScript}.test.ts`
- `src/packages/ai-engine/narrative-engine/fixtures/{narrativeFixtures,avatarFixtures}.ts`
- `scripts/preview-insight-story.ts` (recent: `e7df5e8 Fix narrative composer falling into fallback on every case`)
- `scripts/dermatologist-review/` + `docs/dermatologist-review-v1/` — 25-case blind review pack (per `MEMORY.md` `project_replay_corpus_v2`).
- `docs/replay-corpus-v2/` — 200 clinical regression cases.

## 11. Recent Activity (git)
- `64865e0` Restore section emoji icons on assessment step header
- `6bb423a` Wire Clinical Insight & Recovery Story into report UI and PDF
- `dd4e844` Add Clinical Insight & Recovery Story narrative generator
- `e7df5e8` Fix narrative composer falling into fallback on every case
- `b92be08` Add root-cause precedence to phase sequencing

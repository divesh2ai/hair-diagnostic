# 00 — Repository Audit

## Executive Summary
HairOS is a multi-package Next.js + TypeScript clinical platform for hair-loss consultation, built around the Dr.FACT clinical protocol. The repo blends a working Next.js patient-portal (`apps/patient-portal`), a large clinical AI engine package (`src/packages/ai-engine`), and a very rich body of constitutional / specification markdown at the repo root. Most "knowledge" already lives in root `.md` files; code is the execution layer. This audit lists every primary location so the remaining docs in `HAIROS_MASTER_CONTEXT/` can link rather than duplicate.

## 1. Application Code (Patient Portal — Next.js 15 custom build)
Root: `apps/patient-portal/src/`

| Area | Path | Purpose |
|---|---|---|
| Landing | `app/page.tsx` → `components/education/RootCauseStory.tsx` | Public marketing/education entry |
| Clinic-scoped flow | `app/(public)/q/[clinicSlug]/page.tsx` | Per-clinic landing page (QR entry) |
| Questionnaire | `app/(public)/q/[clinicSlug]/assessment/page.tsx` | Dynamic protocol-driven questionnaire |
| Processing | `app/(public)/q/[clinicSlug]/processing/[assessmentId]/page.tsx` + `components/processing/CinematicProcessing.tsx` | 4-phase "report preparation" experience |
| Preview | `app/(public)/q/[clinicSlug]/preview/[assessmentId]/page.tsx` | Mid-flight teaser |
| Report | `app/assessment/[id]/report/page.tsx` + `components/report/*` | Full V3 patient report |
| Science page | `app/(public)/q/[clinicSlug]/science/page.tsx` | Methodology / trust page |
| Doctor view | `app/doctor/page.tsx` | Clinician handoff |
| Admin | `app/admin/`, `app/sandbox/` | Internal tooling |
| API | `app/api/{assessment,clinics,doctor,admin,sandbox,upload}/*` | Server routes |
| Runtime engines | `runtime/{visibilityEngine,skipEngine,optionFilterEngine,stepResolver,progressEngine,protocolLoader,signalExtractor,protocolAdapter}.ts` | Generic protocol renderer |
| Questionnaire UI v2 | `components/questionnaire/v2/*` | Cinematic single-question UX |
| State | `stores/useAssessmentStore.ts` | Zustand assessment store |
| Shared types | `packages/shared/types/assessment.ts` | Cross-package contracts |

App-local rule (binding): `apps/patient-portal/AGENTS.md` warns "This is NOT the Next.js you know" — consult vendored docs in `node_modules/next/dist/docs/` before code changes.

## 2. AI / Clinical Engine
Root: `src/packages/ai-engine/`

| Engine | Path | Role |
|---|---|---|
| clinical-engine | `clinical-engine/{evaluateClinicalProfile,deriveSignals,scoreConditions,signals,buildProtocol,buildTopicals,generateSnapshot}.ts` + `rules/`, `kits/`, `protocols/`, `contraindications/` | Signal extraction → diagnosis scoring → protocol assembly |
| signal-registry | `signal-registry/` | Canonical signal definitions |
| cause-registry | `cause-registry/{catalog,engine,types}.ts` | Root-cause Bayesian ranker |
| pathway-engine | `pathway-engine/` | Mechanism pathways |
| kit-scorer | `kit-scorer/{protocolSequencer,scoreKits,resolveKit,adjunctProtocolEngine}.ts` + `rules/` (16 rules), `ranking/{kitCapCalculator,kitPrioritizer}.ts` | Final kit selection + ordering |
| therapy-engine | `therapy-engine/` | Therapy-need derivation |
| explanations | `explanations/{builders,composers,dictionaries,expansion,templates,utils}` | Patient & doctor explanation generation |
| narrative-engine | `narrative-engine/{buildFinalNarrative,build3DAvatarScript,buildPatientReport,buildDoctorReport,buildWhatsAppSummary,buildPDFPayload,buildDoctorDashboardCard,narrativePipeline}.ts` + `formatters/`, `mappers/`, `validators/`, `fixtures/` | Final voice / WhatsApp / PDF / 3D avatar script |
| report-engine | `report-engine/{buildClinicalReport,buildClinicalInsightStory,buildFinalClinicalAssessment}.ts` + `v3/{composeNarrativeV3,barrierMap,ingredientMechanisms,kitBrandNames,types}.ts` | V3 narrative composer (Signals → Barriers → Strategy → Kits → Ingredients → Outlook → Lifestyle) |
| questionnaire-engine | `questionnaire-engine/{protocol/masterProtocol.ts, schema/questionnaire.schema.json, schema/clinical-engine.schema.json, schema/topical-engine.schema.json}` | Single source of truth for questions |
| knowledge-engine | `knowledge-engine/` | Topical / ingredient knowledge retrievers |
| pdf-engine, whatsapp-engine | `pdf-engine/`, `whatsapp-engine/` | Output channels |
| avatar-engine | `avatar-engine/` | **EMPTY DIRECTORY** — placeholder only |
| recommendation-engine | `recommendation-engine/` | Reasoning layer per RDE constitution |

## 3. Constitutional / Specification Markdown (Repo Root)
These are the authoritative knowledge sources — all other docs in this folder reference them.

| File | Domain |
|---|---|
| `HAIROS_CLINICAL_INTELLIGENCE_MASTER_KNOWLEDGE_MODEL.md` | Top-level model of clinical intelligence |
| `HAIROS_RECOMMENDATION_DECISION_ENGINE_CONSTITUTION.md` | RDE reasoning chain (Root Cause → Objective → Capability → Class → Candidate → Eligibility → Recommendation) |
| `HAIROS_REPORT_SYSTEM_SPECIFICATION.md` | Report contract (5 report types, 9 mandatory sections) |
| `REPORT_PHILOSOPHY.md` | Five-question editorial filter |
| `PATIENT_REPORT_V3_SPEC.md` | 12-section V3 patient report layout |
| `DOCTOR_REPORT_V3_SPEC.md` | One-page clinician handoff |
| `DASHBOARD_V3_SPEC.md` | 8-card in-app dashboard |
| `NARRATIVE_GOVERNANCE_RULES.md` | Voice / leakage blocklist |
| `SECTION_BY_SECTION_CONTENT_RULES.md` | Per-section content rules |
| `CONSULTATION_EXPERIENCE_ARCHITECTURE.md` | Three-surface architecture + Consultation Composer |
| `CONDITION_KIT_MAPPING_REFERENCE.md` | **Authoritative Q1–Q13 → kit rules + phase sequencer** (v2, governance overrides 2026-06-08) |
| `HAIROS_SIGNAL_REGISTRY_V1.md` | Canonical signals |
| `HAIROS_INGREDIENT_INTELLIGENCE_MASTER_V1.md` | Ingredient → mechanism dictionary |
| `HAIROS_FOLLICULAR_BIOLOGY_INTELLIGENCE.md` | Follicular mechanism knowledge |
| `HAIROS_CLINICAL_EXPLANATION_AND_NARRATIVE_ENGINE.md` | Narrative composer contract |
| `HAIROS_CLINICAL_EXECUTION_HARNESS_CEH_V1.md` | Replay/test harness spec |
| `HAIROS_PHASE_5A_REGISTRY_GOVERNANCE_CONSTITUTION.md`, `HAIROS_PHASE_5B_REGISTRY_SPECIFICATION_CONSTITUTION.md` | Registry governance |
| `HAIROS_UX_CONTRACT_SPECIFICATION.md`, `HAIROS_UX_CONTRACT_CONSTITUTIONAL_ENHANCEMENTS.md` | UX contract |
| `HAIROS_EXPLAINABILITY_AND_CLINICAL_TRUST_REMEDIATION_V1.md` | Trust layer |
| `HAIROS_CONSTITUTIONAL_TEST_CORPUS_V1.md` | Replay/golden corpus |
| `LEGACY_FRONTEND_AUDIT.md`, `MIGRATION_GUIDE.md`, `MIGRATION_EXECUTION_PLAN.md`, `PHASE_1_COMPLETION_SUMMARY.md`, `IMPLEMENTATION_DIFFS.md`, `CURRENT_STATE.md`, `PROJECT_STATUS.md` | Migration history |
| `CONTENT_EXPANSION_IMPLEMENTATION.md`, `CONTENT_EXPANSION_QUICK_REFERENCE.md`, `GATES_DELIVERABLE_SUMMARY.md`, `VERIFICATION_GATES_IMPLEMENTATION.md` | Content/gate workstreams |

## 4. Secondary Docs Folder
- `docs/PROTOCOL_RUNTIME_ARCHITECTURE.md` — frontend runtime engines
- `docs/FLOW_EXECUTION_MAP.md` — end-to-end flow map
- `docs/BRANCHING_ENGINE_SPEC.md` — protocol branching semantics
- `docs/supabase-policies.md` — DB RLS
- `docs/dermatologist-review-v1/` — human-evaluation harness
- `docs/narrative-recovery-audit/`, `docs/replay-corpus-v2/` — QA corpora
- `data/docs/{DrFACT_Condition_Mapping_New.txt, DrFACT_Protocol_Sequencer updated.txt, Phenotype Kits Indications.txt}` — flat text exports of source xlsx

## 5. Source Data (Binary — cite, do not parse)
- `Kits & Product.xlsx` — kit catalog master
- `All Kits  Info.docx` — kit clinical narratives
- `DrFACT_Protocol_Sequencer Final.xlsx` — phase sequencer source
- `DrFACT_Condition_Mapping_Latest Final.xlsx` — condition→kit mapping
- `Trichology Manual.docx` — reference text
- `all-kits-info.txt` — readable export of kit copy (used by report engine)

## 6. Tests / Tooling
- `tests/`, `scripts/{generate-baselines,run_orchestrator,preview-insight-story,dermatologist-review,replay-corpus}.ts`
- `prisma/` — DB schema (Doctor / Patient / Clinic / OrganizationMember per `MEMORY.md` JWT hook entry)
- `legacy/google-ai-studio/` — historical exports
- `outputs/`, `hairOS_output/`, `hairos_unpacked/` — generated artifacts

## 7. Notable Empty / Placeholder Locations
- `src/packages/ai-engine/avatar-engine/` — empty
- `apps/patient-portal/src/components/visuals/` — empty
- `apps/patient-portal/src/config/questionnaire/questions.ts` — explicitly deprecated stub; protocol now loads from `src/packages/ai-engine/questionnaire-engine/schema/questionnaire.schema.json`
- `apps/patient-portal/src/components/processing/OrchestrationProgress.tsx` — deleted in working tree

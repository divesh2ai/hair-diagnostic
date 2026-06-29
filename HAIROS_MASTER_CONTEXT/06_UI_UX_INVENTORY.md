# 06 — UI / UX Inventory

## Executive Summary
The patient portal is a Next.js 15 (custom build — see `apps/patient-portal/AGENTS.md`) app with Tailwind, Framer Motion, Radix-style UI primitives in `components/ui/`, and Zustand state. The UX philosophy is **cinematic but calm**: one question per screen during intake (V2 shell), an honest 4-phase processing screen that never finishes ahead of the backend, a five-question-anchored 12-section report, and an 8-card dashboard. All patient-facing surfaces share the engine output via a `ConsultationModel` (per [`../CONSULTATION_EXPERIENCE_ARCHITECTURE.md`](../CONSULTATION_EXPERIENCE_ARCHITECTURE.md)). The dashboard and report specs are canonical: [`../DASHBOARD_V3_SPEC.md`](../DASHBOARD_V3_SPEC.md) · [`../PATIENT_REPORT_V3_SPEC.md`](../PATIENT_REPORT_V3_SPEC.md) · [`../DOCTOR_REPORT_V3_SPEC.md`](../DOCTOR_REPORT_V3_SPEC.md).

## 1. Major Screens & Components

| Screen | Route | Top-level component | Notes |
|---|---|---|---|
| Marketing landing | `/` | `RootCauseStory.tsx` | 5-act scroll story (Hero / GWAS / 13 triggers / Selective damage / ROS) |
| Clinic landing | `/q/[clinicSlug]` | `app/(public)/q/[clinicSlug]/page.tsx` | QR entry, store reset, Begin |
| Questionnaire | `/q/[clinicSlug]/assessment` | `QuestionnaireShellV2` + `QuestionRendererV2` | Single-question cinematic |
| Processing | `/q/[clinicSlug]/processing/[id]` | `CinematicProcessing.tsx` | 4-phase calm reveal, "bloom" SVG |
| Preview | `/q/[clinicSlug]/preview/[id]` | `app/(public)/q/[clinicSlug]/preview/[assessmentId]/page.tsx` | Mid-flight teaser |
| Patient report | `/assessment/[id]/report` | `ClinicalReportView.tsx` + `PatientNarrativeV3.tsx` + `NarrativeSection.tsx` + `EnrichedKnowledge.tsx` | 12 sections, PDF-ready |
| Assessment dashboard (staff) | (internal) | `AssessmentDashboard.tsx` | Status banner, artifact cards, event timeline |
| Doctor view | `/doctor` | `app/doctor/page.tsx` | One-page clinician handoff |
| Science page | `/q/[clinicSlug]/science` | `app/(public)/q/[clinicSlug]/science/page.tsx` | Methodology / trust |
| Sandbox | `/sandbox` + `components/sandbox/` | Dev preview tools | Dev only |

## 2. Design Tokens / System
- Tailwind config: `apps/patient-portal/tailwind.config.ts`
- Global CSS / variables: `apps/patient-portal/src/app/globals.css`
- Layout shell: `apps/patient-portal/src/app/layout.tsx`
- UI primitives: `apps/patient-portal/src/components/ui/` (Button, etc.)
- Shared layout helpers: `apps/patient-portal/src/components/layout/`, `shared/`, `transitions/`
- Cinematic primitives: `components/cinematic/{CinematicContainer,CinematicVisualPanel}.tsx`
- Error boundary: `components/ErrorBoundary.tsx`
- Fonts: Fraunces (serif headings) — referenced as `font-[family-name:var(--font-fraunces)]` in `RootCauseStory.tsx`.

## 3. Questionnaire V2 Pattern
- **Single question per screen** (`QuestionRendererV2.tsx`).
- **Multi-select dock** at bottom of screen with explicit "Confirm" (`MultiSelectDock.tsx`) — eliminates premature advance.
- **Section intros** (`SectionIntro.tsx`) — one card transition between sections; dismissed-once-per-session.
- **Insight moments** (`InsightMoment.tsx` + `insightRules.ts`) — mid-flow reassurance, never advice.
- **Image-select cards** (`ImageSelectCard.tsx`) — used for Norwood / Ludwig grade picker (object-contain illustration mode) and photographic option cards (object-cover image mode).
- **Progress header** (`ProgressHeader.tsx`) — category label + percentage; computed by `runtime/progressEngine.ts` from visible questions only.
- **Question transitions** (`components/transitions/QuestionTransition.tsx`) — fade/slide.

### Category icons (UI labels — `assessment/page.tsx`)
👋 About you · 💇 Hair health · 🔬 Scalp · ❤️ Internal health · 🥗 Nutrition · 🧘 Lifestyle · ⚖️ Hormonal · 🩺 Medical history.

(Section emoji icons were recently restored — git log `64865e0 Restore section emoji icons on assessment step header`.)

## 4. Cinematic Processing
`components/processing/CinematicProcessing.tsx`. Design intent (from file docstring):
- 4 real phases mapped 1:1 to the pipeline. The user never finishes ahead of the backend.
- Single editorial motif: "bloom" of concentric rings that warms and fills as phases complete (SVG + framer-motion, no WebGL).
- Daylight palette: cream, blush, warm gold.
- Honest ETA: calmly worded range tied to active phase, not a countdown.
- Polls `/api/assessment/status`.

## 5. Patient Report V3 (canonical sections)
Per [`../PATIENT_REPORT_V3_SPEC.md`](../PATIENT_REPORT_V3_SPEC.md):

| # | Section | Answers |
|---|---|---|
| 1 | Current Hair Assessment | Q1 |
| 2 | What We Found (Top 5 findings) | Q1 → sets up Q2 |
| 3 | Understanding Your Hair Loss (follicular biology) | Q3 |
| 4 | Root Cause Analysis (Primary / Secondary / Contributing) | Q2 |
| 5 | Treatment Priority Roadmap | Q4 sequencing |
| 6 | Personalized Protocol (Phase 1–4 kits) | Q4 what |
| 7 | Topical Plan (scalp-specific) | Q4 what |
| 8 | Lifestyle Prescription | Q4 behaviour |
| 9 | Ingredient Intelligence | Q3 mechanism |
| 10 | Monitoring Plan | Q5 |
| 11 | Expected Outcomes (30 / 90 / 180 / 365 d) | Q5 |
| 12 | Doctor Notes / OPD page | (all) |

Length: 14–18 pp; reading time ~12 min; patient-priority subset (§1, §2, §5, §11) in ~3 min.

## 6. Dashboard V3 (8 cards)
Per [`../DASHBOARD_V3_SPEC.md`](../DASHBOARD_V3_SPEC.md):

| # | Card | Answers | Default |
|---|---|---|---|
| 1 | Current Hair Status | Q1 | Expanded |
| 2 | Primary Drivers | Q2 | Expanded |
| 3 | Treatment Roadmap | Q4 sequence | Expanded |
| 4 | Recommended Protocols | Q4 what | Expanded |
| 5 | Monitoring Timeline | Q5 | Collapsed |
| 6 | Expected Recovery Journey | Q5 | Collapsed |
| 7 | Lifestyle Priorities | Q4 behaviour | Collapsed |
| 8 | Doctor Notes | all | Collapsed |

Forbidden everywhere: numeric scores, raw enums, registry / pathway / signal / cause IDs, words "engine / pipeline / registry / score / artifact" (per `NARRATIVE_GOVERNANCE_RULES.md`).

## 7. Doctor View
Per [`../DOCTOR_REPORT_V3_SPEC.md`](../DOCTOR_REPORT_V3_SPEC.md): one-page printable handoff containing severity scoring, progression risk numerics, driver mechanisms, monitoring thresholds. Acceptance: dermatologist can write a prescription in 60 seconds.

## 8. Visual / Cinematic Library
- `components/cinematic/` — reusable cinematic frames.
- `components/visuals/` — currently empty placeholder.
- `public/clinical-visuals/manifest.json` — asset manifest for clinical illustrations.
- Question-level photography / illustration per option: `image{url,alt}` (4:3 crop, object-cover) and `illustration{url,alt}` (object-contain, transparent). (`masterProtocol.ts` `SchemaOption`.)

## 9. Feedback / Upload
- `components/feedback/`, `components/upload/` — patient feedback and image upload flows. (Used for image-evidence section of the report per `PATIENT_REPORT_V3_SPEC.md`.)

## 10. Accessibility / Voice
Many schema questions carry `uiMetadata.voiceEnabled: true`. [INFERRED] — voice input handler not located; the field is present per `masterProtocol.ts` `SchemaUIMetadata`.

## 11. Forbidden Patterns (from `NARRATIVE_GOVERNANCE_RULES.md`)
- No registry / pathway / signal / cause IDs in patient surfaces.
- No raw scores, confidence numerics, or probabilities.
- No enum strings (e.g., `CAUSE_AGA_HORMONAL`).
- No artifact / pipeline / engine references.
- Enforced at three layers: type-level, composer-level (allowlist), render-level (final lint pass).

# 02 — Patient Journey

## Executive Summary
The patient enters HairOS through a clinic-specific QR-code link, lands on a clinic-branded intro screen, walks through a single-question-at-a-time cinematic questionnaire (Dr.FACT protocol, ~21 questions across 6 sections), watches a calm 4-phase "report preparation" experience while the orchestrator runs, and arrives at a 12-section V3 patient report. Two adjacent surfaces (Preview, In-app Dashboard) and one clinician surface (Doctor view) share the same underlying `ConsultationModel`. Checkout / commerce is not implemented in this repo. [MISSING]

## 1. End-to-End Text Flow Diagram

```
        ┌────────────────────────────────┐
        │ Marketing landing (optional)   │  apps/patient-portal/src/app/page.tsx
        │ RootCauseStory.tsx (5 acts)    │  → routes to /q/drfact-mumbai
        └──────────────┬─────────────────┘
                       │ CTA: "Start your assessment"
                       ▼
        ┌────────────────────────────────┐
        │ Clinic landing  /q/[clinicSlug]│  app/(public)/q/[clinicSlug]/page.tsx
        │  – fetches /api/clinics/:slug  │  – resets prior assessment state on QR scan
        │  – sets clinic in store        │
        └──────────────┬─────────────────┘
                       │ "Begin"
                       ▼
        ┌────────────────────────────────┐
        │ Questionnaire                  │  app/(public)/q/[clinicSlug]/assessment/page.tsx
        │  QuestionnaireShellV2          │  components/questionnaire/v2/*
        │  • SectionIntro card           │
        │  • QuestionRendererV2 (1/page) │
        │  • MultiSelectDock             │
        │  • InsightMoment (mid-flow)    │
        │  Protocol drives EVERYTHING:   │  src/packages/ai-engine/questionnaire-engine/
        │  – visibility, skip, filtering │     schema/questionnaire.schema.json
        │  – signal extraction           │  runtime/{visibility,skip,optionFilter,…}Engine.ts
        └──────────────┬─────────────────┘
                       │ POST /api/assessment/submit
                       ▼
        ┌────────────────────────────────┐
        │ Processing — Cinematic         │  app/(public)/q/[clinicSlug]/processing/[id]/page.tsx
        │  4 real phases, calm UI        │  components/processing/CinematicProcessing.tsx
        │  Polls /api/assessment/status  │  Patient never finishes ahead of backend
        │  "Bloom" SVG fills as phases   │
        │  complete; honest ETA          │
        └──────────────┬─────────────────┘
                       │ status === 'complete'
                       ▼
        ┌────────────────────────────────┐
        │ Preview (optional)             │  app/(public)/q/[clinicSlug]/preview/[id]/page.tsx
        │  Mid-flight teaser screen      │  (one-screen reveal before full report)
        └──────────────┬─────────────────┘
                       ▼
        ┌────────────────────────────────┐
        │ V3 Patient Report              │  app/assessment/[id]/report/page.tsx
        │  12 sections, 14–18 pp PDF     │  components/report/{ClinicalReportView,
        │  +printable                    │   PatientNarrativeV3, NarrativeSection,
        │                                │   EnrichedKnowledge}.tsx
        └──────────────┬─────────────────┘
                       │
              ┌────────┴─────────┐
              ▼                  ▼
   ┌──────────────────┐  ┌──────────────────────┐
   │ Dashboard V3     │  │ Doctor View          │
   │ 8 cards (in-app) │  │ /doctor (clinic OPD) │
   └──────────────────┘  └──────────────────────┘

   [MISSING in repo] Checkout / payment / kit fulfillment / follow-up cadence
```

## 2. Screen-by-Screen Inventory

| # | Screen | Route / Component | Purpose |
|---|---|---|---|
| 0 | Marketing landing | `app/page.tsx` → `components/education/RootCauseStory.tsx` | Five-act scroll story; CTA to `/q/drfact-mumbai` |
| 1 | Clinic landing | `app/(public)/q/[clinicSlug]/page.tsx` | Fetch clinic, set store, reset prior state, "Begin" |
| 2 | Questionnaire shell | `components/questionnaire/v2/QuestionnaireShellV2.tsx` | Frame: progress, back, category bar |
| 2a | Section intro | `components/questionnaire/v2/SectionIntro.tsx` | One-card section transition, dismissible |
| 2b | Question renderer | `components/questionnaire/v2/QuestionRendererV2.tsx` | Per-question UI; calls into runtime engines |
| 2c | Multi-select dock | `components/questionnaire/v2/MultiSelectDock.tsx` | Bottom-sheet confirm for multi-select |
| 2d | Image-select | `components/questionnaire/ImageSelectCard.tsx` | Photographic / illustrative tile picker (e.g. Norwood/Ludwig grades) |
| 2e | Insight moment | `components/questionnaire/v2/InsightMoment.tsx` + `insightRules.ts` | Mid-flow reassurance card based on accumulated answers |
| 2f | Progress header | `components/questionnaire/ProgressHeader.tsx` | Section + percentage |
| 3 | Submit | `app/api/assessment/submit/route.ts` | Persist + kick off orchestration |
| 4 | Processing (cinematic) | `app/(public)/q/[clinicSlug]/processing/[id]/page.tsx` + `components/processing/CinematicProcessing.tsx` | 4-phase calm UI; polls `/api/assessment/status` |
| 5 | Preview | `app/(public)/q/[clinicSlug]/preview/[id]/page.tsx` | Teaser/reveal before full report [INFERRED purpose] |
| 6 | Patient report | `app/assessment/[id]/report/page.tsx` + `components/report/ClinicalReportView.tsx` | Full 12-section V3 report; see §07 |
| 6a | Narrative sections | `components/report/{NarrativeSection,PatientNarrativeV3}.tsx` | V3 narrative voice |
| 6b | Enriched knowledge | `components/report/EnrichedKnowledge.tsx` | Ingredient / mechanism deep dives |
| 7 | Assessment dashboard | `components/assessment/AssessmentDashboard.tsx` (admin/staff) | Status + artifacts + event timeline |
| 8 | Doctor view | `app/doctor/page.tsx` | Clinician one-pager per `DOCTOR_REPORT_V3_SPEC.md` |
| 9 | Science page | `app/(public)/q/[clinicSlug]/science/page.tsx` | Methodology / trust page |

## 3. Questionnaire Flow Behavior
- Single source of truth: `src/packages/ai-engine/questionnaire-engine/schema/questionnaire.schema.json` (3,238 lines, 6 sections, 21 questions).
- Categories (UI labels): About you, Hair health, Scalp, Internal health, Nutrition, Lifestyle, Hormonal, Medical history. (`assessment/page.tsx` `CATEGORY_META`.)
- Visibility / skip / option-filtering are evaluated each step by `runtime/{visibilityEngine,skipEngine,optionFilterEngine,stepResolver}.ts`. The renderer is generic — no hardcoded clinical logic. See `docs/PROTOCOL_RUNTIME_ARCHITECTURE.md`.
- Multi-select rules: pairwise mutual exclusion (e.g., "Oily scalp" ↔ "Dry scalp"), exclusive `none`/`unsure` options, dynamic filter rules (e.g., goal options filtered for age ≥ 30 to hide Early Greying).
- Section intros are shown once per session; going back across a boundary does **not** re-show the intro (`assessment/page.tsx` lines 51–56).
- Insight moments fire mid-flow via `insightRules.pickInsightMoment` based on accumulated answers.

## 4. Processing Phases (Cinematic)
Per `components/processing/CinematicProcessing.tsx`:

| Phase | Eyebrow / Head (from PhaseCopy) | Purpose |
|---|---|---|
| 0 | "Warming up" | Pre-start |
| 1–4 | Four real backend phases mapped 1:1 to the orchestrator | Each phase only completes when the orchestrator confirms |
| Done | Routes to preview / report | |

Design principle (top of file): *"Honest timing: the user never finishes ahead of the backend; if a stage takes longer, the headline simply stays."*

## 5. State Management
- `stores/useAssessmentStore.ts` (Zustand + persist) holds protocol, current index, answers, progress, clinic data, submission state, derived signals.
- Reset on QR scan ensures cross-patient leakage cannot occur.
- Per `MEMORY.md`, the broader auth model uses Supabase JWT custom claims (user_role / clinic_id / organization_id) — see `project_jwt_custom_claims.md`.

## 6. Post-Report Surfaces
- **Dashboard V3** (8 cards) — `DASHBOARD_V3_SPEC.md`. In-app daily orientation.
- **Doctor Report V3** — `DOCTOR_REPORT_V3_SPEC.md`. One-page printable.
- **WhatsApp summary** — generated by `src/packages/ai-engine/narrative-engine/buildWhatsAppSummary.ts`.
- **PDF payload** — `src/packages/ai-engine/narrative-engine/buildPDFPayload.ts` + `pdf-engine/`.

## 7. Known Gaps
- Checkout / commerce / kit-purchase flow not implemented in this codebase. [MISSING]
- Follow-up cadence / reassessment scheduling not implemented (the spec defines Monitoring Report and Reassessment Report types in `HAIROS_REPORT_SYSTEM_SPECIFICATION.md` §2.3–§2.4 but no UI route exists). [MISSING]
- Patient-facing video / avatar rendering not implemented; see `09_VIDEO_ARCHITECTURE.md`.

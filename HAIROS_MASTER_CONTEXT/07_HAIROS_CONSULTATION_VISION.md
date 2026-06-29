# 07 — HairOS Consultation Vision (Forward-Looking Strategy)

## Executive Summary
This is the product-strategy synthesis: how HairOS should *feel* end-to-end when fully realized. It assembles every pre-existing constitutional doc, every implemented engine, and every gap into a single ideal patient journey — from QR scan to recovery dashboard at month 12 — anchored to the five clinical questions (What / Why / How / Do / Expect) and the three-surface architecture (Dashboard, Patient Report, Doctor Report). Where today's code already realizes the vision, this doc cites it; where it doesn't, it names the gap. This is intentionally aspirational but grounded in repo evidence.

## 1. The North Star
> "The patient must close the report knowing the one thing to do this week. The doctor must scan the doctor page in 60 seconds and write a prescription."
> — `CONSULTATION_EXPERIENCE_ARCHITECTURE.md` §9 acceptance tests

Three audiences. One `ConsultationModel`. Zero engine leakage.

## 2. The Eleven Stages of the Ideal Journey

### Stage 1 — First Contact (Trust)
**Goal:** patient understands they are entering a *clinical* experience, not a marketing funnel.
- QR scan → clinic-branded landing → name of attending physician [INFERRED — clinic data shape supports it; UI partial].
- One-sentence promise: "A dermatologist-grade assessment of why your hair is changing, and what to do first."
- Implemented: `/q/[clinicSlug]/page.tsx`. Already resets prior state on scan (prevents cross-patient leakage).
- Gap: no per-clinic physician branding on the splash. [MISSING]

### Stage 2 — Avatar Introduction (Companion)
**Goal:** a familiar consultative presence accompanies the patient through intake and again at the report.
- Vision: a calm, named avatar (the "Dr.FACT consultant") greets the patient: *"I'm going to ask 20 questions. Each one tells me something different about why your hair is changing. There is no wrong answer."*
- Implemented: 3D Avatar **script** generator (`src/packages/ai-engine/narrative-engine/build3DAvatarScript.ts`) — produces dialogue scenes (intro, understanding problem, why follicles weakened, what triggered shedding, how therapies work, how kits help, recovery expectations, compliance, outro). Tones: empathetic / warm. Validators present (`narrative-engine/validators/validateAvatarScript.ts`).
- Gap: **No rendering layer exists.** The script feeds an unbuilt avatar player. `src/packages/ai-engine/avatar-engine/` is an empty directory. See `09_VIDEO_ARCHITECTURE.md`. [MISSING]

### Stage 3 — Guided Questionnaire (Listening)
**Goal:** intake feels like being listened to by a clinician, not a form.
- Implemented: single-question-per-screen V2 shell with section intros (`components/questionnaire/v2/SectionIntro.tsx`), insight moments (`InsightMoment.tsx`), category-coded progress (👋 💇 🔬 ❤️ 🥗 🧘 ⚖️ 🩺). All branching / skip / option-filtering is protocol-driven via the runtime engines (`runtime/{visibility,skip,optionFilter,step,progress}Engine.ts`).
- Vision additions:
  - Voice input on free-text fields (`SchemaUIMetadata.voiceEnabled: true` already in the schema).
  - "Why am I being asked this?" microcopy on every clinical question — surfaces the `clinicalMapping[].implication` from the schema in plain language.
  - Live preview chip: as Q1–Q4 are answered, a small badge previews the *category* of the consultation ("We're seeing patterns consistent with X — keep going") **without** committing to a diagnosis. (Today's `InsightMoment` is the seed.)

### Stage 4 — Consultation Flow (Reasoning)
**Goal:** the clinical brain runs deterministically and honestly.
- Implemented chain: deriveSignals → scoreConditions → cause-registry (Bayesian softmax over 10 causes) → evaluateClinicalProfile → kit-scorer (16 rules) → protocolSequencer → buildProtocol. See `04_RECOMMENDATION_ENGINE.md`.
- Vision: every step writes to an append-only Canonical Ledger (per `HAIROS_REPORT_SYSTEM_SPECIFICATION.md` §1.5) so the report can be reconstructed byte-for-byte.

### Stage 5 — Condition Explanation (Understanding)
**Goal:** the patient learns *why* their follicles are failing, in the language of biology not jargon.
- Implemented: V3 narrative composer (`src/packages/ai-engine/report-engine/v3/composeNarrativeV3.ts`) runs the chain **Signals → Barriers → Strategy → Kits → Ingredients → Outlook → Lifestyle**. Each diagnosis has a barrier definition (`barrierMap.ts`) anchoring biology to root cause.
- Vision: condition-specific follicular animation embedded in the report (per `PATIENT_REPORT_V3_SPEC.md` §3) — DHT impact only if AGA, inflammation only if inflammatory drivers, etc. Strict gender / life-stage gating (no PCOS in male reports — `CONSULTATION_EXPERIENCE_ARCHITECTURE.md` §6).

### Stage 6 — Kit Explanation (Mechanism, Not Marketing)
**Goal:** every kit is justified by mechanism, never adjectives.
- Implemented: `src/packages/ai-engine/explanations/builders/buildKitExplanation.ts` + ingredient mechanisms (`report-engine/v3/ingredientMechanisms.ts`) + brand-name map (`kitBrandNames.ts`). Per kit: Diagnosis Insight → Therapeutic Strategy → Formulation Rationale → Expected Clinical Response → Clinical Note.
- Vision: each ingredient links to a tiny mechanism card ("Lactoferrin → improves ferritin → unlocks oxygen delivery to follicles → restores anagen"). Driver→ingredient→outcome is fully traversable. Backbone already present in `HAIROS_INGREDIENT_INTELLIGENCE_MASTER_V1.md`.

### Stage 7 — Timeline (Honest Expectations)
**Goal:** patient leaves knowing what week 4, month 3, month 6, month 12 should look like.
- Implemented: `src/packages/ai-engine/narrative-engine/buildFinalNarrative.ts` + `mappers/mapTherapyToTimeline.ts` + `constants.ts` (`RECOVERY_WINDOWS`). Standard windows: W2–4 / W6–8 / W10–12 (per kit) and M0 / M3 / M6 / M12 (per ConsultationModel `monitoring[4]` + `outcomes[4]`).
- Vision: a single timeline graphic with overlapping bands (Phase 1 → Phase 2 → Phase 3 → Phase 4) keyed to the patient's actual kits and their personal start date.

### Stage 8 — Lifestyle Coaching (Prescription, Not Advice)
**Goal:** lifestyle recommendations are clinical *prescriptions* — specific, dose-like, tied to drivers.
- Implemented: `src/packages/ai-engine/explanations/composers/` lifestyle composer + `report-engine/v3` `DietLifestyleSection` (5 lines max). `ConsultationModel.lifestyle: LifestyleItem[]`.
- Vision: each lifestyle item carries a (a) trigger evidence line, (b) mechanism line, (c) measurable check at M3 (e.g., "Sleep 7h 5+ nights/wk — measured at month-3 check-in"). No generic "eat well, sleep well."

### Stage 9 — The Report (The Artifact)
**Goal:** the report is the durable, signed, auditable clinical record. The patient and the doctor both trust it.
- Implemented: V3 patient report (`apps/patient-portal/src/app/assessment/[id]/report/page.tsx` + 12 sections per `PATIENT_REPORT_V3_SPEC.md`); WhatsApp summary (`buildWhatsAppSummary.ts`); PDF payload (`buildPDFPayload.ts` + `pdf-engine/`); Doctor handoff (per `DOCTOR_REPORT_V3_SPEC.md`).
- Vision: every report carries a content hash + engine version manifest in the audit footer (per `HAIROS_REPORT_SYSTEM_SPECIFICATION.md` §1.5). Two identical inputs → byte-identical reports.

### Stage 10 — The Avatar Video (Reinforcement)
**Goal:** a 90-second avatar-narrated walkthrough of the patient's *own* report.
- Vision: the avatar script from Stage 2 carries through to a personalized video at delivery — same voice that opened the consultation now closes it, walking the patient through their primary driver, their #1 kit, and their week-1 action.
- Today: avatar **script** generator exists; the **renderer** does not. See `09_VIDEO_ARCHITECTURE.md`. [MISSING]

### Stage 11 — Interactive Dashboard & Follow-Up
**Goal:** the report is the document; the dashboard is the daily companion.
- Implemented: 8-card Dashboard V3 (`DASHBOARD_V3_SPEC.md`) — Current Hair Status / Primary Drivers / Treatment Roadmap / Recommended Protocols / Monitoring Timeline / Expected Recovery Journey / Lifestyle Priorities / Doctor Notes.
- Vision: cards update as the patient logs progress, uploads photos, and answers M3/M6/M12 micro-questionnaires. Reassessment Report (`HAIROS_REPORT_SYSTEM_SPECIFICATION.md` §2.4) regenerates the consultation; Monitoring Report (§2.3) reports delta against baseline with explicit noise-floor statement (no false improvement claims).
- Today: reassessment / monitoring routes not implemented. [MISSING]

## 3. The Five-Question Anchor (binding)
Every screen, in every surface, is laid out to answer the five questions in order:
```
Q1 What    → Current Hair Assessment
Q2 Why     → What We Found → Root Cause Analysis
Q3 How     → Understanding Your Hair Loss (follicular biology)
Q4 Do      → Treatment Roadmap → Protocol → Topical → Lifestyle
Q5 Expect  → Monitoring → Expected Outcomes
```
(`REPORT_PHILOSOPHY.md` §1, `CONSULTATION_EXPERIENCE_ARCHITECTURE.md` §3.)

## 4. The Three-Surface Architecture (binding)
```
ConsultationModel (single source)
   ├── Dashboard V3 renderer    (in-app, conversational)
   ├── Patient Report V3 render (PDF, senior-dermatologist voice)
   └── Doctor Report V3 render  (one-page OPD)
```
The Consultation Composer is the **only** place that knows engine internals. The three renderers know only `ConsultationModel`. This is the structural guarantee against engine leakage. (`CONSULTATION_EXPERIENCE_ARCHITECTURE.md` §4–§5.)

## 5. Trust-Layer Guarantees (binding)
The patient surface NEVER contains: registry IDs · pathway IDs · signal IDs · cause IDs · raw scores / confidence numerics · enum strings · template variables · the words "engine / pipeline / registry / score / artifact". Enforced at three layers (type, composer, render lint pass). (`CONSULTATION_EXPERIENCE_ARCHITECTURE.md` §7.)

## 6. Future Roadmap (gaps to close)
| Gap | Spec | Status |
|---|---|---|
| 3D avatar rendering | `09_VIDEO_ARCHITECTURE.md` | Script exists; renderer empty |
| Personalized avatar video at delivery | Stage 10 above | [MISSING] |
| Reassessment route + Monitoring Report UI | `HAIROS_REPORT_SYSTEM_SPECIFICATION.md` §2.3–§2.4 | [MISSING] |
| Patient progress photo upload + delta | `components/upload/` | Partial |
| M3/M6/M12 micro-questionnaire | Stage 11 | [MISSING] |
| Commerce / checkout / fulfillment | (out of RDE scope) | [MISSING] in repo |
| Per-clinic physician branding | Stage 1 | [MISSING] |
| Voice intake on free-text fields | Schema field exists | [MISSING] handler |
| "Why am I being asked this?" microcopy | Schema `clinicalMapping[]` exists | [MISSING] surface |
| Audit Report rendering | `HAIROS_REPORT_SYSTEM_SPECIFICATION.md` §2.5 | [MISSING] UI |
| Reconstructable content hashes | §1.5 | [INFERRED — not verified in code] |

## 7. Acceptance Tests (binding — V3 ship gate)
From `CONSULTATION_EXPERIENCE_ARCHITECTURE.md` §9:
1. A patient reading the report can answer the five questions out loud.
2. A male patient's report contains zero PCOS / menstrual / pregnancy content.
3. A female patient's report does not assume male-pattern framing.
4. No patient-facing surface contains any string from the engine blocklist (lint passes clean).
5. A dermatologist scans the doctor page in 60 seconds and writes a prescription.
6. A patient closes the report knowing the one thing to do this week.

These six tests gate every release. The human-evaluation harness is in `docs/dermatologist-review-v1/` (25 cases, scoring form, feedback schema — per `MEMORY.md` `project_replay_corpus_v2`).

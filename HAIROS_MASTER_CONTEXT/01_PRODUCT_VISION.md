# 01 — Product Vision

## Executive Summary
HairOS / Dr.FACT is a dermatologist-grade hair-loss consultation operating system. Its central claim is that the modern hair-loss epidemic is **more epigenetic than genetic** — hair loss now arrives younger, with no family history and normal DHT — and that an explainable, evidence-bound clinical reasoning engine can deliver a doctor-quality consultation through a digital intake. The product is positioned as "the visible manifestation of clinical intelligence" — never marketing, always evidence rendered into language. (See `REPORT_PHILOSOPHY.md` §1.7.)

## 1. The Vision Sentence (from landing copy)
> "Your hair loss is *not* the story you were told. It now arrives younger, with no family history, and with perfectly normal DHT. The modern epidemic of hair loss is far more epigenetic than it is genetic."
> — `apps/patient-portal/src/components/education/RootCauseStory.tsx` (Act 1 hero, line 95)

## 2. Narrative Acts on the Landing Page
The landing experience (`components/education/RootCauseStory.tsx`) is a cinematic scroll-driven story in five acts that defines the worldview:

| Act | Eyebrow | Beat |
|---|---|---|
| 1. Hero | "A new understanding of hair loss" | Younger onset / No family history / Normal DHT |
| 2. GWAS data | "What the GWAS data revealed" | Genetics ≠ destiny — modern triggers dominate |
| 3. The 13 triggers | "The forces your genes answer to" | Sedentary life, Fatigue, Diet, Pollution, Hard water, Temperature/humidity, Circadian rhythm, Seasonal changes, EMF, Smoking, Alcohol, Stress, Sleep |
| 4. Selective damage | "Selective, progressive damage" | Inflammation, immunity/autoimmunity, DNA damage, early aging, epigenetic changes |
| 5. ROS unifying mechanism | "The single mechanism underneath it all" | ROS as the systemic driver; same damage extends to cardiac, insulin resistance, dyslipidemias, metabolic syndrome |
| CTA | "Start your assessment" | Routes to `/q/drfact-mumbai` clinic landing |

## 3. Mission (synthesized from constitutional docs)
Produce a **clinically defensible, auditable, explainable** recommendation for every patient, derived deterministically from `Root Cause → Clinical Objective → Capability → Intervention Class → Recommendation Candidate → Kit Eligibility → Recommendation` — never marketing, never opaque. (Source: `HAIROS_RECOMMENDATION_DECISION_ENGINE_CONSTITUTION.md` §7.)

## 4. Differentiators

| # | Claim | Backed by |
|---|---|---|
| D1 | Hair loss is treated as an epigenetic, multi-driver systemic problem — not a DHT story | Landing acts 1–5 |
| D2 | Every recommendation is reconstructable through a binding audit chain | RDE Constitution Part XII |
| D3 | Five-question editorial filter governs every patient-facing surface | `REPORT_PHILOSOPHY.md` §3 |
| D4 | The system refuses to fabricate — uncertainty is surfaced, not hidden | `NARRATIVE_GOVERNANCE_RULES.md` |
| D5 | Gender / life-stage filtering structurally prevents leakage (no PCOS in male reports, etc.) | `CONSULTATION_EXPERIENCE_ARCHITECTURE.md` §6 |
| D6 | Single `ConsultationModel` powers three surfaces (Dashboard, Patient Report, Doctor Report) with separate voices | `CONSULTATION_EXPERIENCE_ARCHITECTURE.md` §2–§4 |
| D7 | 30+ kits, deterministically sequenced into 4 phases (terrain → primary → systemic → consolidate) | `CONDITION_KIT_MAPPING_REFERENCE.md` §5 |
| D8 | Deterministic engines, no inference layer between patient input and recommendation | `HAIROS_RECOMMENDATION_DECISION_ENGINE_CONSTITUTION.md` "Determinism Class" |

## 5. Positioning
- **Voice (per `REPORT_PHILOSOPHY.md` §2):** "a senior dermatologist who has spent twenty minutes with the patient's case" — specific, mechanistic, calm, confident-not-absolute, honest about uncertainty.
- **What HairOS is NOT:** not a marketing brochure, not a generic hair-loss explainer, not an engine artifact dump, not a record of internal reasoning visible to patients.
- **Trust posture:** patients can read a report and answer all five core questions out loud; doctors can write a prescription from the doctor page in 60 seconds (`CONSULTATION_EXPERIENCE_ARCHITECTURE.md` §9 acceptance tests).

## 6. Target Audience
Three audiences, three surfaces, one underlying model:

| Audience | Surface | Voice |
|---|---|---|
| Patient (in-app) | Dashboard V3 (8 cards) | Conversational, glanceable |
| Patient (PDF / printed) | Patient Report V3 (12 sections, 14–18 pages) | Senior dermatologist, mechanistic |
| Clinician / OPD | Doctor Report V3 (one page) | Terse, technical, complete |

Distribution today is **clinic-scoped** — each clinic is reached via a clinic slug URL (`/q/[clinicSlug]`), suggesting QR-code intake at partner clinics (Dr. FACT brand). [INFERRED — based on `app/(public)/q/[clinicSlug]/page.tsx` reading `useAssessmentStore.setClinicData` and explicit reset on QR scan.]

## 7. Authoritative Sources for This Vision
- `apps/patient-portal/src/components/education/RootCauseStory.tsx` — landing copy
- `REPORT_PHILOSOPHY.md` — five-question filter, voice
- `HAIROS_RECOMMENDATION_DECISION_ENGINE_CONSTITUTION.md` — reasoning constitution
- `CONSULTATION_EXPERIENCE_ARCHITECTURE.md` — three-surface architecture
- `HAIROS_CLINICAL_INTELLIGENCE_MASTER_KNOWLEDGE_MODEL.md` — clinical model
- `NARRATIVE_GOVERNANCE_RULES.md` — what may never appear in patient-facing text

## 8. Gaps / Open Items [MISSING]
- No formal "About / Company" page exists in `apps/patient-portal/src/app/`. Brand authorship is implicit ("Dr. FACT"). [MISSING]
- Pricing, commercial model, payment flow not in code — RDE explicitly states "The RDE does not: Decide pricing, supplier choice, inventory" (§2). [MISSING from this repo]
- No public marketing site distinct from the patient flow.

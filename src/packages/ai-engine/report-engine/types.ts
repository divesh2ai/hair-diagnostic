/**
 * Clinical Report V4 — single source of truth JSON.
 *
 * Spec: HAIROS_REPORT_V4_FINAL_REDESIGN.
 *
 * Hard rules baked into the type:
 *  - Executive Summary, Monitoring Plan, all narratives, severity & confidence
 *    scores are REMOVED.
 *  - 6 sections only: Patient Summary, Root Cause Analysis (categorised),
 *    Treatment Strategy (kit-name driven), Recovery Roadmap (Month 1/3/6/9/12),
 *    Why HairOS Chose This Plan (no excluded signals), Personalized Diet &
 *    Lifestyle (condition-mapped).
 *  - Every statement traces back to a questionnaire signal.
 *  - Visual cards preferred over paragraphs — renderers enforce this.
 */

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 1 — Patient Summary
// ─────────────────────────────────────────────────────────────────────────────

/** Every questionnaire selection rendered verbatim to the patient. */
export interface QuestionnaireSelections {
  duration?: string;
  count?: string;
  grade?: string;
  hairType?: string[];
  scalp?: string[];
  cause?: string[];
  lifestyle?: string[];
  hormonal?: string[];
  thyroid?: string[];
  immunity?: string[];
  deficiency?: string[];
  gut?: string[];
  diet?: string[];
  treatment?: string[];
  goal?: string[];
}

/** One-line clinical translation of a specific patient signal. Max 4-6 shown. */
export interface ClinicalInterpretation {
  /** The raw signal as the patient selected it (e.g. "GERD"). */
  signal: string;
  /** Dermatologist condition label from the Q4–Q13 mapping (e.g. "Iron deficiency hair loss"). */
  condition?: string;
  /** Dermatologist-tone explanation of what this signal implies. */
  interpretation: string;
}

export interface PatientSummary {
  name: string;
  age: number;
  gender: string;
  /** Patient-stated goal(s) — e.g. "Reduce hair fall". */
  goal: string[];
  /** Reported duration of hair loss. */
  hairLossDuration?: string;
  /** Pattern signals — diffuse, thinning at crown, widening parting, etc. */
  hairLossPattern: string[];
  /** Scalp concerns — dandruff, redness, oily, etc. */
  scalpConcerns: string[];
  /** Lifestyle factors — smoking, alcohol, night shift, etc. */
  lifestyleFactors: string[];
  /** Medical factors — thyroid, hormonal, deficiency, gut, immunity flags. */
  medicalFactors: string[];
  /** Previous treatments tried. */
  previousTreatments: string[];
  /** Every selection raw, for the card grid. */
  questionnaireSelections: QuestionnaireSelections;
  /** Max 4-6 concise clinical observations derived from selections. */
  clinicalInterpretation: ClinicalInterpretation[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 2 — Root Cause Analysis (categorised)
// ─────────────────────────────────────────────────────────────────────────────

export type ImpactLevel = "High" | "Moderate" | "Low";

/**
 * Three buckets, each with a distinct clinical role:
 *  - Primary    → direct biological drivers of hair loss
 *  - Secondary  → contributors that worsen follicular recovery
 *  - Amplifier  → factors accelerating progression / reducing treatment response
 */
export type RootCauseCategory = "Primary" | "Secondary" | "Amplifier";

export interface RootCauseCondition {
  /** Display name of the condition / driver. */
  condition: string;
  category: RootCauseCategory;
  impact: ImpactLevel;
  /** Raw questionnaire signals that triggered this condition. */
  supportingSignals: string[];
  /** Why this matters in this patient's clinical picture — one sentence. */
  clinicalRelevance: string;
}

export interface RootCauseAnalysis {
  primary: RootCauseCondition[];
  secondary: RootCauseCondition[];
  amplifiers: RootCauseCondition[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGES 3-4 — Treatment Strategy (kit-name driven, no condition titles)
// ─────────────────────────────────────────────────────────────────────────────

/** Verbatim formulation-rationale group from "All Kits Info" — per-kit. */
export interface FormulationGroup {
  /** Functional grouping, e.g. "DHT modulators". */
  group: string;
  /** Ingredients in this group, exactly as named in the source doc. */
  ingredients: string[];
  /** What this group does — verbatim from the source. */
  action: string;
}

export interface TreatmentPhase {
  phase: number;
  kitId: string;
  /** Kit display name — shown as the card title. */
  displayName: string;
  /** Per-patient evidence chain. Cites the specific signals that selected this kit. */
  whySelected: string;
  /** Conditions from Root Cause Analysis this kit addresses. */
  supportingConditions: string[];
  /** Max 4-6 ingredients. Sourced from kit knowledge base. */
  keyIngredients: string[];
  /** Mechanism bullets — sourced from kit knowledge base. No essays. */
  mechanismOfAction: string[];
  /** Full verbatim formulation rationale groups from the kit knowledge base. */
  formulationGroups: FormulationGroup[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 5 — Recovery Roadmap (DEPRECATED — kept for back-compat, builder returns [])
// Replaced by universal Recovery Milestones below.
// ─────────────────────────────────────────────────────────────────────────────

/** Free-form month label, e.g. "Month 2", "Month 8". */
export type RoadmapMonth = string;

export interface RoadmapMilestone {
  timeframe: RoadmapMonth;
  biologicalFocus: string;
  expectedClinicalMilestone: string;
  kitDisplayName?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Universal Recovery Milestones — identical for every report.
// No kit names, no protocol names, no per-patient computation.
// ─────────────────────────────────────────────────────────────────────────────

export interface UniversalRecoveryMilestone {
  /** Time window label, e.g. "1–2 Months". */
  window: string;
  /** 3 verbatim expectation bullets per window. */
  bullets: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Final Clinical Assessment — doctor-style synthesis at the end of the report.
// Must contain no product / kit / ingredient / supplement language.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Final Clinical Assessment.
 *
 * Per HairOS Patient Video Narrative Engine spec — a personalised,
 * multilingual-ready video narration script intended for a doctor-avatar
 * voice/video pipeline. Second-person, warm, clinically accurate, free of
 * marketing language.
 *
 * Four-scene structure (each scene one short paragraph):
 *   1. WHAT WE FOUND               — diagnosis + key drivers + activity (15–20s)
 *   2. WHY IT IS HAPPENING         — biological drivers in plain language (10–15s)
 *   3. YOUR PERSONALIZED THERAPY   — each recommended therapy follows
 *                                    "We identified … To address this …
 *                                     This is intended to help …" (25–35s)
 *   4. WHAT TO EXPECT              — realistic, gradual recovery (15–20s)
 *
 * Target total length: 140–220 words. Critical rule: every therapy mentioned
 * in scene 3 must be tied to a finding identified in the assessment.
 *
 * Strictly forbidden in any scene: kit / protocol / supplement / product /
 * formulation / package / brand vocabulary; ingredient names; brand names;
 * pricing or promotional language; AI / algorithm / engine / model
 * references; guaranteed-success percentages; unsupported timelines.
 */
export interface FinalClinicalAssessment {
  /** Short title for the section / video file. */
  videoTitle: string;
  /** Scene 1 — what we found (15–20s). */
  scene1: string;
  /** Scene 2 — why it is happening (10–15s). */
  scene2: string;
  /** Scene 3 — personalised therapy plan; problem → therapy → benefit (25–35s). */
  scene3: string;
  /** Scene 4 — what to expect (15–20s). */
  scene4: string;
  /** All four scenes joined with `\n\n`, ready for a TTS / avatar pipeline. */
  fullNarration: string;
}

/**
 * Clinical Insight & Recovery Story.
 *
 * Replaces the traditional Doctor Summary. Used across the Patient Report,
 * Patient Dashboard, Doctor Dashboard, video narration, and avatar script.
 *
 * HairOS is NOT diagnosing, assessing, measuring, or grading — it is
 * interpreting information voluntarily shared by the patient. The voice must
 * reflect that: "Based on the information you shared with us…",
 * "Your responses highlight…" — never "Assessment shows…" / "We found…".
 *
 * Narrative model:
 *
 *   Selected Conditions → Biological Drivers → Hair Impact → Treatment Goals
 *                       → Narrative
 *
 * The narrative is generated FROM drivers, never directly from conditions.
 *
 * Hard rules:
 *  - 2–5 drivers per story. Driver tiers (Primary / Secondary / Contributing)
 *    are used INTERNALLY for ranking only and are NEVER displayed.
 *  - Section 3 must include the canonical personalisation statement and map
 *    drivers → treatment goals. No products, ingredients, or marketing tone.
 *  - Section 4 is structured internally as Stabilisation → Recovery →
 *    Resilience. Phase names are never displayed.
 *  - No timelines ("within X weeks/months"), no regrowth or density promises.
 *  - Target word counts per section:
 *      Section 1 (Your Hair Story):                60–90 words
 *      Section 2 (Why This May Be Happening):      80–120 words
 *      Section 3 (Why This Plan Was Recommended):  80–120 words
 *      Section 4 (What To Expect):                 60–90 words
 */
export interface InsightDriver {
  /** Patient-facing label, e.g. "Hormonal & Metabolic Dysfunction". */
  label: string;
  /** One-line hair impact in plain language. */
  hairImpact: string;
  /** Treatment goal this driver implies. */
  treatmentGoal: string;
  /** Recognition cue — patient-experience pattern this driver matches. */
  recognitionCue: string;
}

export interface ClinicalInsightStory {
  /** Section 1 — Your Hair Story (60–90 words). */
  yourHairStory: string;
  /** Section 2 — Why This May Be Happening (80–120 words). */
  whyThisMayBeHappening: string;
  /** Section 3 — Why This Plan Was Recommended (80–120 words). */
  whyThisPlanWasRecommended: string;
  /** Section 4 — What To Expect (60–90 words). */
  whatToExpect: string;
  /** 2–5 drivers ordered by internal tier (tier not exposed). */
  drivers: InsightDriver[];
  /** Deduplicated treatment-goal labels surfaced across the drivers. */
  treatmentGoals: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 6 — Why HairOS Chose This Plan
// ─────────────────────────────────────────────────────────────────────────────

export interface CategoryRationale {
  category: RootCauseCategory;
  /** Why this category of cause matters in this patient. */
  whyItMatters: string;
  /** Conditions that fell into this category. */
  conditions: string[];
}

export interface PlanReasoning {
  categories: CategoryRationale[];
  /** Why the chosen kit sequence is correct for this patient. */
  sequencingRationale: string;
  /** How the kits collectively address the complete biological picture. */
  collectiveRationale: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 7 — Personalized Diet & Lifestyle
// ─────────────────────────────────────────────────────────────────────────────

export interface DietLifestyleRecommendation {
  /** Detected condition the recommendation maps to. */
  condition: string;
  /** Concrete diet / lifestyle action. */
  recommendation: string;
  /** Expected clinical / biological benefit — one sentence. */
  expectedBenefit: string;
}

/**
 * Generic, condition-agnostic diet & lifestyle guidance.
 * Authored by the clinical team — same for every patient.
 */
export interface GeneralLifestyleGuide {
  /** Foods to avoid (may be consumed twice a week). */
  foodsToAvoid: string[];
  /** Foods to add to the diet. */
  foodsToAdd: string[];
  /** Lifestyle recommendations (sleep, exercise, smoking, alcohol, etc.). */
  lifestyleRecommendations: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Topical Recommendations
// ─────────────────────────────────────────────────────────────────────────────

export interface TopicalRecommendation {
  /** Product name as it appears in the topical database. */
  name: string;
  /** Application instructions for the patient. */
  usage: string;
  /** Clinical note / when this is used. */
  note: string;
  /** Why this topical was selected for this patient — evidence chain. */
  whySelected: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-level report
// ─────────────────────────────────────────────────────────────────────────────

export interface ClinicalReport {
  patientSummary: PatientSummary;
  rootCauseAnalysis: RootCauseAnalysis;
  treatmentStrategy: TreatmentPhase[];
  /** Topical recommendations alongside internal kits. */
  topicalRecommendations: TopicalRecommendation[];
  /** Topicals explicitly contraindicated for this patient (with reasons). */
  topicalCautions: { name: string; reason: string }[];
  /**
   * @deprecated Replaced by `recoveryMilestones`. Builder returns []; the
   * renderer no longer reads it. Kept on the type for one release of
   * downstream-consumer compatibility.
   */
  recoveryRoadmap: RoadmapMilestone[];
  /** Universal milestones — identical for every report. */
  recoveryMilestones: UniversalRecoveryMilestone[];
  /** Final dermatologist-style assessment shown at the end of the report. */
  finalClinicalAssessment: FinalClinicalAssessment;
  /** Written patient-facing Clinical Insight & Recovery Story (4 sections). */
  clinicalInsightStory: ClinicalInsightStory;
  whyHairosChoseThisPlan: PlanReasoning;
  /** Condition-mapped legacy recommendations (kept for back-compat). */
  dietAndLifestyle: DietLifestyleRecommendation[];
  /** Generic, condition-agnostic guidance shown to every patient. */
  generalLifestyleGuide: GeneralLifestyleGuide;
  /** Report schema version — bumped when the shape changes. */
  schemaVersion: "v4";
  generatedAt: string;
}

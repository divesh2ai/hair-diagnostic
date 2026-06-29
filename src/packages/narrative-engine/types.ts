/**
 * FourChapterNarrative — single canonical narrative payload for HairOS.
 *
 * Phase 1 scope: TYPE ONLY. Narrative content only.
 *
 * Hard rules:
 *  - Exactly four chapters. No fifth chapter. No alternative chapter sets.
 *  - Content-only. No presentation fields, no UI metadata, no video script,
 *    no PDF payload, no avatar script, no formatting helpers.
 *  - Chapter 2 is sourced strictly from ClinicalReport.patientSummary
 *    .clinicalInterpretation. RootCauseAnalysis, barrierMap, and
 *    rootCauseExpansions are forbidden inputs to chapter2.
 *  - Every renderer (PDF, Dashboard, Consultation, Avatar, Video, WhatsApp)
 *    must eventually consume only this type. Phase 1 does not migrate any
 *    renderer.
 *
 * Spec: docs/four-chapter-narrative/SCHEMA.md
 * Golden fixture: docs/four-chapter-narrative/sara.fourChapterNarrative.json
 */

// ─────────────────────────────────────────────────────────────────────────────
// Chapter 1 — What Is Happening To My Hair?
// Source: ClinicalReport.patientSummary
// ─────────────────────────────────────────────────────────────────────────────

export interface Chapter1 {
  /** Patient-reported pattern, e.g. ["Hair on pillow / floor / shower"]. */
  hairPattern: string[];
  /** Reported duration of hair loss, e.g. "6–12 months". */
  duration: string | null;
  /** Patient-reported scalp concerns. */
  scalpConcerns: string[];
  /** Patient-stated goal(s). */
  goal: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Chapter 2 — Why Is This Happening?
// Source: ClinicalReport.patientSummary.clinicalInterpretation ONLY.
// ─────────────────────────────────────────────────────────────────────────────

export interface Chapter2Factor {
  /** The raw patient signal that produced this factor. */
  signal: string;
  /** Dermatologist condition label, if mapped. */
  condition: string | null;
  /** Dermatologist-tone interpretation — taken verbatim from
   *  ClinicalInterpretation.interpretation. */
  interpretation: string;
}

export interface Chapter2 {
  /** Source policy marker. Always "clinicalInterpretation_only". Used by
   *  validators and the architectural test to enforce sourcing. */
  sourcePolicy: "clinicalInterpretation_only";
  /** One factor per ClinicalInterpretation row. Order preserved from the
   *  report. No fabrication, no fallback library content. */
  factors: Chapter2Factor[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Chapter 3 — How Will We Treat It?
// Source: ClinicalReport.treatmentStrategy
// ─────────────────────────────────────────────────────────────────────────────

export interface Chapter3Phase {
  /** 1-indexed phase number from TreatmentPhase.phase. */
  phase: number;
  /** Stable kit id. */
  kitId: string;
  /** Kit display name. */
  kitName: string;
  /** Per-patient evidence chain — verbatim from TreatmentPhase.whySelected. */
  whySelected: string;
  /** Root-cause conditions this kit addresses. */
  supportingConditions: string[];
}

export interface Chapter3 {
  phases: Chapter3Phase[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Chapter 4 — What Happens Next?
// Source: ClinicalReport.recoveryMilestones + dietAndLifestyle
// ─────────────────────────────────────────────────────────────────────────────

export interface Chapter4Stage {
  /** Time window label, e.g. "1–2 Months". */
  window: string;
  /** Verbatim expectation bullets for this window. */
  bullets: string[];
}

export interface Chapter4DietLifestyleItem {
  /** Detected condition the recommendation maps to. */
  condition: string;
  /** Concrete diet / lifestyle action. */
  recommendation: string;
  /** Expected clinical / biological benefit. */
  expectedBenefit: string;
}

export interface Chapter4 {
  stages: Chapter4Stage[];
  dietAndLifestyle: Chapter4DietLifestyleItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-level
// ─────────────────────────────────────────────────────────────────────────────

export interface FourChapterNarrative {
  chapter1: Chapter1;
  chapter2: Chapter2;
  chapter3: Chapter3;
  chapter4: Chapter4;
}

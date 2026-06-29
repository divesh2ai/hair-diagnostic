/**
 * buildFourChapterNarrative
 *
 * Pure data transformation: ClinicalReport → FourChapterNarrative.
 *
 * Phase 1 scope:
 *  - No formatting, no rendering, no presentation logic.
 *  - No video script generation, no doctor script generation, no PDF payload.
 *  - No fallback libraries. If Clinical Interpretation is weak, chapter 2
 *    surfaces an empty factors[] — the upstream interpretation engine must
 *    be fixed, never compensated here.
 *
 * Sourcing (frozen):
 *   chapter1 ← ClinicalReport.patientSummary
 *   chapter2 ← ClinicalReport.patientSummary.clinicalInterpretation   (ONLY)
 *   chapter3 ← ClinicalReport.treatmentStrategy
 *   chapter4 ← ClinicalReport.recoveryMilestones + dietAndLifestyle
 */

import type { ClinicalReport } from "../ai-engine/report-engine/types";
import type {
  Chapter1,
  Chapter2,
  Chapter2Factor,
  Chapter3,
  Chapter3Phase,
  Chapter4,
  Chapter4DietLifestyleItem,
  Chapter4Stage,
  FourChapterNarrative,
} from "./types";

export function buildFourChapterNarrative(
  report: ClinicalReport,
): FourChapterNarrative {
  return {
    chapter1: buildChapter1(report),
    chapter2: buildChapter2(report),
    chapter3: buildChapter3(report),
    chapter4: buildChapter4(report),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

function buildChapter1(report: ClinicalReport): Chapter1 {
  const p = report.patientSummary;
  return {
    hairPattern: [...p.hairLossPattern],
    duration: p.hairLossDuration ?? null,
    scalpConcerns: [...p.scalpConcerns],
    goal: [...p.goal],
  };
}

function buildChapter2(report: ClinicalReport): Chapter2 {
  const interpretations = report.patientSummary.clinicalInterpretation ?? [];

  const factors: Chapter2Factor[] = interpretations.map((row) => ({
    signal: row.signal,
    condition: row.condition ?? null,
    interpretation: row.interpretation,
  }));

  return {
    sourcePolicy: "clinicalInterpretation_only",
    factors,
  };
}

function buildChapter3(report: ClinicalReport): Chapter3 {
  const phases: Chapter3Phase[] = (report.treatmentStrategy ?? []).map(
    (phase) => ({
      phase: phase.phase,
      kitId: phase.kitId,
      kitName: phase.displayName,
      whySelected: phase.whySelected,
      supportingConditions: [...phase.supportingConditions],
    }),
  );

  return { phases };
}

function buildChapter4(report: ClinicalReport): Chapter4 {
  const stages: Chapter4Stage[] = (report.recoveryMilestones ?? []).map(
    (milestone) => ({
      window: milestone.window,
      bullets: [...milestone.bullets],
    }),
  );

  const dietAndLifestyle: Chapter4DietLifestyleItem[] = (
    report.dietAndLifestyle ?? []
  ).map((item) => ({
    condition: item.condition,
    recommendation: item.recommendation,
    expectedBenefit: item.expectedBenefit,
  }));

  return { stages, dietAndLifestyle };
}

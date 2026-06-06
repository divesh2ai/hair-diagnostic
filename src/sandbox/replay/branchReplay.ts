// ─────────────────────────────────────────────────────────────────────────────
// Branch Replay Engine
// Replays a patient's questionnaire step-by-step to reconstruct the branching
// path deterministically. Used by the sandbox to audit skip logic.
// ─────────────────────────────────────────────────────────────────────────────

import type { PatientAnswers } from "../../packages/types";
import type { QuestionFlowTrace, QuestionFlowStep, BranchingPath } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Question schema with showIf guards
// ─────────────────────────────────────────────────────────────────────────────

export interface ReplayQuestion {
  id: string;
  label: string;
  type: "single" | "multi" | "text" | "number";
  showIf?: (answers: Partial<PatientAnswers>) => boolean;
  skipReason?: string;
}

export const QUESTIONNAIRE_SCHEMA: ReplayQuestion[] = [
  { id: "sex",            label: "Biological sex",                 type: "single" },
  { id: "age",            label: "Age",                            type: "number" },
  { id: "goal",           label: "Treatment goal",                 type: "multi" },
  { id: "duration",       label: "Duration of hair loss",          type: "single" },
  { id: "count",          label: "Daily hair fall / pattern",      type: "single" },
  { id: "grade",          label: "Hair loss grade",                type: "single" },
  { id: "hairtype",       label: "Hair thinning pattern",          type: "multi" },
  { id: "scalp",          label: "Scalp condition",                type: "multi" },
  { id: "cause",          label: "Perceived cause",                type: "multi" },
  { id: "lifestyle",      label: "Lifestyle factors",              type: "multi" },
  { id: "diet",           label: "Diet type",                      type: "multi" },
  { id: "immunity",       label: "Immunity / illness history",     type: "multi" },
  { id: "medical",        label: "Medical history",                type: "text" },
  {
    id: "medical_detail",
    label: "Recent illness detail (Q13b — conditional)",
    type: "text",
    showIf: (a) => {
      const imm = Array.isArray(a.immunity) ? a.immunity : [a.immunity ?? ""];
      return imm.some((m) => typeof m === "string" && m.toLowerCase().includes("illness"));
    },
    skipReason: "RECENT_ILLNESS_NOT_INDICATED",
  },
  {
    id: "hormonal",
    label: "Hormonal conditions (Q14 — female only)",
    type: "multi",
    showIf: (a) => String(a.sex ?? "").toLowerCase() === "female",
    skipReason: "GENDER_MALE",
  },
  {
    id: "hormonal_issues",
    label: "Pregnancy / postpartum status (Q15 — female only)",
    type: "multi",
    showIf: (a) => String(a.sex ?? "").toLowerCase() === "female",
    skipReason: "GENDER_MALE",
  },
  { id: "thyroid",        label: "Thyroid conditions",             type: "multi" },
  { id: "deficiency",     label: "Known deficiencies",             type: "multi" },
  { id: "treatment",      label: "Current / prior treatment",      type: "multi" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Replay engine
// ─────────────────────────────────────────────────────────────────────────────

export interface ReplayFrame {
  step: number;
  questionId: string;
  label: string;
  decision: "PRESENTED" | "SKIPPED";
  skipReason?: string;
  answerGiven?: string | string[];
  cumulativeAnswers: Partial<PatientAnswers>;
}

export interface BranchReplayResult {
  frames: ReplayFrame[];
  flowTrace: QuestionFlowTrace;
  summary: BranchReplaySummary;
}

export interface BranchReplaySummary {
  totalSteps: number;
  presented: number;
  skipped: number;
  genderBranch: "MALE" | "FEMALE";
  postpartumActive: boolean;
  illnessConditionalActive: boolean;
  hormonalBranchActive: boolean;
}

/**
 * Replay the questionnaire for a given set of answers, producing a frame-by-
 * frame audit trail of every branching decision made.
 */
export function replayBranching(answers: PatientAnswers): BranchReplayResult {
  const frames: ReplayFrame[] = [];
  const presented: string[] = [];
  const skipped: string[] = [];
  const branchingPath: BranchingPath[] = [];
  const steps: QuestionFlowStep[] = [];

  // Build answers incrementally as if user is answering step-by-step
  const cumulative: Partial<PatientAnswers> = {};

  let stepIndex = 0;

  for (const question of QUESTIONNAIRE_SCHEMA) {
    // First fill in the current question's answer before evaluating next
    const answerValue = (answers as Record<string, unknown>)[question.id];

    const shouldShow = question.showIf ? question.showIf(cumulative) : true;

    const frame: ReplayFrame = {
      step: stepIndex + 1,
      questionId: question.id,
      label: question.label,
      decision: shouldShow ? "PRESENTED" : "SKIPPED",
      skipReason: !shouldShow ? question.skipReason : undefined,
      answerGiven: shouldShow ? (answerValue as string | string[]) : undefined,
      cumulativeAnswers: { ...cumulative },
    };

    frames.push(frame);

    if (shouldShow) {
      presented.push(question.id);
      steps.push({
        questionId: question.id,
        presented: true,
        skipped: false,
        answeredWith: answerValue as string | string[],
      });
      // Add answer to cumulative state
      if (answerValue !== undefined) {
        (cumulative as Record<string, unknown>)[question.id] = answerValue;
      }
    } else {
      skipped.push(question.id);
      steps.push({
        questionId: question.id,
        presented: false,
        skipped: true,
        skipReason: question.skipReason,
      });
      // Record branch effect
      const existingBranch = branchingPath.find((b) => b.trigger === question.skipReason);
      if (existingBranch) {
        existingBranch.affectedQuestions.push(question.id);
      } else {
        branchingPath.push({
          trigger: (question.skipReason ?? "CONDITIONAL") as any,
          affectedQuestions: [question.id],
          result: "HIDDEN",
        });
      }
    }

    stepIndex++;
  }

  const isMale = String(answers.sex ?? "").toLowerCase() === "male";
  const isFemale = !isMale;

  // Add top-level gender branch record
  branchingPath.push({
    trigger: isMale ? "GENDER_MALE" : "GENDER_FEMALE",
    affectedQuestions: isMale ? ["hormonal", "hormonal_issues"] : [],
    result: isMale ? "HIDDEN" : "SHOWN",
  });

  const flowTrace: QuestionFlowTrace = {
    totalQuestionsInSchema: QUESTIONNAIRE_SCHEMA.length,
    questionsPresented: presented,
    questionsSkipped: skipped,
    branchingPath,
    steps,
  };

  // Compute summary
  const hormonal = Array.isArray(answers.hormonal) ? answers.hormonal : [];
  const immunity = Array.isArray(answers.immunity) ? answers.immunity : [];

  const summary: BranchReplaySummary = {
    totalSteps: stepIndex,
    presented: presented.length,
    skipped: skipped.length,
    genderBranch: isMale ? "MALE" : "FEMALE",
    postpartumActive: isFemale && (
      hormonal.some((h) => String(h).toLowerCase().includes("postpartum")) ||
      (answers.hormonal_issues ?? []).some((h) => String(h).toLowerCase().includes("postpartum"))
    ),
    illnessConditionalActive: immunity.some((m) => String(m).toLowerCase().includes("illness")),
    hormonalBranchActive: isFemale,
  };

  return { frames, flowTrace, summary };
}

/**
 * Format the replay result into a human-readable audit log string.
 */
export function formatReplayLog(result: BranchReplayResult): string {
  const lines: string[] = [
    "=== BRANCH REPLAY AUDIT LOG ===",
    `Gender Branch : ${result.summary.genderBranch}`,
    `Postpartum    : ${result.summary.postpartumActive}`,
    `Illness Q13b  : ${result.summary.illnessConditionalActive}`,
    `Hormonal Q14  : ${result.summary.hormonalBranchActive}`,
    `Presented     : ${result.summary.presented}/${result.summary.totalSteps}`,
    `Skipped       : ${result.summary.skipped}/${result.summary.totalSteps}`,
    "",
    "=== STEP-BY-STEP FRAMES ===",
  ];

  for (const frame of result.frames) {
    const icon = frame.decision === "PRESENTED" ? "✓" : "✗";
    const ansStr = frame.answerGiven
      ? ` → ${JSON.stringify(frame.answerGiven)}`
      : "";
    const skipStr = frame.skipReason ? ` [SKIP: ${frame.skipReason}]` : "";
    lines.push(`Step ${String(frame.step).padStart(2, "0")} ${icon} [${frame.questionId.padEnd(16)}] ${frame.label}${ansStr}${skipStr}`);
  }

  lines.push("", "=== BRANCHING PATH ===");
  for (const branch of result.flowTrace.branchingPath) {
    lines.push(`→ ${branch.trigger} → ${branch.result} → affects: [${branch.affectedQuestions.join(", ")}]`);
  }

  return lines.join("\n");
}

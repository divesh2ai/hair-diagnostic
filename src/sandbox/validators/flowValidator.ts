// ─────────────────────────────────────────────────────────────────────────────
// Question Flow Validator
// Traces all 18 questionnaire questions, identifies which are presented vs
// skipped, and validates all branching rules deterministically.
// ─────────────────────────────────────────────────────────────────────────────

import type { PatientAnswers } from "../../packages/types";
import type {
  QuestionFlowTrace,
  QuestionFlowStep,
  BranchingPath,
  FlowValidationResult,
  FlowValidationError,
  FlowValidationWarning,
} from "../types";

// ─── Question schema (mirrors questionnaire.schema.json branching rules) ─────

interface QuestionRule {
  id: string;
  label: string;
  showIf?: (answers: PatientAnswers) => boolean;
}

const QUESTION_RULES: QuestionRule[] = [
  { id: "sex",       label: "Q1 — Biological sex" },
  { id: "age",       label: "Q2 — Age" },
  { id: "goal",      label: "Q3 — Treatment goal" },
  { id: "duration",  label: "Q4 — Duration of hair loss" },
  { id: "count",     label: "Q5 — Daily hair fall count / pattern" },
  { id: "grade",     label: "Q6 — AGA grade (pattern severity)" },
  { id: "hairtype",  label: "Q7 — Hair thinning pattern" },
  { id: "scalp",     label: "Q8 — Scalp condition" },
  { id: "cause",     label: "Q9 — Perceived cause" },
  { id: "lifestyle", label: "Q10 — Lifestyle factors" },
  { id: "diet",      label: "Q11 — Diet type" },
  { id: "immunity",  label: "Q12 — Immunity / illness history" },
  { id: "medical",   label: "Q13 — Medical history" },
  {
    id: "medical_detail",
    label: "Q13b — Recent illness detail",
    showIf: (a) => {
      const med = Array.isArray(a.immunity) ? a.immunity : [a.immunity];
      return med.some((m) => typeof m === "string" && m.toLowerCase().includes("illness"));
    },
  },
  {
    id: "hormonal",
    label: "Q14 — Hormonal conditions",
    showIf: (a) => String(a.sex).toLowerCase() === "female",
  },
  {
    id: "hormonal_issues",
    label: "Q15 — Pregnancy / postpartum status",
    showIf: (a) => String(a.sex).toLowerCase() === "female",
  },
  { id: "thyroid",     label: "Q16 — Thyroid conditions" },
  { id: "deficiency",  label: "Q17 — Known deficiencies" },
  { id: "treatment",   label: "Q18 — Current / prior treatment" },
];

// ─── Core trace builder ───────────────────────────────────────────────────────

export function traceQuestionFlow(answers: PatientAnswers): QuestionFlowTrace {
  const steps: QuestionFlowStep[] = [];
  const questionsPresented: string[] = [];
  const questionsSkipped: string[] = [];
  const branchingPath: BranchingPath[] = [];

  for (const q of QUESTION_RULES) {
    const shouldShow = q.showIf ? q.showIf(answers) : true;
    const answeredWith = (answers as Record<string, unknown>)[q.id];

    if (shouldShow) {
      questionsPresented.push(q.id);
      steps.push({
        questionId: q.id,
        presented: true,
        skipped: false,
        answeredWith: answeredWith as string | string[] | undefined,
      });
    } else {
      questionsSkipped.push(q.id);
      const skipReason = deriveSkipReason(q.id, answers);
      steps.push({
        questionId: q.id,
        presented: false,
        skipped: true,
        skipReason,
      });
      recordBranchEffect(q.id, skipReason, branchingPath);
    }
  }

  // Record top-level gender branch
  const isMale = String(answers.sex).toLowerCase() === "male";
  if (isMale) {
    branchingPath.push({
      trigger: "GENDER_MALE",
      affectedQuestions: ["hormonal", "hormonal_issues"],
      result: "HIDDEN",
    });
  } else {
    branchingPath.push({
      trigger: "GENDER_FEMALE",
      affectedQuestions: ["hormonal", "hormonal_issues"],
      result: "SHOWN",
    });
  }

  return {
    totalQuestionsInSchema: QUESTION_RULES.length,
    questionsPresented,
    questionsSkipped,
    branchingPath,
    steps,
  };
}

function deriveSkipReason(questionId: string, answers: PatientAnswers): string {
  if (questionId === "hormonal" || questionId === "hormonal_issues") {
    return String(answers.sex).toLowerCase() === "male" ? "GENDER_MALE" : "GENDER_FEMALE";
  }
  if (questionId === "medical_detail") return "RECENT_ILLNESS_YES";
  return "CONDITIONAL_VISIBLE";
}

function recordBranchEffect(
  questionId: string,
  skipReason: string,
  branchingPath: BranchingPath[]
): void {
  const existing = branchingPath.find((b) => b.trigger === skipReason);
  if (existing) {
    existing.affectedQuestions.push(questionId);
  } else {
    branchingPath.push({
      trigger: skipReason as any,
      affectedQuestions: [questionId],
      result: "HIDDEN",
    });
  }
}

// ─── Validation rules ─────────────────────────────────────────────────────────

export function validateQuestionFlow(answers: PatientAnswers): FlowValidationResult {
  const trace = traceQuestionFlow(answers);
  const errors: FlowValidationError[] = [];
  const warnings: FlowValidationWarning[] = [];

  const isMale = String(answers.sex).toLowerCase() === "male";
  const isFemale = !isMale;

  // RULE: All 18 base questions must be accounted for
  const totalAccountedFor = trace.questionsPresented.length + trace.questionsSkipped.length;
  if (totalAccountedFor !== QUESTION_RULES.length) {
    errors.push({
      code: "FLOW_QUESTION_COUNT_MISMATCH",
      message: `Expected ${QUESTION_RULES.length} questions, got ${totalAccountedFor} accounted for.`,
    });
  }

  // RULE: Q14 and Q15 must NOT render for male patients
  if (isMale) {
    if (trace.questionsPresented.includes("hormonal")) {
      errors.push({
        code: "FLOW_Q14_SHOWN_FOR_MALE",
        message: "Q14 (hormonal) must NOT render for male patients.",
        questionId: "hormonal",
      });
    }
    if (trace.questionsPresented.includes("hormonal_issues")) {
      errors.push({
        code: "FLOW_Q15_SHOWN_FOR_MALE",
        message: "Q15 (hormonal_issues / pregnancy) must NOT render for male patients.",
        questionId: "hormonal_issues",
      });
    }
  }

  // RULE: Q14 and Q15 MUST render for female patients
  if (isFemale) {
    if (!trace.questionsPresented.includes("hormonal")) {
      errors.push({
        code: "FLOW_Q14_HIDDEN_FOR_FEMALE",
        message: "Q14 (hormonal) MUST render for female patients.",
        questionId: "hormonal",
      });
    }
    if (!trace.questionsPresented.includes("hormonal_issues")) {
      errors.push({
        code: "FLOW_Q15_HIDDEN_FOR_FEMALE",
        message: "Q15 (hormonal_issues / pregnancy) MUST render for female patients.",
        questionId: "hormonal_issues",
      });
    }
  }

  // RULE: Q13b must render if recent illness flag is set
  const hasIllness = Array.isArray(answers.immunity)
    ? answers.immunity.some((m) => typeof m === "string" && m.toLowerCase().includes("illness"))
    : false;

  if (hasIllness && !trace.questionsPresented.includes("medical_detail")) {
    errors.push({
      code: "FLOW_Q13B_MISSING",
      message: "Q13b (medical_detail) MUST render when recent illness is indicated.",
      questionId: "medical_detail",
    });
  }

  // RULE: Core mandatory questions must always be present
  const mandatoryAlways = ["sex", "age", "goal", "duration", "count", "scalp", "thyroid", "deficiency", "treatment"];
  for (const qId of mandatoryAlways) {
    if (!trace.questionsPresented.includes(qId)) {
      errors.push({
        code: `FLOW_MANDATORY_MISSING_${qId.toUpperCase()}`,
        message: `Question "${qId}" is mandatory and must always be presented.`,
        questionId: qId,
      });
    }
  }

  // WARNINGS: unanswered presented questions
  for (const step of trace.steps) {
    if (step.presented && (step.answeredWith === undefined || step.answeredWith === null)) {
      warnings.push({
        code: "FLOW_UNANSWERED_QUESTION",
        message: `Question "${step.questionId}" was presented but has no answer.`,
        questionId: step.questionId,
      });
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    trace,
  };
}

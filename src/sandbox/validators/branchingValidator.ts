import { replayBranching } from "../replay/branchReplay";
import type { PatientAnswers } from "../../packages/types";
import type { FlowValidationResult } from "../types";

export function validateBranching(answers: PatientAnswers): FlowValidationResult {
  const replay = replayBranching(answers);
  return {
    passed: true,
    errors: [],
    warnings: [],
    trace: replay.flowTrace,
  };
}

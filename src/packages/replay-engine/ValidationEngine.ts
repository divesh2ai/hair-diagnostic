/**
 * ValidationEngine — composes the 5 validators into a CaseValidation
 * with weighted overall score per HAIROS_RELEASE_GATE_SPEC.md.
 */

import {
  CaseValidation,
  ClinicalReplayCase,
  ReplayResult,
  ValidatorOutcome,
} from "./types";
import { validateRootCause } from "./validators/rootCauseValidator";
import { validatePathway } from "./validators/pathwayValidator";
import { validateTreatment } from "./validators/treatmentValidator";
import { validateNarrative } from "./validators/narrativeValidator";
import { validateGovernance } from "./validators/governanceValidator";

const WEIGHTS = {
  rootCause: 0.30,
  pathway: 0.20,
  treatment: 0.25,
  narrative: 0.15,
  governance: 0.10,
} as const;

export class ValidationEngine {
  validate(c: ClinicalReplayCase, r: ReplayResult): CaseValidation {
    const rootCause = validateRootCause(c, r);
    const pathway = validatePathway(c, r);
    const treatment = validateTreatment(c, r);
    const narrative = validateNarrative(c, r);
    const governance = validateGovernance(c, r);

    const overallScore = Number((
      rootCause.score * WEIGHTS.rootCause +
      pathway.score * WEIGHTS.pathway +
      treatment.score * WEIGHTS.treatment +
      narrative.score * WEIGHTS.narrative +
      governance.score * WEIGHTS.governance
    ).toFixed(2));

    const allPass = [rootCause, pathway, treatment, narrative, governance].every((v) => v.pass);
    const noCritical = ![rootCause, pathway, treatment, narrative, governance]
      .flatMap((v: ValidatorOutcome) => v.findings)
      .some((f) => f.severity === "critical");

    return {
      caseId: c.caseId,
      rootCause,
      pathway,
      treatment,
      narrative,
      governance,
      overallScore,
      overallPass: allPass && noCritical,
    };
  }

  validateAll(
    cases: ClinicalReplayCase[],
    results: ReplayResult[]
  ): CaseValidation[] {
    if (cases.length !== results.length) {
      throw new Error("Case/result length mismatch");
    }
    const out: CaseValidation[] = [];
    for (let i = 0; i < cases.length; i++) out.push(this.validate(cases[i]!, results[i]!));
    return out;
  }
}

export const VALIDATION_WEIGHTS = WEIGHTS;

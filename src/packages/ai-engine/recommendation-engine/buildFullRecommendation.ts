import type { ClinicalProfile, TherapyNeed } from './buildTherapyRouting';
import { buildTherapyRouting } from './buildTherapyRouting';
import { buildTopicalSupport } from './buildTopicalSupport';
import { buildScalpSupport, type ScalpCondition } from './buildScalpSupport';
import { buildSerumSupport, type SerumTrigger } from './buildSerumSupport';
import { buildProcedureSupport } from './buildProcedureSupport';
import { buildInternalProtocol, type InternalProtocolResult } from './buildInternalProtocol';
import { buildProtocolTimeline, type ProtocolTimelineResult } from './buildProtocolTimeline';
import { buildUsageInstructions, type UsageInstructionResult } from './buildUsageInstructions';
import { buildContraindicationWarnings, type ContraindicationWarningResult } from './buildContraindicationWarnings';
import { buildExpectedOutcomes, type ExpectedOutcomeResult } from './buildExpectedOutcomes';

export interface FullRecommendationResult {
  readonly profile: ClinicalProfile;
  readonly internalProtocol: InternalProtocolResult;
  readonly timeline: ProtocolTimelineResult;
  readonly instructions: UsageInstructionResult;
  readonly warnings: ContraindicationWarningResult;
  readonly expectedOutcomes: ExpectedOutcomeResult;
}

export const buildFullRecommendation = (
  profile: ClinicalProfile,
  needs: readonly TherapyNeed[],
  scalpConditions: readonly ScalpCondition[],
  serumTriggers: readonly SerumTrigger[]
): FullRecommendationResult => {
  const routing = buildTherapyRouting(needs, profile);
  const topicals = buildTopicalSupport(profile);
  const scalp = buildScalpSupport(scalpConditions);
  const serum = buildSerumSupport(serumTriggers);
  const procedures = buildProcedureSupport(profile);

  const internalProtocol = buildInternalProtocol(
    routing,
    profile,
    topicals,
    scalp,
    serum,
    procedures
  );

  const timeline = buildProtocolTimeline();
  const instructions = buildUsageInstructions(internalProtocol);
  const warnings = buildContraindicationWarnings(profile, internalProtocol);
  const outcomes = buildExpectedOutcomes(internalProtocol);

  return {
    profile,
    internalProtocol,
    timeline,
    instructions,
    warnings,
    expectedOutcomes: outcomes
  };
};

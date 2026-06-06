import type { InternalProtocolResult } from './buildInternalProtocol';

export interface ExpectedOutcomeResult {
  readonly sheddingReduction: string;
  readonly inflammationImprovement: string;
  readonly densityRecovery: string;
  readonly timelineEstimates: string;
  readonly prognosisConfidence: 'High' | 'Moderate' | 'Low';
}

export const buildExpectedOutcomes = (
  protocol: InternalProtocolResult
): ExpectedOutcomeResult => {
  const isAggressive = protocol.procedures?.selectedProcedures && protocol.procedures.selectedProcedures.length > 0;
  
  return {
    sheddingReduction: 'Expect noticeable reduction within 4-6 weeks.',
    inflammationImprovement: 'Significant improvement expected by end of Month 2.',
    densityRecovery: isAggressive ? 'Moderate to high density recovery expected by Month 6.' : 'Gradual density improvement starting Month 4.',
    timelineEstimates: 'Full visible results at 6-9 months.',
    prognosisConfidence: isAggressive ? 'Moderate' : 'High'
  };
};

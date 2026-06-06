import type { ClinicalProfile } from './buildTherapyRouting';
import type { InternalProtocolResult } from './buildInternalProtocol';

export interface ContraindicationWarningResult {
  readonly warnings: readonly string[];
}

export const buildContraindicationWarnings = (
  profile: ClinicalProfile,
  protocol: InternalProtocolResult
): ContraindicationWarningResult => {
  const warnings: string[] = [];

  if (profile.pregnancyStatus) {
    warnings.push('Pregnancy detected: Avoid all DHT blockers and systemic agents.');
  }

  if (protocol.supportTopicals?.selectedTopical) {
    warnings.push('Monitor for scalp irritation or active inflammation with topical usage.');
  }

  return {
    warnings
  };
};

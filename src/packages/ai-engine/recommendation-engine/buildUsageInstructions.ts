import type { InternalProtocolResult } from './buildInternalProtocol';

export interface UsageInstructionResult {
  readonly topicalInstructions: string;
  readonly shampooInstructions: string;
  readonly serumInstructions: string;
  readonly generalCompliance: string;
}

export const buildUsageInstructions = (
  protocol: InternalProtocolResult
): UsageInstructionResult => {
  return {
    topicalInstructions: protocol.supportTopicals?.selectedTopical ? `Apply ${protocol.supportTopicals.selectedTopical} ${protocol.supportTopicals.usageFrequency}.` : 'No topicals prescribed.',
    shampooInstructions: protocol.scalpSupport?.selectedShampoo ? `Use ${protocol.scalpSupport.selectedShampoo} 2-3 times per week.` : 'Use regular gentle shampoo.',
    serumInstructions: protocol.serumSupport?.selectedSerum ? `Apply ${protocol.serumSupport.selectedSerum} as directed post-wash.` : 'No serums prescribed.',
    generalCompliance: 'Adhere strictly to the protocol timeline for optimal results.'
  };
};

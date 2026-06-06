export type ScalpCondition = 'dandruff' | 'oily scalp' | 'itching' | 'seb derm' | 'inflammation';
export type SupportedShampoo = 'F_BI_WASH_PLUS';

export interface ScalpSupportResult {
  readonly selectedShampoo: SupportedShampoo | null;
  readonly rationale: string;
}

export const buildScalpSupport = (
  conditions: readonly ScalpCondition[]
): ScalpSupportResult => {
  if (conditions.length > 0) {
    return {
      selectedShampoo: 'F_BI_WASH_PLUS',
      rationale: `Indicated for scalp concerns: ${conditions.join(', ')}`
    };
  }
  return {
    selectedShampoo: null,
    rationale: 'No scalp conditions detected.'
  };
};

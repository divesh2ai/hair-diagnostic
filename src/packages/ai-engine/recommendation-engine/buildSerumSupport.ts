export type SerumTrigger = 'follicular stress' | 'miniaturization' | 'oxidative burden' | 'inflammatory scalp';
export type SupportedSerum = 'TRICHOSURE_SERUM';

export interface SerumSupportResult {
  readonly selectedSerum: SupportedSerum | null;
  readonly rationale: string;
}

export const buildSerumSupport = (
  triggers: readonly SerumTrigger[]
): SerumSupportResult => {
  if (triggers.length > 0) {
    return {
      selectedSerum: 'TRICHOSURE_SERUM',
      rationale: `Indicated for triggers: ${triggers.join(', ')}`
    };
  }
  return {
    selectedSerum: null,
    rationale: 'No specific serum indicated.'
  };
};

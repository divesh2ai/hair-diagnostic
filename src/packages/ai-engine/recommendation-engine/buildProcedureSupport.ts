import type { ClinicalProfile } from './buildTherapyRouting';

export type AllowedProcedure = 'PRP' | 'GFC' | 'MICRONEEDLING' | 'LOW_LEVEL_LASER';

export interface ProcedureSupportResult {
  readonly selectedProcedures: readonly AllowedProcedure[];
  readonly rationale: string;
}

export const buildProcedureSupport = (
  profile: ClinicalProfile
): ProcedureSupportResult => {
  const procedures: AllowedProcedure[] = [];
  const rationale: string[] = [];

  if (profile.isSevereGrade || profile.isAggressiveProgression) {
    procedures.push('PRP', 'MICRONEEDLING');
    rationale.push('Severe grade or aggressive progression warrants combination PRP + Microneedling.');
  }

  if (profile.isChronic || profile.isLowExpectedResponse) {
    if (!procedures.includes('GFC')) procedures.push('GFC');
    if (!procedures.includes('LOW_LEVEL_LASER')) procedures.push('LOW_LEVEL_LASER');
    rationale.push('Chronic case or low expected response suggests GFC and LLLT support.');
  }

  return {
    selectedProcedures: procedures,
    rationale: rationale.join(' ') || 'No procedures explicitly indicated.'
  };
};

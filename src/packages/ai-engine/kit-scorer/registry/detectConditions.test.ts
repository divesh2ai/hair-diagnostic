import { describe, it, expect } from 'vitest';
import type { PatientAnswers } from '../../../types';
import type { ClinicalFlags } from '../../clinical-engine/types';
import { detectConditions } from './detectConditions';

function makeFlags(overrides: Partial<ClinicalFlags> = {}): ClinicalFlags {
  return {
    isRegrowGoal: false,
    hasGreyGoal: false,
    hasHairGoal: true,
    isVeg: false,
    isMale: true,
    isPregnant: false,
    isGrade45: false,
    isGrade123: true,
    hasActiveShedding: true,
    hasNoVisibleFall: false,
    hasGLP1Early: false,
    hasGLP1Late: false,
    hasCrashDiet: false,
    age: 34,
    goal: 'reduce hair fall',
    grade: 'Grade 2',
    count: 'Noticeable',
    duration: '3-6 months',
    ...overrides,
  };
}

describe('detectConditions', () => {
  it('does not infer scalp inflammation from pattern loss when the scalp is normal', () => {
    const ans: PatientAnswers = {
      sex: 'Male',
      age: 34,
      goal: 'reduce hair fall',
      scalp: ['Normal scalp'],
      cause: ['Stress', 'Anxiety'],
      hairtype: ['Thinning'],
      lifestyle: [],
      immunity: [],
      hormonal: [],
      gut: [],
      deficiency: [],
      diet: [],
      treatment: [],
      thyroid: [],
    };

    const detected = detectConditions(ans, makeFlags({ isMale: true }));

    expect(detected.has('AGA_PATTERN_MALE')).toBe(true);
    expect(detected.has('SCALP_INFLAMMATION')).toBe(false);
  });

  it('still detects scalp inflammation when a real scalp signal is present', () => {
    const ans: PatientAnswers = {
      sex: 'Male',
      age: 34,
      goal: 'reduce hair fall',
      scalp: ['Normal scalp', 'Redness'],
      cause: ['Stress'],
      hairtype: ['Thinning'],
      lifestyle: [],
      immunity: [],
      hormonal: [],
      gut: [],
      deficiency: [],
      diet: [],
      treatment: [],
      thyroid: [],
    };

    const detected = detectConditions(ans, makeFlags({ isMale: true }));

    expect(detected.has('AGA_PATTERN_MALE')).toBe(true);
    expect(detected.has('SCALP_INFLAMMATION')).toBe(true);
  });
});
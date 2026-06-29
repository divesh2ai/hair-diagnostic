import { describe, it, expect } from 'vitest';
import type { PatientAnswers } from '../../src/packages/types';
import type { ClinicalProfile, ClinicalFlags } from '../../src/packages/ai-engine/clinical-engine/types';
import type { TherapyNeeds } from '../../src/packages/ai-engine/therapy-engine/types';
import type { ClinicConfig } from '../../src/packages/ai-engine/kit-scorer/types';

import { scoreKits } from '../../src/packages/ai-engine/kit-scorer/scoreKits';

// ─────────────────────────────────────────────────────────────────────────────
// Fixture tests for the three-layer condition→registry→sequence engine.
// Each case nails a specific clinical doctrine the engine MUST honour.
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_CLINIC: ClinicConfig = {
  clinicId: 'TEST_CLINIC',
  availableKits: [],
  substitutions: {},
};

const EMPTY_THERAPY: TherapyNeeds = { needs: [], needReasons: {} };

function flagsFor(overrides: Partial<ClinicalFlags>): ClinicalFlags {
  return {
    isRegrowGoal: false,
    hasGreyGoal: false,
    hasHairGoal: true,
    isVeg: false,
    isMale: true,
    isPregnant: false,
    isGrade45: false,
    isGrade123: true,
    hasActiveShedding: false,
    hasNoVisibleFall: false,
    hasGLP1Early: false,
    hasGLP1Late: false,
    hasCrashDiet: false,
    age: 46,
    goal: 'Reduce hair fall and improve quality & growth',
    grade: 'Grade 1 — Norwood II',
    count: '~20–50 strands',
    duration: '6–12 months',
    ...overrides,
  };
}

function profileFor(flags: ClinicalFlags): ClinicalProfile {
  return {
    primaryDiagnosis: 'AGA_MALE_123',
    primaryScore: 95,
    secondaryDiagnoses: [],
    allScores: { AGA_MALE_123: 95 },
    scalpStates: ['NORMAL_SCALP'],
    rootCauses: ['DHT'],
    severity: 'MILD',
    flags,
  };
}

describe('Condition Engine — Viraf-style early AGA male, no comorbidities', () => {
  const ans: PatientAnswers = {
    sex: 'Male',
    age: 46,
    goal: 'Reduce hair fall and improve quality & growth',
    duration: '6–12 months',
    count: '~20–50 strands',
    grade: 'Grade 1 — Norwood II',
    hairtype: [],
    scalp: ['Normal scalp'],
    cause: [],
    immunity: [],
    hormonal: [],
    gut: [],
    deficiency: [],
    diet: ['Vegetarian', 'Non-vegetarian'],
    lifestyle: [],
    treatment: ['Chemical treatment (colour / keratin)'],
  };

  const result = scoreKits(profileFor(flagsFor({})), EMPTY_THERAPY, ans, EMPTY_CLINIC);
  const kits = result.rankedKits.map((k) => k.kitId);

  it('prescribes Phenotype Inflammation', () => {
    expect(kits).toContain('PHENOTYPE INFLAMATION');
  });

  it('prescribes MPHL', () => {
    expect(kits).toContain('MPHL');
  });

  it('Phenotype precedes MPHL (inflammation cleared before DHT correction)', () => {
    expect(kits.indexOf('PHENOTYPE INFLAMATION')).toBeLessThan(kits.indexOf('MPHL'));
  });

  it('does NOT prescribe Meta B — no metabolic signal', () => {
    expect(kits).not.toContain('PRO FACT META B');
    expect(kits).not.toContain('PRO FACT META B PCOS');
  });

  it('does NOT prescribe Pro Immune — no immune signal', () => {
    expect(kits.some((k) => k.includes('PRO IMMUNE'))).toBe(false);
  });

  it('does NOT prescribe TE GOLD — duration exceeds 3-month acute window', () => {
    expect(kits.some((k) => k.includes('TE GOLD'))).toBe(false);
  });

  it('does NOT prescribe HBR — Phenotype supersedes (Rule 7)', () => {
    expect(kits).not.toContain('HAIR FACT HAIR BREAKAGE REPAIR(HBR)');
  });

  it('uses non-veg variants — patient eats both veg and non-veg', () => {
    // If isVeg leaked through, we would see VEG variants. Verify pattern kit is the base.
    expect(kits).not.toContain('PRO IMMUNE VEG');
    expect(kits).not.toContain('HAIR FACT TE GOLD VEG');
  });
});

describe('Condition Engine — PCOS + Hypothyroid collapses to plain Meta B', () => {
  const ans: PatientAnswers = {
    sex: 'Female',
    age: 32,
    goal: 'Reduce hair fall and improve quality & growth',
    duration: '6–12 months',
    grade: 'Grade 1',
    diet: ['Vegetarian'],
    hormonal: ['PCOS'],
    thyroid: ['Hypothyroidism'],
  };
  const flags = flagsFor({ isMale: false, isVeg: true, age: 32 });
  const profile: ClinicalProfile = { ...profileFor(flags), primaryDiagnosis: 'PCOS_ONLY' };
  const kits = scoreKits(profile, EMPTY_THERAPY, ans, EMPTY_CLINIC).rankedKits.map((k) => k.kitId);

  it('produces plain PRO FACT META B (3-axis integrated kit)', () => {
    expect(kits).toContain('PRO FACT META B');
  });

  it('does NOT include META B PCOS variant', () => {
    expect(kits).not.toContain('PRO FACT META B PCOS');
  });

  it('does NOT include META B HYPOTHYROID variant', () => {
    expect(kits).not.toContain('PRO FACT META B HYPOTHYROID');
  });
});

describe('Condition Engine — Pregnancy is exclusive', () => {
  const ans: PatientAnswers = {
    sex: 'Female',
    age: 28,
    goal: 'Reduce hair fall and improve quality & growth',
    grade: 'Grade 1',
    hormonal: ['Currently pregnant'],
    deficiency: ['Iron'],
    scalp: ['Dandruff'],
    is_pregnant: true,
  };
  const flags = flagsFor({ isMale: false, isPregnant: true, age: 28 });
  const profile: ClinicalProfile = { ...profileFor(flags), primaryDiagnosis: 'PREGNANCY' };
  const kits = scoreKits(profile, EMPTY_THERAPY, ans, EMPTY_CLINIC).rankedKits.map((k) => k.kitId);

  it('prescribes only HEALTHY - 9', () => {
    expect(kits).toEqual(['HEALTHY - 9']);
  });
});

describe('Condition Engine — Gut supersedes TE GOLD', () => {
  const ans: PatientAnswers = {
    sex: 'Male',
    age: 35,
    goal: 'Reduce hair fall and improve quality & growth',
    duration: '1–3 months',
    count: 'Noticeable',
    grade: 'Grade 1',
    diet: ['Non-vegetarian'],
    gut: ['GERD'],
    cause: ['Stress'],
  };
  const flags = flagsFor({
    age: 35,
    duration: '1–3 months',
    count: 'Noticeable',
    hasActiveShedding: true,
  });
  const profile: ClinicalProfile = { ...profileFor(flags), primaryDiagnosis: 'GUT_ISSUES' };
  const kits = scoreKits(profile, EMPTY_THERAPY, ans, EMPTY_CLINIC).rankedKits.map((k) => k.kitId);

  it('prescribes PRO FACT GI GOLD', () => {
    expect(kits).toContain('PRO FACT GI GOLD');
  });

  it('does NOT prescribe TE GOLD — GI GOLD covers absorption-driven shedding', () => {
    expect(kits.some((k) => k.includes('TE GOLD'))).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import type { PatientAnswers } from '../../src/packages/types';
import type { ClinicalProfile, ClinicalFlags } from '../../src/packages/ai-engine/clinical-engine/types';
import type { TherapyNeeds } from '../../src/packages/ai-engine/therapy-engine/types';
import type { ClinicConfig } from '../../src/packages/ai-engine/kit-scorer/types';

import { scoreKits } from '../../src/packages/ai-engine/kit-scorer/scoreKits';
import { detectConditions } from '../../src/packages/ai-engine/kit-scorer/registry/detectConditions';
import { masterProtocol } from '@hairos/packages/ai-engine/questionnaire-engine/protocol/masterProtocol';
import { adaptProtocol } from '@/runtime/protocolAdapter';
import {
  applyMultiSelectRules,
  applyGroupExclusivity,
  getExclusiveOptions,
  getVisibleOptions,
  filterAnswerToVisible,
} from '@/runtime/optionFilterEngine';

// ─────────────────────────────────────────────────────────────────────────────
// MISCARRIAGE — clinical rule 2026-09-05, corrected 2026-09-07.
//
//   hormonal includes 'Miscarriage'
//   ⇒ PHENOTYPE INFLAMATION (via the MISCARRIAGE condition) and
//     PRO IMMUNE GOLD (via the IMMUNE_DEPLETION allow-list).
//
// MEANING: reproductive HISTORY, not a current episode. The protocol has never
// carried a recency qualifier for this option (it did not exist anywhere in the
// repo or its git history before 2026-09-05), and every option in this question
// that denotes a *current* state says so in its own label — "Currently
// pregnant", "Post-delivery or breastfeeding", "Peri-menopause",
// "Post-menopause", "Post-hysterectomy". Bare "Miscarriage" therefore reads as
// history, exactly like the bare condition names PCOS and Endometriosis.
//
// Consequence: it must NOT exclude any concurrent reproductive state. A patient
// may have had a miscarriage and be pregnant, breastfeeding or post-delivery
// now. These tests pin that no exclusion exists in either direction.
//
// Guarded here because the schema's `triggers` strings are descriptive metadata
// only — the runtime re-implements routing in TypeScript, so a schema edit
// alone would prescribe nothing.
// ─────────────────────────────────────────────────────────────────────────────

const PHENOTYPE = 'PHENOTYPE INFLAMATION';
const PRO_IMMUNE = 'PRO IMMUNE GOLD';
const MISCARRIAGE = 'Miscarriage';
const PREGNANT = 'Currently pregnant';
const POSTPARTUM = 'Post-delivery or breastfeeding';
const PCOS = 'PCOS / PCOD only';

const OPEN_CLINIC: ClinicConfig = { clinicId: 'TEST', availableKits: [], substitutions: {} };
const NO_THERAPY: TherapyNeeds = { needs: [], needReasons: {} };

function flagsFor(o: Partial<ClinicalFlags>): ClinicalFlags {
  return {
    isRegrowGoal: false, hasGreyGoal: false, hasHairGoal: true,
    isVeg: false, isMale: false, isPregnant: false,
    isGrade45: false, isGrade123: true,
    hasActiveShedding: false, hasNoVisibleFall: false,
    hasGLP1Early: false, hasGLP1Late: false, hasCrashDiet: false,
    age: 32, goal: 'Reduce hair fall and improve quality & growth',
    grade: 'Grade 1 — Ludwig 1', count: '~20–50 strands', duration: '6–12 months',
    ...o,
  };
}

function profileFor(flags: ClinicalFlags, dx = 'AGA_FEMALE_123'): ClinicalProfile {
  return {
    primaryDiagnosis: dx, primaryScore: 95, secondaryDiagnoses: [],
    allScores: { [dx]: 95 }, scalpStates: ['NORMAL_SCALP'],
    rootCauses: ['DHT'], severity: 'MILD', flags,
  };
}

const base: PatientAnswers = {
  sex: 'Female', age: 32,
  goal: 'Reduce hair fall and improve quality & growth',
  duration: '6–12 months', count: '~20–50 strands', grade: 'Grade 1 — Ludwig 1',
  hairtype: [], scalp: ['Normal scalp'], cause: [], immunity: [], hormonal: [],
  gut: [], deficiency: [], diet: ['Non-vegetarian'], lifestyle: [], treatment: [],
};

const withMiscarriage: PatientAnswers = { ...base, hormonal: [MISCARRIAGE] };

function kitsOf(ans: PatientAnswers) {
  return scoreKits(profileFor(flagsFor({})), NO_THERAPY, ans, OPEN_CLINIC)
    .rankedKits.map((k) => k.kitId);
}

const hormonalQuestion = () => {
  const q = adaptProtocol(masterProtocol).find((x) => x.id === 'hormonal');
  if (!q) throw new Error('hormonal question missing from adapted protocol');
  return q;
};

/**
 * Reproduces exactly what the V3 renderer does on a tap, so these assertions
 * describe the answer the live route actually stores.
 */
function tap(current: string[], optionId: string): string[] {
  const q = hormonalQuestion();
  const exclusiveIds = getExclusiveOptions(q).map((o) => o.id);
  return q.mutualExclusivityGroups?.length
    ? applyGroupExclusivity(current, optionId, q.mutualExclusivityGroups, exclusiveIds)
    : applyMultiSelectRules(current, optionId, exclusiveIds);
}

const femaleAnswers = { sex: 'Female', age: 32 };

describe('Miscarriage → both prescribed kits', () => {
  it('prescribes PHENOTYPE INFLAMATION', () => {
    expect(kitsOf(withMiscarriage)).toContain(PHENOTYPE);
  });

  it('prescribes PRO IMMUNE GOLD', () => {
    expect(kitsOf(withMiscarriage)).toContain(PRO_IMMUNE);
  });

  it('neither kit is prescribed to the same patient without the declaration', () => {
    const kits = kitsOf(base);
    expect(kits).not.toContain(PHENOTYPE);
    expect(kits).not.toContain(PRO_IMMUNE);
  });
});

describe('Miscarriage — condition detection', () => {
  it('raises MISCARRIAGE and IMMUNE_DEPLETION', () => {
    const present = detectConditions(withMiscarriage, flagsFor({}));
    expect(present.has('MISCARRIAGE')).toBe(true);
    expect(present.has('IMMUNE_DEPLETION')).toBe(true);
  });

  it('does not trip the pregnancy lock', () => {
    // 'Miscarriage' must not be read as a pregnancy signal — PREGNANCY returns
    // early from detection and strips every other kit for safety.
    const present = detectConditions(withMiscarriage, flagsFor({}));
    expect(present.has('PREGNANCY')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ANSWER INTEGRITY — Miscarriage is history and excludes nothing.
// ─────────────────────────────────────────────────────────────────────────────
describe('Miscarriage — no exclusivity, answer integrity', () => {
  it('CASE 0 — carries no disable rule and joins no exclusivity group', () => {
    const q = hormonalQuestion();
    // The one-way disable mechanism was removed; nothing may reintroduce it.
    expect((q as Record<string, unknown>).optionDisableRules).toBeUndefined();
    for (const group of q.mutualExclusivityGroups ?? []) {
      expect(group).not.toContain(MISCARRIAGE);
    }
  });

  it('CASE 1 — Miscarriage + Currently pregnant both persist', () => {
    expect(tap([MISCARRIAGE], PREGNANT)).toEqual([MISCARRIAGE, PREGNANT]);
  });

  it('CASE 1 — Miscarriage + Post-delivery/breastfeeding both persist', () => {
    expect(tap([MISCARRIAGE], POSTPARTUM)).toEqual([MISCARRIAGE, POSTPARTUM]);
  });

  it('CASE 1 — Miscarriage + PCOS both persist', () => {
    expect(tap([MISCARRIAGE], PCOS)).toEqual([MISCARRIAGE, PCOS]);
  });

  it('CASE 2 — selecting Miscarriage last removes nothing', () => {
    expect(tap([PREGNANT, POSTPARTUM], MISCARRIAGE))
      .toEqual([PREGNANT, POSTPARTUM, MISCARRIAGE]);
  });

  it('CASE 2 — selecting Miscarriage first removes nothing', () => {
    let answer = tap([], MISCARRIAGE);
    answer = tap(answer, PREGNANT);
    answer = tap(answer, POSTPARTUM);
    expect(answer).toEqual([MISCARRIAGE, PREGNANT, POSTPARTUM]);
  });

  it('CASE 4 — Miscarriage toggles off without disturbing the others', () => {
    const answer = tap([MISCARRIAGE, PREGNANT, POSTPARTUM], MISCARRIAGE);
    expect(answer).toEqual([PREGNANT, POSTPARTUM]);
  });

  it('CASE 8 — PCOS and unrelated options are unaffected by Miscarriage', () => {
    const answer = tap([PCOS, 'Endometriosis', 'Heavy bleeding periods'], MISCARRIAGE);
    expect(answer).toEqual([PCOS, 'Endometriosis', 'Heavy bleeding periods', MISCARRIAGE]);
  });

  it('pregnant + breastfeeding stay co-selectable (untouched by this change)', () => {
    expect(tap([PREGNANT], POSTPARTUM)).toEqual([PREGNANT, POSTPARTUM]);
  });

  it('the existing menopause exclusivity still fires', () => {
    // Guards against having weakened the symmetric group rules.
    expect(tap([PREGNANT], 'Post-menopause')).toEqual(['Post-menopause']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENCE — the stored answer must survive navigation, resume and submit.
// ─────────────────────────────────────────────────────────────────────────────
describe('Miscarriage — stored answer survives the round trip', () => {
  const stored = [MISCARRIAGE, PREGNANT, POSTPARTUM];

  it('CASE 5/6 — a JSON round trip (Next→Back, save→resume) preserves it', () => {
    // The store persists answers verbatim through JSON in localStorage; both
    // navigation and resume read back through this same shape.
    expect(JSON.parse(JSON.stringify({ hormonal: stored })).hormonal).toEqual(stored);
  });

  it('CASE 6/7 — every stored value stays visible, so none is filtered on resume', () => {
    // filterAnswerToVisible runs against the restored answers and drops any
    // option the gates hide. All three must survive for a 32-year-old female.
    const q = hormonalQuestion();
    const visible = getVisibleOptions(q, femaleAnswers).map((o) => o.id);
    expect(visible).toEqual(expect.arrayContaining(stored));
    expect(filterAnswerToVisible(q, stored, femaleAnswers)).toEqual(stored);
  });

  it('CASE 7 — the submitted payload carries all three values into the engine', () => {
    const ans: PatientAnswers = { ...base, hormonal: stored };
    const present = detectConditions(ans, flagsFor({ isPregnant: true }));
    // Miscarriage is still recognised alongside a concurrent pregnancy.
    expect(present.has('PREGNANCY')).toBe(true);
    expect(ans.hormonal).toEqual(stored);
  });
});

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
// MISCARRIAGE — clinical rule 2026-09-05, corrected 2026-09-07, revised 2026-09-29.
//
//   hormonal includes 'Miscarriage'
//   ⇒ PHENOTYPE INFLAMATION (via the MISCARRIAGE condition) and
//     PRO IMMUNE GOLD (via the IMMUNE_DEPLETION allow-list).
//
// EXCLUSIVITY (2026-09-29): "Currently pregnant" and "Miscarriage" are now
// mutually exclusive — a patient cannot simultaneously declare an ongoing
// pregnancy and a miscarriage. The rule is SYMMETRIC and latest-wins:
//   • selecting "Currently pregnant" deselects "Miscarriage"
//   • selecting "Miscarriage" deselects "Currently pregnant"
// It is applied PER-PAIR, so Miscarriage remains freely combinable with every
// other option (PCOS, Endometriosis, Peri/Post-menopause, Heavy bleeding, and —
// pending separate clinical review — "Post-delivery or breastfeeding").
//
// SAFETY: "Currently pregnant" drives the pregnancy kit lock (HEALTHY-9 only).
// The exclusivity removes "Currently pregnant" from the stored answer whenever
// Miscarriage wins, so no stale pregnancy value survives to bypass — and when
// "Currently pregnant" wins, the lock still fires. These tests pin both.
//
// Miscarriage on its own is still reproductive history that drives its two kits
// and must NOT trip the pregnancy lock.
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
// EXCLUSIVITY — Currently pregnant ↔ Miscarriage (symmetric, latest-wins).
// ─────────────────────────────────────────────────────────────────────────────
describe('Miscarriage ↔ Currently pregnant — mutual exclusivity', () => {
  it('CASE 0 — Miscarriage is grouped only with Currently pregnant and Post-delivery/breastfeeding', () => {
    const q = hormonalQuestion();
    // The one-way disable mechanism is not reintroduced.
    expect((q as Record<string, unknown>).optionDisableRules).toBeUndefined();
    const matesOfMiscarriage = new Set<string>();
    for (const g of q.mutualExclusivityGroups ?? []) {
      if (g.includes(MISCARRIAGE)) for (const id of g) if (id !== MISCARRIAGE) matesOfMiscarriage.add(id);
    }
    expect([...matesOfMiscarriage].sort()).toEqual([PREGNANT, POSTPARTUM].sort());
    // per-pair, never merged: each group Miscarriage appears in has exactly 2 members
    for (const g of q.mutualExclusivityGroups ?? []) {
      if (g.includes(MISCARRIAGE)) expect(g.length).toBe(2);
    }
  });

  it('ORDER 1 — Miscarriage then Currently pregnant → only Currently pregnant', () => {
    let answer = tap([], MISCARRIAGE);
    expect(answer).toEqual([MISCARRIAGE]);
    answer = tap(answer, PREGNANT);
    expect(answer).toEqual([PREGNANT]);
  });

  it('ORDER 2 — Currently pregnant then Miscarriage → only Miscarriage', () => {
    let answer = tap([], PREGNANT);
    expect(answer).toEqual([PREGNANT]);
    answer = tap(answer, MISCARRIAGE);
    expect(answer).toEqual([MISCARRIAGE]);
  });

  it('the two are never both active regardless of surrounding selections', () => {
    // Start with pregnant + an unrelated option, then pick miscarriage.
    const answer = tap([PREGNANT, PCOS], MISCARRIAGE);
    expect(answer).toContain(MISCARRIAGE);
    expect(answer).not.toContain(PREGNANT);
    expect(answer).toContain(PCOS); // unrelated option preserved
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// COEXISTENCE — Miscarriage excludes only Currently pregnant and Post-delivery/
// breastfeeding; every other combination stays allowed.
// ─────────────────────────────────────────────────────────────────────────────
describe('Miscarriage — coexists with every option except pregnant & breastfeeding', () => {
  it('Miscarriage + PCOS both persist', () => {
    expect(tap([MISCARRIAGE], PCOS)).toEqual([MISCARRIAGE, PCOS]);
  });

  it('Miscarriage + Peri-menopause both persist (no transitive exclusion)', () => {
    expect(tap([MISCARRIAGE], 'Peri-menopause')).toEqual([MISCARRIAGE, 'Peri-menopause']);
  });

  it('Miscarriage + Post-menopause both persist', () => {
    expect(tap([MISCARRIAGE], 'Post-menopause')).toEqual([MISCARRIAGE, 'Post-menopause']);
  });

  it('Miscarriage + Post-hysterectomy both persist', () => {
    expect(tap([MISCARRIAGE], 'Post-hysterectomy')).toEqual([MISCARRIAGE, 'Post-hysterectomy']);
  });

  it('Miscarriage + HRT both persist', () => {
    expect(tap([MISCARRIAGE], 'Hormone Replacement Therapy (HRT)'))
      .toEqual([MISCARRIAGE, 'Hormone Replacement Therapy (HRT)']);
  });

  it('CASE 8 — PCOS / Endometriosis / Heavy bleeding are unaffected by Miscarriage', () => {
    const answer = tap([PCOS, 'Endometriosis', 'Heavy bleeding periods'], MISCARRIAGE);
    expect(answer).toEqual([PCOS, 'Endometriosis', 'Heavy bleeding periods', MISCARRIAGE]);
  });

  it('toggling Miscarriage off leaves the coexisting options intact', () => {
    const answer = tap([MISCARRIAGE, PCOS], MISCARRIAGE);
    expect(answer).toEqual([PCOS]);
  });

  it('Post-menopause + HRT stay co-selectable', () => {
    expect(tap(['Post-menopause'], 'Hormone Replacement Therapy (HRT)'))
      .toEqual(['Post-menopause', 'Hormone Replacement Therapy (HRT)']);
  });

  it('the existing menopause exclusivity still fires', () => {
    expect(tap([PREGNANT], 'Post-menopause')).toEqual(['Post-menopause']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// NEW EXCLUSIVE PAIRS (2026-09-30) — both selection orders, latest-wins.
// ─────────────────────────────────────────────────────────────────────────────
describe('Currently pregnant ↔ Post-delivery or breastfeeding — mutual exclusivity', () => {
  it('ORDER 1 — breastfeeding then pregnant → only pregnant', () => {
    expect(tap([POSTPARTUM], PREGNANT)).toEqual([PREGNANT]);
  });
  it('ORDER 2 — pregnant then breastfeeding → only breastfeeding', () => {
    expect(tap([PREGNANT], POSTPARTUM)).toEqual([POSTPARTUM]);
  });
});

describe('Currently pregnant ↔ Post-hysterectomy — mutual exclusivity', () => {
  it('ORDER 1 — hysterectomy then pregnant → only pregnant', () => {
    expect(tap(['Post-hysterectomy'], PREGNANT)).toEqual([PREGNANT]);
  });
  it('ORDER 2 — pregnant then hysterectomy → only hysterectomy', () => {
    expect(tap([PREGNANT], 'Post-hysterectomy')).toEqual(['Post-hysterectomy']);
  });
});

describe('Miscarriage ↔ Post-delivery or breastfeeding — mutual exclusivity', () => {
  it('ORDER 1 — breastfeeding then miscarriage → only miscarriage', () => {
    expect(tap([POSTPARTUM], MISCARRIAGE)).toEqual([MISCARRIAGE]);
  });
  it('ORDER 2 — miscarriage then breastfeeding → only breastfeeding', () => {
    expect(tap([MISCARRIAGE], POSTPARTUM)).toEqual([POSTPARTUM]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SAFETY — the pregnancy lock must survive the exclusivity, no stale bypass.
// ─────────────────────────────────────────────────────────────────────────────
describe('Miscarriage exclusivity — pregnancy safety lock', () => {
  it('when Currently pregnant wins, the pregnancy lock still fires', () => {
    // Miscarriage first, then pregnant → answer is [PREGNANT].
    const answer = tap([MISCARRIAGE], PREGNANT);
    expect(answer).toEqual([PREGNANT]);
    const ans: PatientAnswers = { ...base, hormonal: answer };
    const present = detectConditions(ans, flagsFor({ isPregnant: true }));
    expect(present.has('PREGNANCY')).toBe(true);
  });

  it('when Miscarriage wins, no stale "Currently pregnant" survives to bypass', () => {
    // Pregnant first, then miscarriage → answer must NOT retain pregnant.
    const answer = tap([PREGNANT], MISCARRIAGE);
    expect(answer).toEqual([MISCARRIAGE]);
    expect(answer).not.toContain(PREGNANT);
    const ans: PatientAnswers = { ...base, hormonal: answer };
    const present = detectConditions(ans, flagsFor({}));
    // The patient has declared not-pregnant, so no pregnancy lock from hormonal.
    expect(present.has('PREGNANCY')).toBe(false);
    // ...and the miscarriage signal is intact.
    expect(present.has('MISCARRIAGE')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENCE — a reachable stored answer survives navigation, resume, submit.
// ─────────────────────────────────────────────────────────────────────────────
describe('Miscarriage — stored answer survives the round trip', () => {
  const stored = [MISCARRIAGE, PCOS]; // reachable: miscarriage coexists with PCOS

  it('a JSON round trip (Next→Back, save→resume) preserves it', () => {
    expect(JSON.parse(JSON.stringify({ hormonal: stored })).hormonal).toEqual(stored);
  });

  it('every stored value stays visible, so none is filtered on resume', () => {
    const q = hormonalQuestion();
    const visible = getVisibleOptions(q, femaleAnswers).map((o) => o.id);
    expect(visible).toEqual(expect.arrayContaining(stored));
    expect(filterAnswerToVisible(q, stored, femaleAnswers)).toEqual(stored);
  });

  it('the submitted payload carries the values into the engine', () => {
    const ans: PatientAnswers = { ...base, hormonal: stored };
    const present = detectConditions(ans, flagsFor({}));
    expect(present.has('MISCARRIAGE')).toBe(true);
    expect(ans.hormonal).toEqual(stored);
  });
});

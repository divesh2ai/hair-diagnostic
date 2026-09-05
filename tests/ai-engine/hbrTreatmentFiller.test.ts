import { describe, it, expect } from 'vitest';
import type { PatientAnswers } from '../../src/packages/types';
import type { ClinicalProfile, ClinicalFlags } from '../../src/packages/ai-engine/clinical-engine/types';
import type { TherapyNeeds } from '../../src/packages/ai-engine/therapy-engine/types';
import type { ClinicConfig } from '../../src/packages/ai-engine/kit-scorer/types';

import { scoreKits } from '../../src/packages/ai-engine/kit-scorer/scoreKits';
import { checkTherapyEligibility } from '../../src/packages/ai-engine/clinical-engine/contraindications/checkTherapyEligibility';

// ─────────────────────────────────────────────────────────────────────────────
// HBR_TREATMENT_FILLER — locked clinical rule 2026-08-27.
//
//   protocol has ≤ 3 kits
//   AND patient positively declared heat / chemical hair treatment (Q13)
//   AND HBR is not already present
//   AND PREGNANCY_LOCK does not apply
//   AND PHENOTYPE_SUPERSEDES_HBR does not apply
//   ⇒ append HAIR FACT HAIR BREAKAGE REPAIR (HBR) as the closing phase.
//
// Every expectation below was captured from the real pipeline
// (evaluateClinicalProfile-shaped profile → scoreKits → buildKitSequence).
// ─────────────────────────────────────────────────────────────────────────────

const HBR = 'HAIR FACT HAIR BREAKAGE REPAIR (HBR)';
const HEAT = 'Heat styling (straightener etc.)';
const CHEM = 'Chemical treatment (colour / keratin)';
const NEG = 'No heat or chemical treatments';

const OPEN_CLINIC: ClinicConfig = { clinicId: 'TEST', availableKits: [], substitutions: {} };
const NO_THERAPY: TherapyNeeds = { needs: [], needReasons: {} };

function flagsFor(o: Partial<ClinicalFlags>): ClinicalFlags {
  return {
    isRegrowGoal: false, hasGreyGoal: false, hasHairGoal: true,
    isVeg: false, isMale: true, isPregnant: false,
    isGrade45: false, isGrade123: true,
    hasActiveShedding: false, hasNoVisibleFall: false,
    hasGLP1Early: false, hasGLP1Late: false, hasCrashDiet: false,
    age: 40, goal: 'Reduce hair fall and improve quality & growth',
    grade: 'Grade 1 — Norwood II', count: '~20–50 strands', duration: '6–12 months',
    ...o,
  };
}

function profileFor(flags: ClinicalFlags, dx = 'AGA_MALE_123'): ClinicalProfile {
  return {
    primaryDiagnosis: dx, primaryScore: 95, secondaryDiagnoses: [],
    allScores: { [dx]: 95 }, scalpStates: ['NORMAL_SCALP'],
    rootCauses: ['DHT'], severity: 'MILD', flags,
  };
}

const base: PatientAnswers = {
  sex: 'Male', age: 40,
  goal: 'Reduce hair fall and improve quality & growth',
  duration: '6–12 months', count: '~20–50 strands', grade: 'Grade 1 — Norwood II',
  hairtype: [], scalp: ['Normal scalp'], cause: [], immunity: [], hormonal: [],
  gut: [], deficiency: [], diet: ['Non-vegetarian'], lifestyle: [], treatment: [],
};

// Hard water is ONE of three independent shaft-damage signals (CEO ruling,
// clinic launch freeze 2026-09-04): chemical treatment OR heat styling OR hard
// water. Any one of them qualifies on a single-kit protocol. `hw` opts a case
// into the hard-water route specifically.
const HARD_WATER = 'Hard water';
const hw = (ans: PatientAnswers): PatientAnswers => ({
  ...ans,
  cause: [...(ans.cause ?? []), HARD_WATER],
});

function run(ans: PatientAnswers, clinic: ClinicConfig = OPEN_CLINIC, profile?: ClinicalProfile) {
  return scoreKits(profile ?? profileFor(flagsFor({})), NO_THERAPY, ans, clinic);
}
function kitsOf(ans: PatientAnswers, clinic?: ClinicConfig, profile?: ClinicalProfile) {
  return run(ans, clinic, profile).rankedKits.map((k) => k.kitId);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Negative-treatment protection.
//
// signals().treatment() is a case-insensitive SUBSTRING match, so the negative
// option "No heat or chemical treatments" contains BOTH 'heat' and 'chemical'.
// Reading it as a positive signal would prescribe a shaft-repair kit to every
// patient who explicitly denied chemical processing. Same collision class as
// the 2026-06-15 "peri" substring bug.
// ─────────────────────────────────────────────────────────────────────────────
describe('HBR filler — negative treatment answers must never fire', () => {
  it('"No heat or chemical treatments" → FALSE (no HBR)', () => {
    expect(kitsOf({ ...base, treatment: [NEG] })).not.toContain(HBR);
  });

  it('empty treatment array → FALSE (no HBR)', () => {
    expect(kitsOf({ ...base, treatment: [] })).not.toContain(HBR);
  });

  it('undefined treatment → FALSE (no HBR)', () => {
    const ans = { ...base };
    delete (ans as Record<string, unknown>).treatment;
    expect(kitsOf(ans)).not.toContain(HBR);
  });

  it.each([
    ['None'],
    ['none of the above'],
    ['Never coloured or straightened'],
    ['No chemical treatment'],
    ['no heat styling'],
  ])('no/none/never-prefixed variant %j → FALSE (no HBR)', (answer) => {
    expect(kitsOf({ ...base, treatment: [answer] })).not.toContain(HBR);
  });

  it('Heat styling alone → TRUE (any one signal qualifies)', () => {
    expect(kitsOf({ ...base, treatment: [HEAT] })).toContain(HBR);
  });

  it('Chemical treatment alone → TRUE (any one signal qualifies)', () => {
    expect(kitsOf({ ...base, treatment: [CHEM] })).toContain(HBR);
  });

  it('both styling answers → TRUE', () => {
    expect(kitsOf({ ...base, treatment: [HEAT, CHEM] })).toContain(HBR);
  });

  it('mixed negative + positive selection → TRUE (positive wins)', () => {
    expect(kitsOf({ ...base, treatment: [NEG, HEAT] })).toContain(HBR);
  });

  it('hard water alone → TRUE (third independent signal, no treatment needed)', () => {
    expect(kitsOf(hw({ ...base, treatment: [] }))).toContain(HBR);
  });

  it('negative treatment answer + hard water → TRUE (hard water still qualifies)', () => {
    expect(kitsOf(hw({ ...base, treatment: [NEG] }))).toContain(HBR);
  });
});

// -----------------------------------------------------------------------------
// 1b. The dispensed shape - [pattern kit, HBR, PRO IMMUNE].
//
// The append takes a 1-kit protocol to 2, which the PRO_IMMUNE_CONSOLIDATION_
// FILLER then closes. The pattern kit is gender-resolved, so the same trigger
// yields MPHL or FPHL depending on the patient.
// -----------------------------------------------------------------------------
describe('HBR filler - dispensed protocol shape', () => {
  const femaleBase: PatientAnswers = {
    ...base, sex: 'Female', age: 35, grade: 'Grade 2 - Ludwig 2',
  };
  const femaleProfile = profileFor(
    flagsFor({ isMale: false, age: 35, grade: 'Grade 2 - Ludwig 2' }),
    'AGA_FEMALE_123',
  );

  it.each([[CHEM], [HEAT]])(
    'male + %s on a 1-kit protocol → MPHL, HBR, PRO IMMUNE',
    (signal) => {
      expect(kitsOf({ ...base, treatment: [signal] })).toEqual([
        'MPHL', HBR, 'PRO IMMUNE GOLD',
      ]);
    },
  );

  it('male + hard water on a 1-kit protocol → MPHL, HBR, PRO IMMUNE', () => {
    expect(kitsOf(hw({ ...base, treatment: [] }))).toEqual([
      'MPHL', HBR, 'PRO IMMUNE GOLD',
    ]);
  });

  it.each([[CHEM], [HEAT]])(
    'female + %s on a 1-kit protocol → FPHL, HBR, PRO IMMUNE',
    (signal) => {
      expect(
        kitsOf({ ...femaleBase, treatment: [signal] }, OPEN_CLINIC, femaleProfile),
      ).toEqual(['FPHL', HBR, 'PRO IMMUNE GOLD']);
    },
  );

  it('female + hard water on a 1-kit protocol → FPHL, HBR, PRO IMMUNE', () => {
    expect(
      kitsOf(hw({ ...femaleBase, treatment: [] }), OPEN_CLINIC, femaleProfile),
    ).toEqual(['FPHL', HBR, 'PRO IMMUNE GOLD']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Interaction contract — resolveKitInteractions stays authoritative.
// PHENOTYPE_SUPERSEDES_HBR removes HBR because PHENOTYPE INFLAMATION covers
// shaft-damage biology. The filler must not re-add it afterwards, or the engine
// carries two competing sources of truth for the same kit.
// ─────────────────────────────────────────────────────────────────────────────
describe('HBR filler — PHENOTYPE_SUPERSEDES_HBR remains authoritative', () => {
  it('visible scalp inflammation (dandruff/oily) + chemical → NO late HBR re-add', () => {
    const kits = kitsOf({ ...base, scalp: ['Dandruff', 'Oily scalp'], treatment: [CHEM] });
    expect(kits).toContain('PHENOTYPE INFLAMATION');
    expect(kits).not.toContain(HBR);
  });

  it('oxidative lifestyle route to PHENOTYPE (smoking) + chemical → NO late HBR re-add', () => {
    const kits = kitsOf({ ...base, lifestyle: ['Smoking'], treatment: [CHEM] });
    expect(kits).toContain('PHENOTYPE INFLAMATION');
    expect(kits).not.toContain(HBR);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. The gate is exactly ONE resolved kit, exercised at every boundary.
//
// Narrowed from `<= 3` (clinic launch freeze, 2026-09-04): HBR is the closing
// layer for a protocol that has nothing else in it. At 2-3 kits the systemic
// drivers are already treated, and on a 2-kit protocol the append also pushed
// the count to 3 and re-triggered the PRO IMMUNE consolidation filler.
// ─────────────────────────────────────────────────────────────────────────────
describe('HBR filler — kit-count boundary', () => {
  it('1 real kit + chemical → HBR appended after the pattern kit', () => {
    const kits = kitsOf({ ...base, treatment: [CHEM] });
    expect(kits).toContain(HBR);
    expect(kits.indexOf('MPHL')).toBeLessThan(kits.indexOf(HBR));
  });

  it('2 real kits + chemical → filler does NOT fire (gate is exactly 1)', () => {
    const kits = kitsOf({ ...base, gut: ['GERD'], treatment: [CHEM] });
    expect(kits.length).toBeGreaterThanOrEqual(2);
    expect(kits).not.toContain(HBR);
  });

  it('3 real kits + chemical → filler does NOT fire (gate is exactly 1)', () => {
    const kits = kitsOf({ ...base, gut: ['GERD'], thyroid: ['Hypothyroidism'], treatment: [CHEM] });
    expect(kits.length).toBeGreaterThanOrEqual(3);
    expect(kits).not.toContain(HBR);
  });

  it('4 kits + chemical → filler does NOT fire', () => {
    const kits = kitsOf({ ...base, gut: ['GERD'], deficiency: ['Iron'], treatment: [CHEM] });
    expect(kits.length).toBeGreaterThanOrEqual(4);
    expect(kits).not.toContain(HBR);
  });

  it('5 kits + chemical → filler does NOT fire', () => {
    const kits = kitsOf({
      ...base, gut: ['GERD'], deficiency: ['Iron'], thyroid: ['Hypothyroidism'], treatment: [CHEM],
    });
    expect(kits.length).toBeGreaterThanOrEqual(5);
    expect(kits).not.toContain(HBR);
  });

  it('never appends HBR twice when it is already present natively', () => {
    // Standalone shaft damage with no pattern signal — HAIR_BREAKAGE survives
    // detectConditions' isOnlyShaftDamage gate and HBR is already the protocol.
    const ans: PatientAnswers = {
      ...base, grade: '', hairtype: [], cause: ['Hard water'], treatment: [HEAT],
    };
    const profile = profileFor(flagsFor({ grade: '', isGrade123: false }), 'HAIR_BREAKAGE');
    const kits = kitsOf(ans, OPEN_CLINIC, profile);
    expect(kits.filter((k) => k === HBR)).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Safety locks and clinic availability.
// ─────────────────────────────────────────────────────────────────────────────
describe('HBR filler — safety and clinic contracts', () => {
  it('PREGNANCY_LOCK is exclusive — chemical treatment does not add HBR', () => {
    const ans: PatientAnswers = {
      ...base, sex: 'Female', age: 28, hormonal: ['Currently pregnant'],
      is_pregnant: true, deficiency: ['Iron'], treatment: [CHEM],
    };
    const profile = profileFor(flagsFor({ isMale: false, isPregnant: true, age: 28 }), 'PREGNANCY');
    const kits = kitsOf(ans, OPEN_CLINIC, profile);
    expect(kits).not.toContain(HBR);
    expect(kits).toHaveLength(1);
  });

  it('injected HBR passes through clinic substitution like any other kit', () => {
    const clinic: ClinicConfig = {
      clinicId: 'RESTRICTED',
      availableKits: ['MPHL', 'PRO IMMUNE GOLD', 'PHENOTYPE INFLAMATION'],
      substitutions: { [HBR]: 'PHENOTYPE INFLAMATION' },
    };
    const kits = kitsOf({ ...base, treatment: [CHEM] }, clinic);
    expect(kits).not.toContain(HBR);
    expect(kits).toContain('PHENOTYPE INFLAMATION');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Audit trail — a doctor must be able to see why HBR is there.
// ─────────────────────────────────────────────────────────────────────────────
describe('HBR filler — audit trail', () => {
  const rec = run({ ...base, treatment: [CHEM] });

  it('appliedRules records the injection', () => {
    expect(rec.appliedRules.some((r) => r.startsWith('HBR_TREATMENT_FILLER'))).toBe(true);
  });

  it('ruleTrace records the reason and the triggering signals', () => {
    const entry = rec.ruleTrace.find((t) => t.rule === 'HBR_TREATMENT_FILLER');
    expect(entry).toBeDefined();
    expect(entry!.reason).toMatch(/heat \/ chemical/i);
    expect(entry!.signals).toContain(CHEM);
    expect(entry!.after).toContain(HBR);
  });

  it('carries a patient-specific rationale, not the generic fallback', () => {
    const scored = rec.rankedKits.find((k) => k.kitId === HBR);
    expect(scored).toBeDefined();
    expect(scored!.reasons.join(' ')).toMatch(/cuticle|shaft/i);
    expect(scored!.reasons.join(' ')).not.toMatch(/Selected as part of the recovery protocol/);
  });

  it('selectionJustification lists HBR as a phase', () => {
    expect(rec.selectionJustification).toContain(HBR);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. SR_005 contradiction guard — DOCUMENTS current reality, does not bless it.
//
// checkTherapyEligibility() SR_005 marks HBR BLOCKED when heat/chemical is
// declared without a corroborating hard-water signal. That function is NOT
// wired into any live path (see MIGRATION_NOTES.md IMAP_003), so it cannot
// remove HBR from the protocol. This test pins BOTH halves so the day someone
// wires eligibility in, this test fails loudly instead of silently changing
// what patients are prescribed.
// ─────────────────────────────────────────────────────────────────────────────
// SR_005 marks HBR ineligible for heat/chemical WITHOUT hard-water
// corroboration, and the questionnaire protocol says the same on both
// treatment options. The CEO ruling of 2026-09-04 makes any one of chemical /
// heat / hard water qualify on a 1-kit protocol, which knowingly overrides
// both.
//
// This is an ACCEPTED DIVERGENCE, not an oversight. It is pinned here so the
// conflict stays visible and measurable: if SR_005 is ever wired into the
// dispensing path, this suite is where the collision surfaces first.
// -----------------------------------------------------------------------------
// SR_005 — the HBR treatment-damage indication.
//
// SR_005 used to require hard-water corroboration and BLOCK HBR when only heat
// or chemical treatment was declared, while the sequence builder dispensed it
// anyway. The two contradicted each other on real patients; it was inert only
// because eligibility is not wired into the dispensing path.
//
// Both now read `hasHbrTreatmentDamageIndication`, so the safety rule and the
// dispensed protocol cannot drift again. The indication is OR semantics; the
// `resolved kit count === 1` gate stays a separate sequencing decision.
// -----------------------------------------------------------------------------
describe('SR_005 — HBR indication is any one of three signals', () => {
  const eligibility = (ans: PatientAnswers) =>
    checkTherapyEligibility(ans, kitsOf(ans), 'AGA_MALE_123', {});

  const isBlocked = (ans: PatientAnswers) =>
    eligibility(ans).blockedKits.includes(HBR);

  it('chemical only — indication eligible', () => {
    expect(isBlocked({ ...base, treatment: [CHEM] })).toBe(false);
  });

  it('heat only — indication eligible', () => {
    expect(isBlocked({ ...base, treatment: [HEAT] })).toBe(false);
  });

  it('hard water only — indication eligible', () => {
    expect(isBlocked(hw({ ...base, treatment: [] }))).toBe(false);
  });

  it('none of the three — not eligible, blocked by SR_005', () => {
    const ans: PatientAnswers = { ...base, treatment: [] };
    expect(isBlocked(ans)).toBe(true);
    expect(eligibility(ans).eligibilityMap[HBR]?.ruleId).toBe('SR_005');
  });

  it('the negative answer is not a declaration — still not eligible', () => {
    // `has()` is a bare substring match, so "No heat or chemical treatments"
    // used to satisfy the old derive helper and read as declared damage.
    expect(isBlocked({ ...base, treatment: [NEG] })).toBe(true);
  });

  it('agrees with the dispensed protocol on every signal — no divergence left', () => {
    for (const ans of [
      { ...base, treatment: [CHEM] },
      { ...base, treatment: [HEAT] },
      hw({ ...base, treatment: [] }),
    ] as PatientAnswers[]) {
      expect(kitsOf(ans)).toContain(HBR);
      expect(isBlocked(ans)).toBe(false);
    }
  });

  it('eligibility alone does NOT force HBR into a multi-kit protocol', () => {
    // The indication is established, but the protocol already carries systemic
    // drivers, so the sequencing gate refuses the kit. Indication and insertion
    // stay separate concepts.
    const ans: PatientAnswers = {
      ...base, gut: ['GERD'], thyroid: ['Hypothyroidism'], treatment: [CHEM],
    };
    const kits = kitsOf(ans);
    expect(kits.length).toBeGreaterThan(1);
    expect(isBlocked(ans)).toBe(false);
    expect(kits).not.toContain(HBR);
  });
});

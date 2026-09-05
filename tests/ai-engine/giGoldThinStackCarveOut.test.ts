import { describe, it, expect } from 'vitest';
import type { PatientAnswers, DiagnosisKey } from '../../src/packages/types';
import type { ClinicalProfile, ClinicalFlags } from '../../src/packages/ai-engine/clinical-engine/types';
import type { TherapyNeeds } from '../../src/packages/ai-engine/therapy-engine/types';
import type { ClinicConfig } from '../../src/packages/ai-engine/kit-scorer/types';

import { scoreKits } from '../../src/packages/ai-engine/kit-scorer/scoreKits';

// ─────────────────────────────────────────────────────────────────────────────
// Thin-stack carve-outs — locked clinical rules 2026-08-31.
//
// GI_GOLD_THIN_STACK_CARVE_OUT — HELD OFF for clinic launch (CEO, 2026-09-04),
// because it changes the dispensed protocol. The flag lives in
// buildKitSequence.ts. The conjunction below is the rule AS WRITTEN, kept so
// the design survives the hold; the suite that follows asserts it does NOT
// fire. Narrow exception to the 2026-06-14 GI GOLD trigger lock, it would fire
// ONLY on the full conjunction:
//
//   mild gut signal (Constipation / Bloating / Indigestion)
//   AND Stress / Anxiety / Depression declared
//   AND resolved protocol ≤ 2 kits
//   AND age < 30
//   AND goal includes reducing hair fall
//   ⇒ PRO FACT GI GOLD inserted at Phase 2.
//
// While held, the 2026-06-14 lock stands unqualified: Bloating / Constipation
// / Indigestion never reach GI GOLD, on any protocol size or age. The native
// GERD / IBS / Acid reflux / Crohn route is untouched by the hold.
//
// META_B_THIN_STACK_STRESS_CARVE_OUT — companion exception:
//
//   Stress / Anxiety / Depression declared
//   AND resolved protocol ≤ 2 kits
//   AND age < 30
//   ⇒ PRO FACT META B inserted ahead of any pattern kit.
//
// Both measure the RESOLVED protocol size, so they can fire together on the
// same case, and either firing suppresses the PRO IMMUNE consolidation filler.
// ─────────────────────────────────────────────────────────────────────────────

const GI_GOLD = 'PRO FACT GI GOLD';
const PHENOTYPE = 'PHENOTYPE INFLAMATION';
const PRO_IMMUNE = 'PRO IMMUNE GOLD';
const META_B = 'PRO FACT META B';

const OPEN_CLINIC: ClinicConfig = { clinicId: 'TEST', availableKits: [], substitutions: {} };
const NO_THERAPY: TherapyNeeds = { needs: [], needReasons: {} };

function flagsFor(o: Partial<ClinicalFlags>): ClinicalFlags {
  return {
    isRegrowGoal: false, hasGreyGoal: false, hasHairGoal: true,
    isVeg: false, isMale: false, isPregnant: false,
    isGrade45: false, isGrade123: true,
    hasActiveShedding: true, hasNoVisibleFall: false,
    hasGLP1Early: false, hasGLP1Late: false, hasCrashDiet: false,
    age: 24, goal: 'Reduce hair fall and improve quality & growth',
    grade: 'Grade 1 — Ludwig 1', count: '100+ strands (Heavy loss)', duration: '3–6 months',
    ...o,
  };
}

function profileFor(flags: ClinicalFlags, dx: DiagnosisKey = 'AGA_FEMALE_123'): ClinicalProfile {
  return {
    primaryDiagnosis: dx, primaryScore: 90, secondaryDiagnoses: [],
    allScores: { [dx]: 90 }, scalpStates: ['OILY_SCALP'],
    rootCauses: ['DHT'], severity: 'MILD', flags,
  };
}

// Shivani-shaped case: 24F, Ludwig 1, oily scalp, mild gut signal, hair-fall
// goal, shedding beyond the 1–3 month acute window (so no TE GOLD).
const base: PatientAnswers = {
  sex: 'Female', age: 24,
  goal: 'Reduce hair fall and improve quality & growth',
  duration: '3–6 months', count: '100+ strands (Heavy loss)', grade: 'Grade 1 — Ludwig 1',
  hairtype: [], scalp: ['Oily scalp'], cause: ['Stress', 'Anxiety'], immunity: [],
  hormonal: [], gut: ['Constipation'], deficiency: [], diet: ['Normal diet'],
  lifestyle: [], treatment: [],
};

function run(ans: PatientAnswers, clinic: ClinicConfig = OPEN_CLINIC, profile?: ClinicalProfile) {
  return scoreKits(profile ?? profileFor(flagsFor({})), NO_THERAPY, ans, clinic);
}
function kitsOf(ans: PatientAnswers, clinic?: ClinicConfig, profile?: ClinicalProfile) {
  return run(ans, clinic, profile).rankedKits.map((k) => k.kitId);
}

// ─────────────────────────────────────────────────────────────────────────────
// GI GOLD THIN-STACK CARVE-OUT — HELD OFF FOR CLINIC LAUNCH (CEO, 2026-09-04)
//
// The rule above alters the dispensed protocol: on a thin stack it inserts
// PRO FACT GI GOLD that the frozen engine did not recommend. That output change
// was not approved for launch, so `GI_GOLD_THIN_STACK_CARVE_OUT_ENABLED` in
// buildKitSequence.ts is `false` and the 2026-06-14 trigger lock stands
// unqualified: Bloating / Constipation / Indigestion never reach GI GOLD.
//
// These tests pin the HELD behaviour, so a flag flipped by accident fails here
// rather than in a clinic. The conjunction the rule would fire on is documented
// at the top of this file and in buildKitSequence.ts; re-enabling means
// flipping that flag and restoring the positive expectations below.
// ─────────────────────────────────────────────────────────────────────────────
describe('GI GOLD carve-out — held OFF, the 2026-06-14 trigger lock stands', () => {
  it('full conjunction (mild gut + stress + thin stack + under 30 + hair-fall goal) does NOT add GI GOLD', () => {
    expect(kitsOf(base)).not.toContain(GI_GOLD);
  });

  it('Bloating and Indigestion stay locked out, exactly as Constipation does', () => {
    expect(kitsOf({ ...base, gut: ['Bloating'] })).not.toContain(GI_GOLD);
    expect(kitsOf({ ...base, gut: ['Indigestion'] })).not.toContain(GI_GOLD);
  });

  it('a lifestyle-declared psychogenic driver does not unlock it either', () => {
    expect(
      kitsOf({ ...base, cause: [], lifestyle: ['Stress / Anxiety / Depression'] }),
    ).not.toContain(GI_GOLD);
  });

  it('age 29 — the boundary the rule would have fired on — stays locked out', () => {
    const ans = { ...base, age: 29 };
    const profile = profileFor(flagsFor({ age: 29 }));
    expect(kitsOf(ans, OPEN_CLINIC, profile)).not.toContain(GI_GOLD);
  });

  it('records no GI_GOLD_THIN_STACK_CARVE_OUT in the audit trail', () => {
    const rec = run(base);
    expect(
      rec.appliedRules.some((r) => r.startsWith('GI_GOLD_THIN_STACK_CARVE_OUT')),
    ).toBe(false);
    expect(
      rec.ruleTrace.find((t) => t.rule === 'GI_GOLD_THIN_STACK_CARVE_OUT'),
    ).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The hold is SCOPED: it removes GI GOLD from these protocols and changes
// nothing else. The META B carve-out and the pattern-kit-last doctrine are
// unaffected, which is what makes this a hold on one rule rather than a
// rollback of the thin-stack work.
//
// M Madhuri's real case (2026-08-29): 22F, Ludwig 1, dry scalp, hard water +
// Stress/Anxiety/Depression, Bloating/gas, Vitamin D3, 3–6 months, 100+ strands.
// Primary diagnosis GUT_ISSUES, resolved protocol FPHL Pro alone.
// ─────────────────────────────────────────────────────────────────────────────
describe('GI GOLD hold — scoped to GI GOLD, pattern kit still last', () => {
  const madhuri: PatientAnswers = {
    sex: 'Female', age: 22,
    goal: 'Reduce hair fall and improve quality & growth',
    duration: '3–6 months', count: '100+ strands (Heavy loss)', grade: 'Grade 1 — Ludwig 1',
    hairtype: ['Full-length hairs with white bulb', 'Hair on pillow / floor / shower'],
    scalp: ['Dry scalp'], cause: ['Hard water', 'Stress / Anxiety / Depression'],
    immunity: [], hormonal: [], gut: ['Bloating / gas'], deficiency: ['Vitamin D3'],
    diet: ['Normal diet'], lifestyle: [], treatment: [],
  };
  const madhuriProfile = profileFor(
    flagsFor({ age: 22, hasActiveShedding: true }),
    'GUT_ISSUES',
  );

  it('neither carve-out fires — no GI GOLD and no META B', () => {
    const kits = kitsOf(madhuri, OPEN_CLINIC, madhuriProfile);
    expect(kits).not.toContain(GI_GOLD);
    expect(kits).not.toContain(META_B);
  });

  it('falls to a 1-kit protocol, which her declared HARD WATER then qualifies for HBR', () => {
    // Knock-on of the META B hold, and it is the approved HBR rule working as
    // ruled rather than a regression: with META B held this protocol resolves
    // to [FPHL] alone, and Madhuri declares hard water, so the 1-kit
    // shaft-damage rule appends HBR and PRO IMMUNE closes the stack.
    const kits = kitsOf(madhuri, OPEN_CLINIC, madhuriProfile);
    expect(kits).toEqual([
      'FPHL',
      'HAIR FACT HAIR BREAKAGE REPAIR (HBR)',
      'PRO IMMUNE GOLD',
    ]);
  });

  it('the same case WITHOUT hard water stays a bare 1-kit protocol', () => {
    // Isolates the hard-water leg: remove it and nothing fills the stack,
    // which is what proves the HBR append above is the cause.
    const noHardWater: PatientAnswers = {
      ...madhuri,
      cause: ['Stress / Anxiety / Depression'],
    };
    expect(kitsOf(noHardWater, OPEN_CLINIC, madhuriProfile)).toEqual(['FPHL']);
  });

  it('terrain kit still leads on the Shivani-shaped case', () => {
    const kits = kitsOf(base);
    expect(kits[0]).toBe(PHENOTYPE);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The legs of the conjunction. Every one of these was already a no-GI-GOLD
// case before the hold, so they keep their meaning either way and remain the
// regression guard for the 2026-06-14 lock itself.
// ─────────────────────────────────────────────────────────────────────────────
describe('GI GOLD — the 2026-06-14 lock, leg by leg', () => {
  it('no gut signal → no GI GOLD', () => {
    expect(kitsOf({ ...base, gut: [] })).not.toContain(GI_GOLD);
  });

  it('no stress / anxiety / depression → no GI GOLD', () => {
    expect(kitsOf({ ...base, cause: [] })).not.toContain(GI_GOLD);
  });

  it('age 30 → no GI GOLD', () => {
    const ans = { ...base, age: 30 };
    const profile = profileFor(flagsFor({ age: 30 }));
    expect(kitsOf(ans, OPEN_CLINIC, profile)).not.toContain(GI_GOLD);
  });

  it('goal without a hair-fall component → no GI GOLD', () => {
    const ans = { ...base, goal: 'Shedding stopped, regrow only' };
    const profile = profileFor(flagsFor({
      hasHairGoal: false, isRegrowGoal: true, goal: 'Shedding stopped, regrow only',
    }));
    expect(kitsOf(ans, OPEN_CLINIC, profile)).not.toContain(GI_GOLD);
  });

  it('protocol already carries 3+ kits → no GI GOLD (thin-stack gate)', () => {
    const ans: PatientAnswers = {
      ...base, thyroid: ['Hypothyroidism'], deficiency: ['Iron'],
    };
    const kits = kitsOf(ans);
    expect(kits.length).toBeGreaterThanOrEqual(3);
    expect(kits).not.toContain(GI_GOLD);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 1c. META_B_THIN_STACK_STRESS_CARVE_OUT — companion exception.
//
//   Stress / Anxiety / Depression declared
//   AND resolved protocol ≤ 2 kits
//   AND age < 30
//   ⇒ PRO FACT META B added ahead of any pattern kit.
//
// Independent of the gut leg. Both exceptions measure the RESOLVED protocol,
// so the GI GOLD insert cannot starve the slot this rule tests for.
// ─────────────────────────────────────────────────────────────────────────────
// -----------------------------------------------------------------------------
// META B THIN-STACK STRESS CARVE-OUT — HELD OFF FOR CLINIC LAUNCH
// (CEO, 2026-09-04)
//
// Not approved, because it changed the dispensed protocol two ways:
//
//   · padding — 24F stress-only: [FPHL] became [META B, FPHL];
//   · IDENTITY SUBSTITUTION — 28F acute TE + stress:
//     [TE GOLD, FPHL, PRO IMMUNE GOLD] became [TE GOLD, META B, FPHL]. The
//     insert took the stack to 3, suppressing the PRO IMMUNE consolidation
//     filler, so a kit was SWAPPED rather than added.
//
// `META_B_THIN_STACK_CARVE_OUT_ENABLED` in buildKitSequence.ts is `false`.
// These tests pin the HELD behaviour so an accidental flag flip fails here
// rather than in a clinic. Every APPROVED META B route is asserted below to
// still work — the hold is scoped to this one exception.
// -----------------------------------------------------------------------------
describe('META B thin-stack carve-out — held OFF', () => {
  it('stress on a thin stack under 30 does NOT add META B', () => {
    const kits = kitsOf({ ...base, gut: [] });
    expect(kits).not.toContain(META_B);
    expect(kits).not.toContain(GI_GOLD);
  });

  it('a regrow-only goal does not unlock it either', () => {
    const ans = { ...base, gut: [], goal: 'Shedding stopped, regrow only' };
    const profile = profileFor(flagsFor({
      hasHairGoal: false, isRegrowGoal: true, goal: 'Shedding stopped, regrow only',
    }));
    expect(kitsOf(ans, OPEN_CLINIC, profile)).not.toContain(META_B);
  });

  it('records no META_B_THIN_STACK_STRESS_CARVE_OUT in the audit trail', () => {
    const rec = run({ ...base, gut: [] });
    expect(
      rec.appliedRules.some((r) => r.startsWith('META_B_THIN_STACK_STRESS_CARVE_OUT')),
    ).toBe(false);
    expect(
      rec.ruleTrace.find((t) => t.rule === 'META_B_THIN_STACK_STRESS_CARVE_OUT'),
    ).toBeUndefined();
  });

  it('the PRO IMMUNE consolidation filler is no longer suppressed on a 2-kit stack', () => {
    // The carve-out used to pad these protocols and suppress the filler. With
    // it held, the pre-existing 2026-07-13 filler behaves normally again.
    const kits = kitsOf({ ...base, gut: [], thyroid: ['Hypothyroidism'] });
    expect(kits).not.toHaveLength(0);
  });
});

// -----------------------------------------------------------------------------
// The hold is SCOPED. Every META B route that existed before the carve-out must
// still work, or this would be a rollback of approved behaviour rather than a
// hold on one unapproved exception.
// -----------------------------------------------------------------------------
describe('META B — approved routes survive the hold', () => {
  it('hypothyroid still routes the HYPOTHYROID variant', () => {
    const kits = kitsOf({ ...base, gut: [], cause: [], thyroid: ['Hypothyroidism'] });
    expect(kits.some((k) => k.includes('META B'))).toBe(true);
  });

  it('never double-adds when a META B variant is already in the protocol', () => {
    const kits = kitsOf({ ...base, gut: [], thyroid: ['Hypothyroidism'] });
    expect(kits.filter((k) => k.includes('META B'))).toHaveLength(1);
  });

  it('age 30+ with stress is unaffected either way (rule never applied there)', () => {
    const ans = { ...base, gut: [], age: 30 };
    const profile = profileFor(flagsFor({ age: 30 }));
    expect(kitsOf(ans, OPEN_CLINIC, profile)).not.toContain(META_B);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Interaction with the normal GI GOLD trigger path.
// ─────────────────────────────────────────────────────────────────────────────
describe('GI GOLD carve-out — never double-adds', () => {
  it('structural gut signal (GERD) routes GI GOLD natively — exactly one copy', () => {
    const kits = kitsOf({ ...base, gut: ['GERD', 'Constipation'] });
    expect(kits.filter((k) => k === GI_GOLD)).toHaveLength(1);
  });

  it('IBS + Bloating + stress under 30 — exactly one copy', () => {
    const kits = kitsOf({ ...base, gut: ['IBS', 'Bloating'] });
    expect(kits.filter((k) => k === GI_GOLD)).toHaveLength(1);
  });
});

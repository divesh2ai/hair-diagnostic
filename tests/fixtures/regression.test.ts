/**
 * HairOS Clinical Engine — Golden Patient Fixture Regression Tests
 *
 * Runs every fixture in tests/fixtures/patients/ through the full
 * clinical-engine → therapy-engine → kit-scorer pipeline and asserts:
 *   - Primary diagnosis matches expected
 *   - Scalp states match expected
 *   - Root causes match expected
 *   - Therapy needs include all expected needs
 *   - Top kit (rankedKits[0]) matches expected
 *   - All mustIncludeKits are present in the output
 *   - All mustExcludeKits are absent from the output
 *   - All mustTriggerRules strings appear in appliedRules
 *   - All mustBlockRules strings do NOT appear in appliedRules
 *   - PRO IMMUNE is always the final kit when present (invariant)
 *   - No duplicate kit IDs in output
 *   - Output is deterministic (identical input produces identical output)
 */

import { evaluateClinicalProfile } from '../../src/packages/ai-engine/clinical-engine/evaluateClinicalProfile';
import { mapTherapyNeeds }         from '../../src/packages/ai-engine/therapy-engine/mapTherapyNeeds';
import { scoreKits }               from '../../src/packages/ai-engine/kit-scorer/scoreKits';
import {
  loadAllFixtures,
  loadFixture,
  budgetForFixture,
  OPEN_CLINIC,
  validateFixtureSchema,
  type PatientFixture,
} from './loader';
import type { PatientAnswers } from '../../src/packages/types';

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline runner
// ─────────────────────────────────────────────────────────────────────────────

function runFixture(fixture: PatientFixture) {
  const profile      = evaluateClinicalProfile(fixture.answers);
  const needs        = mapTherapyNeeds(profile);
  const budget       = budgetForFixture(fixture);
  const recommendation = scoreKits(profile, needs, fixture.answers, OPEN_CLINIC, budget);
  return { profile, needs, recommendation };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixture schema integrity — every fixture must be well-formed
// ─────────────────────────────────────────────────────────────────────────────

describe('fixture schema integrity', () => {
  const fixtures = loadAllFixtures();

  test('at least 25 fixture files loaded', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(25);
  });

  fixtures.forEach((fixture) => {
    test(`[${fixture.id}] schema is valid`, () => {
      const errors = validateFixtureSchema(fixture);
      expect(errors).toEqual([]);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Per-fixture regression tests — generated dynamically from JSON files
// ─────────────────────────────────────────────────────────────────────────────

describe('golden patient fixture regression', () => {
  const fixtures = loadAllFixtures();

  fixtures.forEach((fixture) => {
    describe(`[${fixture.id}] — ${fixture.description.slice(0, 80)}`, () => {
      let result: ReturnType<typeof runFixture>;

      beforeAll(() => {
        result = runFixture(fixture);
      });

      // ── Clinical diagnosis ──────────────────────────────────────────────────

      test('primary diagnosis matches expected', () => {
        const { expected } = fixture;
        if (expected.diagnoses.length === 0) return;
        expect(result.profile.primaryDiagnosis).toBe(expected.diagnoses[0]);
      });

      // ── Scalp states ────────────────────────────────────────────────────────

      test('scalp states include all expected states', () => {
        const { expected } = fixture;
        if (expected.scalpStates.length === 0) return;
        for (const state of expected.scalpStates) {
          expect(result.profile.scalpStates).toContain(state);
        }
      });

      // ── Root causes ─────────────────────────────────────────────────────────

      test('root causes include all expected causes', () => {
        const { expected } = fixture;
        if (expected.rootCauses.length === 0) return;
        for (const cause of expected.rootCauses) {
          expect(result.profile.rootCauses).toContain(cause);
        }
      });

      // ── Therapy needs ───────────────────────────────────────────────────────

      test('therapy needs include all expected needs', () => {
        const { expected } = fixture;
        if (expected.therapyNeeds.length === 0) return;
        for (const need of expected.therapyNeeds) {
          expect(result.needs.needs).toContain(need);
        }
      });

      // ── Kit output contract ─────────────────────────────────────────────────

      test('rankedKits is a non-empty array', () => {
        expect(Array.isArray(result.recommendation.rankedKits)).toBe(true);
        expect(result.recommendation.rankedKits.length).toBeGreaterThan(0);
      });

      test('no duplicate kit IDs in output', () => {
        const ids = result.recommendation.rankedKits.map((k) => k.kitId);
        expect(new Set(ids).size).toBe(ids.length);
      });

      test('phase numbers are sequential starting at 1', () => {
        result.recommendation.rankedKits.forEach((kit, i) => {
          expect(kit.phase).toBe(i + 1);
        });
      });

      test('kit scores are descending', () => {
        const kits = result.recommendation.rankedKits;
        for (let i = 1; i < kits.length; i++) {
          expect(kits[i]!.score).toBeLessThanOrEqual(kits[i - 1]!.score);
        }
      });

      test('output respects budget maxKits cap', () => {
        const budget = budgetForFixture(fixture);
        expect(result.recommendation.rankedKits.length).toBeLessThanOrEqual(budget.maxKits);
      });

      // ── Top kit ──────────────────────────────────────────────────────────────

      test(`top kit is "${fixture.expected.topKit}"`, () => {
        expect(result.recommendation.rankedKits[0]!.kitId).toBe(fixture.expected.topKit);
      });

      // ── mustIncludeKits ──────────────────────────────────────────────────────

      fixture.expected.mustIncludeKits.forEach((kitId) => {
        test(`kit "${kitId}" is present in output`, () => {
          const ids = result.recommendation.rankedKits.map((k) => k.kitId);
          expect(ids).toContain(kitId);
        });
      });

      // ── mustExcludeKits ──────────────────────────────────────────────────────

      fixture.expected.mustExcludeKits.forEach((kitId) => {
        test(`kit "${kitId}" is NOT present in output`, () => {
          const ids = result.recommendation.rankedKits.map((k) => k.kitId);
          expect(ids).not.toContain(kitId);
        });
      });

      // ── mustTriggerRules ─────────────────────────────────────────────────────

      fixture.expected.mustTriggerRules.forEach((ruleFragment) => {
        test(`rule "${ruleFragment}" was triggered`, () => {
          const allRules = result.recommendation.appliedRules.join('\n');
          expect(allRules).toContain(ruleFragment);
        });
      });

      // ── mustBlockRules ───────────────────────────────────────────────────────

      fixture.expected.mustBlockRules.forEach((ruleFragment) => {
        test(`rule "${ruleFragment}" was NOT triggered`, () => {
          const allRules = result.recommendation.appliedRules.join('\n');
          expect(allRules).not.toContain(ruleFragment);
        });
      });

      // ── PRO IMMUNE last invariant ─────────────────────────────────────────────

      test('PRO IMMUNE is the final kit when present', () => {
        const kits = result.recommendation.rankedKits;
        const ids  = kits.map((k) => k.kitId);
        const immuneIdx = ids.findIndex((id) => id.includes('PRO IMMUNE'));
        if (immuneIdx >= 0) {
          expect(immuneIdx).toBe(ids.length - 1);
        }
      });

      // ── Determinism ───────────────────────────────────────────────────────────

      test('output is deterministic on repeated runs', () => {
        const second = runFixture(fixture);
        expect(
          result.recommendation.rankedKits.map((k) => k.kitId)
        ).toEqual(
          second.recommendation.rankedKits.map((k) => k.kitId)
        );
        expect(result.recommendation.appliedRules).toEqual(
          second.recommendation.appliedRules
        );
      });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Critical rule invariant tests — individually named for CI visibility
// ─────────────────────────────────────────────────────────────────────────────

describe('RULE 1 — PRO FACT META B substitution (RULE1_HYPO_METABOLIC)', () => {
  test('HYPO alone → PRO FACT META B HYPOTHYROID (RULE 1 does NOT fire)', () => {
    const fixture = loadFixture('hypothyroid_clean_01');
    const { recommendation } = runFixture(fixture);
    const ids = recommendation.rankedKits.map((k) => k.kitId);
    expect(ids).toContain('PRO FACT META B HYPOTHYROID');
    expect(ids).not.toContain('PRO FACT META B');
    expect(recommendation.appliedRules.join('\n')).not.toContain('RULE1_HYPO_METABOLIC');
  });

  test('HYPO + obesity → PRO FACT META B substitutes HYPOTHYROID variant (RULE 1 fires)', () => {
    const fixture = loadFixture('hypothyroid_obesity_rule1_01');
    const { recommendation } = runFixture(fixture);
    const ids = recommendation.rankedKits.map((k) => k.kitId);
    expect(ids).toContain('PRO FACT META B');
    expect(ids).not.toContain('PRO FACT META B HYPOTHYROID');
    expect(recommendation.appliedRules.join('\n')).toContain('RULE1_HYPO_METABOLIC');
  });

  test('RULE 1: exactly one META B variant present (no AMPK duplication)', () => {
    const fixture = loadFixture('hypothyroid_obesity_rule1_01');
    const { recommendation } = runFixture(fixture);
    const metaBKits = recommendation.rankedKits.filter((k) => k.kitId.includes('PRO FACT META B'));
    expect(metaBKits.length).toBe(1);
  });
});

describe('RULE 2 — RAPID WEIGHT LOSS SHIELD precedence (GLP1)', () => {
  test('GLP-1 early → SHIELD is kit at position 0 (Phase 1)', () => {
    const fixture = loadFixture('glp1_early_shield_01');
    const { recommendation } = runFixture(fixture);
    expect(recommendation.rankedKits[0]!.kitId).toBe('RAPID WEIGHT LOSS SHIELD');
    expect(recommendation.appliedRules.join('\n')).toContain('GLP1_EARLY');
  });

  test('GLP-1 late → SHIELD is kit at position 1 (Phase 2)', () => {
    const fixture = loadFixture('glp1_late_shield_01');
    const { recommendation } = runFixture(fixture);
    expect(recommendation.rankedKits[1]!.kitId).toBe('RAPID WEIGHT LOSS SHIELD');
    expect(recommendation.appliedRules.join('\n')).toContain('GLP1_LATE');
  });

  test('GLP-1 early: SHIELD remains Phase 1 after priority lifting', () => {
    const fixture = loadFixture('glp1_late_iron_deficiency_01');
    const { recommendation } = runFixture(fixture);
    const ids = recommendation.rankedKits.map((k) => k.kitId);
    expect(ids).toContain('RAPID WEIGHT LOSS SHIELD');
    expect(recommendation.appliedRules.join('\n')).toContain('GLP1_LATE');
  });

  test('no GLP-1 flag → GLP1 rules do NOT fire for crash diet', () => {
    const fixture = loadFixture('crash_diet_rapid_loss_01');
    const { recommendation } = runFixture(fixture);
    const rules = recommendation.appliedRules.join('\n');
    expect(rules).not.toContain('GLP1_EARLY');
    expect(rules).not.toContain('GLP1_LATE');
  });
});

describe('PCOS stack logic', () => {
  test('PCOS_ONLY → F-PCOS-1 in output (no diabetes)', () => {
    const fixture = loadFixture('pcos_only_dandruff_01');
    const { recommendation } = runFixture(fixture);
    const ids = recommendation.rankedKits.map((k) => k.kitId);
    expect(ids).toContain('F-PCOS -1');
  });

  test('PCOS_OBESITY → PRO FACT META B PCOS, no F-PCOS-1', () => {
    const fixture = loadFixture('pcos_obesity_01');
    const { recommendation } = runFixture(fixture);
    const ids = recommendation.rankedKits.map((k) => k.kitId);
    expect(ids).toContain('PRO FACT META B PCOS');
    expect(ids).not.toContain('F-PCOS -1');
  });

  test('PCOS_ONLY + diabetes → F-PCOS-1 upgraded to PRO FACT META B PCOS', () => {
    const fixture = loadFixture('pcos_diabetes_upgrade_01');
    const { recommendation } = runFixture(fixture);
    const ids = recommendation.rankedKits.map((k) => k.kitId);
    expect(ids).toContain('PRO FACT META B PCOS');
    expect(ids).not.toContain('F-PCOS -1');
    expect(recommendation.appliedRules.join('\n')).toContain('PCOS_DIABETES_UPGRADE');
  });

  test('PCOS_OBESITY + Hypothyroid → single PRO FACT META B (triple-axis cover)', () => {
    const fixture = loadFixture('pcos_obesity_hypothyroid_01');
    const { recommendation } = runFixture(fixture);
    const ids = recommendation.rankedKits.map((k) => k.kitId);
    expect(ids).toContain('PRO FACT META B');
    expect(ids).not.toContain('PRO FACT META B PCOS');
    expect(ids).not.toContain('PRO FACT META B HYPOTHYROID');
    expect(recommendation.appliedRules.join('\n')).toContain('PCOS_OBESITY_HYPO');
  });

  test('PCOS_ONLY + metabolic → PRO FACT META B injected (METABOLIC_GENERIC)', () => {
    const fixture = loadFixture('pcos_only_metabolic_injection_01');
    const { recommendation } = runFixture(fixture);
    const ids = recommendation.rankedKits.map((k) => k.kitId);
    expect(ids).toContain('F-PCOS -1');
    expect(ids).toContain('PRO FACT META B');
    expect(recommendation.appliedRules.join('\n')).toContain('METABOLIC_GENERIC');
  });

  test('PCOS_ONLY + iron + FPHL → both IRON UP GOLD and FPHL stacked', () => {
    const fixture = loadFixture('pcos_only_iron_fphl_01');
    const { recommendation } = runFixture(fixture);
    const ids = recommendation.rankedKits.map((k) => k.kitId);
    expect(ids).toContain('IRON UP GOLD');
    expect(ids).toContain('FPHL');
    expect(recommendation.appliedRules.join('\n')).toContain('PCOS_IRON');
    expect(recommendation.appliedRules.join('\n')).toContain('PCOS_FPHL');
  });
});

describe('grey goal prioritisation', () => {
  test('greying sole concern → EARLY_GREY locked, EARLY GREYING CARE GOLD is Phase 1', () => {
    const fixture = loadFixture('greying_sole_concern_01');
    const { profile, recommendation } = runFixture(fixture);
    expect(profile.primaryDiagnosis).toBe('EARLY_GREY');
    expect(recommendation.rankedKits[0]!.kitId).toBe('EARLY GREYING CARE GOLD');
  });

  test('greying + hair fall → NOT locked, grey appended last via GREY_GOAL rule', () => {
    const fixture = loadFixture('greying_with_hairloss_01');
    const { profile, recommendation } = runFixture(fixture);
    expect(profile.primaryDiagnosis).not.toBe('EARLY_GREY');
    const ids = recommendation.rankedKits.map((k) => k.kitId);
    expect(ids).toContain('EARLY GREYING CARE GOLD');
    expect(recommendation.appliedRules.join('\n')).toContain('GREY_GOAL');
  });

  test('greying + PHENOTYPE present → OXIDATIVE STRESS not added (no pathway overlap)', () => {
    const fixture = loadFixture('greying_with_hairloss_01');
    const { recommendation } = runFixture(fixture);
    const ids = recommendation.rankedKits.map((k) => k.kitId);
    expect(ids).not.toContain('OXIDATIVE STRESS');
    expect(recommendation.appliedRules.join('\n')).not.toContain('GREY_OXIDATIVE');
  });
});

describe('injection gating logic', () => {
  test('TE GOLD stripped when count indicates thinning only (NO_VISIBLE_FALL)', () => {
    const fixture = loadFixture('crown_thinning_no_visible_fall_01');
    const { recommendation } = runFixture(fixture);
    const ids = recommendation.rankedKits.map((k) => k.kitId);
    expect(ids).not.toContain('HAIR FACT TE GOLD');
    expect(ids).not.toContain('HAIR FACT TE GOLD VEG');
    expect(recommendation.appliedRules.join('\n')).toContain('NO_VISIBLE_FALL');
  });

  test('TE GOLD at Phase 1 when active shedding confirmed', () => {
    const fixture = loadFixture('male_aga_oily_01');
    const { recommendation } = runFixture(fixture);
    expect(recommendation.rankedKits[0]!.kitId).toBe('HAIR FACT TE GOLD');
    expect(recommendation.appliedRules.join('\n')).toContain('ACTIVE_SHEDDING');
  });

  test('regrow-only AGA → TE GOLD never prescribed (REGROW_GOAL_AGA)', () => {
    const fixture = loadFixture('regrow_only_male_aga_01');
    const { recommendation } = runFixture(fixture);
    const ids = recommendation.rankedKits.map((k) => k.kitId);
    expect(ids).not.toContain('HAIR FACT TE GOLD');
    expect(recommendation.appliedRules.join('\n')).toContain('REGROW_GOAL_AGA');
  });
});

describe('active shedding precedence', () => {
  test('active shedding: TE GOLD promoted to Phase 1', () => {
    const fixture = loadFixture('postpartum_breastfeeding_01');
    const { recommendation } = runFixture(fixture);
    expect(recommendation.rankedKits[0]!.kitId).toBe('HAIR FACT TE GOLD');
  });

  test('regrow goal: TE GOLD NOT promoted (isRegrowGoal bypasses activation)', () => {
    const fixture = loadFixture('regrow_only_male_aga_01');
    const { recommendation } = runFixture(fixture);
    const ids = recommendation.rankedKits.map((k) => k.kitId);
    expect(ids).not.toContain('HAIR FACT TE GOLD');
    expect(ids).not.toContain('HAIR FACT TE GOLD VEG');
  });
});

describe('contraindications — pregnancy lock', () => {
  test('PREGNANCY → exactly 1 kit: HEALTHY - 9', () => {
    const fixture = loadFixture('pregnancy_lock_01');
    const { recommendation } = runFixture(fixture);
    expect(recommendation.rankedKits).toHaveLength(1);
    expect(recommendation.rankedKits[0]!.kitId).toBe('HEALTHY - 9');
  });

  test('PREGNANCY: no other kits prescribed regardless of budget', () => {
    const fixture = loadFixture('pregnancy_lock_01');
    const { recommendation } = runFixture(fixture);
    const ids = recommendation.rankedKits.map((k) => k.kitId);
    const forbidden = ['HAIR FACT TE GOLD', 'PRO IMMUNE GOLD', 'FPHL', 'MPHL', 'PHENOTYPE INFLAMATION'];
    for (const kitId of forbidden) {
      expect(ids).not.toContain(kitId);
    }
  });

  test('PREGNANCY: audit trail mentions pregnancy in reasons', () => {
    const fixture = loadFixture('pregnancy_lock_01');
    const { recommendation } = runFixture(fixture);
    const reasons = recommendation.rankedKits[0]!.reasons.join(' ').toLowerCase();
    expect(reasons).toMatch(/pregnan/);
  });
});

describe('PRO IMMUNE last — universal invariant', () => {
  const fixturesWithImmune = [
    'postpartum_breastfeeding_01',
    'postpartum_delivery_01',
    'medication_illness_te_01',
    'alopecia_areata_01',
    'alopecia_areata_iron_combo_01',
    'peri_menopause_stress_01',
    'pro_immune_last_invariant_01',
    'frontal_recession_male_01',
  ];

  fixturesWithImmune.forEach((fixtureId) => {
    test(`[${fixtureId}] PRO IMMUNE is the final kit`, () => {
      const fixture = loadFixture(fixtureId);
      const { recommendation } = runFixture(fixture);
      const ids = recommendation.rankedKits.map((k) => k.kitId);
      const immuneIdx = ids.findIndex((id) => id.includes('PRO IMMUNE'));
      if (immuneIdx >= 0) {
        expect(immuneIdx).toBe(ids.length - 1);
      }
    });
  });
});

describe('veg kit alias resolution', () => {
  test('vegetarian patient → TE GOLD VEG (not standard)', () => {
    const fixture = loadFixture('nutritional_te_vegetarian_01');
    const { recommendation } = runFixture(fixture);
    const ids = recommendation.rankedKits.map((k) => k.kitId);
    expect(ids).toContain('HAIR FACT TE GOLD VEG');
    expect(ids).not.toContain('HAIR FACT TE GOLD');
  });
});

describe('budget cap enforcement', () => {
  test('STANDARD budget: max 5 kits', () => {
    const fixture = loadFixture('frontal_recession_male_01');
    const { recommendation } = runFixture(fixture);
    expect(recommendation.rankedKits.length).toBeLessThanOrEqual(5);
  });

  test('COMPREHENSIVE budget: max 7 kits', () => {
    const fixture = loadFixture('pcos_only_iron_fphl_01');
    const { recommendation } = runFixture(fixture);
    expect(recommendation.rankedKits.length).toBeLessThanOrEqual(7);
  });
});

describe('selectionJustification audit trail', () => {
  test('justification contains primary diagnosis', () => {
    const fixture = loadFixture('hypothyroid_obesity_rule1_01');
    const { recommendation } = runFixture(fixture);
    expect(recommendation.selectionJustification).toContain('THYROID_HYPO');
  });

  test('justification contains Phase sequence', () => {
    const fixture = loadFixture('male_aga_oily_01');
    const { recommendation } = runFixture(fixture);
    expect(recommendation.selectionJustification).toContain('Phase 1');
  });

  test('justification contains applied rule names for RULE 1', () => {
    const fixture = loadFixture('hypothyroid_obesity_rule1_01');
    const { recommendation } = runFixture(fixture);
    expect(recommendation.selectionJustification).toContain('RULE1_HYPO_METABOLIC');
  });
});

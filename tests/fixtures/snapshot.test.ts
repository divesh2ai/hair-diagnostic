/**
 * HairOS — Snapshot-style deterministic regression tests
 *
 * Each test captures the full pipeline output for a critical fixture and
 * compares it against a frozen snapshot. Jest's toMatchSnapshot() stores
 * the first run result and fails on any subsequent drift.
 *
 * To update snapshots after an intentional logic change:
 *   npx jest tests/fixtures/snapshot.test.ts --updateSnapshot
 *
 * NEVER update snapshots without a peer-reviewed clinical justification.
 * Each snapshot update must be accompanied by a comment in the clinical
 * decision log explaining WHY the output changed.
 */

import { evaluateClinicalProfile } from '../../src/packages/ai-engine/clinical-engine/evaluateClinicalProfile';
import { mapTherapyNeeds }         from '../../src/packages/ai-engine/therapy-engine/mapTherapyNeeds';
import { scoreKits }               from '../../src/packages/ai-engine/kit-scorer/scoreKits';
import { loadFixture, budgetForFixture, OPEN_CLINIC } from './loader';
import type { PatientFixture } from './loader';

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot runner — strips non-deterministic fields before comparing
// ─────────────────────────────────────────────────────────────────────────────

function snapshotRun(fixture: PatientFixture) {
  const profile        = evaluateClinicalProfile(fixture.answers);
  const needs          = mapTherapyNeeds(profile);
  const budget         = budgetForFixture(fixture);
  const recommendation = scoreKits(profile, needs, fixture.answers, OPEN_CLINIC, budget);

  return {
    clinicalProfile: {
      primaryDiagnosis:    profile.primaryDiagnosis,
      primaryScore:        profile.primaryScore,
      secondaryDiagnoses:  profile.secondaryDiagnoses.map((d) => ({ key: d.key, score: d.score })),
      scalpStates:         profile.scalpStates,
      rootCauses:          profile.rootCauses,
      severity:            profile.severity,
    },
    therapyNeeds: needs.needs,
    recommendation: {
      rankedKits:   recommendation.rankedKits.map((k) => ({
        kitId:        k.kitId,
        phase:        k.phase,
        score:        k.score,
        matchedNeeds: k.matchedNeeds,
      })),
      appliedRules: recommendation.appliedRules,
      protocolLabel: recommendation.protocolLabel,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Critical rule snapshots — one snapshot per rule under test
// ─────────────────────────────────────────────────────────────────────────────

describe('snapshot — RULE 1: PRO FACT META B substitution', () => {
  test('hypothyroid_clean_01 (RULE 1 negative)', () => {
    const fixture = loadFixture('hypothyroid_clean_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });

  test('hypothyroid_obesity_rule1_01 (RULE 1 positive)', () => {
    const fixture = loadFixture('hypothyroid_obesity_rule1_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });

  test('hypothyroid_crash_diet_01 (RULE 1 + crash diet)', () => {
    const fixture = loadFixture('hypothyroid_crash_diet_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });
});

describe('snapshot — RULE 2: RAPID WEIGHT LOSS SHIELD precedence', () => {
  test('glp1_early_shield_01 (GLP1 Early — SHIELD Phase 1)', () => {
    const fixture = loadFixture('glp1_early_shield_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });

  test('glp1_late_shield_01 (GLP1 Late — SHIELD Phase 2)', () => {
    const fixture = loadFixture('glp1_late_shield_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });

  test('glp1_late_iron_deficiency_01 (GLP1 Late + iron — SHIELD survives priority lifting)', () => {
    const fixture = loadFixture('glp1_late_iron_deficiency_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });

  test('crash_diet_rapid_loss_01 (no GLP-1 flag — SHIELD in base protocol only)', () => {
    const fixture = loadFixture('crash_diet_rapid_loss_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });
});

describe('snapshot — PCOS stack logic', () => {
  test('pcos_only_dandruff_01 (F-PCOS-1 base)', () => {
    const fixture = loadFixture('pcos_only_dandruff_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });

  test('pcos_obesity_01 (PRO FACT META B PCOS — no F-PCOS-1)', () => {
    const fixture = loadFixture('pcos_obesity_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });

  test('pcos_diabetes_upgrade_01 (PCOS_DIABETES_UPGRADE)', () => {
    const fixture = loadFixture('pcos_diabetes_upgrade_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });

  test('pcos_obesity_hypothyroid_01 (triple-axis single META B)', () => {
    const fixture = loadFixture('pcos_obesity_hypothyroid_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });

  test('pcos_only_iron_fphl_01 (PCOS + iron + FPHL stack)', () => {
    const fixture = loadFixture('pcos_only_iron_fphl_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });

  test('pcos_only_metabolic_injection_01 (PCOS_META_B_INJECTION)', () => {
    const fixture = loadFixture('pcos_only_metabolic_injection_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });
});

describe('snapshot — grey goal prioritisation', () => {
  test('greying_sole_concern_01 (EARLY_GREY lock)', () => {
    const fixture = loadFixture('greying_sole_concern_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });

  test('greying_with_hairloss_01 (grey appended last)', () => {
    const fixture = loadFixture('greying_with_hairloss_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });
});

describe('snapshot — injection gating', () => {
  test('crown_thinning_no_visible_fall_01 (NO_VISIBLE_FALL strips TE GOLD)', () => {
    const fixture = loadFixture('crown_thinning_no_visible_fall_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });

  test('regrow_only_male_aga_01 (REGROW_GOAL_AGA — TE GOLD never prescribed)', () => {
    const fixture = loadFixture('regrow_only_male_aga_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });

  test('female_aga_regrow_fphl_01 (REGROW_GOAL_AGA female — FPHL not MPHL)', () => {
    const fixture = loadFixture('female_aga_regrow_fphl_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });
});

describe('snapshot — contraindications', () => {
  test('pregnancy_lock_01 (HEALTHY-9 only)', () => {
    const fixture = loadFixture('pregnancy_lock_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });
});

describe('snapshot — active shedding precedence', () => {
  test('postpartum_breastfeeding_01 (TE GOLD promoted over LACTIHEALTH)', () => {
    const fixture = loadFixture('postpartum_breastfeeding_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });

  test('postpartum_delivery_01 (TE GOLD Phase 1, no LACTIHEALTH)', () => {
    const fixture = loadFixture('postpartum_delivery_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });

  test('medication_illness_te_01 (PRO IMMUNE repositioned last)', () => {
    const fixture = loadFixture('medication_illness_te_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });
});

describe('snapshot — AGA spectrum', () => {
  test('male_aga_oily_01 (Male AGA Grade 2 full stack)', () => {
    const fixture = loadFixture('male_aga_oily_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });

  test('male_aga_grade45_01 (Male AGA Grade 4 — MPHL leads, PRO IMMUNE last)', () => {
    const fixture = loadFixture('male_aga_grade45_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });

  test('female_aga_stress_01 (Female AGA Grade 2 full stack)', () => {
    const fixture = loadFixture('female_aga_stress_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });

  test('female_aga_under30_01 (AGA_FEMALE_UNDER30 special protocol)', () => {
    const fixture = loadFixture('female_aga_under30_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });
});

describe('snapshot — hormonal spectrum', () => {
  test('peri_menopause_stress_01 (PERI_MENOPAUSE dominant)', () => {
    const fixture = loadFixture('peri_menopause_stress_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });

  test('peri_menopause_metabolic_01 (PERI_MENO_METABOLIC injection)', () => {
    const fixture = loadFixture('peri_menopause_metabolic_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });

  test('post_menopause_diffuse_01 (POST_MENOPAUSE protocol)', () => {
    const fixture = loadFixture('post_menopause_diffuse_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });

  test('hypothyroid_peri_menopause_01 (THYROID_HYPO beats PERI_MENOPAUSE)', () => {
    const fixture = loadFixture('hypothyroid_peri_menopause_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });
});

describe('snapshot — veg / lifestyle / gut', () => {
  test('nutritional_te_vegetarian_01 (veg kit aliases)', () => {
    const fixture = loadFixture('nutritional_te_vegetarian_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });

  test('gut_stress_shedding_01 (GUT_ISSUES protocol)', () => {
    const fixture = loadFixture('gut_stress_shedding_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });

  test('night_shift_oxidative_01 (NIGHT_SHIFT + oxidative)', () => {
    const fixture = loadFixture('night_shift_oxidative_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });

  test('sedentary_stress_te_01 (METABOLIC_GENERIC injection)', () => {
    const fixture = loadFixture('sedentary_stress_te_01');
    expect(snapshotRun(fixture)).toMatchSnapshot();
  });
});

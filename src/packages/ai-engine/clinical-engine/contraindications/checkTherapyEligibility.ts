import type { PatientAnswers } from '../../../types';
import { isTeGoldDurationAboveThreeMonths } from '../../kit-scorer/rules/teGoldGatingRule';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type KitId = string;

export type EligibilityStatus = 'ELIGIBLE' | 'BLOCKED' | 'REDUCED_SCOPE' | 'PREFER_ALTERNATIVE' | 'CAUTION';

export interface KitEligibility {
  kitId: KitId;
  status: EligibilityStatus;
  ruleId: string;
  reason: string;
}

export interface ForbiddenCombination {
  kit_A: KitId;
  kit_B: KitId;
  ruleId: string;
  reason: string;
  resolution: string;
}

export interface TherapyEligibilityResult {
  blockedKits: KitId[];
  reducedScopeKits: KitId[];
  forbiddenCombinations: ForbiddenCombination[];
  eligibilityMap: Record<KitId, KitEligibility>;
  protocolOverride?: { kits: KitId[]; ruleId: string; reason: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal helpers — mirrors derivedSignals in clinical-engine.schema.json exactly
// ─────────────────────────────────────────────────────────────────────────────

function has(arr: unknown, v: string): boolean {
  if (!arr) return false;
  const target = v.toLowerCase();
  if (Array.isArray(arr)) return arr.some(x => String(x).toLowerCase().includes(target));
  return String(arr).toLowerCase().includes(target);
}

function deriveIsRegrowGoal(ans: PatientAnswers): boolean {
  const goal = ans.goal ?? [];
  return (has(goal, 'stopped') || has(goal, 'regrow')) && !has(goal, 'Reduce hair fall');
}

function deriveHasNoVisibleFall(ans: PatientAnswers): boolean {
  const count = ans.count ?? '';
  return has(count, 'thinning') || has(count, 'no visible fall');
}

function deriveHasActiveShedding(ans: PatientAnswers, dominantKey?: string): boolean {
  if (deriveIsRegrowGoal(ans)) return false;
  if (deriveHasNoVisibleFall(ans)) return false;

  const count = ans.count ?? '';
  const duration = ans.duration ?? '';
  const cause = ans.cause ?? [];

  return (
    (dominantKey?.startsWith('TE_') ?? false) ||
    has(count, '50') ||
    has(count, '100') ||
    has(count, 'Noticeable') ||
    has(duration, '1') ||
    has(duration, '3') ||
    has(cause, 'Stress') ||
    has(cause, 'Nutritional') ||
    has(cause, 'Medication') ||
    has(cause, 'Illness') ||
    has(cause, 'Surgery')
  );
}

function deriveHasGLP1Early(ans: PatientAnswers): boolean {
  return has(ans.cause ?? [], 'within 6 months');
}

function deriveHasGLP1Late(ans: PatientAnswers): boolean {
  return has(ans.cause ?? [], 'after 6 months');
}

function deriveHasCrashDiet(ans: PatientAnswers): boolean {
  return (
    deriveHasGLP1Early(ans) ||
    deriveHasGLP1Late(ans) ||
    has(ans.cause ?? [], 'crash diet') ||
    has(ans.cause ?? [], 'Post crash') ||
    has(ans.diet ?? [], 'Crash') ||
    has(ans.diet ?? [], 'Keto')
  );
}

function deriveIsVeg(ans: PatientAnswers): boolean {
  const diet = ans.diet ?? [];
  const hasVegOption = has(diet, 'Vegetarian') || has(diet, 'Vegan') || has(diet, 'Jain');
  const hasNonVegOption = has(diet, 'Non-vegetarian') || has(diet, 'Pescatarian');
  return hasVegOption && !hasNonVegOption;
}

function deriveIsMale(ans: PatientAnswers): boolean {
  return String(ans.sex ?? ans.gender ?? '').toLowerCase() === 'male';
}

function deriveIsGrade45(ans: PatientAnswers): boolean {
  const grade = ans.grade ?? '';
  return has(grade, 'Grade 4') || has(grade, 'Grade 5');
}

function deriveHasMetabolicSignal(ans: PatientAnswers): boolean {
  return (
    has(ans.lifestyle ?? [], 'Obesity') ||
    has(ans.lifestyle ?? [], 'Sedentary') ||
    has(ans.lifestyle ?? [], 'weight') ||
    has(ans.hormonal ?? [], 'Obesity') ||
    has(ans.diet ?? [], 'Irregular') ||
    has(ans.diet ?? [], 'poor') ||
    has(ans.diet ?? [], 'Keto') ||
    has(ans.diet ?? [], 'Crash') ||
    has(ans.thyroid ?? [], 'Pre diabetes') ||
    has(ans.thyroid ?? [], 'Diabetes')
  );
}

function deriveHasDiabetesSignal(ans: PatientAnswers): boolean {
  return has(ans.thyroid ?? [], 'Pre diabetes') || has(ans.thyroid ?? [], 'Diabetes');
}

function deriveHasHypothyroid(ans: PatientAnswers): boolean {
  return has(ans.thyroid ?? [], 'Hypothyroidism') || has(ans.hormonal ?? [], 'Thyroid');
}

function derivePcosObese(ans: PatientAnswers): boolean {
  return (
    has(ans.hormonal ?? [], 'Obesity') ||
    has(ans.hormonal ?? [], 'PCOS / PCOD + Obesity') ||
    has(ans.lifestyle ?? [], 'Obesity') ||
    has(ans.lifestyle ?? [], 'Sedentary') ||
    has(ans.lifestyle ?? [], 'weight')
  );
}

function deriveHasPCOS(ans: PatientAnswers): boolean {
  return has(ans.hormonal ?? [], 'PCOS') || has(ans.hormonal ?? [], 'PCOD');
}

function deriveHasHBRHardWater(ans: PatientAnswers): boolean {
  return has(ans.cause ?? [], 'Hard water');
}

function deriveHasHBRTreatment(ans: PatientAnswers): boolean {
  return has(ans.treatment ?? [], 'Heat') || has(ans.treatment ?? [], 'Chemical');
}

function deriveOxidativeCount(ans: PatientAnswers): number {
  return (
    (has(ans.lifestyle ?? [], 'Smoking') || has(ans.lifestyle ?? [], 'Vaping') ? 1 : 0) +
    (has(ans.lifestyle ?? [], 'Alcohol') ? 1 : 0) +
    (has(ans.immunity ?? [], 'Asthma') ? 1 : 0)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SR_001 + SR_002 — TE GOLD suppression rules
// Source: dynamicTransitions DT_006, DT_007; hiddenRules HR_004
// ─────────────────────────────────────────────────────────────────────────────

function checkTeGoldEligibility(ans: PatientAnswers): KitEligibility | null {
  if (isTeGoldDurationAboveThreeMonths(ans.duration)) {
    return {
      kitId: 'HAIR FACT TE GOLD',
      status: 'BLOCKED',
      ruleId: 'SR_009',
      reason:
        'TE GOLD suppressed â€” hair fall has been present longer than 3 months. ' +
        'TE GOLD is reserved for shorter-duration telogen shedding across goals.',
    };
  }

  const isRegrowGoal = deriveIsRegrowGoal(ans);
  const hasNoVisibleFall = deriveHasNoVisibleFall(ans);

  if (isRegrowGoal) {
    return {
      kitId: 'HAIR FACT TE GOLD',
      status: 'BLOCKED',
      ruleId: 'SR_001',
      reason:
        'TE GOLD suppressed — patient goal is regrowth (shedding already stopped). ' +
        'TE GOLD stops active shedding; prescribing it for a patient without active shedding has no clinical purpose. ' +
        'PRO IMMUNE GOLD injected instead to stimulate anagen re-entry.',
    };
  }

  if (hasNoVisibleFall) {
    return {
      kitId: 'HAIR FACT TE GOLD',
      status: 'BLOCKED',
      ruleId: 'SR_002',
      reason:
        'TE GOLD suppressed — patient reports thinning only with no visible active fall (v39 rule). ' +
        'Miniaturisation pattern does not involve the active shedding cascade that TE GOLD targets.',
    };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SR_003 — Rule 1A TE GOLD suppression + protocol override
// Source: conditionScoringEngine.rule1AOverride
// ─────────────────────────────────────────────────────────────────────────────

function checkRule1AOverride(
  ans: PatientAnswers,
  scores: Record<string, number>
): { block: KitEligibility; override: TherapyEligibilityResult['protocolOverride'] } | null {
  const hasAGAFemale =
    (scores['AGA_FEMALE_123'] ?? 0) > 0 || (scores['AGA_FEMALE_45'] ?? 0) > 0;
  const hasPCOS =
    (scores['PCOS_ONLY'] ?? 0) > 0 || (scores['PCOS_OBESITY'] ?? 0) > 0;
  const hasWeightLoss = (scores['WEIGHT_LOSS'] ?? 0) > 0;

  if (!hasAGAFemale || !hasPCOS || !hasWeightLoss) return null;

  const isVeg = deriveIsVeg(ans);

  return {
    block: {
      kitId: 'HAIR FACT TE GOLD',
      status: 'BLOCKED',
      ruleId: 'SR_003',
      reason:
        'Rule 1A: AGA female + PCOS + rapid weight loss simultaneously scored. ' +
        'TE GOLD suppressed — ingredient overlap with RAPID WEIGHT LOSS SHIELD. ' +
        'Protocol override: Shield → F-PCOS -1 → PHENOTYPE INFLAMATION → FPHL.',
    },
    override: {
      kits: [
        'RAPID WEIGHT LOSS SHIELD',
        isVeg ? 'F-PCOS VEG -1' : 'F-PCOS -1',
        'PHENOTYPE INFLAMATION',
        'FPHL',
      ],
      ruleId: 'SR_003',
      reason: 'Rule 1A triple-condition override: AGA_FEMALE + PCOS + WEIGHT_LOSS.',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SR_004 — FPHL blocked for female under 30 with AGA_FEMALE_123
// Source: dynamicTransitions DT_012
// ─────────────────────────────────────────────────────────────────────────────

function checkFphlUnder30(ans: PatientAnswers, dominantKey?: string): KitEligibility | null {
  const isMale = deriveIsMale(ans);
  const age = parseInt(String(ans.age ?? '0'), 10);

  if (isMale || age >= 30) return null;
  if (dominantKey !== 'AGA_FEMALE_123') return null;

  return {
    kitId: 'FPHL',
    status: 'BLOCKED',
    ruleId: 'SR_004',
    reason:
      'FPHL kit blocked — female under 30 with AGA_FEMALE_123 dominant. ' +
      'Follicle not yet miniaturised enough for FPHL DHT-blockade compounds to be effective. ' +
      'Protocol overridden to HAIR FACT TE GOLD + PRO IMMUNE GOLD.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SR_005 — HBR signal gate (heat/chemical alone insufficient)
// Source: hiddenRules HR_007; getFunnelKits lines 4817-4830
// ─────────────────────────────────────────────────────────────────────────────

function checkHbrEligibility(ans: PatientAnswers): KitEligibility | null {
  const hasHBRHardWater = deriveHasHBRHardWater(ans);
  const hasHBRTreatment = deriveHasHBRTreatment(ans);

  if (hasHBRHardWater) return null; // eligible

  if (hasHBRTreatment) {
    return {
      kitId: 'HAIR FACT HAIR BREAKAGE REPAIR (HBR)',
      status: 'BLOCKED',
      ruleId: 'SR_005',
      reason:
        'HBR kit blocked — heat/chemical treatment reported but no hard-water shaft-damage signal. ' +
        'Heat/chemical treatment alone is insufficient for HBR prescription; ' +
        'hard water (cortex damage) is the corroborating signal required.',
    };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SR_007 — OXIDATIVE STRESS 2-signal threshold
// Source: hiddenRules HR_006; getFunnelKits lines 4771-4779
// ─────────────────────────────────────────────────────────────────────────────

function checkOxidativeStressEligibility(
  ans: PatientAnswers,
  currentPhases: KitId[]
): KitEligibility | null {
  const oxidativeCount = deriveOxidativeCount(ans);
  const hasPhenotype = currentPhases.includes('PHENOTYPE INFLAMATION');

  if (oxidativeCount >= 2) return null; // eligible

  if (oxidativeCount === 1 && !hasPhenotype) return null; // PHENOTYPE covers it — no block needed

  return {
    kitId: 'OXIDATIVE STRESS',
    status: 'BLOCKED',
    ruleId: 'SR_007',
    reason:
      'OXIDATIVE STRESS kit blocked as standalone phase — only 1 oxidative signal present (requires 2+: Smoking/Vaping + Alcohol, or + Asthma). ' +
      'Single signal is adequately covered by PHENOTYPE INFLAMATION (NF-kB/TNF-alpha suppression + glutathione restoration).',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SR_008 — PRO FACT GI GOLD strong signal gate
// Source: therapySignals[PRO FACT GI GOLD] trigger note
// ─────────────────────────────────────────────────────────────────────────────

function checkGiGoldEligibility(ans: PatientAnswers): KitEligibility | null {
  // Locked clinical rule (2026-06-14): GI GOLD is eligible only for structural
  // gut-axis signals (GERD / IBS / Acid reflux / Crohn). Constipation, Bloating,
  // and Indigestion are mild gut symptoms that do not warrant L-Glutamine
  // mucosal repair or digestive-enzyme supplementation.
  const gut = ans.gut ?? [];
  const hasStrongGutSignal =
    has(gut, 'GERD') ||
    has(gut, 'IBS') ||
    has(gut, 'Acid reflux') ||
    has(gut, 'Acid') ||
    has(gut, 'Crohn');

  if (hasStrongGutSignal) return null; // eligible

  const hasMildGutOnly =
    has(gut, 'Bloating') || has(gut, 'gas') ||
    has(gut, 'Indigestion') || has(gut, 'Constipation');

  if (hasMildGutOnly) {
    return {
      kitId: 'PRO FACT GI GOLD',
      status: 'BLOCKED',
      ruleId: 'SR_008',
      reason:
        'PRO FACT GI GOLD blocked — mild gut symptoms only (bloating / constipation / indigestion / gas) without structural gut-axis signal ' +
        '(GERD / IBS / Acid reflux / Crohn). Locked clinical rule: GI GOLD is reserved for confirmed gut-hair axis compromise requiring ' +
        'L-Glutamine mucosal repair, probiotic restoration, and digestive enzyme supplementation. Mild symptoms are covered by PRO IMMUNE / PHENOTYPE.',
    };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// KF_001 — F-PCOS -1 / PRO FACT META B PCOS forbidden combination
// Source: kitSignals[PCOS_INGREDIENT_OVERLAP_FORBIDDEN]
// ─────────────────────────────────────────────────────────────────────────────

function checkPcosIngredientOverlap(
  ans: PatientAnswers,
  phases: KitId[]
): ForbiddenCombination | null {
  const hasFPCOS1 = phases.some(k => k.includes('F-PCOS') && k.includes('-1') && !k.includes('META'));
  const hasMetaBPcos = phases.some(k => k.includes('META B PCOS'));

  if (!hasFPCOS1 || !hasMetaBPcos) return null;

  const hasDiabetes = deriveHasDiabetesSignal(ans);
  const isPcosObese = derivePcosObese(ans);

  return {
    kit_A: 'F-PCOS -1',
    kit_B: 'PRO FACT META B PCOS',
    ruleId: 'KF_001',
    reason:
      'F-PCOS -1 and PRO FACT META B PCOS CANNOT be prescribed together — overlapping ingredients: ' +
      'Inositol, D-Chiro-Inositol, Spearmint, NAC, Chromium, Zinc. Co-dosing creates over-supplementation risk.',
    resolution: isPcosObese || hasDiabetes
      ? 'Remove F-PCOS -1 — use PRO FACT META B PCOS only (covers AMPK + insulin + androgen suppression)'
      : 'Use F-PCOS -1 only for pure PCOS without obesity/diabetes (1 kit precision stack)',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// KF_002 — PRO FACT META B HYPOTHYROID + PRO FACT META B forbidden
// Source: kitSignals[META_B_HYPOTHYROID_FORBIDDEN_WITH_META_B]
// ─────────────────────────────────────────────────────────────────────────────

function checkMetaBHypothyroidOverlap(phases: KitId[]): ForbiddenCombination | null {
  const hasHypothyroid = phases.some(k => k.includes('META B HYPOTHYROID'));
  const hasMetaB = phases.some(k => k === 'PRO FACT META B');

  if (!hasHypothyroid || !hasMetaB) return null;

  return {
    kit_A: 'PRO FACT META B HYPOTHYROID',
    kit_B: 'PRO FACT META B',
    ruleId: 'KF_002',
    reason:
      'PRO FACT META B HYPOTHYROID and PRO FACT META B CANNOT be prescribed together — ' +
      'PRO FACT META B is a superset covering the dual metabolic+thyroid axis. Co-prescribing creates redundant dosing.',
    resolution:
      'Remove PRO FACT META B HYPOTHYROID — use PRO FACT META B (v34 override: covers AMPK/insulin + androgen + T3 metabolic support)',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// KF_003 — PRO FACT META B PCOS + PRO FACT META B HYPOTHYROID forbidden
// Source: kitSignals[META_B_PCOS_FORBIDDEN_WITH_META_B_HYPOTHYROID]
// ─────────────────────────────────────────────────────────────────────────────

function checkMetaBPcosHypothyroidOverlap(phases: KitId[]): ForbiddenCombination | null {
  const hasMetaBPcos = phases.some(k => k.includes('META B PCOS'));
  const hasHypothyroid = phases.some(k => k.includes('META B HYPOTHYROID'));

  if (!hasMetaBPcos || !hasHypothyroid) return null;

  return {
    kit_A: 'PRO FACT META B PCOS',
    kit_B: 'PRO FACT META B HYPOTHYROID',
    ruleId: 'KF_003',
    reason:
      'PRO FACT META B PCOS and PRO FACT META B HYPOTHYROID CANNOT be prescribed together — ' +
      'overlapping AMPK/insulin correction pathways. Creates ingredient over-load across androgen suppression and T3 correction axes.',
    resolution:
      'Remove both — replace with single PRO FACT META B at position 0 (v38 override: covers all three axes: androgen suppression, insulin correction, T3 metabolic support)',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// KF_004 — RAPID WEIGHT LOSS SHIELD + full-scope TE GOLD forbidden
// Source: kitSignals[TE_GOLD_REDUCED_SCOPE]; protocolSequencer WEIGHT_LOSS
// ─────────────────────────────────────────────────────────────────────────────

function checkShieldTeGoldOverlap(phases: KitId[]): KitEligibility | null {
  const hasShield = phases.some(k => k.includes('RAPID WEIGHT LOSS SHIELD'));
  const hasTeGold = phases.some(k => k.includes('HAIR FACT TE GOLD'));

  if (!hasShield || !hasTeGold) return null;

  return {
    kitId: 'HAIR FACT TE GOLD',
    status: 'REDUCED_SCOPE',
    ruleId: 'KF_004',
    reason:
      'RAPID WEIGHT LOSS SHIELD is in protocol — TE GOLD must be used in REDUCED SCOPE only. ' +
      'Full-scope TE GOLD FORBIDDEN due to ingredient overlap: Iron, B12/Folic Acid, Zinc, Biotin, Selenium, Amino Complex. ' +
      'In report: describe TE GOLD for ferritin repletion + residual stress-TE only. ' +
      'Do NOT attribute Iron/B12/Zinc/Biotin/Selenium/Amino explanation to TE GOLD — these are covered by Shield.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks a proposed kit protocol for all therapy blocking rules, suppression
 * rules, and forbidden kit combinations.
 *
 * Call AFTER validateContraindications() has confirmed no HARD_STOP.
 * Call BEFORE rendering the recommendation report.
 *
 * @param ans         Normalised patient answers
 * @param phases      Proposed kit array from the protocol sequencer + modifier injection
 * @param dominantKey The dominant protocol key from matchProtocol()
 * @param scores      Full condition scores from matchProtocol() (needed for Rule 1A)
 */
export function checkTherapyEligibility(
  ans: PatientAnswers,
  phases: KitId[],
  dominantKey?: string,
  scores: Record<string, number> = {}
): TherapyEligibilityResult {
  const eligibilityMap: Record<string, KitEligibility> = {};
  const blockedKits: KitId[] = [];
  const reducedScopeKits: KitId[] = [];
  const forbiddenCombinations: ForbiddenCombination[] = [];
  let protocolOverride: TherapyEligibilityResult['protocolOverride'] = undefined;

  // ── Kit suppression rules ──────────────────────────────────────────────────

  const teGoldBlock = checkTeGoldEligibility(ans);
  if (teGoldBlock) {
    eligibilityMap['HAIR FACT TE GOLD'] = teGoldBlock;
    eligibilityMap['HAIR FACT TE GOLD VEG'] = { ...teGoldBlock, kitId: 'HAIR FACT TE GOLD VEG' };
    blockedKits.push('HAIR FACT TE GOLD', 'HAIR FACT TE GOLD VEG');
  }

  const rule1A = checkRule1AOverride(ans, scores);
  if (rule1A) {
    eligibilityMap['HAIR FACT TE GOLD'] = rule1A.block;
    blockedKits.push('HAIR FACT TE GOLD');
    protocolOverride = rule1A.override;
  }

  const fphlBlock = checkFphlUnder30(ans, dominantKey);
  if (fphlBlock) {
    eligibilityMap['FPHL'] = fphlBlock;
    blockedKits.push('FPHL');
    if (!protocolOverride) {
      const isVeg = deriveIsVeg(ans);
      protocolOverride = {
        kits: [isVeg ? 'HAIR FACT TE GOLD VEG' : 'HAIR FACT TE GOLD', 'PRO IMMUNE GOLD'],
        ruleId: 'SR_004',
        reason: 'Female under 30 with AGA_FEMALE_123 — protocol overridden to TE GOLD + PRO IMMUNE GOLD (no FPHL).',
      };
    }
  }

  const hbrBlock = checkHbrEligibility(ans);
  if (hbrBlock) {
    eligibilityMap['HAIR FACT HAIR BREAKAGE REPAIR (HBR)'] = hbrBlock;
    blockedKits.push('HAIR FACT HAIR BREAKAGE REPAIR (HBR)');
  }

  const oxidativeBlock = checkOxidativeStressEligibility(ans, phases);
  if (oxidativeBlock) {
    eligibilityMap['OXIDATIVE STRESS'] = oxidativeBlock;
    blockedKits.push('OXIDATIVE STRESS');
  }

  const giGoldBlock = checkGiGoldEligibility(ans);
  if (giGoldBlock) {
    eligibilityMap['PRO FACT GI GOLD'] = giGoldBlock;
    blockedKits.push('PRO FACT GI GOLD');
  }

  // ── Reduced scope ──────────────────────────────────────────────────────────

  const shieldOverlap = checkShieldTeGoldOverlap(phases);
  if (shieldOverlap) {
    eligibilityMap['HAIR FACT TE GOLD'] = shieldOverlap;
    reducedScopeKits.push('HAIR FACT TE GOLD');
  }

  // ── Forbidden kit combinations ─────────────────────────────────────────────

  const pcosOverlap = checkPcosIngredientOverlap(ans, phases);
  if (pcosOverlap) forbiddenCombinations.push(pcosOverlap);

  const metaBHypothyroid = checkMetaBHypothyroidOverlap(phases);
  if (metaBHypothyroid) forbiddenCombinations.push(metaBHypothyroid);

  const metaBPcosHypothyroid = checkMetaBPcosHypothyroidOverlap(phases);
  if (metaBPcosHypothyroid) forbiddenCombinations.push(metaBPcosHypothyroid);

  return {
    blockedKits: [...new Set(blockedKits)],
    reducedScopeKits: [...new Set(reducedScopeKits)],
    forbiddenCombinations,
    eligibilityMap,
    protocolOverride,
  };
}

/**
 * Applies blocking rules to a protocol array and returns the filtered result.
 * Convenience wrapper for callers that just need the cleaned-up kit list.
 */
export function applyTherapyBlocks(
  ans: PatientAnswers,
  phases: KitId[],
  dominantKey?: string,
  scores: Record<string, number> = {}
): KitId[] {
  const result = checkTherapyEligibility(ans, phases, dominantKey, scores);

  if (result.protocolOverride) return result.protocolOverride.kits;

  return phases.filter(k => !result.blockedKits.includes(k));
}

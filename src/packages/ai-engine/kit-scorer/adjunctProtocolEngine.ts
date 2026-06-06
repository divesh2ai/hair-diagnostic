/**
 * ADJUNCT PROTOCOL ENGINE
 * ─────────────────────────────────────────────────────────────────────────────
 * Deterministic, rule-based enrichment layer that sits AFTER core kit scoring.
 *
 * Inputs:  ClinicalProfile.scalpStates  (derived by deriveSignals.ts)
 *          PatientAnswers.treatment[]   (treatment history from questionnaire)
 *
 * Outputs: AdjunctProtocol — structured multi-layer adjunct product plan:
 *            · scalpCorrection       — medicated shampoos, sebum regulation
 *            · follicularSupport     — anti-inflammatory scalp topical support
 *            · barrierRepair         — shaft + scalp barrier for treated hair
 *            · lifestyleInterventions
 *            · validationWarnings    — clinical completeness checks
 *
 * RULES ARE EXPLICIT AND TRACEABLE.
 * No random selection. No narrative embedding. No hardcoded PDF patches.
 * Each injected product has a rule code, indication, rationale, and usage.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { ScalpState, PatientAnswers } from '../../types';
import type { AdjunctItem, AdjunctProtocol } from './types';

// ─── Product catalogue constants ─────────────────────────────────────────────
// Names must match canonical entries in products.json exactly.

const PRODUCTS = {
  BIOWASH:          'F-Biwash+ Anti-Dandruff Shampoo',
  TRICHOSILK_WITH:  'F-Trichosilk D&F (With Treatment)',
  TRICHOSILK_WO:    'F-Trichosilk D&F (Without Treatment)',
} as const;

// ─── Rule helpers ─────────────────────────────────────────────────────────────

function hasTreatmentHistory(ans: PatientAnswers): boolean {
  const tx = ans.treatment ?? [];
  return tx.some((t: string) =>
    /heat|chemical|bleach|colour|color|perm|straighten|keratin|rebond/i.test(t)
  );
}

// ─── Rule definitions ─────────────────────────────────────────────────────────

/**
 * SC-1 · OILY / DANDRUFF SCALP
 * Trigger: OILY_SCALP or DANDRUFF
 * Product: F-Biwash+ Anti-Dandruff Shampoo
 */
function ruleScBiowashOilyDandruff(
  scalpStates: readonly ScalpState[]
): AdjunctItem | null {
  const triggered =
    scalpStates.includes('OILY_SCALP') ||
    scalpStates.includes('DANDRUFF');

  if (!triggered) return null;

  const conditions: string[] = [];
  if (scalpStates.includes('OILY_SCALP'))  conditions.push('oily scalp');
  if (scalpStates.includes('DANDRUFF'))    conditions.push('dandruff');

  return {
    productName: PRODUCTS.BIOWASH,
    category: 'SCALP_CORRECTION',
    indication: `${conditions.join(' and ')} detected — scalp microenvironment correction required.`,
    clinicalRationale:
      'Excess sebum oxidises at the follicular opening, creating a pro-inflammatory microenvironment ' +
      'that accelerates perifollicular fibrosis. Malassezia colonisation in dandruff further elevates ' +
      'IL-1 and TNF-alpha, directly suppressing the anagen phase. The oral supplement protocol cannot ' +
      'reach follicles efficiently until the scalp environment is corrected. ' +
      'F-Biwash+ (antimicrobial + antifungal complex) clears Malassezia load, reduces sebum oxidation, ' +
      'and restores follicular opening hygiene as a prerequisite for nutrient delivery.',
    usageInstruction:
      'Use 2–3 times per week on wash days. Apply to wet scalp, lather gently for 3–5 minutes ' +
      'to allow active contact, then rinse thoroughly. Doctor to confirm frequency based on severity.',
    appliedRule: `SC_BIOWASH_OILY_DANDRUFF: ${conditions.join('/')} confirmed — F-Biwash+ injected for scalp microenvironment correction.`,
  };
}

/**
 * SC-2 · INFLAMED SCALP / PERIFOLLICULAR INFLAMMATION
 * Trigger: INFLAMED_SCALP or PSORIATIC_SCALP (if BIOWASH not already added)
 * Product: F-Biwash+ Anti-Dandruff Shampoo (with separate clinical rationale)
 */
function ruleScBiowashInflammation(
  scalpStates: readonly ScalpState[],
  biowashAlreadyAdded: boolean
): AdjunctItem | null {
  const triggered =
    scalpStates.includes('INFLAMED_SCALP') ||
    scalpStates.includes('PSORIATIC_SCALP');

  if (!triggered || biowashAlreadyAdded) return null;

  const conditions: string[] = [];
  if (scalpStates.includes('INFLAMED_SCALP'))  conditions.push('scalp inflammation');
  if (scalpStates.includes('PSORIATIC_SCALP')) conditions.push('psoriatic scalp');

  return {
    productName: PRODUCTS.BIOWASH,
    category: 'SCALP_CORRECTION',
    indication: `${conditions.join(' and ')} detected — anti-inflammatory scalp correction required.`,
    clinicalRationale:
      'Perifollicular and scalp inflammation confirmed. Inflammatory cytokine load ' +
      '(IL-1α, TNF-α, PGD2) at the follicle directly suppresses anagen entry and accelerates ' +
      'miniaturisation — these cytokines are not addressed by the oral supplement protocol alone. ' +
      'F-Biwash+ provides topical anti-inflammatory scalp correction as a complementary layer, ' +
      'reducing scalp immune activation so the oral protocol can restore follicle cycling effectively.',
    usageInstruction:
      'Use 2–3 times per week. Apply to wet scalp, lather gently for 3–5 minutes, rinse thoroughly. ' +
      'Avoid vigorous rubbing — gentle circular massage only on inflamed areas.',
    appliedRule: `SC_BIOWASH_INFLAM: ${conditions.join('/')} confirmed — F-Biwash+ injected for anti-inflammatory scalp correction.`,
  };
}

/**
 * FS-1 · TREATMENT HISTORY — BARRIER REPAIR (WITH TREATMENT)
 * Trigger: treatment[] includes heat/chemical/bleach/colour/perm/straighten/keratin
 * Product: F-Trichosilk D&F (With Treatment)
 */
function ruleFsBarrierRepairWithTreatment(
  ans: PatientAnswers
): AdjunctItem | null {
  if (!hasTreatmentHistory(ans)) return null;

  const tx = (ans.treatment ?? []) as string[];
  const identified = tx.filter((t: string) =>
    /heat|chemical|bleach|colour|color|perm|straighten|keratin|rebond/i.test(t)
  );

  return {
    productName: PRODUCTS.TRICHOSILK_WITH,
    category: 'BARRIER_REPAIR',
    indication: `Treatment history detected (${identified.join(', ')}) — scalp barrier and shaft repair required.`,
    clinicalRationale:
      'Chemical and heat treatment history disrupts the hair shaft cuticle, depletes natural lipid ' +
      'coating, and increases transepidermal water loss (TEWL) at the scalp. Compromised shaft ' +
      'structural integrity leads to breakage before new growth can reach visible length, making ' +
      'regrowth appear absent even when follicle activity has been restored by the oral protocol. ' +
      'F-Trichosilk D&F (With Treatment) provides a heat-protectant polymer shield, moisture ' +
      'retention complex, and fibre-repair actives — preventing breakage and protecting the emerging ' +
      'hair shaft during the recovery phase.',
    usageInstruction:
      'Apply a small amount to damp or dry hair from mid-length to ends. Do not rinse. ' +
      'Use daily as a heat protectant before styling or as a finishing serum after wash.',
    appliedRule: `FS_BARRIER_REPAIR_WITH_TX: Treatment history (${identified.join(', ')}) confirmed — F-Trichosilk D&F (With Treatment) injected for shaft barrier restoration.`,
  };
}

/**
 * FS-2 · DRY / SENSITIVE SCALP — MOISTURE SUPPORT (WITHOUT TREATMENT)
 * Trigger: DRY_SCALP or SENSITIVE_SCALP, AND no treatment history
 * Product: F-Trichosilk D&F (Without Treatment)
 */
function ruleFsMoistureSupportNoTreatment(
  scalpStates: readonly ScalpState[],
  ans: PatientAnswers
): AdjunctItem | null {
  const triggered =
    scalpStates.includes('DRY_SCALP') ||
    scalpStates.includes('SENSITIVE_SCALP');

  if (!triggered || hasTreatmentHistory(ans)) return null;

  const conditions: string[] = [];
  if (scalpStates.includes('DRY_SCALP'))       conditions.push('dry scalp');
  if (scalpStates.includes('SENSITIVE_SCALP')) conditions.push('sensitive scalp');

  return {
    productName: PRODUCTS.TRICHOSILK_WO,
    category: 'FOLLICULAR_SUPPORT',
    indication: `${conditions.join(' and ')} detected — moisture and scalp barrier support required.`,
    clinicalRationale:
      'Dry scalp increases transepidermal water loss (TEWL) and scalp barrier fragility, creating ' +
      'friction damage on emerging new hair. Without moisture retention support, fragile new growth ' +
      'breaks at the surface before reaching visible length. ' +
      'F-Trichosilk D&F (Without Treatment) is a lightweight, non-greasy leave-in serum that restores ' +
      'moisture balance, reduces frizz and breakage, and supports new growth retention during the ' +
      'recovery phase.',
    usageInstruction:
      'Apply a small amount to damp or dry hair from mid-length to ends. Do not rinse. ' +
      'Use daily or as recommended by the doctor.',
    appliedRule: `FS_MOISTURE_NO_TX: ${conditions.join('/')} confirmed — F-Trichosilk D&F (Without Treatment) injected for scalp moisture barrier support.`,
  };
}

// ─── Clinical validation ──────────────────────────────────────────────────────

function validateProtocolCompleteness(
  scalpStates: readonly ScalpState[],
  output: Pick<AdjunctProtocol, 'scalpCorrection' | 'follicularSupport' | 'barrierRepair'>
): string[] {
  const warnings: string[] = [];

  const hasScalpTherapy =
    output.scalpCorrection.length > 0 ||
    output.follicularSupport.length > 0;

  const hasDandruffOrOily =
    scalpStates.includes('DANDRUFF') || scalpStates.includes('OILY_SCALP');

  const hasInflammation =
    scalpStates.includes('INFLAMED_SCALP') || scalpStates.includes('PSORIATIC_SCALP');

  if (hasDandruffOrOily && !hasScalpTherapy) {
    warnings.push(
      'VALIDATION_WARNING: Dandruff/oily scalp detected but no scalp correction product was injected. ' +
      'Follicle environment remains compromised — review SC_BIOWASH rule.'
    );
  }

  if (hasInflammation && !hasScalpTherapy) {
    warnings.push(
      'VALIDATION_WARNING: Perifollicular inflammation detected but no anti-inflammatory scalp ' +
      'adjunct was injected. Inflammatory cytokine load unaddressed — review SC_BIOWASH_INFLAM rule.'
    );
  }

  return warnings;
}

// ─── Main engine entry point ──────────────────────────────────────────────────

/**
 * buildAdjunctProtocol
 *
 * Called by scoreKits() after core kits are scored.
 * Produces a multi-layer AdjunctProtocol from scalp signals and treatment history.
 * All rules are deterministic and observable via appliedRule fields.
 */
export function buildAdjunctProtocol(
  scalpStates: readonly ScalpState[],
  ans: PatientAnswers
): AdjunctProtocol {

  // ── SCALP CORRECTION LAYER ────────────────────────────────────────────────
  const scalpCorrection: AdjunctItem[] = [];

  const biowashOilyDandruff = ruleScBiowashOilyDandruff(scalpStates);
  if (biowashOilyDandruff) scalpCorrection.push(biowashOilyDandruff);

  const biowashAlreadyAdded = scalpCorrection.some(
    (i) => i.productName === PRODUCTS.BIOWASH
  );
  const biowashInflam = ruleScBiowashInflammation(scalpStates, biowashAlreadyAdded);
  if (biowashInflam) scalpCorrection.push(biowashInflam);

  // ── FOLLICULAR SUPPORT LAYER ──────────────────────────────────────────────
  const follicularSupport: AdjunctItem[] = [];

  const moistureSupport = ruleFsMoistureSupportNoTreatment(scalpStates, ans);
  if (moistureSupport) follicularSupport.push(moistureSupport);

  // ── BARRIER REPAIR LAYER ──────────────────────────────────────────────────
  const barrierRepair: AdjunctItem[] = [];

  const barrierItem = ruleFsBarrierRepairWithTreatment(ans);
  if (barrierItem) barrierRepair.push(barrierItem);

  // ── CLINICAL VALIDATION ───────────────────────────────────────────────────
  const validationWarnings = validateProtocolCompleteness(scalpStates, {
    scalpCorrection,
    follicularSupport,
    barrierRepair,
  });

  if (validationWarnings.length > 0) {
    validationWarnings.forEach((w) => console.warn(`[AdjunctEngine] ${w}`));
  }

  return {
    scalpCorrection,
    follicularSupport,
    barrierRepair,
    lifestyleInterventions: [],  // Reserved for future lifestyle enrichment rules
    validationWarnings,
  };
}

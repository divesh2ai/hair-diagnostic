import type { PatientAnswers, KitId, DiagnosisKey } from '../../../types';
import type { KitScorerContext } from '../types';
import { signals } from '../../clinical-engine/signals';
import { detectMetabolicSignal } from './metabolicModifierRule';
import { kitCapCalculator } from '../ranking/kitCapCalculator';

// ─────────────────────────────────────────────────────────────────────────────
// Signal-gated co-condition injection pool
//
// Each kit added ONLY when the patient's actual answers contain the trigger signal.
// Order in pool determines priority when the kit cap is reached.
// Skipped for PCOS (has dedicated pcosStackRule) and PREGNANCY.
// ─────────────────────────────────────────────────────────────────────────────

const SKIP_GENERIC_INJECTION = new Set<DiagnosisKey>(['PREGNANCY', 'EARLY_GREY']);

export function applySignalGatedInjectionRule(
  ctx: KitScorerContext,
  ans: PatientAnswers,
  primaryDiagnosis: DiagnosisKey,
  metaBAlreadyCovered: boolean
): KitScorerContext {
  if (SKIP_GENERIC_INJECTION.has(primaryDiagnosis)) return ctx;

  const s = signals(ans);
  const { isVeg, isRegrowGoal, age } = ctx.flags;
  let phases = [...ctx.phases];
  const pool: KitId[] = [];
  const rules: string[] = [];

  // 1. INFLAMMATION — scalp signals + smoking/vaping always trigger PHENOTYPE
  if (!phases.includes('PHENOTYPE INFLAMATION')) {
    const realInflamSignal =
      s.scalp('Redness') || s.scalp('irritation') || s.scalp('Boils') ||
      s.scalp('pimples') || s.scalp('Burning') || s.scalp('Flaking') ||
      s.scalp('Dandruff') || s.immunity('Allergies') || s.immunity('Skin rash') ||
      s.immunity('Asthma') || s.immunity('Alopecia Areata') ||
      s.lifestyle('Smoking') || s.lifestyle('Vaping') || s.lifestyle('Alcohol');
    if (realInflamSignal) pool.push('PHENOTYPE INFLAMATION');
  }

  // 1b. OXIDATIVE STRESS standalone — needs 2+ oxidative signals
  // PHENOTYPE covers overlapping NAC/Resveratrol/Quercetin pathway; this adds
  // Astaxanthin/CoQ10/ALA/Glutathione/Selenium which are distinct
  if (!phases.includes('OXIDATIVE STRESS') && !phases.includes('PHENOTYPE INFLAMATION')) {
    const oxidativeCount =
      (s.lifestyle('Smoking') || s.lifestyle('Vaping') ? 1 : 0) +
      (s.lifestyle('Alcohol') ? 1 : 0) +
      (s.immunity('Asthma') ? 1 : 0);
    if (oxidativeCount >= 2) pool.push('OXIDATIVE STRESS');
  }

  // 2. IRON UP GOLD — confirmed deficiency only
  if (!phases.includes('IRON UP GOLD') && (s.deficiency('Iron') || s.deficiency('Anaemia'))) {
    pool.push('IRON UP GOLD');
  }

  // 3. PRO IMMUNE GOLD — specific clinical triggers only (NOT a default)
  if (!phases.some((k) => k.includes('PRO IMMUNE'))) {
    const realImmuneSignal =
      isRegrowGoal ||
      s.deficiency('Iron') || s.deficiency('Anaemia') ||
      s.cause('Recent Illness') || s.cause('Surgery') ||
      s.cause('Medication') || s.cause('Nutritional') ||
      s.immunity('Frequent') || s.immunity('Allergies') ||
      (s.cause('Genetics') && age >= 30) ||
      s.gut('GERD') || s.gut('Bloating') || s.gut('IBS') || s.gut('Acid');
    if (realImmuneSignal) {
      pool.push(isVeg ? 'PRO IMMUNE VEG' : 'PRO IMMUNE GOLD');
    }
  }

  // 4. METABOLIC — for protocols not yet covered by metabolicModifierRule
  if (!metaBAlreadyCovered && !phases.includes('PRO FACT META B') && detectMetabolicSignal(ans)) {
    pool.push('PRO FACT META B');
  }

  // 5. GUT — strong gut signals only
  // Mild bloating alone → PRO IMMUNE (already injected above) is sufficient.
  if (!phases.includes('PRO FACT GI GOLD')) {
    const realGutSignal =
      s.gut('IBS') || s.gut('GERD') || s.gut('Acid') || s.gut('Crohn') || s.gut('Constipation');
    if (realGutSignal) pool.push('PRO FACT GI GOLD');
  }

  // 5b. HBR — confirmed shaft damage only (broken/short strands OR hard water)
  // Heat/chemical treatment alone is insufficient — patient must also report broken strands
  if (!phases.includes('HAIR FACT HAIR BREAKAGE REPAIR(HBR)') && phases.length < 5) {
    const hardWater        = s.cause('Hard water') || s.cause('hard');
    const confirmedBreakage = s.hairtype('Broken') || s.hairtype('short');
    const heatChem         =
      s.treatment('Heat') || s.treatment('Chemical') || s.treatment('Straighten') ||
      s.treatment('Bleach') || s.treatment('Colour') || s.treatment('Perm');
    if (hardWater || confirmedBreakage || (heatChem && confirmedBreakage)) {
      pool.push('HAIR FACT HAIR BREAKAGE REPAIR(HBR)');
    }
  }

  // 6. PATTERN LOSS (FPHL/MPHL) — genetics/thinning/widening parting
  if (!phases.some((k) => k.includes('FPHL') || k.includes('MPHL'))) {
    const hasGeneticCause = s.cause('Genetics') || s.cause('Family history') || s.cause('family');
    const realPatternSignal =
      s.hairtype('Thinning') || s.hairtype('widening') || s.hairtype('parting') ||
      (hasGeneticCause && age >= 30);
    if (realPatternSignal) {
      const { isMale, isGrade45 } = ctx.flags;
      const patternKit: KitId = isMale
        ? (isGrade45 ? 'MPHL PLUS' : 'MPHL')
        : (isGrade45 ? 'FPHL PLUS' : 'FPHL');
      pool.unshift(patternKit); // pattern loss has highest injection priority
    }
  }

  if (pool.length === 0) return ctx;

  const cap = kitCapCalculator(ctx, ans);
  for (const kit of pool) {
    if (phases.length >= cap) break;
    if (!phases.includes(kit)) {
      phases.push(kit);
      rules.push(`SIGNAL_GATED_INJECTION: ${kit} added — signal confirmed.`);
    }
  }

  phases = [...new Set(phases)];

  if (rules.length === 0) return ctx;
  return { ...ctx, phases, appliedRules: [...ctx.appliedRules, ...rules] };
}

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
  _metaBAlreadyCovered?: boolean
): KitScorerContext {
  if (SKIP_GENERIC_INJECTION.has(primaryDiagnosis)) return ctx;

  const s = signals(ans);
  const { isVeg, isRegrowGoal, age } = ctx.flags;
  let phases = [...ctx.phases];
  const pool: KitId[] = [];
  const rules: string[] = [];

  // Recompute META B coverage from CURRENT phases (not a caller-captured flag).
  // Earlier rules (e.g. AGA_FEMALE_UNDER30) may have wiped the protocol after
  // the caller sampled the flag, leaving META B uncovered despite the flag.
  // Substring match catches every variant: META B / META B PCOS / META B
  // HYPOTHYROID / META B MENOPAUSE / META B POSTMENOPAUSE.
  const metaBVariantCovered = phases.some((k) => k.includes('PRO FACT META B'));

  // 1. INFLAMMATION — scalp signals + smoking/vaping always trigger PHENOTYPE.
  // Oily scalp included: sebum hyperproduction drives seborrhoeic micro-
  // inflammation that gates downstream pattern/metabolic kit response.
  if (!phases.includes('PHENOTYPE INFLAMATION')) {
    const realInflamSignal =
      s.scalp('Redness') || s.scalp('irritation') || s.scalp('Boils') ||
      s.scalp('pimples') || s.scalp('Burning') || s.scalp('Flaking') ||
      s.scalp('Dandruff') || s.scalp('Oily') ||
      s.immunity('Allergies') || s.immunity('Skin rash') ||
      s.immunity('Asthma') || s.immunity('Alopecia Areata') ||
      s.lifestyle('Smoking') || s.lifestyle('Vaping') || s.lifestyle('Alcohol');
    if (realInflamSignal) pool.push('PHENOTYPE INFLAMATION');
  }

  // 1b. OXIDATIVE STRESS standalone — needs 2+ oxidative signals
  // PHENOTYPE covers the overlapping NAC/Resveratrol/Quercetin pathway. To
  // avoid layering both kits, suppress OXIDATIVE STRESS whenever PHENOTYPE
  // INFLAMATION is already in `phases` OR has just been queued into `pool`.
  // The OXIDATIVE primary diagnosis is unaffected — its PROTOCOL_SEQUENCER
  // entry already pairs both kits intentionally.
  const phenotypeAlreadyPresent =
    phases.includes('PHENOTYPE INFLAMATION') || pool.includes('PHENOTYPE INFLAMATION');
  if (!phases.includes('OXIDATIVE STRESS') && !phenotypeAlreadyPresent) {
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
      s.gut('GERD') || s.gut('IBS') || s.gut('Acid') || s.gut('Crohn');
    if (realImmuneSignal) {
      pool.push(isVeg ? 'PRO IMMUNE VEG' : 'PRO IMMUNE GOLD');
    }
  }

  // 4. METABOLIC — for protocols not yet covered by metabolicModifierRule.
  //    PRO FACT META B is also non-negotiable for regrow-goal patients with
  //    pattern signals (thinning / widening parting / crown / family history
  //    after 30) — metabolic terrain sustains follicle dormancy and must be
  //    corrected even when no overt obesity / sedentary signal is reported.
  const hasPatternRegrowthSignal =
    isRegrowGoal &&
    (s.hairtype('Thinning') ||
      s.hairtype('widening') ||
      s.hairtype('parting') ||
      s.hairtype('crown') ||
      ((s.cause('Genetics') || s.cause('Family history') || s.cause('family')) && age >= 30));
  if (
    !metaBVariantCovered &&
    (detectMetabolicSignal(ans) || hasPatternRegrowthSignal)
  ) {
    pool.push('PRO FACT META B');
  }

  // 5. GUT — locked clinical rule: GI GOLD only for GERD / IBS / Acid reflux / Crohn.
  // NEVER triggered by Bloating, Constipation, or Indigestion — they are mild gut
  // symptoms covered by PRO IMMUNE / PHENOTYPE without needing L-Glutamine + enzyme repair.
  if (!phases.includes('PRO FACT GI GOLD')) {
    const realGutSignal =
      s.gut('GERD') || s.gut('IBS') || s.gut('Acid') || s.gut('Crohn');
    if (realGutSignal) pool.push('PRO FACT GI GOLD');
  }

  // 5b. HBR — STANDALONE-ONLY (locked clinical rule 2026-06-14)
  // HBR may only be prescribed when Hard water OR Heat styling is the patient's
  // ONLY signal — no hormonal, no thyroid, no PCOS, no gut, no nutritional, no
  // stress, no inflammation, no pattern, no genetics. Trigger is the signal
  // itself, NOT the primary diagnosis — diagnosis ranker may have routed the
  // patient elsewhere even when their picture is shaft-only.
  if (!phases.includes('HAIR FACT HAIR BREAKAGE REPAIR(HBR)')) {
    const hardWater         = s.cause('Hard water') || s.cause('hard');
    const heatChemical      =
      s.treatment('Heat') || s.treatment('Chemical') || s.treatment('Straighten') ||
      s.treatment('Bleach') || s.treatment('Colour') || s.treatment('Perm') ||
      s.treatment('Keratin');

    const hasInflamSignal =
      s.scalp('Redness') || s.scalp('irritation') || s.scalp('Boils') ||
      s.scalp('pimples') || s.scalp('Burning') || s.scalp('Flaking') ||
      s.scalp('Dandruff') || s.scalp('Dry') ||
      s.immunity('Allergies') || s.immunity('Skin rash') ||
      s.immunity('Asthma') || s.immunity('Alopecia Areata') ||
      s.lifestyle('Smoking') || s.lifestyle('Vaping') || s.lifestyle('Alcohol');
    const hasPatternSignal =
      s.hairtype('Thinning') || s.hairtype('widening') || s.hairtype('parting') ||
      s.hairtype('crown') || s.cause('Genetics') || s.cause('Family history');
    const hasOtherCause =
      s.cause('Stress') || s.cause('Anxiety') || s.cause('Depression') ||
      s.cause('Nutritional') || s.cause('Medication') ||
      s.cause('Illness') || s.cause('Surgery') ||
      s.cause('GLP') || s.cause('Crash');
    const hasHormonalSignal =
      (ans.hormonal ?? []).some((v) => !!v && !/none|no /i.test(v)) ||
      (Array.isArray(ans.thyroid)
        ? ans.thyroid.some((v) => !!v && !/none|no /i.test(v))
        : !!ans.thyroid && !/none|no /i.test(String(ans.thyroid)));
    const hasGutSignal =
      s.gut('IBS') || s.gut('GERD') || s.gut('Acid') || s.gut('Crohn') ||
      s.gut('Constipation') || s.gut('Bloating') || s.gut('Indigestion');
    const hasDeficiencySignal =
      s.deficiency('Iron') || s.deficiency('Anaemia') ||
      s.deficiency('B12') || s.deficiency('Vitamin B12') ||
      s.deficiency('Vitamin D') || s.deficiency('D');

    const triggerSignal = hardWater || heatChemical;
    const anyOtherCondition =
      hasInflamSignal || hasPatternSignal || hasOtherCause ||
      hasHormonalSignal || hasGutSignal || hasDeficiencySignal;

    // Rule 7 (locked 2026-06-29): PHENOTYPE INFLAMATION supersedes HBR.
    // Phenotype's mechanism fully covers shaft-damage biology — co-prescribing
    // HBR adds no clinical value and increases pill burden unnecessarily.
    const phenotypeInProtocol =
      phases.includes('PHENOTYPE INFLAMATION') || pool.includes('PHENOTYPE INFLAMATION');

    if (triggerSignal && !anyOtherCondition && !phenotypeInProtocol) {
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

  // 7. ENDOMETRIOSIS — always inject FH WELL 3 when the hormonal signal is present.
  if (!phases.includes('FH WELL 3') && s.hormonal('Endometriosis')) {
    pool.unshift('FH WELL 3');
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

  // Final guard: outside the OXIDATIVE primary diagnosis, PHENOTYPE INFLAMATION
  // and OXIDATIVE STRESS must not coexist — PHENOTYPE already covers the
  // shared anti-inflammatory / antioxidant pathway.
  if (
    primaryDiagnosis !== 'OXIDATIVE' &&
    phases.includes('PHENOTYPE INFLAMATION') &&
    phases.includes('OXIDATIVE STRESS')
  ) {
    phases = phases.filter((k) => k !== 'OXIDATIVE STRESS');
    rules.push(
      'OXIDATIVE_PHENOTYPE_DEDUPE: OXIDATIVE STRESS removed — PHENOTYPE INFLAMATION already covers the shared NAC/Resveratrol/Quercetin antioxidant pathway.',
    );
  }

  if (rules.length === 0) return ctx;
  return { ...ctx, phases, appliedRules: [...ctx.appliedRules, ...rules] };
}

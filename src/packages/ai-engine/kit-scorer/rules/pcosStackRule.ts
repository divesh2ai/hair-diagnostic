import type { PatientAnswers, KitId, DiagnosisKey } from '../../../types';
import type { KitScorerContext } from '../types';
import { signals } from '../../clinical-engine/signals';
import { detectMetabolicSignal } from './metabolicModifierRule';

// ─────────────────────────────────────────────────────────────────────────────
// PCOS Smart Clinical Stack
//
// PCOS_ONLY  → F-PCOS-1 primary; add FPHL/PHENOTYPE/PRO IMMUNE only on confirmed signals.
// PCOS_OBESITY → PRO FACT META B PCOS primary (covers insulin + androgen); no F-PCOS-1 duplication.
// v38: PCOS_OBESITY + Hypothyroid → single PRO FACT META B replaces both variants.
//
// Each co-condition kit added ONLY when patient answers contain real clinical signals.
// ─────────────────────────────────────────────────────────────────────────────

export function applyPcosStackRule(
  ctx: KitScorerContext,
  ans: PatientAnswers,
  primaryDiagnosis: DiagnosisKey
): KitScorerContext {
  if (primaryDiagnosis !== 'PCOS_ONLY' && primaryDiagnosis !== 'PCOS_OBESITY') return ctx;

  const s = signals(ans);
  const { isVeg, isMale: _isMale, isGrade45 } = ctx.flags;
  const rules: string[] = [];
  let phases = [...ctx.phases];
  const duration = ans.duration ?? '';

  // ── Signal detection ──────────────────────────────────────────────────────

  // Pattern-loss: must be STRONG signal — not just age or mild thinning
  const hasFPHL =
    s.hairtype('Thinning') || s.hairtype('widening') || s.hairtype('parting') ||
    (s.cause('Genetics') && duration.includes('More than')) ||
    (s.cause('Family history') && (ans.grade?.includes('Grade') === true)) ||
    isGrade45 ||
    (ans.grade?.includes('Grade') === true && duration.includes('6–12'));

  // Scalp inflammation: actual clinical signals only (Oily alone insufficient — needs Itching)
  const hasScalpInflam =
    s.scalp('Redness') || s.scalp('irritation') || s.scalp('Boils') ||
    s.scalp('pimples') || s.scalp('Burning') || s.scalp('Dandruff') ||
    (s.scalp('Oily') && s.scalp('Itching'));

  // Systemic immune compromise: real signals, NOT assumed from insulin resistance
  const hasImmune =
    s.immunity('Allergies') || s.immunity('Asthma') ||
    s.immunity('Skin rash') || s.immunity('Frequent') ||
    s.cause('Recent Illness') || s.cause('Surgery') ||
    s.deficiency('Iron') || s.deficiency('Anaemia');

  const hasMetabolicSignal = detectMetabolicSignal(ans);

  // ── Build stack in clinical priority order ────────────────────────────────

  // PCOS_ONLY + metabolic signal → add META B
  if (
    primaryDiagnosis === 'PCOS_ONLY' && hasMetabolicSignal &&
    !phases.includes('PRO FACT META B') && !phases.includes('PRO FACT META B PCOS')
  ) {
    phases.push('PRO FACT META B');
    rules.push('PCOS_META_B_INJECTION: PCOS_ONLY + metabolic signal → PRO FACT META B added.');
  }

  // Iron deficiency
  if ((s.deficiency('Iron') || s.deficiency('Anaemia')) && !phases.includes('IRON UP GOLD')) {
    phases.push('IRON UP GOLD');
    rules.push('PCOS_IRON: confirmed iron deficiency → IRON UP GOLD added.');
  }

  // Pattern loss (FPHL) — strong signal only
  if (hasFPHL && !phases.some((k) => k.includes('FPHL'))) {
    const fphlKit: KitId = 'FPHL';
    phases.push(fphlKit);
    rules.push(`PCOS_FPHL: strong pattern-loss signal detected → ${fphlKit} added.`);
  }

  // Scalp inflammation — actual signals only
  if (hasScalpInflam && !phases.includes('PHENOTYPE INFLAMATION')) {
    phases.push('PHENOTYPE INFLAMATION');
    rules.push('PCOS_PHENOTYPE: actual scalp inflammation signals detected → PHENOTYPE INFLAMATION added.');
  }

  // Immune — real systemic compromise ONLY (NOT automatic for every PCOS case)
  if (hasImmune && !phases.some((k) => k.includes('PRO IMMUNE'))) {
    const immuneKit: KitId = isVeg ? 'PRO IMMUNE VEG' : 'PRO IMMUNE GOLD';
    phases.push(immuneKit);
    rules.push('PCOS_IMMUNE: systemic immune compromise confirmed → PRO IMMUNE added.');
  }

  // F-PCOS -1 retired (locked clinical rule 2026-06-14). PRO FACT META B PCOS is
  // the single PCOS kit — it already covers AMPK/insulin sensitisation AND
  // androgen suppression. No diabetes-upgrade swap needed. Strip any legacy
  // F-PCOS -1 that may have leaked in from older fixtures or migrations.
  const legacyFpcosIdx = phases.findIndex((k) => k === 'F-PCOS -1' || k === 'F-PCOS VEG -1');
  if (legacyFpcosIdx >= 0) {
    if (!phases.includes('PRO FACT META B PCOS')) {
      phases[legacyFpcosIdx] = 'PRO FACT META B PCOS';
      rules.push('PCOS_FPCOS_RETIRED: legacy F-PCOS -1 replaced with PRO FACT META B PCOS (locked rule — F-PCOS -1 retired).');
    } else {
      phases.splice(legacyFpcosIdx, 1);
      rules.push('PCOS_FPCOS_RETIRED: legacy F-PCOS -1 dropped — PRO FACT META B PCOS already present.');
    }
  }

  // Post-partum (not breastfeeding) → TE GOLD elevated to Phase 1
  const hasPostPartumNotFeeding =
    (s.cause('Post partum') || s.hormonal('Post-delivery')) &&
    !s.hormonal('breastfeeding') && !s.cause('breastfeed');
  if (hasPostPartumNotFeeding && !phases.some((k) => k.includes('TE GOLD'))) {
    const teGoldKit: KitId = isVeg ? 'HAIR FACT TE GOLD VEG' : 'HAIR FACT TE GOLD';
    phases.unshift(teGoldKit);
    rules.push('PCOS_POST_PARTUM: post-partum (not breastfeeding) → TE GOLD elevated to Phase 1.');
  }

  // PCOS_OBESITY + Hypothyroid → single PRO FACT META B covers all three axes:
  // AMPK/insulin + androgen + T3 metabolic. Avoids PCOS and HYPOTHYROID variant duplication.
  if (
    primaryDiagnosis === 'PCOS_OBESITY' &&
    (s.thyroid('Hypothyroidism') || s.hormonal('Thyroid disorder') || s.hormonal('Thyroid'))
  ) {
    phases = phases.filter(
      (p) => p !== 'PRO FACT META B PCOS' && p !== 'PRO FACT META B HYPOTHYROID'
    );
    if (!phases.includes('PRO FACT META B')) {
      phases.unshift('PRO FACT META B');
      rules.push(
        'PCOS_OBESITY_HYPO: PCOS_OBESITY + Hypothyroid → single PRO FACT META B. ' +
        'Covers AMPK/insulin + androgen + T3 axes in one kit. Avoids PCOS/HYPOTHYROID variant duplication.'
      );
    }
  }

  // HBR — only for confirmed shaft damage. Hard water is the only reachable
  // shaft-damage signal in the current questionnaire (Q3 'Broken/short' retired).
  const hardWater = s.cause('Hard water') || s.cause('hard');
  if (hardWater && !phases.includes('HAIR FACT HAIR BREAKAGE REPAIR(HBR)') && phases.length < 5) {
    phases.push('HAIR FACT HAIR BREAKAGE REPAIR(HBR)');
    rules.push('PCOS_HBR: hard-water shaft damage → HBR added.');
  }

  phases = phases.slice(0, 7); // practical max for PCOS

  if (rules.length === 0) return ctx;
  return { ...ctx, phases, appliedRules: [...ctx.appliedRules, ...rules] };
}

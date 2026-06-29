import type { PatientAnswers } from '../../../types';
import type { ClinicalFlags } from '../../clinical-engine/types';
import { signals } from '../../clinical-engine/signals';
import { detectMetabolicSignal } from '../rules/metabolicModifierRule';
import { isTeGoldDurationAboveThreeMonths } from '../rules/teGoldGatingRule';
import type { ConditionId } from './conditionKitRegistry';

// ─────────────────────────────────────────────────────────────────────────────
// DETECT CONDITIONS  (Layer ①)
//
// Patient answers + clinical flags → the SET of conditions actually present.
// This is pure detection: every condition the patient genuinely has, with no
// regard to which one "wins" a diagnosis race. Interaction/supersession is
// handled afterwards by resolveKitInteractions (Layer ③).
//
// Each predicate mirrors the locked clinical triggers previously scattered
// across signalGatedInjectionRule / scoreConditions / the gating rules.
// ─────────────────────────────────────────────────────────────────────────────

export function detectConditions(
  ans: PatientAnswers,
  flags: ClinicalFlags,
): Set<ConditionId> {
  const s = signals(ans);
  const present = new Set<ConditionId>();
  const { age, isMale, isRegrowGoal } = flags;

  // ── PREGNANCY — exclusive; detected but resolution makes it strip all else ──
  if (flags.isPregnant) {
    present.add('PREGNANCY');
    return present; // nothing else is clinically relevant during pregnancy
  }

  // ── SCALP / PERIFOLLICULAR INFLAMMATION ─────────────────────────────────────
  // Visible scalp signals OR oxidative lifestyle OR immune-allergic load.
  // ALSO sub-clinical: any androgenetic pattern carries perifollicular
  // inflammation even on a normal scalp, so AGA implies this condition.
  const visibleInflam =
    s.scalp('Redness') || s.scalp('irritation') || s.scalp('Boils') ||
    s.scalp('pimples') || s.scalp('Burning') || s.scalp('Flaking') ||
    s.scalp('Dandruff') || s.scalp('Oily') ||
    s.immunity('Allergies') || s.immunity('Skin rash') ||
    s.immunity('Asthma') || s.immunity('Alopecia Areata') ||
    s.lifestyle('Smoking') || s.lifestyle('Vaping') || s.lifestyle('Alcohol');

  // ── ANDROGENETIC PATTERN ────────────────────────────────────────────────────
  const hasGeneticCause = s.cause('Genetics') || s.cause('Family history') || s.cause('family');
  const hasPatternSignal =
    s.hairtype('Thinning') || s.hairtype('widening') || s.hairtype('parting') ||
    s.hairtype('crown') || (hasGeneticCause && age >= 30) ||
    flags.grade.includes('Grade 1') || flags.grade.includes('Grade 2') ||
    flags.grade.includes('Grade 3') || flags.isGrade45 ||
    s.lifestyle('Bodybuilding') || s.lifestyle('Heavy gym');

  if (hasPatternSignal) {
    present.add(isMale ? 'AGA_PATTERN_MALE' : 'AGA_PATTERN_FEMALE');
  }

  if (visibleInflam || hasPatternSignal) {
    present.add('SCALP_INFLAMMATION');
  }

  // ── PCOS ────────────────────────────────────────────────────────────────────
  if (s.hormonal('PCOS') || s.hormonal('PCOD') || s.hormonal('PMOS')) {
    present.add('PCOS');
  }

  // ── THYROID ─────────────────────────────────────────────────────────────────
  if (s.thyroid('Hypothyroidism') || s.hormonal('Hypothyroid')) {
    present.add('HYPOTHYROID');
  }
  if (s.thyroid('Hyperthyroidism')) {
    present.add('HYPERTHYROID');
  }

  // ── METABOLIC (obesity / diabetes / sedentary / crash / keto) ────────────────
  if (detectMetabolicSignal(ans)) {
    present.add('METABOLIC');
  }

  // ── MENOPAUSE CONTINUUM ─────────────────────────────────────────────────────
  if (s.hormonal('Post-menopause') || s.hormonal('Post menopause')) {
    present.add('POST_MENOPAUSE');
  }
  if (s.hormonal('Peri-menopause') || s.hormonal('Perimenopause') || s.hormonal('Peri menopause')) {
    present.add('PERI_MENOPAUSE');
  }

  // ── ENDOMETRIOSIS ───────────────────────────────────────────────────────────
  if (s.hormonal('Endometriosis')) {
    present.add('ENDOMETRIOSIS');
  }

  // ── IRON DEFICIENCY ─────────────────────────────────────────────────────────
  if (s.deficiency('Iron') || s.deficiency('Anaemia')) {
    present.add('IRON_DEFICIENCY');
  }

  // ── GUT (locked: GERD / IBS / Acid / Crohn only) ────────────────────────────
  if (s.gut('GERD') || s.gut('IBS') || s.gut('Acid') || s.gut('Crohn')) {
    present.add('GUT_DYSFUNCTION');
  }

  // ── ALOPECIA AREATA ─────────────────────────────────────────────────────────
  if (s.immunity('Alopecia Areata') || s.hairtype('Patchy') || s.cause('Autoimmune')) {
    present.add('ALOPECIA_AREATA');
  }

  // ── RAPID WEIGHT LOSS / GLP-1 ───────────────────────────────────────────────
  if (flags.hasGLP1Early || flags.hasGLP1Late || flags.hasCrashDiet) {
    present.add('RAPID_WEIGHT_LOSS');
  }

  // ── POST-PARTUM / LACTATION ─────────────────────────────────────────────────
  const explicitlyNotFeeding = s.cause('not feeding');
  const breastfeeding =
    !explicitlyNotFeeding &&
    (s.cause('Post partum') || s.cause('still feeding') ||
      s.hormonal('breastfeeding') || s.hormonal('Post-delivery'));
  if (breastfeeding) {
    present.add('POSTPARTUM_LACTATION');
  }

  // ── CIRCADIAN ───────────────────────────────────────────────────────────────
  if (s.lifestyle('Night shift') || s.cause('Night shift')) {
    present.add('NIGHT_SHIFT');
  }
  if (s.lifestyle('Frequent fly') || s.cause('Frequent fly') || s.lifestyle('travel')) {
    present.add('FREQUENT_FLYING');
  }

  // ── TRICHOTILLOMANIA ────────────────────────────────────────────────────────
  if (s.cause('pulling') || s.cause('Trichotillomania') || s.cause('OCD')) {
    present.add('TRICHOTILLOMANIA');
  }

  // ── OXIDATIVE STRESS standalone (needs 2+ oxidative signals) ────────────────
  const oxidativeCount =
    (s.lifestyle('Smoking') || s.lifestyle('Vaping') ? 1 : 0) +
    (s.lifestyle('Alcohol') ? 1 : 0) +
    (s.immunity('Asthma') ? 1 : 0);
  if (oxidativeCount >= 2) {
    present.add('OXIDATIVE_STRESS');
  }

  // ── EARLY GREYING (goal-driven) ─────────────────────────────────────────────
  if (flags.hasGreyGoal) {
    present.add('EARLY_GREYING');
  }

  // ── IMMUNE DEPLETION ────────────────────────────────────────────────────────
  const immuneSignal =
    isRegrowGoal ||
    s.deficiency('Iron') || s.deficiency('Anaemia') ||
    s.cause('Recent Illness') || s.cause('Surgery') ||
    s.cause('Medication') || s.cause('Nutritional') ||
    s.immunity('Frequent') || s.immunity('Allergies') ||
    (hasGeneticCause && age >= 30) ||
    s.gut('GERD') || s.gut('IBS') || s.gut('Acid') || s.gut('Crohn');
  if (immuneSignal) {
    present.add('IMMUNE_DEPLETION');
  }

  // ── HAIR BREAKAGE — STANDALONE ONLY (locked clinical rule) ───────────────────
  // Only when shaft damage is the ONLY signal. Any systemic / pattern /
  // inflammatory driver disqualifies HBR (those kits cover the same biology).
  const shaftTrigger =
    s.cause('Hard water') || s.cause('hard') ||
    s.treatment('Heat') || s.treatment('Chemical') || s.treatment('Straighten') ||
    s.treatment('Bleach') || s.treatment('Colour') || s.treatment('Perm') ||
    s.treatment('Keratin');
  if (shaftTrigger && isOnlyShaftDamage(present)) {
    present.add('HAIR_BREAKAGE');
  }

  // ── ACUTE SHEDDING (TE) — only within the ≤ 3 month window ──────────────────
  // Breastfeeding excludes TE (LACTIHEALTH covers the mechanism).
  const teTrigger =
    flags.hasActiveShedding ||
    s.cause('Stress') || s.cause('Anxiety') || s.cause('Depression') ||
    s.cause('Nutritional') || s.cause('Medication') ||
    s.cause('Illness') || s.cause('Surgery');
  const acuteWindow = !isTeGoldDurationAboveThreeMonths(ans.duration);
  if (teTrigger && acuteWindow && !breastfeeding && !flags.hasNoVisibleFall) {
    present.add('ACUTE_SHEDDING');
  }

  return present;
}

// HBR is standalone-only: present iff no other condition (besides the shaft
// trigger itself) is in the set.
function isOnlyShaftDamage(present: Set<ConditionId>): boolean {
  for (const c of present) {
    if (c !== 'HAIR_BREAKAGE') return false;
  }
  return true;
}

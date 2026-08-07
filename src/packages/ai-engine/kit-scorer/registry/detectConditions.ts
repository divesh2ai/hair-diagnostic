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
  // Pattern-loss signals are handled separately and should not, by themselves,
  // promote SCALP_INFLAMMATION when the scalp is otherwise normal.
  const visibleInflam =
    s.scalp('Redness') || s.scalp('irritation') || s.scalp('Boils') ||
    s.scalp('pimples') || s.scalp('Burning') || s.scalp('Flaking') ||
    s.scalp('Dandruff') || s.scalp('Oily') ||
    s.immunity('Allergies') || s.immunity('Skin rash') ||
    s.immunity('Acne') || s.immunity('Recurrent Acne') ||
    // Asthma excluded (locked 2026-07-18): it routes to IMMUNE_DEPLETION
    // (Pro Immune Gold) ONLY, not to scalp/perifollicular inflammation.
    s.immunity('Alopecia Areata') ||
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

  if (visibleInflam) {
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

  // ── FEMALE GENETICS ≥ 30 → metabolic terrain ahead of pattern (G-4, revised) ─
  // Locked 2026-07-18. When a female patient's AGA is driven by genetics /
  // family history at age ≥ 30, correct the metabolic terrain first: PRO FACT
  // META B leads, FPHL follows (pattern kits always sequence last).
  // This ADDS META B alongside FPHL — it does NOT suppress FPHL.
  if (!isMale && hasGeneticCause && age >= 30) {
    present.add('METABOLIC');
  }

  // ── OXIDATIVE-SYSTEMIC METABOLIC (locked clinical rule) ─────────────────────
  // Smoking / Vaping / Alcohol WITHOUT a visible scalp condition is a systemic
  // oxidative-metabolic driver, not a localised scalp problem. META B leads
  // (metabolic root correction), PHENOTYPE clears residual inflammation, PRO
  // IMMUNE consolidates, then pattern-correction closes.
  // Asthma excluded here too (locked 2026-07-18): it is an immune condition,
  // not a scalp condition, so it must not suppress oxidative-only detection.
  const hasVisibleScalpCondition =
    s.scalp('Redness') || s.scalp('irritation') || s.scalp('Boils') ||
    s.scalp('pimples') || s.scalp('Burning') || s.scalp('Flaking') ||
    s.scalp('Dandruff') || s.scalp('Oily') ||
    s.immunity('Allergies') || s.immunity('Skin rash') ||
    s.immunity('Alopecia Areata');
  const hasOxidativeLifestyle =
    s.lifestyle('Smoking') || s.lifestyle('Vaping') || s.lifestyle('Alcohol');
  if (hasOxidativeLifestyle && !hasVisibleScalpCondition && !flags.hasActiveShedding) {
    present.add('METABOLIC');
  }

  // ── MENOPAUSE CONTINUUM ─────────────────────────────────────────────────────
  if (s.hormonal('Post-menopause') || s.hormonal('Post menopause')) {
    present.add('POST_MENOPAUSE');
  }
  if (s.hormonal('Peri-menopause') || s.hormonal('Perimenopause') || s.hormonal('Peri menopause')) {
    present.add('PERI_MENOPAUSE');
  }

  // ── POST-HYSTERECTOMY / HRT ─────────────────────────────────────────────────
  // Surgical menopause (post-hysterectomy) and Hormone Replacement Therapy
  // both trigger the dedicated Pro Fact Post Hysterectomy Reset protocol.
  if (s.hormonal('Post-hysterectomy') || s.hormonal('Hysterectomy') || s.hormonal('HRT') || s.hormonal('Hormone Replacement')) {
    present.add('POST_HYSTERECTOMY');
  }

  // ── ENDOMETRIOSIS ───────────────────────────────────────────────────────────
  if (s.hormonal('Endometriosis')) {
    present.add('ENDOMETRIOSIS');
  }

  // ── IRON DEFICIENCY ─────────────────────────────────────────────────────────
  // Heavy menstrual bleeding is a confirmed chronic iron-loss driver and must
  // route into IRON_DEFICIENCY even when the patient did not separately declare
  // Iron/Anaemia. Locked clinical rule (females 18–50 + heavy bleeding).
  if (
    s.deficiency('Iron') ||
    s.deficiency('Anaemia') ||
    s.hormonal('Heavy bleeding')
  ) {
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

  // ── IMMUNE DEPLETION → PRO IMMUNE GOLD ─────────────────────────────────────
  // Locked clinical rule (2026-07-13; extended 2026-08-05). PRO IMMUNE is
  // prescribed when the patient has an actual immunity-related disease OR a
  // primary condition on the allow-list below. All other cases (Grade 1–3
  // AGA, quiet-phase regrow goals, hypothyroid, PCOS, oxidative-only
  // lifestyle, dandruff-only) do NOT receive PRO IMMUNE from this rule — a
  // separate "consolidation filler" pass in buildKitSequence injects it only
  // when the final stack would otherwise contain just 2 kits.
  //
  //   1. Explicit immunity-disease signal
  //        Frequent infections / Allergies / Asthma / Recent Illness / Surgery
  //        Skin rash / Eczema (added 2026-08-05 — co-triggers PRO IMMUNE
  //        alongside Phenotype Inflammation; these signals reflect a
  //        systemic immune-hygiene deficit that skin-only inflammation
  //        control does not fully address on its own).
  //   2. Allow-listed primary condition
  //        IBS (gut condition), Hyperthyroid, Alopecia Areata, Endometriosis,
  //        Iron deficiency (declared or via heavy bleeding), Metabolic / diabetic
  const hasImmunityDisease =
    s.immunity('Frequent') || s.immunity('Allergies') || s.immunity('Asthma') ||
    s.immunity('Skin rash') || s.immunity('Eczema') ||
    // Mouth / tongue ulcers — added 2026-08-05. A recurrent oral-mucosal
    // ulcer is a documented systemic immunity signal (B12/iron/folate axis,
    // autoimmune association) and belongs on the PRO IMMUNE trigger list
    // alongside Skin rash / Eczema — same clinical logic, same fix.
    s.immunity('Ulcer') || s.immunity('Mouth') || s.immunity('Tongue') ||
    s.cause('Recent Illness') || s.cause('Surgery');
  const hasAllowListedCondition =
    // Gut trigger — IBS and Crohn only. GERD and Acid reflux are explicitly
    // excluded (locked 2026-07-13): they drive GI GOLD but do NOT by themselves
    // warrant PRO IMMUNE co-prescribing.
    s.gut('IBS') || s.gut('Crohn') ||
    // Hyperthyroid
    s.thyroid('Hyperthyroidism') ||
    // Alopecia areata
    s.immunity('Alopecia Areata') || s.hairtype('Patchy') || s.cause('Autoimmune') ||
    // Endometriosis
    s.hormonal('Endometriosis') ||
    // Iron deficiency — declared or chronic (heavy bleeding)
    s.deficiency('Iron') || s.deficiency('Anaemia') || s.hormonal('Heavy bleeding') ||
    // Metabolic / diabetic
    detectMetabolicSignal(ans);
  if (hasImmunityDisease || hasAllowListedCondition) {
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

  // ── ACUTE SHEDDING (TE) — locked clinical rule ──────────────────────────────
  // TE GOLD requires OBJECTIVE evidence of active shedding in the 1–3 month
  // acute window. Signal causes (Stress / Anxiety / Nutritional / Medication /
  // Illness / Surgery) are DRIVERS — they modify how shedding is treated but
  // do NOT by themselves prove shedding. Chronic stress in a patient with no
  // hair fall (or fall > 3 months) is covered by META B / hormonal kits and,
  // outside the acute window, by the melatonin-family kits.
  //
  // Duration must be present AND match the 1–3 month acute window. Missing /
  // unknown duration does NOT default to acute (previous bug: blank duration
  // + any stress cause promoted TE GOLD).
  //
  // Breastfeeding still excludes TE (LACTIHEALTH covers the mechanism).
  // `count` and `duration` are free-text strings in PatientAnswers — same
  // convention as signals.ts. Do NOT treat them as arrays.
  const duration = (ans.duration ?? '').trim();
  const countStr = (ans.count ?? '').toString();
  const inAcuteWindow =
    /1\s*[–-]\s*3|0\s*[–-]\s*3|less than\s*3|under\s*3|below\s*3|up to\s*3/i.test(duration);
  const hasCountEvidence =
    countStr.includes('50') ||
    countStr.includes('100') ||
    countStr.includes('Noticeable');
  const objectiveAcuteShedding =
    inAcuteWindow &&
    hasCountEvidence &&
    !isTeGoldDurationAboveThreeMonths(duration);

  if (
    objectiveAcuteShedding &&
    !breastfeeding &&
    !flags.hasNoVisibleFall &&
    !isRegrowGoal
  ) {
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

import type { PatientAnswers } from '../../types';
import type {
  ClinicalSignal,
  DetectedSignal,
  SignalEvidence,
  SignalWeight,
} from './types';
import { requireSignal } from './catalog';

// ─────────────────────────────────────────────────────────────────────────────
// SIGNAL DETECTORS — PatientAnswers → DetectedSignal[]
//
// Each detector is a pure function that inspects PatientAnswers and emits zero
// or one DetectedSignal. Detectors never reach into scoring — they translate
// raw answers into biology-shaped signals. The Pathway Engine (Phase 2) reads
// these.
//
// Detector authoring rules:
//   - Always attach evidence (questionId + matched value) — Phase 10
//     Explainability requires this.
//   - Never mutate inputs.
//   - Severity / confidence start from the catalog entry; detectors *may*
//     downgrade them when evidence is weak, but never upgrade.
// ─────────────────────────────────────────────────────────────────────────────

// ── helpers ────────────────────────────────────────────────────────────────

const arr = (v: unknown): readonly string[] =>
  Array.isArray(v) ? (v.filter((x) => typeof x === 'string') as string[]) : [];

const includesAny = (haystack: readonly string[], needles: readonly string[]): string | null => {
  for (const h of haystack) {
    const lower = h.toLowerCase();
    for (const n of needles) {
      if (lower.includes(n.toLowerCase())) return h;
    }
  }
  return null;
};

const matchString = (val: string | undefined, needles: readonly string[]): string | null => {
  if (!val) return null;
  const lower = val.toLowerCase();
  for (const n of needles) if (lower.includes(n.toLowerCase())) return val;
  return null;
};

const detected = (
  signal: ClinicalSignal,
  evidence: readonly SignalEvidence[],
  overrides?: { severity?: SignalWeight; confidence?: SignalWeight },
): DetectedSignal =>
  Object.freeze({
    id: signal.id,
    evidence: Object.freeze([...evidence]),
    severity: overrides?.severity ?? signal.severityWeight,
    confidence: overrides?.confidence ?? signal.confidenceWeight,
  });

const ev = (questionId: string, value: string, note?: string): SignalEvidence =>
  Object.freeze(note ? { questionId, value, note } : { questionId, value });

// Lower of two weights (used when evidence is partial).
const minWeight = (a: SignalWeight, b: SignalWeight): SignalWeight => {
  const order: Record<SignalWeight, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
  return order[a] < order[b] ? a : b;
};

// ── individual detectors ───────────────────────────────────────────────────

type Detector = (ans: PatientAnswers) => DetectedSignal | null;

const detectAgeOver30: Detector = (ans) => {
  const age = parseInt(String(ans.age), 10);
  if (!Number.isFinite(age) || age <= 30) return null;
  return detected(requireSignal('AGE_OVER_30'), [ev('age', String(age))]);
};

const detectAgeUnder30Female: Detector = (ans) => {
  const age = parseInt(String(ans.age), 10);
  if (!Number.isFinite(age) || age >= 30) return null;
  if (ans.sex !== 'Female') return null;
  return detected(requireSignal('AGE_UNDER_30_FEMALE'), [
    ev('age', String(age)),
    ev('sex', 'Female'),
  ]);
};

const detectRegrowOnlyGoal: Detector = (ans) => {
  const goal = Array.isArray(ans.goal) ? ans.goal.join(' ') : ans.goal ?? '';
  const match = matchString(goal, ['stopped', 'no active', 'regrow only']);
  if (!match) return null;
  return detected(requireSignal('REGROW_ONLY_GOAL'), [ev('goal', goal)]);
};

const detectGreyConcernGoal: Detector = (ans) => {
  const goal = Array.isArray(ans.goal) ? ans.goal.join(' ') : ans.goal ?? '';
  if (!matchString(goal, ['greying', 'grey'])) return null;
  return detected(requireSignal('GREY_CONCERN_GOAL'), [ev('goal', goal)]);
};

const detectActiveShedding: Detector = (ans) => {
  const count = ans.count ?? '';
  const duration = ans.duration ?? '';
  const causes = arr(ans.cause);
  const evList: SignalEvidence[] = [];

  if (/50|100|Noticeable/i.test(count)) evList.push(ev('count', count));
  if (/1[–-]3|3[–-]6/.test(duration)) evList.push(ev('duration', duration));

  const causeMatch = includesAny(causes, [
    'Stress', 'Anxiety', 'Depression', 'Nutritional', 'Medication', 'Illness', 'Surgery',
  ]);
  if (causeMatch) evList.push(ev('cause', causeMatch));

  if (evList.length === 0) return null;
  if (matchString(count, ['thinning', 'no visible fall'])) return null; // suppressed
  return detected(requireSignal('ACTIVE_SHEDDING'), evList);
};

const detectNoVisibleFall: Detector = (ans) => {
  const count = ans.count ?? '';
  if (!matchString(count, ['thinning', 'no visible fall'])) return null;
  return detected(requireSignal('NO_VISIBLE_FALL'), [ev('count', count)]);
};

const detectLongDurationShedding: Detector = (ans) => {
  const duration = ans.duration ?? '';
  if (!matchString(duration, ['12', 'More than', 'years'])) return null;
  return detected(requireSignal('LONG_DURATION_SHEDDING'), [ev('duration', duration)]);
};

const detectChronicTelogen: Detector = (ans) => {
  const duration = ans.duration ?? '';
  const count = ans.count ?? '';
  if (!matchString(duration, ['6–12', '6-12', 'More than', '12'])) return null;
  if (matchString(count, ['no visible fall'])) return null;
  return detected(requireSignal('CHRONIC_TELOGEN'), [
    ev('duration', duration),
    ev('count', count),
  ]);
};

const detectFollicularMiniaturizationPattern: Detector = (ans) => {
  const hairtype = arr(ans.hairtype);
  const m = includesAny(hairtype, ['Thinning', 'widening', 'parting']);
  if (!m) return null;
  return detected(requireSignal('FOLLICULAR_MINIATURIZATION_PATTERN'), [ev('hairtype', m)]);
};

const detectAdvancedPatternLoss: Detector = (ans) => {
  const grade = ans.grade ?? '';
  if (!matchString(grade, ['Grade 4', 'Grade 5'])) return null;
  return detected(requireSignal('ADVANCED_PATTERN_LOSS'), [ev('grade', grade)]);
};

const detectEarlyPatternLoss: Detector = (ans) => {
  const grade = ans.grade ?? '';
  if (!matchString(grade, ['Grade 1', 'Grade 2'])) return null;
  return detected(requireSignal('EARLY_PATTERN_LOSS'), [ev('grade', grade)]);
};

const detectPatchyLoss: Detector = (ans) => {
  const hairtype = arr(ans.hairtype);
  const m = includesAny(hairtype, ['circular', 'patches']);
  if (!m) return null;
  return detected(requireSignal('PATCHY_LOSS'), [ev('hairtype', m)]);
};

const detectOilyScalp: Detector = (ans) => {
  const scalp = arr(ans.scalp);
  const m = includesAny(scalp, ['Oily']);
  if (!m) return null;
  return detected(requireSignal('OILY_SCALP'), [ev('scalp', m)]);
};

const detectDryScalp: Detector = (ans) => {
  const scalp = arr(ans.scalp);
  const m = includesAny(scalp, ['Dry', 'Flaking']);
  if (!m) return null;
  return detected(requireSignal('DRY_SCALP'), [ev('scalp', m)]);
};

const detectDandruff: Detector = (ans) => {
  const scalp = arr(ans.scalp);
  const m = includesAny(scalp, ['Dandruff']);
  if (!m) return null;
  return detected(requireSignal('DANDRUFF'), [ev('scalp', m)]);
};

const detectActiveInflammation: Detector = (ans) => {
  const scalp = arr(ans.scalp);
  const m = includesAny(scalp, ['Redness', 'Burning', 'Boils', 'pimples', 'irritation']);
  if (!m) return null;
  return detected(requireSignal('ACTIVE_INFLAMMATION'), [ev('scalp', m)]);
};

const detectScalpBarrierDysfunction: Detector = (ans) => {
  const scalp = arr(ans.scalp);
  const m = includesAny(scalp, ['Dry', 'Flaking', 'Oily', 'Sensitive']);
  if (!m) return null;
  return detected(requireSignal('SCALP_BARRIER_DYSFUNCTION'), [ev('scalp', m)]);
};

const detectPsoriaticScalp: Detector = (ans) => {
  const scalp = arr(ans.scalp);
  const immunity = arr(ans.immunity);
  const m = includesAny(scalp, ['Psoriasis']) ?? includesAny(immunity, ['Psoriasis']);
  if (!m) return null;
  return detected(requireSignal('PSORIATIC_SCALP'), [ev('scalp/immunity', m)]);
};

const detectSensitiveScalp: Detector = (ans) => {
  const scalp = arr(ans.scalp);
  const m = includesAny(scalp, ['Sensitive', 'sensitive']);
  if (!m) return null;
  return detected(requireSignal('SENSITIVE_SCALP'), [ev('scalp', m)]);
};

const detectChronicInflammatoryPhenotype: Detector = (ans) => {
  const scalp = arr(ans.scalp);
  const immunity = arr(ans.immunity);
  const duration = ans.duration ?? '';
  const scalpInflam = includesAny(scalp, ['Redness', 'Burning', 'Boils', 'pimples', 'Dandruff']);
  const immuneInflam = includesAny(immunity, ['Allergies', 'Asthma', 'Skin rash']);
  const longDuration = matchString(duration, ['12', 'More than']);
  if (!(scalpInflam && (immuneInflam || longDuration))) return null;
  const evList: SignalEvidence[] = [ev('scalp', scalpInflam)];
  if (immuneInflam) evList.push(ev('immunity', immuneInflam));
  if (longDuration) evList.push(ev('duration', longDuration));
  return detected(requireSignal('CHRONIC_INFLAMMATORY_PHENOTYPE'), evList);
};

const detectFollicularStress: Detector = (ans) => {
  // Composite signal — fires when multiple stressors coexist.
  const lifestyle = arr(ans.lifestyle);
  const causes = arr(ans.cause);
  const duration = ans.duration ?? '';
  let count = 0;
  const evList: SignalEvidence[] = [];
  const lifestyleM = includesAny(lifestyle, ['Smoking', 'Vaping', 'Alcohol', 'Sedentary', 'Night shift']);
  if (lifestyleM) { count++; evList.push(ev('lifestyle', lifestyleM)); }
  const causeM = includesAny(causes, ['Stress', 'Anxiety', 'Depression']);
  if (causeM) { count++; evList.push(ev('cause', causeM)); }
  const longDur = matchString(duration, ['12', 'More than']);
  if (longDur) { count++; evList.push(ev('duration', longDur)); }
  if (count < 2) return null;
  return detected(requireSignal('FOLLICULAR_STRESS'), evList);
};

const detectImmuneDysregulationSystemic: Detector = (ans) => {
  const immunity = arr(ans.immunity);
  const m = includesAny(immunity, ['Allergies', 'Asthma', 'Frequent', 'Skin rash', 'ulcer']);
  if (!m) return null;
  return detected(requireSignal('IMMUNE_DYSREGULATION_SYSTEMIC'), [ev('immunity', m)]);
};

const detectAutoimmuneHairLoss: Detector = (ans) => {
  const immunity = arr(ans.immunity);
  const m = includesAny(immunity, ['Alopecia Areata', 'Areata']);
  if (!m) return null;
  return detected(requireSignal('AUTOIMMUNE_HAIR_LOSS'), [ev('immunity', m)]);
};

const detectPCOS: Detector = (ans) => {
  const hormonal = arr(ans.hormonal);
  const m = includesAny(hormonal, ['PCOS', 'PCOD']);
  if (!m) return null;
  return detected(requireSignal('PCOS'), [ev('hormonal', m)]);
};

const detectPerimenopause: Detector = (ans) => {
  const hormonal = arr(ans.hormonal);
  const m = includesAny(hormonal, ['Peri-menopause', 'Peri menopause', 'Perimenopause', 'peri']);
  if (!m) return null;
  return detected(requireSignal('PERIMENOPAUSE_TRANSITION'), [ev('hormonal', m)]);
};

const detectMenopause: Detector = (ans) => {
  const hormonal = arr(ans.hormonal);
  const peri = includesAny(hormonal, ['Peri']);
  const post = includesAny(hormonal, ['Post-menopause', 'Post menopause']);
  const meno = includesAny(hormonal, ['Menopause']);
  if (!meno || peri || post) return null;
  return detected(requireSignal('MENOPAUSE'), [ev('hormonal', meno)]);
};

const detectPostMenopause: Detector = (ans) => {
  const hormonal = arr(ans.hormonal);
  const m = includesAny(hormonal, ['Post-menopause', 'Post menopause']);
  if (!m) return null;
  return detected(requireSignal('POST_MENOPAUSE'), [ev('hormonal', m)]);
};

const detectPostPartum: Detector = (ans) => {
  const hormonal = arr(ans.hormonal);
  const causes = arr(ans.cause);
  const m = includesAny(causes, ['Post partum']) ?? includesAny(hormonal, ['Post-delivery', 'breastfeeding']);
  if (!m) return null;
  return detected(requireSignal('POST_PARTUM'), [ev('cause/hormonal', m)]);
};

const detectPregnancy: Detector = (ans) => {
  const hormonal = arr(ans.hormonal);
  const causes = arr(ans.cause);
  if (ans.is_pregnant) {
    return detected(requireSignal('PREGNANCY'), [ev('is_pregnant', 'true')]);
  }
  const m = includesAny(hormonal, ['Pregnant', 'pregnancy', 'Pregnancy']) ?? includesAny(causes, ['Currently pregnant']);
  if (!m) return null;
  return detected(requireSignal('PREGNANCY'), [ev('hormonal/cause', m)]);
};

const detectEndometriosis: Detector = (ans) => {
  const hormonal = arr(ans.hormonal);
  const m = includesAny(hormonal, ['Endometriosis']);
  if (!m) return null;
  return detected(requireSignal('ENDOMETRIOSIS'), [ev('hormonal', m)]);
};

const detectHypothyroidism: Detector = (ans) => {
  const thyroid = Array.isArray(ans.thyroid) ? ans.thyroid : ans.thyroid ? [ans.thyroid] : [];
  const hormonal = arr(ans.hormonal);
  const m = includesAny(thyroid, ['Hypothyroidism']) ?? includesAny(hormonal, ['Thyroid']);
  if (!m) return null;
  return detected(requireSignal('HYPOTHYROIDISM'), [ev('thyroid/hormonal', m)]);
};

const detectHyperthyroidism: Detector = (ans) => {
  const thyroid = Array.isArray(ans.thyroid) ? ans.thyroid : ans.thyroid ? [ans.thyroid] : [];
  const m = includesAny(thyroid, ['Hyperthyroidism']);
  if (!m) return null;
  return detected(requireSignal('HYPERTHYROIDISM'), [ev('thyroid', m)]);
};

const detectDiabetes: Detector = (ans) => {
  const thyroid = Array.isArray(ans.thyroid) ? ans.thyroid : ans.thyroid ? [ans.thyroid] : [];
  const m = includesAny(thyroid, ['Diabetes', 'Pre diabetes', 'Pre-diabetes']);
  if (!m) return null;
  return detected(requireSignal('DIABETES'), [ev('thyroid', m)]);
};

const detectMetabolicDysfunction: Detector = (ans) => {
  const lifestyle = arr(ans.lifestyle);
  const hormonal = arr(ans.hormonal);
  const m =
    includesAny(lifestyle, ['Obesity', 'Sedentary', 'weight']) ??
    includesAny(hormonal, ['Obesity']);
  if (!m) return null;
  return detected(requireSignal('METABOLIC_DYSFUNCTION'), [ev('lifestyle/hormonal', m)]);
};

const detectRapidWeightLoss: Detector = (ans) => {
  const causes = arr(ans.cause);
  const diet = arr(ans.diet);
  const m =
    includesAny(causes, ['GLP-1', 'GLP1', 'within 6 months', 'after 6 months']) ??
    includesAny(diet, ['Crash', 'Keto']);
  if (!m) return null;
  return detected(requireSignal('RAPID_WEIGHT_LOSS'), [ev('cause/diet', m)]);
};

const detectOxidativeStress: Detector = (ans) => {
  const lifestyle = arr(ans.lifestyle);
  const m = includesAny(lifestyle, ['Smoking', 'Vaping', 'Alcohol']);
  if (!m) return null;
  return detected(requireSignal('OXIDATIVE_STRESS'), [ev('lifestyle', m)]);
};

const detectIronDeficiency: Detector = (ans) => {
  const def = arr(ans.deficiency);
  const m = includesAny(def, ['Iron', 'Anaemia', 'Anemia']);
  if (!m) return null;
  return detected(requireSignal('IRON_DEFICIENCY'), [ev('deficiency', m)]);
};

const detectPoorDietQuality: Detector = (ans) => {
  const diet = arr(ans.diet);
  const causes = arr(ans.cause);
  const m =
    includesAny(diet, ['Irregular', 'poor', 'Poor']) ??
    includesAny(causes, ['Nutritional']);
  if (!m) return null;
  return detected(requireSignal('POOR_DIET_QUALITY'), [ev('diet/cause', m)]);
};

const detectVegetarianProfile: Detector = (ans) => {
  const diet = arr(ans.diet);
  const m = includesAny(diet, ['Vegetarian', 'Vegan', 'Jain']);
  if (!m) return null;
  return detected(requireSignal('VEGETARIAN_PROFILE'), [ev('diet', m)]);
};

const detectCrashDieting: Detector = (ans) => {
  const diet = arr(ans.diet);
  const m = includesAny(diet, ['Crash']);
  if (!m) return null;
  return detected(requireSignal('CRASH_DIETING'), [ev('diet', m)]);
};

const detectGutDysfunction: Detector = (ans) => {
  const gut = arr(ans.gut);
  const m = includesAny(gut, ['IBS', 'GERD', 'Bloating', 'Crohn', 'Acid', 'Constipation']);
  if (!m) return null;
  return detected(requireSignal('GUT_DYSFUNCTION'), [ev('gut', m)]);
};

const detectShaftDamage: Detector = (ans) => {
  const hairtype = arr(ans.hairtype);
  const causes = arr(ans.cause);
  const m = includesAny(hairtype, ['Broken', 'short']) ?? includesAny(causes, ['Hard water']);
  if (!m) return null;
  return detected(requireSignal('SHAFT_DAMAGE'), [ev('hairtype/cause', m)]);
};

const detectChemicalHeatExposure: Detector = (ans) => {
  const treatment = arr(ans.treatment);
  const m = includesAny(treatment, ['Heat', 'Chemical', 'Colour', 'Color', 'Straightening']);
  if (!m) return null;
  return detected(requireSignal('CHEMICAL_HEAT_EXPOSURE'), [ev('treatment', m)]);
};

const detectHardWaterExposure: Detector = (ans) => {
  const causes = arr(ans.cause);
  const m = includesAny(causes, ['Hard water']);
  if (!m) return null;
  return detected(requireSignal('HARD_WATER_EXPOSURE'), [ev('cause', m)]);
};

const detectCircadianDisruption: Detector = (ans) => {
  const lifestyle = arr(ans.lifestyle);
  const m = includesAny(lifestyle, ['Night shift', 'Flying', 'flying']);
  if (!m) return null;
  return detected(requireSignal('CIRCADIAN_DISRUPTION'), [ev('lifestyle', m)]);
};

const detectAndrogenExposureLifestyle: Detector = (ans) => {
  const lifestyle = arr(ans.lifestyle);
  const m = includesAny(lifestyle, ['Bodybuilding', 'Heavy gym']);
  if (!m) return null;
  return detected(requireSignal('ANDROGEN_EXPOSURE_LIFESTYLE'), [ev('lifestyle', m)]);
};

const detectPsychologicalStress: Detector = (ans) => {
  const causes = arr(ans.cause);
  const m = includesAny(causes, ['Stress', 'Anxiety', 'Depression']);
  if (!m) return null;
  return detected(requireSignal('PSYCHOLOGICAL_STRESS'), [ev('cause', m)]);
};

const detectTrichotillomania: Detector = (ans) => {
  const causes = arr(ans.cause);
  const m = includesAny(causes, ['pulling', 'Trichotillomania', 'TTM', 'OCD']);
  if (!m) return null;
  return detected(requireSignal('TRICHOTILLOMANIA'), [ev('cause', m)]);
};

const detectGeneticPredisposition: Detector = (ans) => {
  const causes = arr(ans.cause);
  const m = includesAny(causes, ['Genetics', 'Family history']);
  if (!m) return null;
  return detected(requireSignal('GENETIC_PREDISPOSITION'), [ev('cause', m)]);
};

const detectRecentIllnessOrSurgery: Detector = (ans) => {
  const causes = arr(ans.cause);
  const m = includesAny(causes, ['Illness', 'Surgery']);
  if (!m) return null;
  return detected(requireSignal('RECENT_ILLNESS_OR_SURGERY'), [ev('cause', m)]);
};

const detectMedicationInduced: Detector = (ans) => {
  const causes = arr(ans.cause);
  const m = includesAny(causes, ['Medication']);
  if (!m) return null;
  return detected(requireSignal('MEDICATION_INDUCED'), [ev('cause', m)]);
};

const detectChronicMedicalCondition: Detector = (ans) => {
  if (!ans.medical) return null;
  if (!/yes/i.test(ans.medical)) return null;
  return detected(requireSignal('CHRONIC_MEDICAL_CONDITION'), [
    ev('medical', ans.medical),
    ...(ans.medical_detail ? [ev('medical_detail', ans.medical_detail)] : []),
  ]);
};

const detectHormonalShiftGeneric: Detector = (ans) => {
  const hormonal = arr(ans.hormonal);
  if (hormonal.length === 0) return null;
  // Only fire if no more specific hormonal signal will fire.
  const specific = ['PCOS', 'PCOD', 'Menopause', 'Peri', 'Post-delivery', 'breastfeeding', 'Endometriosis', 'Pregnancy', 'Thyroid', 'Obesity'];
  const hasSpecific = includesAny(hormonal, specific);
  if (hasSpecific) return null;
  return detected(requireSignal('HORMONAL_SHIFT_GENERIC'), [ev('hormonal', hormonal.join(', '))], {
    confidence: minWeight('LOW', requireSignal('HORMONAL_SHIFT_GENERIC').confidenceWeight),
  });
};

// ── ordered detector list ──────────────────────────────────────────────────
// Order matters only for readability; outputs are merged by id, not by order.
const ALL_DETECTORS: readonly Detector[] = Object.freeze([
  detectAgeOver30,
  detectAgeUnder30Female,
  detectRegrowOnlyGoal,
  detectGreyConcernGoal,
  detectActiveShedding,
  detectNoVisibleFall,
  detectLongDurationShedding,
  detectChronicTelogen,
  detectFollicularMiniaturizationPattern,
  detectAdvancedPatternLoss,
  detectEarlyPatternLoss,
  detectPatchyLoss,
  detectOilyScalp,
  detectDryScalp,
  detectDandruff,
  detectActiveInflammation,
  detectScalpBarrierDysfunction,
  detectPsoriaticScalp,
  detectSensitiveScalp,
  detectChronicInflammatoryPhenotype,
  detectFollicularStress,
  detectImmuneDysregulationSystemic,
  detectAutoimmuneHairLoss,
  detectPCOS,
  detectPerimenopause,
  detectMenopause,
  detectPostMenopause,
  detectPostPartum,
  detectPregnancy,
  detectEndometriosis,
  detectHypothyroidism,
  detectHyperthyroidism,
  detectDiabetes,
  detectMetabolicDysfunction,
  detectRapidWeightLoss,
  detectOxidativeStress,
  detectIronDeficiency,
  detectPoorDietQuality,
  detectVegetarianProfile,
  detectCrashDieting,
  detectGutDysfunction,
  detectShaftDamage,
  detectChemicalHeatExposure,
  detectHardWaterExposure,
  detectCircadianDisruption,
  detectAndrogenExposureLifestyle,
  detectPsychologicalStress,
  detectTrichotillomania,
  detectGeneticPredisposition,
  detectRecentIllnessOrSurgery,
  detectMedicationInduced,
  detectChronicMedicalCondition,
  detectHormonalShiftGeneric,
]);

export function runAllDetectors(ans: PatientAnswers): readonly DetectedSignal[] {
  const out: DetectedSignal[] = [];
  for (const d of ALL_DETECTORS) {
    const s = d(ans);
    if (s) out.push(s);
  }
  return Object.freeze(out);
}

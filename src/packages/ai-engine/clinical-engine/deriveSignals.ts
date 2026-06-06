import type { PatientAnswers, ScalpState, RootCause, Severity } from '../../types';
import { signals } from './signals';

// ─────────────────────────────────────────────────────────────────────────────
// DERIVE SIGNALS — PatientAnswers → observable clinical signals
//
// Produces the three non-scoring outputs of the clinical engine:
//   scalpStates  — surface conditions that influence topical selection
//   rootCauses   — causal drivers used for AI narration and explainability
//   severity     — MILD / MODERATE / SEVERE from grade selection
//
// All logic extracted verbatim from evaluateClinicalProfile.ts.
// ─────────────────────────────────────────────────────────────────────────────

export interface DerivedSignals {
  scalpStates: ScalpState[];
  rootCauses: RootCause[];
  severity: Severity;
}

export function deriveSignals(ans: PatientAnswers): DerivedSignals {
  return {
    scalpStates: deriveScalpStates(ans),
    rootCauses: deriveRootCauses(ans),
    severity: deriveSeverity(ans),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Scalp state derivation
// ─────────────────────────────────────────────────────────────────────────────

function deriveScalpStates(ans: PatientAnswers): ScalpState[] {
  const s = signals(ans);
  const states: ScalpState[] = [];

  if (s.scalp('Oily'))   states.push('OILY_SCALP');
  if (s.scalp('Dry') || s.scalp('Flaking')) states.push('DRY_SCALP');
  if (s.scalp('Dandruff')) states.push('DANDRUFF');
  if (s.scalp('Redness') || s.scalp('Burning') || s.scalp('Boils') ||
      s.scalp('pimples') || s.scalp('irritation')) {
    states.push('INFLAMED_SCALP');
  }
  if (s.scalp('Psoriasis') || s.immunity('Psoriasis')) states.push('PSORIATIC_SCALP');
  if (s.scalp('sensitive') || s.scalp('Sensitive'))    states.push('SENSITIVE_SCALP');
  if (states.length === 0) states.push('NORMAL_SCALP');

  return states;
}

// ─────────────────────────────────────────────────────────────────────────────
// Root cause derivation
// ─────────────────────────────────────────────────────────────────────────────

function deriveRootCauses(ans: PatientAnswers): RootCause[] {
  const s = signals(ans);
  const causes: RootCause[] = [];

  if (s.cause('Stress') || s.cause('Anxiety') || s.cause('Depression')) causes.push('STRESS');
  if (s.cause('Genetics') || s.cause('Family history'))                  causes.push('GENETICS');
  if (s.deficiency('Iron') || s.deficiency('Anaemia'))                   causes.push('IRON_DEFICIENCY');
  if (s.thyroid('Hypothyroidism'))                                        causes.push('HYPOTHYROID');
  if (s.thyroid('Hyperthyroidism'))                                       causes.push('HYPERTHYROID');
  if (s.hormonal('PCOS') || s.hormonal('PCOD'))                          causes.push('PCOS');
  if (s.thyroid('Diabetes') || s.thyroid('Pre diabetes') ||
      s.lifestyle('Obesity') || s.lifestyle('Sedentary'))                 causes.push('METABOLIC');
  if (s.cause('Nutritional') || s.diet('poor') || s.diet('Irregular'))   causes.push('POOR_NUTRITION');
  if (s.cause('Post partum') || s.hormonal('breastfeeding'))             causes.push('POST_PARTUM');
  if (s.gut('IBS') || s.gut('GERD') || s.gut('Bloating') || s.gut('Crohn')) causes.push('GUT_MALABSORPTION');
  if (s.lifestyle('Smoking') || s.lifestyle('Vaping') || s.lifestyle('Alcohol')) causes.push('OXIDATIVE_STRESS');
  if (s.cause('Medication'))                                              causes.push('MEDICATION');
  if (s.cause('Illness') || s.cause('Surgery'))                          causes.push('ILLNESS');
  if (s.cause('GLP-1') || s.diet('Crash') ||
      (ans.cause ?? []).some((c) => c.includes('6 months')))             causes.push('RAPID_WEIGHT_LOSS');
  if (s.immunity('Alopecia Areata'))                                      causes.push('AUTOIMMUNE');
  if (s.lifestyle('Night shift') || s.lifestyle('Flying'))               causes.push('CIRCADIAN_DISRUPTION');
  if (s.cause('pulling') || s.cause('Trichotillomania'))                 causes.push('TRICHOTILLOMANIA');
  if (s.hormonal('Menopause') || s.hormonal('Peri-menopause') ||
      s.hormonal('Post-menopause'))                                        causes.push('HORMONAL_SHIFT');
  if (s.scalp('Dandruff') || s.scalp('Oily'))                            causes.push('DHT');

  return causes;
}

// ─────────────────────────────────────────────────────────────────────────────
// Severity derivation from grade
// ─────────────────────────────────────────────────────────────────────────────

function deriveSeverity(ans: PatientAnswers): Severity {
  const grade = ans.grade ?? '';
  if (grade.includes('4') || grade.includes('5')) return 'SEVERE';
  if (grade.includes('1') || grade.includes('2')) return 'MILD';
  return 'MODERATE';
}

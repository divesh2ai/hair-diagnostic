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
  if (s.deficiency('Iron') || s.deficiency('Anaemia') ||
      s.hormonal('Heavy bleeding'))                                       causes.push('IRON_DEFICIENCY');
  if (s.deficiency('B12') || s.deficiency('Vitamin B12') ||
      s.deficiency('Vitamin D') || s.deficiency('D3'))                    causes.push('POOR_NUTRITION');
  if (s.thyroid('Hypothyroidism'))                                        causes.push('HYPOTHYROID');
  if (s.thyroid('Hyperthyroidism'))                                       causes.push('HYPERTHYROID');
  if (s.hormonal('PCOS') || s.hormonal('PCOD'))                          causes.push('PCOS');
  if (s.thyroid('Diabetes') || s.thyroid('Pre diabetes') ||
      s.lifestyle('Obesity') || s.lifestyle('Sedentary'))                 causes.push('METABOLIC');
  if (s.cause('Nutritional') || s.diet('poor') || s.diet('Irregular'))   causes.push('POOR_NUTRITION');
  if (s.cause('Post partum') || s.hormonal('breastfeeding'))             causes.push('POST_PARTUM');
  // Locked clinical rule: GUT_MALABSORPTION cause derived only from structural gut signals
  // (GERD / IBS / Acid / Crohn) — not from Bloating / Constipation / Indigestion.
  if (s.gut('IBS') || s.gut('GERD') || s.gut('Acid') || s.gut('Crohn')) causes.push('GUT_MALABSORPTION');
  if (s.lifestyle('Smoking') || s.lifestyle('Vaping') || s.lifestyle('Alcohol')) causes.push('OXIDATIVE_STRESS');
  if (s.cause('Medication'))                                              causes.push('MEDICATION');
  if (s.cause('Illness') || s.cause('Surgery'))                          causes.push('ILLNESS');
  if (s.cause('GLP-1') || s.diet('Crash') ||
      (ans.cause ?? []).some((c) => c.includes('6 months')))             causes.push('RAPID_WEIGHT_LOSS');
  if (s.immunity('Alopecia Areata'))                                      causes.push('AUTOIMMUNE');
  if (s.lifestyle('Night shift') || s.lifestyle('Flying'))               causes.push('CIRCADIAN_DISRUPTION');
  if (s.cause('pulling') || s.cause('Trichotillomania'))                 causes.push('TRICHOTILLOMANIA');
  if (s.hormonal('Menopause') || s.hormonal('Peri-menopause') ||
      s.hormonal('Post-menopause') || s.hormonal('Endometriosis'))         causes.push('HORMONAL_SHIFT');
  // Locked clinical rule (2026-06-15): Dandruff / Oily scalp DOES NOT imply DHT.
  // Those are scalp-inflammation markers and are surfaced via SCALP_INFLAMMATION
  // in the narrative engine. Attributing inherited / androgen-driven hair loss
  // to a patient who only reported dandruff is clinically incorrect and breaks
  // the patient-signals-only narrative rule (see feedback-narrative-patient-
  // signals-only). DHT root cause now derives only from explicit Genetics /
  // Family history selection, which is already covered by the GENETICS push
  // above.

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

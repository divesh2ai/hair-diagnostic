/**
 * ClinicalFacts — the single source of truth for what the patient actually
 * reported vs. what the clinical engine inferred. Every narrative sentence
 * must be groundable in this object; nothing else is admissible evidence.
 *
 * Separates Rule 5 ("reported findings" vs "clinical inference") at the type
 * level so downstream composers and the evidence-grounding validator cannot
 * accidentally treat an inference as a reported symptom.
 */

import type { ScalpState, RootCause, DiagnosisKey, Severity } from '../../types';

// ── What the patient explicitly reported ───────────────────────────────────

export interface ReportedFindings {
  /** Non-normal scalp signals the patient selected. NORMAL_SCALP → []. */
  readonly scalpStates: readonly ScalpState[];
  /** True only if the patient selected NORMAL_SCALP (or scalp is empty
   *  with no other non-normal selection). */
  readonly hasNormalScalp: boolean;

  /** True if the patient reported stress / high-stress lifestyle. */
  readonly hasStress: boolean;
  /** True if patient reported PCOS (medical history). */
  readonly hasPCOS: boolean;
  /** True if patient reported a thyroid history (hypo or hyper). */
  readonly hasThyroidHistory: boolean;
  /** True if patient reported diabetes / prediabetes / insulin resistance. */
  readonly hasMetabolicHistory: boolean;
  /** True if patient reported heavy bleeding / iron-loss risk. */
  readonly hasIronRisk: boolean;
  /** True if patient reported postpartum / breastfeeding state. */
  readonly hasPostpartum: boolean;
  /** True if patient reported a menopause / peri-menopause state. */
  readonly hasMenopauseState: boolean;
  /** True if patient reported GI symptoms (GERD, IBS, Crohn, etc.). */
  readonly hasGISymptoms: boolean;
  /** True if patient reported a recent illness, surgery, or medication trigger. */
  readonly hasRecentIllness: boolean;
  /** True if patient is on GLP-1 weight-loss medication. */
  readonly hasGLP1: boolean;
  /** True if patient reported rapid weight loss / crash diet. */
  readonly hasRapidWeightLoss: boolean;
  /** True if patient reported night-shift / frequent flying / sleep disruption. */
  readonly hasCircadianDisruption: boolean;
  /** True if patient reported smoking / alcohol / heavy environmental load. */
  readonly hasOxidativeLoad: boolean;
  /** True if patient reported family history / genetic pattern. */
  readonly hasFamilyHistory: boolean;
  /** True if patient reported a pulling behaviour (trichotillomania). */
  readonly hasPullingBehaviour: boolean;
  /** True if patient reported an autoimmune / immune-sensitive picture. */
  readonly hasAutoimmune: boolean;

  /** Dietary status. NORMAL means a balanced omnivore diet — never imply
   *  nutritional deficiency from this state. */
  readonly diet: 'NORMAL' | 'VEGETARIAN' | 'VEGAN' | 'PESCATARIAN' | 'JAIN' | 'IRREGULAR' | 'UNKNOWN';

  /** Whether the patient reported active visible shedding. */
  readonly hasActiveShedding: boolean;

  /** Biological sex as reported. Used by contradiction rules to block
   *  female-only / male-only language reaching the wrong patient. */
  readonly sex: 'MALE' | 'FEMALE' | 'UNKNOWN';
  /** True if patient indicated current pregnancy. Blocks contraindicated
   *  therapy mentions in the narrative. */
  readonly isPregnant: boolean;
  /** True if patient indicated they are planning pregnancy. */
  readonly isPlanningPregnancy: boolean;
}

// ── What the engine inferred (NOT reported by the patient) ─────────────────

export interface ClinicalInferences {
  /** Root causes the engine inferred from signals + scoring. */
  readonly rootCauses: readonly RootCause[];
  /** Primary diagnosis the engine reached. */
  readonly primaryDiagnosis: DiagnosisKey;
  /** Diagnosis severity (engine grading). */
  readonly severity: Severity;
}

// ── Composite facts object ─────────────────────────────────────────────────

export interface ClinicalFacts {
  readonly reported: ReportedFindings;
  readonly inferred: ClinicalInferences;
}

// ── Evidence keys used by Fragment.requiredFindings and the validator ──────
//
// A fragment / paragraph that claims one of these things is true must check
// the matching key on ClinicalFacts. Keep this list in sync with the
// FragmentConditionKey union and the validator's banned-term table.

export type FactKey =
  // Scalp
  | 'scalp.dandruff'
  | 'scalp.oily'
  | 'scalp.dry'
  | 'scalp.inflamed'
  | 'scalp.psoriatic'
  | 'scalp.sensitive'
  | 'scalp.anyNonNormal'
  | 'scalp.normal'
  // Lifestyle / history
  | 'history.stress'
  | 'history.pcos'
  | 'history.thyroid'
  | 'history.metabolic'
  | 'history.ironRisk'
  | 'history.postpartum'
  | 'history.menopause'
  | 'history.gi'
  | 'history.illness'
  | 'history.glp1'
  | 'history.weightLoss'
  | 'history.circadian'
  | 'history.oxidative'
  | 'history.family'
  | 'history.pulling'
  | 'history.autoimmune'
  // Diet
  | 'diet.normal'
  | 'diet.restricted'
  // Demographics
  | 'sex.male'
  | 'sex.female'
  | 'state.pregnant'
  | 'state.planningPregnancy'
  // Inferred drivers (use cautiously — these are NOT reported findings)
  | 'inferred.dhtDriver'
  | 'inferred.stressDriver'
  | 'inferred.nutritionDriver'
  | 'inferred.activeShedding';

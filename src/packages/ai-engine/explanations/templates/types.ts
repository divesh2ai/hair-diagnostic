// ─────────────────────────────────────────────────────────────────────────────
// Template Layer Types
//
// Defines the fragment-based sentence architecture used by all template files.
// Fragments are selected deterministically (no randomness) using a patient-
// derived seed, enabling variation across patients while remaining reproducible.
// ─────────────────────────────────────────────────────────────────────────────

import type { Severity } from '../../../types';

// ─── Fragment condition keys — map to ClinicalProfile.flags booleans ─────────

export type FragmentConditionKey =
  | 'always'              // always included when section is rendered
  | 'isGrade45'           // advanced-grade pattern loss
  | 'isGrade123'          // early-to-moderate grade
  | 'isMale'
  | 'isFemale'
  | 'isPregnant'
  | 'isVeg'               // vegetarian / vegan diet
  | 'hasGLP1Early'        // active GLP-1 early phase
  | 'hasGLP1Late'         // GLP-1 late / post-loss phase
  | 'hasGreyGoal'         // premature greying concern
  | 'hasActiveShedding'   // confirmed active telogen shedding
  | 'hasNoVisibleFall'    // miniaturisation only, no shedding
  | 'hasSecondaryDx'      // one or more secondary diagnoses present
  | 'severityMild'
  | 'severityModerate'
  | 'severitySevere';

/** Runtime condition map built from ClinicalProfile by _fragmentUtils */
export type FragmentConditions = Partial<Record<FragmentConditionKey, boolean>>;

// ─── Core fragment ────────────────────────────────────────────────────────────

/**
 * A single narrative unit: a sentence or clause.
 *
 * `variants` — two or more phrasings of the same idea.
 *   - Index is chosen deterministically from the patient seed so the same
 *     patient always sees the same text, but different patients see different
 *     variants — preventing the narrative from looking mass-produced.
 *
 * `condition` — gate key; fragment is omitted when condition is false/absent.
 *   Omit or use 'always' for unconditional inclusion.
 *
 * `priority` — 0–10 (default 5). Higher-priority fragments survive truncation
 *   when the requested NarrativeLength restricts output size.
 */
export interface Fragment {
  readonly variants: readonly string[];
  readonly condition?: FragmentConditionKey;
  readonly priority?: number;
}

// ─── Clinical category — maps DiagnosisKey groups to template files ───────────

export type ClinicalCategory =
  | 'aga'
  | 'te'
  | 'pcos'
  | 'thyroid'
  | 'inflammation'
  | 'aa'
  | 'multifactorial';

// ─── Complete clinical template shape ────────────────────────────────────────

export interface ClinicalTemplate {
  readonly category: ClinicalCategory;
  readonly audience: 'doctor' | 'patient';
  readonly sections: Readonly<{
    opening:    readonly Fragment[];
    mechanism:  readonly Fragment[];
    severity: Readonly<{
      mild:     readonly Fragment[];
      moderate: readonly Fragment[];
      severe:   readonly Fragment[];
    }>;
    treatment:  readonly Fragment[];
    prognosis:  readonly Fragment[];
    closing?:   readonly Fragment[];
  }>;
}

// ─── Prognosis template ───────────────────────────────────────────────────────

export type PrognosisStage = 'early' | 'moderate' | 'advanced';

export interface PrognosisTemplate {
  readonly stage: PrognosisStage;
  readonly timeline:    readonly Fragment[];
  readonly probability: readonly Fragment[];
  readonly caveats:     readonly Fragment[];
  readonly recovery:    readonly Fragment[];
}

// ─── Therapy template ─────────────────────────────────────────────────────────

export type TherapyTemplateKey = 'minoxidil' | 'peptides' | 'antiInflammatory' | 'metabolic';

export interface TherapyTemplate {
  readonly therapyKey: TherapyTemplateKey;
  readonly mechanism:        readonly Fragment[];
  readonly expectedOutcomes: readonly Fragment[];
  readonly usage:            readonly Fragment[];
  readonly caution:          readonly Fragment[];
}

// ─── Lifestyle template ───────────────────────────────────────────────────────

export type LifestyleTemplateKey = 'stress' | 'sleep' | 'nutrition' | 'exercise';

export interface LifestyleTemplate {
  readonly factorKey:      LifestyleTemplateKey;
  readonly impact:         readonly Fragment[];
  readonly recommendation: readonly Fragment[];
  readonly timeframe:      readonly Fragment[];
}

// ─── Assembled section output ─────────────────────────────────────────────────

export interface AssembledSection {
  readonly key: string;
  readonly text: string;
  readonly fragmentCount: number;
}

// ─── Severity to stage mapping ────────────────────────────────────────────────

export const SEVERITY_TO_STAGE: Record<Severity, PrognosisStage> = {
  MILD:     'early',
  MODERATE: 'moderate',
  SEVERE:   'advanced',
};

// ─── DiagnosisKey → ClinicalCategory mapping ─────────────────────────────────

import type { DiagnosisKey } from '../../../types';

export const DIAGNOSIS_CATEGORY_MAP: Record<DiagnosisKey, ClinicalCategory> = {
  AGA_MALE_123:     'aga',
  AGA_MALE_45:      'aga',
  AGA_FEMALE_123:   'aga',
  AGA_FEMALE_45:    'aga',
  TE_STRESS:        'te',
  TE_NUTRITION:     'te',
  TE_POSTPREG:      'te',
  TE_DELIVERY:      'te',
  TE_ILLNESS:       'te',
  THYROID_HYPO:     'thyroid',
  THYROID_HYPER:    'thyroid',
  PCOS_ONLY:        'pcos',
  PCOS_OBESITY:     'pcos',
  PERI_MENOPAUSE:   'pcos',
  MENOPAUSE:        'pcos',
  POST_MENOPAUSE:   'pcos',
  ENDOMETRIOSIS:    'pcos',
  IRON_DEFICIENCY:  'te',
  ALOPECIA_AREATA:  'aa',
  PREGNANCY:        'te',
  WEIGHT_LOSS:      'te',
  GUT_ISSUES:       'inflammation',
  SCALP_INFLAM:     'inflammation',
  HAIR_BREAKAGE:    'inflammation',
  OXIDATIVE:        'inflammation',
  NIGHT_SHIFT:      'te',
  FREQUENT_FLYING:  'te',
  DIABETES:         'pcos',
  CHRONIC_MEDICAL:  'te',
  TTM:              'te',
  EARLY_GREY:       'inflammation',
  MOUTH_ULCERS:     'inflammation',
  MULTI:            'multifactorial',
  REGROW_ONLY:      'te',
};

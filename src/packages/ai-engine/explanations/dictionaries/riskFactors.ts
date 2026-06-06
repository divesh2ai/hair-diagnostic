import type { ScalpStateDictionary, RiskFactorDictionary } from '../types';

// ─── Scalp state explanations (all 7 ScalpState variants) ────────────────────

export const SCALP_STATE_EXPLANATIONS: ScalpStateDictionary = {

  OILY_SCALP: {
    clinical:
      'Seborrhoea: excess sebum creates an anaerobic microenvironment promoting Malassezia furfur overgrowth and NF-kB-mediated perifollicular inflammation that impedes anagen initiation.',
    patient:
      'An oily scalp creates the conditions for inflammation that can block healthy hair growth and accelerate shedding.',
    severity: 'moderate',
    category: 'scalp',
  },

  DRY_SCALP: {
    clinical:
      'Xerotic scalp with impaired stratum corneum barrier function. Compromised epidermal integrity increases follicular sensitivity to environmental irritants and inflammatory triggers.',
    patient:
      'A dry scalp indicates a weakened skin barrier that can make the scalp reactive and affect overall follicle health.',
    severity: 'low',
    category: 'scalp',
  },

  DANDRUFF: {
    clinical:
      'Seborrhoeic dermatitis/pityriasis capitis. Malassezia-driven inflammatory desquamation generates IL-1α and TNF-α in the perifollicular space, creating an inhibitory follicular microenvironment.',
    patient:
      'Dandruff involves scalp inflammation at the follicle level that creates an unfavourable environment for healthy hair growth.',
    severity: 'moderate',
    category: 'scalp',
  },

  INFLAMED_SCALP: {
    clinical:
      'Diffuse scalp inflammation. Elevated IL-1α, TNF-α, and NF-kB activation in the perifollicular space directly inhibits anagen phase initiation and reduces follicular cycling efficiency.',
    patient:
      'Your scalp is actively inflamed, which is one of the primary barriers preventing healthy new hair from growing.',
    severity: 'high',
    category: 'scalp',
  },

  PSORIATIC_SCALP: {
    clinical:
      'Scalp psoriasis. T-helper-17-driven keratinocyte hyperproliferation and follicular ostia occlusion impairs normal follicular cycling and creates significant perifollicular inflammatory load.',
    patient:
      'Scalp psoriasis creates a particularly challenging environment for follicle health. Treating the scalp condition itself is an essential prerequisite to addressing hair loss.',
    severity: 'high',
    category: 'scalp',
  },

  SENSITIVE_SCALP: {
    clinical:
      'Neurogenic scalp sensitisation. Elevated substance P and CGRP release in response to environmental triggers drives low-grade, recurring perifollicular neurogenic inflammation.',
    patient:
      'A sensitive scalp reacts easily to triggers such as products, temperature, or stress, creating recurring inflammation that can affect follicle health over time.',
    severity: 'low',
    category: 'scalp',
  },

  NORMAL_SCALP: {
    clinical:
      'Scalp homeostasis intact. No clinically significant perifollicular inflammatory load or barrier dysfunction identified at this time.',
    patient:
      'Your scalp condition is healthy, which provides a strong foundation for your treatment programme to be effective.',
    severity: 'low',
    category: 'scalp',
  },
};

// ─── General risk factor explanations ────────────────────────────────────────

export const RISK_FACTOR_EXPLANATIONS: RiskFactorDictionary = {

  grade_45: {
    clinical:
      'Advanced hair loss grade (HN IV–V / Ludwig IV–V). Prolonged androgen exposure and reduced viable follicular reserve lower probability of full density reversal; stabilisation is a realistic primary goal.',
    patient:
      'Your hair loss is at an advanced stage, which means a more intensive and longer-term protocol is needed, with realistic expectations around recovery timeline.',
    severity: 'high',
    category: 'grade',
  },

  long_duration: {
    clinical:
      'Hair loss duration exceeding 2 years. Prolonged follicular miniaturisation and extended telogen dwell reduces anagen re-entry probability; some follicles may be permanently involuted.',
    patient:
      'A longer duration of hair loss means some follicles may have been dormant for a while, requiring more time and persistence to respond to treatment.',
    severity: 'moderate',
    category: 'duration',
  },

  age_over_50: {
    clinical:
      'Age >50. Declining anagen phase efficiency, reduced follicular stem cell reserve, impaired Wnt signalling, and accumulated oxidative follicular damage collectively reduce treatment response velocity.',
    patient:
      'Age-related changes affect how quickly follicles respond to treatment, but a targeted protocol can still produce meaningful and lasting improvement.',
    severity: 'moderate',
    category: 'age',
  },

  hypertension: {
    clinical:
      'Hypertension. Limits use of vasodilatory topicals and oral minoxidil at higher doses; requires careful contraindication screening of all topical and oral prescriptions in the protocol.',
    patient:
      'Your blood pressure condition means some treatments need to be carefully selected or adjusted to make sure they are fully safe for you.',
    severity: 'moderate',
    category: 'comorbidity',
  },

  multiple_secondary_diagnoses: {
    clinical:
      'Multi-morbidity: two or more concurrent active secondary diagnoses increase protocol complexity and require precise prioritisation of therapy needs to avoid ingredient overlap and patient burden.',
    patient:
      'Multiple contributing factors are present, which is why a layered, systematic protocol — rather than a single solution — gives the most complete result.',
    severity: 'high',
    category: 'complexity',
  },

  active_pregnancy_planning: {
    clinical:
      'Active pregnancy planning. Significant contraindication overlap with standard androgenic and stimulatory compounds; protocol must prioritise safety over efficacy in all prescribing decisions.',
    patient:
      'Because you are planning to become pregnant, your treatment is specifically designed around safety to ensure no risk when the time comes.',
    severity: 'high',
    category: 'special',
  },

  young_female_aga: {
    clinical:
      'Female <30 with AGA presentation. Absolute block on FPHL/FPHL_PLUS compounds; preferred protocol uses TE GOLD and PRO IMMUNE to stabilise without hormonal suppression.',
    patient:
      'At your age, we use a gentler, targeted approach to address your hair concerns without using more aggressive hormonal compounds.',
    severity: 'moderate',
    category: 'age',
  },

  glp1_active: {
    clinical:
      'Active GLP-1 agonist use. Rapid weight loss phase elevates nutritional TE risk significantly; protocol requires weight-loss-specific shedding shield as Phase 1 intervention.',
    patient:
      'Being on GLP-1 medication means your treatment starts with a specific protective shield for your hair follicles during the weight loss phase.',
    severity: 'high',
    category: 'iatrogenic',
  },

  thyroid_comorbidity: {
    clinical:
      'Thyroid disorder co-existing with a second primary condition. Thyroid always scores highest (100) and takes clinical precedence — protocol must address thyroid metabolic correction before other drivers.',
    patient:
      'Your thyroid condition takes priority in the treatment sequence because it directly affects the efficiency of every other therapeutic step.',
    severity: 'high',
    category: 'comorbidity',
  },
};

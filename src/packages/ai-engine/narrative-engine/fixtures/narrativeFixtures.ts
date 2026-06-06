import type { PatientAnswers } from '../../../types';
import type { ClinicalProfile } from '../../clinical-engine/types';
import type { TherapyNeeds } from '../../therapy-engine/types';
import type { KitRecommendation } from '../../kit-scorer/types';
import type { NarrativeResult } from '../../explanations/types';
import type { NarrativePipelineInput } from '../types';

// ─── Shared Mock Explanation Result ──────────────────────────────────────────

const mockExplanationResult: NarrativeResult = {
  doctorSummary: 'Clinical assessment completed. Multimodal protocol initiated.',
  patientSummary: 'Your personalised hair treatment plan is ready.',
  narrative: 'Full narrative text.',
  length: 'medium',
};

// ─── Female AGA Grade 1–3 ─────────────────────────────────────────────────────

export const FIXTURE_FEMALE_AGA_MILD: NarrativePipelineInput = {
  patient: {
    name: 'Sarah',
    sex: 'female',
    age: 34,
    goal: 'regrow',
    duration: '8 months',
    grade: '2',
    count: '80',
    scalp: ['OILY_SCALP'],
    cause: ['STRESS', 'GENETICS'],
    lifestyle: ['HIGH_STRESS'],
    deficiency: ['IRON'],
    diet: ['VEG'],
  } as PatientAnswers,

  clinicalProfile: {
    primaryDiagnosis: 'AGA_FEMALE_123',
    primaryScore: 78,
    secondaryDiagnoses: [{ key: 'TE_STRESS', score: 52, isPrimary: false }],
    allScores: { AGA_FEMALE_123: 78, TE_STRESS: 52 },
    scalpStates: ['OILY_SCALP'],
    rootCauses: ['DHT', 'STRESS', 'GENETICS'],
    severity: 'MILD',
    flags: {
      isRegrowGoal: true, hasGreyGoal: false, hasHairGoal: true,
      isVeg: true, isMale: false, isPregnant: false,
      isGrade45: false, isGrade123: true,
      hasActiveShedding: true, hasNoVisibleFall: false,
      hasGLP1Early: false, hasGLP1Late: false,
      age: 34, goal: 'regrow', grade: '2', count: '80', duration: '8 months',
    },
  } as ClinicalProfile,

  therapyPlan: {
    needs: ['DHT_SUPPRESSION', 'FOLLICLE_STIMULATION', 'SHEDDING_ARREST', 'IRON_REPLETION', 'INFLAMMATION_CONTROL'],
    needReasons: {
      DHT_SUPPRESSION: ['Androgenetic pattern with DHT sensitivity confirmed'],
      FOLLICLE_STIMULATION: ['Grade 1–3 presentation — follicles still responsive'],
      SHEDDING_ARREST: ['Active shedding at time of assessment'],
      IRON_REPLETION: ['Iron deficiency identified as co-trigger'],
      INFLAMMATION_CONTROL: ['Oily scalp condition noted'],
    },
  } as TherapyNeeds,

  kitRecommendation: {
    rankedKits: [
      {
        kitId: 'AGA_CORE_FEMALE',
        score: 88,
        matchedNeeds: ['DHT_SUPPRESSION', 'FOLLICLE_STIMULATION', 'SHEDDING_ARREST'],
        reasons: ['Primary AGA female kit matched to Grade 1–3 presentation'],
        phase: 1,
      },
      {
        kitId: 'NUTRITIONAL_SUPPORT',
        score: 70,
        matchedNeeds: ['IRON_REPLETION'],
        reasons: ['Iron deficiency nutritional support'],
        phase: 2,
      },
    ],
    protocolLabel: 'Female AGA Foundation Protocol',
    protocolRationale: 'Evidence-based multimodal approach for FPHL Grade 1–3 with nutritional co-management.',
    selectionJustification: 'DHT suppression + follicle stimulation + nutritional correction.',
    appliedRules: ['AGA_FEMALE_PRIMARY', 'IRON_REPLETION_ADDON'],
    ruleTrace: [],
  } as KitRecommendation,

  explanationResult: mockExplanationResult,
  narrativeLength: 'medium',
  includeAvatarScript: false,
  includeWhatsAppSummary: false,
};

// ─── Male AGA Grade 4–5 ──────────────────────────────────────────────────────

export const FIXTURE_MALE_AGA_SEVERE: NarrativePipelineInput = {
  patient: {
    name: 'James',
    sex: 'male',
    age: 42,
    goal: 'regrow',
    duration: '5 years',
    grade: '4',
    count: '150',
    scalp: ['NORMAL_SCALP'],
    cause: ['GENETICS', 'DHT'],
    lifestyle: [],
  } as PatientAnswers,

  clinicalProfile: {
    primaryDiagnosis: 'AGA_MALE_45',
    primaryScore: 85,
    secondaryDiagnoses: [],
    allScores: { AGA_MALE_45: 85 },
    scalpStates: ['NORMAL_SCALP'],
    rootCauses: ['DHT', 'GENETICS'],
    severity: 'SEVERE',
    flags: {
      isRegrowGoal: true, hasGreyGoal: false, hasHairGoal: true,
      isVeg: false, isMale: true, isPregnant: false,
      isGrade45: true, isGrade123: false,
      hasActiveShedding: true, hasNoVisibleFall: false,
      hasGLP1Early: false, hasGLP1Late: false,
      age: 42, goal: 'regrow', grade: '4', count: '150', duration: '5 years',
    },
  } as ClinicalProfile,

  therapyPlan: {
    needs: ['DHT_SUPPRESSION', 'FOLLICLE_STIMULATION', 'SHEDDING_ARREST'],
    needReasons: {
      DHT_SUPPRESSION: ['Advanced androgenetic alopecia — DHT blockade is first-line'],
      FOLLICLE_STIMULATION: ['Remaining follicles require maximal stimulation'],
      SHEDDING_ARREST: ['Preventing further progressive loss is priority 1'],
    },
  } as TherapyNeeds,

  kitRecommendation: {
    rankedKits: [
      {
        kitId: 'AGA_CORE_MALE',
        score: 95,
        matchedNeeds: ['DHT_SUPPRESSION', 'FOLLICLE_STIMULATION', 'SHEDDING_ARREST'],
        reasons: ['Grade 4–5 male AGA — maximal protocol'],
        phase: 1,
      },
    ],
    protocolLabel: 'Male AGA Advanced Protocol',
    protocolRationale: 'Dual 5α-reductase blockade combined with maximal follicle stimulation for Grade 4–5.',
    selectionJustification: 'Dutasteride preferred over finasteride at Grade 4–5 for broader DHT suppression.',
    appliedRules: ['AGA_MALE_ADVANCED', 'GRADE45_ESCALATION'],
    ruleTrace: [],
  } as KitRecommendation,

  explanationResult: mockExplanationResult,
  narrativeLength: 'detailed',
  includeAvatarScript: true,
  includeWhatsAppSummary: true,
};

// ─── PCOS-Related Hair Loss ───────────────────────────────────────────────────

export const FIXTURE_PCOS: NarrativePipelineInput = {
  patient: {
    name: 'Priya',
    sex: 'female',
    age: 28,
    goal: 'regrow',
    duration: '18 months',
    grade: '2',
    count: '100',
    scalp: ['OILY_SCALP', 'INFLAMED_SCALP'],
    cause: ['PCOS', 'HORMONAL'],
    hormonal: ['PCOS'],
    lifestyle: ['HIGH_STRESS'],
    deficiency: [],
  } as PatientAnswers,

  clinicalProfile: {
    primaryDiagnosis: 'PCOS_ONLY',
    primaryScore: 82,
    secondaryDiagnoses: [{ key: 'AGA_FEMALE_123', score: 61, isPrimary: false }],
    allScores: { PCOS_ONLY: 82, AGA_FEMALE_123: 61 },
    scalpStates: ['OILY_SCALP', 'INFLAMED_SCALP'],
    rootCauses: ['PCOS', 'DHT', 'HORMONAL_SHIFT', 'STRESS'],
    severity: 'MODERATE',
    flags: {
      isRegrowGoal: true, hasGreyGoal: false, hasHairGoal: true,
      isVeg: false, isMale: false, isPregnant: false,
      isGrade45: false, isGrade123: true,
      hasActiveShedding: true, hasNoVisibleFall: false,
      hasGLP1Early: false, hasGLP1Late: false,
      age: 28, goal: 'regrow', grade: '2', count: '100', duration: '18 months',
    },
  } as ClinicalProfile,

  therapyPlan: {
    needs: ['HORMONAL_REBALANCING', 'DHT_SUPPRESSION', 'INFLAMMATION_CONTROL', 'FOLLICLE_STIMULATION'],
    needReasons: {
      HORMONAL_REBALANCING: ['PCOS-driven androgen excess identified'],
      DHT_SUPPRESSION: ['Elevated androgen conversion to DHT at follicle level'],
      INFLAMMATION_CONTROL: ['Inflamed and oily scalp confirmed'],
      FOLLICLE_STIMULATION: ['Follicle miniaturisation at reversible stage'],
    },
  } as TherapyNeeds,

  kitRecommendation: {
    rankedKits: [
      {
        kitId: 'PCOS_HAIR_KIT',
        score: 84,
        matchedNeeds: ['HORMONAL_REBALANCING', 'DHT_SUPPRESSION', 'FOLLICLE_STIMULATION'],
        reasons: ['PCOS-specific hormonal + follicle protocol'],
        phase: 1,
      },
      {
        kitId: 'SCALP_ANTI_INFLAM_KIT',
        score: 72,
        matchedNeeds: ['INFLAMMATION_CONTROL'],
        reasons: ['Oily, inflamed scalp requires dedicated scalp treatment'],
        phase: 1,
      },
    ],
    protocolLabel: 'PCOS Hair Protocol',
    protocolRationale: 'Hormonal rebalancing + anti-androgenic therapy + scalp condition management.',
    selectionJustification: 'PCOS diagnosis drives hormonal-first approach with concurrent topical care.',
    appliedRules: ['PCOS_PRIMARY', 'SCALP_ADDON'],
    ruleTrace: [],
  } as KitRecommendation,

  explanationResult: mockExplanationResult,
  narrativeLength: 'medium',
  includeAvatarScript: false,
  includeWhatsAppSummary: true,
};

// ─── Hypothyroid ──────────────────────────────────────────────────────────────

export const FIXTURE_HYPOTHYROID: NarrativePipelineInput = {
  patient: {
    name: 'Emma',
    sex: 'female',
    age: 45,
    goal: 'regrow',
    duration: '12 months',
    grade: '2',
    count: '120',
    thyroid: 'HYPO',
    scalp: ['DRY_SCALP'],
    cause: ['THYROID'],
    deficiency: ['IRON', 'VIT_D'],
  } as PatientAnswers,

  clinicalProfile: {
    primaryDiagnosis: 'THYROID_HYPO',
    primaryScore: 80,
    secondaryDiagnoses: [{ key: 'IRON_DEFICIENCY', score: 64, isPrimary: false }],
    allScores: { THYROID_HYPO: 80, IRON_DEFICIENCY: 64 },
    scalpStates: ['DRY_SCALP'],
    rootCauses: ['HYPOTHYROID', 'IRON_DEFICIENCY'],
    severity: 'MODERATE',
    flags: {
      isRegrowGoal: true, hasGreyGoal: false, hasHairGoal: true,
      isVeg: false, isMale: false, isPregnant: false,
      isGrade45: false, isGrade123: true,
      hasActiveShedding: true, hasNoVisibleFall: false,
      hasGLP1Early: false, hasGLP1Late: false,
      age: 45, goal: 'regrow', grade: '2', count: '120', duration: '12 months',
    },
  } as ClinicalProfile,

  therapyPlan: {
    needs: ['THYROID_SUPPORT', 'IRON_REPLETION', 'FOLLICLE_STIMULATION', 'SHEDDING_ARREST'],
    needReasons: {
      THYROID_SUPPORT: ['Hypothyroidism confirmed as primary driver'],
      IRON_REPLETION: ['Iron deficiency as co-driver'],
      FOLLICLE_STIMULATION: ['Follicles still in stimulatable stage'],
      SHEDDING_ARREST: ['Active shedding reducing patient confidence'],
    },
  } as TherapyNeeds,

  kitRecommendation: {
    rankedKits: [
      {
        kitId: 'THYROID_HAIR_KIT',
        score: 81,
        matchedNeeds: ['THYROID_SUPPORT', 'IRON_REPLETION', 'FOLLICLE_STIMULATION'],
        reasons: ['Thyroid + nutritional co-management kit'],
        phase: 1,
      },
    ],
    protocolLabel: 'Thyroid-Associated Hair Loss Protocol',
    protocolRationale: 'Thyroid cofactor support + iron repletion + topical stimulation.',
    selectionJustification: 'Thyroid-first approach — hair recovery contingent on thyroid normalisation.',
    appliedRules: ['THYROID_HYPO_PRIMARY'],
    ruleTrace: [],
  } as KitRecommendation,

  explanationResult: mockExplanationResult,
  narrativeLength: 'medium',
  includeAvatarScript: false,
  includeWhatsAppSummary: false,
};

// ─── Telogen Effluvium (Stress) ───────────────────────────────────────────────

export const FIXTURE_TE_STRESS: NarrativePipelineInput = {
  patient: {
    name: 'Aisha',
    sex: 'female',
    age: 31,
    goal: 'regrow',
    duration: '4 months',
    grade: '1',
    count: '200',
    cause: ['STRESS'],
    lifestyle: ['HIGH_STRESS', 'POOR_SLEEP'],
    scalp: ['NORMAL_SCALP'],
  } as PatientAnswers,

  clinicalProfile: {
    primaryDiagnosis: 'TE_STRESS',
    primaryScore: 76,
    secondaryDiagnoses: [],
    allScores: { TE_STRESS: 76 },
    scalpStates: ['NORMAL_SCALP'],
    rootCauses: ['STRESS'],
    severity: 'MODERATE',
    flags: {
      isRegrowGoal: true, hasGreyGoal: false, hasHairGoal: true,
      isVeg: false, isMale: false, isPregnant: false,
      isGrade45: false, isGrade123: false,
      hasActiveShedding: true, hasNoVisibleFall: false,
      hasGLP1Early: false, hasGLP1Late: false,
      age: 31, goal: 'regrow', grade: '1', count: '200', duration: '4 months',
    },
  } as ClinicalProfile,

  therapyPlan: {
    needs: ['SHEDDING_ARREST', 'FOLLICLE_STIMULATION', 'ANTIOXIDANT_SUPPORT'],
    needReasons: {
      SHEDDING_ARREST: ['High active shedding count — arrest is priority 1'],
      FOLLICLE_STIMULATION: ['Telogen-shifted follicles need re-entry stimulation'],
      ANTIOXIDANT_SUPPORT: ['Stress elevates oxidative load at follicles'],
    },
  } as TherapyNeeds,

  kitRecommendation: {
    rankedKits: [
      {
        kitId: 'TE_RECOVERY_KIT',
        score: 79,
        matchedNeeds: ['SHEDDING_ARREST', 'FOLLICLE_STIMULATION', 'ANTIOXIDANT_SUPPORT'],
        reasons: ['TE recovery protocol — reversible condition with good prognosis'],
        phase: 1,
      },
    ],
    protocolLabel: 'Stress TE Recovery Protocol',
    protocolRationale: 'Shedding arrest + follicle stimulation for stress-induced TE.',
    selectionJustification: 'TE is reversible — short-duration intensive protocol appropriate.',
    appliedRules: ['TE_STRESS_PRIMARY'],
    ruleTrace: [],
  } as KitRecommendation,

  explanationResult: mockExplanationResult,
  narrativeLength: 'short',
  includeAvatarScript: false,
  includeWhatsAppSummary: false,
};

// ─── Menopause ────────────────────────────────────────────────────────────────

export const FIXTURE_MENOPAUSE: NarrativePipelineInput = {
  patient: {
    name: 'Helen',
    sex: 'female',
    age: 54,
    goal: 'regrow',
    duration: '3 years',
    grade: '3',
    count: '100',
    hormonal: ['MENOPAUSE'],
    scalp: ['DRY_SCALP'],
    cause: ['HORMONAL'],
    deficiency: ['VIT_D'],
  } as PatientAnswers,

  clinicalProfile: {
    primaryDiagnosis: 'MENOPAUSE',
    primaryScore: 83,
    secondaryDiagnoses: [{ key: 'AGA_FEMALE_123', score: 67, isPrimary: false }],
    allScores: { MENOPAUSE: 83, AGA_FEMALE_123: 67 },
    scalpStates: ['DRY_SCALP'],
    rootCauses: ['HORMONAL_SHIFT', 'GENETICS'],
    severity: 'MODERATE',
    flags: {
      isRegrowGoal: true, hasGreyGoal: false, hasHairGoal: true,
      isVeg: false, isMale: false, isPregnant: false,
      isGrade45: false, isGrade123: true,
      hasActiveShedding: false, hasNoVisibleFall: false,
      hasGLP1Early: false, hasGLP1Late: false,
      age: 54, goal: 'regrow', grade: '3', count: '100', duration: '3 years',
    },
  } as ClinicalProfile,

  therapyPlan: {
    needs: ['HORMONAL_REBALANCING', 'FOLLICLE_STIMULATION', 'ANTIOXIDANT_SUPPORT'],
    needReasons: {
      HORMONAL_REBALANCING: ['Menopausal oestrogen decline confirmed'],
      FOLLICLE_STIMULATION: ['Progressive thinning — follicles still present'],
      ANTIOXIDANT_SUPPORT: ['Menopausal oxidative stress component'],
    },
  } as TherapyNeeds,

  kitRecommendation: {
    rankedKits: [
      {
        kitId: 'MENOPAUSE_HAIR_KIT',
        score: 85,
        matchedNeeds: ['HORMONAL_REBALANCING', 'FOLLICLE_STIMULATION', 'ANTIOXIDANT_SUPPORT'],
        reasons: ['Menopause-specific hormonal + topical kit'],
        phase: 1,
      },
    ],
    protocolLabel: 'Menopausal Hair Protocol',
    protocolRationale: 'Long-term maintenance protocol for menopausal alopecia — hormonal + follicle stimulation.',
    selectionJustification: 'Chronic condition requiring ongoing management — protocol designed for sustainability.',
    appliedRules: ['MENOPAUSE_PRIMARY'],
    ruleTrace: [],
  } as KitRecommendation,

  explanationResult: mockExplanationResult,
  narrativeLength: 'detailed',
  includeAvatarScript: true,
  includeWhatsAppSummary: true,
};

// ─── Mixed Pathology ──────────────────────────────────────────────────────────

export const FIXTURE_MIXED_PATHOLOGY: NarrativePipelineInput = {
  patient: {
    name: 'Maya',
    sex: 'female',
    age: 38,
    goal: 'regrow',
    duration: '2 years',
    grade: '3',
    count: '130',
    hormonal: ['PCOS'],
    thyroid: 'HYPO',
    scalp: ['OILY_SCALP', 'INFLAMED_SCALP'],
    cause: ['PCOS', 'THYROID', 'STRESS', 'GENETICS'],
    lifestyle: ['HIGH_STRESS'],
    deficiency: ['IRON', 'VIT_D'],
  } as PatientAnswers,

  clinicalProfile: {
    primaryDiagnosis: 'MULTI',
    primaryScore: 71,
    secondaryDiagnoses: [
      { key: 'PCOS_ONLY', score: 68, isPrimary: false },
      { key: 'THYROID_HYPO', score: 60, isPrimary: false },
    ],
    allScores: { MULTI: 71, PCOS_ONLY: 68, THYROID_HYPO: 60 },
    scalpStates: ['OILY_SCALP', 'INFLAMED_SCALP'],
    rootCauses: ['PCOS', 'HYPOTHYROID', 'STRESS', 'IRON_DEFICIENCY', 'DHT'],
    severity: 'SEVERE',
    flags: {
      isRegrowGoal: true, hasGreyGoal: false, hasHairGoal: true,
      isVeg: false, isMale: false, isPregnant: false,
      isGrade45: false, isGrade123: true,
      hasActiveShedding: true, hasNoVisibleFall: false,
      hasGLP1Early: false, hasGLP1Late: false,
      age: 38, goal: 'regrow', grade: '3', count: '130', duration: '2 years',
    },
  } as ClinicalProfile,

  therapyPlan: {
    needs: ['HORMONAL_REBALANCING', 'THYROID_SUPPORT', 'IRON_REPLETION', 'DHT_SUPPRESSION', 'INFLAMMATION_CONTROL', 'FOLLICLE_STIMULATION', 'SHEDDING_ARREST'],
    needReasons: {
      HORMONAL_REBALANCING: ['PCOS-driven androgen excess'],
      THYROID_SUPPORT: ['Hypothyroidism confirmed'],
      IRON_REPLETION: ['Iron deficiency identified'],
      DHT_SUPPRESSION: ['Androgenic component confirmed'],
      INFLAMMATION_CONTROL: ['Inflamed scalp confirmed'],
      FOLLICLE_STIMULATION: ['Follicles still viable'],
      SHEDDING_ARREST: ['Active shedding'],
    },
  } as TherapyNeeds,

  kitRecommendation: {
    rankedKits: [
      {
        kitId: 'MULTI_PATHOLOGY_KIT_1',
        score: 74,
        matchedNeeds: ['HORMONAL_REBALANCING', 'DHT_SUPPRESSION', 'FOLLICLE_STIMULATION'],
        reasons: ['Hormonal + androgenic component — Phase 1'],
        phase: 1,
      },
      {
        kitId: 'NUTRITIONAL_THYROID_KIT',
        score: 68,
        matchedNeeds: ['THYROID_SUPPORT', 'IRON_REPLETION'],
        reasons: ['Nutritional co-management — Phase 2'],
        phase: 2,
      },
      {
        kitId: 'SCALP_ANTI_INFLAM_KIT',
        score: 65,
        matchedNeeds: ['INFLAMMATION_CONTROL'],
        reasons: ['Scalp condition management'],
        phase: 1,
      },
    ],
    protocolLabel: 'Mixed Pathology Protocol',
    protocolRationale: 'Phased multi-modal protocol addressing hormonal, thyroid, nutritional, and topical needs.',
    selectionJustification: 'Complex multi-driver presentation requires layered sequential approach.',
    appliedRules: ['MULTI_PATHOLOGY_SEQUENCE'],
    ruleTrace: [],
  } as KitRecommendation,

  explanationResult: mockExplanationResult,
  narrativeLength: 'detailed',
  includeAvatarScript: false,
  includeWhatsAppSummary: false,
};

// ─── All Fixtures Map ─────────────────────────────────────────────────────────

export const ALL_FIXTURES = {
  FEMALE_AGA_MILD: FIXTURE_FEMALE_AGA_MILD,
  MALE_AGA_SEVERE: FIXTURE_MALE_AGA_SEVERE,
  PCOS: FIXTURE_PCOS,
  HYPOTHYROID: FIXTURE_HYPOTHYROID,
  TE_STRESS: FIXTURE_TE_STRESS,
  MENOPAUSE: FIXTURE_MENOPAUSE,
  MIXED_PATHOLOGY: FIXTURE_MIXED_PATHOLOGY,
} as const;

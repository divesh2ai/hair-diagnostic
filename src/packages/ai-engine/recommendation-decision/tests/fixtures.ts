// Synthetic questionnaire answer sets — the minimum PatientAnswers fields
// needed to trigger the specific clinical branches under test. No PII; every
// fixture is fabricated for regression purposes.
//
// Fixture assertions live in traceInvariants.test.ts. These fixtures do NOT
// pre-declare which discrepancies must appear — they exist to run the LIVE
// pipeline end-to-end and reveal the exact real behaviour.

import type { PatientAnswers } from '../../../types';

export interface DecisionFixture {
  readonly id: string;
  readonly label: string;
  readonly answers: PatientAnswers;
  readonly provenance: {
    readonly source: 'synthetic' | 'existing_regression' | 'anonymized_real_case';
    readonly expectedOutputSource: 'none' | 'accepted_baseline' | 'clinical_rule_reference';
    readonly intent: readonly ('trace_completeness' | 'safety' | 'ordering' | 'eligibility')[];
    readonly clinicalCorrectnessAsserted: boolean;
  };
}

export const FIXTURES: readonly DecisionFixture[] = [
  {
    id: 'aga-only',
    label: 'AGA only (male, grade 2, no shedding)',
    provenance: {
      source: 'synthetic',
      expectedOutputSource: 'none',
      intent: ['trace_completeness'],
      clinicalCorrectnessAsserted: false,
    },
    answers: {
      sex: 'Male',
      gender: 'Male',
      age: '28',
      goal: ['Reduce hair fall'],
      grade: 'Grade 2',
      count: 'Thinning',
      duration: '6-12 months',
      cause: ['Genetics', 'Family history'],
      scalp: [],
      immunity: [],
      lifestyle: [],
      hormonal: [],
      thyroid: [],
      deficiency: [],
      hairtype: ['widening parting'],
      diet: ['Non-vegetarian'],
      gut: [],
      treatment: [],
    },
  },

  {
    id: 'acute-te',
    label: 'Acute TE (female, 1-3 months, stress trigger)',
    provenance: {
      source: 'synthetic',
      expectedOutputSource: 'none',
      intent: ['trace_completeness'],
      clinicalCorrectnessAsserted: false,
    },
    answers: {
      sex: 'Female',
      gender: 'Female',
      age: '30',
      goal: ['Reduce hair fall'],
      grade: '',
      count: '100 strands per day',
      duration: '1-3 months',
      cause: ['Stress', 'Anxiety'],
      scalp: [],
      immunity: [],
      lifestyle: [],
      hormonal: [],
      thyroid: [],
      deficiency: [],
      hairtype: [],
      diet: ['Non-vegetarian'],
      gut: [],
      treatment: [],
    },
  },

  {
    id: 'chronic-shedding',
    label: 'Chronic shedding (female, > 6 months, no AGA)',
    provenance: {
      source: 'synthetic',
      expectedOutputSource: 'none',
      intent: ['trace_completeness'],
      clinicalCorrectnessAsserted: false,
    },
    answers: {
      sex: 'Female',
      gender: 'Female',
      age: '35',
      goal: ['Reduce hair fall'],
      grade: '',
      count: '100 strands per day',
      duration: '6-12 months',
      cause: ['Nutritional deficiency'],
      scalp: [],
      immunity: [],
      lifestyle: [],
      hormonal: [],
      thyroid: [],
      deficiency: ['Iron', 'Anaemia'],
      hairtype: [],
      diet: ['Non-vegetarian'],
      gut: [],
      treatment: [],
    },
  },

  {
    id: 'aga-plus-te',
    label: 'AGA + acute TE (male, grade 3, stress within 1-3 months)',
    provenance: {
      source: 'synthetic',
      expectedOutputSource: 'none',
      intent: ['trace_completeness'],
      clinicalCorrectnessAsserted: false,
    },
    answers: {
      sex: 'Male',
      gender: 'Male',
      age: '32',
      goal: ['Reduce hair fall'],
      grade: 'Grade 3',
      count: '100 strands per day',
      duration: '1-3 months',
      cause: ['Genetics', 'Family history', 'Stress', 'Anxiety'],
      scalp: [],
      immunity: [],
      lifestyle: [],
      hormonal: [],
      thyroid: [],
      deficiency: [],
      hairtype: ['crown thinning'],
      diet: ['Non-vegetarian'],
      gut: [],
      treatment: [],
    },
  },

  {
    id: 'pregnancy',
    label: 'Pregnancy (female, 32, currently pregnant)',
    provenance: {
      source: 'synthetic',
      expectedOutputSource: 'none',
      intent: ['trace_completeness'],
      clinicalCorrectnessAsserted: false,
    },
    answers: {
      sex: 'Female',
      gender: 'Female',
      age: '32',
      is_pregnant: true,
      goal: ['Reduce hair fall'],
      grade: '',
      count: '100 strands per day',
      duration: '3-6 months',
      cause: ['Currently pregnant'],
      scalp: [],
      immunity: [],
      lifestyle: [],
      hormonal: ['pregnancy'],
      thyroid: [],
      deficiency: [],
      hairtype: [],
      diet: ['Vegetarian'],
      gut: [],
      treatment: [],
    },
  },

  {
    id: 'thyroid-shedding',
    label: 'Hypothyroid + TE onset (female, 40)',
    provenance: {
      source: 'synthetic',
      expectedOutputSource: 'none',
      intent: ['trace_completeness'],
      clinicalCorrectnessAsserted: false,
    },
    answers: {
      sex: 'Female',
      gender: 'Female',
      age: '40',
      goal: ['Reduce hair fall'],
      grade: '',
      count: 'Noticeable',
      duration: '1-3 months',
      cause: ['Medication'],
      scalp: [],
      immunity: [],
      lifestyle: [],
      hormonal: [],
      thyroid: ['Hypothyroidism'],
      deficiency: [],
      hairtype: [],
      diet: ['Non-vegetarian'],
      gut: [],
      treatment: [],
    },
  },

  {
    id: 'hypertension',
    label: 'Hypertension / cardiac-risk (male, 62, grade 3)',
    provenance: {
      source: 'synthetic',
      expectedOutputSource: 'none',
      intent: ['trace_completeness'],
      clinicalCorrectnessAsserted: false,
    },
    answers: {
      sex: 'Male',
      gender: 'Male',
      age: '62',
      hasHypertension: true,
      goal: ['Reduce hair fall'],
      grade: 'Grade 3',
      count: 'Thinning',
      duration: '12+ months',
      cause: ['Genetics'],
      scalp: [],
      immunity: [],
      lifestyle: [],
      hormonal: [],
      thyroid: [],
      deficiency: [],
      hairtype: ['crown thinning'],
      diet: ['Non-vegetarian'],
      gut: [],
      treatment: [],
      medical_detail: 'On antihypertensive medication for blood pressure.',
    },
  },
];

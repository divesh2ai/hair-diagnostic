// Verification harness — runs Kavya & Ramya end-to-end via scoreKits and
// prints the resulting protocol order so we can confirm the ranking fixes.
import { scoreKits } from '../../src/packages/ai-engine/kit-scorer/scoreKits';
import { evaluateClinicalProfile } from '../../src/packages/ai-engine/clinical-engine/evaluateClinicalProfile';
import { mapTherapyNeeds } from '../../src/packages/ai-engine/therapy-engine/mapTherapyNeeds';
import type { PatientAnswers } from '../../src/packages/types';
import type { ClinicConfig } from '../../src/packages/ai-engine/kit-scorer/types';

const OPEN_CLINIC: ClinicConfig = { clinicId: 'verify', availableKits: [] };

function bare(overrides: Partial<PatientAnswers>): PatientAnswers {
  return {
    sex: 'Female', age: '35', grade: 'Grade 2',
    thyroid: [], hormonal: [], lifestyle: [], diet: [],
    cause: [], scalp: [], immunity: [], deficiency: [],
    gut: [], hairtype: [], treatment: [],
    goal: ['Reduce hair fall'],
    duration: '1–3 months', count: '50–100 strands',
    ...overrides,
  };
}

function run(label: string, ans: PatientAnswers) {
  const profile = evaluateClinicalProfile(ans);
  const needs   = mapTherapyNeeds(profile);
  const rec     = scoreKits(profile, needs, ans, OPEN_CLINIC, { tier: 'COMPREHENSIVE', maxKits: 7 });
  console.log(`\n── ${label} ──`);
  console.log('Conditions:', rec.selectionJustification.split('\n')[0]);
  rec.rankedKits.forEach((k) => console.log(`  Phase ${k.phase}: ${k.kitId}`));
  console.log('Rules:', rec.appliedRules);
}

describe('verify ranking fixes', () => {
  test('Kavya (POSTMENOPAUSE, scalp inflammation, acute shedding 1–3m)', () => {
    run('KAVYA', bare({
      sex: 'Female', age: '56',
      hormonal: ['Post Menopause'],
      lifestyle: ['Obesity', 'Sedentary', 'Poor Diet'],
      cause: ['Stress'],
      scalp: ['Dandruff'],
      duration: '1–3 months',
      goal: ['Regrow hair'],
    }));
  });

  test('Ramya (PCOS + Hypothyroid + Iron deficiency + Gut dysfunction)', () => {
    run('RAMYA', bare({
      sex: 'Female', age: '38', grade: 'Grade 4',
      hormonal: ['PCOS / PCOD only'],
      thyroid: ['Hypothyroidism'],
      deficiency: ['Iron / Ferritin deficiency'],
      gut: ['GERD'],
      lifestyle: ['Smoking', 'Alcohol', 'Poor Diet'],
      cause: ['Stress'],
      scalp: ['Severe inflammation'],
      duration: '6–12 months',
      goal: ['Regrow hair'],
    }));
  });

  test('Amit B (Male, 1–3m acute, frequent flying, smoking, alcohol, crash diet)', () => {
    run('AMIT B', bare({
      sex: 'Male', age: '49', grade: 'Grade 1',
      cause: ['Genetics / Family history', 'Rapid weight loss / Crash diet'],
      lifestyle: ['Smoking / Vaping', 'Alcohol (8–10×/month)', 'Bodybuilding / Heavy gym', 'Frequent flying'],
      scalp: ['Oily scalp', 'Redness or irritation', 'Dandruff'],
      diet: ['Vegetarian'],
      duration: '1–3 months',
      goal: ['Reduce hair fall and improve quality & growth'],
    }));
  });

  test('Post-menopause WITHOUT acute shedding → POSTMENO META B leads absolutely', () => {
    run('POSTMENO ONLY', bare({
      sex: 'Female', age: '56',
      hormonal: ['Post Menopause'],
      duration: '6–12 months',
      goal: ['Reduce hair fall'],
    }));
  });
});

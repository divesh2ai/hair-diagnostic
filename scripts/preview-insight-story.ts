/**
 * Preview the new Clinical Insight & Recovery Story for a handful of
 * representative patient fixtures.
 *
 * Run:
 *   npx tsx scripts/preview-insight-story.ts
 *   npx tsx scripts/preview-insight-story.ts pcos_only_dandruff_01 iron_deficiency_diffuse_01
 */

import { evaluateClinicalProfile } from '../src/packages/ai-engine/clinical-engine/evaluateClinicalProfile';
import { mapTherapyNeeds }         from '../src/packages/ai-engine/therapy-engine/mapTherapyNeeds';
import { scoreKits }               from '../src/packages/ai-engine/kit-scorer/scoreKits';
import { buildClinicalReport }     from '../src/packages/ai-engine/report-engine/buildClinicalReport';
import {
  loadAllFixtures,
  budgetForFixture,
  OPEN_CLINIC,
} from '../tests/fixtures/loader';

const DEFAULTS = [
  'female_aga_stress_01',
  'pcos_only_dandruff_01',
  'iron_deficiency_diffuse_01',
  'hypothyroid_peri_menopause_01',
  'gut_stress_shedding_01',
  'male_aga_grade45_01',
];

const requested = process.argv.slice(2);
const wanted = requested.length > 0 ? requested : DEFAULTS;

const all = loadAllFixtures();
const fixtures = wanted
  .map((id) => all.find((f) => f.id === id))
  .filter((f): f is NonNullable<typeof f> => Boolean(f));

if (fixtures.length === 0) {
  console.error('No matching fixtures. Available examples:');
  for (const f of all.slice(0, 10)) console.error(`  ${f.id}`);
  process.exit(1);
}

const HR = '─'.repeat(78);

for (const fixture of fixtures) {
  const profile = evaluateClinicalProfile(fixture.answers);
  const needs   = mapTherapyNeeds(profile);
  const budget  = budgetForFixture(fixture);
  const kits    = scoreKits(profile, needs, fixture.answers, OPEN_CLINIC, budget);
  const patient = {
    name: fixture.answers.name ?? 'Test Patient',
    age:  Number(fixture.answers.age) || 30,
    sex:  fixture.answers.sex,
  };
  const report = buildClinicalReport(patient, profile, needs, kits, fixture.answers);
  const story  = report.clinicalInsightStory;

  console.log(`\n${HR}`);
  console.log(`FIXTURE: ${fixture.id}`);
  console.log(`Diagnosis: ${profile.primaryDiagnosis}  |  Root causes: ${profile.rootCauses.join(', ') || '(none)'}`);
  console.log(`Active shedding: ${profile.flags?.hasActiveShedding ?? false}`);
  console.log(HR);

  console.log(`\nDrivers (${story.drivers.length}):`);
  for (const d of story.drivers) {
    console.log(`  • ${d.label}`);
    console.log(`      hair impact:  ${d.hairImpact}`);
    console.log(`      goal:         ${d.treatmentGoal}`);
    console.log(`      recognition:  ${d.recognitionCue}`);
  }
  console.log(`Treatment goals: ${story.treatmentGoals.join(' · ')}`);

  const wc = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

  console.log(`\n1. YOUR HAIR STORY  (${wc(story.yourHairStory)} words — target 40–60, weight 10%)`);
  console.log(story.yourHairStory);

  console.log(`\n2. WHAT WE FOUND  (${wc(story.whyThisMayBeHappening)} words — target 280–340, weight 65%)`);
  console.log(story.whyThisMayBeHappening);

  console.log(`\n3. YOUR RECOVERY PLAN  (${wc(story.whyThisPlanWasRecommended)} words — target 90–110, weight 20%)`);
  console.log(story.whyThisPlanWasRecommended);

  console.log(`\n4. WHAT RECOVERY COULD LOOK LIKE  (${wc(story.whatToExpect)} words — target 25–40, weight 5%)`);
  console.log(story.whatToExpect);
}

console.log(`\n${HR}\nPreviewed ${fixtures.length} fixture(s).\n`);

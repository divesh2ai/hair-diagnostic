import { evaluateClinicalProfile } from '../src/packages/ai-engine/clinical-engine/evaluateClinicalProfile.ts';
import { mapTherapyNeeds }         from '../src/packages/ai-engine/therapy-engine/mapTherapyNeeds.ts';
import { scoreKits }               from '../src/packages/ai-engine/kit-scorer/scoreKits.ts';

const answers = {
  sex: "Female",
  age: "26",
  grade: "Grade 3",
  goal: ["Reduce hair fall"],
  cause: ["Stress / Anxiety / Depression", "Genetics / Family history"],
  hairtype: ["Widening parting or thinning"],
  scalp: ["Oily scalp"],
  lifestyle: ["Obesity / Struggle to lose weight"],
  thyroid: [],
  hormonal: [],
  immunity: [],
  deficiency: [],
  gut: [],
  diet: [],
  treatment: [],
  duration: "6–12 months",
  count: "50–100 strands"
};

const profile = evaluateClinicalProfile(answers);
const needs = mapTherapyNeeds(profile);
const rec = scoreKits(profile, needs, answers, { availableKits: [], substitutions: {} }, undefined);

console.log("Diagnosis:", profile.primaryDiagnosis);
console.log("Root causes:", profile.rootCauses);
console.log("Scalp states:", profile.scalpStates);
console.log("\nKits:");
for (const k of rec.rankedKits) console.log(`  Phase ${k.phase}. ${k.kitId}`);
console.log("\nApplied rules:");
for (const r of rec.appliedRules) console.log("  -", r);

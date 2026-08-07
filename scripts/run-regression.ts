import * as fs from "fs";
import * as path from "path";
import { evaluateClinicalProfile } from "../src/packages/ai-engine/clinical-engine/evaluateClinicalProfile";
import { mapTherapyNeeds } from "../src/packages/ai-engine/therapy-engine/mapTherapyNeeds";
import { scoreKits } from "../src/packages/ai-engine/kit-scorer/scoreKits";
import { modularOutputFromClinical, compareAgainstBaseline } from "../src/sandbox/regression/comparisonEngine";
import { adaptLegacyFixture, listAllFixtureIds } from "../src/sandbox/loaders/fixtureAdapter";
import { budgetForFixture, OPEN_CLINIC } from "../src/sandbox/loaders/fixtureLoader";

const BASELINES_DIR = path.resolve(process.cwd(), "tests", "baselines");

async function main() {
  const ids = listAllFixtureIds();
  let passed = 0;
  let failed = 0;

  console.log(`Running regression check on ${ids.length} fixtures...`);

  for (const id of ids) {
    const fixture = adaptLegacyFixture(id);
    const answers = fixture.questionnaireAnswers;
    const profile = evaluateClinicalProfile(answers);
    const needs = mapTherapyNeeds(profile);
    const budget = budgetForFixture(fixture);
    
    // Trace OFF
    const rec = scoreKits(profile, needs, answers, OPEN_CLINIC, budget, { trace: false });
    const modular = modularOutputFromClinical(id, profile, rec);

    const baselinePath = path.join(BASELINES_DIR, `${id}.baseline.json`);
    if (!fs.existsSync(baselinePath)) {
      console.log(`[SKIP] No baseline for ${id}`);
      continue;
    }
    const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf-8"));
    
    const result = compareAgainstBaseline(modular, baseline);
    if (result.passed) {
      passed++;
    } else {
      failed++;
      console.log(`[FAIL] ${id}`);
      for (const d of result.drifts) {
        console.log(`  DRIFT [${d.severity}] ${d.field}: ${d.description}`);
      }
      for (const m of result.missingOutputs) {
        console.log(`  MISSING [${m.severity}] ${m.field}: ${m.description}`);
      }
    }
  }

  console.log(`\nPassed: ${passed}, Failed: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

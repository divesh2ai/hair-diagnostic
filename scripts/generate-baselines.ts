/**
 * Generate baseline snapshots for all patient fixtures.
 * Run: npx tsx scripts/generate-baselines.ts
 */
import * as fs from "fs";
import * as path from "path";
import { evaluateClinicalProfile } from "../src/packages/ai-engine/clinical-engine/evaluateClinicalProfile";
import { mapTherapyNeeds } from "../src/packages/ai-engine/therapy-engine/mapTherapyNeeds";
import { scoreKits } from "../src/packages/ai-engine/kit-scorer/scoreKits";
import { buildBaselineFromPipelineOutput, modularOutputFromClinical } from "../src/sandbox/regression/comparisonEngine";
import { adaptLegacyFixture, listAllFixtureIds } from "../src/sandbox/loaders/fixtureAdapter";
import { budgetForFixture, OPEN_CLINIC } from "../src/sandbox/loaders/fixtureLoader";
import { runAssessmentPipeline } from "../src/packages/orchestration/runAssessmentPipeline";

const BASELINES_DIR = path.resolve(process.cwd(), "tests", "baselines");

async function main() {
  if (!fs.existsSync(BASELINES_DIR)) fs.mkdirSync(BASELINES_DIR, { recursive: true });

  const ids = listAllFixtureIds();
  console.log(`Generating baselines for ${ids.length} fixtures...`);

  for (const id of ids) {
    const fixture = adaptLegacyFixture(id);
    const answers = fixture.questionnaireAnswers;
    const profile = evaluateClinicalProfile(answers);
    const needs = mapTherapyNeeds(profile);
    const budget = budgetForFixture(fixture);
    const rec = scoreKits(profile, needs, answers, OPEN_CLINIC, budget);
    const modular = modularOutputFromClinical(id, profile, rec);
    const baseline = buildBaselineFromPipelineOutput(id, modular);

    let pipelineMeta = {};
    try {
      const pipeline = await runAssessmentPipeline({ ...answers, legacyAnswers: answers });
      pipelineMeta = {
        narratives: {
          doctorHash: JSON.stringify(pipeline.narratives).slice(0, 64),
          patientHash: JSON.stringify(pipeline.narratives).slice(0, 64),
        },
        normalizedProfile: pipeline.questionnaire,
        orchestration: pipeline.runtime,
      };
    } catch (e) {
      pipelineMeta = { pipelineError: e instanceof Error ? e.message : String(e) };
    }

    const snapshot = {
      ...baseline,
      recommendations: modular.rankedKitIds,
      narratives: pipelineMeta,
      reportMetadata: { generatedBy: "generate-baselines.ts", version: "1.0.0" },
    };

    const outPath = path.join(BASELINES_DIR, `${id}.baseline.json`);
    fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
    console.log(`  ✓ ${id}`);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

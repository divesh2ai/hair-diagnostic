import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runAssessmentPipeline } from "../packages/orchestration/runAssessmentPipeline";
import { PipelineExecutionError } from "../packages/orchestration/errors";
import type { QuestionnaireSubmission } from "../packages/orchestration/types";

import { validatePipelineIntegrity } from "./validators/validatePipelineIntegrity";
import { renderClinicalView } from "./renderClinicalView";
import { renderTherapyView } from "./renderTherapyView";
import { renderRecommendationView } from "./renderRecommendationView";
import { renderNarrativeView } from "./renderNarrativeView";

const DEBUG_FULL_OUTPUT = false;

async function loadFixture(filename: string): Promise<QuestionnaireSubmission> {
  const fixturePath = resolve(process.cwd(), "tests", "fixtures", "patients", filename);
  try {
    const data = await readFile(fixturePath, "utf-8");
    return JSON.parse(data) as QuestionnaireSubmission;
  } catch (error) {
    throw new Error(`Failed to load fixture at ${fixturePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function executeSandbox() {
  const fixtureName = process.argv[2] || "female_aga_regrow_fphl_01.json";
  
  let submission: QuestionnaireSubmission;
  try {
    submission = await loadFixture(fixtureName);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  try {
    const result = await runAssessmentPipeline(submission);
    const report = validatePipelineIntegrity(result);

    console.log("========================================");
    console.log("SANDBOX EXECUTION");
    console.log("========================================");
    console.log("");
    console.log(`Fixture: ${fixtureName}`);
    console.log(`Execution ID: ${result.runtime.executionId}`);
    console.log(`Pipeline Version: ${result.runtime.pipelineVersion}`);
    console.log(`Duration: ${result.runtime.durationMs} ms`);
    console.log("");

    console.log("========================================");
    console.log("RUNTIME STAGES");
    console.log("========================================");
    console.log("");
    for (const stage of result.runtime.completedStages) {
      console.log(`- ${stage}`);
    }
    console.log("");

    renderClinicalView(result.clinical);
    renderTherapyView(result.therapy);
    renderRecommendationView(result.recommendations);
    renderNarrativeView(result.narratives);

    console.log("========================================");
    console.log("VALIDATION REPORT");
    console.log("========================================");
    console.log("");
    console.log(`Passed: ${report.passed ? "YES" : "NO"}`);
    console.log("");
    
    if (report.errors.length > 0) {
      console.log("ERRORS:");
      for (const err of report.errors) {
        console.log(`- [${err.stage.toUpperCase()}] ${err.code}: ${err.message}`);
      }
      console.log("");
    }
    
    if (report.warnings.length > 0) {
      console.log("WARNINGS:");
      for (const warn of report.warnings) {
        console.log(`- [${warn.stage.toUpperCase()}] ${warn.code}: ${warn.message}`);
      }
      console.log("");
    }

    if (DEBUG_FULL_OUTPUT) {
      console.log("========================================");
      console.log("DEEP INSPECTION MODE");
      console.log("========================================");
      console.dir(result, { depth: null });
    }

    process.exit(report.passed ? 0 : 1);
  } catch (error) {
    console.error("========================================");
    console.error("ORCHESTRATION FAILURE");
    console.error("========================================");

    if (error instanceof PipelineExecutionError) {
      console.error(`- Failed Stage: ${error.stage}`);
      console.error(`- Execution ID: ${error.executionId}`);
      console.error(`- Original Error:`);
      console.error(error.originalError);
    } else {
      console.error("- Unknown Error:");
      console.error(error);
    }

    console.error("========================================");
    process.exit(1);
  }
}

executeSandbox().catch((error) => {
  console.error("Unhandled sandbox exception:");
  console.error(error);
  process.exit(1);
});

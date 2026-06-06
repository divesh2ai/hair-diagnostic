import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runAssessmentPipeline } from "../src/packages/orchestration";
import { PipelineExecutionError } from "../src/packages/orchestration/errors";
import type { QuestionnaireSubmission } from "../src/packages/orchestration/types";

async function loadFixture(filename: string): Promise<QuestionnaireSubmission> {
  const fixturePath = resolve(process.cwd(), "tests", "fixtures", "patients", filename);
  try {
    const data = await readFile(fixturePath, "utf-8");
    return JSON.parse(data) as QuestionnaireSubmission;
  } catch (error) {
    throw new Error(`Failed to load fixture at ${fixturePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function verifyPipeline() {
  console.log("Starting pipeline execution verification...\n");

  let submission: QuestionnaireSubmission;
  try {
    submission = await loadFixture("female-aga.json");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  try {
    const result = await runAssessmentPipeline(submission);

    console.log("========================================");
    console.log("PIPELINE EXECUTION SUCCESS");
    console.log("========================================");
    console.log("");
    console.log(`Execution ID: ${result.runtime.executionId}`);
    console.log(`Duration: ${result.runtime.durationMs} ms`);
    console.log("");
    console.log("Completed Stages:");
    for (const stage of result.runtime.completedStages) {
      console.log(`- ${stage}`);
    }
    console.log("");
    console.log("Clinical Summary:");
    
    const conditions = result.clinical?.detectedConditions ?? [];
    console.log(`- Primary Condition: ${conditions.length > 0 ? conditions[0] : "None detected"}`);
    console.log(`- Severity: ${result.clinical?.severity ?? "Unknown"}`);
    console.log(`- Confidence: ${result.clinical?.confidence ?? "Unknown"}`);
    console.log("");
    
    console.log("Therapy Summary:");
    const protocols = result.therapy?.primaryProtocols ?? [];
    console.log(`- Protocol Count: ${protocols.length}`);
    console.log("");

    console.log("Recommendation Summary:");
    const recommendedKits = result.recommendations?.recommendedKits ?? [];
    const recommendedTopicals = result.recommendations?.recommendedTopicals ?? [];
    const recommendedSerums = result.recommendations?.recommendedSerums ?? [];
    const recommendedShampoos = result.recommendations?.recommendedShampoos ?? [];
    const totalProducts = recommendedTopicals.length + recommendedSerums.length + recommendedShampoos.length;
    console.log(`- Kit Count: ${recommendedKits.length}`);
    console.log(`- Product Count: ${totalProducts}`);
    console.log("");

    console.log("Narrative Summary:");
    console.log(`- Doctor Report: ${result.narratives?.doctorNarrative ? "YES" : "NO"}`);
    console.log(`- Patient Report: ${result.narratives?.patientNarrative ? "YES" : "NO"}`);
    console.log(`- PDF Payload: ${result.narratives?.pdfPayload ? "YES" : "NO"}`);
    console.log(`- WhatsApp Summary: ${result.narratives?.whatsappSummary ? "YES" : "NO"}`);
    console.log(`- Avatar Script: ${result.narratives?.avatarScript ? "YES" : "NO"}`);
    console.log("");
    console.log("========================================");
    
    process.exit(0);
  } catch (error) {
    console.error("========================================");
    console.error("PIPELINE EXECUTION FAILED");
    console.error("========================================");
    
    if (error instanceof PipelineExecutionError) {
      console.error(`\nFailed Stage: ${error.stage}`);
      console.error(`Execution ID: ${error.executionId}`);
      console.error(`Timestamp: ${error.timestamp}\n`);
      console.error("Original Error:");
      console.error(error.originalError);
    } else {
      console.error("\nUnknown Error:");
      console.error(error);
    }
    
    console.error("========================================");
    process.exit(1);
  }
}

verifyPipeline().catch((error) => {
  console.error("Unhandled process exception:");
  console.error(error);
  process.exit(1);
});

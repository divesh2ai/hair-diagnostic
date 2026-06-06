import { orchestrateAssessment } from "../src/packages/assessment-orchestrator";

async function main() {
  const assessmentId = "cmppd7mst0004892rfqqipxsx";
  console.log(`Running orchestrator for assessment: ${assessmentId}`);
  await orchestrateAssessment(assessmentId);
}

main().catch(console.error);

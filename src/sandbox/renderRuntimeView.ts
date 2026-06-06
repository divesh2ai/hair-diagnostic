import type { PipelineRuntimeMetadata } from "../../packages/orchestration/types";

export function renderRuntimeView(runtime: PipelineRuntimeMetadata): void {
  console.log("========================================");
  console.log("RUNTIME METADATA");
  console.log("========================================");
  
  console.log(`- Execution ID: ${runtime.executionId}`);
  console.log(`- Duration: ${runtime.durationMs} ms`);
  console.log(`- Completed Stages: ${runtime.completedStages.join(", ")}`);
  console.log(`- Pipeline Version: ${runtime.pipelineVersion}`);
  console.log("");
}

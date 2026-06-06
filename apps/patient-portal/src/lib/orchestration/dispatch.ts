import { orchestrateAssessment } from "@hairos/packages/assessment-orchestrator";

// Safe background dispatch — errors are fully isolated and never propagate
// to the HTTP request lifecycle. Structured logging on all outcomes.
export async function safeDispatchOrchestration(assessmentId: string): Promise<void> {
  console.log("[DISPATCH] START", { assessmentId });
  try {
    await orchestrateAssessment(assessmentId);
    console.log("[DISPATCH] COMPLETE", { assessmentId });
  } catch (err) {
    console.error("[DISPATCH] FATAL", {
      assessmentId,
      error: err instanceof Error ? err.message : String(err),
    });
    // Never rethrow — this runs inside after() and must not surface to the patient.
  }
}

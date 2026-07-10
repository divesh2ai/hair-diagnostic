import {
  runAssessmentPhaseA,
  runAssessmentPhaseB,
  PhaseAAlreadyRunningError,
} from "@hairos/packages/assessment-orchestrator";

/**
 * Canonical background dispatch used by both patient-submit and the
 * orchestrate API. Callers MUST wrap this in `after()` (or await it) — never
 * schedule it as a detached `void` promise, because on Vercel serverless the
 * lambda freezes as soon as the response returns and the run is silently
 * abandoned.
 *
 * Guarantees layered here:
 *   1. Phase A single-flight — runAssessmentPhaseA calls claimPhaseA()
 *      internally; a duplicate dispatch encounters PhaseAAlreadyRunningError
 *      and returns quietly (no second execution, no fake error log).
 *   2. Phase B is only scheduled when Phase A actually won the claim, so it
 *      cannot be double-scheduled from a duplicate submit.
 *   3. Failures are recorded on the assessment row inside the orchestrator;
 *      we swallow the throw here so `after()` doesn't blow up.
 */
export async function safeDispatchOrchestration(assessmentId: string): Promise<void> {
  console.log("[DISPATCH] START", { assessmentId });
  let ctx;
  try {
    ctx = await runAssessmentPhaseA(assessmentId);
  } catch (err) {
    if (err instanceof PhaseAAlreadyRunningError) {
      // Duplicate submit or a racing orchestrate call. The other invocation
      // owns the run — do nothing.
      console.log("[DISPATCH] ALREADY_RUNNING", {
        assessmentId,
        currentStatus: err.currentStatus,
        executionId: err.executionId,
      });
      return;
    }
    console.error("[DISPATCH] PHASE-A-FAIL", {
      assessmentId,
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  console.log("[DISPATCH] CLINICAL_READY", { assessmentId });

  // Phase B runs sequentially (still inside the caller's `after()` window)
  // so the lambda stays alive until the PDF is stored. Errors are recorded
  // on the assessment row and swallowed here — patient response already
  // shipped.
  try {
    await runAssessmentPhaseB(ctx);
  } catch (err) {
    console.error("[DISPATCH] PHASE-B-FAIL", {
      assessmentId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

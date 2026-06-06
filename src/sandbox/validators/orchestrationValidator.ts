import type { OrchestrationValidationReport, OrchestrationStageResult } from "../types";

const REQUIRED_STAGES = [
  "questionnaire",
  "clinical",
  "therapy",
  "recommendations",
  "narratives",
] as const;

export function validateOrchestration(logs: {
  stage: string;
  status: string;
  durationMs?: number | null;
  error?: string | null;
}[]): OrchestrationValidationReport {
  const stages: OrchestrationStageResult[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  let totalDurationMs = 0;

  for (const req of REQUIRED_STAGES) {
    const log = logs.find((l) => l.stage === req);
    const durationMs = log?.durationMs ?? 0;
    totalDurationMs += durationMs;

    const status =
      log?.status === "SUCCESS"
        ? "SUCCESS"
        : log?.status === "FAILED"
          ? "FAILED"
          : log
            ? "SKIPPED"
            : "PENDING";

    stages.push({
      stage: req,
      status,
      durationMs,
      error: log?.error ?? undefined,
    });

    if (!log || log.status !== "SUCCESS") {
      errors.push(`Orchestration stage "${req}" did not complete successfully`);
    }
  }

  const pdfLog = logs.find((l) => l.stage === "pdf");
  if (pdfLog) {
    stages.push({
      stage: "pdf",
      status: pdfLog.status === "SUCCESS" ? "SUCCESS" : "FAILED",
      durationMs: pdfLog.durationMs ?? 0,
      error: pdfLog.error ?? undefined,
    });
  }

  return {
    executionId: "sandbox",
    passed: errors.length === 0,
    stages,
    totalDurationMs,
    errors,
    warnings,
    validatedAt: new Date().toISOString(),
  };
}

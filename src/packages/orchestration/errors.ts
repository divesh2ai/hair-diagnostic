import type { PipelineStage } from "./types";

export class PipelineExecutionError extends Error {
  public readonly stage: PipelineStage;
  public readonly executionId: string;
  public readonly timestamp: string;
  public readonly originalError: unknown;

  constructor(
    message: string,
    stage: PipelineStage,
    executionId: string,
    originalError: unknown
  ) {
    super(message);
    this.name = "PipelineExecutionError";
    this.stage = stage;
    this.executionId = executionId;
    this.timestamp = new Date().toISOString();
    this.originalError = originalError;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PipelineExecutionError);
    }
  }
}

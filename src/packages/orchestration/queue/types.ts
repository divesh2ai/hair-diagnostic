// ─── Job Queue Abstraction ─────────────────────────────────────────────────────
// Technology-agnostic interface. Swap Inngest → BullMQ → Trigger.dev without
// changing any callers. Implement the interface for your chosen backend.

export interface AssessmentJobPayload {
  assessmentId: string;
  retryCount?: number;
  correlationId?: string;
}

export interface JobResult {
  jobId: string;
  assessmentId: string;
  enqueuedAt: string;
}

export interface JobStatus {
  jobId: string;
  assessmentId: string;
  state: "pending" | "running" | "completed" | "failed" | "cancelled";
  attempt: number;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

export interface AssessmentQueue {
  /** Enqueue a new assessment orchestration job. Returns the job handle. */
  enqueue(payload: AssessmentJobPayload): Promise<JobResult>;

  /** Requeue a failed job. Increments retry count and applies backoff. */
  retry(assessmentId: string): Promise<JobResult>;

  /** Cancel a pending or running job. */
  cancel(assessmentId: string): Promise<void>;

  /** Query current job state. */
  status(assessmentId: string): Promise<JobStatus | null>;
}

// ─── Concurrency Policy ────────────────────────────────────────────────────────
// Enforced at the queue level — not in application code.

export const QUEUE_CONFIG = {
  concurrency: 5,           // max parallel orchestrations per worker
  maxRetries: 3,
  retryDelayMs: 2_000,      // base delay; multiplied exponentially per attempt
  jobTimeoutMs: 10 * 60_000, // 10-minute hard timeout per job
  deadLetterAfter: 3,       // move to DLQ after this many failures
} as const;

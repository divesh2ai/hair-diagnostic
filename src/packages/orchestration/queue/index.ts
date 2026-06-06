import type { AssessmentQueue } from "./types";
import { InngestAssessmentQueue, DirectAssessmentQueue } from "./inngest";

// Factory: returns Inngest queue if configured, direct queue otherwise.
// Swap the implementation here without touching callers.
function createQueue(): AssessmentQueue {
  if (process.env.INNGEST_EVENT_KEY) {
    try {
      return new InngestAssessmentQueue();
    } catch {
      console.warn("[Queue] Inngest init failed — falling back to direct queue");
    }
  }
  return new DirectAssessmentQueue();
}

const g = globalThis as unknown as { _hairosQueue?: AssessmentQueue };
export const assessmentQueue: AssessmentQueue = g._hairosQueue ?? createQueue();
if (process.env.NODE_ENV !== "production") g._hairosQueue = assessmentQueue;

export type { AssessmentQueue, AssessmentJobPayload, JobResult, JobStatus } from "./types";
export { QUEUE_CONFIG } from "./types";

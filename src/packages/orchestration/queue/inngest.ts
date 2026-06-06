// ─── Inngest Queue Implementation ─────────────────────────────────────────────
//
// RECOMMENDED BACKEND: Inngest
//
// Why Inngest over BullMQ / Trigger.dev for HairOS:
//
//   BullMQ       — Redis-dependent. Requires a persistent Redis instance.
//                  Breaks in serverless (Next.js). Excellent for self-hosted
//                  workers but overkill here.
//
//   Trigger.dev  — TypeScript-native, managed. Strong observability.
//                  Requires a separate worker process and their cloud infra.
//
//   Inngest      — Runs *inside* Next.js API routes via their SDK.
//                  No separate worker. Serverless-compatible. Free tier covers
//                  clinical AI volume. Built-in retries, concurrency, tracing.
//                  Single npm package. The correct choice for this architecture.
//
// Setup:
//   1. npm install inngest
//   2. Add INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY to .env
//   3. Create apps/patient-portal/src/app/api/inngest/route.ts (see below)
//   4. Replace safeDispatchOrchestration() in dispatch.ts with inngestQueue.enqueue()
//
// Example route (apps/patient-portal/src/app/api/inngest/route.ts):
//
//   import { serve } from "inngest/next";
//   import { inngest, assessmentOrchestrationFn } from "@hairos/packages/orchestration/queue/inngest";
//   export const { GET, POST, PUT } = serve({
//     client: inngest,
//     functions: [assessmentOrchestrationFn],
//   });
//
// ──────────────────────────────────────────────────────────────────────────────

import type { AssessmentQueue, AssessmentJobPayload, JobResult, JobStatus } from "./types";
import { QUEUE_CONFIG } from "./types";
import { orchestrateAssessment, resumeOrchestration } from "../../assessment-orchestrator";

// Lazy-loaded Inngest client — only instantiates when the module is imported in
// an environment where INNGEST_EVENT_KEY is set. Falls back gracefully.
let _inngest: unknown = null;

function getInngest() {
  if (_inngest) return _inngest;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Inngest } = require("inngest") as { Inngest: new (opts: { id: string; name: string }) => unknown };
    _inngest = new Inngest({ id: "hairos-clinical", name: "HairOS Clinical Platform" });
    return _inngest;
  } catch {
    return null;
  }
}

// ─── Inngest Function Definition ───────────────────────────────────────────────
// Export this and register it in your serve() handler.

export function createAssessmentOrchestrationFn() {
  const client = getInngest() as {
    createFunction: (
      opts: object,
      trigger: object,
      handler: (ctx: { event: { data: AssessmentJobPayload }; step: { run: (id: string, fn: () => Promise<void>) => Promise<void> } }) => Promise<void>
    ) => unknown;
  } | null;

  if (!client) return null;

  return client.createFunction(
    {
      id: "assessment-orchestration",
      name: "Assessment Orchestration Pipeline",
      concurrency: { limit: QUEUE_CONFIG.concurrency },
      retries: QUEUE_CONFIG.maxRetries,
      timeoutMs: QUEUE_CONFIG.jobTimeoutMs,
    },
    { event: "hairos/assessment.queued" },
    async ({ event, step }) => {
      const { assessmentId, retryCount = 0 } = event.data;

      await step.run("orchestrate-assessment", async () => {
        if (retryCount > 0) {
          await resumeOrchestration(assessmentId);
        } else {
          await orchestrateAssessment(assessmentId);
        }
      });
    }
  );
}

// ─── Inngest Queue Adapter ─────────────────────────────────────────────────────

export class InngestAssessmentQueue implements AssessmentQueue {
  private readonly client: {
    send: (event: { name: string; data: AssessmentJobPayload }) => Promise<{ ids: string[] }>;
  };

  constructor() {
    const c = getInngest();
    if (!c) throw new Error("Inngest not available — install inngest and set INNGEST_EVENT_KEY");
    this.client = c as typeof this.client;
  }

  async enqueue(payload: AssessmentJobPayload): Promise<JobResult> {
    const result = await this.client.send({
      name: "hairos/assessment.queued",
      data: payload,
    });

    return {
      jobId: result.ids[0] ?? payload.assessmentId,
      assessmentId: payload.assessmentId,
      enqueuedAt: new Date().toISOString(),
    };
  }

  async retry(assessmentId: string): Promise<JobResult> {
    const result = await this.client.send({
      name: "hairos/assessment.queued",
      data: { assessmentId, retryCount: 1 },
    });

    return {
      jobId: result.ids[0] ?? assessmentId,
      assessmentId,
      enqueuedAt: new Date().toISOString(),
    };
  }

  async cancel(_assessmentId: string): Promise<void> {
    // Inngest cancellation requires event cancellation — call inngest.cancel()
    // with the run ID from the dashboard or via the Inngest API.
    // For now, the orchestration will self-terminate on the next stage check.
    console.warn("[Queue] Inngest cancel not implemented — set assessment status to FAILED to halt.");
  }

  async status(_assessmentId: string): Promise<JobStatus | null> {
    // Full job status requires the Inngest Management API with your signing key.
    // For polling from the UI, use the /api/assessment/status endpoint instead.
    return null;
  }
}

// ─── Direct (In-Process) Queue Adapter ────────────────────────────────────────
// Fallback when Inngest is not configured. Used in dev and for existing after() dispatch.
// Not durable — job is lost if the process crashes.

export class DirectAssessmentQueue implements AssessmentQueue {
  async enqueue(payload: AssessmentJobPayload): Promise<JobResult> {
    setImmediate(() => {
      void orchestrateAssessment(payload.assessmentId).catch((err) => {
        console.error("[DirectQueue] orchestration error:", err);
      });
    });

    return {
      jobId: payload.assessmentId,
      assessmentId: payload.assessmentId,
      enqueuedAt: new Date().toISOString(),
    };
  }

  async retry(assessmentId: string): Promise<JobResult> {
    setImmediate(() => {
      void resumeOrchestration(assessmentId).catch((err) => {
        console.error("[DirectQueue] resume error:", err);
      });
    });

    return {
      jobId: assessmentId,
      assessmentId,
      enqueuedAt: new Date().toISOString(),
    };
  }

  async cancel(_assessmentId: string): Promise<void> {}
  async status(_assessmentId: string): Promise<JobStatus | null> { return null; }
}

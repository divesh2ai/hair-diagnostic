// Eager Consultation persistence at the end of Phase A.
//
// ── The defect this closes ───────────────────────────────────────────────────
// Consultation + ConsultationVersion were only ever written lazily, on the
// first doctor READ (`ConsultationOrchestrator.getOrCreateDetailed`, reached
// from the review loader / consultation API routes). The assessment pipeline
// itself never called the orchestrator, so a clinic whose doctors had not yet
// opened a case had assessments, AI artifacts and PDFs but ZERO canonical
// consultations — `drfact-mumbai` sat at 22 assessments / 0 consultations
// while `drfact-mumbai-test` showed 24, purely because doctors had worked the
// queue there. No clinic slug, organizationId, cohort or feature flag ever
// participated in the difference.
//
// The canonical clinical record must not depend on whether a human happened
// to click. Phase A now composes and persists it as soon as the clinical
// outputs are final, through the SAME orchestrator entry point the doctor UI
// uses — no second clinical data model, no direct Prisma writes around the
// version repository, and the immutable-version semantics are untouched.
//
// ── Why this never fails the assessment ──────────────────────────────────────
// Lazy creation on doctor read still exists and still works. If eager
// creation hiccups (a transient DB blip, a genuinely un-composable record),
// the doctor can still open the case and the orchestrator composes v1 then.
// Marking the whole assessment FAILED here would throw away complete, valid
// clinical artifacts and a rendered PDF for a strictly recoverable condition.
//
// It is NOT silent, though: every failure writes an OrchestrationLog row
// (stage `consultation`, status FAILED, with the error) and an AssessmentEvent,
// so a missing consultation is visible in exactly the places the rest of the
// pipeline reports through.

import type { PrismaClient } from "@prisma/client";
import { makeOrchestrator, OrchestratorError } from "../../consultation-orchestrator";

/** Actor recorded as `createdBy` on pipeline-authored consultations. */
export const PIPELINE_ACTOR_ID = "system:assessment-pipeline";

export interface EnsureConsultationResult {
  status: "created" | "existing" | "skipped" | "failed";
  consultationId?: string;
  contentVersion?: number;
  /** Present when status is "skipped" or "failed". */
  reason?: string;
}

/**
 * Compose + persist the canonical Consultation and its first
 * ConsultationVersion for a completed Phase A run.
 *
 * Idempotent by construction: `getOrCreateDetailed` returns the stored
 * version when one already exists, and the underlying repository's
 * `createWithInitialVersion` converges on the winning row under a unique
 * violation and adopts half-built orphans. A pipeline retry therefore never
 * produces a duplicate Consultation or a duplicate identical version.
 *
 * Runs as a system actor (`clinicId: null` = super-admin in AccessContext),
 * because the pipeline is not acting on behalf of any one clinic member.
 */
export async function ensureConsultationForAssessment(
  prisma: PrismaClient,
  assessmentId: string,
): Promise<EnsureConsultationResult> {
  const orchestrator = makeOrchestrator(prisma);

  const before = await prisma.consultation.findUnique({
    where: { assessmentId },
    select: { id: true, currentVersionId: true },
  });

  const stored = await orchestrator.getOrCreateDetailed({
    assessmentId,
    ctx: { actorId: PIPELINE_ACTOR_ID, role: "SYSTEM", clinicId: null },
  });

  return {
    status: before?.currentVersionId ? "existing" : "created",
    consultationId: stored.consultationId,
    contentVersion: stored.contentVersion,
  };
}

/**
 * Guarded wrapper used by the pipeline. Never throws — see the file header on
 * why a consultation failure must not discard a good clinical run.
 *
 * `not_composable` is reported as "skipped" rather than "failed": it means the
 * record genuinely has no stored questionnaire to compose from, which is a
 * data condition, not a persistence fault, and the review queue already
 * withholds such rows (see reviewQueue.ts REVIEWABLE_SOURCE_SQL).
 */
export async function ensureConsultationGuarded(
  prisma: PrismaClient,
  assessmentId: string,
): Promise<EnsureConsultationResult> {
  try {
    return await ensureConsultationForAssessment(prisma, assessmentId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (err instanceof OrchestratorError && err.code === "not_composable") {
      console.warn(
        `[ORCH] CONSULTATION-SKIP ${assessmentId}: ${message}`,
      );
      return { status: "skipped", reason: message };
    }

    console.error(`[ORCH] CONSULTATION-FAIL ${assessmentId}: ${message}`);
    return { status: "failed", reason: message };
  }
}

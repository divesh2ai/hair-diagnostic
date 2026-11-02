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
 * Maps the eager-consultation result to the consultation stage's honest
 * OrchestrationLog status. Kept here (not in the heavyweight pipeline module)
 * so it is unit-testable in isolation.
 *
 * SUCCESS requires an actually persisted consultation (created, or already
 * existing). `failed` — a swallowed persistence error — must NOT read as
 * SUCCESS (that was the false-success evidence defect). `skipped` —
 * not_composable, i.e. no stored questionnaire, so no consultation can or
 * should exist — is reported distinctly as SKIPPED. Admin metrics tally only
 * SUCCESS/FAILED, so SKIPPED inflates neither.
 */
export function consultationStageOutcome(
  result: EnsureConsultationResult,
): { status: string; error?: string } {
  switch (result.status) {
    case "created":
    case "existing":
      return { status: "SUCCESS" };
    case "skipped":
      return { status: "SKIPPED", error: result.reason };
    case "failed":
    default:
      return { status: "FAILED", error: result.reason ?? "unknown" };
  }
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
 * Clinic context: the pipeline presents the assessment's OWN clinic, read from
 * the database row (`Assessment.clinicId`), as the access context — the exact
 * clinic a doctor of that clinic would carry. It passes the orchestrator's
 * existing clinic-equality guard legitimately and is scoped to precisely the
 * one clinic that owns the assessment; it is NOT a cross-clinic bypass. The
 * clinicId is server-verified from the row and never derived from client input.
 * The actor keeps role `SYSTEM` for provenance only (recorded as `createdBy`);
 * `SYSTEM` carries no special read privilege and — by its exclusion from
 * REVISE_ROLES — can never revise or approve, so the pipeline may create the
 * canonical record but never sign it off.
 *
 * (Historically this passed `clinicId: null` expecting it to mean super-admin;
 * it did not — the orchestrator keys super-admin off the role string — so the
 * guard denied the pipeline with "Cross-clinic access denied" on EVERY
 * assessment and the consultation was only ever created lazily on doctor read.)
 */
export async function ensureConsultationForAssessment(
  prisma: PrismaClient,
  assessmentId: string,
): Promise<EnsureConsultationResult> {
  const orchestrator = makeOrchestrator(prisma);

  // Server-verified clinic ownership for this assessment. A missing row yields
  // a null clinicId; the orchestrator then loads the (absent) assessment and
  // throws `not_found` before the clinic guard, so behaviour is unchanged for
  // a genuinely missing assessment.
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { clinicId: true },
  });

  const before = await prisma.consultation.findUnique({
    where: { assessmentId },
    select: { id: true, currentVersionId: true },
  });

  const stored = await orchestrator.getOrCreateDetailed({
    assessmentId,
    ctx: {
      actorId: PIPELINE_ACTOR_ID,
      role: "SYSTEM",
      clinicId: assessment?.clinicId ?? null,
    },
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

// POST /api/consultation/[assessmentId]/report/retry
//
// Authorized, idempotent report-generation retry. Dedicated endpoint (NOT
// /api/assessment/pdf) so the auth envelope, audit semantics, and future
// patient-access rules of PDF-release stay cleanly separate.
//
// Auth: clinic member on the assessment's clinic OR Super Admin.
// Preconditions: Assessment.status ∈ {PARTIAL_FAILURE, COMPLETED}.
// Idempotency: two-step compare-and-set on Assessment.status.
//   Step A (retry claim): PARTIAL_FAILURE|COMPLETED → REPORT_GENERATING.
//     Guarantees single-winner among concurrent retry clicks — the loser
//     sees updateMany.count === 0 and gets 409.
//   Step B: immediately flip REPORT_GENERATING → PARTIAL_FAILURE with
//     lastError=null and retryCount+1. This is the assessment shape the
//     existing resume pipeline expects, so the pipeline can re-run Phase B
//     idempotently (upserting the REPORT artifact under its unique
//     assessmentId_type constraint — no duplicate REPORT rows). The claim
//     protection inside claimPhaseA guarantees the underlying clinical
//     engines don't double-run once Phase A wins.
//
// Notes:
//   • The Phase A lease is a Phase A construct only. We do NOT reset it here.
//   • This route triggers regeneration; it never releases the PDF. Release
//     still goes through GET /api/assessment/pdf under the approval gate.

import { NextResponse, after } from "next/server";
import { AssessmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getClinicContext, handleAuthError } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/auth/roles";
import { safeDispatchOrchestration } from "@/lib/orchestration/dispatch";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { logLifecycleEvent } from "@/lib/observability/lifecycle";

export const dynamic = "force-dynamic";

const RETRYABLE_FROM: AssessmentStatus[] = [
  AssessmentStatus.PARTIAL_FAILURE,
  AssessmentStatus.COMPLETED,
];

export async function POST(
  _req: Request,
  ctxParam: { params: Promise<{ assessmentId: string }> },
) {
  let auth;
  try {
    auth = await getClinicContext();
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    throw err;
  }

  const { assessmentId } = await ctxParam.params;

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, clinicId: true, status: true },
  });
  if (!assessment) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!isSuperAdmin(auth.role) && assessment.clinicId !== auth.clinicId) {
    logLifecycleEvent({
      event: "report_retry.denied",
      assessmentId,
      clinicId: auth.clinicId ?? null,
      failureCode: "cross_clinic",
    });
    return NextResponse.json(
      { error: "forbidden", message: "Cross-clinic access denied" },
      { status: 403 },
    );
  }

  // Step A: compare-and-set to REPORT_GENERATING. Single winner among racing
  // retries — everyone else sees count===0 and 409.
  const claim = await prisma.assessment.updateMany({
    where: {
      id: assessmentId,
      status: { in: RETRYABLE_FROM },
    },
    data: {
      status: AssessmentStatus.REPORT_GENERATING,
      lastError: null,
    },
  });
  if (claim.count === 0) {
    return NextResponse.json(
      {
        error: "not_retryable",
        message: `Assessment status ${assessment.status} is not retryable`,
        currentStatus: assessment.status,
      },
      { status: 409 },
    );
  }

  // Step B: hand the row back to the pipeline-expected shape. The existing
  // orchestrator treats PARTIAL_FAILURE as claimable / resumable; setting
  // this before dispatch lets safeDispatchOrchestration -> runAssessmentPhaseA
  // -> claimPhaseA win atomically, re-run the (deterministic) clinical
  // stages, and then re-run Phase B which upserts the REPORT artifact.
  await prisma.assessment.update({
    where: { id: assessmentId },
    data: {
      status: AssessmentStatus.PARTIAL_FAILURE,
      retryCount: { increment: 1 },
    },
  });

  await writeAuditLog({
    action: "REPORT_RETRIED",
    entityType: "Assessment",
    entityId: assessmentId,
    actorId: auth.userId ?? null,
    actorRole: auth.role,
    actorType: isSuperAdmin(auth.role) ? "admin" : "doctor",
    assessmentId,
    metadata: {
      clinicId: assessment.clinicId,
      previousStatus: assessment.status,
    },
  }).catch((err) => console.error("[report-retry] audit failed", err));

  logLifecycleEvent({
    event: "report_retry.started",
    assessmentId,
    clinicId: assessment.clinicId,
    statusAfter: AssessmentStatus.PARTIAL_FAILURE,
  });

  // Dispatch outside the response window so the retry click returns instantly.
  after(() => safeDispatchOrchestration(assessmentId));

  return NextResponse.json({
    success: true,
    status: AssessmentStatus.PARTIAL_FAILURE,
    message: "Retry queued",
  });
}

import { NextResponse } from "next/server";
import { ReviewDecision } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyReviewToken } from "@/lib/reviewToken";
import {
  makeOrchestrator,
  OrchestratorError,
  ReadinessBlockedError,
  type ApprovalStatus,
} from "@hairos/packages/consultation-orchestrator";
import { logLifecycleEvent } from "@/lib/observability/lifecycle";
import { toPatientSafeReadinessDecision } from "@shared/clinical-readiness/evaluator";

// Signed-token review flow (WhatsApp / email "review this report" link).
//
// Approvals here MUST NOT write reviewDecision directly. The token route
// authenticates + resolves the assessment, then delegates to
// orchestrator.approve — the same canonical approval boundary the doctor
// dashboard uses. That guarantees:
//   • one CONSULTATION_APPROVED event per approval (idempotent on retry),
//   • cross-clinic ownership check via the orchestrator,
//   • stale-content / stale-version guard,
//   • assessment-state guard (no approving FAILED / still-processing cases),
//   • single audit trail regardless of surface.
// The legacy Assessment.reviewDecision flag is still mirrored so the reports
// inbox stays in sync (same pattern as the doctor route).

const ERROR_RESPONSE = {
  MALFORMED: { status: 400, message: "This review link is malformed." },
  INVALID_SIGNATURE: { status: 401, message: "This review link is not valid." },
  EXPIRED: { status: 410, message: "This review link has expired." },
  INVALID_PAYLOAD: { status: 400, message: "This review link is not readable." },
} as const;

// Token uses legacy names; orchestrator uses canonical names.
const DECISION_TO_APPROVAL: Record<string, ApprovalStatus> = {
  APPROVED: "APPROVED",
  EDITS_REQUESTED: "REVISION_REQUESTED",
  REJECTED: "REJECTED",
};
const APPROVAL_TO_REVIEW_DECISION: Record<ApprovalStatus, ReviewDecision> = {
  APPROVED: ReviewDecision.APPROVED,
  REVISION_REQUESTED: ReviewDecision.EDITS_REQUESTED,
  REJECTED: ReviewDecision.REJECTED,
  DRAFT: ReviewDecision.PENDING,
  PENDING_REVIEW: ReviewDecision.PENDING,
};

const MAX_NOTES_LEN = 2000;
const MAX_NAME_LEN = 120;
const MAX_EMAIL_LEN = 200;

const orchestrator = makeOrchestrator(prisma);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const result = verifyReviewToken(token);
  if (!result.ok) {
    const m = ERROR_RESPONSE[result.error];
    return NextResponse.json({ success: false, error: m.message }, { status: m.status });
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id: result.assessmentId },
    select: {
      id: true,
      status: true,
      reviewDecision: true,
      reviewerName: true,
      reviewerEmail: true,
      reviewNotes: true,
      reviewedAt: true,
      clinic: { select: { id: true, name: true, slug: true } },
      patient: { select: { name: true, age: true, gender: true } },
    },
  });

  if (!assessment) {
    return NextResponse.json(
      { success: false, error: "Report not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    assessmentId: assessment.id,
    status: assessment.status,
    clinic: assessment.clinic,
    patient: assessment.patient,
    review: {
      decision: assessment.reviewDecision,
      reviewerName: assessment.reviewerName,
      reviewerEmail: assessment.reviewerEmail,
      notes: assessment.reviewNotes,
      reviewedAt: assessment.reviewedAt,
    },
    expiresAt: result.expiresAt,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const result = verifyReviewToken(token);
  if (!result.ok) {
    const m = ERROR_RESPONSE[result.error];
    return NextResponse.json({ success: false, error: m.message }, { status: m.status });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        decision?: string;
        reviewerName?: string;
        reviewerEmail?: string;
        notes?: string;
      }
    | null;
  if (!body) {
    return NextResponse.json(
      { success: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const decisionRaw = (body.decision ?? "").toUpperCase();
  const approvalStatus = DECISION_TO_APPROVAL[decisionRaw];
  if (!approvalStatus) {
    return NextResponse.json(
      { success: false, error: "Decision must be APPROVED, EDITS_REQUESTED, or REJECTED." },
      { status: 400 },
    );
  }

  const reviewerName = (body.reviewerName ?? "").trim().slice(0, MAX_NAME_LEN);
  const reviewerEmail = (body.reviewerEmail ?? "").trim().slice(0, MAX_EMAIL_LEN);
  const notes = (body.notes ?? "").trim().slice(0, MAX_NOTES_LEN);

  if (!reviewerName) {
    return NextResponse.json(
      { success: false, error: "Reviewer name is required." },
      { status: 400 },
    );
  }

  // Approve without a note is fine, but reject / revision without reasoning
  // is not actionable downstream.
  if (approvalStatus !== "APPROVED" && !notes) {
    return NextResponse.json(
      { success: false, error: "Please add notes explaining the decision." },
      { status: 400 },
    );
  }

  // Resolve the assessment for its clinicId (the orchestrator needs it for
  // the ownership check the same way the dashboard does). If it's gone,
  // 404 the token — the URL now references content that no longer exists.
  const assessment = await prisma.assessment.findUnique({
    where: { id: result.assessmentId },
    select: { id: true, clinicId: true },
  });
  if (!assessment) {
    return NextResponse.json(
      { success: false, error: "Report not found." },
      { status: 404 },
    );
  }

  // Actor identity for the audit trail. The token itself doesn't identify a
  // person, so we key on reviewer email (preferred) or reviewer name; both
  // are user-supplied but this is signed-URL territory — same trust model as
  // any email-approval link.
  const actorId = `review-token:${reviewerEmail || reviewerName}`;

  try {
    await orchestrator.approve({
      assessmentId: assessment.id,
      ctx: {
        actorId,
        role: "TOKEN_REVIEWER",
        clinicId: assessment.clinicId,
      },
      status: approvalStatus,
      notes: notes || undefined,
    });
    logLifecycleEvent({
      event: "token.approval_accepted",
      assessmentId: assessment.id,
      clinicId: assessment.clinicId,
      statusAfter: approvalStatus,
    });
  } catch (err) {
    if (err instanceof ReadinessBlockedError) {
      logLifecycleEvent({
        event: "token.approval_rejected",
        assessmentId: assessment.id,
        clinicId: assessment.clinicId,
        failureCode: err.decision.blockingCodes.includes("GROUNDING_VIOLATION_PRESENT")
          ? "grounding_violation"
          : "reasoning_gap",
      });
      // Token audience is doctor-scoped (WhatsApp review link goes to the
      // reviewing clinician), but the token itself does not identify a
      // specific person we can attribute doctor-level violation detail to.
      // Return counts + codes only; no raw violation entries.
      const safe = toPatientSafeReadinessDecision(err.decision);
      return NextResponse.json(
        {
          success: false,
          error: "readiness_blocked",
          code: "readiness_blocked",
          message:
            "This consultation cannot be approved yet: unresolved clinical evidence issues. Please open the dashboard to review.",
          ...safe,
        },
        { status: 422 },
      );
    }
    if (err instanceof OrchestratorError) {
      const status = err.code === "not_found" ? 404 : err.code === "forbidden" ? 403 : 409;
      logLifecycleEvent({
        event: "token.approval_rejected",
        assessmentId: assessment.id,
        clinicId: assessment.clinicId,
        failureCode:
          err.code === "not_found"
            ? "not_found"
            : err.code === "forbidden"
              ? "cross_clinic"
              : "state_ineligible",
      });
      return NextResponse.json(
        { success: false, error: err.message },
        { status },
      );
    }
    throw err;
  }

  // Mirror onto the legacy workflow flag so the reports inbox stays in sync,
  // and stash the reviewer contact metadata used to render the read-only GET
  // screen once the link is opened again.
  const updated = await prisma.assessment.update({
    where: { id: assessment.id },
    data: {
      reviewDecision: APPROVAL_TO_REVIEW_DECISION[approvalStatus],
      reviewerName,
      reviewerEmail: reviewerEmail || null,
      reviewNotes: notes || null,
      reviewedAt: new Date(),
    },
    select: {
      id: true,
      reviewDecision: true,
      reviewerName: true,
      reviewedAt: true,
    },
  });

  return NextResponse.json({ success: true, review: updated });
}

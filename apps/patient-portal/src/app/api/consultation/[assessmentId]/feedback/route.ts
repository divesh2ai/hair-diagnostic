// /api/consultation/[assessmentId]/feedback
//
// POST — record structured doctor feedback about the current recommendation.
//        Never mutates the recommendation. Pins the ConsultationVersion the
//        doctor was reviewing at feedback time.
// GET  — list feedback for the consultation (clinic-scoped).
//
// Feedback categories are strictly clinical. "Needs revision" is a workflow
// action captured via /api/consultation/[assessmentId]/approve, NOT a
// feedback issueType, so it does NOT appear here.

import { NextResponse } from "next/server";
import {
  FeedbackIssueType,
  FeedbackSeverity,
  FeedbackVerdict,
  SystemRole,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getClinicContext, handleAuthError } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/auth/roles";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { logLifecycleEvent } from "@/lib/observability/lifecycle";

export const dynamic = "force-dynamic";

const MAX_RATIONALE = 4000;
const MAX_KIT_IDS = 20;

const VALID_VERDICTS: ReadonlySet<FeedbackVerdict> = new Set(
  Object.values(FeedbackVerdict),
);
const VALID_ISSUES: ReadonlySet<FeedbackIssueType> = new Set(
  Object.values(FeedbackIssueType),
);
const VALID_SEVERITIES: ReadonlySet<FeedbackSeverity> = new Set(
  Object.values(FeedbackSeverity),
);

// Clinical rationale is required for verdicts where the doctor's reasoning
// materially affects downstream learning-loop analysis or safety triage.
function rationaleRequired(v: FeedbackVerdict): boolean {
  return v === FeedbackVerdict.SAFETY_CONCERN || v === FeedbackVerdict.INCORRECT;
}

function sanitizeKitIds(input: unknown, max = MAX_KIT_IDS): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((k): k is string => typeof k === "string" && k.length > 0)
    .slice(0, max);
}

export async function POST(
  req: Request,
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
  const body = (await req.json().catch(() => ({}))) as {
    verdict?: string;
    issueType?: string;
    severity?: string;
    expectedKitOrder?: unknown;
    affectedKitIds?: unknown;
    clinicalRationale?: string;
  };

  const verdict = body.verdict as FeedbackVerdict | undefined;
  const issueType = body.issueType as FeedbackIssueType | undefined;
  const severity = body.severity as FeedbackSeverity | undefined;
  if (!verdict || !VALID_VERDICTS.has(verdict)) {
    return NextResponse.json({ error: "invalid_verdict" }, { status: 400 });
  }
  if (!issueType || !VALID_ISSUES.has(issueType)) {
    return NextResponse.json({ error: "invalid_issue_type" }, { status: 400 });
  }
  if (!severity || !VALID_SEVERITIES.has(severity)) {
    return NextResponse.json({ error: "invalid_severity" }, { status: 400 });
  }

  const rationale = (body.clinicalRationale ?? "").slice(0, MAX_RATIONALE).trim();
  if (rationaleRequired(verdict) && rationale.length === 0) {
    return NextResponse.json(
      {
        error: "rationale_required",
        message: `clinicalRationale is required for verdict=${verdict}`,
      },
      { status: 400 },
    );
  }

  const expectedKitOrder = sanitizeKitIds(body.expectedKitOrder);
  const affectedKitIds = sanitizeKitIds(body.affectedKitIds);

  // Resolve consultation + current version. Server pins contentVersion so
  // the client cannot record feedback against a version that never existed.
  const consultation = await prisma.consultation.findUnique({
    where: { assessmentId },
    include: { currentVersion: { select: { id: true, contentVersion: true } } },
  });
  if (!consultation || !consultation.currentVersion) {
    return NextResponse.json(
      { error: "not_found", message: "Consultation not found for assessment" },
      { status: 404 },
    );
  }
  if (!isSuperAdmin(auth.role) && consultation.clinicId !== auth.clinicId) {
    logLifecycleEvent({
      event: "feedback.denied",
      assessmentId,
      clinicId: auth.clinicId ?? null,
      failureCode: "cross_clinic",
    });
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // FK requires a real Doctor row. Fall back to the reviewingDoctor bound to
  // the assessment when the caller is not a doctor themselves.
  const assessmentRow = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { reviewingDoctorId: true },
  });
  const doctorId =
    (auth.role === SystemRole.DOCTOR && auth.userId
      ? (await prisma.doctor.findUnique({
          where: { supabaseUserId: auth.userId },
          select: { id: true },
        }))?.id
      : undefined) ?? assessmentRow?.reviewingDoctorId;
  if (!doctorId) {
    return NextResponse.json(
      { error: "no_doctor_id", message: "No doctor bound to record feedback" },
      { status: 422 },
    );
  }

  const created = await prisma.recommendationFeedback.create({
    data: {
      consultationId: consultation.id,
      consultationVersionId: consultation.currentVersion.id,
      assessmentId,
      clinicId: consultation.clinicId,
      doctorId,
      verdict,
      issueType,
      severity,
      expectedKitOrder,
      affectedKitIds,
      clinicalRationale: rationale ? rationale : null,
    },
  });

  await writeAuditLog({
    action: "RECOMMENDATION_FEEDBACK_SUBMITTED",
    entityType: "RecommendationFeedback",
    entityId: created.id,
    actorId: auth.userId ?? null,
    actorRole: auth.role,
    actorType: "doctor",
    assessmentId,
    metadata: {
      clinicId: consultation.clinicId,
      consultationId: consultation.id,
      consultationVersionId: consultation.currentVersion.id,
      contentVersion: consultation.currentVersion.contentVersion,
      verdict,
      issueType,
      severity,
    },
  }).catch((err) => console.error("[feedback] audit failed", err));

  return NextResponse.json({
    id: created.id,
    verdict: created.verdict,
    issueType: created.issueType,
    severity: created.severity,
    contentVersion: consultation.currentVersion.contentVersion,
    createdAt: created.createdAt.toISOString(),
  });
}

export async function GET(
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
  const consultation = await prisma.consultation.findUnique({
    where: { assessmentId },
    select: { id: true, clinicId: true },
  });
  if (!consultation) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!isSuperAdmin(auth.role) && consultation.clinicId !== auth.clinicId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rows = await prisma.recommendationFeedback.findMany({
    where: { consultationId: consultation.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      verdict: true,
      issueType: true,
      severity: true,
      expectedKitOrder: true,
      affectedKitIds: true,
      clinicalRationale: true,
      consultationVersionId: true,
      createdAt: true,
    },
  });
  const items = rows.map((r) => ({
    id: r.id,
    verdict: r.verdict,
    issueType: r.issueType,
    severity: r.severity,
    expectedKitOrder: r.expectedKitOrder,
    affectedKitIds: r.affectedKitIds,
    clinicalRationale: r.clinicalRationale,
    consultationVersionId: r.consultationVersionId,
    createdAt: r.createdAt.toISOString(),
  }));
  return NextResponse.json({ items });
}

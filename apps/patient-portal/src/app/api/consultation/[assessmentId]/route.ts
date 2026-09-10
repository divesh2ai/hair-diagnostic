// /api/consultation/[assessmentId]
//
// The ONLY supported way to fetch or revise a Consultation. All UI surfaces
// (doctor dashboard, patient report, PDF generator, future mobile + EMR
// integrations) must consume from here so clinical content stays identical
// across every channel.
//
//   GET   — return the current persisted Consultation; first call composes
//           it from the engines and persists v1.
//   PATCH — append an immutable new version with doctor edits/notes and
//           emit DOCTOR_REVIEW_COMPLETED + CONSULTATION_UPDATED.

import { NextResponse } from "next/server";
import type { SystemRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext, assertDoctorInClinic } from "@/lib/auth";
import { makeOrchestrator, OrchestratorError } from "@hairos/packages/consultation-orchestrator";
import { consultationMeta } from "@/lib/consultation/meta";
import {
  loadConsultationReview,
  newRequestId,
  type ConsultationErrorCode,
} from "@/lib/consultation/loadReview";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { logLifecycleEvent, sanitizeErrorClass } from "@/lib/observability/lifecycle";

export const dynamic = "force-dynamic";

const orchestrator = makeOrchestrator(prisma);

/** Doctor-facing copy for errors this route raises before the loader runs. */
const ROUTE_MESSAGES: Partial<Record<ConsultationErrorCode, string>> = {
  UNAUTHENTICATED: "Your session has expired. Please sign in again.",
  FORBIDDEN: "You don't have access to this assessment.",
  ASSESSMENT_NOT_FOUND: "This assessment is no longer available.",
  CONSULTATION_NOT_APPLICABLE:
    "This is a Dr Skin FACT assessment. It has been submitted and stored, but the hair clinical review does not apply to it.",
  CONSULTATION_LOAD_FAILED: "We couldn't open this clinical review. Please retry.",
};

function errorResponse(status: number, code: ConsultationErrorCode, requestId: string) {
  return NextResponse.json(
    { error: code, message: ROUTE_MESSAGES[code] ?? "Something went wrong.", requestId },
    { status },
  );
}

/**
 * `requireDoctorContext` predates this route's error contract and answers with
 * `{ error: "unauthorized" }` / `{ error: "forbidden", reason }`. Rather than
 * change a helper a dozen routes share, translate its two shapes here.
 */
function reshapeAuthError(res: NextResponse, requestId: string): NextResponse {
  const code: ConsultationErrorCode = res.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN";
  return errorResponse(res.status, code, requestId);
}

/**
 * Record that a clinical record was read.
 *
 * Every write path already audits. Reads did not, so a super admin opening a
 * patient's consultation through a Doctor identity left no trace at all —
 * which is the access a compliance reviewer most needs to be able to find.
 *
 * Never awaited. A failure to audit must not deny a doctor the record; the
 * catch keeps a rejected promise from surfacing as an unhandled rejection.
 */
function recordClinicalRead(input: {
  assessmentId: string;
  clinicId: string;
  authUserId: string;
  authRole: SystemRole;
  actingDoctorId: string;
  mode: "doctor" | "admin_view";
}): void {
  void writeAuditLog({
    action: "CLINICAL_RECORD_VIEWED",
    entityType: "Consultation",
    entityId: input.assessmentId,
    actorId: input.authUserId,
    actorRole: input.authRole,
    actorType: input.mode,
    assessmentId: input.assessmentId,
    metadata: {
      clinicId: input.clinicId,
      actingDoctorId: input.actingDoctorId,
      mode: input.mode,
    },
  }).catch((err) =>
    console.error("[consultation.get] audit failed", sanitizeErrorClass(err)),
  );
}

export async function GET(
  _req: Request,
  ctxParam: { params: Promise<{ assessmentId: string }> },
) {
  const requestId = newRequestId();
  const { assessmentId } = await ctxParam.params;

  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) {
    // `requireDoctorContext` returns bare `{ error }` bodies. Re-shape them so
    // every non-2xx from this route carries a code, a doctor-readable message
    // and a reference — the client can then say "sign in again" instead of
    // "we could not load this consultation".
    return reshapeAuthError(authResult, requestId);
  }
  const { doctor, authUserId, authRole, mode } = authResult;

  // One query, several facts: does the assessment exist, whose clinic is it,
  // does it still have its questionnaire, and what is the visit context the
  // review header needs.
  //
  // Reading `rawResponses` itself would pull the entire answers blob on a path
  // that usually does not need it, so only its presence is selected. The four
  // visit columns are scalars on a row this query was already fetching — they
  // cost nothing and save the header a second round trip.
  const rows = await prisma.$queryRaw<
    Array<{
      clinicId: string;
      hasAnswers: boolean;
      submittedAt: Date | null;
      visitType: string | null;
      patientRelationship: string | null;
      reviewPathway: string | null;
      concern: string | null;
    }>
  >`
    SELECT
      "clinicId",
      ("rawResponses" IS NOT NULL)  AS "hasAnswers",
      "submittedAt",
      "visitType"::text             AS "visitType",
      "patientRelationship"::text   AS "patientRelationship",
      "reviewPathway"::text         AS "reviewPathway",
      "rawResponses"->'__meta'->>'concern' AS "concern"
    FROM "Assessment"
    WHERE "id" = ${assessmentId} AND "deletedAt" IS NULL
    LIMIT 1
  `;
  const target = rows[0];

  if (!target) {
    return errorResponse(404, "ASSESSMENT_NOT_FOUND", requestId);
  }
  if (assertDoctorInClinic(doctor, target.clinicId)) {
    // Still a 404 body, deliberately: a 403 would confirm that an assessment
    // with this id exists in some other clinic. The code differs from the
    // genuine-miss case only in our logs, never in the response.
    logLifecycleEvent({
      event: "consultation.load_failed",
      requestId,
      assessmentId,
      clinicId: doctor.clinicId,
      actingDoctorId: doctor.id,
      authRole,
      mode,
      severity: "core",
      failureStage: "TENANT_CHECK",
      errorCode: "CROSS_CLINIC",
    });
    return errorResponse(404, "ASSESSMENT_NOT_FOUND", requestId);
  }

  // This surface composes the HAIR consultation. /api/assessment/submit
  // already refuses to orchestrate a Skin FACT submission for the same reason;
  // the read path needs the same rule, because the engines compose live here
  // rather than reading a stored report. Fed acne answers they do not recognise,
  // they returned a confident hair diagnosis ("Telogen Effluvium") on a skin
  // case — a fabricated finding in front of a reviewing doctor.
  //
  // Gated on an explicit skin concern only: hair rows and older rows with no
  // `__meta.concern` are untouched.
  if (target.concern?.startsWith("skin_")) {
    logLifecycleEvent({
      event: "consultation.load_failed",
      requestId,
      assessmentId,
      clinicId: doctor.clinicId,
      actingDoctorId: doctor.id,
      authRole,
      mode,
      severity: "core",
      failureStage: "CONSULTATION_LOOKUP",
      errorCode: "CONSULTATION_NOT_APPLICABLE",
    });
    return errorResponse(422, "CONSULTATION_NOT_APPLICABLE", requestId);
  }

  // Fire-and-forget, deliberately off the critical path: an audit sink outage
  // must never stop a doctor opening a clinical record.
  recordClinicalRead({
    assessmentId,
    clinicId: target.clinicId,
    authUserId,
    authRole,
    actingDoctorId: doctor.id,
    mode,
  });

  const result = await loadConsultationReview({
    prisma,
    orchestrator,
    assessmentId,
    clinicId: doctor.clinicId,
    actingDoctorId: doctor.id,
    authRole,
    mode,
    legacyAssessment: !target.hasAnswers,
    visit: {
      submittedAt: target.submittedAt?.toISOString() ?? null,
      visitType: target.visitType,
      patientRelationship: target.patientRelationship,
      reviewPathway: target.reviewPathway,
    },
    requestId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.code, message: result.message, requestId: result.requestId },
      { status: result.httpStatus },
    );
  }

  return NextResponse.json({
    consultation: result.core.consultation,
    meta: result.core.meta,
    operational: result.optional.operational,
    visit: result.optional.visit,
    core: { status: result.core.status, degradedReasons: result.core.degradedReasons },
    warnings: result.warnings,
    requestId: result.requestId,
  });
}

export async function PATCH(
  req: Request,
  ctxParam: { params: Promise<{ assessmentId: string }> },
) {
  const requestId = newRequestId();
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return reshapeAuthError(authResult, requestId);
  const { doctor, authUserId, authRole, mode } = authResult;

  const { assessmentId } = await ctxParam.params;

  // Cross-clinic reject BEFORE the orchestrator sees the request.
  const target = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { clinicId: true },
  });
  if (!target) {
    return errorResponse(404, "ASSESSMENT_NOT_FOUND", requestId);
  }
  if (assertDoctorInClinic(doctor, target.clinicId)) {
    return errorResponse(404, "ASSESSMENT_NOT_FOUND", requestId);
  }

  const body = (await req.json().catch(() => ({}))) as {
    edits?: Record<string, unknown>;
    doctorNotes?: unknown;
    attachments?: unknown;
    expectedContentVersion?: number;
  };

  try {
    const stored = await orchestrator.revise({
      assessmentId,
      ctx: {
        // The authenticated role, not a hardcoded "DOCTOR". The orchestrator's
        // own permission gates (assertCanRead / assertCanRevise) were being
        // fed a constant, so they were checking a claim this route invented
        // rather than the caller's actual identity. Every role that can reach
        // here is already in REVISE_ROLES, so no caller loses access; the
        // route-level assertDoctorInClinic above remains the binding
        // tenant check and does not exempt admins.
        actorId: doctor.id,
        role: authRole,
        clinicId: doctor.clinicId,
      },
      edits: body.edits as Parameters<typeof orchestrator.revise>[0]["edits"],
      doctorNotes: body.doctorNotes as Parameters<typeof orchestrator.revise>[0]["doctorNotes"],
      attachments: body.attachments as Parameters<typeof orchestrator.revise>[0]["attachments"],
      expectedContentVersion:
        typeof body.expectedContentVersion === "number"
          ? body.expectedContentVersion
          : undefined,
    });

    // A note-only revise (no clinical edits) is DOCTOR_NOTE_SAVED. Anything
    // else is CONSULTATION_UPDATED. Audit preserves BOTH the authenticated
    // caller and the acting Doctor so admin_view actions are traceable.
    const isNoteOnly =
      !body.edits ||
      typeof body.edits !== "object" ||
      Object.keys(body.edits as object).length === 0;
    await writeAuditLog({
      action: isNoteOnly ? "DOCTOR_NOTE_SAVED" : "CONSULTATION_UPDATED",
      entityType: "Consultation",
      entityId: stored.consultationId,
      actorId: authUserId,
      actorRole: authRole,
      actorType: mode,
      assessmentId,
      metadata: {
        clinicId: doctor.clinicId,
        actingDoctorId: doctor.id,
        mode,
        contentVersion: stored.contentVersion,
      },
    }).catch((err) => console.error("[consultation.patch] audit failed", err));

    return NextResponse.json({
      consultation: stored.content,
      meta: consultationMeta(stored),
    });
  } catch (err) {
    return handleOrchestratorError(err, requestId);
  }
}

function handleOrchestratorError(err: unknown, requestId: string): Response {
  if (err instanceof OrchestratorError) {
    // "invalid" here always means "current stored state disagrees with the
    // request": stale content version on revise, stale content version on
    // approve, or an assessment status the approval guard refuses. All are
    // conflict responses — the caller must re-read before retrying.
    const status =
      err.code === "not_found"
        ? 404
        : err.code === "forbidden"
          ? 403
          : err.code === "not_composable"
            ? 422
            : 409;
    // `err.message` is authored by the orchestrator and is safe to show; it
    // never contains SQL, a stack, or patient content.
    return NextResponse.json(
      { error: err.code, message: err.message, requestId },
      { status },
    );
  }

  // The message is NOT returned to the client any more. It used to be, and a
  // Prisma failure would put a fragment of the failing query — table and
  // column names included — straight onto a doctor's screen.
  console.error(
    "[CONSULTATION_API_FAIL]",
    requestId,
    err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    err instanceof Error ? err.stack : "",
  );
  logLifecycleEvent({
    event: "consultation.load_failed",
    requestId,
    severity: "core",
    failureStage: "UNKNOWN",
    errorCode: "CONSULTATION_LOAD_FAILED",
    errorClass: sanitizeErrorClass(err),
  });
  return NextResponse.json(
    {
      error: "CONSULTATION_LOAD_FAILED",
      message: "We couldn't save this change. Please retry.",
      requestId,
    },
    { status: 500 },
  );
}

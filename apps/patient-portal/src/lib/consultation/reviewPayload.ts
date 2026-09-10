// The doctor review payload, resolved once and shared by both callers.
//
// ── Why this module exists ──────────────────────────────────────────────────
// The review page was a server component that rendered a client component
// which then fetched `/api/consultation/[id]` from the browser. So opening a
// case ran strictly in series:
//
//   navigate → server renders an empty shell → download the review bundle →
//   hydrate → fetch the API → authenticate again → read the record → paint
//
// Nothing clinical appeared until the last step. The server had already
// authenticated the doctor and could have read the record while the browser
// was still downloading JavaScript, but the two never overlapped, so the
// doctor paid for the round trip twice and looked at a skeleton in between.
//
// Extracting the route body to a plain async function lets the PAGE resolve
// the payload during server rendering and hand it to the client as props. The
// API route is unchanged in behaviour and stays the supported entry point for
// every other consumer (refresh-after-edit, retries, future mobile/EMR).
//
// This module performs no rendering and returns no NextResponse: it hands back
// a status and a body, and each caller decides what to do with them.

import type { SystemRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext, assertDoctorInClinic } from "@/lib/auth";
import { makeOrchestrator } from "@hairos/packages/consultation-orchestrator";
import type { Consultation } from "@shared/types/consultation";
import type {
  ConsultationMeta,
  ConsultationOperationalState,
} from "@/lib/consultation/meta";
import {
  loadConsultationReview,
  newRequestId,
  type ConsultationErrorCode,
  type ReviewVisitContext,
} from "@/lib/consultation/loadReview";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { logLifecycleEvent, sanitizeErrorClass } from "@/lib/observability/lifecycle";

const orchestrator = makeOrchestrator(prisma);

/** Doctor-facing copy for errors raised before the loader runs. */
const ROUTE_MESSAGES: Partial<Record<ConsultationErrorCode, string>> = {
  UNAUTHENTICATED: "Your session has expired. Please sign in again.",
  FORBIDDEN: "You don't have access to this assessment.",
  ASSESSMENT_NOT_FOUND: "This assessment is no longer available.",
  CONSULTATION_NOT_APPLICABLE:
    "This is a Dr Skin FACT assessment. It has been submitted and stored, but the hair clinical review does not apply to it.",
  CONSULTATION_LOAD_FAILED: "We couldn't open this clinical review. Please retry.",
};

/** Success body — the exact shape the API has always returned. */
export interface ReviewPayload {
  consultation: Consultation;
  meta: ConsultationMeta;
  operational: ConsultationOperationalState | null;
  visit: ReviewVisitContext | null;
  core: { status: "ready" | "degraded"; degradedReasons: string[] };
  warnings: Array<{ code: string; stage: string }>;
  requestId: string;
}

export interface ReviewPayloadError {
  error: ConsultationErrorCode;
  message: string;
  requestId: string;
}

export type ReviewPayloadResult =
  | { ok: true; status: 200; body: ReviewPayload }
  | { ok: false; status: number; body: ReviewPayloadError };

function failure(
  status: number,
  code: ConsultationErrorCode,
  requestId: string,
): ReviewPayloadResult {
  return {
    ok: false,
    status,
    body: {
      error: code,
      message: ROUTE_MESSAGES[code] ?? "Something went wrong.",
      requestId,
    },
  };
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

interface AssessmentContextRow {
  clinicId: string;
  hasAnswers: boolean;
  submittedAt: Date | null;
  visitType: string | null;
  patientRelationship: string | null;
  reviewPathway: string | null;
  concern: string | null;
}

/**
 * One query, several facts: does the assessment exist, whose clinic is it,
 * does it still have its questionnaire, and what is the visit context the
 * review header needs.
 *
 * Reading `rawResponses` itself would pull the entire answers blob on a path
 * that usually does not need it, so only its presence is selected. The four
 * visit columns are scalars on a row this query was already fetching — they
 * cost nothing and save the header a second round trip.
 */
function loadAssessmentContext(assessmentId: string) {
  return prisma.$queryRaw<AssessmentContextRow[]>`
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
}

/**
 * Resolve the review payload for a signed-in doctor.
 *
 * Safe to call from a server component or a route handler. Authentication,
 * tenant scoping and the read audit all happen here, so neither caller can
 * skip them.
 */
export async function fetchReviewPayload(
  assessmentId: string,
): Promise<ReviewPayloadResult> {
  const requestId = newRequestId();

  // Independent work, started together. Resolving the doctor identity needs a
  // JWT verification and a `Doctor` lookup; the assessment context needs
  // neither. They used to run one after the other purely because they were
  // written that way. The tenant check below still gates on both.
  const [authResult, rows] = await Promise.all([
    requireDoctorContext(),
    loadAssessmentContext(assessmentId).catch((err) => {
      console.error("[consultation.get] assessment context failed", sanitizeErrorClass(err));
      return null;
    }),
  ]);

  // `requireDoctorContext` predates this route's error contract and answers
  // with `{ error: "unauthorized" }` / `{ error: "forbidden", reason }`. Rather
  // than change a helper a dozen routes share, translate its two shapes here.
  if (!("doctor" in authResult)) {
    const code: ConsultationErrorCode =
      authResult.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN";
    return failure(authResult.status, code, requestId);
  }
  const { doctor, authUserId, authRole, mode } = authResult;

  if (rows === null) {
    return failure(500, "CONSULTATION_LOAD_FAILED", requestId);
  }

  const target = rows[0];
  if (!target) {
    return failure(404, "ASSESSMENT_NOT_FOUND", requestId);
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
    return failure(404, "ASSESSMENT_NOT_FOUND", requestId);
  }

  // This surface composes the HAIR consultation. /api/assessment/submit already
  // refuses to orchestrate a Skin FACT submission for the same reason; the read
  // path needs the same rule, because the engines compose live here rather than
  // reading a stored report. Fed acne answers they do not recognise, they
  // returned a confident hair diagnosis ("Telogen Effluvium") on a skin case —
  // a fabricated finding in front of a reviewing doctor.
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
    return failure(422, "CONSULTATION_NOT_APPLICABLE", requestId);
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
    return {
      ok: false,
      status: result.httpStatus,
      body: {
        error: result.code,
        message: result.message,
        requestId: result.requestId,
      },
    };
  }

  return {
    ok: true,
    status: 200,
    body: {
      consultation: result.core.consultation as Consultation,
      meta: result.core.meta,
      operational: result.optional.operational,
      visit: result.optional.visit,
      core: { status: result.core.status, degradedReasons: result.core.degradedReasons },
      warnings: result.warnings,
      requestId: result.requestId,
    },
  };
}

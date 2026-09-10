// The patient's one-pager, as a clinician-facing fact.
//
//   GET   what state is it in, and if it failed, why
//   POST  ask again — request a render, or retry one that gave up
//
// ── Why a doctor can retry at all ───────────────────────────────────────────
// The retry budget is spent inside about six minutes. After that it is FAILED
// and stays FAILED, because an automatic retry that runs forever hides the
// failure code behind a busy-looking attempt count. That is the right default
// and the wrong dead end: the person who most wants the artefact is standing
// in front of the case, and a transient outage that has since cleared should
// not need a deployment to recover from.
//
// So retrying is explicit, attributed, and rate-limited by the fact that a
// human has to press it.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext, assertDoctorInClinic } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import {
  findOnePagerAsset,
  requestOnePagerRenderForAssessment,
  requestRenderDispatch,
} from "@/lib/reports/assets/jobService";
import { resetForRetry, tolerant } from "@/lib/reports/assets/repository";

export const dynamic = "force-dynamic";

/**
 * The assessment's clinic, or a response explaining why the caller may not
 * know. Every entry point below goes through this — a doctor acts inside their
 * own clinic and nowhere else, and a 404 rather than a 403 so the answer does
 * not confirm that an assessment with this id exists somewhere.
 */
async function scope(assessmentId: string) {
  const auth = await requireDoctorContext();
  if (auth instanceof NextResponse) return { error: auth } as const;

  const target = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { clinicId: true },
  });
  if (!target) {
    return { error: NextResponse.json({ error: "not_found" }, { status: 404 }) } as const;
  }
  const scopeError = assertDoctorInClinic(auth.doctor, target.clinicId);
  if (scopeError) return { error: scopeError } as const;

  return { auth, clinicId: target.clinicId } as const;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ assessmentId: string }> },
) {
  const { assessmentId } = await ctx.params;
  const scoped = await scope(assessmentId);
  if ("error" in scoped) return scoped.error;

  const consultation = await prisma.consultation.findUnique({
    where: { assessmentId },
    select: { currentVersion: { select: { id: true, approvalStatus: true } } },
  });
  const version = consultation?.currentVersion;
  if (!version || String(version.approvalStatus) !== "APPROVED") {
    return NextResponse.json({ status: "not_approved" });
  }

  const asset = await findOnePagerAsset(version.id);
  if (!asset) {
    return NextResponse.json({ status: "unavailable" });
  }

  // Deliberately does NOT return the storage path or a signed URL. The doctor
  // already has the clinic's own download route for the sheet itself; this
  // endpoint answers a question about the artefact's state, and every extra
  // field on it is another way for a clinical object to reach somewhere it
  // was not meant to go.
  return NextResponse.json({
    status: asset.status,
    assetId: asset.id,
    consultationVersionId: asset.consultationVersionId,
    contentVersion: asset.contentVersion,
    templateVersion: asset.templateVersion,
    rendererVersion: asset.rendererVersion,
    attempts: asset.attemptCount,
    errorCode: asset.errorCode,
    generatedAt: asset.generatedAt?.toISOString() ?? null,
    byteSize: asset.byteSize,
    sha256: asset.sha256,
  });
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ assessmentId: string }> },
) {
  const { assessmentId } = await ctx.params;
  const scoped = await scope(assessmentId);
  if ("error" in scoped) return scoped.error;
  const { auth, clinicId } = scoped;

  // Ensure the row exists first. For a case approved before this pipeline
  // existed there is nothing to retry — there is something to request.
  const requested = await requestOnePagerRenderForAssessment(assessmentId, auth.authUserId);
  if (!requested.ok && requested.reason === "not_approved") {
    return NextResponse.json(
      { error: "not_approved", message: "Only an approved consultation has a one-pager." },
      { status: 409 },
    );
  }
  if (!requested.assetId) {
    return NextResponse.json(
      {
        error: "not_provisioned",
        message:
          "One-pager rendering is not switched on in this environment. Report links are unaffected.",
      },
      { status: 503 },
    );
  }

  // A FAILED row needs its budget back; a PENDING one just needs a nudge.
  const retried = await tolerant(() => resetForRetry(requested.assetId as string), false);
  await requestRenderDispatch(requested.assetId);

  await writeAuditLog({
    action: "REPORT_ASSET_REQUESTED",
    entityType: "ReportAsset",
    entityId: requested.assetId,
    actorId: auth.authUserId,
    actorRole: auth.authRole,
    actorType: auth.mode,
    assessmentId,
    clinicId,
    metadata: {
      trigger: "doctor_retry",
      actingDoctorId: auth.doctor.id,
      // Whether this reset a spent retry budget or simply re-rang the bell.
      // Different events, and an audit reader should not have to guess.
      resetFromFailed: retried,
      createdNow: requested.created,
    },
  }).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    assetId: requested.assetId,
    resetFromFailed: retried,
    created: requested.created,
  });
}

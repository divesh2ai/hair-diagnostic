// POST /api/consultation/[assessmentId]/report/prepare
//
// The deferred half of approval. POST /order returns as soon as the approval
// and kit order are durable (deferReportPrep); the review client then fires
// THIS request after it shows "Approved", so the doctor never waits on the
// one-pager snapshot (object-store upload) or the render request.
//
// This is the reliable, awaited mechanism the platform already supports — a
// real follow-up request, not a fire-and-forget promise a serverless freeze
// could drop. prepareApprovedReport is idempotent on the approved version, so a
// double-fire, a retry and the sweeper all converge on one artefact; it is a
// no-op until the version is APPROVED. Authorization mirrors the approval
// itself: an authenticated Doctor context, clinic-scoped to the assessment.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext, assertDoctorInClinic } from "@/lib/auth";
import { prepareApprovedReport } from "@/lib/consultation/approveAndCreateOrder";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctxParam: { params: Promise<{ assessmentId: string }> },
) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor } = authResult;

  const { assessmentId } = await ctxParam.params;

  const target = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { clinicId: true },
  });
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const scopeError = assertDoctorInClinic(doctor, target.clinicId);
  if (scopeError) return scopeError;

  const result = await prepareApprovedReport(prisma, {
    assessmentId,
    actorId: doctor.id,
  });
  return NextResponse.json(result);
}

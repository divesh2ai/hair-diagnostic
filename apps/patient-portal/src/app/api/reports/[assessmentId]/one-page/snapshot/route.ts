// GET /api/reports/[assessmentId]/one-page/snapshot
//
// The one-pager as it was preserved at approval, rather than as it would be
// composed today. Two different questions, and this route answers the one that
// matters after the fact: what did we actually hand this patient?
//
// `?version=N` selects a specific approved ConsultationVersion. Without it the
// route answers with the consultation's current version, which is the one the
// patient most recently received.
//
// Auth is the same rule the one-page page itself applies — a clinic member of
// the assessment's clinic, or a Super Admin. It is enforced here rather than
// delegated, because the stored object is fetched with the service-role key
// and therefore bypasses every policy the database would otherwise apply.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClinicContext, handleAuthError, isSuperAdmin } from "@/lib/auth";
import { readOnePagerSnapshot } from "@/lib/reports/one-page/snapshot";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ assessmentId: string }> },
) {
  const { assessmentId } = await ctx.params;

  let clinic;
  try {
    clinic = await getClinicContext();
  } catch (err) {
    return handleAuthError(err) ?? NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: {
      clinicId: true,
      consultations: {
        select: { currentVersion: { select: { contentVersion: true } } },
        take: 1,
      },
    },
  });
  if (!assessment) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!isSuperAdmin(clinic.role) && clinic.clinicId !== assessment.clinicId) {
    // A 404 rather than a 403, deliberately: a 403 would confirm that an
    // assessment with this id exists in some other clinic.
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const requested = new URL(req.url).searchParams.get("version");
  const currentVersion = assessment.consultations[0]?.currentVersion?.contentVersion ?? null;
  const version = requested !== null ? Number(requested) : currentVersion;

  if (version === null || !Number.isFinite(version)) {
    return NextResponse.json(
      { error: "no_version", message: "This assessment has no approved consultation version." },
      { status: 404 },
    );
  }

  const snapshot = await readOnePagerSnapshot(assessmentId, version);
  if (!snapshot) {
    // Absent is the ordinary answer for anything approved before snapshots
    // existed, and for a version that was never approved. Say which, so the
    // caller does not read "missing" as "lost".
    return NextResponse.json(
      {
        error: "no_snapshot",
        message:
          "No preserved one-pager for this version. Snapshots are written at approval; consultations approved earlier have none.",
        assessmentId,
        version,
      },
      { status: 404 },
    );
  }

  return NextResponse.json(snapshot);
}

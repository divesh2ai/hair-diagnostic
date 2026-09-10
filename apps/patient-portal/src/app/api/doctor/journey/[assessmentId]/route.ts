import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext, assertDoctorInClinic } from "@/lib/auth";
import { resolveJourney } from "@/lib/journey/resolveJourney";

// GET /api/doctor/journey/[assessmentId]
//
// The post-approval status strip on the doctor's review page. Answers "what
// happened after I approved this patient?" without the doctor phoning Ops.
//
// ── Why it is a separate call from the consultation ─────────────────────────
// The consultation payload is the clinical record and is what the page blocks
// on. This is seven optional reads, three of which sit on an unapplied
// migration, and none of which should be able to delay — or fail — the
// rendering of a clinical review. So it loads alongside, and its own resolver
// never throws: a stage that cannot be read renders as "unavailable" rather
// than as "did not happen".
//
// ── Tenant isolation ────────────────────────────────────────────────────────
// Same contract as every other /api/doctor/* route: an active Doctor identity,
// and the assessment must belong to that doctor's clinic. Cross-clinic reads
// live on /api/admin/* behind a super-admin gate — a doctor identity in clinic
// A must not reach into clinic B, and a journey is operational history about a
// named patient's care.

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ assessmentId: string }> },
) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor } = authResult;

  const { assessmentId } = await ctx.params;

  const target = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { clinicId: true },
  });
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const scopeError = assertDoctorInClinic(doctor, target.clinicId);
  if (scopeError) return scopeError;

  const journey = await resolveJourney(assessmentId);
  return NextResponse.json(journey);
}

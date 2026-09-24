// GET /api/consultation/[assessmentId]/operational
//
// The deferred half of the review page's load. The page renders the core
// clinical case immediately (see lib/consultation/loadReview's deferOperational
// and the page.tsx header); the client then calls this to fill the non-critical
// operational sections — the report-status pill, the post-approval delivery
// block and the patient journey. Nothing clinical for the doctor's read/decide
// depends on it, so it is off the first-paint path.
//
// Authorization is the SAME as the full review read: an authenticated Doctor
// context plus a clinic-scope check against the target assessment. This is not
// a public or lighter-auth surface — it just returns less.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext, assertDoctorInClinic } from "@/lib/auth";
import { readOperationalState } from "@/lib/consultation/meta";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctxParam: { params: Promise<{ assessmentId: string }> },
) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor } = authResult;

  const { assessmentId } = await ctxParam.params;

  // Clinic scope: the operational read is keyed by assessmentId, so it must be
  // gated the same way the clinical read is — a doctor may only see the
  // operational state of an assessment in their own clinic.
  const target = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { clinicId: true },
  });
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const scopeError = assertDoctorInClinic(doctor, target.clinicId);
  if (scopeError) return scopeError;

  // readOperationalState is total — it reports degraded dependencies rather
  // than throwing — so this always answers with an operational shape.
  const operational = await readOperationalState(prisma, assessmentId);
  return NextResponse.json({ operational });
}

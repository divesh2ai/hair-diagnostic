import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertDoctorInClinic, requireDoctorContext } from "@/lib/auth";
import { readOperationalState } from "@/lib/consultation/meta";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { assessmentId } = await params;
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { clinicId: true, deletedAt: true },
  });
  if (!assessment || assessment.deletedAt || assertDoctorInClinic(authResult.doctor, assessment.clinicId)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ operational: await readOperationalState(prisma, assessmentId) });
}

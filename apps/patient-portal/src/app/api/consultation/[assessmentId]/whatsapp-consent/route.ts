import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertDoctorInClinic, requireDoctorContext } from "@/lib/auth";
import { getPatientWhatsappConsent } from "@/lib/patient/whatsappConsent";

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
    select: { clinicId: true, patientId: true, deletedAt: true },
  });
  if (!assessment || assessment.deletedAt || assertDoctorInClinic(authResult.doctor, assessment.clinicId)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const consent = await getPatientWhatsappConsent(assessment.patientId);
  return NextResponse.json({ consent: { consent: consent.consent, provisioned: consent.provisioned } });
}

import { prisma } from "@/lib/prisma";

/**
 * True iff the patient exists and belongs to this clinic. The single place the
 * doctor surfaces answer "is this my clinic's patient?", so the tenant check is
 * expressed once and the same way everywhere, rather than re-inlined per route.
 */
export async function ensurePatientInClinic(
  patientId: string,
  clinicId: string,
): Promise<boolean> {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, clinicId },
    select: { id: true },
  });
  return patient !== null;
}

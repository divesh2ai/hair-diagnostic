import { prisma } from "@/lib/prisma";
import { DEFAULT_KIT_QUANTITY } from "./kitQuantity";

// The approved kit orders for a patient, read from KitOrderIntent — the source
// of truth for what was RECOMMENDED. Kept here (prisma-using) so the patient
// treatment-history route stays free of direct prisma access and the recommended
// lineup is available even before any purchase-ledger rows exist.

export interface ApprovedKitOrder {
  intentId: string;
  assessmentId: string;
  /** Recommended kits, in approval order. */
  kits: { kitId: string; recommendedBoxes: number }[];
}

function recommendedBoxesFor(quantities: unknown, kitId: string): number {
  if (quantities && typeof quantities === "object") {
    const v = (quantities as Record<string, unknown>)[kitId];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return Math.trunc(v);
  }
  return DEFAULT_KIT_QUANTITY;
}

/**
 * Every approved kit order for a patient within the clinic. Scoped by the
 * consultation's patient and the clinic, so it never reaches another tenant's
 * orders. Returns recommendations regardless of whether anything was purchased.
 */
export async function listPatientApprovedOrders(
  clinicId: string,
  patientId: string,
): Promise<ApprovedKitOrder[]> {
  const intents = await prisma.kitOrderIntent.findMany({
    where: { clinicId, consultation: { patientId } },
    select: { id: true, assessmentId: true, kitIds: true, quantities: true },
    orderBy: { createdAt: "asc" },
  });
  return intents.map((i) => ({
    intentId: i.id,
    assessmentId: i.assessmentId,
    kits: i.kitIds.map((kitId) => ({
      kitId,
      recommendedBoxes: recommendedBoxesFor(i.quantities, kitId),
    })),
  }));
}

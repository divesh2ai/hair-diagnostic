import { NextResponse } from "next/server";
import { SystemRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { getKitInfo } from "@hairos/packages/registries/kits/info";
import { KIT_PRICE_INR, priceForKit, formatInr } from "@/lib/pricing/kitPrices";

// GET /api/kits — the orderable kit catalog for the doctor's lineup editor.
//
// One entry per canonical orderable kit id (the same ids KitOrderIntent and
// the patient cart use). Carries enough registry detail for the client to
// build a full TreatmentPhase when the doctor adds a kit manually, so a
// doctor-added kit renders identically to an engine-selected one.

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireRole(
    SystemRole.DOCTOR,
    SystemRole.CLINIC_ADMIN,
    SystemRole.SUPER_ADMIN,
  );
  if (auth instanceof NextResponse) return auth;

  const items = Object.keys(KIT_PRICE_INR).map((kitId) => {
    const info = getKitInfo(kitId);
    return {
      kitId,
      displayName: info?.displayName ?? kitId,
      treatmentObjective: info?.treatmentObjective ?? null,
      therapeuticStrategy: info?.therapeuticStrategy ?? [],
      formulationRationale: info?.formulationRationale ?? [],
      priceInr: priceForKit(kitId),
      priceLabel: formatInr(priceForKit(kitId)),
    };
  });

  return NextResponse.json({ items });
}

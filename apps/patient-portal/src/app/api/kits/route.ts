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

  // Only kits with a documented registry entry are offerable.
  //
  // The catalog was keyed off the PRICE table, and several ids there have no
  // KitInfo — so the lineup editor listed them by their raw internal code
  // ("TE_GOLD_VEG", "HEALTHY_9") with a price and no description. A doctor
  // choosing from that dropdown could not tell what those were, or that two of
  // them were the same product as an entry three rows above.
  //
  // They are filtered from the ADD list rather than deleted from the price
  // table: an id that is not offerable today may still appear on a historic
  // KitOrderIntent, and that order must keep pricing correctly.
  //
  // The fix for a kit that SHOULD be offerable is to give it a registry entry,
  // not to relax this filter.
  const items = Object.keys(KIT_PRICE_INR)
    .map((kitId) => ({ kitId, info: getKitInfo(kitId) }))
    .filter((e): e is { kitId: string; info: NonNullable<typeof e.info> } => e.info !== null)
    .map(({ kitId, info }) => ({
      kitId,
      displayName: info.displayName,
      treatmentObjective: info.treatmentObjective ?? null,
      therapeuticStrategy: info.therapeuticStrategy ?? [],
      formulationRationale: info.formulationRationale ?? [],
      priceInr: priceForKit(kitId),
      priceLabel: formatInr(priceForKit(kitId)),
    }));

  return NextResponse.json({ items });
}

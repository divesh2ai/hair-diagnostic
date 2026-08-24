import { NextResponse } from "next/server";
import { SystemRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/auth/roles";
import { getKitInfo } from "@hairos/packages/registries/kits/info";
import { priceForKit, formatInr, totalRevenueInr } from "@/lib/pricing/kitPrices";

// GET /api/doctor/orders — recent KitOrderIntent rows for the caller's
// clinic. Super admin sees platform-wide. Feeds the /doctor/orders and
// /clinic/orders tables.
//
// ── Why line items are resolved HERE ────────────────────────────────────────
// The table used to render `kitIds.length` and nothing else, so the one fact
// an order page exists to carry — WHAT was ordered — was the one fact it did
// not show. A doctor chasing "did Meera get the right kits?" had to open the
// clinical review and read the protocol.
//
// Names and prices are resolved server-side against the same registry and
// price table the patient's cart uses (`getKitInfo` + `priceForKit`), so the
// doctor's order list and the patient's cart cannot disagree about what was
// ordered or what it costs. Resolving them in the client would be a second
// source of truth for money.
//
// An id with no registry entry keeps its raw id as the name rather than being
// dropped: a historic order may reference a kit that is no longer offerable,
// and silently omitting a line would understate what shipped.

const LIMIT = 100;

export async function GET() {
  const auth = await requireRole(
    SystemRole.DOCTOR,
    SystemRole.CLINIC_ADMIN,
    SystemRole.SUPER_ADMIN,
    SystemRole.STAFF,
  );
  if (auth instanceof NextResponse) return auth;

  const where = isSuperAdmin(auth.user_role)
    ? {}
    : { clinicId: auth.clinic_id ?? "__none__" };

  const rows = await prisma.kitOrderIntent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: LIMIT,
    select: {
      id: true,
      status: true,
      kitIds: true,
      createdAt: true,
      assessment: {
        select: { id: true, patient: { select: { name: true } } },
      },
      doctor: { select: { name: true } },
      clinic: { select: { name: true } },
    },
  });

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      status: r.status,
      kitCount: r.kitIds.length,
      kitIds: r.kitIds,
      lineItems: r.kitIds.map((kitId) => ({
        kitId,
        displayName: getKitInfo(kitId)?.displayName ?? kitId,
        priceInr: priceForKit(kitId),
        priceLabel: formatInr(priceForKit(kitId)),
      })),
      totalInr: totalRevenueInr(r.kitIds),
      totalLabel: formatInr(totalRevenueInr(r.kitIds)),
      patientName: r.assessment?.patient?.name ?? "—",
      assessmentId: r.assessment?.id ?? null,
      doctorName: r.doctor?.name ?? "—",
      clinicName: r.clinic?.name ?? "—",
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

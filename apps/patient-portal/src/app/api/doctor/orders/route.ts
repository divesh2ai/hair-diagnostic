import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext } from "@/lib/auth";
import { buildDoctorOrderPricing } from "@/lib/doctor/orderPricing";

// GET /api/doctor/orders — recent KitOrderIntent rows for the caller's own
// clinic. Feeds the /doctor/orders table.
//
// ── Why this is pinned to the Doctor row ────────────────────────────────────
// It used to authorise with `requireRole(DOCTOR | CLINIC_ADMIN | SUPER_ADMIN |
// STAFF)` and scope by the JWT's `clinic_id` claim, widening to EVERY clinic
// for a super admin. The claim is JWKS-verified, so nothing here was forgeable
// — but it made this the one /api/doctor route that did not follow the rule
// the rest of the surface states explicitly (see lib/auth/doctorContext):
// cross-clinic reads are not permitted on Doctor APIs even for admins, and
// live on /api/admin/* under their own gate.
//
// It also produced a scope mismatch a doctor could see: the dashboard counts
// "Awaiting fulfilment" for one clinic and links straight here, which for a
// super admin then listed the whole platform. Same helper as every sibling
// route now, so the count and its destination agree.
//
// The /doctor layout already redirects an admin with no Doctor row away from
// this workspace, so nothing that could previously reach the PAGE loses access
// to the API.
//
// ── Why line items are resolved HERE ────────────────────────────────────────
// The table used to render `kitIds.length` and nothing else, so the one fact
// an order page exists to carry — WHAT was ordered — was the one fact it did
// not show. A doctor chasing "did Meera get the right kits?" had to open the
// clinical review and read the protocol.
//
// Names and prices are resolved server-side through the SAME governance
// authority the patient's cart bills against (`buildDoctorOrderPricing` →
// `evaluateOrderForPatientCharge`), so the doctor's order list and the patient's
// cart cannot disagree about what was ordered or what it costs. A kit that is
// not resolved to an approved catalogue price shows the cart's own review /
// pending state rather than an invented ₹5,500 placeholder, and a part-priced
// order carries no total. Resolving this in the client would be a second source
// of truth for money. (See lib/doctor/orderPricing for the full rationale.)
//
// An id with no registry entry keeps its raw id as the name rather than being
// dropped: a historic order may reference a kit that is no longer offerable,
// and silently omitting a line would understate what shipped.

const LIMIT = 100;

export async function GET() {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor } = authResult;

  const where = { clinicId: doctor.clinicId };

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
    items: rows.map((r) => {
      const pricing = buildDoctorOrderPricing(r.kitIds);
      return {
        id: r.id,
        status: r.status,
        kitCount: r.kitIds.length,
        kitIds: r.kitIds,
        lineItems: pricing.lineItems,
        chargeable: pricing.chargeable,
        totalInr: pricing.totalInr,
        totalLabel: pricing.totalLabel,
        patientName: r.assessment?.patient?.name ?? "—",
        assessmentId: r.assessment?.id ?? null,
        doctorName: r.doctor?.name ?? "—",
        clinicName: r.clinic?.name ?? "—",
        createdAt: r.createdAt.toISOString(),
      };
    }),
  });
}

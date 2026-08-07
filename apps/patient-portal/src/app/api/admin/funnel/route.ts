import { NextResponse } from "next/server";
import { SystemRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

// GET /api/admin/funnel — platform-wide conversion funnel for the super
// admin dashboard. Counts across all clinics; scope narrowing lives in the
// clinic-admin view instead.

export async function GET() {
  const auth = await requireRole(SystemRole.SUPER_ADMIN);
  if (auth instanceof NextResponse) return auth;

  const [assessmentsStarted, assessmentsCompleted, reviewsCompleted, kitOrders, kitOrdersActive] =
    await Promise.all([
      prisma.assessment.count(),
      prisma.assessment.count({ where: { submittedAt: { not: null } } }),
      prisma.assessment.count({
        where: { reviewDecision: { in: ["APPROVED", "NEEDS_REVISION"] } },
      }),
      prisma.kitOrderIntent.count(),
      prisma.kitOrderIntent.count({ where: { status: "READY_FOR_FULFILMENT" } }),
    ]);

  const clinicCount = await prisma.clinic.count({ where: { deletedAt: null } });
  const doctorCount = await prisma.doctor.count({ where: { deletedAt: null } });

  return NextResponse.json({
    counts: {
      clinics: clinicCount,
      doctors: doctorCount,
    },
    funnel: {
      started: assessmentsStarted,
      completed: assessmentsCompleted,
      reviewed: reviewsCompleted,
      orders: kitOrders,
      ordersActive: kitOrdersActive,
    },
  });
}

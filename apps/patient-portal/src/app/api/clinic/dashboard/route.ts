import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  clinicScope,
  getClinicContext,
  handleAuthError,
  isSuperAdmin,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

// Clinic Admin dashboard. Super Admin may inspect any clinic via ?clinicId=.
export async function GET(req: Request) {
  try {
    const ctx = await getClinicContext();
    const url = new URL(req.url);
    const requestedClinicId = url.searchParams.get("clinicId");
    const scope = isSuperAdmin(ctx.role)
      ? requestedClinicId
        ? { clinicId: requestedClinicId }
        : {}
      : clinicScope(ctx);

    const baseWhere = { ...scope, deletedAt: null };
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      todayQueue,
      pendingReviews,
      approvedReports,
      doctors,
      patients,
    ] = await Promise.all([
      prisma.assessment.count({
        where: { ...baseWhere, submittedAt: { gte: startOfToday } },
      }),
      prisma.assessment.count({
        where: { ...baseWhere, reviewDecision: "PENDING", status: "COMPLETED" },
      }),
      prisma.assessment.count({
        where: { ...baseWhere, reviewDecision: "APPROVED" },
      }),
      prisma.doctor.count({ where: baseWhere }),
      prisma.patient.count({ where: baseWhere }),
    ]);

    return NextResponse.json({
      metrics: {
        todayQueue,
        pendingReviews,
        approvedReports,
        doctors,
        patients,
      },
    });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[CLINIC DASHBOARD]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

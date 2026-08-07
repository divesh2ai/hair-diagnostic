import { NextResponse } from "next/server";
import { SystemRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

// GET /api/clinic/productivity — per-doctor stats for the clinic-admin
// leaderboard. Scoped to the caller's clinic.
//
// Perf: batched with groupBy so we hit Postgres 3× total regardless of the
// number of doctors, instead of 4×N sequential counts.

export async function GET() {
  const auth = await requireRole(SystemRole.CLINIC_ADMIN, SystemRole.SUPER_ADMIN);
  if (auth instanceof NextResponse) return auth;

  const clinicId = auth.clinic_id;
  if (!clinicId) {
    return NextResponse.json({ items: [] });
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [doctors, decisionsMonth, ordersMonth, ordersAll] = await Promise.all([
    prisma.doctor.findMany({
      where: { clinicId, deletedAt: null, isActive: true },
      select: { id: true, name: true, specialization: true, photoUrl: true, avatarUrl: true },
    }),
    prisma.assessment.groupBy({
      by: ["reviewingDoctorId", "reviewDecision"],
      where: {
        clinicId,
        reviewedAt: { gte: monthStart },
        reviewDecision: { in: ["APPROVED", "NEEDS_REVISION"] },
      },
      _count: { _all: true },
    }),
    prisma.kitOrderIntent.groupBy({
      by: ["doctorId"],
      where: { clinicId, createdAt: { gte: monthStart } },
      _count: { _all: true },
    }),
    prisma.kitOrderIntent.groupBy({
      by: ["doctorId"],
      where: { clinicId },
      _count: { _all: true },
    }),
  ]);

  const approvedByDoctor = new Map<string, number>();
  const revisionByDoctor = new Map<string, number>();
  for (const row of decisionsMonth) {
    if (!row.reviewingDoctorId) continue;
    const target = row.reviewDecision === "APPROVED" ? approvedByDoctor : revisionByDoctor;
    target.set(row.reviewingDoctorId, (target.get(row.reviewingDoctorId) ?? 0) + row._count._all);
  }
  const orderMonthByDoctor = new Map(ordersMonth.map((r) => [r.doctorId, r._count._all]));
  const orderAllByDoctor = new Map(ordersAll.map((r) => [r.doctorId, r._count._all]));

  const items = doctors
    .map((d) => {
      const approvedMonth = approvedByDoctor.get(d.id) ?? 0;
      const revisionMonth = revisionByDoctor.get(d.id) ?? 0;
      const totalReviewed = approvedMonth + revisionMonth;
      const revisionRate = totalReviewed > 0 ? Math.round((revisionMonth / totalReviewed) * 100) : 0;
      return {
        id: d.id,
        name: d.name,
        specialization: d.specialization ?? null,
        photoUrl: d.avatarUrl ?? d.photoUrl ?? null,
        approvedMonth,
        revisionMonth,
        orderMonth: orderMonthByDoctor.get(d.id) ?? 0,
        ordersAll: orderAllByDoctor.get(d.id) ?? 0,
        revisionRate,
      };
    })
    .sort((a, b) => b.approvedMonth - a.approvedMonth);

  return NextResponse.json({ items });
}

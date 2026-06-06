import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** RBAC: In production, filter by authenticated doctorId from session. */
export async function GET(req: Request) {
  const doctorId = new URL(req.url).searchParams.get("doctorId");

  try {
    const patients = await prisma.patient.findMany({
      where: doctorId ? { doctorId } : undefined,
      take: 50,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { assessments: true } },
        assessments: {
          take: 1,
          orderBy: { submittedAt: "desc" },
          select: { id: true, status: true, submittedAt: true },
        },
      },
    });

    return NextResponse.json({
      patients: patients.map((p) => ({
        id: p.id,
        name: p.name,
        phone: p.phone,
        assessmentCount: p._count.assessments,
        lastAssessment: p.assessments[0]?.submittedAt?.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Doctor patients API:", error);
    return NextResponse.json({ patients: [] });
  }
}

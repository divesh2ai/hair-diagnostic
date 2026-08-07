import { NextResponse } from "next/server";
import { SystemRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/auth/roles";

// GET /api/clinic/leads — inbound public lead-form submissions for the
// caller's clinic (super admin sees all).

const LIMIT = 100;

export async function GET() {
  const auth = await requireRole(
    SystemRole.CLINIC_ADMIN,
    SystemRole.SUPER_ADMIN,
    SystemRole.DOCTOR,
    SystemRole.STAFF,
  );
  if (auth instanceof NextResponse) return auth;

  const rows = await prisma.auditLog.findMany({
    where: { entityType: "LEAD" },
    orderBy: { createdAt: "desc" },
    take: LIMIT,
    select: { id: true, metadata: true, createdAt: true },
  });

  const items = rows
    .map((r) => {
      const md = (r.metadata ?? {}) as Record<string, unknown>;
      return {
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        clinicId: (md.clinicId as string) ?? null,
        clinicSlug: (md.clinicSlug as string) ?? null,
        name: (md.name as string) ?? "",
        phone: (md.phone as string) ?? "",
        language: (md.language as string) ?? null,
        source: (md.source as string) ?? "web",
        notes: (md.notes as string) ?? null,
      };
    })
    .filter((r) =>
      isSuperAdmin(auth.user_role) ? true : r.clinicId === auth.clinic_id,
    );

  return NextResponse.json({ items });
}

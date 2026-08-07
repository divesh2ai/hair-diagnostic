import { NextResponse } from "next/server";
import { SystemRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/auth/roles";

// GET /api/notifications — last N AuditLog entries scoped to the caller's
// clinic. Super admins see cross-tenant events. Feeds the header bell.

const LIMIT = 20;

export async function GET() {
  const auth = await requireRole(
    SystemRole.DOCTOR,
    SystemRole.CLINIC_ADMIN,
    SystemRole.SUPER_ADMIN,
    SystemRole.STAFF,
  );
  if (auth instanceof NextResponse) return auth;

  // Super-admin sees the platform feed; everyone else is scoped to their
  // clinic's assessments (AuditLog rows joined via the Assessment relation).
  const where = isSuperAdmin(auth.user_role)
    ? {}
    : { assessment: { clinicId: auth.clinic_id ?? "__none__" } };

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: LIMIT,
    select: {
      id: true,
      actorType: true,
      actorRole: true,
      entityType: true,
      action: true,
      metadata: true,
      createdAt: true,
      assessment: {
        select: { id: true, patient: { select: { name: true } } },
      },
    },
  });

  return NextResponse.json({
    unread: rows.length,
    items: rows.map((r) => ({
      id: r.id,
      title: humanTitle(r.action, r.entityType),
      subtitle: r.assessment?.patient?.name ?? r.entityType,
      href: r.assessment ? `/doctor/reports/${r.assessment.id}` : null,
      actor: r.actorType ?? r.actorRole ?? "system",
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

function humanTitle(action: string, entityType: string): string {
  const a = action.toUpperCase();
  if (a.includes("DOCTOR_REVIEW_COMPLETED")) return "Consultation approved";
  if (a.includes("NEEDS_REVISION")) return "Report sent back for revision";
  if (a.includes("CONSULTATION_UPDATED")) return "Consultation edited";
  if (a.includes("KIT_ORDER")) return "Kit order intent created";
  if (a.includes("ASSESSMENT_SUBMITTED")) return "New assessment submitted";
  if (a.includes("DOCTOR_INVITED")) return "Doctor invited to clinic";
  if (a.includes("CLINIC_")) return "Clinic settings updated";
  return `${entityType} · ${action}`;
}

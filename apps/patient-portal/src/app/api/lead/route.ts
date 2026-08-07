import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// POST /api/lead — public. Captures lead-form submissions from
// /lead/[clinicSlug] into AuditLog with entityType="LEAD". Clinic-admin
// leadboard reads back from the same table (see /clinic/leads).
//
// No auth: intentionally open so ad landing pages can post directly.
// Rate-limit at the CDN / middleware layer (not implemented in this stub).

const Body = z.object({
  clinicSlug: z.string().min(1).max(120),
  name: z.string().min(1).max(120),
  phone: z.string().min(6).max(20),
  language: z.string().max(6).optional(),
  source: z.string().max(60).optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
  }
  const { clinicSlug, name, phone, language, source, notes } = parsed.data;

  const clinic = await prisma.clinic.findFirst({
    where: { slug: clinicSlug, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!clinic) {
    return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
  }

  await prisma.auditLog.create({
    data: {
      actorType: "public",
      entityType: "LEAD",
      entityId: `lead:${clinic.id}:${Date.now()}`,
      action: "LEAD_SUBMITTED",
      metadata: {
        clinicId: clinic.id,
        clinicSlug,
        name,
        phone,
        language: language ?? null,
        source: source ?? "web",
        notes: notes ?? null,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    assessmentUrl: `/q/${clinicSlug}`,
  });
}

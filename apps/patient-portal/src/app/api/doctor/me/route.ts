import { NextResponse } from "next/server";
import { SystemRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Slim self-context endpoint for the /doctor header chrome. Returns the
// clinic display fields the workspace shows (name, logo, tagline) and
// the signed-in clinician's name. Used by the layout so the header
// reflects per-clinic branding instead of a static "DrFACT Doctor Console".
export async function GET() {
  const auth = await requireRole(
    SystemRole.DOCTOR,
    SystemRole.CLINIC_ADMIN,
    SystemRole.SUPER_ADMIN,
    SystemRole.STAFF,
  );
  if (auth instanceof NextResponse) return auth;

  const [clinic, doctor] = await Promise.all([
    auth.clinic_id
      ? prisma.clinic.findUnique({
          where: { id: auth.clinic_id },
          select: { name: true, slug: true, logoUrl: true, tagline: true },
        })
      : null,
    prisma.doctor.findFirst({
      where: { supabaseUserId: auth.sub },
      select: { id: true, name: true, photoUrl: true, specialization: true },
    }),
  ]);

  return NextResponse.json({
    clinic,
    doctor,
    role: auth.user_role,
    email: auth.email,
  });
}

import { prisma } from "@/lib/prisma";
import { PLATFORM_BRANDING, type ClinicBranding } from "./types";

// Resolve the branding payload for the currently signed-in user/clinic.
// Pure server function — call from a layout / RSC and pass the result into
// <BrandingProvider initial={…}>.
//
// Inputs:
//   clinicId  — from JWT claims (proxy already sets x-clinic-id header)
//   userId    — Supabase sub, used to look up the matching Doctor row so
//               the header chrome can show the right avatar.
//
// Falls back to PLATFORM_BRANDING for Super Admin (no clinicId) or when
// the clinic row has been soft-deleted.
export async function loadClinicBranding(opts: {
  clinicId: string | null;
  userId: string | null;
}): Promise<ClinicBranding> {
  if (!opts.clinicId) return PLATFORM_BRANDING;

  const [clinic, doctor] = await Promise.all([
    prisma.clinic.findFirst({
      where: { id: opts.clinicId, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        tagline: true,
        primaryColor: true,
        secondaryColor: true,
        pdfBranding: true,
        reportBranding: true,
      },
    }),
    opts.userId
      ? prisma.doctor.findFirst({
          where: { supabaseUserId: opts.userId, deletedAt: null },
          select: { name: true, avatarUrl: true, photoUrl: true, signatureUrl: true },
        })
      : Promise.resolve(null),
  ]);

  if (!clinic) return PLATFORM_BRANDING;

  return {
    clinicId: clinic.id,
    clinicName: clinic.name,
    clinicSlug: clinic.slug,
    logoUrl: clinic.logoUrl,
    faviconUrl: null, // future: Clinic.faviconUrl
    primaryColor: clinic.primaryColor,
    secondaryColor: clinic.secondaryColor,
    tagline: clinic.tagline,
    doctorAvatarUrl: doctor?.avatarUrl ?? doctor?.photoUrl ?? null,
    doctorName: doctor?.name ?? null,
    doctorSignatureUrl: doctor?.signatureUrl ?? null,
    pdfBranding: (clinic.pdfBranding as Record<string, unknown> | null) ?? null,
    reportBranding: (clinic.reportBranding as Record<string, unknown> | null) ?? null,
  };
}

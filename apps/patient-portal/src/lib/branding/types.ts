// Clinic branding payload — denormalized from Prisma Clinic + Doctor.
// Loaded once on the server, threaded through BrandingProvider, applied as
// CSS variables on <html>.

export type ClinicBranding = {
  clinicId: string;
  clinicName: string;
  clinicSlug: string;

  // Visual identity
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null; // hex e.g. "#1A73E8"
  secondaryColor: string | null;
  tagline: string | null;

  // Current doctor's avatar — header chrome / report attribution.
  doctorAvatarUrl: string | null;
  doctorName: string | null;
  doctorSignatureUrl: string | null;

  // PDF/Report branding payloads — shape opaque to UI; consumed by the
  // pdf-engine + report renderer.
  pdfBranding: Record<string, unknown> | null;
  reportBranding: Record<string, unknown> | null;
};

// Platform-default branding for routes outside any clinic context
// (Super Admin console, login page). Never null-checked downstream.
export const PLATFORM_BRANDING: ClinicBranding = {
  clinicId: "__platform__",
  clinicName: "HairOS",
  clinicSlug: "platform",
  logoUrl: null,
  faviconUrl: null,
  primaryColor: null,
  secondaryColor: null,
  tagline: null,
  doctorAvatarUrl: null,
  doctorName: null,
  doctorSignatureUrl: null,
  pdfBranding: null,
  reportBranding: null,
};

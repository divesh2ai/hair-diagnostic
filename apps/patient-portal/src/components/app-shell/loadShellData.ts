import { redirect } from "next/navigation";
import {
  getClinicContext,
  UnauthorizedError,
} from "@/lib/auth";
import { loadClinicBranding, PLATFORM_BRANDING } from "@/lib/branding";
import { readServerLocale } from "@/lib/i18n/server";
import { navForRole, type NavSection } from "@/lib/navigation";
import type { SystemRole } from "@/lib/auth";
import type { ClinicBranding } from "@/lib/branding";

export type ShellData = {
  role: SystemRole;
  userId: string;
  clinicId: string | null;
  email: string | null;
  branding: ClinicBranding;
  locale: string;
  nav: NavSection[];
};

// Centralised data load for every authenticated layout. Redirects to /login
// when there's no session — saves every layout from duplicating the dance.
export async function loadShellData(): Promise<ShellData> {
  try {
    const ctx = await getClinicContext();
    const [branding, locale] = await Promise.all([
      loadClinicBranding({ clinicId: ctx.clinicId, userId: ctx.userId }),
      readServerLocale(),
    ]);
    // Email isn't on the claims surface we expose; layouts that want it can
    // pull from /api/doctor/me. The shell falls back to the userId tail.
    return {
      role: ctx.role,
      userId: ctx.userId,
      clinicId: ctx.clinicId,
      email: null,
      branding,
      locale,
      nav: navForRole(ctx.role),
    };
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      redirect("/login");
    }
    // Re-throw — middleware / error boundary will handle.
    throw err;
  }
}

// Variant for routes that must be reached only by Super Admin.
export async function loadSuperAdminShellData(): Promise<ShellData> {
  const data = await loadShellData();
  if (data.role !== "SUPER_ADMIN") redirect("/");
  // Super Admin has no clinic of their own — always shows platform branding.
  return { ...data, branding: PLATFORM_BRANDING };
}

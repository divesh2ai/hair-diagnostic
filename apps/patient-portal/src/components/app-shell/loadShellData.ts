import { redirect } from "next/navigation";
import {
  getClinicContext,
  UnauthorizedError,
} from "@/lib/auth";
import { loadClinicBranding, PLATFORM_BRANDING } from "@/lib/branding";
import { readServerLocale } from "@/lib/i18n/server";
import { navForRole, type NavSection } from "@/lib/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { SystemRole } from "@/lib/auth";
import type { ClinicBranding } from "@/lib/branding";

export type ShellData = {
  role: SystemRole;
  userId: string;
  clinicId: string | null;
  email: string | null;
  displayName: string | null;
  branding: ClinicBranding;
  locale: string;
  nav: NavSection[];
};

// Resolve a friendly first name by walking the same precedence the JWT hook
// uses. Match by supabaseUserId first, fall back to email so pre-provisioned
// rows still personalize before backfill.
async function resolveDisplayName(
  role: SystemRole,
  userId: string,
  email: string | null,
): Promise<string | null> {
  // Match by supabaseUserId first; fall back to email so pre-provisioned rows
  // still personalize before their supabaseUserId is backfilled.
  //
  // Note: OrganizationMember.supabaseUserId is NON-NULL (schema), so we cannot
  // filter with `supabaseUserId: null` — Prisma rejects that. The OR just lists
  // both match criteria without constraining the other field.
  const orClauses: Array<Record<string, unknown>> = [{ supabaseUserId: userId }];
  if (email) orClauses.push({ email });

  if (role === "SUPER_ADMIN" || role === "ORG_ADMIN") {
    const om = await prisma.organizationMember.findFirst({
      where: { OR: orClauses },
      select: { name: true },
    });
    if (om?.name) return om.name;
  }
  if (role === "DOCTOR" || role === "CLINIC_ADMIN") {
    const doc = await prisma.doctor.findFirst({
      where: { OR: orClauses, isActive: true },
      select: { name: true },
    });
    if (doc?.name) return doc.name;
  }
  if (role === "CLINIC_ADMIN" || role === "STAFF") {
    const cm = await prisma.clinicMember.findFirst({
      where: { OR: orClauses, isActive: true },
      select: { name: true },
    });
    if (cm?.name) return cm.name;
  }
  return null;
}

// Centralised data load for every authenticated layout. Redirects to /login
// when there's no session — saves every layout from duplicating the dance.
export async function loadShellData(): Promise<ShellData> {
  try {
    const ctx = await getClinicContext();
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email ?? null;

    const [branding, locale, displayName] = await Promise.all([
      loadClinicBranding({ clinicId: ctx.clinicId, userId: ctx.userId }),
      readServerLocale(),
      resolveDisplayName(ctx.role, ctx.userId, email),
    ]);
    return {
      role: ctx.role,
      userId: ctx.userId,
      clinicId: ctx.clinicId,
      email,
      displayName,
      branding,
      locale,
      nav: navForRole(ctx.role),
    };
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      redirect("/login");
    }
    // Surface real reason in server logs AND rethrow with a distinct message
    // so a 500 page tells us where. Vercel truncates React errors otherwise.
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error("[SHELL_LOAD_FAIL]", msg, err instanceof Error ? err.stack : "");
    throw new Error(`SHELL_LOAD_FAIL: ${msg}`);
  }
}

// Variant for routes that must be reached only by Super Admin.
export async function loadSuperAdminShellData(): Promise<ShellData> {
  const data = await loadShellData();
  if (data.role !== "SUPER_ADMIN") redirect("/");
  // Super Admin has no clinic of their own — always shows platform branding.
  return { ...data, branding: PLATFORM_BRANDING };
}

// Best-effort first-name extraction for greetings: "Dr. Divesh Shah" → "Divesh".
export function firstNameOf(displayName: string | null, email: string | null): string {
  if (displayName) {
    const stripped = displayName.replace(/^(Dr\.?|Prof\.?|Mr\.?|Mrs\.?|Ms\.?)\s+/i, "").trim();
    const first = stripped.split(/\s+/)[0];
    if (first) return first;
  }
  if (email) {
    const local = email.split("@")[0]?.split("+")[0] ?? "";
    if (local) return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return "there";
}

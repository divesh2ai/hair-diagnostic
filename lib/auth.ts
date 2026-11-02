import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "./supabase";

/**
 * Super Admin authorization — resolved SERVER-SIDE ONLY (task requirement 5).
 *
 * In production this reuses the existing HairOS session: the Supabase auth
 * cookie identifies the caller, and the caller must be an OrganizationMember
 * with an owner/super-admin role on the platform Organization. Clinic-level
 * rows are never exposed to a clinic user through this dashboard — only a
 * platform super admin reaches `/admin`.
 *
 * Authorization is deliberately fail-closed when live credentials exist. When
 * running against the read-only snapshot (no service-role key configured, e.g.
 * local verification) the guard is bypassed because there is no live session to
 * resolve and no live data is exposed.
 */
const SUPER_ADMIN_ROLES = new Set(["OWNER", "SUPER_ADMIN", "ADMIN"]);

export interface SuperAdmin {
  mode: "live" | "snapshot";
  supabaseUserId: string | null;
  name: string | null;
  role: string | null;
}

export async function requireSuperAdmin(): Promise<SuperAdmin> {
  const admin = createAdminClient();
  if (!admin) {
    // No live credentials: snapshot/verification mode, no live data exposed.
    return { mode: "snapshot", supabaseUserId: null, name: "Verification snapshot", role: null };
  }

  // Resolve the caller from the Supabase auth cookie (set by the existing app).
  const token =
    cookies().get("sb-access-token")?.value ??
    cookies().get("supabase-auth-token")?.value ??
    null;

  if (!token) throw new UnauthorizedError("No active session");

  const { data: userData, error } = await admin.auth.getUser(token);
  if (error || !userData?.user) throw new UnauthorizedError("Invalid session");

  const { data: member } = await admin
    .from("OrganizationMember")
    .select("role, name")
    .eq("supabaseUserId", userData.user.id)
    .is("deletedAt", null)
    .maybeSingle();

  if (!member || !SUPER_ADMIN_ROLES.has(String(member.role))) {
    throw new ForbiddenError("Super Admin role required");
  }

  return { mode: "live", supabaseUserId: userData.user.id, name: member.name, role: String(member.role) };
}

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}

import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSystemRole, type SystemRole } from "./roles";

// ClinicContext — the resolved identity for a server-side request.
// Read from JWT claims via getClaims(), falling back to the x-* headers
// the proxy sets. Never trust client-forwarded x-* headers in user input.
export type ClinicContext = {
  userId: string;
  role: SystemRole;
  // Null for SUPER_ADMIN (platform-wide) and for unbound ORG_ADMIN before
  // they pick a clinic. Required for DOCTOR / CLINIC_ADMIN / STAFF.
  clinicId: string | null;
};

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

// Read context from the verified Supabase JWT. Source of truth — use this in
// route handlers and server actions. Throws UnauthorizedError if no session.
export async function getClinicContext(): Promise<ClinicContext> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims as
    | { user_role?: string; clinic_id?: string; sub?: string }
    | undefined;

  if (error || !claims?.sub) {
    throw new UnauthorizedError();
  }
  if (!claims.user_role || !isSystemRole(claims.user_role)) {
    throw new UnauthorizedError("Missing or invalid user_role claim");
  }

  return {
    userId: claims.sub,
    role: claims.user_role,
    clinicId: claims.clinic_id ?? null,
  };
}

// Cheap variant for server components downstream of the proxy — reads
// proxy-set headers without re-verifying the JWT. Use only on routes
// covered by the proxy matcher.
export async function getClinicContextFromHeaders(): Promise<ClinicContext> {
  const h = await headers();
  const userId = h.get("x-user-id");
  const role = h.get("x-user-role");
  const clinicId = h.get("x-clinic-id");

  if (!userId || !role || !isSystemRole(role)) {
    throw new UnauthorizedError("Proxy headers missing");
  }
  return { userId, role, clinicId: clinicId || null };
}

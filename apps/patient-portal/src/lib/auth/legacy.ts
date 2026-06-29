import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SystemRole } from "./roles";

export type { SystemRole };

// Server-trusted JWT claims emitted by the custom_access_token_hook.
// See: db function public.custom_access_token_hook + memory
// project_jwt_custom_claims for the contract.

export type AuthClaims = {
  sub: string;
  email?: string;
  user_role?: SystemRole;
  clinic_id?: string;
  organization_id?: string;
};

// Read claims for the current request from Supabase. Returns null when
// the session is missing or invalid. Verified server-side via JWKS —
// never trust client-forwarded role headers.
export async function getAuthClaims(): Promise<AuthClaims | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  const c = data.claims as Record<string, unknown>;
  return {
    sub: String(c.sub ?? ""),
    email: typeof c.email === "string" ? c.email : undefined,
    user_role:
      typeof c.user_role === "string"
        ? (c.user_role as SystemRole)
        : undefined,
    clinic_id: typeof c.clinic_id === "string" ? c.clinic_id : undefined,
    organization_id:
      typeof c.organization_id === "string" ? c.organization_id : undefined,
  };
}

export type AuthError = NextResponse;

// Returns the claims when authorized, or a 401/403 NextResponse to
// short-circuit the route. Idiomatic usage in a handler:
//
//   const result = await requireRole("CLINIC_ADMIN", "ORG_ADMIN");
//   if (result instanceof NextResponse) return result;
//   const claims = result;
export async function requireRole(
  ...allowed: SystemRole[]
): Promise<AuthClaims | AuthError> {
  const claims = await getAuthClaims();
  if (!claims) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!claims.user_role || !allowed.includes(claims.user_role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return claims;
}

// Same as requireRole but additionally guarantees the caller is scoped
// to a specific clinic (rejects ORG/SUPER admins who don't carry one).
export async function requireClinicScope(
  ...allowed: SystemRole[]
): Promise<(AuthClaims & { clinic_id: string }) | AuthError> {
  const result = await requireRole(...allowed);
  if (result instanceof NextResponse) return result;
  if (!result.clinic_id) {
    return NextResponse.json(
      { error: "forbidden", reason: "no_clinic_scope" },
      { status: 403 },
    );
  }
  return result as AuthClaims & { clinic_id: string };
}

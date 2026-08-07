import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Next.js 16's `proxy` (formerly middleware) — gates /doctor and the
// /api/doctor/* routes behind Supabase auth and the JWT `user_role` claim
// injected by the custom_access_token_hook. See memory:
// project_jwt_custom_claims for the claim contract.
//
// Behaviour:
//   • No session            → redirect to /login?next=<from>
//   • Session, wrong role   → redirect to /login?reason=forbidden
//   • Session, right role   → continue, refreshed cookies written back
//
// Anything outside the matcher is untouched — patient flow and the
// /review/[token] doctor approval link remain open by design.

const ALLOWED_ROLES = new Set([
  "DOCTOR",
  "CLINIC_ADMIN",
  "ORG_ADMIN",
  "SUPER_ADMIN",
  "STAFF",
]);

export async function proxy(req: NextRequest) {
  // Bootstrap an outbound response we can mutate cookies on. The Supabase
  // client writes refreshed tokens via setAll → these end up on `res`.
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\uFEFF/g, ""),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").replace(/\uFEFF/g, ""),
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          toSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims verifies the JWT (via project JWKS) and returns the
  // server-trusted claims, including the custom user_role injected by the
  // auth hook. getSession alone would be unsafe for authorization.
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims as
    | { user_role?: string; clinic_id?: string; sub?: string }
    | undefined;

  if (error || !claims) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (!claims.user_role || !ALLOWED_ROLES.has(claims.user_role)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("reason", "forbidden");
    return NextResponse.redirect(url);
  }

  // Forward the role + clinic so downstream RSC / handlers can read them
  // without re-decoding. These are server-only headers; never trust client
  // forwards of the same names.
  res.headers.set("x-user-role", claims.user_role);
  if (claims.clinic_id) res.headers.set("x-clinic-id", claims.clinic_id);
  if (claims.sub) res.headers.set("x-user-id", claims.sub);

  return res;
}

export const config = {
  matcher: [
    "/doctor/:path*",
    "/api/doctor/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
    "/clinic/:path*",
    "/api/clinic/:path*",
    // Defense-in-depth: the route handler enforces auth + clinic ownership
    // as well, but keep unauthenticated callers from ever reaching it.
    "/api/upload",
  ],
};

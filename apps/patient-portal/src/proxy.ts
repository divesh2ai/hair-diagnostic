import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { guardOutcome } from "@/lib/auth/routeGuard";

// Next.js 16's `proxy` (formerly middleware) — gates /doctor and the
// /api/doctor/* routes behind Supabase auth and the JWT `user_role` claim
// injected by the custom_access_token_hook. See memory:
// project_jwt_custom_claims for the claim contract.
//
// Behaviour:
//   • No session                      → redirect to /login?next=<from>
//   • Session, wrong role             → redirect to /login?reason=forbidden
//   • Session, /admin, not SUPER_ADMIN → redirect to /login?reason=forbidden
//   • Session, right role             → continue, refreshed cookies written back
//
// The admin console (/admin, /api/admin) is SUPER_ADMIN-only and enforced HERE,
// at the edge — not left to the layout. A layout rejection redirected to "/",
// which cascades through the root clinic redirect into /q/<DEFAULT_CLINIC_SLUG>;
// blocking non-super-admins here keeps /admin/* off that path. The per-path rule
// lives in @/lib/auth/routeGuard (guardOutcome) so it can be unit-tested.
//
// Anything outside the matcher is untouched — patient flow and the
// /review/[token] doctor approval link remain open by design.

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
    url.search = "";
    url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // Authenticated: decide per-path. An authenticated session whose role claim is
  // absent/unknown is passed as "" so it is treated as forbidden (never as the
  // anonymous null case, which would send it back to login with ?next). Holding
  // the coalesced value in a `string` local also lets us forward exactly what
  // was authorized below without re-narrowing `claims.user_role`.
  const role = claims.user_role ?? "";
  const outcome = guardOutcome(req.nextUrl.pathname, role);
  if (outcome === "login_forbidden") {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("reason", "forbidden");
    return NextResponse.redirect(url);
  }

  // Forward the role + clinic so downstream RSC / handlers can read them
  // without re-decoding. These are server-only headers; never trust client
  // forwards of the same names. Reaching here means the outcome was "allow",
  // so `role` is a valid, non-empty system role.
  res.headers.set("x-user-role", role);
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

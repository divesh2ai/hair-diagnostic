import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { linkPendingAdminIdentity } from "@/lib/auth/linkPendingAdmin";

// Magic-link / OAuth landing. Supabase appends ?code=<otp> to the redirectTo
// URL; we exchange it for a session, which sets the auth cookies. Then we send
// the user to ?next (the path they originally tried to visit) or /doctor.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/doctor";

  if (!code) {
    return NextResponse.redirect(new URL("/login?reason=missing_code", req.url));
  }

  let res = NextResponse.redirect(new URL(next, req.url));

  const supabase = createServerClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\uFEFF/g, ""),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").replace(/\uFEFF/g, ""),
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[AUTH CALLBACK]", error.message);
    return NextResponse.redirect(
      new URL(`/login?reason=exchange_failed`, req.url),
    );
  }

  // First-login identity linking for pre-authorised platform admins. This runs
  // AFTER a verified session exists and is wrapped so it can never block a
  // legitimate login: a doctor, a patient, or any non-admin simply matches no
  // pending row and falls straight through. Only when a waiting admin row is
  // claimed do we refresh the session, so the hook re-mints the token WITH
  // user_role=SUPER_ADMIN (the updated cookies flow to `res` via setAll). The
  // redirect to `next` — /post-login, which routes SUPER_ADMIN → /admin — is
  // unchanged.
  try {
    const linked = await linkPendingAdminIdentity(supabase);
    if (linked) {
      await supabase.auth.refreshSession();
    }
  } catch (linkError) {
    // Never let identity linking turn a successful login into a failure. The
    // admin can retry on their next login; everyone else is unaffected.
    console.error(
      "[AUTH CALLBACK] admin link skipped:",
      linkError instanceof Error ? linkError.message : String(linkError),
    );
  }

  return res;
}

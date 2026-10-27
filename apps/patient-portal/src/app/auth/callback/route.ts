import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { safeReturnPath } from "@/lib/auth/returnPath";

// Magic-link landing. Supabase appends ?code=<otp> to the redirectTo URL;
// we exchange it for a session, which sets the auth cookies. Then we send
// the doctor to ?next (the path they originally tried to visit) or /doctor.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  // Validated return path (see lib/auth/returnPath): a same-origin absolute path
  // only, defaulting to /post-login (the role router) — never /doctor, so a
  // role-agnostic callback never assumes a role and can't be an open redirect.
  // Resolved against THIS request's origin below, so the flow always returns to
  // the same Vercel origin it started on.
  const next = safeReturnPath(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?reason=missing_code", req.url));
  }

  const res = NextResponse.redirect(new URL(next, req.url));

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

  return res;
}

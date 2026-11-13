import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { DOCTOR_SCREEN_COOKIE, GOOGLE_SESSION_COOKIE } from "@/lib/auth/doctorSessionPolicy";

// POST /auth/signout — clears Supabase auth cookies then redirects to /login.
// Exposed as POST (not GET) so a stray prefetch can't accidentally log
// someone out.
export async function POST(req: NextRequest) {
  const res = req.headers.get("accept") === "application/json"
    ? new NextResponse(null, { status: 204 })
    : NextResponse.redirect(new URL("/login", req.url), 303);

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

  const { error } = await supabase.auth.signOut(req.cookies.has(GOOGLE_SESSION_COOKIE) ? { scope: "local" } : undefined);
  if (error && error.name !== "AuthSessionMissingError") {
    return NextResponse.json({ error: "signout_failed" }, { status: 503 });
  }
  res.cookies.delete(GOOGLE_SESSION_COOKIE);
  res.cookies.delete(DOCTOR_SCREEN_COOKIE);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

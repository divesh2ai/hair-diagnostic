import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { safeReturnPath } from "@/lib/auth/safeReturnPath";
import { DOCTOR_SCREEN_COOKIE, DOCTOR_SESSION_SECONDS, GOOGLE_SESSION_COOKIE } from "@/lib/auth/doctorSessionPolicy";
import { doctorScreenCookie, googleSessionBinding } from "@/lib/auth/googleSessionBinding";

// Magic-link landing. Supabase appends ?code=<otp> to the redirectTo URL;
// we exchange it for a session, which sets the auth cookies. Then we send
// the doctor to ?next (the path they originally tried to visit) or /doctor.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = safeReturnPath(url.searchParams.get("next")) ?? "/doctor";

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

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[AUTH CALLBACK]", error.message);
    return NextResponse.redirect(
      new URL(`/login?reason=exchange_failed`, req.url),
    );
  }

  const google = data.user?.app_metadata.provider === "google";
  const claims = google ? (await supabase.auth.getClaims(data.session?.access_token)).data?.claims : undefined;
  if (google && claims?.user_role !== "SUPER_ADMIN") {
    if (typeof claims?.session_id !== "string") {
      return NextResponse.redirect(new URL("/login?reason=exchange_failed", req.url));
    }
    for (const cookie of res.cookies.getAll()) {
      res.cookies.set({ ...cookie, httpOnly: true, secure: true });
    }
    const binding = googleSessionBinding(claims.session_id);
    res.cookies.set(GOOGLE_SESSION_COOKIE, binding, {
      httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: DOCTOR_SESSION_SECONDS,
    });
    res.cookies.set(DOCTOR_SCREEN_COOKIE, doctorScreenCookie(binding), {
      httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: DOCTOR_SESSION_SECONDS,
    });
  } else {
    res.cookies.delete(GOOGLE_SESSION_COOKIE);
    res.cookies.delete(DOCTOR_SCREEN_COOKIE);
  }
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

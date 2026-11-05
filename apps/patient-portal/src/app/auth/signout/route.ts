import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { privateAuthResponse } from "@/lib/auth/sessionResponse";

export async function POST(req: NextRequest) {
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return privateAuthResponse(new NextResponse(null, { status: 403 }));
  }

  const json = req.headers.get("accept") === "application/json";
  const res = json
    ? new NextResponse(null, { status: 204 })
    : NextResponse.redirect(new URL("/login?reason=signed_out", req.url), 303);

  const supabase = createServerClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\uFEFF/g, ""),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").replace(/\uFEFF/g, ""),
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    },
  );

  // Keep other browsers signed in when this device is locked or signed out.
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) {
    return privateAuthResponse(new NextResponse("Could not sign out. Retry before leaving this device.", { status: 503 }), res);
  }
  return privateAuthResponse(res);
}

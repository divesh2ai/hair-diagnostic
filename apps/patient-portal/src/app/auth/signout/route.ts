import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// POST /auth/signout — clears Supabase auth cookies then redirects to /login.
// Exposed as POST (not GET) so a stray prefetch can't accidentally log
// someone out.
export async function POST(req: NextRequest) {
  let res = NextResponse.redirect(new URL("/login", req.url));

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

  await supabase.auth.signOut();
  return res;
}

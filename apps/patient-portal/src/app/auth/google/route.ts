import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeReturnPath } from "@/lib/auth/safeReturnPath";

export async function GET(request: NextRequest) {
  const next = safeReturnPath(request.nextUrl.searchParams.get("next")) ?? "/post-login";
  const callback = new URL("/auth/callback", request.url);
  callback.searchParams.set("next", next);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback.toString(), skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
  });
  return NextResponse.redirect(data.url && !error ? data.url : new URL("/login?reason=exchange_failed", request.url));
}

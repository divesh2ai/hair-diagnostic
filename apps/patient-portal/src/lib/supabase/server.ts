import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Supabase server client for use in server components, server actions, and
// route handlers. The proxy keeps the session cookie fresh; this client
// just reads/writes whatever cookies/headers gives us.
//
// Do NOT cache this — create a fresh instance per request.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\uFEFF/g, ""),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").replace(/\uFEFF/g, ""),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          // Server components can't mutate cookies — silently ignore.
          // Route handlers / actions can — try, and swallow the no-op error
          // for the read-only path.
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* read-only context (server component) */
          }
        },
      },
    },
  );
}

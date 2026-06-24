"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Mail } from "lucide-react";
import { toast } from "sonner";

// Magic-link sign-in. Keeps the doctor onboarding friction at zero — type
// email, click link in inbox, you're in. Once the doctor exists in
// public.Doctor or OrganizationMember, the JWT hook injects user_role and
// the proxy lets them through to /doctor.

function LoginInner() {
  const params = useSearchParams();
  const nextPath = params?.get("next") ?? "/doctor";
  const reason = params?.get("reason");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
          : undefined;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Could not send link", { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-[100dvh] grid place-items-center bg-stone-50 px-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
            DrFACT clinical console
          </p>
          <h1 className="font-serif text-3xl text-slate-900">Doctor sign-in</h1>
          <p className="text-sm text-stone-600">
            We&apos;ll email you a one-time sign-in link.
          </p>
        </div>

        {reason === "forbidden" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Your account doesn&apos;t have access to the doctor console. Contact your
            clinic admin if this looks wrong.
          </div>
        )}

        {sent ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-6 text-center text-sm text-emerald-900">
            <Mail className="mx-auto mb-2 h-6 w-6 text-emerald-700" />
            We sent a sign-in link to <span className="font-semibold">{email}</span>. Open it on
            this device to continue.
          </div>
        ) : (
          <form onSubmit={signIn} className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Email
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@clinic.com"
                className="h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm focus:border-slate-900 focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                "Send sign-in link"
              )}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  // useSearchParams forces a Suspense boundary in the App Router; wrap the
  // inner component so prerender doesn't bail out.
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

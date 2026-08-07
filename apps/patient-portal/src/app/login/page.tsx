"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Mail, KeyRound, Zap } from "lucide-react";
import { toast } from "sonner";

// Two-step OTP sign-in. Step 1 sends a 6-digit code to the email. Step 2
// verifies the code and creates a session. This avoids the PKCE
// cross-device problem that magic links have (opening the link in a
// different browser breaks the verifier exchange) and matches the OTP
// mental model that Indian doctors are already used to (UPI / WhatsApp).
//
// Once the user has a session, the JWT custom_access_token_hook injects
// user_role based on which table their email lives in (OrganizationMember,
// Doctor, ClinicMember, Patient) and the proxy routes them accordingly.

function LoginInner() {
  const params = useSearchParams();
  const router = useRouter();
  const nextPath = params?.get("next") ?? "/doctor";
  const reason = params?.get("reason");

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const supabase = createBrowserClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\uFEFF/g, ""),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").replace(/\uFEFF/g, ""),
  );

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setStep("code");
      toast.success("Code sent", { description: `Check ${email} for the verification code.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setErrorMsg(message);
      toast.error("Could not send code", { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 6) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (error) throw error;
      // Session is now set in cookies; navigate to original target.
      router.replace(nextPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setErrorMsg(message);
      toast.error("Could not verify code", { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStep("email");
    setCode("");
  };

  const devLoginEnabled = process.env.NEXT_PUBLIC_ALLOW_DEV_LOGIN === "1";
  const devLoginSecret = process.env.NEXT_PUBLIC_DEV_LOGIN_SECRET ?? "";

  const devLogin = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/dev/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dev-login-secret": devLoginSecret,
        },
        body: JSON.stringify(email.trim() ? { email: email.trim() } : {}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      toast.success("Dev sign-in", { description: `Signed in as ${json.email}` });
      router.replace(nextPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setErrorMsg(message);
      toast.error("Dev sign-in failed", { description: message });
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
          <h1 className="font-serif text-3xl text-slate-900">Sign in</h1>
          <p className="text-sm text-stone-600">
            {step === "email"
              ? "We'll email you a verification code to sign in."
              : "Enter the code we just emailed you."}
          </p>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {errorMsg}
          </div>
        )}

        {reason === "forbidden" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Your account doesn&apos;t have access. Contact your clinic admin if
            this looks wrong.
          </div>
        )}

        {step === "email" ? (
          <form onSubmit={sendCode} className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Email
              </span>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@clinic.com"
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
                <>
                  <Mail className="h-4 w-4" /> Email me a code
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!email.trim()) {
                  setErrorMsg("Enter the email you sent the code to first.");
                  return;
                }
                setErrorMsg(null);
                setStep("code");
              }}
              className="block w-full text-center text-xs text-stone-500 hover:text-stone-700"
            >
              I already have a code
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-900">
              We sent a code to <span className="font-semibold">{email}</span>.
            </div>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Verification code
              </span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6,10}"
                maxLength={10}
                autoComplete="one-time-code"
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter code from email"
                className="h-12 w-full rounded-lg border border-stone-300 bg-white px-3 text-center text-xl tracking-[0.3em] focus:border-slate-900 focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={submitting || code.length < 6}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <KeyRound className="h-4 w-4" /> Verify and sign in
                </>
              )}
            </button>
            <button
              type="button"
              onClick={reset}
              className="block w-full text-center text-xs text-stone-500 hover:text-stone-700"
            >
              Use a different email
            </button>
          </form>
        )}

        {devLoginEnabled && (
          <div className="space-y-2 border-t border-dashed border-stone-300 pt-4">
            <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              Preview only · skip OTP
            </p>
            <button
              type="button"
              onClick={devLogin}
              disabled={submitting}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
            >
              <Zap className="h-3.5 w-3.5" />
              {email.trim()
                ? `Dev sign-in as ${email.trim()}`
                : "Dev sign-in as divesh2ai@gmail.com"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

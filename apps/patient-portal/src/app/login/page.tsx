"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Mail, KeyRound, Zap, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { normaliseMobile, rejectionMessage, type E164 } from "@/lib/patient/phone";

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
  // Post-login server route inspects the user's actual role + memberships
  // and redirects to the correct surface (SUPER_ADMIN → /admin, CLINIC_ADMIN
  // → /clinic, DOCTOR → /doctor). The old default of "/doctor for everyone"
  // is exactly what let admin roles leak into the Doctor workspace.
  const nextParam = params?.get("next");
  const nextPath = nextParam ? `/post-login?next=${encodeURIComponent(nextParam)}` : "/post-login";
  const reason = params?.get("reason");

  const [channel, setChannel] = useState<"email" | "phone">("email");

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // \u2500\u2500 Phone OTP \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // Same two-step shape as email, plus a live availability check: the
  // Supabase project's SMS provider may not be configured, and a raw
  // provider error must never reach a doctor as if it were their mistake.
  const [phoneOtpAvailable, setPhoneOtpAvailable] = useState<boolean | null>(null);
  const [phoneStep, setPhoneStep] = useState<"phone" | "code">("phone");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState<E164 | null>(null);
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneSubmitting, setPhoneSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/phone-otp-status")
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setPhoneOtpAvailable(!!j.available); })
      .catch(() => { if (!cancelled) setPhoneOtpAvailable(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const supabase = createBrowserClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\uFEFF/g, ""),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").replace(/\uFEFF/g, ""),
  );

  const sendPhoneCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resendCooldown > 0) return;
    const parsed = normaliseMobile(phoneRaw);
    if (!parsed.ok) {
      setPhoneError(rejectionMessage(parsed.reason));
      return;
    }
    setPhoneSubmitting(true);
    setPhoneError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: parsed.e164 });
      if (error) throw error;
      setVerifiedPhone(parsed.e164);
      setPhoneStep("code");
      setResendCooldown(60);
      toast.success("Code sent", { description: `Check ${parsed.e164} for the verification code.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      // Never surface a raw provider error \u2014 the availability check already
      // decided whether to offer this path at all; a failure here after
      // that means the provider flipped mid-session, so treat it the same
      // controlled way rather than printing Supabase's own wording.
      const isProviderGap = /provider|not.*support|disabled/i.test(message);
      setPhoneOtpAvailable((prev) => (isProviderGap ? false : prev));
      setPhoneError(
        isProviderGap
          ? "Mobile sign-in isn't available right now. Use email, or contact FACT Support."
          : message,
      );
      toast.error("Could not send code", {
        description: isProviderGap ? "Mobile sign-in unavailable." : message,
      });
    } finally {
      setPhoneSubmitting(false);
    }
  };

  const verifyPhoneCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneCode.trim().length < 6 || !verifiedPhone) return;
    setPhoneSubmitting(true);
    setPhoneError(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: verifiedPhone,
        token: phoneCode.trim(),
        type: "sms",
      });
      if (error) throw error;

      // Session cookies are set. Resolve/link the matching Doctor row \u2014
      // a verified phone alone is not clinical authorization.
      const linkRes = await fetch("/api/auth/phone-login/link", { method: "POST" });
      const linkBody = await linkRes.json().catch(() => ({}));

      if (!linkRes.ok || !linkBody.ok) {
        await supabase.auth.signOut();
        setPhoneError(
          linkBody.reason === "unregistered"
            ? "This mobile number is not registered for FACT Doctor access. Please contact FACT Support."
            : "This mobile number could not be signed in. Please contact FACT Support.",
        );
        toast.error("Access denied");
        return;
      }

      router.replace(nextPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setPhoneError(message);
      toast.error("Could not verify code", { description: message });
    } finally {
      setPhoneSubmitting(false);
    }
  };

  const resetPhone = () => {
    setPhoneStep("phone");
    setPhoneCode("");
    setPhoneError(null);
  };

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
            {channel === "email"
              ? step === "email"
                ? "We'll email you a verification code to sign in."
                : "Enter the code we just emailed you."
              : phoneStep === "phone"
                ? "We'll text you a verification code to sign in."
                : "Enter the code we just texted you."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-lg bg-stone-200/70 p-1">
          <button
            type="button"
            onClick={() => setChannel("email")}
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition-colors ${
              channel === "email"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <Mail className="h-3.5 w-3.5" /> Email
          </button>
          <button
            type="button"
            onClick={() => setChannel("phone")}
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition-colors ${
              channel === "phone"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" /> Mobile
          </button>
        </div>

        {channel === "email" && errorMsg && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {errorMsg}
          </div>
        )}

        {channel === "phone" && phoneError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {phoneError}
          </div>
        )}

        {reason === "forbidden" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Your account doesn&apos;t have access. Contact your clinic admin if
            this looks wrong.
          </div>
        )}

        {channel === "phone" ? (
          phoneOtpAvailable === false ? (
            <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-center text-sm text-stone-600">
              Mobile sign-in isn&apos;t available right now. Use email, or
              contact FACT Support.
            </div>
          ) : phoneStep === "phone" ? (
            <form onSubmit={sendPhoneCode} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  Mobile number
                </span>
                <div className="flex h-11 overflow-hidden rounded-lg border border-stone-300 bg-white focus-within:border-slate-900">
                  <span className="flex items-center border-r border-stone-200 bg-stone-50 px-3 text-sm text-stone-500">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    required
                    autoFocus
                    value={phoneRaw}
                    onChange={(e) => setPhoneRaw(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="98765 43210"
                    className="h-full w-full px-3 text-sm focus:outline-none"
                  />
                </div>
              </label>
              <button
                type="submit"
                disabled={phoneSubmitting || phoneOtpAvailable === null}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {phoneSubmitting || phoneOtpAvailable === null ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <Smartphone className="h-4 w-4" /> Send OTP
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyPhoneCode} className="space-y-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-900">
                We texted a code to <span className="font-semibold">{verifiedPhone}</span>.
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
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="Enter code from SMS"
                  className="h-12 w-full rounded-lg border border-stone-300 bg-white px-3 text-center text-xl tracking-[0.3em] focus:border-slate-900 focus:outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={phoneSubmitting || phoneCode.length < 6}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {phoneSubmitting ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <KeyRound className="h-4 w-4" /> Verify and sign in
                  </>
                )}
              </button>
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={resetPhone}
                  className="text-stone-500 hover:text-stone-700"
                >
                  Change number
                </button>
                <button
                  type="button"
                  disabled={resendCooldown > 0 || phoneSubmitting}
                  onClick={(e) => sendPhoneCode(e as unknown as React.FormEvent)}
                  className="text-stone-500 hover:text-stone-700 disabled:opacity-50"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
                </button>
              </div>
            </form>
          )
        ) : step === "email" ? (
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

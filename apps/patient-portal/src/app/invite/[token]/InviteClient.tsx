"use client";

import { useState } from "react";
import {
  inviteCallbackNext,
  type InviteStatus,
} from "@/lib/auth/inviteOnboarding";

// Multi-colour Google "G" (inlined — lucide ships no brand marks). Mirrors the
// login page so the button reads as the same trusted control.
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

type Props = {
  token: string;
  status: InviteStatus;
  lookupFailed: boolean;
  scopeName: string | null;
  roleLabel: string | null;
  intendedEmailMasked: string | null;
  intendedIsEmail: boolean;
  signedIn: boolean;
  signedInEmailMasked: string | null;
  emailMatches: boolean;
};

function acceptErrorMessage(code: string | undefined): string {
  switch (code) {
    case "identity_mismatch":
      return "You're signed in with a different account than this invitation was sent to. Switch accounts and try again.";
    case "expired":
      return "This invitation has expired. Ask your clinic admin to resend it.";
    case "revoked":
      return "This invitation was cancelled. Ask your clinic admin for a new one.";
    case "identity_conflict":
      return "This clinician record (or your account) is already linked to a different sign-in identity. Contact your clinic admin — this needs a Super Admin to resolve, and we won't overwrite an existing link.";
    case "inactive_scope":
      return "This doctor or clinic is inactive. Contact your administrator; accepting an invitation cannot reactivate access.";
    case "already_accepted":
      return "This invitation has already been accepted. You can sign in.";
    case "not_found":
      return "This invitation link is not valid.";
    default:
      return "We couldn't complete activation. Please try again, or contact FACT Support.";
  }
}

export function InviteClient(props: Props) {
  const {
    token,
    status,
    lookupFailed,
    scopeName,
    roleLabel,
    intendedEmailMasked,
    signedIn,
    signedInEmailMasked,
    emailMatches,
  } = props;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clinicalAccessPending, setClinicalAccessPending] = useState(false);

  const signInWithGoogle = () => {
    if (busy) return;
    setBusy(true);
    window.location.assign("/auth/google?next=" + encodeURIComponent(inviteCallbackNext(token)));
  };

  const switchAccount = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/auth/signout", { method: "POST", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Sign-out failed");
      window.location.assign("/auth/google?next=" + encodeURIComponent(inviteCallbackNext(token)));
    } catch {
      setBusy(false);
      setError("Could not switch accounts. Please try again.");
    }
  };

  const accept = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/invitations/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) {
        setError(acceptErrorMessage(body?.error));
        setBusy(false);
        return;
      }
      if (body.clinicalAccessPending === true) {
        setClinicalAccessPending(true);
        setBusy(false);
        return;
      }
      window.location.assign("/post-login");
    } catch {
      setError("We couldn't complete activation. Please try again.");
      setBusy(false);
    }
  };

  return (
    <main className="min-h-[100dvh] grid place-items-center bg-stone-50 px-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
            DrFACT clinical console
          </p>
          <h1 className="font-serif text-3xl text-slate-900">Accept your invitation</h1>
          {status === "pending" && (
            <p className="text-sm text-stone-600">
              You&apos;ve been invited to join{" "}
              <span className="font-semibold">{scopeName ?? "your clinic"}</span>
              {roleLabel ? ` as ${roleLabel}` : ""}.
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {error}
          </div>
        )}

        {clinicalAccessPending ? (
          <Notice tone="neutral">
            Your Google account is linked. Clinical access will be available after your administrator activates your clinic and doctor profile.
          </Notice>
        ) : lookupFailed ? (
          <Notice tone="neutral">
            We couldn&apos;t load this invitation right now. Please refresh the
            page or try again shortly.
          </Notice>
        ) : status === "not_found" ? (
          <Notice tone="neutral">This invitation link is not valid.</Notice>
        ) : status === "expired" ? (
          <Notice tone="warn">
            This invitation has expired. Ask your clinic admin to resend it.
          </Notice>
        ) : status === "revoked" ? (
          <Notice tone="warn">
            This invitation was cancelled. Ask your clinic admin for a new one.
          </Notice>
        ) : status === "accepted" ? (
          <Notice tone="ok">
            This invitation has already been accepted.{" "}
            <a href="/login" className="font-semibold underline">
              Sign in
            </a>
            .
          </Notice>
        ) : (
          // pending
          <div className="space-y-4">
            {intendedEmailMasked && (
              <p className="text-center text-sm text-stone-600">
                Sign in with the Google account this invite was sent to:{" "}
                <span className="font-semibold">{intendedEmailMasked}</span>
              </p>
            )}

            {!signedIn ? (
              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={busy}
                className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-stone-300 bg-white text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-stone-50 disabled:opacity-60"
              >
                {busy ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                ) : (
                  <>
                    <GoogleIcon className="h-4 w-4" /> Continue with Google
                  </>
                )}
              </button>
            ) : emailMatches ? (
              <>
                <Notice tone="ok">
                  Signed in as{" "}
                  <span className="font-semibold">{signedInEmailMasked}</span>.
                </Notice>
                <button
                  type="button"
                  onClick={accept}
                  disabled={busy}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {busy ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    "Accept & activate my account"
                  )}
                </button>
              </>
            ) : (
              <>
                <Notice tone="warn">
                  You&apos;re signed in as{" "}
                  <span className="font-semibold">{signedInEmailMasked}</span>,
                  but this invitation is for{" "}
                  <span className="font-semibold">{intendedEmailMasked}</span>.
                </Notice>
                <button
                  type="button"
                  onClick={switchAccount}
                  disabled={busy}
                  className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-stone-300 bg-white text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-stone-50 disabled:opacity-60"
                >
                  {busy ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                  ) : (
                    <>
                      <GoogleIcon className="h-4 w-4" /> Use a different Google account
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "neutral";
  children: React.ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-stone-200 bg-stone-50 text-stone-700";
  return (
    <div className={`rounded-xl border px-4 py-3 text-center text-sm ${cls}`}>
      {children}
    </div>
  );
}

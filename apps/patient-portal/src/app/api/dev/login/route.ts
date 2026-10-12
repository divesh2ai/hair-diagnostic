import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  devLoginSecretMatches,
  isDevLoginEnabled,
  isDevLoginForbidden,
  resolveDevLoginEmail,
} from "@/lib/auth/devBypass";

// Dev-only OTP bypass for QA tooling. Uses the service-role key to mint a fresh
// email OTP via admin.generateLink, then verifies it server-side so the SSR
// session cookies are set on this response. The plaintext OTP never leaves the
// server.
//
// Authorization is centralised in @/lib/auth/devBypass (shared with the
// one-page report export bypass so the two cannot drift): preview-or-local
// runtime only, ALLOW_DEV_LOGIN opt-in, and a constant-time-matched
// DEV_LOGIN_SECRET. Production (VERCEL_ENV === "production") is refused before
// any of those are even consulted.
//
// The session's ROLE is never chosen by the caller — it is derived from the
// target email's DB rows by the JWT custom_access_token_hook. The default
// target is the sole Supabase auth user linked to both a Doctor row and an
// OrganizationMember(SUPER_ADMIN) row, so it lands in /admin. Callers may only
// request an email on the dev-login allowlist (see resolveDevLoginEmail); an
// arbitrary email cannot be used to mint — let alone escalate to — a session.

export async function POST(req: Request) {
  if (isDevLoginForbidden()) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!isDevLoginEnabled()) {
    return NextResponse.json({ error: "dev login disabled" }, { status: 404 });
  }

  // Shared-secret guard. The endpoint mints a full session, so we require a
  // secret. Anyone finding the preview URL cannot exploit it without the secret.
  if (!devLoginSecretMatches(req.headers.get("x-dev-login-secret"))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const email = resolveDevLoginEmail(body?.email);
  if (!email) {
    // Requested identity is not on the dev-login allowlist. 404 rather than 403
    // so the endpoint reveals nothing about which emails exist or are seeded.
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "server misconfigured: missing Supabase credentials" },
      { status: 500 },
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // generateLink also returns the plaintext one-time-password so we can verify
  // it without ever sending an email.
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (linkErr || !linkData?.properties?.email_otp) {
    return NextResponse.json(
      { error: linkErr?.message ?? "could not generate dev OTP" },
      { status: 500 },
    );
  }

  const otp = linkData.properties.email_otp;

  // Use the SSR client so verifyOtp writes session cookies onto the response.
  const supabase = await createSupabaseServerClient();
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    email,
    token: otp,
    type: "email",
  });

  if (verifyErr) {
    return NextResponse.json({ error: verifyErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email });
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Dev-only OTP bypass. Only enabled when ALLOW_DEV_LOGIN=1 in the environment
// (must be set on preview but never on production). Uses the service-role key
// to mint a fresh email OTP via admin.generateLink, then verifies it server-
// side so the SSR session cookies are set on this response. The plaintext OTP
// never leaves the server.
//
// Default target is the sole Supabase auth user linked to both a Doctor row
// and an OrganizationMember(SUPER_ADMIN) row — one click and you land in
// /admin (SUPER_ADMIN precedence in the JWT hook) with access to /doctor,
// /clinic, and /admin. Callers can override with { email } once more auth
// users are seeded.
const DEFAULT_EMAIL = "divesh2ai@gmail.com";

function isEnabled(): boolean {
  return process.env.ALLOW_DEV_LOGIN === "1";
}

// Hard production block. Runs regardless of ALLOW_DEV_LOGIN so an accidental
// env-var leak on a production deploy cannot enable the OTP bypass. Vercel
// sets NODE_ENV=production on preview builds too, so we key on VERCEL_ENV
// which correctly distinguishes production from preview. Non-Vercel envs
// (local dev, CI) fall through to the ALLOW_DEV_LOGIN check.
function isForbiddenInProduction(): boolean {
  return process.env.VERCEL_ENV === "production";
}

// Constant-time string compare — avoids leaking the shared secret via timing.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: Request) {
  if (isForbiddenInProduction()) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!isEnabled()) {
    return NextResponse.json({ error: "dev login disabled" }, { status: 404 });
  }

  // Shared-secret guard. The endpoint mints a full session as the seeded
  // doctor, so we require a secret both env-side and client-side. Anyone
  // finding the preview URL cannot exploit it without the secret.
  const expected = process.env.DEV_LOGIN_SECRET ?? "";
  const provided = req.headers.get("x-dev-login-secret") ?? "";
  if (!expected || !provided || !safeEqual(expected, provided)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const email: string = typeof body?.email === "string" && body.email.trim()
    ? body.email.trim()
    : DEFAULT_EMAIL;

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

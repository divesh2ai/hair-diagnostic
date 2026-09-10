import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/auth/phone-otp-status
//
// Whether the Supabase project's phone/SMS OTP provider is actually
// configured — no dashboard access from application code, so this is
// determined live rather than assumed from an env flag that could drift
// from reality without a deploy.
//
// Probes Supabase's own OTP endpoint with a reserved, non-dialable test
// number (+91 0000000000 — country code + all zeros, never a real
// subscriber). Supabase validates provider configuration before it
// validates the number's dialability, so:
//   - provider disabled  -> error_code "phone_provider_disabled" (fast, no SMS attempted)
//   - provider configured -> a different error (invalid number) or success
// Either of those means a real provider is wired up; only the first means
// there is currently no path to deliver an OTP at all.
//
// Cached briefly in module scope — this rarely changes and every login
// page load must not fan out into a live Supabase call.

const PROBE_PHONE = "+910000000000";
const CACHE_TTL_MS = 5 * 60 * 1000;

let cached: { available: boolean; checkedAt: number } | null = null;

async function probe(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return false;

  try {
    const res = await fetch(`${url}/auth/v1/otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({ phone: PROBE_PHONE }),
    });
    const body = await res.json().catch(() => ({}) as { error_code?: string });
    return body?.error_code !== "phone_provider_disabled";
  } catch {
    // Network failure reaching Supabase — report unavailable rather than
    // let the UI offer a button that can't possibly work right now.
    return false;
  }
}

export async function GET() {
  const now = Date.now();
  if (!cached || now - cached.checkedAt > CACHE_TTL_MS) {
    cached = { available: await probe(), checkedAt: now };
  }
  return NextResponse.json({ available: cached.available });
}

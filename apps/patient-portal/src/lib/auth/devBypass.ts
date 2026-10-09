import {
  isDevBypassRuntimeAllowed,
  isPointingAtProductionDb,
  isProductionRuntime,
} from "@shared/env/databaseTarget";

/**
 * Shared authorization for the developer sign-in / report-export bypass used by
 * QA tooling (POST /api/dev/login, and the one-page report export path in
 * lib/reports/one-page/loadReport.ts).
 *
 * Both call sites go through THIS module so their gates cannot drift apart.
 * Three independent gates, ALL required before any privileged session is
 * minted:
 *
 *   1. Runtime — Vercel preview, or local/CI (non-production) only. Production
 *      is refused unconditionally (`isDevBypassRuntimeAllowed`).
 *   2. Opt-in  — `ALLOW_DEV_LOGIN === "1"`.
 *   3. Secret  — `DEV_LOGIN_SECRET` set and matched in constant time.
 *
 * Because gate 1 hard-fails on `VERCEL_ENV === "production"`, an accidentally
 * leaked `ALLOW_DEV_LOGIN` or `DEV_LOGIN_SECRET` on a production deploy still
 * cannot enable the bypass: Production never depends on, and can never use,
 * this path.
 */

/** The seeded Super Admin the bypass defaults to when no email is requested. */
export const DEV_LOGIN_DEFAULT_EMAIL = "divesh2ai@gmail.com";

/**
 * Constant-time string compare — avoids leaking the secret (or which allowed
 * email was matched) through timing.
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Hard block, independent of the opt-in flag or secret. Refuses on a production
 * runtime AND on any runtime (preview/local included) whose Supabase target is
 * the production project — so a deployed Preview pointed at production data can
 * never mint a privileged session.
 */
export function isDevLoginForbidden(env: NodeJS.ProcessEnv = process.env): boolean {
  return isProductionRuntime(env) || isPointingAtProductionDb(env);
}

/**
 * Runtime gate + explicit opt-in flag, AND never while pointed at the
 * production Supabase project. The production-DB guard is repeated here (not
 * only in isDevLoginForbidden) so a caller that checks only the enabled-gate is
 * still protected.
 */
export function isDevLoginEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    isDevBypassRuntimeAllowed(env) &&
    !isPointingAtProductionDb(env) &&
    env.ALLOW_DEV_LOGIN === "1"
  );
}

/**
 * Does the presented secret match the configured one? Both must be present and
 * equal; an unset or empty `DEV_LOGIN_SECRET` never matches.
 */
export function devLoginSecretMatches(
  provided: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const expected = env.DEV_LOGIN_SECRET ?? "";
  const got = provided ?? "";
  return expected.length > 0 && got.length > 0 && safeEqual(expected, got);
}

/**
 * The set of emails the bypass may mint a session for, lower-cased.
 *
 * Defence in depth against "arbitrary email → Super Admin escalation": even
 * with the secret, a caller may only impersonate an explicitly-listed identity,
 * never a freely-chosen address.
 *
 * Configured via `DEV_LOGIN_ALLOWED_EMAILS` (comma-separated). When unset, the
 * default is the Super Admin default plus the seeded staging QA identities —
 * the only accounts this bypass has ever been used for. This list is consulted
 * ONLY in preview/local (production is blocked above), so the staging addresses
 * never function as a usable allowlist in production.
 */
function allowedEmails(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const configured = env.DEV_LOGIN_ALLOWED_EMAILS;
  const source =
    configured && configured.trim().length > 0
      ? configured.split(",")
      : [
          DEV_LOGIN_DEFAULT_EMAIL,
          "admin.qa@drfact.staging",
          "dr.test.a@drfact.staging",
          "dr.qa.b@drfact.staging",
        ];
  return new Set(
    source.map((e) => e.trim().toLowerCase()).filter((e) => e.length > 0),
  );
}

/**
 * Resolve the email to mint a session for, or `null` if the requested email is
 * not on the allowlist.
 *
 * An empty/absent request resolves to the default Super Admin identity (only if
 * that identity is itself allowed). A non-string or non-allowlisted value
 * yields `null` — the caller must refuse. The returned string preserves the
 * requested casing for Supabase; matching is case-insensitive.
 */
export function resolveDevLoginEmail(
  requested: unknown,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const allowed = allowedEmails(env);

  // Genuinely absent (undefined/null/blank string) → fall back to the default
  // Super Admin identity, but only if it is itself on the allowlist.
  const isAbsent =
    requested === undefined ||
    requested === null ||
    (typeof requested === "string" && requested.trim().length === 0);
  if (isAbsent) {
    return allowed.has(DEV_LOGIN_DEFAULT_EMAIL.toLowerCase())
      ? DEV_LOGIN_DEFAULT_EMAIL
      : null;
  }

  // Present but malformed (a number, object, etc.) → reject rather than
  // silently defaulting to a privileged identity.
  if (typeof requested !== "string") return null;

  const email = requested.trim();
  return allowed.has(email.toLowerCase()) ? email : null;
}

import { randomBytes } from "crypto";
import {
  STAGING_SUPABASE_REF,
  extractSupabaseRef,
} from "@shared/env/databaseTarget";

// Shared harness for the BEHAVIOURAL post-approval suites.
//
// ══ WHY THESE TESTS EXIST ═══════════════════════════════════════════════════
//
// The first phase shipped source-reading guards for these routes — assertions
// that `requireDoctorContext()` appears in a handler's text. Those catch a
// deleted line and nothing else. They cannot tell you whether the guard
// actually refuses a doctor from another clinic, whether a 404 really is
// returned instead of a 403, or whether a duplicate webhook really produces
// one PAID row. For launch-critical routes that is not enough.
//
// These suites make real HTTP requests to the running application, with real
// Supabase session cookies, against the migrated staging database, and assert
// on status codes and persisted rows.
//
// ══ SAFETY ══════════════════════════════════════════════════════════════════
//
// Two independent locks stop this touching production:
//
//   1. `@/lib/prisma` runs `assertSafeDatabaseTarget` at import time and
//      throws unless the target is the staging project. A test process
//      pointed at production dies before it can open a connection.
//   2. `assertStagingTarget()` below re-checks the ref explicitly and fails
//      the suite with a clear message, so a misconfiguration reads as a test
//      failure rather than a confusing import crash.
//
// Everything written here is prefixed `WAVE0-TEST` / `wave0-test` so cleanup
// can target it by exact id and never by name pattern or date range.
//
// ══ RUN THESE SEQUENTIALLY ══════════════════════════════════════════════════
//
//   npx vitest run tests/post-approval --no-file-parallelism
//
// Vitest runs files in parallel workers by default, and these all drive ONE
// single-threaded Next dev server. Under parallel load the server stops
// answering within the probe timeout, `serverIsUp()` returns false, and whole
// suites SKIP — which reports as "0 failed" while proving nothing. Sequential
// execution is not a nicety here; it is what makes the result mean something.

export const WAVE0_TAG = "WAVE0-TEST";

// 127.0.0.1, not "localhost", and deliberately.
//
// Node's fetch (undici) resolves "localhost" to ::1 first on Windows, while
// the Next dev server binds IPv4. The connection is refused, the probe below
// swallows it, and every suite SKIPS — reporting green while proving nothing,
// which is the worst possible failure mode for a security suite. Naming the
// address removes the ambiguity.
export const BASE_URL = process.env.WAVE0_BASE_URL ?? "http://127.0.0.1:4000";

/** Identities seeded in staging. See the completion report for how they map. */
export const IDENTITIES = {
  /** Doctor in clinic A (drfact-mumbai-test). */
  doctorA: "dr.test.a@drfact.staging",
  /** Doctor in clinic B (drfact-pune-test) — the cross-tenant attacker. */
  doctorB: "dr.qa.b@drfact.staging",
  /** Platform Super Admin — the only role allowed to drive ops transitions. */
  superAdmin: "admin.qa@drfact.staging",
} as const;

/**
 * Refuse to run against anything but staging.
 *
 * Called by every suite's `beforeAll`. Belt and braces alongside the import
 * time guard in `@/lib/prisma` — this one produces a readable failure.
 */
export function assertStagingTarget(): void {
  const ref =
    extractSupabaseRef(process.env.DATABASE_URL) ??
    extractSupabaseRef(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (ref !== STAGING_SUPABASE_REF) {
    throw new Error(
      `Refusing to run behavioural tests: database ref is ${ref ?? "unknown"}, expected staging (${STAGING_SUPABASE_REF}).`,
    );
  }
}

/**
 * Is the application actually running?
 *
 * These suites need a server. When there is not one — a CI box, a colleague
 * running `npm test` without `npm run dev` — they SKIP with an explicit
 * message rather than fail. A red suite that means "you did not start the
 * server" trains people to ignore red suites, and this file's whole purpose is
 * to be believed.
 */
export async function serverIsUp(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/kits`, {
      method: "GET",
      // Generous: the first request to a cold Next dev server compiles the
      // route, which takes tens of seconds in this repo.
      signal: AbortSignal.timeout(90_000),
    });
    // Any HTTP answer means the app is serving. 401 is the expected reply to
    // an unauthenticated probe and is a perfectly good sign of life.
    return res.status > 0;
  } catch (err) {
    // Logged, not swallowed. A silent false here turns the whole suite green
    // by skipping it.
    console.warn(
      `[harness] ${BASE_URL} unreachable: ${err instanceof Error ? err.message : "unknown"}`,
    );
    return false;
  }
}

export interface Session {
  email: string;
  cookie: string;
}

/**
 * The auth service could not serve a session right now.
 *
 * Distinct from a refusal. Raised only on 5xx, and only this is treated as a
 * reason to skip — see `login`.
 */
export class SessionUnavailableError extends Error {
  constructor(email: string, status: number) {
    super(`dev login unavailable for ${email}: HTTP ${status}`);
    this.name = "SessionUnavailableError";
  }
}

/**
 * Run a suite's setup, reporting whether it can run at all.
 *
 * Returns false — skip — only when the app is unreachable or the auth service
 * is failing. Every other error propagates and fails the suite.
 */
export async function trySetup(setup: () => Promise<void>): Promise<boolean> {
  if (!(await serverIsUp())) {
    console.warn(
      "[harness] app not reachable — skipping. Start it with `npm run dev`.",
    );
    return false;
  }
  try {
    await setup();
    return true;
  } catch (err) {
    if (err instanceof SessionUnavailableError) {
      console.warn(
        `[harness] ${err.message} — skipping. Run sequentially: ` +
          "npx vitest run tests/post-approval --no-file-parallelism",
      );
      return false;
    }
    throw err;
  }
}

/**
 * Mint a real Supabase SSR session for one of the seeded identities.
 *
 * Goes through `/api/dev/login`, which uses the service-role key to generate
 * and immediately verify an OTP server-side, then sets the SSR cookies on its
 * response. No email is sent.
 *
 * Cookie-based, deliberately: this application's auth is cookie-only — a
 * bearer token always 401s — so a harness that sent Authorization headers
 * would see 401 for both the allowed and the denied case and prove nothing.
 */
export async function login(email: string): Promise<Session> {
  const secret = process.env.DEV_LOGIN_SECRET;
  if (!secret) throw new Error("DEV_LOGIN_SECRET is not set; cannot mint a session.");

  const res = await fetch(`${BASE_URL}/api/dev/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-dev-login-secret": secret,
    },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    // ── Infrastructure failure vs authorisation failure ────────────────────
    //
    // These are NOT the same and must not be conflated. A 5xx means the auth
    // service could not serve us — under `npm test`'s default parallelism,
    // four workers mint sessions at once and Supabase throttles, which is an
    // environment problem and nothing about this application. A 4xx means the
    // identity was REFUSED, which is either a broken fixture or a real
    // regression and must be loud.
    //
    // So 5xx raises SessionUnavailableError, which the suites treat as "cannot
    // run" and skip; anything else throws and fails. The alternative —
    // skipping on any login failure — is the trap this whole file exists to
    // avoid: a security suite that turns green because it could not
    // authenticate.
    if (res.status >= 500) {
      throw new SessionUnavailableError(email, res.status);
    }
    throw new Error(`dev login REFUSED for ${email}: HTTP ${res.status}`);
  }

  // getSetCookie() returns each Set-Cookie separately; joining the name=value
  // pairs reconstructs a Cookie header. Supabase chunks large tokens across
  // several cookies, so taking only the first would silently produce a session
  // that fails to parse and a 401 that looks like an authorisation result.
  const cookies = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .filter((c) => c.includes("="));

  if (cookies.length === 0) {
    throw new Error(`dev login for ${email} returned no session cookies`);
  }

  return { email, cookie: cookies.join("; ") };
}

export interface ApiResponse<T = unknown> {
  status: number;
  body: T;
  /** Present when the response was a redirect rather than JSON. */
  location: string | null;
}

/**
 * One request against the running app.
 *
 * `redirect: "manual"` matters: middleware answers unauthenticated calls to
 * /api/doctor/* and /api/admin/* with a 307 to /login. Following that would
 * turn a clean "denied" into a 200 for the login page, and a test asserting
 * `status !== 200` would pass for entirely the wrong reason.
 */
export async function api<T = unknown>(
  path: string,
  options: {
    method?: string;
    session?: Session | null;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<ApiResponse<T>> {
  const { method = "GET", session, body, headers = {} } = options;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    redirect: "manual",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(session ? { Cookie: session.cookie } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const location = res.headers.get("location");

  let parsed: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // HTML (a rendered page) or a bare string (the webhook handshake).
      parsed = text;
    }
  }

  return { status: res.status, body: parsed as T, location };
}

/**
 * Was this request refused?
 *
 * Denial reaches a caller two ways in this application, and a test that
 * checked for only one would pass vacuously against the other:
 *
 *   • Middleware redirects unauthenticated /api/doctor/* and /api/admin/*
 *     calls to /login (307).
 *   • Handlers that middleware does not cover answer 401/403/404 directly.
 *
 * Both are denials. What matters is that the caller did not get the resource.
 */
export function isDenied(res: ApiResponse): boolean {
  if (res.status === 307 || res.status === 302) {
    return (res.location ?? "").includes("/login");
  }
  return res.status === 401 || res.status === 403 || res.status === 404;
}

/** Unique, obviously-synthetic suffix so parallel runs cannot collide. */
export function wave0Id(): string {
  return `wave0-test-${randomBytes(6).toString("hex")}`;
}

// In-memory, per-process rate limiting.
//
// ── Read this before relying on it for abuse protection ──────────────────────
// The counters live in a Map inside one Node process. On Vercel that is one
// serverless instance, and the platform runs as many of those concurrently as
// it likes. So the real ceiling is roughly:
//
//     configured limit  ×  number of live instances
//
// and it resets to zero whenever an instance cold-starts. A caller who retries
// from several IPs, or simply keeps going while Vercel scales out, is not
// meaningfully bounded by this.
//
// What it IS good for, and what it is used for today: flattening accidental
// storms — a double-tapped submit button, a retry loop, one script hammering
// one endpoint from one address. That is worth having and costs nothing.
//
// What it is NOT: durable abuse protection for the identity lookup. A
// determined enumeration of a phone-number range would get through. The
// signed intake session in lib/patient/intakeSession is the stronger control
// there (server-issued clinic scope, short TTL, per-session budget), but its
// per-session counter runs through this same process-local Map, so a caller
// willing to open a fresh session per attempt is limited by the session
// endpoint's own — equally process-local — ceiling.
//
// Making this durable means a shared store (Upstash/Vercel KV or Redis). That
// is a deliberate, separate decision; do not describe the current behaviour as
// a hard limit in any security review until it is made.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  limit = 30,
  windowMs = 60_000
): { ok: boolean; remaining: number } {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { ok: false, remaining: 0 };
  }

  entry.count += 1;
  return { ok: true, remaining: limit - entry.count };
}

/**
 * Which database is this process about to talk to, and is it allowed to?
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * Until 2026-08-12 both `.env` and `apps/patient-portal/.env.local` pointed at
 * the production Supabase project. There was no second project, so every local
 * `npm run dev`, every ad-hoc script and every seed ran against live patient
 * data — silently, with nothing in the terminal to say so. The failure mode is
 * not dramatic: it looks exactly like normal development right up until
 * something writes.
 *
 * `scripts/seed-demo.ts` already carried a guard, and it demonstrates the trap
 * precisely: it refused to run when `VERCEL_ENV === "production"`. Run locally,
 * `VERCEL_ENV` is undefined, the check passes, and the demo seed writes into the
 * production database. A guard that only recognises production by a Vercel
 * variable cannot protect a laptop.
 *
 * So the rule here is inverted. A process is allowed to touch the production
 * project only when it can *prove* it is the production deployment. Everything
 * else — local dev, a tsx script, CI, a Vercel preview — is refused.
 *
 * ── Deliberately not configurable by accident ────────────────────────────────
 * The production ref is compiled in rather than read from an env var with a
 * permissive default, because the whole class of bug being prevented is "the
 * environment was not what the developer assumed". A guard that reads its own
 * definition of danger from the same environment it is policing is not a guard.
 *
 * Pure module: no imports, no I/O. Importable from the Next app, from tsx
 * scripts at the repo root, and from tests.
 */

/** Live patient data. Supabase project "Dr Fact Project", ap-southeast-1. */
export const PRODUCTION_SUPABASE_REF = "gwkgopbscdftpitppgwe";

/** Synthetic data only. Supabase project "hairos-staging", ap-south-1. */
export const STAGING_SUPABASE_REF = "vbkoupvduadmcxggtnsb";

/**
 * Explicit, deliberately awkward opt-out for the rare legitimate case (a
 * read-only production inspection). Any other value, including "1" and "true",
 * does not unlock it — the point is that it cannot be enabled by reflex.
 */
export const OVERRIDE_ENV_VAR = "DANGEROUSLY_ALLOW_PRODUCTION_DB";
export const OVERRIDE_ENV_VALUE = "yes-i-understand";

export interface EnvLike {
  DATABASE_URL?: string;
  DIRECT_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  [key: string]: string | undefined;
}

/**
 * Pull the Supabase project ref out of any of the shapes this repo uses:
 *
 *   postgresql://postgres.<ref>:pw@aws-1-ap-south-1.pooler.supabase.com:6543/…
 *   postgresql://postgres:pw@db.<ref>.supabase.co:5432/…
 *   https://<ref>.supabase.co
 *
 * Returns null for a local Postgres URL or anything unrecognised — those are
 * not Supabase projects and are never the thing we are protecting.
 */
export function extractSupabaseRef(value: string | undefined | null): string | null {
  if (!value) return null;

  // Pooled connection: the ref rides in the username as `postgres.<ref>`.
  const pooled = /postgres\.([a-z0-9]{20})/i.exec(value);
  if (pooled) return pooled[1].toLowerCase();

  // Direct connection or API URL: the ref is the first hostname label.
  const host = /(?:db\.)?([a-z0-9]{20})\.supabase\.(?:co|com)/i.exec(value);
  if (host) return host[1].toLowerCase();

  return null;
}

/**
 * True only when this process can prove it is the production deployment.
 *
 * `VERCEL_ENV === "production"` is the only positive proof available. NODE_ENV
 * is not enough: Next sets it to "production" for preview builds and for a
 * local `next build && next start`, so trusting it would re-open the hole this
 * module exists to close.
 *
 * An undefined NODE_ENV (plain `tsx script.ts`) is treated as non-production,
 * which is what makes the seed scripts safe by default.
 */
export function isProductionRuntime(env: EnvLike): boolean {
  return env.VERCEL_ENV === "production";
}

export type DatabaseTargetVerdict =
  | { allowed: true; refs: string[]; note?: string }
  | { allowed: false; refs: string[]; reason: string; message: string };

/**
 * Decide whether this process may proceed.
 *
 * Two independent refusals:
 *
 *  1. **Production from a non-production runtime.** The headline case.
 *  2. **Split-brain configuration.** `DATABASE_URL` on one project and
 *     `NEXT_PUBLIC_SUPABASE_URL` on another. This one is worth failing on its
 *     own: rows would be written to one project while uploaded clinical images
 *     land in another's storage, producing assessments whose photos silently
 *     do not exist. It is also the most likely mistake while copying a staging
 *     configuration in by hand.
 */
export function assessDatabaseTarget(env: EnvLike): DatabaseTargetVerdict {
  const refs = [
    extractSupabaseRef(env.DATABASE_URL),
    extractSupabaseRef(env.DIRECT_URL),
    extractSupabaseRef(env.NEXT_PUBLIC_SUPABASE_URL),
  ].filter((ref): ref is string => ref !== null);

  const distinct = [...new Set(refs)];

  if (distinct.length > 1) {
    return {
      allowed: false,
      refs: distinct,
      reason: "split_configuration",
      message:
        `Environment points at more than one Supabase project: ${distinct.join(", ")}.\n` +
        `DATABASE_URL, DIRECT_URL and NEXT_PUBLIC_SUPABASE_URL must all name the same project — ` +
        `otherwise database rows and uploaded clinical images end up in different places.`,
    };
  }

  if (!distinct.includes(PRODUCTION_SUPABASE_REF)) {
    return { allowed: true, refs: distinct };
  }

  if (isProductionRuntime(env)) {
    return { allowed: true, refs: distinct, note: "production runtime on production project" };
  }

  if (env[OVERRIDE_ENV_VAR] === OVERRIDE_ENV_VALUE) {
    return {
      allowed: true,
      refs: distinct,
      note: `production project unlocked via ${OVERRIDE_ENV_VAR}`,
    };
  }

  return {
    allowed: false,
    refs: distinct,
    reason: "production_from_non_production_runtime",
    message:
      `Refusing to connect: this is the PRODUCTION Supabase project (${PRODUCTION_SUPABASE_REF}) ` +
      `and this process is not the production deployment ` +
      `(NODE_ENV=${env.NODE_ENV ?? "undefined"}, VERCEL_ENV=${env.VERCEL_ENV ?? "undefined"}).\n\n` +
      `Local development must use the staging project (${STAGING_SUPABASE_REF}) or a local Postgres.\n` +
      `Update DATABASE_URL, DIRECT_URL and NEXT_PUBLIC_SUPABASE_URL — see docs/staging-environment-plan.md.\n\n` +
      `If you genuinely intend to read production from here, set ${OVERRIDE_ENV_VAR}=${OVERRIDE_ENV_VALUE} ` +
      `for this one command. Do not put it in a .env file.`,
  };
}

/** Throws unless this process may talk to the configured database. */
export function assertSafeDatabaseTarget(env: EnvLike, context: string): void {
  const verdict = assessDatabaseTarget(env);
  if (verdict.allowed) {
    if (verdict.note && verdict.note.startsWith("production project unlocked")) {
      console.warn(`[db-guard] ${context}: ${verdict.note}. Production data is reachable.`);
    }
    return;
  }
  throw new Error(`[db-guard] ${context}\n\n${verdict.message}`);
}

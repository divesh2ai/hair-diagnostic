/**
 * Guard for dangerous database CLI commands.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * `packages/shared/env/databaseTarget.ts` protects the *runtime*: any process
 * that imports it and calls `assertSafeDatabaseTarget` refuses to talk to the
 * production project unless it can prove it is the production deployment.
 *
 * The Prisma CLI imports none of that. `npx prisma migrate reset` reads
 * `.env` directly and does exactly what it is told. On a laptop whose `.env`
 * still points at production — which is precisely the state this repo was in
 * until 2026-08-12 — that command drops every table of live patient data, and
 * nothing in the terminal warns first.
 *
 * So the dangerous commands are routed through here instead of being invoked
 * directly. The guard resolves the target the same way the runtime guard does
 * (same module, not a copy) and decides before the CLI ever starts.
 *
 * ── The two classes of command ───────────────────────────────────────────────
 * DESTRUCTIVE — `db push`, `migrate dev`, `migrate reset`, the seed scripts.
 *   These rewrite or drop schema without a reviewed migration. There is no
 *   legitimate reason to run any of them against production, so there is no
 *   override. Deliberately: an override would be pasted out of a runbook by
 *   the same reflex this guard exists to interrupt.
 *
 * DEPLOYMENT — `migrate deploy`.
 *   This one *is* the production workflow. It only applies migrations that are
 *   already committed and reviewed. It stays reachable, but only when the
 *   operator states the intent explicitly (see PRODUCTION_MIGRATION_ENV_VAR).
 *   Accidental use is what we are preventing, not deployment.
 *
 * Safe commands (`generate`, `validate`, `format`, `studio`, `migrate status`)
 * pass straight through — `generate` in particular runs in postinstall and must
 * never be blocked.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *   tsx scripts/db-cli-guard.ts prisma migrate deploy
 *   tsx scripts/db-cli-guard.ts tsx prisma/seed.ts
 *
 * The npm scripts in package.json all route through it; call the raw CLI only
 * when you intend to bypass the guard, which should be never.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import {
  assessDatabaseTarget,
  PRODUCTION_SUPABASE_REF,
  STAGING_SUPABASE_REF,
  extractSupabaseRef,
} from "../packages/shared/env/databaseTarget";

/**
 * Deliberate, spelled-out opt-in for applying migrations to production.
 * Distinct from DANGEROUSLY_ALLOW_PRODUCTION_DB (which unlocks *reads* for the
 * runtime guard) so that a shell where someone once inspected production does
 * not silently also permit writing schema to it.
 */
const PRODUCTION_MIGRATION_ENV_VAR = "PRODUCTION_MIGRATION";
const PRODUCTION_MIGRATION_ENV_VALUE = "yes-apply-to-production";

type Danger = "safe" | "destructive" | "deployment";

/**
 * Classify the command line. Matching is on the argument sequence rather than
 * a substring of the joined string, so a path that happens to contain "reset"
 * cannot trip it and `--skip-seed`-style flags cannot hide the verb.
 */
export function classifyCommand(argv: string[]): { danger: Danger; label: string } {
  const args = argv.map((a) => a.toLowerCase());

  const has = (...seq: string[]): boolean => {
    for (let i = 0; i + seq.length <= args.length; i += 1) {
      if (seq.every((token, offset) => args[i + offset] === token)) return true;
    }
    return false;
  };

  if (has("migrate", "reset")) return { danger: "destructive", label: "prisma migrate reset" };
  if (has("migrate", "dev")) return { danger: "destructive", label: "prisma migrate dev" };
  if (has("db", "push")) return { danger: "destructive", label: "prisma db push" };
  if (has("db", "execute")) return { danger: "destructive", label: "prisma db execute" };
  if (has("db", "seed")) return { danger: "destructive", label: "prisma db seed" };

  // Seed scripts are run as `tsx prisma/seed.ts` / `tsx scripts/seed-*.ts`,
  // so they are recognised by script path rather than by a Prisma verb.
  //
  // `seed` has to be a whole word in the filename — `seed.ts`, `seed-demo.ts`,
  // `db-seed.ts` — and not merely a prefix. Matching `seed\w*` would classify
  // `seedling-report.ts` as destructive, and a guard that blocks innocuous
  // commands is one that gets worked around.
  const seedScript = args.find((a) =>
    /(^|[\\/])(seed([-.][\w.-]*)?|[\w.-]*[-.]seed)\.(ts|mjs|js)$/.test(a),
  );
  if (seedScript) return { danger: "destructive", label: `seed script (${seedScript})` };

  if (has("migrate", "deploy")) return { danger: "deployment", label: "prisma migrate deploy" };

  return { danger: "safe", label: args.join(" ") };
}

/**
 * Load the same `.env` the Prisma CLI would, so the guard judges the exact
 * configuration the command is about to use. Existing process env wins, which
 * is what makes `DATABASE_URL=… npm run db:migrate` behave as written.
 */
function loadEnvironment(): NodeJS.ProcessEnv {
  const root = path.resolve(__dirname, "..");
  for (const file of [".env.local", ".env"]) {
    const full = path.join(root, file);
    if (existsSync(full)) loadEnv({ path: full, override: false });
  }
  return process.env;
}

function describeTarget(env: NodeJS.ProcessEnv): string {
  const ref =
    extractSupabaseRef(env.DIRECT_URL) ??
    extractSupabaseRef(env.DATABASE_URL) ??
    extractSupabaseRef(env.NEXT_PUBLIC_SUPABASE_URL);
  if (!ref) return "a non-Supabase database (local Postgres?)";
  if (ref === PRODUCTION_SUPABASE_REF) return `PRODUCTION (${ref})`;
  if (ref === STAGING_SUPABASE_REF) return `staging (${ref})`;
  return `Supabase project ${ref}`;
}

function refuse(message: string): never {
  console.error(`\n[db-cli-guard] REFUSED\n\n${message}\n`);
  process.exit(1);
}

function main(): void {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    refuse("No command given. Usage: tsx scripts/db-cli-guard.ts <command> [args…]");
  }

  const env = loadEnvironment();
  const { danger, label } = classifyCommand(argv);
  const verdict = assessDatabaseTarget(env);
  const target = describeTarget(env);

  // A split configuration is wrong for every command, safe ones included: it
  // means DATABASE_URL and NEXT_PUBLIC_SUPABASE_URL name different projects.
  if (!verdict.allowed && verdict.reason === "split_configuration") {
    refuse(verdict.message);
  }

  const isProduction = verdict.refs.includes(PRODUCTION_SUPABASE_REF);

  if (isProduction && danger === "destructive") {
    refuse(
      `\`${label}\` is pointed at ${target}.\n\n` +
        `This command rewrites or drops schema without a reviewed migration, so it is\n` +
        `never run against live patient data. There is no override flag for it.\n\n` +
        `Point DATABASE_URL / DIRECT_URL / NEXT_PUBLIC_SUPABASE_URL at staging\n` +
        `(${STAGING_SUPABASE_REF}) — see .env.staging.example — and run it again.\n\n` +
        `If production schema genuinely has to change, write a migration, commit it,\n` +
        `and apply it with the production deployment workflow:\n` +
        `    ${PRODUCTION_MIGRATION_ENV_VAR}=${PRODUCTION_MIGRATION_ENV_VALUE} npm run db:migrate:production`
    );
  }

  if (isProduction && danger === "deployment") {
    if (env[PRODUCTION_MIGRATION_ENV_VAR] !== PRODUCTION_MIGRATION_ENV_VALUE) {
      refuse(
        `\`${label}\` is pointed at ${target}.\n\n` +
          `Applying migrations to production is a deliberate release step, not something\n` +
          `a normal development command should reach. Re-run it as:\n\n` +
          `    ${PRODUCTION_MIGRATION_ENV_VAR}=${PRODUCTION_MIGRATION_ENV_VALUE} npm run db:migrate:production\n\n` +
          `Before you do: confirm the migrations are committed and have already been\n` +
          `applied to staging (${STAGING_SUPABASE_REF}).`
      );
    }
    console.warn(
      `\n[db-cli-guard] Applying migrations to ${target}.\n` +
        `[db-cli-guard] ${PRODUCTION_MIGRATION_ENV_VAR} is set — proceeding.\n`
    );
  }

  if (!isProduction) {
    console.log(`[db-cli-guard] ${label} → ${target}`);
  }

  const [command, ...rest] = argv;
  const result = spawnSync(command, rest, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

  if (result.error) {
    console.error(`[db-cli-guard] failed to start \`${command}\`: ${result.error.message}`);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

// Only run when invoked directly, so the classifier stays unit-testable.
// The `typeof` check matters: the test suite loads this module as ESM, where
// `require` does not exist at all and a bare reference would throw at import.
if (typeof require !== "undefined" && require.main === module) {
  main();
}

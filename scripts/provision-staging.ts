/**
 * Provision an EMPTY database from the squashed baseline.
 *
 * ── The problem this solves ──────────────────────────────────────────────────
 * `prisma migrate deploy` cannot build this schema from zero. The chain is:
 *
 *   00000000000000_baseline   a regenerated snapshot of the CURRENT schema —
 *                             all 65 models and 27 enums, every statement
 *                             guarded with IF NOT EXISTS / DO $$.
 *   …then 28 historical migrations that were never removed.
 *
 * Ten of those 28 re-CREATE objects the baseline already created, unguarded.
 * Replayed from zero the chain therefore dies at
 * `20260629_consultation_aggregate` on `CREATE TYPE "ConsultationStatus"`
 * (Postgres 42710, duplicate_object). Verified by audit, not assumed.
 *
 * ── Why the historical migrations are not simply deleted ────────────────────
 * Production has all 28 recorded in `_prisma_migrations`. Prisma refuses to
 * operate when migrations present in the database are missing from the
 * migrations directory, so deleting them locally would break the production
 * deployment path — trading a staging problem for a production one.
 *
 * ── The repair ───────────────────────────────────────────────────────────────
 * Prisma's documented squashed-baseline adoption:
 *
 *   1. execute the baseline SQL — this alone produces the complete schema;
 *   2. record every migration as applied WITHOUT executing it, so the history
 *      matches production and future `migrate deploy` runs are no-ops.
 *
 * Nothing is invented, no SQL is rewritten, and `prisma db push` is never used.
 *
 * ── Safety ───────────────────────────────────────────────────────────────────
 * Two independent refusals, both unconditional — this script has no legitimate
 * production use, so unlike db-cli-guard it offers NO override of any kind:
 *
 *   • the resolved Supabase ref must be the staging project;
 *   • the target database must be EMPTY (zero public tables).
 *
 * The second is what makes the script safe to leave in the repo: even if an
 * env file is later mispointed at a populated database, it stops.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *   npm run db:provision:staging -- --dry-run    # print the plan, touch nothing
 *   npm run db:provision:staging                 # execute
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import {
  PRODUCTION_SUPABASE_REF,
  STAGING_SUPABASE_REF,
  extractSupabaseRef,
} from "../packages/shared/env/databaseTarget";

const REPO_ROOT = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = path.join(REPO_ROOT, "prisma", "migrations");
const SCHEMA = path.join(REPO_ROOT, "prisma", "schema.prisma");
const BASELINE = "00000000000000_baseline";

function loadEnvironment(): NodeJS.ProcessEnv {
  // Same precedence the Prisma CLI uses, so the script judges the exact
  // configuration the commands it spawns will use.
  for (const file of [".env.local", ".env"]) {
    const full = path.join(REPO_ROOT, file);
    if (existsSync(full)) loadEnv({ path: full, override: false });
  }
  return process.env;
}

function refuse(message: string): never {
  console.error(`\n[provision-staging] REFUSED\n\n${message}\n`);
  process.exit(1);
}

/** Migration directory names in the order Prisma applies them. */
function migrationNames(): string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

function run(label: string, args: string[], dryRun: boolean): void {
  const printable = `npx ${args.join(" ")}`;
  if (dryRun) {
    console.log(`  [dry-run] ${label}: ${printable}`);
    return;
  }
  console.log(`  ${label}: ${printable}`);
  const res = spawnSync("npx", args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    cwd: REPO_ROOT,
    env: process.env,
  });
  if (res.status !== 0) {
    refuse(
      `\`${printable}\` exited with code ${res.status ?? "unknown"}.\n` +
        `Provisioning stopped. The database is in a partial state — inspect it\n` +
        `before re-running; this script will refuse a non-empty database.`,
    );
  }
}

/**
 * How many tables already exist in `public`.
 *
 * Uses the generated Prisma client purely as a SQL connection; the query
 * touches no application table, so it works against a completely empty
 * database.
 */
async function countPublicTables(): Promise<number> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*)::bigint AS count
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `;
    return Number(rows[0]?.count ?? 0);
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const env = loadEnvironment();

  // ── Gate 1: the target must be staging ────────────────────────────────────
  const ref =
    extractSupabaseRef(env.DIRECT_URL) ??
    extractSupabaseRef(env.DATABASE_URL) ??
    extractSupabaseRef(env.NEXT_PUBLIC_SUPABASE_URL);

  if (ref === PRODUCTION_SUPABASE_REF) {
    refuse(
      `The resolved database is PRODUCTION (${ref}).\n\n` +
        `This script provisions an empty database from the baseline. There is no\n` +
        `override, and none will be added: production already has this schema and a\n` +
        `full migration history.`,
    );
  }
  if (ref !== STAGING_SUPABASE_REF) {
    refuse(
      `The resolved database is ${ref ? `Supabase project ${ref}` : "not a recognised Supabase project"}.\n\n` +
        `Expected staging (${STAGING_SUPABASE_REF}).\n\n` +
        `Fill DATABASE_URL / DIRECT_URL / SUPABASE_SERVICE_ROLE_KEY from\n` +
        `.env.staging.example and copy it to .env and apps/patient-portal/.env.local.`,
    );
  }
  console.log(`[provision-staging] target → staging (${ref})`);

  // ── Gate 2: the database must be empty ────────────────────────────────────
  let tables: number;
  try {
    tables = await countPublicTables();
  } catch (err) {
    refuse(
      `Could not connect to staging to check whether it is empty.\n\n` +
        `${err instanceof Error ? err.message : String(err)}\n\n` +
        `A wrong or unset database password is the usual cause.`,
    );
  }
  if (tables > 0) {
    refuse(
      `The staging database already contains ${tables} table(s) in "public".\n\n` +
        `This script only provisions an EMPTY database, because executing the\n` +
        `baseline over existing tables would silently skip them (every statement is\n` +
        `IF NOT EXISTS) and then record all migrations as applied — leaving a\n` +
        `history that claims a schema state nobody verified.\n\n` +
        `To rebuild staging from scratch: npm run db:reset (staging only), then\n` +
        `re-run this script.`,
    );
  }
  console.log("[provision-staging] database is empty — safe to provision");

  const names = migrationNames();
  if (names[0] !== BASELINE) {
    refuse(
      `Expected "${BASELINE}" to sort first in prisma/migrations, found "${names[0]}".\n` +
        `The baseline must be applied before anything else is recorded.`,
    );
  }

  console.log(
    `\n[provision-staging] plan: execute baseline, then record ${names.length} migration(s) as applied\n`,
  );

  // ── Step 1: the baseline IS the schema ────────────────────────────────────
  run(
    "apply baseline",
    [
      "prisma",
      "db",
      "execute",
      "--file",
      path.join(MIGRATIONS_DIR, BASELINE, "migration.sql"),
      "--schema",
      SCHEMA,
    ],
    dryRun,
  );

  // ── Step 2: record the history without replaying it ───────────────────────
  //
  // Including the baseline itself. Every subsequent migration is already
  // represented in the schema the baseline just created, so executing any of
  // them would either collide or be a no-op.
  for (const name of names) {
    run(
      `record ${name}`,
      ["prisma", "migrate", "resolve", "--applied", name, "--schema", SCHEMA],
      dryRun,
    );
  }

  // ── Step 3: prove it ──────────────────────────────────────────────────────
  run("verify", ["prisma", "migrate", "status", "--schema", SCHEMA], dryRun);

  console.log(
    dryRun
      ? "\n[provision-staging] dry run complete — nothing was executed.\n"
      : "\n[provision-staging] done. Expect `migrate status` to report the schema up to date.\n" +
          "Next: seed the QA dataset.\n",
  );
}

void main();

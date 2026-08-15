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
import { existsSync, readdirSync, readFileSync } from "node:fs";
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
  // Windows needs `shell: true` to resolve `npx`, but the shell then re-splits
  // the argv it is handed — and this repo's own path contains spaces, so the
  // schema path arrived as `..\..\Dr`. Quote anything containing whitespace
  // when, and only when, a shell is involved.
  const useShell = process.platform === "win32";
  const finalArgs = useShell
    ? args.map((a) => (/\s/.test(a) && !a.startsWith('"') ? `"${a}"` : a))
    : args;
  const res = spawnSync("npx", finalArgs, {
    stdio: "inherit",
    shell: useShell,
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

// ── Adopt-existing mode ─────────────────────────────────────────────────────
//
// For one specific situation: a staging database whose schema was built by
// some route other than this script (here, the baseline applied over the
// Supabase management API because no database password was available), leaving
// a correct schema with no `_prisma_migrations` table at all.
//
// Resetting 65 verified tables to rebuild them identically is the more
// destructive way to fix a missing bookkeeping table, so this mode records the
// history against the schema that is already there.
//
// It is deliberately a separate, explicitly-named mode. The default path still
// refuses any non-empty database — adopting a schema is a judgement about
// whether that schema is *right*, and that judgement must never be made
// silently on someone's behalf.

/** Tables the baseline creates — the fingerprint an adoptable schema must match. */
function baselineTableNames(): string[] {
  const sql = readFileSync(
    path.join(MIGRATIONS_DIR, BASELINE, "migration.sql"),
    "utf8",
  );
  const found = new Set<string>();
  const re = /CREATE TABLE (?:IF NOT EXISTS )?"([A-Za-z_]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) found.add(m[1]);
  return [...found].sort();
}

/** Tables that must be empty: adopting over real data would be unforgivable. */
const MUST_BE_EMPTY = [
  "Clinic",
  "Doctor",
  "Patient",
  "Assessment",
  "Consultation",
  "ConsultationVersion",
  "KitOrderIntent",
  "AuditLog",
] as const;

/**
 * Unique indexes Doctor Review's correctness depends on.
 *
 * The first two are not cosmetic: the ConsultationVersion compound backs
 * optimistic concurrency (expectedContentVersion / 409), and the
 * KitOrderIntent compound is what makes "approve & create order" idempotent.
 * Adopting a schema missing either would produce a database that looks right
 * and silently double-orders.
 */
const REQUIRED_UNIQUE_INDEXES = [
  "ConsultationVersion_consultationId_contentVersion_key",
  "KitOrderIntent_consultationId_consultationVersionId_key",
  "Consultation_assessmentId_key",
  "Consultation_currentVersionId_key",
  "Doctor_supabaseUserId_key",
  "Doctor_email_key",
] as const;

interface AdoptReport {
  actualTables: string[];
  missingTables: string[];
  unexpectedTables: string[];
  missingIndexes: string[];
  authUsers: number;
  nonEmpty: Array<{ table: string; rows: number }>;
}

async function inspectForAdoption(): Promise<AdoptReport> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const tableRows = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    const actual = new Set(tableRows.map((r) => r.table_name));
    // Prisma's own bookkeeping table is expected to be absent here and is not
    // part of the baseline, so it never counts as unexpected.
    actual.delete("_prisma_migrations");

    const expected = baselineTableNames();
    const missingTables = expected.filter((t) => !actual.has(t));
    const unexpectedTables = [...actual].filter((t) => !expected.includes(t)).sort();

    const idxRows = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
    `;
    const idx = new Set(idxRows.map((r) => r.indexname));
    const missingIndexes = REQUIRED_UNIQUE_INDEXES.filter((i) => !idx.has(i));

    const authRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*)::bigint AS count FROM auth.users
    `;

    const nonEmpty: Array<{ table: string; rows: number }> = [];
    for (const t of MUST_BE_EMPTY) {
      // Identifier is from a local const list, never from input.
      const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT count(*)::bigint AS count FROM "${t}"`,
      );
      const n = Number(rows[0]?.count ?? 0);
      if (n > 0) nonEmpty.push({ table: t, rows: n });
    }

    return {
      actualTables: [...actual].sort(),
      missingTables,
      unexpectedTables,
      missingIndexes,
      authUsers: Number(authRows[0]?.count ?? 0),
      nonEmpty,
    };
  } finally {
    await prisma.$disconnect();
  }
}

/** Every adopt-mode gate. Refuses rather than returning a failure. */
async function assertAdoptable(): Promise<AdoptReport> {
  let r: AdoptReport;
  try {
    r = await inspectForAdoption();
  } catch (err) {
    refuse(
      `Could not inspect staging for adoption.\n\n${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (r.missingTables.length > 0) {
    refuse(
      `Schema fingerprint failed — ${r.missingTables.length} table(s) the baseline\n` +
        `defines are absent:\n\n  ${r.missingTables.join(", ")}\n\n` +
        `This schema is not the one the migration history would describe, so the\n` +
        `history must not be recorded against it.`,
    );
  }
  if (r.unexpectedTables.length > 0) {
    refuse(
      `Schema fingerprint failed — ${r.unexpectedTables.length} table(s) exist that the\n` +
        `baseline does not define:\n\n  ${r.unexpectedTables.join(", ")}\n\n` +
        `Adopting would claim a history that never produced them.`,
    );
  }
  if (r.missingIndexes.length > 0) {
    refuse(
      `Schema fingerprint failed — required unique index(es) missing:\n\n` +
        `  ${r.missingIndexes.join("\n  ")}\n\n` +
        `Doctor Review depends on these for optimistic concurrency and kit-order\n` +
        `idempotency. A schema without them would double-order silently.`,
    );
  }
  if (r.authUsers > 0) {
    refuse(
      `auth.users contains ${r.authUsers} user(s). Adopt mode requires an untouched\n` +
        `database; a populated one may be in use.`,
    );
  }
  if (r.nonEmpty.length > 0) {
    refuse(
      `Business data present — adopt mode refuses:\n\n` +
        r.nonEmpty.map((x) => `  ${x.table}: ${x.rows} row(s)`).join("\n") +
        `\n\nRecording a migration history over live rows would misrepresent how they\n` +
        `came to exist.`,
    );
  }
  return r;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const adoptExisting = process.argv.includes("--adopt-existing");
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

  // ── Gate 2: empty database, OR an explicitly-adopted matching schema ──────
  if (adoptExisting) {
    // Every check refuses on failure; reaching the next line means the schema
    // on disk is the one the history would describe, and holds no data.
    const report = await assertAdoptable();
    console.log(
      `[provision-staging] adopt-existing: fingerprint OK — ${report.actualTables.length} tables, ` +
        `all ${REQUIRED_UNIQUE_INDEXES.length} required unique indexes present, ` +
        `auth.users 0, all business tables empty`,
    );
  } else {
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
          `If the existing schema is known-good and you want to record the history\n` +
          `against it, re-run with --adopt-existing, which verifies the schema\n` +
          `fingerprint first. To rebuild instead: npm run db:reset (staging only).`,
      );
    }
    console.log("[provision-staging] database is empty — safe to provision");
  }

  const names = migrationNames();
  if (names[0] !== BASELINE) {
    refuse(
      `Expected "${BASELINE}" to sort first in prisma/migrations, found "${names[0]}".\n` +
        `The baseline must be applied before anything else is recorded.`,
    );
  }

  console.log(
    adoptExisting
      ? `\n[provision-staging] plan: adopt existing schema, record ${names.length} migration(s) as applied (no SQL executed)\n`
      : `\n[provision-staging] plan: execute baseline, then record ${names.length} migration(s) as applied\n`,
  );

  // ── Step 1: the baseline IS the schema ────────────────────────────────────
  //
  // Skipped when adopting: the schema is already there, and re-running the
  // baseline would be a no-op at best (every statement is guarded) while
  // implying the script had built what it merely found.
  if (!adoptExisting) {
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
  }

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

  // Independent post-check: `migrate status` reports Prisma's own view, so
  // confirm the recorded rows directly and — in adopt mode — that recording the
  // history changed no schema object and created no row.
  if (!dryRun) {
    const after = await verifyRecordedHistory(names.length);
    console.log(
      `[provision-staging] _prisma_migrations: ${after.recorded}/${names.length} recorded, ` +
        `${after.failed} failed, ${after.applied} applied`,
    );
    if (after.recorded !== names.length) {
      refuse(
        `Expected ${names.length} migration rows, found ${after.recorded}.\n` +
          `The history is incomplete — do not seed or deploy against it.`,
      );
    }
    if (after.failed > 0) {
      refuse(
        `${after.failed} migration row(s) are marked failed. Resolve them before use.`,
      );
    }
    if (adoptExisting) {
      const post = await inspectForAdoption();
      if (post.missingTables.length > 0 || post.unexpectedTables.length > 0) {
        refuse("Schema changed while recording history — investigate before use.");
      }
      if (post.nonEmpty.length > 0 || post.authUsers > 0) {
        refuse("Rows appeared while recording history — investigate before use.");
      }
      console.log(
        "[provision-staging] adopt-existing: schema and row counts unchanged after recording",
      );
    }
  }

  console.log(
    dryRun
      ? "\n[provision-staging] dry run complete — nothing was executed.\n"
      : "\n[provision-staging] done. Expect `migrate status` to report the schema up to date.\n" +
          "Next: seed the QA dataset.\n",
  );
}

/** Reads `_prisma_migrations` directly rather than trusting the CLI summary. */
async function verifyRecordedHistory(
  _expected: number,
): Promise<{ recorded: number; applied: number; failed: number }> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRaw<
      Array<{ recorded: bigint; applied: bigint; failed: bigint }>
    >`
      SELECT count(*)::bigint AS recorded,
             count(*) FILTER (WHERE finished_at IS NOT NULL)::bigint AS applied,
             count(*) FILTER (WHERE rolled_back_at IS NOT NULL)::bigint AS failed
      FROM "_prisma_migrations"
    `;
    return {
      recorded: Number(rows[0]?.recorded ?? 0),
      applied: Number(rows[0]?.applied ?? 0),
      failed: Number(rows[0]?.failed ?? 0),
    };
  } finally {
    await prisma.$disconnect();
  }
}

void main();

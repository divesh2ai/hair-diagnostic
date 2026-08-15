/**
 * Extract the security layer the baseline cannot express.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * `00000000000000_baseline` was produced by `prisma migrate diff
 * --from-schema-datamodel`, and schema.prisma cannot express row-level
 * security, triggers, functions or grants. So the baseline builds every table,
 * index and foreign key — and no RLS at all.
 *
 * Provisioning then records the six migrations that *do* carry those objects as
 * applied without executing them, which is correct for the relational DDL they
 * also contain (the baseline already made it) but leaves the database with
 * zero policies, permanently: Prisma believes those migrations are done and
 * will never revisit them.
 *
 * A Supabase `public` schema with RLS disabled is readable through the Data API
 * by anyone holding the anon key, which ships to the browser. Application
 * guards like requireDoctorContext only protect the routes they run in; they
 * do not protect PostgREST. So this gap has to be closed before any
 * browser-reachable deployment, not after.
 *
 * ── What it extracts, and what it refuses to ────────────────────────────────
 * ONLY: ENABLE/DISABLE ROW LEVEL SECURITY · CREATE POLICY · CREATE TRIGGER ·
 * CREATE [OR REPLACE] FUNCTION · GRANT/REVOKE.
 *
 * Never: CREATE TABLE, ALTER TABLE ... ADD COLUMN, CREATE INDEX, CREATE TYPE.
 * Those objects are already present and verified; re-running them is exactly
 * the collision this whole exercise exists to avoid.
 *
 * ── Re-runnable by construction ─────────────────────────────────────────────
 * CREATE POLICY and CREATE TRIGGER have no IF NOT EXISTS in Postgres, so each
 * is preceded by a matching DROP ... IF EXISTS. Applying 89 policies in one
 * pass and failing at 60 would otherwise leave a state that cannot be retried.
 * FUNCTIONs use CREATE OR REPLACE, and ENABLE RLS / GRANT are naturally
 * idempotent.
 *
 * Output is written for review, not executed. Applying it is a separate,
 * deliberate step.
 *
 *   npx tsx scripts/build-staging-security-repair.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..");
const MIGRATIONS = path.join(REPO_ROOT, "prisma", "migrations");
const OUT = path.join(REPO_ROOT, "prisma", "staging-security-repair.generated.sql");

/** The six migrations carrying security objects, in chain order. */
const SOURCES = [
  "20260626_add_clinic_invitation",
  "20260626_phase3_admin",
  "20260626_platform_foundation",
  "20260718_drfact_rag_stage1",
  "20260720_hair_scope_claim_governance",
  "20260721_five_kit_real_slice",
];

/**
 * Split SQL into statements on semicolons that are genuinely statement
 * terminators — not ones inside a string, an identifier, a comment, or a
 * dollar-quoted function body.
 */
function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let buf = "";
  let i = 0;
  let inLine = false;
  let inBlock = false;
  let inStr = false;
  let inIdent = false;
  let dollarTag: string | null = null;

  while (i < sql.length) {
    const c = sql[i];
    const next2 = sql.slice(i, i + 2);

    if (inLine) {
      buf += c;
      if (c === "\n") inLine = false;
      i += 1;
      continue;
    }
    if (inBlock) {
      buf += c;
      if (next2 === "*/") { buf += "/"; i += 2; inBlock = false; continue; }
      i += 1;
      continue;
    }
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) { buf += dollarTag; i += dollarTag.length; dollarTag = null; continue; }
      buf += c; i += 1; continue;
    }
    if (inStr) {
      buf += c;
      if (c === "'") inStr = false;
      i += 1;
      continue;
    }
    if (inIdent) {
      buf += c;
      if (c === '"') inIdent = false;
      i += 1;
      continue;
    }

    if (next2 === "--") { inLine = true; buf += next2; i += 2; continue; }
    if (next2 === "/*") { inBlock = true; buf += next2; i += 2; continue; }
    if (c === "'") { inStr = true; buf += c; i += 1; continue; }
    if (c === '"') { inIdent = true; buf += c; i += 1; continue; }

    const dq = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
    if (dq) { dollarTag = dq[0]; buf += dollarTag; i += dollarTag.length; continue; }

    if (c === ";") { out.push(buf.trim()); buf = ""; i += 1; continue; }

    buf += c;
    i += 1;
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter(Boolean);
}

/** The statement text with leading comments and whitespace removed. */
function code(stmt: string): string {
  return stmt
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .trim();
}

type Kind = "rls" | "policy" | "trigger" | "function" | "grant" | "skip";

function classify(stmt: string): Kind {
  const s = code(stmt).replace(/\s+/g, " ").toUpperCase();
  if (/^ALTER TABLE .* (ENABLE|DISABLE|FORCE) ROW LEVEL SECURITY/.test(s)) return "rls";
  if (/^CREATE (OR REPLACE )?POLICY /.test(s)) return "policy";
  if (/^DROP POLICY /.test(s)) return "policy";
  if (/^CREATE (CONSTRAINT )?TRIGGER /.test(s)) return "trigger";
  if (/^DROP TRIGGER /.test(s)) return "trigger";
  if (/^CREATE (OR REPLACE )?FUNCTION /.test(s)) return "function";
  if (/^(GRANT|REVOKE) /.test(s)) return "grant";
  return "skip";
}

/** `CREATE POLICY "x" ON "public"."T"` -> the DROP that makes it re-runnable. */
function dropForPolicy(stmt: string): string | null {
  const m = /^CREATE\s+(?:OR\s+REPLACE\s+)?POLICY\s+("?[^"\s]+"?)\s+ON\s+([^\s(]+)/i.exec(
    code(stmt).replace(/\s+/g, " "),
  );
  return m ? `DROP POLICY IF EXISTS ${m[1]} ON ${m[2]};` : null;
}

function dropForTrigger(stmt: string): string | null {
  const m = /^CREATE\s+(?:CONSTRAINT\s+)?TRIGGER\s+("?[^"\s]+"?)[\s\S]*?\sON\s+([^\s(]+)/i.exec(
    code(stmt).replace(/\s+/g, " "),
  );
  return m ? `DROP TRIGGER IF EXISTS ${m[1]} ON ${m[2]};` : null;
}

function main(): void {
  const counts: Record<Kind, number> = { rls: 0, policy: 0, trigger: 0, function: 0, grant: 0, skip: 0 };
  const tablesWithRls = new Set<string>();
  const roles = new Set<string>();
  const parts: string[] = [];

  parts.push(
    "-- GENERATED by scripts/build-staging-security-repair.ts — do not edit by hand.",
    "--",
    "-- The security layer the squashed baseline cannot express: RLS, policies,",
    "-- triggers, functions and grants, lifted verbatim from the six migrations",
    "-- that define them. No table, column, index or type is touched.",
    "--",
    "-- STAGING ONLY. Production already has every object below.",
    "",
  );

  // ── Emitted in DEPENDENCY order, not migration order ──────────────────────
  //
  // Migration order does not survive extraction. `20260626_phase3_admin` sorts
  // before `20260626_platform_foundation`, but its policies call
  // public.jwt_is_super_admin(), which platform_foundation defines — so a
  // faithful per-migration replay fails on the first policy with
  // "function public.jwt_is_super_admin() does not exist".
  //
  // In the real chain that never mattered: the schema was built by `db push`
  // and each migration ran against a database where the helper already
  // existed. Extracting only the security layer removes that cushion, so the
  // statements are grouped by kind and emitted in the order Postgres needs:
  // functions first, then RLS, then the policies and triggers that call them,
  // then grants over objects that now all exist.
  const fns: string[] = [];
  const rls: string[] = [];
  const policies: string[] = [];
  const triggers: string[] = [];
  const grants: string[] = [];

  for (const src of SOURCES) {
    const sql = readFileSync(path.join(MIGRATIONS, src, "migration.sql"), "utf8");

    for (const stmt of splitStatements(sql)) {
      const kind = classify(stmt);
      if (kind === "skip") { counts.skip += 1; continue; }

      const c = code(stmt);
      const flat = c.replace(/\s+/g, " ");

      if (kind === "function") {
        counts.function += 1;
        fns.push(`-- ${src}`, `${c};`, "");
        continue;
      }
      if (kind === "rls") {
        counts.rls += 1;
        const m = /ALTER TABLE\s+(?:IF EXISTS\s+)?([^\s]+)/i.exec(flat);
        if (m) tablesWithRls.add(m[1].replace(/"/g, ""));
        rls.push(`${c};`);
        continue;
      }
      if (kind === "grant") {
        counts.grant += 1;
        for (const r of c.match(/\b(?:TO|FROM)\s+([a-z_]+)/gi) ?? []) {
          roles.add(r.split(/\s+/)[1].toLowerCase());
        }
        grants.push(`${c};`);
        continue;
      }
      if (kind === "policy") {
        // Source DROP POLICY statements are dropped on the floor: a matching
        // guard is generated for every CREATE below, so keeping them would
        // emit the same DROP twice.
        if (/^DROP POLICY/i.test(flat)) continue;
        counts.policy += 1;
        const d = dropForPolicy(stmt);
        if (d) policies.push(d);
        policies.push(`${c};`, "");
        continue;
      }
      if (kind === "trigger") {
        if (/^DROP TRIGGER/i.test(flat)) continue;
        counts.trigger += 1;
        const d = dropForTrigger(stmt);
        if (d) triggers.push(d);
        triggers.push(`${c};`, "");
      }
    }
  }

  const section = (title: string, body: string[]) =>
    body.length > 0
      ? parts.push(`-- ── ${title} ${"─".repeat(Math.max(0, 62 - title.length))}`, "", ...body, "")
      : undefined;

  section("1. functions (policies and triggers below depend on these)", fns);
  section("2. row-level security enablement", rls);
  section("3. policies", policies);
  section("4. triggers", triggers);
  section("5. grants", grants);

  // ── Deny-by-default for everything the migrations never covered ───────────
  //
  // The six migrations protect 50 tables. They do not protect the Consultation
  // family — Consultation, ConsultationVersion, ConsultationEvent,
  // KitOrderIntent, Diagnosis, Recommendation — because the migrations that
  // created those tables simply never wrote a policy. That is the clinical core
  // of Doctor Review, and on Supabase an unprotected `public` table is readable
  // through PostgREST by anyone holding the anon key, which ships to the
  // browser.
  //
  // Enabling RLS with NO policies is deny-all for `anon` and `authenticated`,
  // and is the honest fix here: inventing tenant policies for tables whose
  // access rules were never designed would be fabricating a security model.
  // The application is unaffected — Prisma connects as the table owner, which
  // bypasses RLS, and `service_role` bypasses it too.
  //
  // If any of these later needs Data API access, it needs a designed policy,
  // and that decision should be explicit rather than inherited from an
  // oversight.
  const allTables = new Set<string>();
  {
    const baseline = readFileSync(
      path.join(MIGRATIONS, "00000000000000_baseline", "migration.sql"),
      "utf8",
    );
    const re = /CREATE TABLE (?:IF NOT EXISTS )?"([A-Za-z_]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(baseline)) !== null) allTables.add(m[1]);
    // Prisma's own bookkeeping table is not in the baseline but is just as
    // exposed through PostgREST, and it publishes the full migration history.
    allTables.add("_prisma_migrations");
  }
  const uncovered = [...allTables].filter((t) => !tablesWithRls.has(t)).sort();
  if (uncovered.length > 0) {
    parts.push(
      `-- ── deny-by-default: ${uncovered.length} tables no migration ever protected ──`,
      "--",
      "-- RLS enabled with no policies == no Data API access for anon/authenticated.",
      "-- Prisma (table owner) and service_role are unaffected.",
      "",
      ...uncovered.map((t) => `ALTER TABLE "public"."${t}" ENABLE ROW LEVEL SECURITY;`),
      "",
    );
    counts.rls += uncovered.length;
  }

  writeFileSync(OUT, parts.join("\n"), "utf8");
  console.log(
    `[security-repair] deny-by-default added for ${uncovered.length} uncovered table(s):`,
  );
  console.log("  " + uncovered.join(", "));

  console.log("[security-repair] written:", path.relative(REPO_ROOT, OUT));
  console.log(`[security-repair] RLS statements   : ${counts.rls}`);
  console.log(`[security-repair] policies         : ${counts.policy}`);
  console.log(`[security-repair] triggers         : ${counts.trigger}`);
  console.log(`[security-repair] functions        : ${counts.function}`);
  console.log(`[security-repair] grants/revokes   : ${counts.grant}`);
  console.log(`[security-repair] skipped (DDL)    : ${counts.skip}`);
  console.log(`[security-repair] tables gaining RLS (${tablesWithRls.size}):`);
  console.log("  " + [...tablesWithRls].sort().join(", "));
  console.log(`[security-repair] roles referenced : ${[...roles].sort().join(", ") || "(none)"}`);
}

main();

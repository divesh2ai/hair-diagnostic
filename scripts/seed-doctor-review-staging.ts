/**
 * Make the seeded staging assessments reviewable.
 *
 * ── The gap this fills ──────────────────────────────────────────────────────
 * `seed-clinic-staging.ts` builds the intake layer — clinic, locations,
 * doctors, patients and assessments covering NEW / RETURNING / AMBIGUOUS and
 * each visit type. It leaves `Assessment.rawResponses` null, because the
 * identity flows it was written for never read it.
 *
 * Doctor Review composes a Consultation *from* those answers. With a null
 * column every case resolves to LEGACY_DEGRADED and the review surface can
 * only ever show its historical-record notice — 13 queue rows that all refuse
 * to open. Useless for QA of the thing we actually want to test.
 *
 * ── Why replay-corpus answers, not invented ones ────────────────────────────
 * `tests/fixtures/replay-corpus-v2/cases` holds 200 clinically-authored cases,
 * each with a `questionnaireAnswers` object in exactly the shape this column
 * expects. Reusing them means the protocols a doctor sees in staging are
 * produced by the real clinical engine from real inputs — genuine kits, genuine
 * drivers, genuine rationale. Hand-written answers would produce plausible
 * nonsense, and QA against plausible nonsense proves nothing.
 *
 * One assessment is deliberately left with a null column so the legacy
 * degraded path stays testable.
 *
 * Staging-only, guarded the same three ways as the clinic seed. Idempotent.
 *
 *   CLINIC_SEED_ALLOW=1 npx tsx scripts/db-cli-guard.ts tsx scripts/seed-doctor-review-staging.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  assertSafeDatabaseTarget,
  extractSupabaseRef,
  STAGING_SUPABASE_REF,
} from "../packages/shared/env/databaseTarget";

const prisma = new PrismaClient();
const CASES_DIR = path.resolve(
  __dirname,
  "..",
  "tests",
  "fixtures",
  "replay-corpus-v2",
  "cases",
);

/**
 * A spread chosen for what the doctor surface needs to show, not for clinical
 * variety alone: several categories that reliably produce multi-kit protocols,
 * plus inflammatory and areata cases that exercise safety and attention paths.
 */
const WANTED_CATEGORIES = [
  "MULTIFACTORIAL",
  "PCOS",
  "FPHL",
  "MALE_AGA",
  "CHRONIC_TE",
  "ACUTE_TE",
  "INFLAMMATORY_SCALP",
  "ALOPECIA_AREATA",
  "POST_COVID_TE",
];

interface ReplayCase {
  caseId: string;
  category: string;
  severity?: string;
  questionnaireAnswers: Record<string, unknown>;
}

function loadCases(): ReplayCase[] {
  const byCategory = new Map<string, ReplayCase[]>();
  for (const f of readdirSync(CASES_DIR).filter((n) => n.endsWith(".json"))) {
    const c = JSON.parse(readFileSync(path.join(CASES_DIR, f), "utf8")) as ReplayCase;
    if (!c.questionnaireAnswers) continue;
    const list = byCategory.get(c.category) ?? [];
    list.push(c);
    byCategory.set(c.category, list);
  }
  // Deterministic: first case of each wanted category, in the declared order,
  // so a re-run assigns the same answers to the same assessment.
  const picked: ReplayCase[] = [];
  for (const cat of WANTED_CATEGORIES) {
    const list = (byCategory.get(cat) ?? []).sort((a, b) => a.caseId.localeCompare(b.caseId));
    if (list[0]) picked.push(list[0]);
    if (list[1]) picked.push(list[1]);
  }
  return picked;
}

async function main(): Promise<void> {
  assertSafeDatabaseTarget(process.env, "seed-doctor-review-staging");
  const ref =
    extractSupabaseRef(process.env.DIRECT_URL) ??
    extractSupabaseRef(process.env.DATABASE_URL) ??
    extractSupabaseRef(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (ref !== STAGING_SUPABASE_REF) {
    throw new Error(
      `[seed-doctor-review-staging] refusing: resolved ${ref ?? "unknown"}, expected staging (${STAGING_SUPABASE_REF}).`,
    );
  }
  if (process.env.CLINIC_SEED_ALLOW !== "1") {
    throw new Error(
      "[seed-doctor-review-staging] set CLINIC_SEED_ALLOW=1 to run this seed.",
    );
  }

  const cases = loadCases();
  const assessments = await prisma.assessment.findMany({
    where: { deletedAt: null },
    orderBy: { submittedAt: "asc" },
    select: { id: true, submittedAt: true, patientId: true },
  });

  if (assessments.length === 0) {
    throw new Error("No assessments found — run seed:clinic first.");
  }

  console.log(
    `\n[seed-doctor-review-staging] ${assessments.length} assessment(s), ${cases.length} replay case(s) available\n`,
  );

  // Leave the OLDEST assessment degraded on purpose: it doubles as the
  // long-waiting queue case and the legacy-record case.
  const [legacy, ...reviewable] = assessments;

  let i = 0;
  for (const a of reviewable) {
    const c = cases[i % cases.length];
    i += 1;
    await prisma.assessment.update({
      where: { id: a.id },
      data: { rawResponses: c.questionnaireAnswers as never },
    });
    console.log(`  ${a.id}  ←  ${c.caseId} (${c.category})`);
  }

  await prisma.assessment.update({
    where: { id: legacy.id },
    data: { rawResponses: undefined },
  });
  console.log(`\n  legacy/degraded (rawResponses left null): ${legacy.id}`);

  const composable = await prisma.assessment.count({
    where: { deletedAt: null, NOT: { rawResponses: { equals: undefined } } },
  });
  console.log(
    `\n[seed-doctor-review-staging] done — ${reviewable.length} reviewable, 1 legacy-degraded (composable check: ${composable})\n`,
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());

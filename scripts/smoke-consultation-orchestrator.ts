/**
 * Smoke test for the Consultation Orchestrator.
 *
 * Run (after applying the consultation_aggregate migration):
 *   npx tsx scripts/smoke-consultation-orchestrator.ts <assessmentId>
 *
 * If <assessmentId> is omitted, the script picks the most recent assessment
 * with rawResponses in the database.
 *
 * What it verifies:
 *   1. getOrCreate composes + persists on first call, returns same on second
 *   2. revise() appends an immutable new version and bumps the version pointer
 *   3. revise() with identical content is a no-op (contentHash skip)
 *   4. approve() flips approvalStatus and emits CONSULTATION_APPROVED
 *   5. ConsultationEvent rows are written for every state change
 *
 * Exits 0 on success, 1 on first assertion failure. Safe to re-run — it never
 * deletes data; it just appends versions to the chosen assessment.
 * All version assertions are relative to the baseline captured before the run.
 */

import { PrismaClient } from "@prisma/client";
import { makeOrchestrator } from "../src/packages/consultation-orchestrator";

const prisma = new PrismaClient();

async function main() {
  const arg = process.argv[2];
  const assessmentId = arg ?? (await pickRecentAssessmentId());
  if (!assessmentId) fail("No assessment with rawResponses found in DB");

  log(`Using assessmentId=${assessmentId}`);

  const orch = makeOrchestrator(prisma);
  const ctx = {
    actorId: "smoke-test-doctor",
    // SUPER_ADMIN bypasses assertCanReadClinic when running without a real JWT
    // context (no clinicId available in a server-side smoke test).
    role: "SUPER_ADMIN" as const,
    clinicId: null,
  };

  // Capture baseline state before the test so assertions are relative and
  // the test remains safe to re-run against an assessment that already has data.
  const baseline = await prisma.consultation.findUnique({
    where: { assessmentId },
    include: { currentVersion: true },
  });
  const baseVersion = baseline?.currentVersion?.contentVersion ?? 0;
  log(`  Baseline: ${baseline ? `consultation exists, current v${baseVersion}` : "no consultation yet"}`);

  // 1. getOrCreate — first call composes + persists
  log("Step 1: getOrCreate (initial)");
  const c1 = await orch.getOrCreate({ assessmentId, ctx });
  assert(c1.diagnosis.primary, "consultation has a primary diagnosis");
  const stored1 = await prisma.consultation.findUnique({
    where: { assessmentId },
    include: { currentVersion: true, events: true },
  });
  assert(stored1, "consultation row exists");
  const v1 = stored1!.currentVersion!.contentVersion;
  assert(v1 >= 1, "consultation has at least version 1");
  log(`  current version = v${v1} (was v${baseVersion})`);

  // 2. getOrCreate again — idempotent
  log("Step 2: getOrCreate (second call) — should return same version");
  await orch.getOrCreate({ assessmentId, ctx });
  const stored2 = await prisma.consultation.findUnique({
    where: { assessmentId },
    include: { currentVersion: true },
  });
  assert(stored2!.currentVersionId === stored1!.currentVersionId, "current version unchanged");

  // 3. revise with an edit — appends next version
  log("Step 3: revise with an edit — appends a new version");
  await orch.revise({
    assessmentId,
    ctx,
    doctorNotes: [
      {
        id: "smoke-note-" + Date.now(),
        author: "smoke-test-doctor",
        body: "Smoke-test note appended at " + new Date().toISOString(),
        visibleToPatient: false,
        createdAt: new Date().toISOString(),
      },
    ],
  });
  const stored3 = await prisma.consultation.findUnique({
    where: { assessmentId },
    include: { currentVersion: true },
  });
  const v3 = stored3!.currentVersion!.contentVersion;
  assert(v3 === v1 + 1, `version bumped from v${v1} to v${v1 + 1}`);
  assert(
    stored3!.currentVersion!.contentHash !== stored1!.currentVersion!.contentHash,
    "new version hash differs from previous",
  );
  log(`  version bumped to v${v3}`);

  // 4. revise with no change — should be a no-op (hash skip)
  log("Step 4: revise with no edit — should skip (contentHash match)");
  await orch.revise({ assessmentId, ctx });
  const stored4 = await prisma.consultation.findUnique({
    where: { assessmentId },
    include: { currentVersion: true },
  });
  assert(stored4!.currentVersion!.contentVersion === v3, `version still v${v3} (no-op)`);

  // 5. approve — flips approvalStatus + emits event
  log("Step 5: approve current version");
  await orch.approve({ assessmentId, ctx, status: "APPROVED", notes: "smoke-test approval" });
  const stored5 = await prisma.consultation.findUnique({
    where: { assessmentId },
    include: { currentVersion: true },
  });
  assert(stored5!.currentVersion!.approvalStatus === "APPROVED", "approval flipped to APPROVED");
  assert(stored5!.status === "APPROVED", "consultation status flipped to APPROVED");

  // 6. Outbox events — every state change should have written rows
  log("Step 6: outbox events");
  const events = await prisma.consultationEvent.findMany({
    where: { consultationId: stored1!.id },
    orderBy: { createdAt: "asc" },
  });
  const types = events.map((e) => e.type);
  log(`  events: ${types.join(", ")}`);
  assert(types.includes("CONSULTATION_CREATED"), "CONSULTATION_CREATED emitted");
  assert(types.includes("CONSULTATION_UPDATED"), "CONSULTATION_UPDATED emitted");
  assert(types.includes("CONSULTATION_APPROVED"), "CONSULTATION_APPROVED emitted");

  // All versions immutable: count >= 2
  const versions = await prisma.consultationVersion.findMany({
    where: { consultationId: stored1!.id },
    orderBy: { contentVersion: "asc" },
  });
  assert(versions.length >= 2, "two or more versions persisted");
  log(`  ${versions.length} versions: ${versions.map((v) => `v${v.contentVersion}`).join(", ")}`);

  log("\nSmoke test passed ✓");
}

async function pickRecentAssessmentId(): Promise<string | null> {
  const a = await prisma.assessment.findFirst({
    where: { deletedAt: null, rawResponses: { not: undefined } },
    orderBy: { submittedAt: "desc" },
    select: { id: true },
  });
  return a?.id ?? null;
}

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(msg);
}

function assert(cond: unknown, label: string) {
  if (!cond) fail(`Assertion failed: ${label}`);
  log(`  ✓ ${label}`);
}

function fail(msg: string): never {
  // eslint-disable-next-line no-console
  console.error("✗ " + msg);
  process.exit(1);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * P0 recovery — compose the canonical Consultation for assessments that the
 * pre-fix pipeline failed to persist (consultation-stage "Cross-clinic access
 * denied"). It calls the SAME orchestrator entry point the pipeline uses,
 * `ensureConsultationForAssessment`, which:
 *
 *   - composes v1 from the STORED questionnaire via the clinical engines
 *     (never fabricated) and persists Consultation + ConsultationVersion;
 *   - is IDEMPOTENT: a row that already exists is reported "existing" and left
 *     untouched (immutable-version semantics preserved, original timestamps and
 *     clinical history intact);
 *   - creates NO doctor approval (approvalStatus stays PENDING_REVIEW);
 *   - does NOT run Phase B — no narratives, no PDF, no report-asset writes, so
 *     nothing is regenerated or overwritten.
 *
 * It is deliberately NOT an HTTP endpoint and adds no runtime attack surface.
 *
 * Usage (run against PRODUCTION with the production DATABASE_URL):
 *   # dry run — prints each assessment's current state, writes nothing:
 *   DATABASE_URL=... npx tsx scripts/recover-consultations.ts
 *   # recover the 7 priority cases, then verify:
 *   DATABASE_URL=... npx tsx scripts/recover-consultations.ts --commit --priority
 *   # recover the remaining 3 (only after the 7 are verified):
 *   DATABASE_URL=... npx tsx scripts/recover-consultations.ts --commit --remaining
 *   # explicit ids:
 *   DATABASE_URL=... npx tsx scripts/recover-consultations.ts --commit <id> <id> ...
 *
 * Deploy the consultation-stage fix (PR #47) FIRST — without it this script hits
 * the same "Cross-clinic access denied" denial it is meant to recover from.
 */
import { PrismaClient } from "@prisma/client";
import { ensureConsultationForAssessment } from "../src/packages/assessment-orchestrator/persistence/ensureConsultation";

const prisma = new PrismaClient();

// Full production assessment IDs (verified from drfact-hairos-production
// 2026-11-02). Priority order per the recovery brief: Dr Aggarwal ×2 →
// Acube ×3 → Radiance ×2.
const PRIORITY_IDS = [
  "cmvuynpmq000612ap4pcvge0v", // dr-aggarwals-clinic 10-30
  "cmvv1h436000459wd8ukgcs8c", // dr-aggarwals-clinic 10-30
  "cmvw47lno0006gm8pik9fsx24", // acube-aesthetics 10-31
  "cmvw5wrox0006dzpgbl45od6m", // acube-aesthetics 10-31
  "cmvwfbws80006ie1k20uh9cs1", // acube-aesthetics 10-31
  "cmvwioqtl0006kk6oe0e210z8", // radiance 10-31
  "cmvwmt8j400041444672qsdeo", // radiance 10-31
];
const REMAINING_IDS = [
  "cmvaw9jwx0006my5051wc11gf", // tressze-clinic 10-16
  "cmvhvpz6g00066ervmr9bdrfs", // bala-clinic 10-21
  "cmvkinw460006dfotj4xeqiqz", // acube-aesthetics 10-23
];

function maskDbUrl(url: string | undefined): string {
  if (!url) return "<unset>";
  return url.replace(/(:\/\/[^:]+:)[^@]+(@)/, "$1***$2").replace(/([?&](password|sslmode|pgbouncer)=)[^&]*/gi, "$1***");
}

type Row = {
  assessmentId: string;
  clinic: string | null;
  before: "none" | "exists";
  action: "created" | "existing" | "skipped" | "failed" | "DRY_RUN" | "ERROR";
  consultationId?: string;
  clinicScoped?: boolean;
  approvalStatus?: string | null;
  note?: string;
};

async function snapshot(assessmentId: string) {
  const a = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, clinicId: true, status: true, clinic: { select: { slug: true } } },
  });
  const con = await prisma.consultation.findUnique({
    where: { assessmentId },
    select: {
      id: true,
      clinicId: true,
      currentVersionId: true,
      currentVersion: { select: { approvalStatus: true } },
    },
  });
  return { a, con };
}

async function main() {
  const argv = process.argv.slice(2);
  const commit = argv.includes("--commit");
  const usePriority = argv.includes("--priority");
  const useRemaining = argv.includes("--remaining");
  const explicit = argv.filter((x) => !x.startsWith("--"));

  let ids: string[];
  if (explicit.length) ids = explicit;
  else if (useRemaining && !usePriority) ids = REMAINING_IDS;
  else if (usePriority && !useRemaining) ids = PRIORITY_IDS;
  else ids = [...PRIORITY_IDS, ...REMAINING_IDS];

  console.log("DATABASE_URL:", maskDbUrl(process.env.DATABASE_URL));
  console.log(`Mode: ${commit ? "COMMIT (will write)" : "DRY RUN (no writes)"} · ${ids.length} assessment(s)\n`);

  const results: Row[] = [];
  for (const assessmentId of ids) {
    const { a, con } = await snapshot(assessmentId);
    if (!a) {
      results.push({ assessmentId, clinic: null, before: "none", action: "ERROR", note: "assessment not found" });
      continue;
    }
    const before: "none" | "exists" = con?.currentVersionId ? "exists" : "none";

    if (!commit) {
      results.push({
        assessmentId,
        clinic: a.clinic?.slug ?? null,
        before,
        action: "DRY_RUN",
        approvalStatus: con?.currentVersion?.approvalStatus ?? null,
        note: before === "exists" ? "already has a consultation — would be a no-op" : "would compose + persist v1",
      });
      continue;
    }

    try {
      const res = await ensureConsultationForAssessment(prisma, assessmentId);
      const after = await snapshot(assessmentId);
      const clinicScoped = after.con?.clinicId === a.clinicId;
      const approvalStatus = after.con?.currentVersion?.approvalStatus ?? null;
      results.push({
        assessmentId,
        clinic: a.clinic?.slug ?? null,
        before,
        action: res.status,
        consultationId: res.consultationId,
        clinicScoped,
        approvalStatus,
        note:
          !clinicScoped
            ? "!! consultation.clinicId != assessment.clinicId — INVESTIGATE"
            : approvalStatus && approvalStatus !== "PENDING_REVIEW"
              ? `!! unexpected approvalStatus ${approvalStatus} — recovery must not approve`
              : undefined,
      });
    } catch (err) {
      results.push({
        assessmentId,
        clinic: a.clinic?.slug ?? null,
        before,
        action: "ERROR",
        note: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.table(
    results.map((r) => ({
      assessment: r.assessmentId.slice(-6),
      clinic: r.clinic,
      before: r.before,
      action: r.action,
      clinicScoped: r.clinicScoped ?? "",
      approval: r.approvalStatus ?? "",
      note: r.note ?? "",
    })),
  );

  const bad = results.filter(
    (r) => r.action === "ERROR" || r.action === "failed" || r.clinicScoped === false ||
      (r.approvalStatus != null && r.approvalStatus !== "PENDING_REVIEW"),
  );
  if (commit && bad.length) {
    console.error(`\n${bad.length} case(s) need attention — see notes above.`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

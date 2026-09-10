import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext } from "@/lib/auth";
import { REVIEWABLE_SOURCE_SQL } from "@/lib/doctor/reviewQueue";

// Pathways that mean "more than a routine read". Kept here rather than
// inlined so the filter and the dashboard's priority count agree.
const PRIORITY_PATHWAYS = [
  "RESOLUTION_REQUIRED",
  "EXAMINATION_REQUIRED",
  "FOCUSED_REVIEW",
];

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor } = authResult;

  const url = new URL(req.url);
  const q = url.searchParams;

  const dateFrom = q.get("dateFrom");
  const dateTo = q.get("dateTo");
  // Doctor-scoped queries are pinned to the caller's own clinic — the
  // former `?clinicId=` override for SUPER_ADMIN is intentionally removed.
  // Cross-clinic reads live on /api/admin/* under a super-admin gate.
  const clinicId = doctor.clinicId;
  const doctorId = q.get("doctorId");
  const status = q.get("status");
  const includeSkinPigmentationPending = q.get("includeSkinPigmentationPending") === "1";
  // The Needs-review tab asks for cases a doctor can actually act on. The
  // PREDICATE is the server's (see lib/doctor/reviewQueue) — the client only
  // says which tab it is on, exactly as it does for the skin carve-out above.
  const openableOnly = q.get("openableOnly") === "1";
  const diagnosis = q.get("diagnosis");
  const severity = q.get("severity");
  const assignedTo = q.get("assignedTo");
  const decision = q.get("decision");
  const priorityOnly = q.get("priority") === "1";
  // Minimum hours a case must have been waiting. Purely a scheduling filter —
  // it never promotes a case's clinical priority.
  const waitingOverHours = Number(q.get("waitingOverHours") ?? 0);
  // "oldest" is FIFO — the Review Queue's ordering, and the only ordering a
  // waiting room can be run on. Anything else keeps newest-first, which is
  // what a historical list ("all", "approved") should show.
  //
  // There is deliberately no clinical-priority sort. Ranking the queue by the
  // review-pathway classifier meant a patient's position could change while
  // they sat in the waiting room, for reasons neither they nor reception could
  // see. The classifier still runs and still labels the row — see
  // lib/doctor/reviewPriority.clinicalAttention — it just does not reorder.
  const sort = q.get("sort");
  const limit = Math.min(Number(q.get("limit") ?? 100), 500);
  const offset = Math.max(Number(q.get("offset") ?? 0), 0);

  const where: Prisma.Sql[] = [Prisma.sql`a."deletedAt" IS NULL`];
  if (dateFrom) where.push(Prisma.sql`a."submittedAt" >= ${new Date(dateFrom)}`);
  if (dateTo) where.push(Prisma.sql`a."submittedAt" <= ${new Date(dateTo)}`);
  if (clinicId) where.push(Prisma.sql`a."clinicId" = ${clinicId}`);
  if (doctorId) where.push(Prisma.sql`p."doctorId" = ${doctorId}`);
  if (status) {
    // Support comma-separated list so the doctor reports page can include
    // CLINICAL_READY + REPORT_GENERATING + COMPLETED in one query.
    const statuses = status.split(",").map((s) => s.trim()).filter(Boolean);
    if (statuses.length === 1) {
      where.push(Prisma.sql`a."status"::text = ${statuses[0]}`);
    } else if (statuses.length > 1) {
      where.push(Prisma.sql`a."status"::text IN (${Prisma.join(statuses)})`);
    }
  }
  if (includeSkinPigmentationPending) {
    where.push(Prisma.sql`(a.status::text <> 'PENDING' OR a."rawResponses"->'__meta'->>'concern' IN ('skin_acne', 'skin_pigmentation', 'skin_anti_ageing'))`);
  }
  // Same rule the dashboard counts and the next-patient handoff use, so the
  // queue page cannot list a case the other two have already withheld.
  if (openableOnly) where.push(REVIEWABLE_SOURCE_SQL);
  if (assignedTo) where.push(Prisma.sql`a."reviewingDoctorId" = ${assignedTo}`);
  if (decision) where.push(Prisma.sql`a."reviewDecision"::text = ${decision}`);
  if (diagnosis) where.push(Prisma.sql`sev.content->>'primaryDiagnosis' = ${diagnosis}`);
  if (severity) where.push(Prisma.sql`sev.content->>'severity' = ${severity}`);
  if (priorityOnly) {
    where.push(
      Prisma.sql`a."reviewPathway"::text IN (${Prisma.join(PRIORITY_PATHWAYS)})`,
    );
  }
  if (Number.isFinite(waitingOverHours) && waitingOverHours > 0) {
    where.push(
      // ::int is required — make_interval's named-argument form cannot infer a
      // bind parameter's type and errors out without the cast.
      Prisma.sql`a."submittedAt" < now() - make_interval(hours => ${Math.floor(waitingOverHours)}::int)`,
    );
  }

  const whereSql = Prisma.sql`WHERE ${Prisma.join(where, ` AND `)}`;

  // Ordering must happen in Postgres, not in the browser. The page fetches a
  // capped window (limit 200) out of a backlog that is currently 441 deep —
  // re-sorting that window client-side made the "longest waiting first" view
  // silently wrong, because the genuinely oldest cases were never in it.
  const orderSql =
    sort === "oldest"
      ? Prisma.sql`ORDER BY a."submittedAt" ASC NULLS LAST`
      : Prisma.sql`ORDER BY a."submittedAt" DESC NULLS LAST`;

  try {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        submittedAt: Date;
        status: string;
        patientId: string;
        patientName: string;
        patientPhone: string | null;
        patientAge: number | null;
        patientGender: string | null;
        reviewPathway: string | null;
        reviewPathwayReasons: string[] | null;
        clinicId: string;
        clinicName: string;
        careDoctorId: string | null;
        careDoctorName: string | null;
        reviewerId: string | null;
        reviewerName: string | null;
        decision: string | null;
        decisionReviewerName: string | null;
        decisionAt: Date | null;
        primaryDiagnosis: string | null;
        severity: string | null;
        consultationVersion: number | null;
        consultationApprovalStatus: string | null;
        concern: string | null;
        skinIntakeId: string | null;
        skinConcernCount: number;
        consultationStatus: string | null;
        imageCount: number;
        previousPrescriptionUploaded: boolean;
        medicationDeclared: boolean;
        medicalHistoryDeclared: boolean;
        bodyPigmentationSelected: boolean;
      }>
    >(Prisma.sql`
      SELECT
        a.id,
        a."submittedAt",
        a.status::text                                 AS "status",
        p.id                                           AS "patientId",
        p.name                                         AS "patientName",
        p.phone                                        AS "patientPhone",
        p.age                                          AS "patientAge",
        p.gender                                       AS "patientGender",
        a."reviewPathway"::text                        AS "reviewPathway",
        a."reviewPathwayReasons"                       AS "reviewPathwayReasons",
        c.id                                           AS "clinicId",
        c.name                                         AS "clinicName",
        cd.id                                          AS "careDoctorId",
        cd.name                                        AS "careDoctorName",
        rev.id                                         AS "reviewerId",
        rev.name                                       AS "reviewerName",
        a."reviewDecision"::text                       AS "decision",
        a."reviewerName"                               AS "decisionReviewerName",
        a."reviewedAt"                                 AS "decisionAt",
        sev.content->>'primaryDiagnosis'               AS "primaryDiagnosis",
        sev.content->>'severity'                       AS "severity",
        cv."contentVersion"                            AS "consultationVersion",
        cv."approvalStatus"::text                      AS "consultationApprovalStatus",
        a."rawResponses"->'__meta'->>'concern'         AS "concern",
        a."rawResponses"->'__meta'->>'skinIntakeId'    AS "skinIntakeId",
        COALESCE((a."rawResponses"->'__meta'->>'skinConcernCount')::int, 1) AS "skinConcernCount",
        COALESCE(a."rawResponses"->'pigmentation'->>'consultationStatus', 'REQUIRED') AS "consultationStatus",
        (SELECT count(*)::int FROM jsonb_object_keys(CASE WHEN jsonb_typeof(a."rawResponses"->'antiAgeing'->'AA_10') = 'object' THEN a."rawResponses"->'antiAgeing'->'AA_10' WHEN jsonb_typeof(a."rawResponses"->'pigmentation'->'PIG_14') = 'object' THEN a."rawResponses"->'pigmentation'->'PIG_14' ELSE '{}'::jsonb END)) AS "imageCount",
        (a."rawResponses"->'pigmentation' ? 'PIG_13_PRESCRIPTION') AS "previousPrescriptionUploaded",
        (a."rawResponses"->'pigmentation'->>'PIG_07' = 'yes') AS "medicationDeclared",
        (a."rawResponses"->'pigmentation'->>'PIG_08' = 'yes') AS "medicalHistoryDeclared",
        (COALESCE(a."rawResponses"->'pigmentation'->'PIG_02', '[]'::jsonb) ? 'body_other') AS "bodyPigmentationSelected"
      FROM "Assessment" a
      JOIN "Patient" p   ON p.id = a."patientId"
      JOIN "Clinic" c    ON c.id = a."clinicId"
      LEFT JOIN "Doctor" cd  ON cd.id = p."doctorId"
      LEFT JOIN "Doctor" rev ON rev.id = a."reviewingDoctorId"
      LEFT JOIN "AIArtifact" sev
             ON sev."assessmentId" = a.id AND sev.type = 'SEVERITY_ANALYSIS'
      LEFT JOIN "Consultation" cons ON cons."assessmentId" = a.id
      LEFT JOIN "ConsultationVersion" cv ON cv.id = cons."currentVersionId"
      ${whereSql}
      ${orderSql}
      LIMIT ${limit} OFFSET ${offset}
    `);

    const totalRow = await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM "Assessment" a
      JOIN "Patient" p ON p.id = a."patientId"
      LEFT JOIN "AIArtifact" sev
             ON sev."assessmentId" = a.id AND sev.type = 'SEVERITY_ANALYSIS'
      ${whereSql}
    `);

    return NextResponse.json({
      rows: rows.map((r) => ({
        ...r,
        submittedAt: r.submittedAt?.toISOString?.() ?? null,
        decisionAt: r.decisionAt?.toISOString?.() ?? null,
      })),
      total: Number(totalRow[0]?.total ?? 0),
      limit,
      offset,
    });
  } catch (err) {
    console.error("[DOCTOR REPORTS API]", err);
    return NextResponse.json({ rows: [], total: 0, error: "Internal server error" }, { status: 500 });
  }
}

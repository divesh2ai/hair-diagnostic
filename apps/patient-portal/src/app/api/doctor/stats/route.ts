import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { describeSchemaDrift, isSchemaDriftError } from "@/lib/prismaErrors";
import { requireDoctorContext } from "@/lib/auth";
import { clinicSessionCutoff, type InClinicVisit } from "@/lib/doctor/clinicVisits";
// Membership in the Review Queue is defined once, so the count here and
// the next-patient handoff after an approval can never disagree.
import { REVIEW_QUEUE_STATUSES } from "@/lib/doctor/reviewQueue";

export const dynamic = "force-dynamic";

// Single dashboard loader for /doctor.
//
// The dashboard needs four counts, one "next patient", a short waiting list
// and the in-clinic list. That is deliberately ONE request with ONE
// Promise.all rather than a fetch per widget — a dashboard that opens six
// connections to tell a clinician what to do first has already failed at its
// job. This endpoint is polled every 15 seconds while /doctor is visible, so
// its cost is a standing cost and is kept deliberately flat.
//
// ── Nothing heavy is loaded here ─────────────────────────────────────────────
// No questionnaires, no images, no clinical reasoning, no reports. The queue
// slice is a single raw query that orders the whole pending set in Postgres
// and returns only the top N, so the cost does not grow with the backlog.
//
// ── Two timestamps, two meanings ─────────────────────────────────────────────
//   Assessment.submittedAt  → "Ready for review · waiting 6 min"
//   ClinicVisit.startedAt   → "Assessment in progress · started 6 min ago"
// Doctor-review waiting begins when the patient submits, never at QR scan,
// identity capture or questionnaire start. Both are returned as ISO strings
// and rendered relative in the browser, so the timers tick without polling.

// One next patient plus a short strip of who follows. Not a queue page.
const QUEUE_SIZE = 6;

// A waiting room, not a backlog. Bounded so a runaway table can never turn the
// dashboard payload into a page-load problem.
const IN_CLINIC_SIZE = 20;

interface QueueRow {
  id: string;
  submittedAt: Date | null;
  status: string;
  patientName: string;
  patientAge: number | null;
  patientGender: string | null;
  clinicName: string;
  primaryDiagnosis: string | null;
  severity: string | null;
  reviewPathway: string | null;
  reviewPathwayReasons: string[] | null;
  concern: string | null;
}

// `needsAttention` is absent, not zero. See the payload below.
const EMPTY_COUNTS = {
  pending: 0,
  inProgress: 0,
  approvedToday: 0,
  kitOrders: 0,
};

export async function GET(_req: Request) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor } = authResult;
  // Doctor dashboard stats are always pinned to the caller's own clinic.
  // Platform-wide stats live on /api/admin/dashboard under a super-admin
  // gate. The former `?clinicId=` cross-clinic peek was a source of
  // ambiguity — removed.
  const scope = { clinicId: doctor.clinicId };

  try {
    const baseWhere = { ...scope, deletedAt: null };
    const pendingWhere: Prisma.AssessmentWhereInput = {
      ...baseWhere,
      status: { in: REVIEW_QUEUE_STATUSES },
      reviewDecision: "PENDING",
    };

    const scopeSql = Prisma.sql`AND a."clinicId" = ${scope.clinicId}`;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // An open visit inside the current clinic session. Older open visits are
    // simply not asked for — see lib/doctor/clinicVisits on why this is a
    // display window rather than an abandonment workflow.
    const openVisitWhere = {
      ...scope,
      assessmentId: null,
      startedAt: { gte: clinicSessionCutoff() },
    };

    const [
      pending,
      kitOrders,
      approvedToday,
      needsAttention,
      queue,
      visits,
    ] = await Promise.all([
      prisma.assessment.count({ where: pendingWhere }),
      prisma.kitOrderIntent.count({
        where: { ...scope, status: "READY_FOR_FULFILMENT" },
      }),
      prisma.assessment.count({
        where: {
          ...baseWhere,
          reviewDecision: "APPROVED",
          reviewedAt: { gte: startOfDay },
        },
      }),
      prisma.assessment.count({
        where: {
          ...baseWhere,
          status: { in: ["FAILED", "PARTIAL_FAILURE"] },
        },
      }),
      prisma.$queryRaw<QueueRow[]>(Prisma.sql`
        SELECT
          a.id,
          a."submittedAt",
          a.status::text                          AS "status",
          p.name                                  AS "patientName",
          p.age                                   AS "patientAge",
          p.gender                                AS "patientGender",
          c.name                                  AS "clinicName",
          sev.content->>'primaryDiagnosis'        AS "primaryDiagnosis",
          sev.content->>'severity'                AS "severity",
          a."reviewPathway"::text                 AS "reviewPathway",
          a."reviewPathwayReasons"                AS "reviewPathwayReasons",
          a."rawResponses"->'__meta'->>'concern'  AS "concern"
        FROM "Assessment" a
        JOIN "Patient" p ON p.id = a."patientId"
        JOIN "Clinic"  c ON c.id = a."clinicId"
        LEFT JOIN "AIArtifact" sev
               ON sev."assessmentId" = a.id AND sev.type = 'SEVERITY_ANALYSIS'
        WHERE a."deletedAt" IS NULL
          AND a."reviewDecision"::text = 'PENDING'
          AND a.status::text IN (${Prisma.join(REVIEW_QUEUE_STATUSES.map(String))})
          ${scopeSql}
        -- FIFO. The patient who has been waiting longest is seen next, full
        -- stop. Clinical classification is display information on the row and
        -- must never reorder a waiting room — a queue that reshuffles itself
        -- is a queue no patient and no receptionist can predict.
        ORDER BY a."submittedAt" ASC NULLS LAST
        LIMIT ${QUEUE_SIZE}
      `),
      // Degrades to an empty waiting room if the code is deployed ahead of its
      // migration. The Review Queue is the clinically important half of this
      // dashboard and must not be taken down by a table that did not exist
      // yesterday.
      readOpenVisits(openVisitWhere),
    ]);

    return NextResponse.json({
      counts: {
        // Ready for a doctor's decision.
        pending,
        // Named patients currently filling in the assessment.
        inProgress: visits.total,
        approvedToday,
        kitOrders,
        // Exceptional, and therefore optional: reports that could not finish
        // generating. On a healthy clinic this is nothing, and a standing
        // "0 needs attention" is a counter that trains a doctor to skip the
        // line where a real problem will one day appear. Omitted entirely
        // rather than sent as zero, so the absence is the normal case in the
        // contract as well as on the screen.
        ...(needsAttention > 0 ? { needsAttention } : {}),
      },
      // Pending work, oldest first. First row is the next patient; the rest
      // fill the waiting strip.
      queue: queue.map((r) => ({
        id: r.id,
        submittedAt: r.submittedAt?.toISOString() ?? null,
        status: r.status,
        patientName: r.patientName,
        patientAge: r.patientAge,
        patientGender: r.patientGender,
        clinicName: r.clinicName,
        primaryDiagnosis: r.primaryDiagnosis,
        severity: r.severity,
        reviewPathway: r.reviewPathway,
        reviewPathwayReasons: r.reviewPathwayReasons ?? [],
        concern: r.concern,
      })),
      inClinic: visits.rows,
    });
  } catch (err) {
    console.error("[DOCTOR STATS API]", err);
    return NextResponse.json(
      { counts: EMPTY_COUNTS, queue: [], inClinic: [], error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Open visits at this clinic, plus the exact count.
 *
 * The count is its own query rather than `rows.length` because the row list is
 * capped: a busy clinic must still see the right number even when the list is
 * truncated. Both run inside the same Promise.all, so this costs a query, not
 * a round trip.
 */
async function readOpenVisits(
  where: Prisma.ClinicVisitWhereInput,
): Promise<{ rows: InClinicVisit[]; total: number }> {
  try {
    const [rows, total] = await Promise.all([
      prisma.clinicVisit.findMany({
        where,
        // Longest in the room first, matching how the Review Queue reads.
        orderBy: { startedAt: "asc" },
        select: { id: true, displayName: true, startedAt: true },
        take: IN_CLINIC_SIZE,
      }),
      prisma.clinicVisit.count({ where }),
    ]);
    return {
      rows: rows.map((v) => ({
        id: v.id,
        displayName: v.displayName,
        startedAt: v.startedAt.toISOString(),
      })),
      total,
    };
  } catch (err) {
    if (isSchemaDriftError(err)) {
      console.error(
        `[DOCTOR STATS API] ClinicVisit schema not migrated — missing ${describeSchemaDrift(err)}. ` +
          `Apply prisma/migrations/20260813_clinic_visit. The Review Queue is unaffected; ` +
          `the In Clinic panel stays empty until it lands.`,
      );
      return { rows: [], total: 0 };
    }
    throw err;
  }
}

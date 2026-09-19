import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { describeSchemaDrift, isSchemaDriftError } from "@/lib/prismaErrors";
import { clinicSessionCutoff, type InClinicVisit } from "@/lib/doctor/clinicVisits";
import type { DeckQueueRow } from "@/lib/doctor/patientDeck";
// Membership in the Review Queue is defined once, so the count here, the
// deck, the queue page and the next-patient handoff can never disagree.
import { reviewQueueSql, unopenableQueueSql } from "@/lib/doctor/reviewQueue";

// The single dashboard read, extracted from /api/doctor/stats.
//
// ── Why it lives here and not in the route ──────────────────────────────────
// /doctor used to render an empty shell, ship its JavaScript, hydrate, and
// only then ask the API what to draw — so the doctor watched a skeleton for
// one whole round trip on a page whose entire job is to be read at a glance.
// The server can run this query while the browser is still downloading the
// bundle, so it does: the page server-renders with real data and the client
// polls on from there.
//
// The route is now a thin authenticated wrapper around this function, so the
// first paint and every subsequent poll answer from exactly one query plan.
// There is no second definition of "pending" to drift.
//
// Nothing heavy is loaded: no questionnaires, no images, no clinical
// reasoning, no reports. The queue slice is a single raw query that orders the
// whole pending set in Postgres and returns only the top N, so the cost does
// not grow with the backlog.
//
// ── Two timestamps, two meanings ─────────────────────────────────────────────
//   Assessment.submittedAt  → "Ready for review · waiting 6 min"
//   ClinicVisit.startedAt   → "Assessment in progress · started 6 min ago"
// Doctor-review waiting begins when the patient submits, never at QR scan,
// identity capture or questionnaire start. Both are returned as ISO strings
// and rendered relative in the browser, so the timers tick without polling.

/** One next patient plus a short strip of who follows. Not a queue page. */
const QUEUE_SIZE = 6;

/** A waiting room, not a backlog. Bounded so a runaway table can never turn
 *  the dashboard payload into a page-load problem. */
const IN_CLINIC_SIZE = 20;

export interface DashboardCounts {
  pending: number;
  inProgress: number;
  approvedToday: number;
  reviewedToday: number;
  kitOrders: number;
  /**
   * Distinct assessments this clinic shared a report/order link for today —
   * PATIENT_REPORT_SHARED / PATIENT_CART_SHARED (the automated send path,
   * lib/delivery/sendPatientLink.ts) or MANUAL_SHARE_OPENED (the doctor
   * opening their own WhatsApp with the same governed link). Read from
   * AuditLog rather than WhatsappDelivery: the post-approval delivery
   * columns that count would need (clinicId, sentAt) are not confirmed
   * applied in every environment (see KitOrderIntent's own header on the
   * same migration), and AuditLog's schema has no such uncertainty.
   */
  sharedToday: number;
  /** Absent, not zero — omitted entirely when no report failed. */
  needsAttention?: number;
  /**
   * Pending cases withheld from the queue because they cannot be opened —
   * no stored questionnaire and no persisted consultation. Absent, not zero,
   * for the same reason as `needsAttention`: a standing 0 is a line that
   * trains the reader to skip the place a real problem will appear.
   */
  unopenable?: number;
}

export interface DashboardStats {
  counts: DashboardCounts;
  queue: DeckQueueRow[];
  inClinic: InClinicVisit[];
  /** Open visits at the clinic, which may exceed the capped `inClinic` list. */
  inClinicTotal: number;
}

export const EMPTY_DASHBOARD_COUNTS: DashboardCounts = {
  pending: 0,
  inProgress: 0,
  approvedToday: 0,
  reviewedToday: 0,
  kitOrders: 0,
  sharedToday: 0,
};

const SHARE_AUDIT_ACTIONS = [
  "PATIENT_REPORT_SHARED",
  "PATIENT_CART_SHARED",
  "MANUAL_SHARE_OPENED",
] as const;

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
  recommendedKitCount: number | null;
}

/**
 * Everything /doctor needs, for one clinic, in one Promise.all.
 *
 * Always scoped to a single clinic id — the caller has already authorised it.
 * Platform-wide stats live on /api/admin/dashboard under a super-admin gate.
 */
export async function loadDashboardStats(clinicId: string): Promise<DashboardStats> {
  const scope = { clinicId };
  const baseWhere = { ...scope, deletedAt: null };

  // One predicate, three uses: the "ready for review" count, the deck slice
  // and (via lib/doctor/reviewQueue) the next-patient handoff. `clinicId` is
  // the authenticated Doctor row's own clinic — see the caller.
  const queueSql = reviewQueueSql(clinicId);

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
    queueCounts,
    kitOrders,
    approvedToday,
    reviewedToday,
    needsAttention,
    sharedToday,
    queue,
    visits,
  ] = await Promise.all([
    // Ready-for-review and withheld-as-unopenable, counted together against
    // the same rows so the two can never be computed from different snapshots.
    prisma.$queryRaw<Array<{ ready: bigint; unopenable: bigint }>>(Prisma.sql`
      SELECT
        (SELECT count(*) FROM "Assessment" a WHERE ${queueSql})            AS "ready",
        (SELECT count(*) FROM "Assessment" a WHERE ${unopenableQueueSql(clinicId)}) AS "unopenable"
    `),
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
    // Reviewed today = every case a doctor made a decision on since midnight,
    // approved or not. A real superset of approvedToday (reviewedAt is stamped
    // for every terminal decision, not just approvals), so it is a truthful
    // distinct metric — not a relabelled copy of "approved".
    prisma.assessment.count({
      where: {
        ...baseWhere,
        reviewDecision: { not: "PENDING" },
        reviewedAt: { gte: startOfDay },
      },
    }),
    prisma.assessment.count({
      where: {
        ...baseWhere,
        status: { in: ["FAILED", "PARTIAL_FAILURE"] },
      },
    }),
    // Distinct assessments, not distinct events — pressing Share twice on one
    // case must not count as two patients reached today.
    prisma.auditLog
      .findMany({
        where: {
          clinicId,
          action: { in: [...SHARE_AUDIT_ACTIONS] },
          createdAt: { gte: startOfDay },
        },
        select: { assessmentId: true },
        distinct: ["assessmentId"],
      })
      .then((rows) => rows.filter((r) => r.assessmentId).length),
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
        a."rawResponses"->'__meta'->>'concern'  AS "concern",
        -- Recommended kits, straight from the persisted RECOMMENDATIONS
        -- artifact. This is a count of an already-authored array, not a
        -- recomputation: the recommendation engine has run and stored
        -- content.rankedKits, and we read its length. The jsonb_typeof
        -- guard keeps a malformed or absent payload as NULL rather than
        -- erroring, so the card simply omits the line. Same indexed
        -- (assessmentId, type) join shape as the severity join above -- no
        -- N+1, no engine execution.
        CASE
          WHEN jsonb_typeof(rec.content->'rankedKits') = 'array'
          THEN jsonb_array_length(rec.content->'rankedKits')
          ELSE NULL
        END                                     AS "recommendedKitCount"
      FROM "Assessment" a
      JOIN "Patient" p ON p.id = a."patientId"
      JOIN "Clinic"  c ON c.id = a."clinicId"
      LEFT JOIN "AIArtifact" sev
             ON sev."assessmentId" = a.id AND sev.type = 'SEVERITY_ANALYSIS'
      LEFT JOIN "AIArtifact" rec
             ON rec."assessmentId" = a.id AND rec.type = 'RECOMMENDATIONS'
      WHERE ${queueSql}
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

  const ready = Number(queueCounts[0]?.ready ?? 0);
  const unopenable = Number(queueCounts[0]?.unopenable ?? 0);

  return {
    counts: {
      // Ready for a doctor's decision — and genuinely openable.
      pending: ready,
      // Named patients currently filling in the assessment.
      inProgress: visits.total,
      approvedToday,
      reviewedToday,
      kitOrders,
      sharedToday,
      // Exceptional, and therefore optional: reports that could not finish
      // generating. On a healthy clinic this is nothing, and a standing
      // "0 needs attention" is a counter that trains a doctor to skip the
      // line where a real problem will one day appear. Omitted entirely
      // rather than sent as zero, so the absence is the normal case in the
      // contract as well as on the screen.
      ...(needsAttention > 0 ? { needsAttention } : {}),
      ...(unopenable > 0 ? { unopenable } : {}),
    },
    // Pending work, oldest first. First row is the next patient; the rest
    // fill the deck behind it.
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
      // Number(...) because jsonb_array_length can arrive as a bigint-ish
      // value over the driver; null stays null and the card hides the line.
      recommendedKitCount:
        r.recommendedKitCount == null ? null : Number(r.recommendedKitCount),
    })),
    inClinic: visits.rows,
    inClinicTotal: visits.total,
  };
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
        `[DOCTOR STATS] ClinicVisit schema not migrated — missing ${describeSchemaDrift(err)}. ` +
          `Apply prisma/migrations/20260813_clinic_visit. The Review Queue is unaffected; ` +
          `the In Clinic panel stays empty until it lands.`,
      );
      return { rows: [], total: 0 };
    }
    throw err;
  }
}

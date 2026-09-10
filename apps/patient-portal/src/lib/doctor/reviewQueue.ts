import { AssessmentStatus, Prisma } from "@prisma/client";

// What "in the Review Queue" means, in one place.
//
// Four surfaces need this answer — the dashboard counts, the patient deck, the
// next-patient handoff after an approval, and the queue page itself. When each
// had its own copy, "5 ready for review" and the list below it could disagree,
// which is the kind of small lie that makes a clinician stop believing the
// number.

/**
 * Statuses that mean "the clinical work is done and a doctor must decide".
 *
 * FAILED / PARTIAL_FAILURE are deliberately excluded: those cases cannot be
 * approved as they stand, so pushing them to the front of a reading queue
 * wastes the one thing the queue is protecting. They surface as their own
 * "needs attention" count instead.
 */
export const REVIEW_QUEUE_STATUSES: AssessmentStatus[] = [
  AssessmentStatus.CLINICAL_READY,
  AssessmentStatus.REPORT_GENERATING,
  AssessmentStatus.COMPLETED,
];

/**
 * The second half of membership: can this case actually be OPENED?
 *
 * ── The defect this closes ──────────────────────────────────────────────────
 * Status and decision were the whole rule, so a row could be advertised as
 * "Ready for review · waiting 12 days", sit at the front of the FIFO queue,
 * be the dashboard's one-click "Next patient" — and then refuse to open with
 * "its original assessment responses were not stored". A queue that offers a
 * case it cannot deliver is worse than an empty queue: the doctor spends the
 * click, loses the context, and learns to distrust the count.
 *
 * ── Why exactly these two branches ──────────────────────────────────────────
 * This mirrors the orchestrator's own contract (see
 * src/packages/consultation-orchestrator/orchestrator.ts) rather than
 * inventing a second opinion about reviewability:
 *
 *   1. A non-empty questionnaire object → the consultation can be COMPOSED.
 *      `classifyAnswers` refuses null, non-objects and `{}` for the same
 *      reason: composing from an empty object would run the clinical engines
 *      over invented input and persist the result as this patient's immutable
 *      v1.
 *   2. A Consultation row already exists → it can be READ. `getOrCreateDetailed`
 *      returns any stored version BEFORE it reaches the composability guard,
 *      so a legacy record that was composed while it still had its answers
 *      stays fully reviewable. Dropping those would hide real, openable
 *      clinical work.
 *
 * A row that satisfies neither is preserved and still visible on the queue
 * page's All tab — it is only barred from claiming to be ready.
 *
 * SQL rather than a Prisma `where` because neither branch is expressible in
 * the query builder: `jsonb_typeof` has no Prisma equivalent, and Prisma
 * cannot distinguish JSON `null` from an absent column without raw SQL.
 * Assumes the Assessment table is aliased `a` — every caller aliases it `a`.
 */
export const REVIEWABLE_SOURCE_SQL = Prisma.sql`(
  (
    -- The IS NOT NULL test is load-bearing, not belt-and-braces:
    -- jsonb_typeof(NULL) is NULL, so without it the whole expression evaluates
    -- to NULL on exactly the rows this rule exists to catch. NULL is not TRUE,
    -- so the positive filter still excluded them — but NOT NULL is also NULL,
    -- so the negative filter counted zero of them and the dashboard reported
    -- nothing wrong. Three-valued logic, closed here rather than at each site.
    a."rawResponses" IS NOT NULL
    AND jsonb_typeof(a."rawResponses") = 'object'
    AND a."rawResponses" <> '{}'::jsonb
  )
  OR EXISTS (SELECT 1 FROM "Consultation" ct WHERE ct."assessmentId" = a.id)
)`;

/**
 * The inverse: a pending case a doctor cannot open.
 *
 * Counted so the dashboard can say so out loud instead of silently dropping
 * the row — see the Needs attention panel.
 */
export const UNOPENABLE_SOURCE_SQL = Prisma.sql`NOT ${REVIEWABLE_SOURCE_SQL}`;

/**
 * Full queue membership for one clinic, as a SQL predicate.
 *
 * `clinicId` is always a server-derived value from the authenticated Doctor
 * row — never a browser-supplied parameter. Callers alias Assessment as `a`.
 *
 * FIFO ordering is the caller's job (`submittedAt` ascending, always) — this
 * is the membership rule, not the order.
 */
export function reviewQueueSql(clinicId: string): Prisma.Sql {
  return Prisma.sql`
        a."deletedAt" IS NULL
    AND a."clinicId" = ${clinicId}
    AND a."reviewDecision"::text = 'PENDING'
    AND a.status::text IN (${Prisma.join(REVIEW_QUEUE_STATUSES.map(String))})
    AND ${REVIEWABLE_SOURCE_SQL}
  `;
}

/**
 * Pending at this clinic but NOT openable — the records the queue withholds.
 */
export function unopenableQueueSql(clinicId: string): Prisma.Sql {
  return Prisma.sql`
        a."deletedAt" IS NULL
    AND a."clinicId" = ${clinicId}
    AND a."reviewDecision"::text = 'PENDING'
    AND a.status::text IN (${Prisma.join(REVIEW_QUEUE_STATUSES.map(String))})
    AND ${UNOPENABLE_SOURCE_SQL}
  `;
}

/**
 * Everything pending a decision at one clinic, as a Prisma filter.
 *
 * NOTE: this is the STATUS half of membership only — it cannot express the
 * composability rule above (see REVIEWABLE_SOURCE_SQL on why). Anything that
 * counts or lists "ready for review" must use `reviewQueueSql`; this remains
 * for callers that genuinely want every pending row regardless of whether it
 * can be opened.
 */
export function reviewQueueWhere(clinicId: string): Prisma.AssessmentWhereInput {
  return {
    clinicId,
    deletedAt: null,
    status: { in: REVIEW_QUEUE_STATUSES },
    reviewDecision: "PENDING",
  };
}

import { AssessmentStatus, type Prisma } from "@prisma/client";

// What "in the Review Queue" means, in one place.
//
// Three surfaces need this answer — the dashboard counts, the next-patient
// handoff after an approval, and the queue page itself. When each had its own
// copy, "5 ready for review" and the list below it could disagree, which is
// the kind of small lie that makes a clinician stop believing the number.

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
 * Everything pending a decision at one clinic.
 *
 * FIFO ordering is the caller's job (`submittedAt` ascending, always) — this
 * is the membership rule, not the order.
 */
export function reviewQueueWhere(clinicId: string): Prisma.AssessmentWhereInput {
  return {
    clinicId,
    deletedAt: null,
    status: { in: REVIEW_QUEUE_STATUSES },
    reviewDecision: "PENDING",
  };
}

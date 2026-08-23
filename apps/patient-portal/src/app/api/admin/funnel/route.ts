import { NextResponse } from "next/server";
import { SystemRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

// GET /api/admin/funnel — platform-wide conversion funnel for the super
// admin dashboard. Counts across all clinics; scope narrowing lives in the
// clinic-admin view instead.
//
// This endpoint was previously non-functional, not merely inaccurate. It
// filtered on `reviewDecision: "NEEDS_REVISION"`, which is not a member of
// the ReviewDecision enum (PENDING | APPROVED | EDITS_REQUESTED | REJECTED).
// Prisma rejects an unknown enum value at runtime, this route has no
// try/catch, and the dashboard swallows the failure with
// `.catch(() => setFunnel(null))` — so the funnel card simply never rendered
// and nobody saw an error. Two of its stages were additionally meaningless:
// the counts ignored `deletedAt`, and "submitted" filtered on a non-nullable
// column. Every stage below is now a query that can actually be satisfied.

export async function GET() {
  const auth = await requireRole(SystemRole.SUPER_ADMIN);
  if (auth instanceof NextResponse) return auth;

  // Deployed Prisma runs through pgbouncer with connection_limit=1 (see the
  // matching notes in /api/admin/dashboard and /api/admin/metrics). A
  // Promise.all of independent counts starves that single connection and can
  // blow the lambda timeout; $transaction runs the batch sequentially on one
  // connection, which is what pgbouncer expects. This route was the last one
  // still using Promise.all — and the widest, so the most exposed.
  const [
    assessmentsStarted,
    assessmentsCompleted,
    reviewsApproved,
    reviewsEditsRequested,
    reviewsRejected,
    kitOrders,
    kitOrdersActive,
    clinicCount,
    doctorCount,
  ] = await prisma.$transaction([
    // Every assessment count is scoped to `deletedAt: null` to match the
    // dashboard cards rendered directly above this strip. Without it,
    // soft-deleted assessments inflated the first bar only, so the two
    // components on one screen disagreed about how many assessments exist.
    prisma.assessment.count({ where: { deletedAt: null } }),
    // Was `submittedAt: { not: null }`, which is a tautology: submittedAt is
    // `DateTime @default(now())` and therefore never null, so this stage
    // always equalled the stage above it. Completion is the real second step
    // and `status: COMPLETED` is how the dashboard already measures it.
    prisma.assessment.count({
      where: { deletedAt: null, status: "COMPLETED" },
    }),
    // APPROVED alone is the conversion step. The previous query also counted
    // "NEEDS_REVISION", which is not a member of the ReviewDecision enum at
    // all (PENDING | APPROVED | EDITS_REQUESTED | REJECTED) — see the note in
    // the route header. EDITS_REQUESTED is the real "sent back" state and is
    // reported as a leak, not as forward progress.
    prisma.assessment.count({
      where: { deletedAt: null, reviewDecision: "APPROVED" },
    }),
    prisma.assessment.count({
      where: { deletedAt: null, reviewDecision: "EDITS_REQUESTED" },
    }),
    prisma.assessment.count({
      where: { deletedAt: null, reviewDecision: "REJECTED" },
    }),
    prisma.kitOrderIntent.count(),
    prisma.kitOrderIntent.count({ where: { status: "READY_FOR_FULFILMENT" } }),
    prisma.clinic.count({ where: { deletedAt: null } }),
    prisma.doctor.count({ where: { deletedAt: null } }),
  ]);

  return NextResponse.json({
    counts: {
      clinics: clinicCount,
      doctors: doctorCount,
    },
    funnel: {
      started: assessmentsStarted,
      completed: assessmentsCompleted,
      approved: reviewsApproved,
      orders: kitOrders,
      ordersActive: kitOrdersActive,
    },
    // Off-funnel outcomes — shown beside the strip, never inside it.
    leaks: {
      editsRequested: reviewsEditsRequested,
      rejected: reviewsRejected,
    },
  });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";
import { readFailedDeliveries } from "@/lib/delivery/deliveryStore";
import {
  listPaidAwaitingFulfilment,
  listUnpaidCarts,
} from "@/lib/payments/paymentStore";
import { listFulfilments } from "@/lib/fulfilment/fulfilmentStore";
import { IN_FLIGHT_STATUSES, STALE_AFTER_MINUTES } from "@/lib/admin/jobHealth";
import { loadPeopleDirectory } from "@/lib/admin/peopleDirectory";
import { locationSetupState } from "@/lib/clinic/location";

// GET /api/admin/action-centre
//
// What needs a human right now, and nothing else.
//
// ── The editorial rule ──────────────────────────────────────────────────────
// Every group here is an EXCEPTION: something is stuck, waiting, or has
// failed, and a person has to do something about it. Throughput — assessments
// completed, reports opened, revenue — is deliberately absent; that is the
// dashboard's job, and mixing the two produces a screen where the two orders
// nobody has packed are three scrolls below a chart that is doing fine.
//
// A group that is EMPTY is a group that is finished, and it reports zero
// rather than disappearing, so an operator can tell "nothing to do" from "that
// panel is broken".
//
// ── Independent degradation ─────────────────────────────────────────────────
// Three of the eight groups read tables from the unapplied
// 20260829_post_approval_workflow migration. Each is settled on its own and
// marked `available: false` when it cannot be read.
//
// This distinction is the whole point of the panel. "0 kit orders awaiting
// fulfilment" and "we cannot see the fulfilment queue" lead an operator to
// opposite actions, and a Promise.all that collapsed one into the other would
// show a calm, empty, entirely false action centre on the day the queue
// stopped being readable.

export const dynamic = "force-dynamic";

/** How long a sent-but-unpaid cart may sit before it is worth a phone call. */
const UNPAID_FOLLOWUP_HOURS = 24;

interface Group<T> {
  available: boolean;
  count: number;
  items: T[];
}

function unavailable<T>(): Group<T> {
  // Count is 0 but `available` is false, and every consumer must read the flag
  // before the number. A UI that sums counts without checking availability
  // silently reports a healthy total.
  return { available: false, count: 0, items: [] };
}

async function settle<T>(run: () => Promise<T[]>): Promise<Group<T>> {
  try {
    const items = await run();
    return { available: true, count: items.length, items };
  } catch {
    return unavailable<T>();
  }
}

export async function GET() {
  try {
    await assertSuperAdmin();
  } catch (err) {
    const response = handleAuthError(err);
    if (response) return response;
    throw err;
  }

  const [
    awaitingReview,
    fulfilmentAwaitingOps,
    paidAwaitingFulfilment,
    unpaidCarts,
    awaitingAcknowledgement,
    failedDeliveries,
    stalledAssessments,
    rolelessAccounts,
    clinicsMissingLocation,
  ] = await Promise.all([
    // Assessments a doctor has not decided on yet. Reads the legacy workflow
    // flag rather than the consultation aggregate because it is the column the
    // doctor's own queue filters on — the action centre must count the same
    // cases the doctor sees, not a second, subtly different set.
    settle(async () => {
      const rows = await prisma.assessment.findMany({
        where: {
          deletedAt: null,
          reviewDecision: "PENDING",
          status: { in: ["COMPLETED", "CLINICAL_READY"] },
        },
        orderBy: { submittedAt: "asc" },
        take: 50,
        select: {
          id: true,
          submittedAt: true,
          clinic: { select: { id: true, name: true } },
        },
      });
      return rows.map((r) => ({
        assessmentId: r.id,
        clinicId: r.clinic.id,
        clinicName: r.clinic.name,
        waitingSince: r.submittedAt.toISOString(),
      }));
    }),

    settle(() =>
      listFulfilments({ clinicId: null, statuses: ["REQUESTED"], limit: 50 }),
    ),

    // The reconciliation group: money took, request never created. Should
    // normally be empty — a non-empty one means the trigger failed in the gap
    // between the payment write and the fulfilment write, and a patient is
    // waiting for a kit nobody has been told to pack.
    settle(() => listPaidAwaitingFulfilment({ clinicId: null, limit: 50 })),

    settle(() =>
      listUnpaidCarts({
        clinicId: null,
        olderThanHours: UNPAID_FOLLOWUP_HOURS,
        limit: 50,
      }),
    ),

    // Delivered but not confirmed by the clinic. Ops thinks it arrived; nobody
    // at the clinic has said so.
    settle(() =>
      listFulfilments({ clinicId: null, statuses: ["DELIVERED"], limit: 50 }),
    ),

    settle(() => readFailedDeliveries(null, 50)),

    // Work the pipeline started and never finished. Not FAILED, so nothing
    // else in the platform notices it — which is exactly why it belongs in a
    // panel about what needs a human.
    settle(async () => {
      const rows = await prisma.assessment.findMany({
        where: {
          deletedAt: null,
          status: { in: [...IN_FLIGHT_STATUSES] },
          updatedAt: {
            lt: new Date(Date.now() - STALE_AFTER_MINUTES * 60_000),
          },
        },
        orderBy: { updatedAt: "asc" },
        take: 50,
        select: {
          id: true,
          status: true,
          updatedAt: true,
          clinic: { select: { id: true, name: true } },
        },
      });
      return rows.map((r) => ({
        assessmentId: r.id,
        status: r.status,
        clinicId: r.clinic.id,
        clinicName: r.clinic.name,
        lastProgressAt: r.updatedAt.toISOString(),
        stalledForMinutes: Math.round(
          (Date.now() - r.updatedAt.getTime()) / 60_000,
        ),
      }));
    }),

    // Accounts that can authenticate but hold no membership anywhere. Each one
    // is a person who signs in and lands nowhere, and a governance question
    // nobody has answered.
    settle(async () => {
      const directory = await loadPeopleDirectory();
      if (!directory.authReadable) {
        // Cannot see the account list at all — report unavailable rather than
        // "no roleless accounts", which would be an unearned all-clear.
        throw new Error("auth directory unreadable");
      }
      return directory.people
        .filter((p) => p.accessLevel === "NONE")
        .slice(0, 50)
        .map((p) => ({
          userId: p.userId,
          email: p.email,
          createdAt: p.createdAt,
          lastSignInAt: p.lastSignInAt,
        }));
    }),
    // Clinics the national map cannot draw.
    //
    // Deliberately a housekeeping item, not a platform fault: nothing is broken
    // and no patient is affected — the map is simply incomplete, which is a
    // fact worth showing an operator and never worth colouring like an outage.
    // It is also why this does not touch platform health, which reports on the
    // assessment pipeline.
    //
    // `locationSetupState` is the same rule the clinic list badges use, so the
    // count here and the badge there can never disagree.
    settle(async () => {
      const rows = await prisma.clinic.findMany({
        where: { deletedAt: null, status: { not: "SUSPENDED" } },
        orderBy: { name: "asc" },
        take: 50,
        select: {
          id: true,
          name: true,
          locations: {
            where: { deletedAt: null },
            select: { geoStatus: true, city: true, state: true },
          },
        },
      });
      return rows
        .filter((c) => locationSetupState(c.locations) !== "COMPLETE")
        .map((c) => ({
          clinicId: c.id,
          clinicName: c.name,
          // NONE means no branch at all; INCOMPLETE means branches exist with
          // an address but no pin. The two need different work, so the item
          // says which rather than lumping them together.
          setupState: locationSetupState(c.locations),
          // Whatever geography IS on record, so the operator can see the
          // clinic is known even though it cannot be placed.
          knownPlace:
            [c.locations[0]?.city, c.locations[0]?.state].filter(Boolean).join(", ") ||
            null,
        }));
    }),
  ]);

  const groups = {
    assessmentsAwaitingReview: awaitingReview,
    kitFulfilmentAwaitingOps: fulfilmentAwaitingOps,
    paidOrdersAwaitingFulfilment: paidAwaitingFulfilment,
    unpaidCarts,
    deliveriesAwaitingAcknowledgement: awaitingAcknowledgement,
    failedDeliveries,
    stalledAssessments,
    rolelessAccounts,
    clinicsMissingLocation,
  };

  const available = Object.values(groups).filter((g) => g.available);

  return NextResponse.json({
    // The headline number. Sums only groups that could actually be read, and
    // reports how many could not, so "Needs attention — 6" is never quietly
    // built on a panel that failed to load.
    needsAttention: available.reduce((sum, g) => sum + g.count, 0),
    unavailableGroups: Object.entries(groups)
      .filter(([, g]) => !g.available)
      .map(([name]) => name),
    unpaidFollowupHours: UNPAID_FOLLOWUP_HOURS,
    groups,
  });
}

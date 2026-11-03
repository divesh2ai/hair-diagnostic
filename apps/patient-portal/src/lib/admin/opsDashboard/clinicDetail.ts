// One clinic's operational drilldown for the Super Admin console.
//
// Answers the seven questions the task names, each from the live database with
// the same honest semantics as the overview: approvals are the post-approval
// model (never COMPLETED); kit intents are authorizations, not paid orders;
// revenue and delivery are capability-gated and read "Not connected" where the
// backing migration is absent; report availability is "an approved version
// exists", with the background render queue shown separately, not as the sole
// truth.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CapabilityState } from "./types";

export interface ClinicDetail {
  clinic: {
    id: string;
    name: string;
    slug: string;
    status: string;
    branches: { branchName: string; isPrimary: boolean; status: string; city: string | null }[];
  };
  patients: { total: number };
  assessments: {
    total: number;
    byStatus: { status: string; count: number }[];
    recent: {
      id: string;
      patientName: string;
      status: string;
      reviewDecision: string;
      submittedAt: string | null;
    }[];
  };
  review: {
    approved: number;
    pendingReview: number;
    revisionRequested: number;
    rejected: number;
    recentApprovals: {
      assessmentId: string;
      patientName: string;
      approvedBy: string | null;
      approvedAt: string | null;
    }[];
  };
  kits: {
    activeIntents: number;
    cancelledIntents: number;
    recent: {
      assessmentId: string;
      patientName: string;
      doctorName: string;
      kitCount: number;
      status: string;
      createdAt: string;
    }[];
  };
  orders: {
    state: CapabilityState;
    paidOrders: number | null;
    revenueMinor: number | null;
  };
  reports: {
    // Report availability: an approved consultation version ⇒ the one-pager
    // snapshot and dossier PDF were written. This is the authoritative
    // availability signal, independent of the background render queue below.
    available: number;
    renderQueue: {
      state: CapabilityState;
      counts: { pending: number; queued: number; rendering: number; ready: number; failed: number };
    };
  };
  delivery: {
    state: CapabilityState;
    sent: number | null;
    delivered: number | null;
    failed: number | null;
    recent: {
      assessmentId: string;
      status: string;
      sentAt: string | null;
      deliveredAt: string | null;
      providerStatus: string | null;
    }[];
  };
  audit: {
    recent: {
      action: string;
      actorName: string | null;
      actorRole: string | null;
      entityType: string;
      createdAt: string;
    }[];
  };
}

export class ClinicNotFoundError extends Error {
  constructor() {
    super("Clinic not found");
    this.name = "ClinicNotFoundError";
  }
}

// groupBy results fetched as elements of a $transaction([...]) batch type
// `_count` as a union (`true | {…} | undefined`). This reads `_all` from it
// safely regardless, so the batch form stays usable without per-call casts.
function allCount(count: unknown): number {
  if (count && typeof count === "object" && "_all" in count) {
    const v = (count as { _all?: number })._all;
    return typeof v === "number" ? v : 0;
  }
  return 0;
}

function isNotProvisioned(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2010") {
    const meta = (err.meta ?? {}) as { code?: string; message?: string };
    if (["42P01", "42703", "42704", "22P02"].includes(meta.code ?? "")) return true;
    return /does not exist|invalid input value for enum/i.test(meta.message ?? err.message);
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /does not exist/i.test(msg);
}

export async function loadClinicDetail(clinicId: string): Promise<ClinicDetail> {
  const clinic = await prisma.clinic.findFirst({
    where: { id: clinicId, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      locations: {
        where: { deletedAt: null },
        orderBy: [{ isPrimary: "desc" }, { branchName: "asc" }],
        select: { branchName: true, isPrimary: true, status: true, city: true },
      },
    },
  });
  if (!clinic) throw new ClinicNotFoundError();

  const [
    patientTotal,
    assessmentTotal,
    assessmentsByStatus,
    recentAssessments,
    approved,
    pendingReview,
    revisionRequested,
    rejected,
    recentApprovals,
    kitActive,
    kitCancelled,
    recentIntents,
    reportAssetsByStatus,
  ] = await prisma.$transaction([
    prisma.patient.count({ where: { clinicId, deletedAt: null } }),
    prisma.assessment.count({ where: { clinicId, deletedAt: null } }),
    prisma.assessment.groupBy({
      by: ["status"],
      where: { clinicId, deletedAt: null },
      orderBy: { status: "asc" },
      _count: { _all: true },
    }),
    prisma.assessment.findMany({
      where: { clinicId, deletedAt: null },
      orderBy: { submittedAt: "desc" },
      take: 15,
      select: {
        id: true,
        status: true,
        reviewDecision: true,
        submittedAt: true,
        patient: { select: { name: true } },
      },
    }),
    prisma.consultation.count({ where: { clinicId, currentVersion: { approvalStatus: "APPROVED" } } }),
    prisma.consultation.count({ where: { clinicId, currentVersion: { approvalStatus: "PENDING_REVIEW" } } }),
    prisma.consultation.count({ where: { clinicId, currentVersion: { approvalStatus: "REVISION_REQUESTED" } } }),
    prisma.consultation.count({ where: { clinicId, currentVersion: { approvalStatus: "REJECTED" } } }),
    prisma.consultation.findMany({
      where: { clinicId, currentVersion: { approvalStatus: "APPROVED" } },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        assessmentId: true,
        patient: { select: { name: true } },
        currentVersion: { select: { approvedBy: true, approvedAt: true } },
      },
    }),
    prisma.kitOrderIntent.count({ where: { clinicId, status: "READY_FOR_FULFILMENT" } }),
    prisma.kitOrderIntent.count({ where: { clinicId, status: "CANCELLED" } }),
    prisma.kitOrderIntent.findMany({
      where: { clinicId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        assessmentId: true,
        kitIds: true,
        status: true,
        createdAt: true,
        doctor: { select: { name: true } },
        assessment: { select: { patient: { select: { name: true } } } },
      },
    }),
    prisma.reportAsset.groupBy({
      by: ["status"],
      where: { clinicId },
      orderBy: { status: "asc" },
      _count: { _all: true },
    }),
  ]);

  const recentAudit = await prisma.auditLog.findMany({
    where: { clinicId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      action: true,
      actorName: true,
      actorRole: true,
      entityType: true,
      createdAt: true,
    },
  });

  // Capability-gated: revenue (KitOrderPayment) and delivery (WhatsappDelivery).
  const orders = await loadClinicOrders(clinicId);
  const delivery = await loadClinicDelivery(clinicId);

  const queueCounts = { pending: 0, queued: 0, rendering: 0, ready: 0, failed: 0 };
  for (const r of reportAssetsByStatus) {
    const key = r.status.toLowerCase() as keyof typeof queueCounts;
    if (key in queueCounts) queueCounts[key] = allCount(r._count);
  }

  return {
    clinic: {
      id: clinic.id,
      name: clinic.name,
      slug: clinic.slug,
      status: clinic.status,
      branches: clinic.locations,
    },
    patients: { total: patientTotal },
    assessments: {
      total: assessmentTotal,
      byStatus: assessmentsByStatus.map((s) => ({ status: s.status, count: allCount(s._count) })),
      recent: recentAssessments.map((a) => ({
        id: a.id,
        patientName: a.patient.name,
        status: a.status,
        reviewDecision: a.reviewDecision,
        submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null,
      })),
    },
    review: {
      approved,
      pendingReview,
      revisionRequested,
      rejected,
      recentApprovals: recentApprovals.map((c) => ({
        assessmentId: c.assessmentId,
        patientName: c.patient.name,
        approvedBy: c.currentVersion?.approvedBy ?? null,
        approvedAt: c.currentVersion?.approvedAt ? c.currentVersion.approvedAt.toISOString() : null,
      })),
    },
    kits: {
      activeIntents: kitActive,
      cancelledIntents: kitCancelled,
      recent: recentIntents.map((k) => ({
        assessmentId: k.assessmentId,
        patientName: k.assessment.patient.name,
        doctorName: k.doctor.name,
        kitCount: k.kitIds.length,
        status: k.status,
        createdAt: k.createdAt.toISOString(),
      })),
    },
    orders,
    reports: {
      available: approved,
      renderQueue: {
        state: "CONNECTED",
        counts: queueCounts,
      },
    },
    delivery,
    audit: {
      recent: recentAudit.map((a) => ({
        action: a.action,
        actorName: a.actorName,
        actorRole: a.actorRole,
        entityType: a.entityType,
        createdAt: a.createdAt.toISOString(),
      })),
    },
  };
}

async function loadClinicOrders(clinicId: string): Promise<ClinicDetail["orders"]> {
  try {
    const rows = await prisma.$queryRaw<{ paid: bigint | number; revenue: bigint | number }[]>(Prisma.sql`
      SELECT COUNT(*) FILTER (WHERE "status" = 'PAID'::"KitOrderPaymentStatus") AS "paid",
             COALESCE(SUM("amountMinor") FILTER (WHERE "status" = 'PAID'::"KitOrderPaymentStatus"), 0) AS "revenue"
        FROM "KitOrderPayment"
       WHERE "clinicId" = ${clinicId}
    `);
    const r = rows[0];
    return {
      state: "CONNECTED",
      paidOrders: Number(r?.paid ?? 0),
      revenueMinor: Number(r?.revenue ?? 0),
    };
  } catch (err) {
    if (!isNotProvisioned(err)) {
      console.warn("[ops-dashboard] clinic orders read failed:", err instanceof Error ? err.message : String(err));
    }
    return { state: "NOT_CONNECTED", paidOrders: null, revenueMinor: null };
  }
}

async function loadClinicDelivery(clinicId: string): Promise<ClinicDetail["delivery"]> {
  try {
    const summary = await prisma.$queryRaw<{ sent: bigint | number; delivered: bigint | number; failed: bigint | number }[]>(Prisma.sql`
      SELECT COUNT(*) FILTER (WHERE "subject" = 'REPORT' AND "status" IN ('SENT'::"DeliveryStatus", 'DELIVERED'::"DeliveryStatus")) AS "sent",
             COUNT(*) FILTER (WHERE "subject" = 'REPORT' AND "status" = 'DELIVERED'::"DeliveryStatus") AS "delivered",
             COUNT(*) FILTER (WHERE "subject" = 'REPORT' AND "status" = 'FAILED'::"DeliveryStatus") AS "failed"
        FROM "WhatsappDelivery"
       WHERE "clinicId" = ${clinicId}
    `);
    const recent = await prisma.$queryRaw<
      { assessmentId: string; status: string; sentAt: Date | null; deliveredAt: Date | null; providerStatus: string | null }[]
    >(Prisma.sql`
      SELECT "assessmentId", "status"::text AS "status", "sentAt", "deliveredAt", "providerStatus"
        FROM "WhatsappDelivery"
       WHERE "clinicId" = ${clinicId} AND "subject" = 'REPORT'
       ORDER BY "createdAt" DESC
       LIMIT 10
    `);
    const s = summary[0];
    return {
      state: "CONNECTED",
      sent: Number(s?.sent ?? 0),
      delivered: Number(s?.delivered ?? 0),
      failed: Number(s?.failed ?? 0),
      recent: recent.map((r) => ({
        assessmentId: r.assessmentId,
        status: r.status,
        sentAt: r.sentAt ? r.sentAt.toISOString() : null,
        deliveredAt: r.deliveredAt ? r.deliveredAt.toISOString() : null,
        providerStatus: r.providerStatus,
      })),
    };
  } catch (err) {
    if (!isNotProvisioned(err)) {
      console.warn("[ops-dashboard] clinic delivery read failed:", err instanceof Error ? err.message : String(err));
    }
    return { state: "NOT_CONNECTED", sent: null, delivered: null, failed: null, recent: [] };
  }
}

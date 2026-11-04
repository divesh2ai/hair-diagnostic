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
import { resolveDoctorSignIn } from "./identity";
import type { CapabilityState } from "./types";
import {
  classifyReportReadiness,
  type ReportReadiness,
  type SnapshotState,
  type RetrievalState,
} from "./classify";
import { probeOnePagerSnapshots, type SnapshotProbe } from "./snapshots";

/** One approved assessment's report, with every availability facet separate. */
export interface ReportMatrixRow {
  assessmentId: string;
  patientName: string;
  contentVersion: number;
  approvedAt: string | null;
  /** Clinically approved — always true for a matrix row (the matrix is the approved set). */
  approved: boolean;
  /** One-pager snapshot object presence. UNKNOWN when storage is unreadable. */
  onePagerSnapshot: SnapshotState;
  /** ReportAsset PATIENT_REPORT_PDF is READY for this version. */
  dossierReady: boolean;
  /** Byte-retrieval result for the snapshot, where testable. */
  retrieval: RetrievalState;
  /** Optional background one-pager render queue status for this version. */
  reportAssetStatus: string | null;
  /** The honest readiness verdict derived from the facets above. */
  readiness: ReportReadiness;
}

export interface ClinicDetail {
  clinic: {
    id: string;
    name: string;
    slug: string;
    status: string;
    branches: { branchName: string; isPrimary: boolean; status: string; city: string | null }[];
  };
  patients: { total: number };
  /**
   * Per-doctor access, login and clinical activity for this clinic — the
   * drilldown answer to "which doctors have working access and who actually
   * reviews patients". Access is one of: a linked Supabase identity, onboarding
   * still pending, or unknown. Login is resolved across BOTH identity mappings
   * (e-mail/Google + phone). When auth.users could not be read, sign-in shows
   * Unknown (authReadable=false), never a fabricated "never".
   */
  doctors: {
    authReadable: boolean;
    list: {
      doctorId: string;
      name: string;
      access: "LINKED" | "ONBOARDING_PENDING" | "UNKNOWN";
      hasAccount: boolean;
      lastSignInAt: string | null;
      lastActivityAt: string | null;
    }[];
  };
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
    /**
     * Distinct cases a doctor actually reviewed = approved + revisionRequested +
     * rejected. PENDING is excluded (not a completed review). The honest
     * "doctor reviewed patients" figure.
     */
    reviewed: number;
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
    /**
     * Report accounting with the four facets kept SEPARATE, because asset
     * existence must never be inferred from a clinical approval:
     *   • approved          — approved consultation versions (the sign-off).
     *   • dossiersReady      — ReportAsset PATIENT_REPORT_PDF rows that are READY.
     *   • snapshotsPresent   — one-pager snapshot objects found in storage; null
     *                          when storage could not be read (NOT_CONNECTED).
     *   • retrievalVerified  — snapshots whose bytes actually downloaded; null
     *                          when storage could not be read.
     * The per-assessment `matrix` is the evidence behind these totals and is
     * what the overview's figures reconcile against.
     */
    approved: number;
    dossiersReady: number;
    snapshotsPresent: number | null;
    retrievalVerified: number | null;
    /** How the one-pager snapshot store responded for this clinic's set. */
    storageState: CapabilityState;
    matrix: ReportMatrixRow[];
    renderQueue: {
      state: CapabilityState;
      counts: { pending: number; queued: number; rendering: number; ready: number; failed: number };
    };
  };
  /**
   * Pipeline attention — COMPLETED assessments that have no consultation.
   * Separated from the doctor queue so it is never read as doctor inaction.
   */
  pipeline: {
    completedAssessments: number;
    assessmentsWithoutConsultation: number;
    missing: {
      assessmentId: string;
      patientName: string;
      status: string;
      submittedAt: string | null;
    }[];
  };
  /** Approved-version / Assessment.reviewDecision conflicts, reported verbatim. */
  reconciliation: {
    discrepancies: number;
    cases: {
      assessmentId: string;
      patientName: string;
      approvalStatus: string;
      reviewDecision: string;
    }[];
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

  const doctors = await loadClinicDoctors(clinicId);

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
    completedCount,
    missingConsultationCount,
    missingConsultationRows,
    reconciliationRows,
    approvedForMatrix,
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
    // Total COMPLETED assessments (the AI pipeline finished) — its own figure,
    // never conflated with approval.
    prisma.assessment.count({
      where: { clinicId, deletedAt: null, status: "COMPLETED" },
    }),
    // Pipeline attention: COMPLETED assessments with no consultation. Counted in
    // full, then a bounded sample listed as evidence.
    prisma.assessment.count({
      where: { clinicId, deletedAt: null, status: "COMPLETED", consultations: { none: {} } },
    }),
    prisma.assessment.findMany({
      where: { clinicId, deletedAt: null, status: "COMPLETED", consultations: { none: {} } },
      orderBy: { submittedAt: "desc" },
      take: 15,
      select: {
        id: true,
        status: true,
        submittedAt: true,
        patient: { select: { name: true } },
      },
    }),
    // Reconciliation discrepancies: APPROVED current version, reviewDecision not
    // APPROVED. Listed verbatim so an operator can see exactly which case.
    // No `take`: reconciliation conflicts are rare (a data-integrity signal) and
    // the drilldown figure must match the overview's exactly.
    prisma.consultation.findMany({
      where: {
        clinicId,
        currentVersion: { approvalStatus: "APPROVED" },
        assessment: { reviewDecision: { not: "APPROVED" }, deletedAt: null },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        assessmentId: true,
        patient: { select: { name: true } },
        currentVersion: { select: { approvalStatus: true } },
        assessment: { select: { reviewDecision: true } },
      },
    }),
    // The full approved set, for the per-assessment report matrix. Each carries
    // its approved version id + number so storage and dossier can be probed per
    // version rather than inferred.
    prisma.consultation.findMany({
      where: { clinicId, currentVersion: { approvalStatus: "APPROVED" } },
      orderBy: { updatedAt: "desc" },
      select: {
        assessmentId: true,
        patient: { select: { name: true } },
        currentVersion: { select: { id: true, contentVersion: true, approvedAt: true } },
      },
    }),
  ]);

  // ReportAsset rows for the approved versions — the CONFIRMED asset facts
  // (dossier READY, and the optional background one-pager render status). Never
  // inferred from the approval.
  const approvedVersionIds = approvedForMatrix
    .map((c) => c.currentVersion?.id)
    .filter((v): v is string => Boolean(v));
  const reportAssetsForVersions =
    approvedVersionIds.length > 0
      ? await prisma.reportAsset.findMany({
          where: { consultationVersionId: { in: approvedVersionIds } },
          select: { consultationVersionId: true, type: true, status: true },
        })
      : [];
  const dossierReadyByVersion = new Map<string, boolean>();
  const onePagerStatusByVersion = new Map<string, string>();
  for (const a of reportAssetsForVersions) {
    if (a.type === "PATIENT_REPORT_PDF" && a.status === "READY") {
      dossierReadyByVersion.set(a.consultationVersionId, true);
    }
    if (a.type === "ONE_PAGER_PNG" || a.type === "ONE_PAGER_PDF") {
      // Keep the most "advanced" status if several exist; READY wins.
      const prev = onePagerStatusByVersion.get(a.consultationVersionId);
      if (!prev || a.status === "READY") onePagerStatusByVersion.set(a.consultationVersionId, a.status);
    }
  }

  // Probe the one-pager snapshot store for the approved set — existence AND
  // byte retrieval, where storage is reachable. Capability-gated, never fatal.
  const probes: SnapshotProbe[] = approvedForMatrix
    .filter((c) => c.currentVersion)
    .map((c) => ({
      assessmentId: c.assessmentId,
      contentVersion: c.currentVersion!.contentVersion,
    }));
  const snapshots = await probeOnePagerSnapshots(probes);

  const matrix: ReportMatrixRow[] = approvedForMatrix.map((c) => {
    const versionId = c.currentVersion?.id ?? null;
    const contentVersion = c.currentVersion?.contentVersion ?? 0;
    const snap = snapshots.byAssessment.get(c.assessmentId);
    const onePagerSnapshot: SnapshotState =
      snapshots.state === "NOT_CONNECTED" ? "UNKNOWN" : snap?.exists ?? "UNKNOWN";
    const retrieval: RetrievalState =
      snapshots.state === "NOT_CONNECTED" ? "NOT_TESTED" : snap?.retrieval ?? "NOT_TESTED";
    const dossierReady = versionId ? dossierReadyByVersion.get(versionId) ?? false : false;
    const reportAssetStatus = versionId ? onePagerStatusByVersion.get(versionId) ?? null : null;
    return {
      assessmentId: c.assessmentId,
      patientName: c.patient.name,
      contentVersion,
      approvedAt: c.currentVersion?.approvedAt ? c.currentVersion.approvedAt.toISOString() : null,
      approved: true,
      onePagerSnapshot,
      dossierReady,
      retrieval,
      reportAssetStatus,
      readiness: classifyReportReadiness({
        approved: true,
        onePagerSnapshot,
        dossierReady,
        retrieval,
      }),
    };
  });

  const dossiersReady = matrix.filter((r) => r.dossierReady).length;
  const snapshotsPresent =
    snapshots.state === "NOT_CONNECTED"
      ? null
      : matrix.filter((r) => r.onePagerSnapshot === "PRESENT").length;
  const retrievalVerified =
    snapshots.state === "NOT_CONNECTED"
      ? null
      : matrix.filter((r) => r.retrieval === "VERIFIED").length;

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
    doctors,
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
      reviewed: approved + revisionRequested + rejected,
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
      approved,
      dossiersReady,
      snapshotsPresent,
      retrievalVerified,
      storageState: snapshots.state,
      matrix,
      renderQueue: {
        state: "CONNECTED",
        counts: queueCounts,
      },
    },
    pipeline: {
      completedAssessments: completedCount,
      assessmentsWithoutConsultation: missingConsultationCount,
      missing: missingConsultationRows.map((a) => ({
        assessmentId: a.id,
        patientName: a.patient.name,
        status: a.status,
        submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null,
      })),
    },
    reconciliation: {
      discrepancies: reconciliationRows.length,
      cases: reconciliationRows.map((c) => ({
        assessmentId: c.assessmentId,
        patientName: c.patient.name,
        approvalStatus: c.currentVersion?.approvalStatus ?? "APPROVED",
        reviewDecision: c.assessment.reviewDecision,
      })),
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

interface ClinicAuthUserRow {
  id: string;
  last_sign_in_at: Date | null;
}

/**
 * Per-doctor access, login and clinical activity for one clinic.
 *
 * Login is resolved across BOTH Supabase identity mappings (e-mail/Google +
 * phone), exactly as the roster does, so a doctor who signs in by phone is
 * never mis-reported as "never signed in". When auth.users cannot be read the
 * whole section reports Unknown (authReadable=false) rather than a fabricated
 * "never". Per-doctor clinical activity is the most recent AUDITED action by
 * that doctor's auth identity — system/background/Super Admin actions carry a
 * different actorId and are excluded.
 */
async function loadClinicDoctors(clinicId: string): Promise<ClinicDetail["doctors"]> {
  const docs = await prisma.doctor.findMany({
    where: { clinicId, deletedAt: null },
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      supabaseUserId: true,
      supabasePhoneUserId: true,
      provisioningStatus: true,
    },
  });

  const authIds = Array.from(
    new Set(
      docs
        .flatMap((d) => [d.supabaseUserId, d.supabasePhoneUserId])
        .filter((v): v is string => v !== null),
    ),
  );

  let lastSignIn = new Map<string, Date | null>();
  let authReadable = true;
  if (authIds.length > 0) {
    try {
      const rows = await prisma.$queryRaw<ClinicAuthUserRow[]>`
        SELECT id::text AS id, last_sign_in_at
        FROM auth.users
        WHERE id::text = ANY(${authIds}::text[])
      `;
      lastSignIn = new Map(rows.map((r) => [r.id, r.last_sign_in_at]));
    } catch {
      authReadable = false;
    }
  }

  // Most recent audited action per auth identity (actorId). Doctor actions carry
  // the doctor's auth uid; system/Super Admin actions do not, so this is a
  // clean per-doctor clinical-activity clock.
  const activityByActor = new Map<string, Date>();
  if (authIds.length > 0) {
    const rows = await prisma.auditLog.groupBy({
      by: ["actorId"],
      where: { actorId: { in: authIds }, actorType: "doctor" },
      _max: { createdAt: true },
    });
    for (const r of rows) {
      if (r.actorId && r._max.createdAt) activityByActor.set(r.actorId, r._max.createdAt);
    }
  }

  const list = docs.map((d) => {
    const { lastSignInAt, hasAccount } = resolveDoctorSignIn(
      { emailUserId: d.supabaseUserId, phoneUserId: d.supabasePhoneUserId },
      lastSignIn,
    );
    // Access: a linked identity if an auth account exists; else onboarding
    // pending while provisioning is in progress; else unknown.
    const access: "LINKED" | "ONBOARDING_PENDING" | "UNKNOWN" = hasAccount
      ? "LINKED"
      : d.provisioningStatus === "ACTIVE"
        ? "UNKNOWN"
        : "ONBOARDING_PENDING";
    let lastActivity: Date | null = null;
    for (const id of [d.supabaseUserId, d.supabasePhoneUserId]) {
      if (!id) continue;
      const at = activityByActor.get(id);
      if (at && (!lastActivity || at.getTime() > lastActivity.getTime())) lastActivity = at;
    }
    return {
      doctorId: d.id,
      name: d.name,
      access,
      hasAccount,
      lastSignInAt: lastSignInAt ? lastSignInAt.toISOString() : null,
      lastActivityAt: lastActivity ? lastActivity.toISOString() : null,
    };
  });

  return { authReadable, list };
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

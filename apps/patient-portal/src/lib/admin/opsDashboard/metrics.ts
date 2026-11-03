// The Super Admin operations overview: KPI strip + per-clinic operational row.
//
// This module is the single place the dashboard's numbers are defined, and the
// definitions are deliberate — each one is a decision the task spelled out:
//
//   • "Operationally using" is NOT ClinicStatus.ACTIVE. Activation is a
//     database flag an operator set; using it is real throughput (a signed-in
//     doctor + assessments + an approval + recent activity). The two are
//     different columns and different questions.
//   • A doctor APPROVAL is ConsultationVersion.approvalStatus = APPROVED (the
//     authoritative post-approval model), never AssessmentStatus.COMPLETED.
//     COMPLETED means the AI pipeline finished; a human may not have looked.
//   • A KitOrderIntent is the doctor's authorization, NOT a placed/paid order.
//     Confirmed orders and revenue come only from KitOrderPayment (status PAID)
//     via the capability layer, and are "Not connected" where that is absent.
//   • Report AVAILABILITY is "an approved consultation version exists" (which
//     is what causes the one-pager snapshot and dossier PDF to be written), not
//     the background ReportAsset render queue, which is a separate pipeline.
//   • Last-sign-in comes from auth.users; when it cannot be read the answer is
//     UNKNOWN, surfaced via capabilities.authReadable, never rendered "never".
//
// SUPER_ADMIN reads every clinic (no clinicScope); the route gates with
// assertSuperAdmin() exactly like every other /api/admin route.

import { prisma } from "@/lib/prisma";
import { loadClinicianRoster } from "@/lib/admin/clinicianRoster";
import { loadPaymentsByClinic, loadDeliveriesByClinic } from "./capabilities";
import { classifyClinic, toGatedKpi } from "./classify";
import type {
  ClinicOpsRow,
  DashboardCapabilities,
  DashboardKpis,
  GatedKpi,
  OpsOverview,
  TimeWindow,
} from "./types";

type CountByClinic = Map<string, number>;

function countMap(
  rows: Array<{ clinicId: string | null; _count: { _all: number } }>,
): CountByClinic {
  const m: CountByClinic = new Map();
  for (const r of rows) {
    if (r.clinicId) m.set(r.clinicId, r._count._all);
  }
  return m;
}

function latest(a: Date | null | undefined, b: Date | null | undefined): Date | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a.getTime() >= b.getTime() ? a : b;
}

export async function loadOpsOverview(window: TimeWindow): Promise<OpsOverview> {
  const from = new Date(window.fromIso);
  const to = new Date(window.toIso);
  const now = new Date();

  // Core aggregates — one interactive transaction so every read shares a
  // single pooled connection (deployed Prisma runs pgbouncer with
  // connection_limit=1; a Promise.all would starve it). Sequential awaits on
  // the transaction client also give Prisma's narrowed groupBy result types.
  const {
    clinics,
    patientsByClinic,
    assessmentsAll,
    assessmentsWindow,
    assessmentsLastActivity,
    completedAll,
    missingConsultationAll,
    reconciliationAll,
    approvedAll,
    approvedWindow,
    awaitingAll,
    dossiersReadyAll,
    kitActiveAll,
    kitCancelledAll,
    auditLastActivity,
  } = await prisma.$transaction(async (tx) => {
    const clinics = await tx.clinic.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        locations: {
          where: { deletedAt: null },
          orderBy: [{ isPrimary: "desc" }, { branchName: "asc" }],
          select: { branchName: true, isPrimary: true, status: true },
        },
      },
    });
    const patientsByClinic = await tx.patient.groupBy({
      by: ["clinicId"],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    const assessmentsAll = await tx.assessment.groupBy({
      by: ["clinicId"],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    const assessmentsWindow = await tx.assessment.groupBy({
      by: ["clinicId"],
      where: { deletedAt: null, submittedAt: { gte: from, lt: to } },
      _count: { _all: true },
    });
    const assessmentsLastActivity = await tx.assessment.groupBy({
      by: ["clinicId"],
      where: { deletedAt: null },
      _max: { submittedAt: true },
    });
    // COMPLETED = the AI pipeline finished. Counted and shown as its own
    // figure, never conflated with an approval.
    const completedAll = await tx.assessment.groupBy({
      by: ["clinicId"],
      where: { deletedAt: null, status: "COMPLETED" },
      _count: { _all: true },
    });
    // Pipeline attention, NOT doctor inaction: a COMPLETED assessment that has
    // no consultation at all. The doctor cannot review what was never created.
    const missingConsultationAll = await tx.assessment.groupBy({
      by: ["clinicId"],
      where: { deletedAt: null, status: "COMPLETED", consultations: { none: {} } },
      _count: { _all: true },
    });
    // Reconciliation discrepancy: an APPROVED consultation version whose
    // Assessment.reviewDecision disagrees. A data-integrity signal — reported,
    // never auto-reconciled.
    const reconciliationAll = await tx.consultation.groupBy({
      by: ["clinicId"],
      where: {
        currentVersion: { approvalStatus: "APPROVED" },
        assessment: { reviewDecision: { not: "APPROVED" }, deletedAt: null },
      },
      _count: { _all: true },
    });
    // APPROVAL = the authoritative post-approval model, never COMPLETED.
    const approvedAll = await tx.consultation.groupBy({
      by: ["clinicId"],
      where: { currentVersion: { approvalStatus: "APPROVED" } },
      _count: { _all: true },
    });
    const approvedWindow = await tx.consultation.groupBy({
      by: ["clinicId"],
      where: {
        currentVersion: { approvalStatus: "APPROVED", approvedAt: { gte: from, lt: to } },
      },
      _count: { _all: true },
    });
    const awaitingAll = await tx.consultation.groupBy({
      by: ["clinicId"],
      where: { currentVersion: { approvalStatus: "PENDING_REVIEW" } },
      _count: { _all: true },
    });
    // Report AVAILABILITY of an asset is a MEASURED fact, not an inference from
    // approval: a dossier is "ready" only when its ReportAsset row is READY.
    const dossiersReadyAll = await tx.reportAsset.groupBy({
      by: ["clinicId"],
      where: { type: "PATIENT_REPORT_PDF", status: "READY" },
      _count: { _all: true },
    });
    // Kit INTENTS — a doctor authorization. Active = READY_FOR_FULFILMENT.
    const kitActiveAll = await tx.kitOrderIntent.groupBy({
      by: ["clinicId"],
      where: { status: "READY_FOR_FULFILMENT" },
      _count: { _all: true },
    });
    const kitCancelledAll = await tx.kitOrderIntent.groupBy({
      by: ["clinicId"],
      where: { status: "CANCELLED" },
      _count: { _all: true },
    });
    const auditLastActivity = await tx.auditLog.groupBy({
      by: ["clinicId"],
      where: { clinicId: { not: null } },
      _max: { createdAt: true },
    });
    return {
      clinics,
      patientsByClinic,
      assessmentsAll,
      assessmentsWindow,
      assessmentsLastActivity,
      completedAll,
      missingConsultationAll,
      reconciliationAll,
      approvedAll,
      approvedWindow,
      awaitingAll,
      dossiersReadyAll,
      kitActiveAll,
      kitCancelledAll,
      auditLastActivity,
    };
  });

  // Doctors + authoritative last-sign-in (auth.users). Separate call: the
  // roster does its own auth.users raw read and reports authReadable.
  const roster = await loadClinicianRoster();

  // Capability-gated, isolated, never fatal.
  const [payments, deliveries] = await Promise.all([
    loadPaymentsByClinic(window),
    loadDeliveriesByClinic(window),
  ]);

  const patientCount = countMap(patientsByClinic);
  const assessAll = countMap(assessmentsAll);
  const assessWin = countMap(assessmentsWindow);
  const completed = countMap(completedAll);
  const missingConsultation = countMap(missingConsultationAll);
  const reconciliation = countMap(reconciliationAll);
  const apprAll = countMap(approvedAll);
  const apprWin = countMap(approvedWindow);
  const awaiting = countMap(awaitingAll);
  const dossiersReady = countMap(dossiersReadyAll);
  const kitActive = countMap(kitActiveAll);
  const kitCancelled = countMap(kitCancelledAll);

  const assessActivity = new Map<string, Date | null>();
  for (const r of assessmentsLastActivity) {
    if (r.clinicId) assessActivity.set(r.clinicId, r._max.submittedAt ?? null);
  }
  const auditActivity = new Map<string, Date | null>();
  for (const r of auditLastActivity) {
    if (r.clinicId) auditActivity.set(r.clinicId, r._max.createdAt ?? null);
  }

  // Doctors grouped by clinic.
  interface DoctorAgg {
    count: number;
    signedIn: number;
    topDoctorId: string | null;
    topDoctorName: string | null;
    lastSignInAt: Date | null;
    topHasAccount: boolean;
  }
  const doctorsByClinic = new Map<string, DoctorAgg>();
  for (const c of roster.clinicians) {
    const agg =
      doctorsByClinic.get(c.clinicId) ??
      ({
        count: 0,
        signedIn: 0,
        topDoctorId: null,
        topDoctorName: null,
        lastSignInAt: null,
        topHasAccount: false,
      } satisfies DoctorAgg);
    agg.count += 1;
    const signIn = c.lastSignInAt ? new Date(c.lastSignInAt) : null;
    if (signIn) agg.signedIn += 1;
    // "Top doctor" for the last-login column = most recent sign-in; fall back
    // to the first-listed doctor so the column is never empty for a staffed
    // clinic.
    if (signIn && (!agg.lastSignInAt || signIn.getTime() > agg.lastSignInAt.getTime())) {
      agg.lastSignInAt = signIn;
      agg.topDoctorId = c.doctorId;
      agg.topDoctorName = c.name;
      agg.topHasAccount = Boolean(c.authUserId);
    } else if (!agg.topDoctorId) {
      agg.topDoctorId = c.doctorId;
      agg.topDoctorName = c.name;
      agg.topHasAccount = Boolean(c.authUserId);
    }
    doctorsByClinic.set(c.clinicId, agg);
  }

  const deliveryConnected = deliveries.state === "CONNECTED";

  const rows: ClinicOpsRow[] = clinics.map((c) => {
    const docs = doctorsByClinic.get(c.id);
    const doctorCount = docs?.count ?? 0;
    const signedIn = docs?.signedIn ?? 0;
    const pay = payments.byClinic.get(c.id);
    const del = deliveries.byClinic.get(c.id);

    const assessmentsAllN = assessAll.get(c.id) ?? 0;
    const completedN = completed.get(c.id) ?? 0;
    const missingConsultationN = missingConsultation.get(c.id) ?? 0;
    const reconciliationN = reconciliation.get(c.id) ?? 0;
    const approvalsAllN = apprAll.get(c.id) ?? 0;
    const awaitingN = awaiting.get(c.id) ?? 0;
    // A CONFIRMED asset count (ReportAsset READY), never inferred from approval.
    const dossiersReadyN = dossiersReady.get(c.id) ?? 0;

    const lastActivityAt = latest(
      assessActivity.get(c.id) ?? null,
      auditActivity.get(c.id) ?? null,
    );

    const { flags, primaryStatus } = classifyClinic({
      status: c.status,
      doctorCount,
      signedInCount: signedIn,
      authReadable: roster.authReadable,
      assessmentsAllTime: assessmentsAllN,
      approvalsAllTime: approvalsAllN,
      awaitingReview: awaitingN,
      assessmentsWithoutConsultation: missingConsultationN,
      reconciliationDiscrepancies: reconciliationN,
      deliveryConnected,
      reportsFailed: del?.reportsFailed ?? 0,
      reportsSent: del?.reportsSent ?? 0,
      dossiersReady: dossiersReadyN,
      lastActivityAt,
      now,
    });

    const confirmedOrders = toGatedKpi(
      payments.state,
      pay?.paidOrdersInWindow ?? 0,
      pay?.paidOrders ?? 0,
    );
    const reportsSent = toGatedKpi(
      deliveries.state,
      del?.reportsSentInWindow ?? 0,
      del?.reportsSent ?? 0,
    );
    const reportsDelivered = toGatedKpi(
      deliveries.state,
      del?.reportsDeliveredInWindow ?? 0,
      del?.reportsDelivered ?? 0,
    );

    const primaryBranch =
      c.locations.find((l) => l.isPrimary)?.branchName ??
      c.locations[0]?.branchName ??
      null;

    return {
      clinicId: c.id,
      name: c.name,
      slug: c.slug,
      status: c.status,
      primaryBranch,
      branchCount: c.locations.length,
      doctorCount,
      patientCount: patientCount.get(c.id) ?? 0,
      topDoctor: docs?.topDoctorId
        ? {
            doctorId: docs.topDoctorId,
            name: docs.topDoctorName ?? "—",
            lastSignInAt: docs.lastSignInAt ? docs.lastSignInAt.toISOString() : null,
            hasAccount: docs.topHasAccount,
          }
        : null,
      lastSignInAt: docs?.lastSignInAt ? docs.lastSignInAt.toISOString() : null,
      assessments: { today: assessWin.get(c.id) ?? 0, allTime: assessmentsAllN },
      approvals: { today: apprWin.get(c.id) ?? 0, allTime: approvalsAllN },
      completedAssessments: completedN,
      awaitingReview: awaitingN,
      assessmentsWithoutConsultation: missingConsultationN,
      reconciliationDiscrepancies: reconciliationN,
      kitIntents: kitActive.get(c.id) ?? 0,
      kitIntentsCancelled: kitCancelled.get(c.id) ?? 0,
      confirmedOrders,
      reports: { approved: approvalsAllN, dossiersReady: dossiersReadyN },
      reportsSent,
      reportsDelivered,
      lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
      primaryStatus,
      flags,
    };
  });

  // KPI strip — sums of the rows, so the strip always reconciles with the table.
  const sum = (pick: (r: ClinicOpsRow) => number) => rows.reduce((a, r) => a + pick(r), 0);

  const assessmentsKpi = { today: sum((r) => r.assessments.today), allTime: sum((r) => r.assessments.allTime) };
  const approvalsKpi = { today: sum((r) => r.approvals.today), allTime: sum((r) => r.approvals.allTime) };

  const reportsSentKpi: GatedKpi = deliveryConnected
    ? {
        state: "CONNECTED",
        today: sum((r) => r.reportsSent.today ?? 0),
        allTime: sum((r) => r.reportsSent.allTime ?? 0),
      }
    : { state: "NOT_CONNECTED", today: null, allTime: null };
  const reportsDeliveredKpi: GatedKpi = deliveryConnected
    ? {
        state: "CONNECTED",
        today: sum((r) => r.reportsDelivered.today ?? 0),
        allTime: sum((r) => r.reportsDelivered.allTime ?? 0),
      }
    : { state: "NOT_CONNECTED", today: null, allTime: null };

  const kpis: DashboardKpis = {
    clinicsRegistered: rows.length,
    clinicsOperational: rows.filter((r) => r.flags.activelyUsing).length,
    doctorsTotal: roster.clinicians.length,
    doctorsSignedIn: roster.clinicians.filter((c) => c.lastSignInAt !== null).length,
    assessments: assessmentsKpi,
    approvals: approvalsKpi,
    completedAssessments: sum((r) => r.completedAssessments),
    pendingReviews: sum((r) => r.awaitingReview),
    assessmentsWithoutConsultation: sum((r) => r.assessmentsWithoutConsultation),
    reconciliationDiscrepancies: sum((r) => r.reconciliationDiscrepancies),
    dossiersReady: sum((r) => r.reports.dossiersReady),
    reportsSent: reportsSentKpi,
    reportsDelivered: reportsDeliveredKpi,
  };

  const capabilities: DashboardCapabilities = {
    payments: payments.state,
    delivery: deliveries.state,
    authReadable: roster.authReadable,
  };

  return {
    window,
    capabilities,
    kpis,
    clinics: rows,
    generatedAt: new Date().toISOString(),
  };
}

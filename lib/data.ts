import "server-only";
import snapshot from "./data/production-snapshot.json";
import { createAdminClient } from "./supabase";
import {
  computeTotals,
  deriveClinic,
  type MonitorData,
  type RawAssessment,
  type RawClinic,
} from "./metrics";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/—/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Read-only verification snapshot (exact production extract). */
export function loadSnapshot(): MonitorData {
  const clinics = (snapshot.clinics as RawClinic[]).map(deriveClinic);
  return {
    meta: {
      source: snapshot.meta.source,
      extractedAt: snapshot.meta.extractedAt,
      live: false,
      targets: snapshot.meta.targets,
    },
    clinics,
    assessments: snapshot.assessments as RawAssessment[],
    totals: computeTotals(clinics),
  };
}

/**
 * Live production path: aggregate the same tables the snapshot was captured
 * from, resolving sign-ins from auth.users server-side. Falls back to the
 * snapshot on any error so the operational dashboard degrades gracefully.
 */
export async function loadLive(): Promise<MonitorData> {
  const admin = createAdminClient();
  if (!admin) return loadSnapshot();

  const notDeleted = (q: any) => q.is("deletedAt", null);

  const [clinicsR, doctorsR, assessmentsR, kitsR, reportsR, waR, patientsR, consultsR, versionsR] =
    await Promise.all([
      notDeleted(admin.from("Clinic").select("id,name,slug,status")),
      notDeleted(admin.from("Doctor").select('id,clinicId,name,provisioningStatus,supabaseUserId,supabasePhoneUserId')),
      notDeleted(admin.from("Assessment").select('id,clinicId,patientId,submittedAt,reviewDecision,reviewedAt,status')),
      admin.from("KitOrderIntent").select('clinicId,assessmentId,status'),
      admin.from("ReportAsset").select('clinicId,assessmentId,status'),
      admin.from("WhatsappDelivery").select('clinicId,assessmentId,status'),
      notDeleted(admin.from("Patient").select("id,name,age,gender")),
      admin.from("Consultation").select('assessmentId,currentVersionId'),
      admin.from("ConsultationVersion").select('id,approvalStatus'),
    ]);

  for (const r of [clinicsR, doctorsR, assessmentsR, kitsR, reportsR, waR, patientsR, consultsR, versionsR]) {
    if (r.error) throw r.error;
  }

  // Resolve sign-ins + providers from auth.users (paginated).
  const authById = new Map<string, { lastSignInAt: string | null; provider: string | null; identifier: string | null }>();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) {
      authById.set(u.id, {
        lastSignInAt: u.last_sign_in_at ?? null,
        provider: (u.app_metadata?.provider as string) ?? null,
        identifier: u.phone ? `+${u.phone}` : u.email ?? null,
      });
    }
    if (data.users.length < 1000) break;
  }

  const doctorByClinic = new Map<string, any>();
  for (const d of doctorsR.data as any[]) {
    if (!doctorByClinic.has(d.clinicId)) doctorByClinic.set(d.clinicId, d);
  }
  const patientById = new Map<string, any>((patientsR.data as any[]).map((p) => [p.id, p]));
  const versionById = new Map<string, any>((versionsR.data as any[]).map((v) => [v.id, v]));
  const consultByAssessment = new Map<string, any>((consultsR.data as any[]).map((c) => [c.assessmentId, c]));

  const byClinic = (rows: any[], pred: (r: any) => boolean) => {
    const m = new Map<string, number>();
    for (const r of rows) if (pred(r)) m.set(r.clinicId, (m.get(r.clinicId) ?? 0) + 1);
    return m;
  };

  const kitByClinic = byClinic(kitsR.data as any[], (r) => r.status === "READY_FOR_FULFILMENT");
  const readyByClinic = byClinic(reportsR.data as any[], (r) => r.status === "READY");
  const queuedByClinic = byClinic(reportsR.data as any[], (r) => r.status === "QUEUED");
  const failedByClinic = byClinic(reportsR.data as any[], (r) => r.status === "FAILED");
  const waByClinic = byClinic(waR.data as any[], (r) => r.status === "SENT");

  const clinics: RawClinic[] = (clinicsR.data as any[]).map((c) => {
    const d = doctorByClinic.get(c.id);
    const auth = d ? authById.get(d.supabaseUserId) ?? authById.get(d.supabasePhoneUserId) : undefined;
    const clinicAssessments = (assessmentsR.data as any[]).filter((a) => a.clinicId === c.id);
    const lastReview = clinicAssessments
      .map((a) => a.reviewedAt)
      .filter(Boolean)
      .sort()
      .pop();
    return {
      slug: c.slug || slugify(c.name),
      name: c.name,
      clinicStatus: c.status,
      doctorName: d?.name ?? null,
      provisioning: d?.provisioningStatus ?? null,
      provider: auth?.provider ?? null,
      authIdentifier: auth?.identifier ?? null,
      signedIn: Boolean(auth?.lastSignInAt),
      lastSignInAt: auth?.lastSignInAt ?? null,
      submitted: clinicAssessments.filter((a) => a.submittedAt).length,
      approved: clinicAssessments.filter((a) => a.reviewDecision === "APPROVED").length,
      pending: clinicAssessments.filter((a) => a.reviewDecision === "PENDING").length,
      lastReviewAt: lastReview ? String(lastReview).slice(0, 10) : null,
      kitIntents: kitByClinic.get(c.id) ?? 0,
      reportReady: readyByClinic.get(c.id) ?? 0,
      reportQueued: queuedByClinic.get(c.id) ?? 0,
      reportFailed: failedByClinic.get(c.id) ?? 0,
      waSent: waByClinic.get(c.id) ?? 0,
    };
  });

  const clinicSlugById = new Map<string, string>((clinicsR.data as any[]).map((c) => [c.id, c.slug || slugify(c.name)]));
  const assessments: RawAssessment[] = (assessmentsR.data as any[]).map((a) => {
    const p = patientById.get(a.patientId);
    const consult = consultByAssessment.get(a.id);
    const version = consult ? versionById.get(consult.currentVersionId) : undefined;
    const reports = (reportsR.data as any[]).filter((r) => r.assessmentId === a.id).map((r) => r.status);
    return {
      clinicSlug: clinicSlugById.get(a.clinicId) ?? "",
      patient: p?.name ? `${String(p.name).charAt(0)}***` : "—",
      age: p?.age ?? null,
      gender: p?.gender ?? null,
      submitted: a.submittedAt ? String(a.submittedAt).slice(0, 10) : null,
      procStatus: a.status ?? null,
      reviewDecision: a.reviewDecision ?? null,
      reviewedAt: a.reviewedAt ? String(a.reviewedAt).slice(0, 10) : null,
      consultApproval: version?.approvalStatus ?? null,
      kit: (kitsR.data as any[]).filter((k) => k.assessmentId === a.id && k.status === "READY_FOR_FULFILMENT").length,
      reportStatuses: reports.length ? Array.from(new Set(reports)).join(",") : null,
      waSent: (waR.data as any[]).filter((w) => w.assessmentId === a.id && w.status === "SENT").length,
    };
  });

  const derived = clinics.map(deriveClinic);
  return {
    meta: {
      source: (process.env.SUPABASE_URL ?? "").replace(/^https?:\/\//, "") || "live production",
      extractedAt: new Date().toISOString(),
      live: true,
      targets: snapshot.meta.targets,
    },
    clinics: derived,
    assessments,
    totals: computeTotals(derived),
  };
}

export async function getMonitorData(): Promise<MonitorData> {
  try {
    return await loadLive();
  } catch {
    return loadSnapshot();
  }
}

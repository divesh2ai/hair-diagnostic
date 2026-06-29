"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Building2,
  Check,
  X,
  MessageCircle,
  History,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { Consultation, DoctorNote } from "@shared/types/consultation";
import type { ConsultationMeta } from "@/lib/consultation/meta";
import { ReportActions } from "@/components/ui/ReportActions";
import {
  DiagnosisSummaryCard,
  ClinicalEvidenceCard,
  ClinicalFindingsCard,
  SeverityCard,
  ConfidenceCard,
  RootCauseCard,
  RiskFactorsCard,
  TreatmentPlanCard,
  RecommendationKitCard,
  LifestyleCard,
  TimelineCard,
  FollowUpCard,
  EducationCard,
} from "@/components/consultation";

// ─────────────────────────────────────────────────────────────────────────────
// Doctor review workspace — PRESENTATION LAYER ONLY.
//
// This surface renders the canonical Consultation returned by
//   GET /api/consultation/[assessmentId]
// No diagnosis generation or clinical business logic lives here. Every section
// renders directly from the consultation object. Doctor edits create a new
// immutable version via PATCH; approval updates the consultation approval state
// via POST .../approve. The UI always reflects the latest current version.
// ─────────────────────────────────────────────────────────────────────────────

type ApprovalAction = "APPROVED" | "REVISION_REQUESTED" | "REJECTED";

export function DoctorReviewClient({ assessmentId }: { assessmentId: string }) {
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [meta, setMeta] = useState<ConsultationMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [pending, setPending] = useState<ApprovalAction | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/consultation/${assessmentId}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message ?? "load_failed");
      }
      const data = (await res.json()) as {
        consultation: Consultation;
        meta: ConsultationMeta;
      };
      setConsultation(data.consultation);
      setMeta(data.meta);
      setError(null);
    } catch (err) {
      console.error("[doctor-review] load failed", err);
      setError("We could not load this consultation. Please refresh.");
    }
  }, [assessmentId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Doctor note → immutable new ConsultationVersion (PATCH revise).
  const addNote = useCallback(async () => {
    if (!consultation) return;
    if (note.trim().length === 0) {
      toast.error("Write a note first");
      return;
    }
    setSavingNote(true);
    try {
      const newNote: DoctorNote = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `note-${Date.now()}`,
        doctorId: meta?.createdBy ?? "",
        body: note.trim(),
        createdAt: new Date().toISOString(),
        visibleToPatient: false,
      };
      const res = await fetch(`/api/consultation/${assessmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorNotes: [...consultation.doctorNotes, newNote],
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.message ?? "Could not save note");
        return;
      }
      toast.success("Note added — new version created");
      setNote("");
      await load();
    } finally {
      setSavingNote(false);
    }
  }, [assessmentId, consultation, meta, note, load]);

  // Approval → updates the Consultation approval state.
  const submitDecision = useCallback(
    async (status: ApprovalAction) => {
      if (status !== "APPROVED" && note.trim().length === 0) {
        toast.error("Add a note before requesting revision or rejecting");
        return;
      }
      setPending(status);
      try {
        const res = await fetch(`/api/consultation/${assessmentId}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, notes: note }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          toast.error(j.message ?? "Decision failed");
          return;
        }
        toast.success(
          status === "APPROVED"
            ? "Consultation approved"
            : status === "REVISION_REQUESTED"
              ? "Revision requested"
              : "Rejected",
        );
        await load();
      } finally {
        setPending(null);
      }
    },
    [assessmentId, note, load],
  );

  const isApproved = meta?.approvalStatus === "APPROVED";

  // Version history derived directly from the consultation audit trail — no
  // recomputation, no extra round-trip.
  const auditEvents = useMemo(
    () => [...(consultation?.audit.events ?? [])].reverse(),
    [consultation],
  );

  if (error) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}
        </div>
      </div>
    );
  }

  if (!consultation || !meta) {
    return (
      <div className="space-y-6">
        <BackLink />
        <SkeletonReview />
      </div>
    );
  }

  const { patient, diagnosis, confidence } = consultation;
  const clinicName =
    (consultation as Consultation & { branding?: { clinicName?: string } }).branding
      ?.clinicName ?? null;

  return (
    <div className="space-y-6">
      <BackLink />

      {/* ── Executive summary ──────────────────────────────────────────────── */}
      <section className="rounded-2xl bg-white border border-stone-200 shadow-sm p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
              DrFACT · Consultation review
            </p>
            <h1 className="mt-1 font-serif text-2xl text-slate-900 flex items-center gap-2">
              <User className="h-5 w-5 text-slate-400" />
              {patient.name || "(unnamed patient)"}
            </h1>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
              {patient.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> {patient.phone}
                </span>
              )}
              {patient.email && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> {patient.email}
                </span>
              )}
              {patient.age != null && <span>{patient.age} yrs</span>}
              {patient.sex && <span>{patient.sex}</span>}
              {clinicName && (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> {clinicName}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <ApprovalBadge status={meta.approvalStatus} />
            <span className="text-[11px] text-stone-500">
              Version {meta.contentVersion}
            </span>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Field label="Primary diagnosis">{diagnosis.primary}</Field>
          <Field label="Severity">{diagnosis.severity}</Field>
          <Field label="Confidence">
            {Math.round(confidence.overall.score * 100)}% · {confidence.overall.band}
          </Field>
          <Field label="Submitted">
            {consultation.assessment.submittedAt
              ? new Date(consultation.assessment.submittedAt).toLocaleString()
              : "—"}
          </Field>
        </dl>
      </section>

      {/* ── Two-column: consultation (left) · doctor controls (right) ───────── */}
      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <ErrorBoundary title="Consultation could not be displayed">
          <div className="space-y-6">
            <SectionGroup title="Primary diagnosis">
              <DiagnosisSummaryCard diagnosis={diagnosis} />
            </SectionGroup>

            <SectionGroup title="Severity & confidence">
              <div className="grid sm:grid-cols-2 gap-4">
                <SeverityCard
                  severity={diagnosis.severity}
                  source={diagnosis.severitySource}
                />
                <ConfidenceCard confidence={confidence} />
              </div>
            </SectionGroup>

            {consultation.clinicalFindings.length > 0 && (
              <SectionGroup title="Clinical findings">
                <ClinicalFindingsCard findings={consultation.clinicalFindings} />
              </SectionGroup>
            )}

            <SectionGroup title="Root cause analysis">
              <div className="space-y-4">
                <RootCauseCard rootCause={consultation.rootCause} />
                <RiskFactorsCard rootCause={consultation.rootCause} />
              </div>
            </SectionGroup>

            <SectionGroup title="Recommended treatment">
              <div className="space-y-4">
                <TreatmentPlanCard plan={consultation.treatmentPlan} />
                {consultation.treatmentPlan.kitPhases.map((kit, i) => (
                  <RecommendationKitCard key={kit.kitId ?? i} kit={kit} />
                ))}
              </div>
            </SectionGroup>

            {confidence.missingInformation.length > 0 && (
              <SectionGroup title="Investigation recommendations">
                <InvestigationCard items={confidence.missingInformation} />
              </SectionGroup>
            )}

            <SectionGroup title="Patient education">
              <EducationCard education={consultation.patientEducation} />
            </SectionGroup>

            <SectionGroup title="Diet & lifestyle">
              <LifestyleCard
                general={consultation.patientEducation.generalLifestyle}
                conditionMapped={consultation.patientEducation.conditionLifestyle}
              />
            </SectionGroup>

            {consultation.followUp && (
              <SectionGroup title="Follow-up plan">
                <FollowUpCard followUp={consultation.followUp} />
              </SectionGroup>
            )}

            {consultation.treatmentPlan.expectedTimeline.length > 0 && (
              <SectionGroup title="Clinical timeline">
                <TimelineCard
                  milestones={consultation.treatmentPlan.expectedTimeline}
                />
              </SectionGroup>
            )}

            <SectionGroup title="Clinical evidence">
              <ClinicalEvidenceCard evidence={consultation.evidence} />
            </SectionGroup>
          </div>
        </ErrorBoundary>

        {/* ── Doctor controls sidebar ──────────────────────────────────────── */}
        <aside className="space-y-4 lg:sticky lg:top-24">
          {/* Approval status */}
          <SidebarCard eyebrow="Status" title="Approval">
            <div className="flex items-center justify-between">
              <ApprovalBadge status={meta.approvalStatus} />
              <span className="text-[11px] text-stone-500">v{meta.contentVersion}</span>
            </div>
            {meta.approvedAt && (
              <p className="mt-2 text-[11px] text-stone-500">
                {meta.approvalStatus === "APPROVED" ? "Approved" : "Updated"}{" "}
                {new Date(meta.approvedAt).toLocaleString()}
                {meta.approvedBy ? ` · ${meta.approvedBy}` : ""}
              </p>
            )}
            {meta.approvalNotes && (
              <p className="mt-2 text-xs text-slate-700">{meta.approvalNotes}</p>
            )}
          </SidebarCard>

          {/* Doctor notes → new version */}
          <SidebarCard eyebrow="Doctor observations" title="Notes">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add clinical notes, revision requests, or rejection reasons…"
              rows={5}
              maxLength={2000}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15"
            />
            <div className="mt-1 flex items-center justify-between">
              <button
                type="button"
                onClick={addNote}
                disabled={savingNote || note.trim().length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {savingNote ? "Saving…" : "Add note"}
              </button>
              <p className="text-[11px] text-stone-400">{note.length}/2000</p>
            </div>
            {consultation.doctorNotes.length > 0 && (
              <ul className="mt-3 space-y-2 border-t border-stone-100 pt-3">
                {consultation.doctorNotes.map((n) => (
                  <li key={n.id} className="text-xs text-slate-700">
                    <p>{n.body}</p>
                    <p className="text-[10px] text-stone-400">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SidebarCard>

          {/* Decision actions */}
          <SidebarCard eyebrow="Decision" title="Approval actions">
            <div className="space-y-2">
              <DecisionButton
                tone="approve"
                label="Approve consultation"
                icon={<Check className="h-4 w-4" />}
                disabled={pending !== null}
                pending={pending === "APPROVED"}
                onClick={() => submitDecision("APPROVED")}
              />
              <DecisionButton
                tone="warn"
                label="Request revision"
                icon={<MessageCircle className="h-4 w-4" />}
                disabled={pending !== null}
                pending={pending === "REVISION_REQUESTED"}
                onClick={() => submitDecision("REVISION_REQUESTED")}
              />
              <DecisionButton
                tone="danger"
                label="Reject"
                icon={<X className="h-4 w-4" />}
                disabled={pending !== null}
                pending={pending === "REJECTED"}
                onClick={() => submitDecision("REJECTED")}
              />
            </div>
          </SidebarCard>

          {/* Share & export — only once approved */}
          <SidebarCard eyebrow="Share & export" title="Final actions">
            <ReportActions
              assessmentId={assessmentId}
              patientName={patient.name}
              clinicName={clinicName}
              patientWhatsapp={patient.phone ?? null}
              enabled={isApproved}
            />
            {!isApproved && (
              <p className="mt-3 text-[11px] text-stone-500">
                Available once the consultation is approved.
              </p>
            )}
          </SidebarCard>

          {/* Version history */}
          <SidebarCard eyebrow="Audit" title="Version history">
            <div className="mb-2 flex items-center gap-1.5 text-xs text-stone-500">
              <History className="h-3.5 w-3.5" />
              Current version {meta.contentVersion}
            </div>
            <ol className="space-y-2">
              {auditEvents.map((ev, i) => (
                <li
                  key={`${ev.at}-${i}`}
                  className="flex items-start gap-2 text-xs text-slate-700"
                >
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-stone-400 shrink-0" />
                  <div>
                    <p className="font-medium">{ev.kind}</p>
                    <p className="text-[10px] text-stone-400">
                      {new Date(ev.at).toLocaleString()}
                      {ev.note ? ` · ${ev.note}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </SidebarCard>
        </aside>
      </div>
    </div>
  );
}

// ── Local presentation helpers ──────────────────────────────────────────────

function SectionGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-serif text-lg text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function SidebarCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white border border-stone-200 shadow-sm">
      <header className="px-5 py-3 border-b border-stone-200">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
          {eyebrow}
        </p>
        <h3 className="font-serif text-lg text-slate-900">{title}</h3>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function InvestigationCard({
  items,
}: {
  items: { kind: string; reason: string; suggestion: string }[];
}) {
  return (
    <section className="rounded-2xl bg-white border border-stone-200 shadow-sm p-5">
      <ul className="space-y-2.5">
        {items.map((m, i) => (
          <li key={`${m.kind}-${i}`} className="text-sm text-slate-700">
            <span className="font-medium">{m.suggestion}</span>
            <span className="text-stone-500"> — {m.reason}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ApprovalBadge({ status }: { status: string }) {
  const palette: Record<string, string> = {
    APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    PENDING_REVIEW: "bg-amber-50 text-amber-700 border-amber-200",
    REVISION_REQUESTED: "bg-amber-50 text-amber-700 border-amber-200",
    REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
    DRAFT: "bg-stone-100 text-stone-600 border-stone-200",
  };
  const label = status.replace(/_/g, " ").toLowerCase();
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${
        palette[status] ?? palette.DRAFT
      }`}
    >
      {label}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-slate-800">{children}</dd>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/doctor/reports"
      className="text-sm text-sky-600 inline-flex items-center gap-1 hover:text-sky-700"
    >
      <ArrowLeft className="h-4 w-4" /> Back to reports
    </Link>
  );
}

function DecisionButton({
  tone,
  label,
  icon,
  pending,
  disabled,
  onClick,
}: {
  tone: "approve" | "warn" | "danger";
  label: string;
  icon: React.ReactNode;
  pending: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const palette =
    tone === "approve"
      ? "bg-emerald-600 text-white hover:bg-emerald-700"
      : tone === "warn"
        ? "bg-amber-500 text-white hover:bg-amber-600"
        : "bg-rose-600 text-white hover:bg-rose-700";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${palette}`}
    >
      {pending ? (
        <span className="h-4 w-4 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
      ) : (
        icon
      )}
      {label}
    </button>
  );
}

function SkeletonReview() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-32 rounded-2xl bg-white border border-stone-200" />
      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <div className="h-[600px] rounded-2xl bg-white border border-stone-200" />
        <div className="space-y-4">
          <div className="h-40 rounded-2xl bg-white border border-stone-200" />
          <div className="h-40 rounded-2xl bg-white border border-stone-200" />
        </div>
      </div>
    </div>
  );
}

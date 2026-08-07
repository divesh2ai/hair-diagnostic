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
  MessageSquareWarning,
  MessageCircle,
  ClipboardCheck,
  Flag,
  History,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ClipboardList,
  Package,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { Consultation, DoctorNote } from "@shared/types/consultation";
import type {
  ConsultationMeta,
  ConsultationOperationalState,
} from "@/lib/consultation/meta";
import { ReportActions } from "@/components/ui/ReportActions";
import { KitLineupEditor } from "./KitLineupEditor";
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
  TopicalsCard,
  SafetyCard,
  LifestyleCard,
  TimelineCard,
  FollowUpCard,
  EducationCard,
} from "@/components/consultation";

// ─────────────────────────────────────────────────────────────────────────────
// Doctor review workspace — PRESENTATION ONLY.
//
// Deliberately concise default view: patient essentials, detected conditions,
// final kit lineup, safety alerts, concise rationale, report state, three
// primary actions (Approve & create kit order, Save note, Needs revision).
// Everything else — findings detail, root cause depth, topicals, timeline,
// education, evidence, version history — lives inside collapsed
// "Clinical details" so the doctor lands on the review decision in seconds.
//
// The UI never renders raw questionnaire answers, raw recommendation traces,
// rule internals, tokens, or unnecessary patient data.
// ─────────────────────────────────────────────────────────────────────────────

type RevisionReason =
  | "RECOMMENDATION_WRONG"
  | "SAFETY_CONCERN"
  | "CLINICAL_INTERPRETATION"
  | "REPORT_QUALITY"
  | "OTHER";

const REVISION_REASON_LABELS: Record<RevisionReason, string> = {
  RECOMMENDATION_WRONG: "Recommendation is wrong",
  SAFETY_CONCERN: "Safety concern",
  CLINICAL_INTERPRETATION: "Clinical interpretation off",
  REPORT_QUALITY: "Report quality issue",
  OTHER: "Other",
};

// One-tap note templates. Doctor can pick and edit, or write from scratch.
const REVISION_NOTE_TEMPLATES: Record<RevisionReason, readonly string[]> = {
  RECOMMENDATION_WRONG: [
    "Please rerank kits — hormonal driver should lead over metabolic.",
    "Drop the topical recommendation; patient is already on prescription.",
    "Add pregnancy-safe kit; suppress the DHT-blocker family.",
  ],
  SAFETY_CONCERN: [
    "Contraindication with patient's current medication — please review.",
    "Pregnancy safety not confirmed; hold order until verified.",
    "Allergy history conflicts with an ingredient in the primary kit.",
  ],
  CLINICAL_INTERPRETATION: [
    "AGA driver overstated — pattern is diffuse telogen, not androgenetic.",
    "Iron deficiency likely missed — ferritin history suggests it.",
    "Thyroid axis under-weighted for this presentation.",
  ],
  REPORT_QUALITY: [
    "Narrative reads generic; please re-tone for this patient.",
    "Missing citations for the two lead recommendations.",
    "Language should be Hindi for the patient-facing report.",
  ],
  OTHER: [],
};

type FeedbackVerdict = "CORRECT" | "PARTLY_CORRECT" | "INCORRECT" | "SAFETY_CONCERN";
type FeedbackIssue =
  | "WRONG_KIT_INCLUDED"
  | "WRONG_KIT_EXCLUDED"
  | "WRONG_ORDER"
  | "MISSING_KIT"
  | "SAFETY_ISSUE"
  | "CONDITION_INTERPRETATION"
  | "NARRATIVE_ONLY"
  | "OTHER";
type FeedbackSeverity = "LOW" | "MEDIUM" | "HIGH";

const FEEDBACK_ISSUE_LABELS: Record<FeedbackIssue, string> = {
  WRONG_KIT_INCLUDED: "Wrong kit included",
  WRONG_KIT_EXCLUDED: "Wrong kit excluded",
  WRONG_ORDER: "Wrong order",
  MISSING_KIT: "Missing kit",
  SAFETY_ISSUE: "Safety issue",
  CONDITION_INTERPRETATION: "Condition interpretation",
  NARRATIVE_ONLY: "Narrative only",
  OTHER: "Other",
};

export function DoctorReviewClient({
  assessmentId,
  shareToken,
}: {
  assessmentId: string;
  shareToken?: string;
}) {
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [meta, setMeta] = useState<ConsultationMeta | null>(null);
  const [operational, setOperational] =
    useState<ConsultationOperationalState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<"questionnaire" | "products" | "recovery">(
    "questionnaire",
  );
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [approving, setApproving] = useState(false);
  const [retryingReport, setRetryingReport] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [readinessBlock, setReadinessBlock] =
    useState<ReadinessBlockDetail | null>(null);

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
        operational?: ConsultationOperationalState;
      };
      setConsultation(data.consultation);
      setMeta(data.meta);
      setOperational(data.operational ?? null);
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

  const addNote = useCallback(async () => {
    if (!consultation || !meta) return;
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
        doctorId: meta.createdBy ?? "",
        body: note.trim(),
        createdAt: new Date().toISOString(),
        visibleToPatient: false,
      };
      const res = await fetch(`/api/consultation/${assessmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorNotes: [...consultation.doctorNotes, newNote],
          expectedContentVersion: meta.contentVersion,
        }),
      });
      if (res.status === 409) {
        toast.error(
          "This consultation changed while you were editing. Reload before saving.",
        );
        await load();
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.message ?? "Could not save note");
        return;
      }
      toast.success("Note saved — new version created");
      setNote("");
      await load();
    } finally {
      setSavingNote(false);
    }
  }, [assessmentId, consultation, meta, note, load]);

  const approveAndCreateOrder = useCallback(
    async (readinessOverrideReason?: string) => {
      if (!meta) return;
      setApproving(true);
      try {
        const res = await fetch(
          `/api/consultation/${assessmentId}/order`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              expectedContentVersion: meta.contentVersion,
              notes: note.trim() || undefined,
              readinessOverrideReason: readinessOverrideReason || undefined,
            }),
          },
        );
        const j = await res.json().catch(() => ({}));
        if (res.ok) {
          toast.success(
            j.order?.created
              ? "Approved · kit order created"
              : "Approved · kit order already existed",
          );
          setNote("");
          setReadinessBlock(null);
          await load();
          return;
        }
        if (res.status === 409) {
          toast.error(
            "This consultation changed while you were reviewing. Reload before approving.",
          );
          await load();
          return;
        }
        if (res.status === 422 && j.error === "readiness_blocked") {
          const detail = j.detail as ReadinessBlockDetail | undefined;
          const overridable =
            !!detail &&
            detail.groundingViolationCount === 0 &&
            detail.reasoningGapCount > 0;
          // A reasoning-gap-only block can be signed past by the doctor with a
          // justification. A grounding violation (or missing snapshot) cannot —
          // show it as a hard stop that only regeneration resolves.
          if (overridable && !readinessOverrideReason) {
            setReadinessBlock(detail);
            return;
          }
          toast.error(
            j.message ?? "Approval blocked by clinical readiness gate",
          );
          return;
        }
        toast.error(j.message ?? "Approval failed");
      } finally {
        setApproving(false);
      }
    },
    [assessmentId, meta, note, load],
  );

  const submitNeedsRevision = useCallback(
    async (reason: RevisionReason, reasonNote: string) => {
      if (!meta) return;
      const res = await fetch(
        `/api/consultation/${assessmentId}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "NEEDS_REVISION",
            revisionReason: reason,
            notes: reasonNote,
          }),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.message ?? "Could not submit revision request");
        return;
      }
      toast.success("Marked as needing revision");
      setRevisionOpen(false);
      await load();
    },
    [assessmentId, meta, load],
  );

  const retryReport = useCallback(async () => {
    setRetryingReport(true);
    try {
      const res = await fetch(
        `/api/consultation/${assessmentId}/report/retry`,
        { method: "POST" },
      );
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Report retry queued");
        await load();
      } else if (res.status === 409) {
        toast.error("Report is not in a retryable state right now");
      } else {
        toast.error(j.message ?? "Retry failed");
      }
    } finally {
      setRetryingReport(false);
    }
  }, [assessmentId, load]);

  const submitFeedback = useCallback(
    async (payload: {
      verdict: FeedbackVerdict;
      issueType: FeedbackIssue;
      severity: FeedbackSeverity;
      rationale?: string;
    }) => {
      const res = await fetch(
        `/api/consultation/${assessmentId}/feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            verdict: payload.verdict,
            issueType: payload.issueType,
            severity: payload.severity,
            clinicalRationale: payload.rationale ?? "",
          }),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.message ?? "Feedback not saved");
        return false;
      }
      toast.success("Feedback recorded");
      setFeedbackOpen(false);
      return true;
    },
    [assessmentId],
  );

  const isApproved = meta?.approvalStatus === "APPROVED";

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

  const { patient, diagnosis, confidence, treatmentPlan } = consultation;
  const clinicName =
    (consultation as Consultation & { branding?: { clinicName?: string } })
      .branding?.clinicName ?? null;
  const kitPhases = treatmentPlan.kitPhases;
  const safetyItems = extractSafety(consultation);

  return (
    <div className="space-y-6">
      <BackLink />

      {/* ── Header: patient essentials + status pills ──────────────────────── */}
      <section className="rounded-2xl bg-white border border-stone-200 shadow-sm p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
              Consultation review
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
              {patient.phone && (
                <a
                  href={`https://wa.me/${patient.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                    `Hi ${patient.name?.split(" ")[0] ?? ""}, this is your dermatologist following up on your Dr FACT report. Let me know if you have any questions.`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"
                >
                  <MessageCircle className="h-3 w-3" />
                  Message on WhatsApp
                </a>
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
            <ReportStatePill
              state={operational?.reportState ?? "not_started"}
              onRetry={retryReport}
              retrying={retryingReport}
            />
            <span className="text-[11px] text-stone-500">
              Version {meta.contentVersion}
            </span>
          </div>
        </div>
      </section>

      {/* ── Primary review pane ─────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <ErrorBoundary title="Consultation could not be displayed">
          <div className="space-y-6">
            <TabNav tab={tab} onChange={setTab} />

            {tab === "questionnaire" && (
              <div className="space-y-6">
                <SectionGroup title="Assessment summary">
                  <QuestionnaireCard
                    answers={consultation.assessment.rawAnswers}
                  />
                </SectionGroup>

                {consultation.clinicalFindings.length > 0 && (
                  <SectionGroup title="Clinical interpretation">
                    <ClinicalFindingsCard
                      findings={consultation.clinicalFindings}
                    />
                  </SectionGroup>
                )}

                <SectionGroup title="Root cause analysis">
                  <div className="space-y-4">
                    <RootCauseCard rootCause={consultation.rootCause} />
                    <RiskFactorsCard rootCause={consultation.rootCause} />
                  </div>
                </SectionGroup>

                <SectionGroup title="Clinical evidence">
                  <ClinicalEvidenceCard evidence={consultation.evidence} />
                </SectionGroup>
              </div>
            )}

            {tab === "products" && (
              <div className="space-y-6">
                {safetyItems.length > 0 && (
                  <SectionGroup title="Safety alerts">
                    <ul className="rounded-2xl border border-amber-200 bg-amber-50 divide-y divide-amber-100 text-sm text-amber-900 overflow-hidden">
                      {safetyItems.map((s, i) => (
                        <SafetyAlertRow key={i} item={s} />
                      ))}
                    </ul>
                  </SectionGroup>
                )}

                <SectionGroup title="Recommended kits (final order)">
                  {isApproved ? (
                    <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      Lineup locked — this consultation is approved. The kit
                      order was created from the lineup below.
                    </div>
                  ) : (
                    <div className="mb-4">
                      <KitLineupEditor
                        assessmentId={assessmentId}
                        consultation={consultation}
                        expectedContentVersion={meta.contentVersion}
                        onSaved={async () => {
                          toast.success("Kit lineup saved — new version created");
                          await load();
                        }}
                        onConflict={load}
                      />
                    </div>
                  )}
                  {kitPhases.length === 0 ? (
                    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
                      No kits recommended.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {kitPhases.map((kit, i) => (
                        <RecommendationKitCard key={`kit-${i}`} kit={kit} />
                      ))}
                    </div>
                  )}
                </SectionGroup>

                {consultation.treatmentPlan.topicals.length > 0 && (
                  <SectionGroup title="Topical recommendations">
                    <TopicalsCard topicals={consultation.treatmentPlan.topicals} />
                  </SectionGroup>
                )}

                <SectionGroup title="Concise rationale">
                  <TreatmentPlanCard plan={treatmentPlan} />
                </SectionGroup>

                <SectionGroup title="Safety & disclosures">
                  <SafetyCard consultation={consultation} />
                </SectionGroup>
              </div>
            )}

            {tab === "recovery" && (
              <div className="space-y-6">
                {consultation.treatmentPlan.expectedTimeline.length > 0 && (
                  <SectionGroup title="Recovery milestones">
                    <TimelineCard
                      milestones={consultation.treatmentPlan.expectedTimeline}
                    />
                  </SectionGroup>
                )}

                <SectionGroup title="Diet & lifestyle">
                  <LifestyleCard
                    general={consultation.patientEducation.generalLifestyle}
                    conditionMapped={
                      consultation.patientEducation.conditionLifestyle
                    }
                  />
                </SectionGroup>

                <SectionGroup title="Patient education">
                  <EducationCard education={consultation.patientEducation} />
                </SectionGroup>

                {consultation.followUp && (
                  <SectionGroup title="Follow-up plan">
                    <FollowUpCard followUp={consultation.followUp} />
                  </SectionGroup>
                )}
              </div>
            )}
          </div>
        </ErrorBoundary>

        {/* ── Doctor sidebar ────────────────────────────────────────────────── */}
        <aside className="space-y-4 lg:sticky lg:top-24">
          {/* Primary action */}
          <SidebarCard eyebrow="Doctor decision" title="Primary action">
            <button
              type="button"
              onClick={() => approveAndCreateOrder()}
              disabled={approving || isApproved}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {approving ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
              ) : (
                <ClipboardCheck className="h-4 w-4" />
              )}
              {isApproved ? "Approved" : "Approve & create kit order"}
            </button>
            {isApproved && operational?.orderIntentId && (
              <div className="mt-2 space-y-2">
                <p className="text-[11px] text-emerald-700">
                  Order intent {operational.orderIntentId.slice(-8)} ·{" "}
                  {operational.orderIntentStatus ?? "READY_FOR_FULFILMENT"}
                </p>
                {patient.phone && (
                  <a
                    href={`https://wa.me/${patient.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                      `Hi ${patient.name?.split(" ")[0] ?? ""}, your Dr FACT plan is ready. Review and confirm your kit order here: ${typeof window !== "undefined" ? window.location.origin : ""}/cart/${assessmentId}`,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Send cart to patient (WhatsApp)
                  </a>
                )}
                <a
                  href={`/cart/${assessmentId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-stone-50"
                >
                  Preview patient cart
                </a>
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={addNote}
                disabled={savingNote || note.trim().length === 0}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-stone-50 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                {savingNote ? "Saving…" : "Save note"}
              </button>
              <button
                type="button"
                onClick={() => setRevisionOpen(true)}
                disabled={approving}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              >
                <MessageSquareWarning className="h-3.5 w-3.5" />
                Needs revision
              </button>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackOpen(true)}
              className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
            >
              <Flag className="h-3.5 w-3.5" />
              Flag recommendation issue
            </button>
          </SidebarCard>

          {/* Doctor notes textarea */}
          <SidebarCard eyebrow="Doctor observations" title="Notes">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note attached to your decision…"
              rows={4}
              maxLength={2000}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15"
            />
            <p className="mt-1 text-[11px] text-stone-400 text-right">
              {note.length}/2000
            </p>
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

          {/* Share & export — only once approved */}
          <SidebarCard eyebrow="Share & export" title="Final actions">
            <ReportActions
              assessmentId={assessmentId}
              patientName={patient.name}
              clinicName={clinicName}
              patientWhatsapp={patient.phone ?? null}
              shareToken={shareToken}
              enabled={isApproved}
            />
            {!isApproved && (
              <p className="mt-3 text-[11px] text-stone-500">
                Available once the consultation is approved.
              </p>
            )}
          </SidebarCard>

          {/* Version history collapsed */}
          <details className="rounded-2xl bg-white border border-stone-200 shadow-sm">
            <summary className="cursor-pointer list-none px-5 py-3 border-b border-stone-200 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                  Audit
                </p>
                <h3 className="font-serif text-base text-slate-900">
                  Version history
                </h3>
              </div>
              <ChevronDown className="h-4 w-4 text-stone-500 transition-transform group-open:rotate-180" />
            </summary>
            <div className="p-4">
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
            </div>
          </details>
        </aside>
      </div>

      {revisionOpen && (
        <NeedsRevisionModal
          onCancel={() => setRevisionOpen(false)}
          onSubmit={submitNeedsRevision}
        />
      )}
      {feedbackOpen && (
        <FeedbackDrawer
          onClose={() => setFeedbackOpen(false)}
          onSubmit={submitFeedback}
        />
      )}
      {readinessBlock && (
        <ReadinessOverrideModal
          detail={readinessBlock}
          submitting={approving}
          onCancel={() => setReadinessBlock(null)}
          onOverride={(reason) => approveAndCreateOrder(reason)}
          onSendForRevision={() => {
            setReadinessBlock(null);
            setRevisionOpen(true);
          }}
        />
      )}
    </div>
  );
}

// ── Readiness override modal ─────────────────────────────────────────────────
//
// Shown only when the readiness gate blocked approval AND the block is
// reasoning-gaps-only (the server refuses to accept an override for grounding
// violations, so those never reach here). The doctor must type a clinical
// justification; it is persisted on the immutable approval event and the kit
// order's audit metadata.

type ReadinessBlockDetail = {
  doctorSummary?: string;
  groundingViolationCount: number;
  reasoningGapCount: number;
  reasoningGaps?: { summary?: string; subject?: string }[];
};

const MIN_OVERRIDE_REASON = 10;

function ReadinessOverrideModal({
  detail,
  submitting,
  onCancel,
  onOverride,
  onSendForRevision,
}: {
  detail: ReadinessBlockDetail;
  submitting: boolean;
  onCancel: () => void;
  onOverride: (reason: string) => void;
  onSendForRevision: () => void;
}) {
  const [reason, setReason] = useState("");
  const canSubmit = reason.trim().length >= MIN_OVERRIDE_REASON && !submitting;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="p-5 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            <h2 className="font-serif text-lg text-slate-900">
              Approve past the readiness advisory
            </h2>
          </div>
          <p className="mt-1 text-xs text-stone-500">
            The AI narrative has{" "}
            <strong>
              {detail.reasoningGapCount} reasoning gap
              {detail.reasoningGapCount === 1 ? "" : "s"}
            </strong>{" "}
            — a completeness advisory, not a safety contraindication. As the
            reviewing clinician you may approve with a recorded justification.
          </p>
        </div>
        <div className="p-5 space-y-3">
          {detail.reasoningGaps && detail.reasoningGaps.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                What the gate flagged
              </p>
              <ul className="mt-1.5 space-y-1 text-xs text-amber-900 list-disc pl-4">
                {detail.reasoningGaps.slice(0, 5).map((g, i) => (
                  <li key={i}>{g.summary ?? g.subject ?? "Unspecified gap"}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Alternative to overriding: flag it for revision instead of
              signing off. Records the reason and holds the consultation. */}
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-slate-800">
                Prefer not to sign off?
              </p>
              <p className="mt-0.5 text-[11px] text-stone-600">
                Flag it for revision instead — records your reason and holds
                the consultation rather than approving it.
              </p>
            </div>
            <button
              type="button"
              onClick={onSendForRevision}
              disabled={submitting}
              className="shrink-0 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-stone-100 disabled:opacity-50"
            >
              Needs revision
            </button>
          </div>

          <div className="relative py-1 text-center">
            <span className="bg-white px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
              or approve with justification
            </span>
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
              Clinical justification (required)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Narrative wording is incomplete but the kit plan and clinical reasoning are correct for this presentation; I take clinical responsibility for this report."
              rows={4}
              maxLength={2000}
              className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15"
            />
            <p className="mt-1 text-[11px] text-stone-400">
              Recorded against your name on the approval and the kit order.
              Minimum {MIN_OVERRIDE_REASON} characters.
            </p>
          </div>
        </div>
        <div className="p-4 border-t border-stone-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-700 hover:bg-stone-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onOverride(reason.trim())}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {submitting ? "Approving…" : "Approve anyway & create order"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tabs ────────────────────────────────────────────────────────────────────

type Tab = "questionnaire" | "products" | "recovery";

function TabNav({
  tab,
  onChange,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
}) {
  const items: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "questionnaire", label: "Questionnaire & clinical interpretation", icon: ClipboardList },
    { id: "products", label: "Product recommendation protocol", icon: Package },
    { id: "recovery", label: "Recovery, diet & lifestyle", icon: Sparkles },
  ];
  return (
    <div
      role="tablist"
      aria-label="Clinical output"
      className="flex flex-wrap gap-1 rounded-2xl border border-stone-200 bg-white p-1 shadow-sm"
    >
      {items.map(({ id, label, icon: Icon }) => {
        const active = tab === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(id)}
            className={`flex-1 min-w-[180px] inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-stone-50"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Questionnaire card ──────────────────────────────────────────────────────

function QuestionnaireCard({
  answers,
}: {
  answers: Record<string, unknown>;
}) {
  const entries = Object.entries(answers ?? {}).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
        No questionnaire responses recorded.
      </div>
    );
  }
  return (
    <dl className="rounded-2xl border border-stone-200 bg-white divide-y divide-stone-100">
      {entries.map(([k, v]) => (
        <div
          key={k}
          className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-1 sm:gap-4 px-4 py-2.5"
        >
          <dt className="text-xs font-medium text-stone-500 truncate">{k}</dt>
          <dd className="text-sm text-slate-800 break-words">
            {formatAnswer(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function formatAnswer(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.map((x) => formatAnswer(x)).join(", ");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

// ── Safety alert row (expandable drill-down) ───────────────────────────────

function SafetyAlertRow({ item }: { item: SafetyItem }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2 px-4 py-2.5 text-left hover:bg-amber-100/60 transition-colors"
      >
        <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
        <span className="flex-1 font-medium">{item.label}</span>
        <ChevronDown className={`h-4 w-4 mt-0.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="bg-amber-50/70 px-4 pb-3 pt-1 pl-10 text-xs text-amber-900 space-y-1.5">
          {item.reason && (
            <div>
              <span className="font-semibold uppercase tracking-wide text-[10px] text-amber-700 mr-1.5">Reason</span>
              {item.reason}
            </div>
          )}
          <div>
            <span className="font-semibold uppercase tracking-wide text-[10px] text-amber-700 mr-1.5">Source</span>
            <span className="rounded-full bg-white/60 px-2 py-0.5 ring-1 ring-amber-200">{item.source}</span>
          </div>
        </div>
      )}
    </li>
  );
}

// ── Modals / drawers ────────────────────────────────────────────────────────

function NeedsRevisionModal({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (reason: RevisionReason, note: string) => Promise<void>;
}) {
  const [reason, setReason] = useState<RevisionReason>("RECOMMENDATION_WRONG");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = note.trim().length > 0 && !submitting;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="p-5 border-b border-stone-200">
          <h2 className="font-serif text-lg text-slate-900">Needs revision</h2>
          <p className="mt-1 text-xs text-stone-500">
            Consultation stays reviewable. Pick the reason and add a note for
            the record.
          </p>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
              Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as RevisionReason)}
              className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-slate-800"
            >
              {(Object.keys(REVISION_REASON_LABELS) as RevisionReason[]).map(
                (r) => (
                  <option key={r} value={r}>
                    {REVISION_REASON_LABELS[r]}
                  </option>
                ),
              )}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
              Note (required)
            </label>
            {REVISION_NOTE_TEMPLATES[reason].length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {REVISION_NOTE_TEMPLATES[reason].map((tpl) => (
                  <button
                    key={tpl}
                    type="button"
                    onClick={() => setNote(tpl)}
                    className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-[11px] text-slate-700 hover:border-stone-400 hover:bg-white transition-colors"
                  >
                    {tpl.length > 44 ? tpl.slice(0, 42) + "…" : tpl}
                  </button>
                ))}
              </div>
            )}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What needs revising and why…"
              rows={4}
              maxLength={2000}
              className="mt-2 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-slate-800"
            />
          </div>
        </div>
        <div className="p-4 border-t border-stone-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-700 hover:bg-stone-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onSubmit(reason, note.trim());
              } finally {
                setSubmitting(false);
              }
            }}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FeedbackDrawer({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (payload: {
    verdict: FeedbackVerdict;
    issueType: FeedbackIssue;
    severity: FeedbackSeverity;
    rationale?: string;
  }) => Promise<boolean>;
}) {
  const [verdict, setVerdict] = useState<FeedbackVerdict>("PARTLY_CORRECT");
  const [issueType, setIssueType] = useState<FeedbackIssue>("WRONG_ORDER");
  const [severity, setSeverity] = useState<FeedbackSeverity>("LOW");
  const [rationale, setRationale] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const rationaleRequired =
    verdict === "SAFETY_CONCERN" || verdict === "INCORRECT";
  const canSubmit =
    !submitting && (!rationaleRequired || rationale.trim().length > 0);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="p-5 border-b border-stone-200">
          <h2 className="font-serif text-lg text-slate-900">
            Flag recommendation issue
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            Structured feedback pinned to this version. Does not change the
            recommendation.
          </p>
        </div>
        <div className="p-5 space-y-3">
          <FieldRow label="Verdict">
            <select
              value={verdict}
              onChange={(e) => setVerdict(e.target.value as FeedbackVerdict)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
            >
              <option value="CORRECT">Correct</option>
              <option value="PARTLY_CORRECT">Partly correct</option>
              <option value="INCORRECT">Incorrect</option>
              <option value="SAFETY_CONCERN">Safety concern</option>
            </select>
          </FieldRow>
          <FieldRow label="Issue">
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value as FeedbackIssue)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
            >
              {(Object.keys(FEEDBACK_ISSUE_LABELS) as FeedbackIssue[]).map(
                (i) => (
                  <option key={i} value={i}>
                    {FEEDBACK_ISSUE_LABELS[i]}
                  </option>
                ),
              )}
            </select>
          </FieldRow>
          <FieldRow label="Severity">
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as FeedbackSeverity)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </FieldRow>
          <FieldRow
            label={
              rationaleRequired
                ? "Clinical rationale (required)"
                : "Clinical rationale (optional)"
            }
          >
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={4}
              maxLength={4000}
              placeholder="What would you have recommended and why…"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
            />
          </FieldRow>
        </div>
        <div className="p-4 border-t border-stone-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-700 hover:bg-stone-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onSubmit({
                  verdict,
                  issueType,
                  severity,
                  rationale: rationale.trim() || undefined,
                });
              } finally {
                setSubmitting(false);
              }
            }}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit feedback"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Small presentation helpers ──────────────────────────────────────────────

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

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
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

function ReportStatePill({
  state,
  onRetry,
  retrying,
}: {
  state: ConsultationOperationalState["reportState"];
  onRetry: () => void;
  retrying: boolean;
}) {
  const palette: Record<
    ConsultationOperationalState["reportState"],
    string
  > = {
    not_started: "bg-stone-100 text-stone-600 border-stone-200",
    generating: "bg-sky-50 text-sky-700 border-sky-200",
    ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
    failed: "bg-rose-50 text-rose-700 border-rose-200",
  };
  const label: Record<ConsultationOperationalState["reportState"], string> = {
    not_started: "Report: not started",
    generating: "Report: generating",
    ready: "Report: ready",
    failed: "Report: failed",
  };
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${palette[state]}`}
      >
        {label[state]}
      </span>
      {state === "failed" && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[11px] text-slate-700 hover:bg-stone-50 disabled:opacity-50"
        >
          {retrying ? "Retrying…" : "Retry"}
        </button>
      )}
    </span>
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

// ── Safety extractor ────────────────────────────────────────────────────────

type SafetyItem = {
  label: string;
  reason: string | null;
  source: "Contraindication rule" | "Caution rule" | "Allergy flag" | "Topical caution";
};

function extractSafety(consultation: Consultation): SafetyItem[] {
  const items: SafetyItem[] = [];
  const safety = (consultation as Consultation & {
    safety?: {
      contraindications?: { label?: string; reason?: string }[];
      cautions?: { label?: string; reason?: string }[];
      allergyFlags?: string[];
    };
  }).safety;
  safety?.contraindications?.forEach((c) => {
    if (c.label) items.push({ label: c.label, reason: c.reason ?? null, source: "Contraindication rule" });
  });
  safety?.cautions?.forEach((c) => {
    if (c.label) items.push({ label: c.label, reason: c.reason ?? null, source: "Caution rule" });
  });
  safety?.allergyFlags?.forEach((a) => {
    if (a) items.push({ label: a, reason: null, source: "Allergy flag" });
  });
  consultation.treatmentPlan.topicalCautions?.forEach((c) => {
    if (c.name) items.push({ label: c.name, reason: c.reason ?? null, source: "Topical caution" });
  });
  return items;
}

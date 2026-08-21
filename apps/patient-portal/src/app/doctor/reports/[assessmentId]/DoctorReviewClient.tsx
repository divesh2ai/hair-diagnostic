"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Flag, MessageCircle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useHydrated } from "@/lib/format/useHydrated";
import "@/styles/doctor-tokens.css";
import type { Consultation, DoctorNote } from "@shared/types/consultation";
import type {
  ConsultationMeta,
  ConsultationOperationalState,
} from "@/lib/consultation/meta";
import type { ReviewVisitContext } from "@/lib/consultation/loadReview";
import type {
  ReviewPayload,
  ReviewPayloadError,
} from "@/lib/consultation/reviewPayload";
import { ReportActions } from "@/components/ui/ReportActions";
import { extractSafetyFlags } from "@/lib/doctor/clinicalAttention";
import { summarizeProtocol } from "@/lib/doctor/protocolModel";
import { ReviewHeader } from "./sections/ReviewHeader";
import { ClinicalAttentionSection } from "./sections/ClinicalAttentionSection";
import { ProtocolSection } from "./sections/ProtocolSection";
import { SecondaryDetail } from "./sections/SecondaryDetail";
import { ClinicalSummarySection } from "./sections/ClinicalSummarySection";
import { DecisionBar, type DecisionState } from "./sections/DecisionBar";

// ─────────────────────────────────────────────────────────────────────────────
// Doctor review workspace — PRESENTATION ONLY.
//
// The page reads in the order a clinician actually thinks:
//
//   WHO      ReviewHeader — who is this, and how long have they waited
//   1 · THE CASE       ClinicalSummarySection  — picture, evidence, meaning
//   ! · ATTENTION      ClinicalAttentionSection (silent when nothing is wrong)
//   2 · THE PLAN       ProtocolSection          — what is being dispensed
//   3 · DECIDE         DecisionBar              — sticky, one primary action
//       REFERENCE      SecondaryDetail          — never required to decide
//
// ── The numbering is the workflow ───────────────────────────────────────────
// A doctor should never have to work out where to look or what to press next.
// The steps are numbered on screen, they always appear in the same order, and
// exactly one filled green button exists at any moment — the decision bar's.
// Everything else is a bordered secondary control.
//
// The questionnaire is NOT on this page. ClinicalSummarySection shows only the
// options the patient actually selected, grouped clinically, beside the
// engine's own reading of them. The twenty-question transcript lives behind
// "View full assessment" and nowhere else.
//
// This component owns data loading and the decision lifecycle. It does not own
// clinical judgement: no scoring, no ranking, no rules. It renders persisted
// engine output and sends the doctor's decision back.
//
// The UI never renders raw recommendation traces, rule internals, tokens, or
// unnecessary patient data.
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

/**
 * The patient after this one, for the post-decision handoff.
 *
 * An id, a name and the concern that decides which review surface to open —
 * nothing clinical. The next case is loaded by its own page, not previewed
 * here.
 */
interface NextPatient {
  id: string;
  patientName: string;
  concern: string | null;
}

// ── Review load contract ────────────────────────────────────────────────────

/** Mirrors ConsultationErrorCode in lib/consultation/loadReview. */
type ReviewErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "CROSS_CLINIC"
  | "ASSESSMENT_NOT_FOUND"
  | "CONSULTATION_NOT_COMPOSABLE"
  | "CONSULTATION_LOAD_FAILED";

type ReviewLoadState = "loading" | "ready" | "core_error";

interface CoreLoadError {
  code: ReviewErrorCode;
  message: string;
  /** Support reference. Absent when the request never reached the server. */
  requestId: string | null;
  retryable: boolean;
}

interface ReviewResponse {
  consultation: Consultation;
  meta: ConsultationMeta;
  operational?: ConsultationOperationalState | null;
  visit?: ReviewVisitContext | null;
  core?: { status: "ready" | "degraded"; degradedReasons: string[] };
  warnings?: Array<{ code: string; stage: string }>;
  requestId?: string;
}

const FALLBACK_ERROR_MESSAGE = "We couldn't open this clinical review. Please retry.";

/**
 * Whether offering a Retry is honest.
 *
 * A missing assessment, a permission failure and an uncomposable historical
 * record do not change on a second attempt; a button that implies otherwise
 * just makes a doctor press it three times before calling support.
 */
function isRetryable(code: ReviewErrorCode | undefined): boolean {
  return code === "CONSULTATION_LOAD_FAILED" || code === undefined;
}

export function DoctorReviewClient({
  assessmentId,
  shareToken,
  initialData = null,
  initialError = null,
}: {
  assessmentId: string;
  shareToken?: string;
  /**
   * The review, already resolved on the server. See page.tsx: with it, the
   * case is in the server-rendered HTML instead of arriving one round trip
   * after hydration.
   */
  initialData?: ReviewPayload | null;
  /** A server-side failure, so the error state also renders without a fetch. */
  initialError?: ReviewPayloadError | null;
}) {
  // ── Review data (CORE) ────────────────────────────────────────────────────
  const [consultation, setConsultation] = useState<Consultation | null>(
    initialData?.consultation ?? null,
  );
  const [meta, setMeta] = useState<ConsultationMeta | null>(initialData?.meta ?? null);
  const [error, setError] = useState<CoreLoadError | null>(
    initialError
      ? {
          code: initialError.error,
          message: initialError.message,
          requestId: initialError.requestId,
          retryable: isRetryable(initialError.error),
        }
      : null,
  );
  // Explicit domain state rather than a set of independent booleans: "loading"
  // and "core_error" are mutually exclusive, and modelling them as two flags
  // is what allowed an error screen and a skeleton to both be reachable.
  const [loadState, setLoadState] = useState<ReviewLoadState>(
    initialData ? "ready" : initialError ? "core_error" : "loading",
  );
  /** Internal codes from the API describing thin/incomplete stored data. */
  const [coreDegradedReasons, setCoreDegradedReasons] = useState<string[]>(
    initialData?.core?.degradedReasons ?? [],
  );

  // ── Optional context — a null here costs a chip, never the review ────────
  const [operational, setOperational] =
    useState<ConsultationOperationalState | null>(initialData?.operational ?? null);
  const [visit, setVisit] = useState<ReviewVisitContext | null>(
    initialData?.visit ?? null,
  );

  // ── Decision lifecycle ────────────────────────────────────────────────────
  //
  // One domain state, not four booleans. `approved` is NOT stored here — it is
  // a fact about the loaded consultation, so it is derived below. Storing it
  // as well would let the button and the record disagree after a reload.
  const [decision, setDecision] = useState<DecisionState>("idle");
  const [decisionError, setDecisionError] = useState<string | null>(null);
  /** The reason the readiness gate blocked, when it did. */
  const [readinessBlock, setReadinessBlock] =
    useState<ReadinessBlockDetail | null>(null);

  // ── Protocol editing ──────────────────────────────────────────────────────
  /** Staged, unsaved kit edits. Guards approval — see DecisionBar. */
  const [lineupDirty, setLineupDirty] = useState(false);
  /**
   * Whether the doctor has opened the lineup for adjustment.
   *
   * Closed by default — see ProtocolSection. Staged edits hold it open:
   * closing under an unsaved change would hide the reason approval is blocked.
   */
  const [adjustOpen, setAdjustOpen] = useState(false);

  // ── Notes / feedback (clinical supporting actions) ────────────────────────
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // ── Optional report state ─────────────────────────────────────────────────
  const [retryingReport, setRetryingReport] = useState(false);

  // ── Next patient handoff ──────────────────────────────────────────────────
  //
  // Fetched after a decision lands, never on page load: a doctor reading a case
  // does not need to know who is behind them, and asking before it matters puts
  // a query on every review open for a link most of them never click.
  const [nextPatient, setNextPatient] = useState<NextPatient | null>(null);
  const [nextResolved, setNextResolved] = useState(false);
  /**
   * The lookup itself failed. Kept apart from `nextPatient === null`, which
   * means the queue is genuinely empty: telling a doctor "all caught up" on the
   * strength of a dropped request sends them home with patients waiting.
   */
  const [nextLookupFailed, setNextLookupFailed] = useState(false);

  const resolveNextPatient = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/doctor/queue/next?exclude=${encodeURIComponent(assessmentId)}`,
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNextLookupFailed(true);
        return;
      }
      setNextPatient(j.next ? (j.next as NextPatient) : null);
      setNextResolved(true);
    } catch {
      setNextLookupFailed(true);
    }
  }, [assessmentId]);

  const load = useCallback(async () => {
    setLoadState("loading");
    try {
      const res = await fetch(`/api/consultation/${assessmentId}`, {
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as Partial<ReviewResponse> & {
        error?: string;
        message?: string;
        requestId?: string;
      };

      if (!res.ok) {
        // Every failure from this route carries a code, doctor-readable copy,
        // and a reference. Previously all five status classes collapsed into
        // one sentence, so an expired session, another clinic's patient and a
        // genuine outage were indistinguishable to the doctor and to whoever
        // they called about it.
        setError({
          code: (body.error as ReviewErrorCode) ?? "CONSULTATION_LOAD_FAILED",
          message: body.message ?? FALLBACK_ERROR_MESSAGE,
          requestId: body.requestId ?? null,
          retryable: isRetryable(body.error as ReviewErrorCode | undefined),
        });
        setLoadState("core_error");
        return;
      }

      setConsultation(body.consultation as Consultation);
      setMeta(body.meta as ConsultationMeta);
      setOperational(body.operational ?? null);
      setCoreDegradedReasons(body.core?.degradedReasons ?? []);
      setVisit(body.visit ?? null);
      setError(null);
      setLoadState("ready");
    } catch (err) {
      // Network-level failure: no response at all, so there is no server
      // reference to show.
      console.error("[doctor-review] load failed", err);
      setError({
        code: "CONSULTATION_LOAD_FAILED",
        message: "We couldn't reach the server. Check your connection and retry.",
        requestId: null,
        retryable: true,
      });
      setLoadState("core_error");
    }
  }, [assessmentId]);

  // The server already resolved this review (see page.tsx), so the first
  // render is the finished case and there is nothing to fetch. Re-running the
  // mount fetch would spend a round trip re-fetching bytes already on screen.
  const needsClientLoad = useRef(!initialData && !initialError);

  useEffect(() => {
    if (!needsClientLoad.current) return;
    needsClientLoad.current = false;
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

  /**
   * Approve, and create the kit order.
   *
   * Transaction order is unchanged and deliberate:
   *   doctor's final lineup (already saved) → approve+order (one server call,
   *   which persists the decision and its audit event) → UI confirms → the
   *   handoff lookup runs.
   *
   * The next-patient lookup is fired only after the decision has landed, and is
   * not awaited: the approved state must paint immediately. Report delivery and
   * WhatsApp are NOT part of this call — a messaging failure must never undo an
   * approved clinical decision.
   */
  const approveAndCreateOrder = useCallback(
    async (readinessOverrideReason?: string) => {
      if (!meta) return;
      setDecision("saving");
      setDecisionError(null);
      try {
        const res = await fetch(`/api/consultation/${assessmentId}/order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedContentVersion: meta.contentVersion,
            notes: note.trim() || undefined,
            readinessOverrideReason: readinessOverrideReason || undefined,
          }),
        });
        const j = await res.json().catch(() => ({}));

        if (res.ok) {
          toast.success(
            j.order?.created
              ? "Approved · kit order created"
              : "Approved · kit order already existed",
          );
          setNote("");
          setReadinessBlock(null);
          setDecision("approved");
          await load();
          void resolveNextPatient();
          return;
        }

        if (res.status === 409) {
          // A genuine conflict: someone advanced the version while this doctor
          // was reviewing. Re-reading is the only safe move, so this is the one
          // failure that reloads.
          toast.error(
            "This consultation changed while you were reviewing. Reload before approving.",
          );
          setDecision("idle");
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
          setDecision("idle");
          if (overridable && !readinessOverrideReason) {
            setReadinessBlock(detail);
            return;
          }
          toast.error(j.message ?? "Approval blocked by clinical readiness gate");
          return;
        }

        // Everything else: hold the doctor's work exactly as it is and offer a
        // retry. No reload, so staged edits, notes and scroll position survive.
        setDecisionError(j.message ?? "We couldn't save this decision.");
        setDecision("error");
      } catch {
        setDecisionError(
          "We couldn't reach the server to save this decision.",
        );
        setDecision("error");
      }
    },
    [assessmentId, meta, note, load, resolveNextPatient],
  );

  const submitNeedsRevision = useCallback(
    async (reason: RevisionReason, reasonNote: string) => {
      if (!meta) return;
      const res = await fetch(`/api/consultation/${assessmentId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "NEEDS_REVISION",
          revisionReason: reason,
          notes: reasonNote,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.message ?? "Could not submit revision request");
        return;
      }
      toast.success("Marked as needing revision");
      setRevisionOpen(false);
      await load();
      // Needs-revision is a decision too: this case leaves the queue and the
      // doctor should be handed the next one, exactly as after an approval.
      void resolveNextPatient();
    },
    [assessmentId, meta, load, resolveNextPatient],
  );

  const retryReport = useCallback(async () => {
    setRetryingReport(true);
    try {
      const res = await fetch(`/api/consultation/${assessmentId}/report/retry`, {
        method: "POST",
      });
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
      const res = await fetch(`/api/consultation/${assessmentId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verdict: payload.verdict,
          issueType: payload.issueType,
          severity: payload.severity,
          clinicalRationale: payload.rationale ?? "",
        }),
      });
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
  const revisionRequested =
    meta?.approvalStatus === "REVISION_REQUESTED" ||
    meta?.approvalStatus === "REJECTED";

  // Derived, not stored: an in-flight save or a failed one wins, otherwise the
  // loaded record decides. This is what keeps the bar honest after a reload.
  const decisionState: DecisionState =
    decision === "saving" || decision === "error"
      ? decision
      : isApproved
        ? "approved"
        : "idle";

  const safetyFlags = useMemo(
    () => (consultation ? extractSafetyFlags(consultation) : []),
    [consultation],
  );

  const protocolSummary = useMemo(
    () =>
      consultation
        ? summarizeProtocol(consultation.treatmentPlan.kitPhases)
        : { count: 0, addedByDoctor: 0, doctorAdjusted: false },
    [consultation],
  );

  if (loadState === "core_error" && error) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-6 dark:border-rose-900/50 dark:bg-rose-950/30"
        >
          <p className="text-sm font-medium text-rose-900 dark:text-rose-100">
            {error.message}
          </p>
          {error.requestId && (
            // The one thing that turns "the page broke" into a log line
            // somebody can actually find.
            <p className="mt-3 text-xs text-rose-800/80 dark:text-rose-200/70">
              Reference:{" "}
              <code className="font-mono font-medium">{error.requestId}</code>
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {error.retryable && (
              // Re-runs the GET rather than reloading the page: a full reload
              // would discard an unsaved note, and GET is idempotent, so this
              // cannot approve, order, or create a second consultation.
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-900 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 dark:border-rose-800 dark:bg-transparent dark:text-rose-100"
              >
                Retry
              </button>
            )}
            <Link
              href="/doctor/reports"
              className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-900 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 dark:border-rose-800 dark:bg-transparent dark:text-rose-100"
            >
              Back to review queue
            </Link>
          </div>
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

  const { patient } = consultation;
  const clinicName =
    (consultation as Consultation & { branding?: { clinicName?: string } })
      .branding?.clinicName ?? null;

  return (
    // A single readable column. The old layout reserved 360px for a sidebar
    // that has since dissolved into the decision bar and the blocks below;
    // leaving the case squeezed beside empty space would be an artefact of a
    // component that no longer exists. Prose inside each section is separately
    // capped so the lines stay readable at 1440.
    // `data-surface="doctor"` scopes the HairOS Doctor token layer to this
    // tree — see styles/doctor-tokens.css for why the tokens are not global.
    <div data-surface="doctor" className="mx-auto w-full max-w-5xl space-y-7">
      <BackLink />

      {/* 1 · WHO IS THIS PATIENT? ──────────────────────────────────────────── */}
      <ReviewHeader
        patient={patient}
        clinicName={clinicName}
        visit={visit}
        contentVersion={meta.contentVersion}
        statusSlot={
          <>
            <ApprovalBadge status={meta.approvalStatus} />
            <ReportStatePill
              state={operational?.reportState ?? "not_started"}
              onRetry={retryReport}
              retrying={retryingReport}
            />
          </>
        }
      />

      <ErrorBoundary title="Consultation could not be displayed">
        <div className="space-y-8">
          {/* 1 · THE CASE ─────────────────────────────────────────────── */}
          <ClinicalSummarySection consultation={consultation} />

          {/* ATTENTION — renders nothing at all when nothing is wrong. */}
          <ClinicalAttentionSection
            confidence={consultation.confidence}
            readiness={meta.clinicalReadiness ?? null}
            degradedReasons={coreDegradedReasons}
            safety={safetyFlags}
          />

          {/* 2 · THE PLAN ─────────────────────────────────────────────────
              The kit editor is NOT here by default. Most reviews end in
              approval of the protocol as composed, and a permanently open
              reorder/remove panel between the plan and the decision reads as
              work that must be done before approving. "Request changes" on the
              decision bar opens it. */}
          <ProtocolSection
            consultation={consultation}
            assessmentId={assessmentId}
            expectedContentVersion={meta.contentVersion}
            isApproved={isApproved}
            onSaved={async () => {
              toast.success("Kit lineup saved — new version created");
              await load();
            }}
            onConflict={load}
            onDirtyChange={setLineupDirty}
            adjustOpen={adjustOpen}
            onCloseAdjust={lineupDirty ? undefined : () => setAdjustOpen(false)}
            onEscalate={() => setRevisionOpen(true)}
          />

          <hr className="hd-divide-t border-0" />

          {/* Secondary reference. Never required to reach a decision. */}
          <SecondaryDetail
            consultation={consultation}
            contentVersion={meta.contentVersion}
          />

          {/* Clinical supporting actions — notes and engine feedback. These are
              not the decision and are deliberately not in the decision bar. */}
          <DoctorNotesBlock
            note={note}
            onNoteChange={setNote}
            onSave={addNote}
            saving={savingNote}
            notes={consultation.doctorNotes}
            onFlagIssue={() => setFeedbackOpen(true)}
          />

          {/* 8 · WHAT HAPPENS AFTER APPROVAL? ───────────────────────────────
              Report and delivery sit AFTER the clinical decision and are
              plainly separate from it: approving does not message anyone. */}
          {isApproved && (
            <DeliveryBlock
              assessmentId={assessmentId}
              patient={patient}
              clinicName={clinicName}
              shareToken={shareToken}
              operational={operational}
            />
          )}
        </div>
      </ErrorBoundary>

      {/* 7 · WHAT EXACTLY AM I APPROVING? ──────────────────────────────────── */}
      <DecisionBar
        state={decisionState}
        treatmentCount={protocolSummary.count}
        doctorAdditions={protocolSummary.addedByDoctor}
        lineupDirty={lineupDirty}
        revisionRequested={revisionRequested}
        errorMessage={decisionError}
        onApprove={() => approveAndCreateOrder()}
        adjustOpen={adjustOpen}
        onRequestChanges={() => {
          const opening = !adjustOpen;
          setAdjustOpen(opening);
          // Opening a panel the doctor cannot see is the same as not opening
          // it — the editor sits above a sticky decision bar.
          if (opening) {
            requestAnimationFrame(() => {
              document
                .getElementById("adjust-protocol")
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
            });
          }
        }}
        nextResolved={nextResolved}
        nextPatient={nextPatient}
        nextLookupFailed={nextLookupFailed}
      />

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
          submitting={decisionState === "saving"}
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

// ── Doctor notes & feedback ─────────────────────────────────────────────────
//
// Supporting clinical actions, kept apart from the decision itself. Mixing
// "save a note" into the same button group as "approve this treatment plan"
// flattens a clinical commitment into an admin task.

function DoctorNotesBlock({
  note,
  onNoteChange,
  onSave,
  saving,
  notes,
  onFlagIssue,
}: {
  note: string;
  onNoteChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  notes: DoctorNote[];
  onFlagIssue: () => void;
}) {
  // Note timestamps are locale- and time-zone-formatted, so the browser
  // renders them, not the server. Now that this page server-renders, a
  // consultation that already carries notes would otherwise emit the SERVER's
  // reading of the moment — and the server runs in UTC, so a doctor would read
  // a UTC time as their own.
  const hydrated = useHydrated();

  return (
    <section aria-labelledby="notes-heading" className="space-y-3">
      <h2
        id="notes-heading"
        className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500"
      >
        Doctor notes
      </h2>

      <textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="Optional note attached to your decision…"
        rows={3}
        maxLength={2000}
        aria-label="Doctor note"
        className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/15"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-stone-400">{note.length}/2000</span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onFlagIssue}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
          >
            <Flag className="h-3.5 w-3.5" aria-hidden />
            Flag recommendation issue
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || note.trim().length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-stone-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
            {saving ? "Saving…" : "Save note"}
          </button>
        </div>
      </div>

      {notes.length > 0 && (
        <ul className="space-y-2 border-t border-stone-100 pt-3">
          {notes.map((n) => (
            <li key={n.id} className="text-xs text-slate-700">
              <p className="max-w-prose">{n.body}</p>
              <p className="text-[10px] text-stone-400">
                {hydrated ? new Date(n.createdAt).toLocaleString() : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Report & delivery ───────────────────────────────────────────────────────
//
// Downstream operations, and visibly downstream. The clinical decision is
// already saved by the time anything here is reachable, so a failed PDF or an
// unsent WhatsApp cannot retract it.

function DeliveryBlock({
  assessmentId,
  patient,
  clinicName,
  shareToken,
  operational,
}: {
  assessmentId: string;
  patient: Consultation["patient"];
  clinicName: string | null;
  shareToken?: string;
  operational: ConsultationOperationalState | null;
}) {
  // ── Why the origin is read after mount ────────────────────────────────────
  //
  // This was inlined as
  //   `${typeof window !== "undefined" ? window.location.origin : ""}`
  // which is the first cause React lists for a hydration mismatch: the server
  // renders the message with an EMPTY origin and the client with a real one,
  // so the two hrefs disagree and React bails out of patching the tree.
  //
  // It is not merely cosmetic. The server-rendered href read
  // `…confirm your kit order here: /cart/<id>` — a bare relative path. A
  // doctor clicking before hydration would have sent a PATIENT a WhatsApp
  // message containing a link that goes nowhere.
  //
  // Read from the browser rather than NEXT_PUBLIC_APP_URL, matching
  // ClinicQrPanel: a stale or unset env var would put a host that does not
  // serve this clinic into a message sent to a real patient.
  const hydrated = useHydrated();
  const cartUrl = hydrated
    ? `${window.location.origin}/cart/${assessmentId}`
    : null;

  return (
    <section aria-labelledby="delivery-heading" className="space-y-3">
      <h2
        id="delivery-heading"
        className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500"
      >
        Report &amp; delivery
      </h2>

      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <ReportActions
          assessmentId={assessmentId}
          patientName={patient.name}
          clinicName={clinicName}
          patientWhatsapp={patient.phone ?? null}
          shareToken={shareToken}
          enabled
        />

        {operational?.orderIntentId && (
          <div className="mt-3 space-y-2 border-t border-stone-100 pt-3">
            <p className="text-[11px] text-stone-600">
              Order intent {operational.orderIntentId.slice(-8)} ·{" "}
              {operational.orderIntentStatus ?? "READY_FOR_FULFILMENT"}
            </p>
            <div className="flex flex-wrap gap-2">
              {/* Rendered only once the origin is known. A send button that
                  composes a broken link is worse than one briefly absent. */}
              {patient.phone && cartUrl && (
                <a
                  href={`https://wa.me/${patient.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                    `Hi ${patient.name?.split(" ")[0] ?? ""}, your Dr FACT plan is ready. Review and confirm your kit order here: ${cartUrl}`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                  Send cart to patient (WhatsApp)
                </a>
              )}
              <a
                href={`/cart/${assessmentId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-stone-50"
              >
                Preview patient cart
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
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
    <ModalShell onDismiss={onCancel} labelledBy="readiness-title">
      <div className="border-b border-stone-200 p-5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-600" aria-hidden />
          <h2 id="readiness-title" className="font-serif text-lg text-slate-900">
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
      <div className="space-y-3 p-5">
        {detail.reasoningGaps && detail.reasoningGaps.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
              What the gate flagged
            </p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-amber-900">
              {detail.reasoningGaps.slice(0, 5).map((g, i) => (
                <li key={i}>{g.summary ?? g.subject ?? "Unspecified gap"}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Alternative to overriding: flag it for revision instead of signing
            off. Records the reason and holds the consultation. */}
        <div className="flex items-start justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
          <div>
            <p className="text-xs font-medium text-slate-800">
              Prefer not to sign off?
            </p>
            <p className="mt-0.5 text-[11px] text-stone-600">
              Flag it for revision instead — records your reason and holds the
              consultation rather than approving it.
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
          <label
            htmlFor="readiness-reason"
            className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500"
          >
            Clinical justification (required)
          </label>
          <textarea
            id="readiness-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Narrative wording is incomplete but the kit plan and clinical reasoning are correct for this presentation; I take clinical responsibility for this report."
            rows={4}
            maxLength={2000}
            className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/15"
          />
          <p className="mt-1 text-[11px] text-stone-400">
            Recorded against your name on the approval and the kit order.
            Minimum {MIN_OVERRIDE_REASON} characters.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-stone-200 p-4">
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
    </ModalShell>
  );
}

// ── Modals / drawers ────────────────────────────────────────────────────────

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Shared modal chrome.
 *
 * Esc dismisses — the one keyboard behaviour these dialogs owe the user. There
 * is deliberately no Enter-to-submit: every dialog here commits something
 * clinical, and a stray Return in a textarea must not sign anything off.
 *
 * ── Why the focus trap is not optional here ────────────────────────────────
 * `aria-modal="true"` tells a screen reader the rest of the page is inert. If
 * Tab can still walk out of the dialog into the case behind it, that promise is
 * a lie: the doctor keeps tabbing, hears nothing, and can land on "Approve
 * treatment" while a revision dialog they believe is still open sits on top of
 * it. So focus enters the dialog on open, cycles inside it, and returns to the
 * control that opened it on close.
 */
function ModalShell({
  children,
  onDismiss,
  labelledBy,
}: {
  children: React.ReactNode;
  onDismiss: () => void;
  labelledBy: string;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Remember who opened this so focus can go home afterwards.
    const opener = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;

    // Move focus in. The dialog itself is the fallback when it holds no
    // focusable control yet.
    const first = dialog?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialog)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;

      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
        // A hidden control is still matched by the selector but cannot hold
        // focus; cycling onto it would look like the trap had failed.
        .filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) return;

      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === firstItem || active === dialog)) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && active === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // Only restore if the opener is still in the document — after an
      // approval the button that opened the dialog may have been unmounted.
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl focus:outline-none"
      >
        {children}
      </div>
    </div>
  );
}

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
    <ModalShell onDismiss={onCancel} labelledBy="revision-title">
      <div className="border-b border-stone-200 p-5">
        <h2 id="revision-title" className="font-serif text-lg text-slate-900">
          Needs revision
        </h2>
        <p className="mt-1 text-xs text-stone-500">
          Consultation stays reviewable. Pick the reason and add a note for the
          record.
        </p>
      </div>
      <div className="space-y-3 p-5">
        <div>
          <label
            htmlFor="revision-reason"
            className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500"
          >
            Reason
          </label>
          <select
            id="revision-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value as RevisionReason)}
            className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-slate-800"
          >
            {(Object.keys(REVISION_REASON_LABELS) as RevisionReason[]).map((r) => (
              <option key={r} value={r}>
                {REVISION_REASON_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="revision-note"
            className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500"
          >
            Note (required)
          </label>
          {REVISION_NOTE_TEMPLATES[reason].length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {REVISION_NOTE_TEMPLATES[reason].map((tpl) => (
                <button
                  key={tpl}
                  type="button"
                  onClick={() => setNote(tpl)}
                  className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-[11px] text-slate-700 transition-colors hover:border-stone-400 hover:bg-white"
                >
                  {tpl.length > 44 ? tpl.slice(0, 42) + "…" : tpl}
                </button>
              ))}
            </div>
          )}
          <textarea
            id="revision-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What needs revising and why…"
            rows={4}
            maxLength={2000}
            className="mt-2 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-slate-800"
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-stone-200 p-4">
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
    </ModalShell>
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
    <ModalShell onDismiss={onClose} labelledBy="feedback-title">
      <div className="border-b border-stone-200 p-5">
        <h2 id="feedback-title" className="font-serif text-lg text-slate-900">
          Flag recommendation issue
        </h2>
        <p className="mt-1 text-xs text-stone-500">
          Structured feedback pinned to this version. Does not change the
          recommendation.
        </p>
      </div>
      <div className="space-y-3 p-5">
        <FieldRow label="Verdict" htmlFor="fb-verdict">
          <select
            id="fb-verdict"
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
        <FieldRow label="Issue" htmlFor="fb-issue">
          <select
            id="fb-issue"
            value={issueType}
            onChange={(e) => setIssueType(e.target.value as FeedbackIssue)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          >
            {(Object.keys(FEEDBACK_ISSUE_LABELS) as FeedbackIssue[]).map((i) => (
              <option key={i} value={i}>
                {FEEDBACK_ISSUE_LABELS[i]}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Severity" htmlFor="fb-severity">
          <select
            id="fb-severity"
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
          htmlFor="fb-rationale"
          label={
            rationaleRequired
              ? "Clinical rationale (required)"
              : "Clinical rationale (optional)"
          }
        >
          <textarea
            id="fb-rationale"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="What would you have recommended and why…"
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
        </FieldRow>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-stone-200 p-4">
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
    </ModalShell>
  );
}

// ── Small presentation helpers ──────────────────────────────────────────────

function FieldRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500"
      >
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
  const palette: Record<ConsultationOperationalState["reportState"], string> = {
    not_started: "bg-stone-100 text-stone-600 border-stone-200",
    generating: "bg-sky-50 text-sky-700 border-sky-200",
    ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
    failed: "bg-rose-50 text-rose-700 border-rose-200",
    // Muted, not alarming: the report may well be fine — we could not read its
    // state. This is the visible half of the CORE/OPTIONAL split; it used to
    // be a 500 for the whole consultation.
    unavailable: "bg-stone-100 text-stone-500 border-stone-200",
  };
  const label: Record<ConsultationOperationalState["reportState"], string> = {
    not_started: "Report: not started",
    generating: "Report: generating",
    ready: "Report: ready",
    failed: "Report: failed",
    unavailable: "Report status unavailable",
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

/**
 * Back to the Doctor Action Center — `/doctor`, not `/doctor/reports`.
 *
 * The dashboard is where a session starts and where "who needs me next" is
 * answered; the review queue is one list inside it. Landing a doctor on the
 * queue drops them a level below the screen they navigated from.
 */
function BackLink() {
  return (
    <Link
      href="/doctor"
      className="hd-label inline-flex items-center gap-1.5 hover:underline"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden /> Back to dashboard
    </Link>
  );
}

function SkeletonReview() {
  return (
    <div className="mx-auto w-full max-w-4xl animate-pulse space-y-6">
      <div className="h-32 rounded-2xl border border-stone-200 bg-white" />
      <div className="h-64 rounded-2xl border border-stone-200 bg-white" />
      <div className="h-80 rounded-2xl border border-stone-200 bg-white" />
    </div>
  );
}

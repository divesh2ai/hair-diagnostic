"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  Loader2,
  MessageCircle,
  MessageSquareWarning,
  RotateCcw,
  ShoppingCart,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react";
import { reviewHref } from "@/lib/doctor/reviewHref";
import { decisionGate } from "@/lib/doctor/decisionGate";

export type WhatsappSendUiState =
  | "idle"
  | "sending"
  | "sent"
  | "already_sent"
  | "test_transport"
  | "failed"
  | "configuration_error"
  | "no_consent"
  | "no_phone";

/**
 * Map a successful `/share` response to the UI state that decides what the
 * doctor sees. `live` gates FIRST, before `alreadySent`: a dev-transport
 * duplicate must still read as "nothing was actually sent" — it is not a
 * real delivery just because it repeats one. Only a genuinely live duplicate
 * gets "already sent". This is the one place `dev_accepted` is turned into
 * copy, so it is the one place that must never let a test send read as a
 * real one — see WhatsappOutcomeLine below for the copy itself.
 */
export function resolveWhatsappSendUiState(result: {
  live: boolean;
  alreadySent: boolean;
}): Extract<WhatsappSendUiState, "sent" | "already_sent" | "test_transport"> {
  if (!result.live) return "test_transport";
  return result.alreadySent ? "already_sent" : "sent";
}

// WHAT EXACTLY AM I APPROVING? — and, afterwards, did it save?
//
// ── Why the decision left the sidebar ──────────────────────────────────────
// Approval used to be a button in a column beside the case, with no statement
// of what it would act on. The doctor read the clinical story in one place and
// committed to it in another, which is how a plan gets approved without its
// last edit. Here the commit sits under the case, always visible, and always
// states the lineup it is about to send.
//
// ── The unsaved-lineup guard ───────────────────────────────────────────────
// Approval is a server-side snapshot of the SAVED consultation: it posts an
// expected content version and the API cuts the kit order from stored state.
// A doctor with staged, unsaved kit edits who pressed Approve would therefore
// approve the PREVIOUS lineup and get no warning at all. So a dirty lineup
// blocks approval and says why. This is the one place the bar refuses a
// click, and it refuses in the safe direction.
//
// ── Deliberate, never accidental ───────────────────────────────────────────
// Native buttons only. There is no Enter-to-approve, no access key and no
// keyboard shortcut anywhere in this component: a clinical decision must cost
// a deliberate click on a named control. Tab / Shift-Tab / Enter-on-focus and
// Esc-on-modal are the whole keyboard contract, and they come from the
// platform rather than from a handler we wrote.
//
// ── Sticky, but not looming ────────────────────────────────────────────────
// `sticky bottom-0` from `sm` up: it rides the bottom of the viewport while
// the case scrolls and comes to rest at the end of the document. On phones it
// is static — a fixed bar on a 390×844 screen eats the content it is meant to
// support. z-30 keeps it under the modals (z-40) and toasts it must not cover.

export type DecisionState = "idle" | "saving" | "approved" | "error";

export interface DecisionBarNextPatient {
  id: string;
  patientName: string;
  concern: string | null;
}

export interface DecisionBarProps {
  state: DecisionState;
  /** Interventions in the saved lineup — what approval will act on. */
  treatmentCount: number;
  /** Kits added by the doctor. Only provable modifications are counted. */
  doctorAdditions: number;
  /** Staged, unsaved lineup edits. Blocks approval — see header. */
  lineupDirty: boolean;
  /** Terminal state distinct from approval. */
  revisionRequested: boolean;
  errorMessage: string | null;
  onApprove: () => void;
  /**
   * Open the doctor's own adjustment controls on the protocol above.
   *
   * Distinct from `onNeedsRevision`, and the distinction is the point:
   * "Request changes" is the doctor changing the plan themselves, which they
   * have the authority to do; "Needs revision" hands the case back for
   * regeneration. Only the second leaves the doctor's hands, so only the
   * second is a decision.
   */
  onRequestChanges: () => void;
  /** True while the panel is open, so the control reads as a toggle. */
  adjustOpen: boolean;
  /** Whether the next-patient lookup has answered. */
  nextResolved: boolean;
  /** Null with `nextResolved` true means the queue really is empty. */
  nextPatient: DecisionBarNextPatient | null;
  /** True when the handoff lookup itself failed — never claim an empty queue. */
  nextLookupFailed: boolean;
  /**
   * The patient's cart, once an order exists for it.
   *
   * Null before approval — there is no order to look at — and null afterwards
   * if no order intent was recorded, in which case no link is shown rather
   * than one that lands on "no confirmed plan yet".
   *
   * It appears here because the block that owns it sits at 91% of the page
   * height: measured, a doctor who has just approved has to scroll past the
   * whole case to reach the one screen that shows what the patient will be
   * charged for. This bar is already pinned in front of them.
   */
  cartHref?: string | null;

  // ── Automated WhatsApp delivery (launch-mode switch) ───────────────────
  //
  // `false` (the default) reproduces this bar's pre-existing behaviour
  // exactly: primary button reads "Approve treatment", no consent line, no
  // WhatsApp outcome. `true` is the fully-verified production configuration
  // — see WHATSAPP_AUTOMATION_ENABLED.
  whatsappAutomationEnabled?: boolean;
  /** Resolved server-side. Null only if it could not be read at all (shown as neither ✓ nor "not provided"). */
  consent?: { consent: boolean; provisioned: boolean } | null;
  /** Last 4 digits only — see DoctorReviewClient's maskedPatientPhone. */
  patientPhoneMasked?: string | null;
  waState?: WhatsappSendUiState;
  /** Operator-facing reason for `failed` / `configuration_error` — never a raw provider error. */
  waErrorReason?: string | null;
  onRetryWhatsapp?: () => void;
  onShareManually?: () => void;
}

export function DecisionBar({
  state,
  treatmentCount,
  doctorAdditions,
  lineupDirty,
  revisionRequested,
  errorMessage,
  onApprove,
  onRequestChanges,
  adjustOpen,
  nextResolved,
  whatsappAutomationEnabled = false,
  consent = null,
  patientPhoneMasked = null,
  waState = "idle",
  waErrorReason = null,
  onRetryWhatsapp,
  onShareManually,
  nextPatient,
  nextLookupFailed,
  cartHref = null,
}: DecisionBarProps) {
  const terminal = state === "approved" || revisionRequested;
  // The single source of truth for "may this be committed now". See
  // lib/doctor/decisionGate.
  const gate = decisionGate({ state, lineupDirty });

  return (
    <div
      // Spans its own column rather than bleeding past it. The previous
      // `-mx-4 sm:-mx-6` assumed a parent whose horizontal padding the bar
      // could bleed into; where that padding is smaller than the negative
      // margin the bar simply hangs off the edge, and the page scrolls
      // sideways. Measured: 390px viewport scrolled to 406 (+16, the -mx-4)
      // and 1024 to 1048 (+24, the sm:-mx-6), while 1366 and 1440 were clean
      // because the capped content column left slack for the bleed to land in.
      //
      // Dropping the bleed also drops the padding that only existed to cancel
      // it, so the divider now aligns with the case content above it — which is
      // what the bar is a decision about.
      // `hd-decision-bar` carries the translucent porcelain ground — see the
      // token layer for why this bar may not be pure white.
      className="hd-decision-bar sticky bottom-0 z-30 mt-2 border-t border-stone-200 py-3 backdrop-blur"
      // Announced politely: the doctor is told the decision saved without
      // having their focus stolen mid-action.
      role="region"
      aria-label="Clinical decision"
    >
      {state === "error" && (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5"
        >
          <p className="flex items-start gap-2 text-sm font-medium text-rose-900">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              {errorMessage ?? "We couldn't save this decision."}
              {/* The reassurance that stops a doctor re-entering their work. */}
              <span className="mt-0.5 block font-normal text-rose-800">
                Your treatment changes have been preserved.
              </span>
            </span>
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        {/* LEFT — what this decision covers, or what it became. */}
        <div className="min-w-0">
          {terminal ? (
            <>
              <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                {state === "approved" ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-600" aria-hidden />
                    {/* "Report Approved" only under the WhatsApp-automated
                        copy (spec's own mockups use it alongside the send
                        outcome) — manual-launch mode keeps its original
                        label unchanged, on purpose: nothing about that path
                        should read or behave differently than it did before
                        this feature existed. */}
                    {whatsappAutomationEnabled ? "Report Approved" : "Treatment approved"}
                    <span className="font-normal text-stone-500">
                      · Clinical decision saved
                    </span>
                  </>
                ) : (
                  <>
                    <MessageSquareWarning
                      className="h-4 w-4 text-amber-600"
                      aria-hidden
                    />
                    Marked as needing revision
                  </>
                )}
              </p>
              {state === "approved" && whatsappAutomationEnabled && (
                <WhatsappOutcomeLine
                  waState={waState}
                  waErrorReason={waErrorReason}
                  onRetryWhatsapp={onRetryWhatsapp}
                  onShareManually={onShareManually}
                />
              )}
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-900">
                {treatmentCount === 0
                  ? "No treatments selected"
                  : `${treatmentCount} treatment${treatmentCount === 1 ? "" : "s"} selected`}
                {doctorAdditions > 0 && (
                  <span className="font-normal text-stone-500">
                    {" · "}
                    {doctorAdditions} doctor modification
                    {doctorAdditions === 1 ? "" : "s"}
                  </span>
                )}
              </p>
              {/* The refusal always carries its reason — the bar cannot
                  disable approval without telling the doctor why. */}
              {gate.blockedReason && (
                <p className="mt-0.5 text-xs font-medium text-amber-800">
                  {gate.blockedReason}
                </p>
              )}
              {/* Consent + destination, shown BEFORE the decision only when
                  automation is on — this is what "Approve & Send Report" is
                  about to act on, and a doctor should see it before pressing
                  a button that names sending in its own label. */}
              {whatsappAutomationEnabled && (
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-500">
                  {consent?.consent ? (
                    <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                      <Check className="h-3 w-3" aria-hidden />
                      WhatsApp consent
                    </span>
                  ) : (
                    <span className="font-medium text-amber-800">
                      WhatsApp consent: Not provided
                    </span>
                  )}
                  {patientPhoneMasked && (
                    <span>
                      · Patient: <span className="tabular-nums">{patientPhoneMasked}</span>
                    </span>
                  )}
                </p>
              )}
            </>
          )}
        </div>

        {/* RIGHT — the decision, or the handoff once it is made. */}
        <div className="flex flex-wrap items-center gap-2">
          {terminal ? (
            <>
              {/* ORDER READY — a status, not a control.
                  Renders only alongside a real persisted order, so it states
                  a fact the server confirmed rather than an optimistic one.
                  It takes the saved-status token the surface already uses for
                  "done" (hd-pill-success), which is the one sanctioned green:
                  a decision was saved. Kept as a pill so the row reads
                  status → verify → move on, and no second badge or banner is
                  introduced. */}
              {cartHref && (
                <span className="hd-pill hd-pill-success">Order ready</span>
              )}
              {/* Secondary, and deliberately to the LEFT of the handoff: it
                  belongs to the case just decided, whereas Next patient
                  leaves it. Checking the order should not have to beat "move
                  on" for attention, but it must not outrank it either. */}
              {cartHref && (
                <a
                  href={cartHref}
                  target="_blank"
                  rel="noreferrer"
                  className="hd-btn hd-btn-secondary"
                >
                  <ShoppingCart className="h-4 w-4" aria-hidden />
                  Preview cart
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              )}
              {nextResolved && nextPatient && (
                <Link
                  href={reviewHref({
                    id: nextPatient.id,
                    concern: nextPatient.concern,
                  })}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  Next patient
                  <span className="hidden font-normal opacity-75 sm:inline">
                    · {nextPatient.patientName}
                  </span>
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              )}
              {nextResolved && !nextPatient && (
                <span className="text-sm text-stone-600">
                  All caught up —{" "}
                  <Link
                    href="/doctor"
                    className="font-medium text-slate-800 underline underline-offset-2"
                  >
                    back to dashboard
                  </Link>
                </span>
              )}
              {/* A dropped lookup must never be reported as an empty queue. */}
              {nextLookupFailed && (
                <span className="text-sm text-stone-500">
                  Next patient unavailable —{" "}
                  <Link
                    href="/doctor/reports"
                    className="font-medium text-slate-800 underline underline-offset-2"
                  >
                    open the queue
                  </Link>
                </span>
              )}
            </>
          ) : (
            <>
              {/* The doctor's own authority over the plan. NOT a decision —
                  it opens the editor above, and nothing is recorded until they
                  save a lineup or approve. This is the answer to "what do I
                  press if I disagree", which is why it sits beside Approve
                  rather than being discoverable somewhere in the protocol. */}
              {/* Exactly two controls, and their weights say which is which:
                  a bordered secondary to change the plan, one filled primary
                  to accept it. "Needs revision" — handing the case back for
                  regeneration — is NOT here; it lives inside the adjustment
                  panel, because reaching for it is an escalation from having
                  tried to adjust. Three same-weight buttons on a decision bar
                  is what makes a doctor stop and work out which one they
                  want. */}
              <button
                type="button"
                onClick={onRequestChanges}
                aria-expanded={adjustOpen}
                aria-controls="adjust-protocol"
                disabled={state === "saving"}
                className="hd-btn hd-btn-secondary"
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden />
                {adjustOpen ? "Hide changes" : "Request changes"}
              </button>

              <button
                type="button"
                onClick={onApprove}
                // Disabled while saving so a second click cannot submit a
                // duplicate decision, and while the lineup is dirty so the
                // doctor cannot approve a lineup they have already changed.
                disabled={!gate.canApprove}
                aria-describedby={
                  gate.blockedReason ? "decision-dirty-hint" : undefined
                }
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
              >
                {state === "saving" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    {whatsappAutomationEnabled ? "Approving report…" : "Saving decision…"}
                  </>
                ) : state === "error" ? (
                  <>
                    <ClipboardCheck className="h-4 w-4" aria-hidden />
                    Retry approval
                  </>
                ) : (
                  <>
                    <ClipboardCheck className="h-4 w-4" aria-hidden />
                    {whatsappAutomationEnabled ? "Approve & Send Report" : "Approve treatment"}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {gate.blockedReason && !terminal && (
        <p id="decision-dirty-hint" className="sr-only">
          {gate.blockedReason}
        </p>
      )}
    </div>
  );
}

/**
 * What happened to the WhatsApp send, under "Report Approved ✓".
 *
 * Never shown when `waState === "idle"` — that covers both "still sending on
 * the very first paint" (a flash of nothing beats a flash of a wrong state)
 * and "this consultation was approved before automation existed", neither of
 * which has an outcome to report yet.
 */
function WhatsappOutcomeLine({
  waState,
  waErrorReason,
  onRetryWhatsapp,
  onShareManually,
}: {
  waState: WhatsappSendUiState;
  waErrorReason: string | null;
  onRetryWhatsapp?: () => void;
  onShareManually?: () => void;
}) {
  if (waState === "idle") return null;

  if (waState === "sending") {
    return (
      <p className="mt-1 flex items-center gap-1.5 text-xs text-stone-500">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Sending report on WhatsApp…
      </p>
    );
  }

  if (waState === "sent" || waState === "already_sent") {
    return (
      <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
        <Check className="h-3 w-3" aria-hidden />
        {waState === "already_sent" ? "WhatsApp already sent" : "WhatsApp Sent"}
      </p>
    );
  }

  if (waState === "test_transport") {
    return (
      <p className="mt-1 text-xs text-stone-500">
        WhatsApp recorded — test transport, nothing was actually sent.
      </p>
    );
  }

  // failed / configuration_error / no_consent / no_phone — every remaining
  // state means the patient did NOT receive a message, so every one of them
  // offers Share Manually. Only genuinely retryable failures also offer
  // Retry — see the header note on why CONFIGURATION_ERROR and
  // BLOCKED_NO_CONSENT never do.
  const label =
    waState === "no_consent"
      ? "WhatsApp not sent — patient has not provided WhatsApp consent."
      : waState === "no_phone"
        ? "WhatsApp not sent — no phone number on file."
        : waState === "configuration_error"
          ? (waErrorReason ?? "WhatsApp is not configured yet.")
          : "WhatsApp delivery failed.";
  const canRetry = waState === "failed";

  return (
    <div className="mt-1.5 space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
        <TriangleAlert className="h-3 w-3 shrink-0" aria-hidden />
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {canRetry && onRetryWhatsapp && (
          <button
            type="button"
            onClick={onRetryWhatsapp}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-stone-50"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            Retry WhatsApp
          </button>
        )}
        {onShareManually && (
          <button
            type="button"
            onClick={onShareManually}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-stone-50"
          >
            <MessageCircle className="h-3 w-3" aria-hidden />
            Share Manually
          </button>
        )}
      </div>
    </div>
  );
}

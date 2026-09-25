"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  Loader2,
  MessageCircle,
  MessageSquareWarning,
  RefreshCw,
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

// THE TREATMENT PLAN RAIL — what exactly am I approving, and did it save?
//
// ── Why the decision is a rail, not a bar ───────────────────────────────────
// The V3 review is a 70/30 clinical workspace: the case and the plan read down
// the left, the decision lives in a sticky rail on the right. A doctor reads
// the story and commits to it without the plan ever leaving the screen, and the
// rail always states the lineup the approval will act on — the same guard the
// old bottom bar carried, now beside the plan rather than under it.
//
// ── One component, two shapes ───────────────────────────────────────────────
// From `lg` up this is the sticky right rail. Below `lg` the workspace is a
// single column and the rail's detail would just repeat the plan already on
// screen, so it collapses to a compact bar fixed at the bottom of the viewport
// carrying only the count and the primary decision. Both shapes share every
// handler and the same gate, so they can never disagree about whether approval
// is allowed.
//
// ── The unsaved-lineup guard ───────────────────────────────────────────────
// Approval is a server-side snapshot of the SAVED consultation. Inline Replace
// and Remove persist immediately, so they never leave the plan dirty; only the
// advanced reorder/add editor stages edits, and a dirty lineup there blocks
// approval and says why. See lib/doctor/decisionGate.
//
// ── Deliberate, never accidental ───────────────────────────────────────────
// Native buttons only. No Enter-to-approve, no access key: a clinical decision
// costs a deliberate click on a named control.

export type DecisionState = "idle" | "saving" | "approved" | "error";

export interface DecisionBarNextPatient {
  id: string;
  patientName: string;
  concern: string | null;
}

/** One line in the rail's checklist. `changed` marks a doctor modification. */
export interface RailTreatment {
  name: string;
  changed: "added" | "substituted" | null;
}

export interface DecisionBarProps {
  state: DecisionState;
  /** Interventions in the saved lineup — what approval will act on. */
  treatmentCount: number;
  /** Kits added by the doctor. Only provable modifications are counted. */
  doctorAdditions: number;
  /** Governed substitutions applied to the saved lineup. Provable from meta. */
  substitutionCount: number;
  /** The saved lineup, in order — the rail's checklist. */
  treatments: RailTreatment[];
  /** Staged, unsaved lineup edits in the advanced editor. Blocks approval. */
  lineupDirty: boolean;
  /** Terminal state distinct from approval. */
  revisionRequested: boolean;
  errorMessage: string | null;
  onApprove: () => void;
  /** Open the advanced reorder/add editor on the plan. NOT a decision. */
  onRequestChanges: () => void;
  /** True while the panel is open, so the control reads as a toggle. */
  adjustOpen: boolean;
  nextResolved: boolean;
  nextPatient: DecisionBarNextPatient | null;
  nextLookupFailed: boolean;
  cartHref?: string | null;

  whatsappAutomationEnabled?: boolean;
  consent?: { consent: boolean; provisioned: boolean } | null;
  patientPhoneMasked?: string | null;
  waState?: WhatsappSendUiState;
  waErrorReason?: string | null;
  onRetryWhatsapp?: () => void;
  onShareManually?: () => void;
}

export function DecisionBar(props: DecisionBarProps) {
  const { state, revisionRequested } = props;
  const terminal = state === "approved" || revisionRequested;
  const gate = decisionGate({ state, lineupDirty: props.lineupDirty });

  return (
    <>
      {/* DESKTOP — the sticky right rail. */}
      <aside
        className="hd-rail hidden lg:block"
        role="region"
        aria-label="Treatment plan and clinical decision"
      >
        <div className="rounded-2xl border border-[color:var(--hd-border)] bg-[color:var(--hd-surface)] shadow-[var(--hd-shadow-lift)]">
          <RailBody {...props} gate={gate} terminal={terminal} />
        </div>
      </aside>

      {/* MOBILE / TABLET — a compact bar fixed to the bottom of the viewport,
          carrying only the count and the primary decision. */}
      <div
        className="hd-decision-bar fixed inset-x-0 bottom-0 z-30 border-t border-[color:var(--hd-border)] px-4 py-3 backdrop-blur lg:hidden"
        role="region"
        aria-label="Clinical decision"
      >
        <MobileBar {...props} gate={gate} terminal={terminal} />
      </div>
    </>
  );
}

// ── The rail body (desktop) ─────────────────────────────────────────────────

function RailBody({
  state,
  treatmentCount,
  doctorAdditions,
  substitutionCount,
  treatments,
  errorMessage,
  onApprove,
  onRequestChanges,
  adjustOpen,
  nextResolved,
  nextPatient,
  nextLookupFailed,
  cartHref = null,
  whatsappAutomationEnabled = false,
  consent = null,
  patientPhoneMasked = null,
  waState = "idle",
  waErrorReason = null,
  onRetryWhatsapp,
  onShareManually,
  gate,
  terminal,
}: DecisionBarProps & {
  gate: ReturnType<typeof decisionGate>;
  terminal: boolean;
}) {
  return (
    <div className="p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="hd-story-title">Treatment plan</h2>
        {!terminal && (
          <span className="text-xs font-medium text-[color:var(--hd-text-secondary)]">
            {treatmentCount} treatment{treatmentCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {/* The checklist — what approval will act on. */}
      {treatments.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {treatments.map((t, i) => (
            <li key={`${t.name}-${i}`} className="flex items-start gap-2 text-sm text-[color:var(--hd-text)]">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--hd-primary)]" aria-hidden />
              <span className="min-w-0">
                {t.name}
                {t.changed === "substituted" && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 align-middle text-[10px] font-medium uppercase tracking-wide text-[color:var(--hd-primary-dark)]">
                    <RefreshCw className="h-2.5 w-2.5" aria-hidden /> swapped
                  </span>
                )}
                {t.changed === "added" && (
                  <span className="ml-1.5 align-middle text-[10px] font-medium uppercase tracking-wide text-[color:var(--hd-primary-dark)]">
                    added
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-lg border border-dashed border-[color:var(--hd-border-strong)] px-3 py-2.5 text-xs text-[color:var(--hd-text-secondary)]">
          No treatments in the plan.
        </p>
      )}

      {/* Changes summary — only what the record can prove. */}
      {(substitutionCount > 0 || doctorAdditions > 0) && (
        <p className="mt-3 border-t border-[color:var(--hd-border)] pt-3 text-xs font-medium text-[color:var(--hd-primary-dark)]">
          {[
            substitutionCount > 0
              ? `${substitutionCount} substitution${substitutionCount === 1 ? "" : "s"} made`
              : null,
            doctorAdditions > 0
              ? `${doctorAdditions} added by doctor`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      {/* WhatsApp consent — shown before the decision only when automation is
          on, since the primary then names sending in its own label. */}
      {!terminal && whatsappAutomationEnabled && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[color:var(--hd-text-muted)]">
          {consent?.consent ? (
            <span className="inline-flex items-center gap-1 font-medium text-[color:var(--hd-success-ink)]">
              <Check className="h-3 w-3" aria-hidden /> WhatsApp consent
            </span>
          ) : (
            <span className="font-medium text-[color:var(--hd-attention)]">
              WhatsApp consent: Not provided
            </span>
          )}
          {patientPhoneMasked && (
            <span>
              · <span className="tabular-nums">{patientPhoneMasked}</span>
            </span>
          )}
        </p>
      )}

      {state === "error" && (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-[color:var(--hd-critical-tint)] bg-[color:var(--hd-critical-tint)] px-3 py-2.5"
        >
          <p className="flex items-start gap-2 text-sm font-medium text-[color:var(--hd-critical-ink)]">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              {errorMessage ?? "We couldn't save this decision."}
              <span className="mt-0.5 block font-normal">
                Your treatment changes have been preserved.
              </span>
            </span>
          </p>
        </div>
      )}

      {/* The refusal always carries its reason. */}
      {!terminal && gate.blockedReason && (
        <p className="mt-3 text-xs font-medium text-[color:var(--hd-attention)]">
          {gate.blockedReason}
        </p>
      )}

      <div className="mt-4 border-t border-[color:var(--hd-border)] pt-4">
        {terminal ? (
          <TerminalActions
            state={state}
            whatsappAutomationEnabled={whatsappAutomationEnabled}
            waState={waState}
            waErrorReason={waErrorReason}
            onRetryWhatsapp={onRetryWhatsapp}
            onShareManually={onShareManually}
            cartHref={cartHref}
            nextResolved={nextResolved}
            nextPatient={nextPatient}
            nextLookupFailed={nextLookupFailed}
            layout="rail"
          />
        ) : (
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={onApprove}
              disabled={!gate.canApprove}
              aria-describedby={gate.blockedReason ? "decision-dirty-hint" : undefined}
              className="hd-approve"
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
            <button
              type="button"
              onClick={onRequestChanges}
              aria-expanded={adjustOpen}
              aria-controls="adjust-protocol"
              disabled={state === "saving"}
              className="hd-btn hd-btn-secondary w-full"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              {adjustOpen ? "Hide changes" : "Request changes"}
            </button>
          </div>
        )}
      </div>

      {gate.blockedReason && !terminal && (
        <p id="decision-dirty-hint" className="sr-only">
          {gate.blockedReason}
        </p>
      )}
    </div>
  );
}

// ── The mobile bar ──────────────────────────────────────────────────────────

function MobileBar({
  state,
  treatmentCount,
  onApprove,
  onRequestChanges,
  adjustOpen,
  nextResolved,
  nextPatient,
  nextLookupFailed,
  cartHref = null,
  whatsappAutomationEnabled = false,
  waState = "idle",
  waErrorReason = null,
  onRetryWhatsapp,
  onShareManually,
  gate,
  terminal,
}: DecisionBarProps & {
  gate: ReturnType<typeof decisionGate>;
  terminal: boolean;
}) {
  if (terminal) {
    return (
      <TerminalActions
        state={state}
        whatsappAutomationEnabled={whatsappAutomationEnabled}
        waState={waState}
        waErrorReason={waErrorReason}
        onRetryWhatsapp={onRetryWhatsapp}
        onShareManually={onShareManually}
        cartHref={cartHref}
        nextResolved={nextResolved}
        nextPatient={nextPatient}
        nextLookupFailed={nextLookupFailed}
        layout="bar"
      />
    );
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[color:var(--hd-text)]">
          {treatmentCount === 0
            ? "No treatments selected"
            : `${treatmentCount} treatment${treatmentCount === 1 ? "" : "s"} selected`}
        </p>
        {gate.blockedReason ? (
          <p className="truncate text-xs font-medium text-[color:var(--hd-attention)]">
            {gate.blockedReason}
          </p>
        ) : (
          <button
            type="button"
            onClick={onRequestChanges}
            aria-expanded={adjustOpen}
            aria-controls="adjust-protocol"
            className="text-xs font-medium text-[color:var(--hd-primary-dark)] underline underline-offset-2"
          >
            {adjustOpen ? "Hide changes" : "Request changes"}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onApprove}
        disabled={!gate.canApprove}
        className="hd-approve !w-auto shrink-0 !px-5"
      >
        {state === "saving" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Saving…
          </>
        ) : (
          <>
            <ClipboardCheck className="h-4 w-4" aria-hidden />
            {whatsappAutomationEnabled ? "Approve & Send" : "Approve"}
          </>
        )}
      </button>
    </div>
  );
}

// ── Post-decision handoff, shared by both shapes ────────────────────────────

function TerminalActions({
  state,
  whatsappAutomationEnabled,
  waState,
  waErrorReason,
  onRetryWhatsapp,
  onShareManually,
  cartHref,
  nextResolved,
  nextPatient,
  nextLookupFailed,
  layout,
}: {
  state: DecisionState;
  whatsappAutomationEnabled: boolean;
  waState: WhatsappSendUiState;
  waErrorReason: string | null;
  onRetryWhatsapp?: () => void;
  onShareManually?: () => void;
  cartHref: string | null;
  nextResolved: boolean;
  nextPatient: DecisionBarNextPatient | null;
  nextLookupFailed: boolean;
  layout: "rail" | "bar";
}) {
  const stack = layout === "rail";
  // Launch discipline is WHATSAPP_AUTOMATION_ENABLED=false (see
  // lib/delivery/sendPatientLink), so an approved case is NOT auto-delivered —
  // the doctor still has to send it. Make that the primary post-approval action
  // right here in the rail, rather than leaving it to a secondary control
  // further down the page, so the normal flow is Review → Approve → Send with
  // no hunting. Reuses the existing manual-share handler (the 365d69a
  // popup-safe wa.me path) — no new send capability, no clinical logic.
  const showManualSend =
    state === "approved" && !whatsappAutomationEnabled && !!onShareManually;
  return (
    <div className={stack ? "space-y-3" : "flex items-center justify-between gap-3"}>
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium text-[color:var(--hd-text)]">
          {state === "approved" ? (
            <>
              <Check className="h-4 w-4 text-[color:var(--hd-success-strong)]" aria-hidden />
              {whatsappAutomationEnabled ? "Report approved" : "Treatment approved"}
            </>
          ) : (
            <>
              <MessageSquareWarning className="h-4 w-4 text-[color:var(--hd-attention)]" aria-hidden />
              Needs revision
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
      </div>

      <div className={stack ? "flex flex-col gap-2" : "flex items-center gap-2"}>
        {showManualSend && (
          // Primary post-approval action in the launch (manual-send) config.
          // Same visual weight as the "Next patient" handoff normally carries;
          // that handoff is demoted to secondary below so exactly one action
          // reads as primary here.
          <button
            type="button"
            onClick={onShareManually}
            className={`inline-flex items-center justify-center gap-2 rounded-lg bg-[color:var(--hd-text)] px-4 py-2 text-sm font-medium text-[color:var(--hd-surface)] transition-colors hover:opacity-90 ${stack ? "w-full" : ""}`}
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            Send report to patient
          </button>
        )}
        {cartHref && (
          <a
            href={cartHref}
            target="_blank"
            rel="noreferrer"
            className={`hd-btn hd-btn-secondary ${stack ? "w-full" : ""}`}
          >
            <ShoppingCart className="h-4 w-4" aria-hidden />
            Clinic order
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
        {nextResolved && nextPatient && (
          <Link
            href={reviewHref({ id: nextPatient.id, concern: nextPatient.concern })}
            className={
              showManualSend
                ? `hd-btn hd-btn-secondary ${stack ? "w-full" : ""}`
                : `inline-flex items-center justify-center gap-2 rounded-lg bg-[color:var(--hd-text)] px-4 py-2 text-sm font-medium text-[color:var(--hd-surface)] transition-colors hover:opacity-90 ${stack ? "w-full" : ""}`
            }
          >
            Next patient
            {stack && (
              <span className="font-normal opacity-75">· {nextPatient.patientName}</span>
            )}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
        {nextResolved && !nextPatient && (
          <span className="text-sm text-[color:var(--hd-text-secondary)]">
            All caught up —{" "}
            <Link href="/doctor" className="font-medium underline underline-offset-2">
              dashboard
            </Link>
          </span>
        )}
        {nextLookupFailed && (
          <span className="text-sm text-[color:var(--hd-text-muted)]">
            Next patient unavailable —{" "}
            <Link href="/doctor/reports" className="font-medium underline underline-offset-2">
              open the queue
            </Link>
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * What happened to the WhatsApp send, under "Report approved ✓".
 *
 * Never shown when `waState === "idle"` — that covers both the first-paint
 * flash and a consultation approved before automation existed.
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
      <p className="mt-1 flex items-center gap-1.5 text-xs text-[color:var(--hd-text-muted)]">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Sending report on WhatsApp…
      </p>
    );
  }

  if (waState === "sent" || waState === "already_sent") {
    return (
      <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-[color:var(--hd-success-ink)]">
        <Check className="h-3 w-3" aria-hidden />
        {waState === "already_sent" ? "WhatsApp already sent" : "WhatsApp sent"}
      </p>
    );
  }

  if (waState === "test_transport") {
    return (
      <p className="mt-1 text-xs text-[color:var(--hd-text-muted)]">
        WhatsApp recorded — test transport, nothing was actually sent.
      </p>
    );
  }

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
      <p className="flex items-center gap-1.5 text-xs font-medium text-[color:var(--hd-attention)]">
        <TriangleAlert className="h-3 w-3 shrink-0" aria-hidden />
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {canRetry && onRetryWhatsapp && (
          <button
            type="button"
            onClick={onRetryWhatsapp}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--hd-border-strong)] bg-[color:var(--hd-surface)] px-2.5 py-1 text-xs font-medium text-[color:var(--hd-text-secondary)] hover:bg-[color:var(--hd-surface-alt)]"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            Retry WhatsApp
          </button>
        )}
        {onShareManually && (
          <button
            type="button"
            onClick={onShareManually}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--hd-border-strong)] bg-[color:var(--hd-surface)] px-2.5 py-1 text-xs font-medium text-[color:var(--hd-text-secondary)] hover:bg-[color:var(--hd-surface-alt)]"
          >
            <MessageCircle className="h-3 w-3" aria-hidden />
            Share manually
          </button>
        )}
      </div>
    </div>
  );
}

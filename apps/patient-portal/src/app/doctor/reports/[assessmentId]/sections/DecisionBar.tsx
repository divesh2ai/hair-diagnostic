"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  Loader2,
  MessageSquareWarning,
  TriangleAlert,
} from "lucide-react";
import { reviewHref } from "@/lib/doctor/reviewHref";
import { decisionGate } from "@/lib/doctor/decisionGate";

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
  onNeedsRevision: () => void;
  /** Whether the next-patient lookup has answered. */
  nextResolved: boolean;
  /** Null with `nextResolved` true means the queue really is empty. */
  nextPatient: DecisionBarNextPatient | null;
  /** True when the handoff lookup itself failed — never claim an empty queue. */
  nextLookupFailed: boolean;
}

export function DecisionBar({
  state,
  treatmentCount,
  doctorAdditions,
  lineupDirty,
  revisionRequested,
  errorMessage,
  onApprove,
  onNeedsRevision,
  nextResolved,
  nextPatient,
  nextLookupFailed,
}: DecisionBarProps) {
  const terminal = state === "approved" || revisionRequested;
  // The single source of truth for "may this be committed now". See
  // lib/doctor/decisionGate.
  const gate = decisionGate({ state, lineupDirty });

  return (
    <div
      className="sticky bottom-0 z-30 -mx-4 mt-2 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:-mx-6 sm:px-6"
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
            <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
              {state === "approved" ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" aria-hidden />
                  Treatment approved
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
            </>
          )}
        </div>

        {/* RIGHT — the decision, or the handoff once it is made. */}
        <div className="flex flex-wrap items-center gap-2">
          {terminal ? (
            <>
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
              <button
                type="button"
                onClick={onNeedsRevision}
                disabled={state === "saving"}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-stone-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
              >
                <MessageSquareWarning className="h-4 w-4" aria-hidden />
                Needs revision
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
                    Saving decision…
                  </>
                ) : state === "error" ? (
                  <>
                    <ClipboardCheck className="h-4 w-4" aria-hidden />
                    Retry approval
                  </>
                ) : (
                  <>
                    <ClipboardCheck className="h-4 w-4" aria-hidden />
                    Approve treatment
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

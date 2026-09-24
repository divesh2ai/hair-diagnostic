"use client";

import { useState } from "react";
import { Loader2, RefreshCw, Trash2, Undo2, X } from "lucide-react";
import type { Consultation, TreatmentPhase } from "@shared/types/consultation";
import { KitLineupEditor, type SavedConsultation } from "../KitLineupEditor";
import { TopicalsCard } from "@/components/consultation";
import { ProductImage } from "@/components/kits/ProductImage";
import { useKitCatalog } from "@/lib/doctor/kitCatalog";
import {
  buildProtocolItems,
  summarizeProtocol,
} from "@/lib/doctor/protocolModel";
import {
  getApprovedAlternativeForKitId,
  resolveSubstitutionPriceComparisonForKitId,
} from "@/lib/commerce/budgetSubstitution";
import { formatInrFromMinor } from "@/lib/commerce/kitPricing";
import { getKitInfo } from "@hairos/packages/registries/kits/info";
import { CollapsibleText } from "./CollapsibleText";

// WHAT ARE WE TREATING? — the protocol, the reasoning that produced it, and the
// two changes a doctor makes most often, inline on the row.
//
// ── Why this is not a product list ─────────────────────────────────────────
// A doctor approving a plan needs the clinical chain — what problem is being
// treated, what the treatment is meant to achieve, and which protocol does it.
// So each row leads with the driver and the objective, and the kit name sits as
// the answer. It reads as a treatment plan, never as a shop: no price sits in
// the clinical decision area (pricing belongs to the Clinic Order, after
// approval).
//
// ── Nothing here is computed ───────────────────────────────────────────────
// Drivers, rationale and sequence come from the persisted engine output;
// objectives come from the authored kit registry; the one approved alternative
// per kit comes from the governed budget-substitution table. This component
// chooses typography and wires the two inline actions to the SAME server paths
// the lineup editor uses. It does not choose kits and it does not invent an
// alternative the governance table did not approve.
//
// ── The two inline actions, and the one that stays in the editor ────────────
// REPLACE  the governed budget substitution — POST /kit-substitution, exactly
//          as KitLineupEditor's "Budget alternative" does. Only ever offered
//          when there is one approved, priced alternative for THIS kit.
// REMOVE   drops the phase and PATCHes the complete treatmentPlan back through
//          the same versioned path a lineup save uses — a new immutable,
//          audited version the approval then snapshots from.
// Reorder and Add stay in KitLineupEditor, opened by "Request changes"
// (`adjustOpen`): they cannot be expressed as a single row action, and folding
// them onto every row would crowd the plan. Inline actions hide while that
// editor is open, so the two never fight over the same lineup.

/** The provenance a substitution stamps on the phase it replaced. */
interface SubstitutionMeta {
  originalPhase: { displayName: string };
}
type EditedPhase = TreatmentPhase & {
  meta?: { addedByDoctor?: boolean; substitution?: SubstitutionMeta };
};

export interface ProtocolSectionProps {
  consultation: Consultation;
  assessmentId: string;
  expectedContentVersion: number;
  /** Approved consultations are locked — the order was cut from this lineup. */
  isApproved: boolean;
  /**
   * Called after a successful save. Receives the mutation's OWN authoritative
   * response ({ consultation, meta } for the version it just wrote), so the
   * parent can update the UI from it directly instead of paying for a second
   * full GET reload. Called with no argument only on paths that cannot return
   * it, where the parent falls back to a reload.
   */
  onSaved: (updated?: SavedConsultation) => Promise<void> | void;
  onConflict: () => Promise<void> | void;
  /** Staged, unsaved lineup edits in the advanced editor — surfaced so approval can be guarded. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Whether the advanced reorder/add editor is open. Inline actions hide while it is. */
  adjustOpen?: boolean;
  /** Close the advanced editor and return to the read-only protocol with inline actions. */
  onCloseAdjust?: () => void;
  /** Hand the case back for regeneration — the escalation from adjusting. */
  onEscalate?: () => void;
}

export function ProtocolSection({
  consultation,
  assessmentId,
  expectedContentVersion,
  isApproved,
  onSaved,
  onConflict,
  onDirtyChange,
  adjustOpen = false,
  onCloseAdjust,
  onEscalate,
}: ProtocolSectionProps) {
  const { byKitId } = useKitCatalog();
  const phases = consultation.treatmentPlan.kitPhases;
  const items = buildProtocolItems(phases, byKitId);
  const summary = summarizeProtocol(phases);
  const topicals = consultation.treatmentPlan.topicals ?? [];

  // One inline panel open at a time, keyed by row index. `busy` gates every
  // control on the section while a persist is in flight, since all three server
  // actions advance the version.
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closePanels = () => {
    setReplaceIndex(null);
    setRemoveIndex(null);
    setError(null);
  };

  // REPLACE — the governed substitution endpoint, identical to the editor's.
  const runSubstitution = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/consultation/${assessmentId}/kit-substitution`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, expectedContentVersion }),
        },
      );
      if (res.status === 409) {
        setError(
          "This consultation changed while you were editing. Reloading the latest version.",
        );
        await onConflict();
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.message ?? "Could not save this change.");
        return;
      }
      closePanels();
      const j = (await res.json().catch(() => ({}))) as Partial<SavedConsultation>;
      await onSaved(j.consultation && j.meta ? { consultation: j.consultation, meta: j.meta } : undefined);
    } finally {
      setBusy(false);
    }
  };

  // REMOVE — drop the phase and re-save the complete treatmentPlan through the
  // same versioned PATCH the editor uses. Phases are renumbered 1..N from array
  // order, and the full plan is sent so the shallow-merge revise cannot drop
  // topicals/timeline.
  const removePhase = async (index: number) => {
    setBusy(true);
    setError(null);
    try {
      const renumbered = phases
        .filter((_, i) => i !== index)
        .map((p, i) => ({ ...p, phase: i + 1 }));
      const nextTreatmentPlan = {
        ...consultation.treatmentPlan,
        kitPhases: renumbered,
      };
      const res = await fetch(`/api/consultation/${assessmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          edits: { treatmentPlan: nextTreatmentPlan },
          expectedContentVersion,
        }),
      });
      if (res.status === 409) {
        setError(
          "This consultation changed while you were editing. Reloading the latest version.",
        );
        await onConflict();
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.message ?? "Could not remove this treatment.");
        return;
      }
      closePanels();
      const j = (await res.json().catch(() => ({}))) as Partial<SavedConsultation>;
      await onSaved(j.consultation && j.meta ? { consultation: j.consultation, meta: j.meta } : undefined);
    } finally {
      setBusy(false);
    }
  };

  // Inline actions are the read-only plan's affordances; they are replaced by
  // the full editor when the doctor opens "Request changes".
  const inlineEditable = !isApproved && !adjustOpen;

  return (
    <section aria-labelledby="protocol-heading" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="protocol-heading" className="hd-story-title">
          Suggested treatment
        </h2>
        <p className="text-xs text-[color:var(--hd-text-muted)]">
          <span className="font-medium text-[color:var(--hd-text-secondary)]">
            {summary.count === 0
              ? "No interventions selected"
              : `${summary.count} intervention${summary.count === 1 ? "" : "s"}`}
          </span>
          {summary.addedByDoctor > 0 && (
            <span className="text-[color:var(--hd-primary-dark)]">
              {" · "}
              {summary.addedByDoctor} added by doctor
            </span>
          )}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[color:var(--hd-border-strong)] bg-[color:var(--hd-surface-alt)] px-4 py-5 text-sm text-[color:var(--hd-text-secondary)]">
          No kit protocol was selected for this assessment.
        </p>
      ) : (
        // Rows divided by hairlines, not boxed as cards — a calm plan, not a
        // grid of tiles.
        <ol className="rounded-2xl border border-[color:var(--hd-border)] bg-[color:var(--hd-surface)]">
          {items.map((item, i) => {
            const phase = phases[i] as EditedPhase;
            const substitution = phase?.meta?.substitution;
            const approvedAlt = !substitution
              ? getApprovedAlternativeForKitId(item.kitId)
              : null;
            const comparison = approvedAlt
              ? resolveSubstitutionPriceComparisonForKitId(
                  item.kitId,
                  approvedAlt.alternativeKitId,
                )
              : null;
            const canReplace =
              inlineEditable && comparison?.bothPricesApproved === true;
            const altName = approvedAlt
              ? getKitInfo(approvedAlt.alternativeKitId)?.displayName ??
                approvedAlt.alternativeKitId
              : null;

            return (
              <li
                key={`${item.kitId}-${item.phase}`}
                className="border-t border-[color:var(--hd-border)] px-4 py-5 first:border-t-0 sm:px-6"
              >
                <div className="flex gap-4 sm:gap-5">
                  {/* Packshot large enough to read the carton — a real check
                      that the right product is being dispensed. */}
                  <ProductImage id={item.kitId} category="kit" size="md" />

                  <div className="min-w-0 flex-1">
                    {item.drivers.length > 0 && (
                      <p className="hd-eyebrow">
                        {item.drivers.slice(0, 3).join(" · ")}
                      </p>
                    )}

                    <div className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                      <span className="text-[11px] font-medium tabular-nums text-[color:var(--hd-text-muted)]">
                        {item.phase}
                      </span>
                      <h3
                        className="text-lg text-[color:var(--hd-text)]"
                        style={{ fontFamily: "var(--hd-font-display)" }}
                      >
                        {item.name}
                      </h3>
                      {item.addedByDoctor && (
                        <span className="rounded-full bg-[color:var(--hd-primary-tint)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[color:var(--hd-primary-dark)]">
                          Added by doctor
                        </span>
                      )}
                    </div>

                    {item.objective && (
                      <p className="mt-1 text-sm leading-relaxed text-[color:var(--hd-text-secondary)]">
                        {item.objective}
                      </p>
                    )}

                    {/* WHY THIS IS HERE — the per-patient evidence chain, the
                        engine's `whySelected` verbatim, clamped not edited. */}
                    {item.rationale && (
                      <div className="mt-2.5 max-w-prose">
                        <p className="hd-eyebrow mb-0.5">Why this is here</p>
                        <CollapsibleText
                          text={item.rationale}
                          className="text-sm leading-relaxed text-[color:var(--hd-text-secondary)]"
                          moreLabel="full rationale"
                        />
                      </div>
                    )}

                    {(item.keyIngredients.length > 0 ||
                      item.mechanismOfAction.length > 0) && (
                      <details className="group mt-2.5">
                        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[11px] font-medium text-[color:var(--hd-text-muted)] hover:text-[color:var(--hd-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--hd-primary)]">
                          Formulation detail
                          <span
                            className="transition-transform group-open:rotate-180"
                            aria-hidden
                          >
                            ▾
                          </span>
                        </summary>
                        <div className="mt-2 space-y-2 border-l-2 border-[color:var(--hd-border)] pl-3">
                          {item.keyIngredients.length > 0 && (
                            <p className="text-xs text-[color:var(--hd-text-secondary)]">
                              <span className="font-medium text-[color:var(--hd-text)]">
                                Key ingredients:{" "}
                              </span>
                              {item.keyIngredients.join(", ")}
                            </p>
                          )}
                          {item.mechanismOfAction.length > 0 && (
                            <ul className="space-y-1 text-xs text-[color:var(--hd-text-secondary)]">
                              {item.mechanismOfAction.map((m, idx) => (
                                <li key={idx}>{m}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </details>
                    )}

                    {/* A substitution already applied — stated plainly, with a
                        one-click undo (RESTORE). */}
                    {substitution && !isApproved && (
                      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--hd-primary-tint)] px-2 py-0.5 font-medium text-[color:var(--hd-primary-dark)]">
                          <RefreshCw className="h-3 w-3" aria-hidden />
                          Replaced {substitution.originalPhase.displayName}
                        </span>
                        <button
                          type="button"
                          onClick={() => void runSubstitution({ action: "RESTORE", currentKitId: item.kitId })}
                          disabled={busy}
                          className="inline-flex items-center gap-1 font-medium text-[color:var(--hd-text-secondary)] underline decoration-dotted underline-offset-2 hover:text-[color:var(--hd-text)] disabled:opacity-50"
                        >
                          <Undo2 className="h-3 w-3" aria-hidden />
                          Undo
                        </button>
                      </div>
                    )}

                    {/* The two inline actions. Quiet, text-weight controls —
                        the one filled button on the page stays Approve. */}
                    {inlineEditable && replaceIndex !== i && removeIndex !== i && (
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[color:var(--hd-border)] pt-3">
                        {canReplace && altName && (
                          <button
                            type="button"
                            onClick={() => {
                              setRemoveIndex(null);
                              setReplaceIndex(i);
                              setError(null);
                            }}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[color:var(--hd-primary-dark)] hover:underline disabled:opacity-50"
                          >
                            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                            Replace
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setReplaceIndex(null);
                            setRemoveIndex(i);
                            setError(null);
                          }}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[color:var(--hd-text-secondary)] hover:text-[color:var(--hd-critical-ink)] disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          Remove
                        </button>
                      </div>
                    )}

                    {/* REPLACE — the one approved alternative, its packshot,
                        name and the patient saving, then apply / cancel. */}
                    {replaceIndex === i && approvedAlt && altName && comparison?.bothPricesApproved && (
                      <div className="mt-3 rounded-xl border border-[color:var(--hd-primary-border)] bg-[color:var(--hd-primary-tint)] p-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="hd-eyebrow !text-[color:var(--hd-primary-dark)]">
                            Replace {item.name}
                          </p>
                          <button
                            type="button"
                            onClick={closePanels}
                            disabled={busy}
                            aria-label="Cancel replacement"
                            className="rounded p-1 text-[color:var(--hd-text-muted)] hover:text-[color:var(--hd-text)] disabled:opacity-50"
                          >
                            <X className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                        <p className="mt-1 text-[11px] text-[color:var(--hd-text-secondary)]">
                          Recommended alternative · same treatment objective, approved for budget.
                        </p>
                        <div className="mt-2.5 flex items-center gap-3 rounded-lg border border-[color:var(--hd-border)] bg-[color:var(--hd-surface)] p-2.5">
                          <ProductImage id={approvedAlt.alternativeKitId} category="kit" size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[color:var(--hd-text)]">
                              {altName}
                            </p>
                            <p className="mt-0.5 text-xs font-medium text-[color:var(--hd-primary-dark)]">
                              Patient saving {formatInrFromMinor(comparison.savingMinor!)}
                            </p>
                            <p className="text-[11px] text-[color:var(--hd-text-muted)]">
                              Reason recorded: patient budget / affordability.
                            </p>
                          </div>
                        </div>
                        {error && (
                          <p className="mt-2 rounded bg-[color:var(--hd-critical-tint)] px-2 py-1 text-[11px] text-[color:var(--hd-critical-ink)]">
                            {error}
                          </p>
                        )}
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void runSubstitution({
                                action: "SUBSTITUTE",
                                originalKitId: item.kitId,
                                alternativeKitId: approvedAlt.alternativeKitId,
                              })
                            }
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--hd-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[color:var(--hd-primary-dark)] disabled:opacity-50"
                          >
                            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                            Use {altName}
                          </button>
                          <button
                            type="button"
                            onClick={closePanels}
                            disabled={busy}
                            className="rounded-lg border border-[color:var(--hd-border-strong)] bg-[color:var(--hd-surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--hd-text-secondary)] hover:bg-[color:var(--hd-surface-alt)] disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* REMOVE — an intentional but lightweight inline confirm,
                        never window.confirm(). */}
                    {removeIndex === i && (
                      <div className="mt-3 rounded-xl border border-[color:var(--hd-border-strong)] bg-[color:var(--hd-surface-alt)] p-3.5">
                        <p className="text-sm font-medium text-[color:var(--hd-text)]">
                          Remove {item.name} from the final plan?
                        </p>
                        <p className="mt-0.5 text-[11px] text-[color:var(--hd-text-muted)]">
                          Saves a new version of this consultation. Approval acts on the plan you leave here.
                        </p>
                        {error && (
                          <p className="mt-2 rounded bg-[color:var(--hd-critical-tint)] px-2 py-1 text-[11px] text-[color:var(--hd-critical-ink)]">
                            {error}
                          </p>
                        )}
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void removePhase(i)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--hd-critical)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                          >
                            {busy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            )}
                            Remove
                          </button>
                          <button
                            type="button"
                            onClick={closePanels}
                            disabled={busy}
                            className="rounded-lg border border-[color:var(--hd-border-strong)] bg-[color:var(--hd-surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--hd-text-secondary)] hover:bg-[color:var(--hd-surface-alt)] disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {topicals.length > 0 && (
        <div className="space-y-2 pt-1">
          <h3 className="hd-story-title">Topical recommendations</h3>
          <TopicalsCard topicals={topicals} />
        </div>
      )}

      {/* Doctor authority over the lineup. Locked once approved, because the
          kit order has already been cut from exactly this list. */}
      {isApproved ? (
        <p className="rounded-xl border border-[color:var(--hd-success-tint)] bg-[color:var(--hd-success-tint)] px-4 py-2.5 text-xs text-[color:var(--hd-success-ink)]">
          Lineup locked — this consultation is approved and the kit order was
          created from the protocol above.
        </p>
      ) : !adjustOpen ? null : (
        <div
          id="adjust-protocol"
          tabIndex={-1}
          className="hd-card space-y-3 bg-[color:var(--hd-surface)] p-4 sm:p-5"
          style={{
            borderColor: "var(--hd-primary-border)",
            boxShadow: "inset 3px 0 0 0 var(--hd-primary)",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="hd-eyebrow !text-[color:var(--hd-primary-dark)]">
              Adjust protocol — reorder or add kits
            </h3>
            {onCloseAdjust && (
              <button
                type="button"
                onClick={onCloseAdjust}
                className="hd-btn hd-btn-secondary !px-3 !py-1.5 !text-xs"
              >
                Done adjusting
              </button>
            )}
          </div>
          <p className="hd-label text-xs">
            Reorder, remove or add kits. Saving creates a new version of this
            consultation; approval then acts on the lineup you leave here.
          </p>
          <KitLineupEditor
            assessmentId={assessmentId}
            consultation={consultation}
            expectedContentVersion={expectedContentVersion}
            onSaved={onSaved}
            onConflict={onConflict}
            onDirtyChange={onDirtyChange}
          />
          {onEscalate && (
            <div className="hd-divide-t pt-3">
              <p className="hd-label text-xs">Not something to fix by hand?</p>
              <button
                type="button"
                onClick={onEscalate}
                className="hd-btn hd-btn-secondary mt-1.5 !px-3 !py-1.5 !text-xs"
              >
                Send back for revision
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

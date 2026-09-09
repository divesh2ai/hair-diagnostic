"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  X,
  GripVertical,
  Check,
  Loader2,
  Undo2,
} from "lucide-react";
import type { Consultation, TreatmentPhase } from "@shared/types/consultation";
import { loadKitCatalog, type KitCatalogItem } from "@/lib/doctor/kitCatalog";
import { ProductImage } from "@/components/kits/ProductImage";
import {
  getApprovedAlternativeForKitId,
  resolveSubstitutionPriceComparisonForKitId,
} from "@/lib/commerce/budgetSubstitution";
import { formatInrFromMinor } from "@/lib/commerce/kitPricing";
import { getKitInfo } from "@hairos/packages/registries/kits/info";

/** The provenance a substitution stamps on the phase it replaces. */
interface SubstitutionMeta {
  type: "BUDGET";
  reason: "BUDGET_AFFORDABILITY";
  originalKitId: string;
  originalPhase: TreatmentPhase;
  changedBy: string;
  changedAt: string;
  priceAtSubstitutionMinor: { canonical: number; alternative: number };
}

type EditedPhase = TreatmentPhase & {
  meta?: { addedByDoctor?: boolean; substitution?: SubstitutionMeta };
};

// ─────────────────────────────────────────────────────────────────────────────
// Kit lineup editor — the doctor's clinical authority over the AI's suggestion.
//
// The AI proposes; the doctor disposes. This surface lets the reviewing
// clinician reorder, remove, or add kits before approval. Every change is a
// staged local edit; "Save lineup" commits it through the SAME versioned
// PATCH path a note uses — a new immutable Consultation version, fully
// audited, that the approval + patient cart then snapshot from. No side
// channel, no mutation of the engine output in place.
//
// Guardrails a senior clinician would insist on:
//   • Phase numbers are always re-derived 1..N from array order — the doctor
//     reasons about "which comes first", never edits a raw integer.
//   • A doctor-added kit is marked doctorEdited + meta.addedByDoctor so the
//     audit trail and downstream renderers can distinguish it from an
//     engine selection. Its clinical copy comes from the kit registry so it
//     renders identically to a generated phase.
//   • Optimistic-concurrency safe: Save carries expectedContentVersion; a
//     409 tells the doctor someone else advanced the version and to reload.
//   • Nothing is destructive until Save. "Reset" restores the AI lineup.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  consultation: Consultation;
  expectedContentVersion: number;
  onSaved: () => Promise<void> | void;
  onConflict: () => Promise<void> | void;
  assessmentId: string;
  disabled?: boolean;
  /**
   * Reports whether the staged lineup differs from the saved one.
   *
   * Approval snapshots the SAVED consultation server-side, so a doctor with
   * unsaved kit edits who approves would be approving the previous lineup.
   * The decision bar uses this to say so and hold the approval until saved.
   */
  onDirtyChange?: (dirty: boolean) => void;
}

export function KitLineupEditor({
  consultation,
  expectedContentVersion,
  onSaved,
  onConflict,
  assessmentId,
  disabled,
  onDirtyChange,
}: Props) {
  const enginePhases = consultation.treatmentPlan.kitPhases;

  const [phases, setPhases] = useState<TreatmentPhase[]>(enginePhases);
  const [catalog, setCatalog] = useState<KitCatalogItem[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which row's "Budget alternative" comparison panel is open, if any.
  const [budgetPanelIndex, setBudgetPanelIndex] = useState<number | null>(null);
  const [budgetBusy, setBudgetBusy] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);

  // Re-sync local state when a fresh version loads from the server (e.g. after
  // a successful save or an external reload).
  useEffect(() => {
    setPhases(consultation.treatmentPlan.kitPhases);
  }, [consultation.treatmentPlan.kitPhases]);

  const dirty = useMemo(
    () => !phasesEqual(phases, enginePhases),
    [phases, enginePhases],
  );

  // Surface staged edits to the parent. Effect rather than a call inside the
  // handlers so it stays correct however `phases` changed — including the
  // re-sync above, which clears the flag after a successful save.
  //
  // The cleanup matters: this editor unmounts when the consultation becomes
  // approved, and a dirty flag left set behind it would keep the decision bar
  // warning about edits that no longer have anywhere to live.
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  const loadCatalog = async () => {
    if (catalog) return;
    // Shared with ProtocolSection's objective lookup, so the catalog is
    // fetched once per page rather than once per consumer.
    setCatalog(await loadKitCatalog());
  };

  const move = (index: number, dir: -1 | 1) => {
    setPhases((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const remove = (index: number) => {
    setPhases((prev) => prev.filter((_, i) => i !== index));
  };

  const addKit = (item: KitCatalogItem) => {
    setPhases((prev) => {
      if (prev.some((p) => p.kitId === item.kitId)) return prev; // no duplicates
      const newPhase: TreatmentPhase = {
        phase: prev.length + 1,
        kitId: item.kitId,
        displayName: item.displayName,
        whySelected: "Added by reviewing doctor.",
        supportingConditions: [],
        keyIngredients: [],
        mechanismOfAction: item.therapeuticStrategy ?? [],
        formulationGroups: item.formulationRationale ?? [],
        // Mark provenance so audit + renderers can tell this apart from an
        // engine selection.
        meta: { addedByDoctor: true },
        doctorEdited: true,
      } as unknown as TreatmentPhase;
      return [...prev, newPhase];
    });
    setAdding(false);
  };

  const reset = () => setPhases(enginePhases);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      // Re-number phases 1..N from array order. Send the COMPLETE treatmentPlan
      // — the versioned revise() shallow-merges at the top level, so a partial
      // treatmentPlan would drop topicals/timeline/etc.
      const renumbered = phases.map((p, i) => ({ ...p, phase: i + 1 }));
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
        setError(j.message ?? "Could not save the kit lineup.");
        return;
      }
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  // Budget substitution is its OWN save, immediate and independent of the
  // staged reorder/add/remove state above — it talks to a dedicated,
  // server-validated endpoint (see the route's own header comment for why),
  // not the generic treatmentPlan PATCH. Disabled whenever there are unsaved
  // staged edits, so this can never save over — or be silently overwritten
  // by — a reorder the doctor has not committed yet.
  const runSubstitutionAction = async (body: Record<string, unknown>) => {
    setBudgetBusy(true);
    setBudgetError(null);
    try {
      const res = await fetch(`/api/consultation/${assessmentId}/kit-substitution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, expectedContentVersion }),
      });
      if (res.status === 409) {
        setBudgetError(
          "This consultation changed while you were editing. Reloading the latest version.",
        );
        await onConflict();
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setBudgetError(j.message ?? "Could not save this change.");
        return;
      }
      setBudgetPanelIndex(null);
      await onSaved();
    } finally {
      setBudgetBusy(false);
    }
  };

  const applyBudgetAlternative = (originalKitId: string, alternativeKitId: string) =>
    runSubstitutionAction({ action: "SUBSTITUTE", originalKitId, alternativeKitId });

  const restoreOriginalKit = (currentKitId: string) =>
    runSubstitutionAction({ action: "RESTORE", currentKitId });

  const availableToAdd = useMemo(() => {
    if (!catalog) return [];
    const chosen = new Set(phases.map((p) => p.kitId));
    return catalog.filter((c) => !chosen.has(c.kitId));
  }, [catalog, phases]);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-stone-200">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-700">
            Doctor authority
          </p>
          <h3 className="font-serif text-lg text-slate-900">Edit kit lineup</h3>
        </div>
        {dirty && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">
            Unsaved changes
          </span>
        )}
      </header>

      <div className="p-4 space-y-3">
        {phases.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 text-center text-sm text-stone-500">
            No kits in the lineup. Add one below.
          </div>
        ) : (
          <ol className="space-y-2">
            {phases.map((p, i) => {
              const editedPhase = p as EditedPhase;
              const addedByDoctor = editedPhase.meta?.addedByDoctor === true;
              const substitution = editedPhase.meta?.substitution;
              // Only offer a budget swap on a kit that (a) has an approved
              // alternative and (b) is not itself already the result of one
              // — restoring first is how a doctor changes their mind, rather
              // than substituting a substitution.
              const approvedAlt = !substitution ? getApprovedAlternativeForKitId(p.kitId) : null;
              const comparison = approvedAlt
                ? resolveSubstitutionPriceComparisonForKitId(p.kitId, approvedAlt.alternativeKitId)
                : null;
              // Fail closed on display too: an approved pair with no
              // approved price on either side shows no action at all, same
              // as a kit with no mapping.
              const canOfferAlternative = comparison?.bothPricesApproved === true;
              const panelOpen = budgetPanelIndex === i;

              return (
                <li
                  key={`${p.kitId}-${i}`}
                  className="rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2.5"
                >
                <div className="flex items-center gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                    {i + 1}
                  </span>
                  <GripVertical className="hidden sm:block size-4 shrink-0 text-stone-300" />
                  {/* Row-scale packshot: the doctor is reordering a list, so
                      the carton is here for recognition, not display. `xs` is
                      sized to the row height — a larger frame would push each
                      row apart and turn a five-item lineup into a scroll. */}
                  <ProductImage id={p.kitId} category="kit" size="xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {p.displayName}
                    </p>
                    {addedByDoctor && (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-teal-700">
                        Added by you
                      </span>
                    )}
                    {substitution && (
                      <p className="text-[11px] text-stone-500">
                        Changed from {substitution.originalPhase.displayName} for affordability.
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <IconBtn
                      label="Move up"
                      onClick={() => move(i, -1)}
                      disabled={i === 0 || disabled}
                    >
                      <ArrowUp className="size-4" />
                    </IconBtn>
                    <IconBtn
                      label="Move down"
                      onClick={() => move(i, 1)}
                      disabled={i === phases.length - 1 || disabled}
                    >
                      <ArrowDown className="size-4" />
                    </IconBtn>
                    <IconBtn
                      label="Remove kit"
                      onClick={() => remove(i)}
                      disabled={disabled}
                      danger
                    >
                      <Trash2 className="size-4" />
                    </IconBtn>
                  </div>
                </div>

                {/* Budget substitution — a subtle secondary action, never a
                    dropdown of unrelated kits. Only ever shown when there is
                    exactly one approved, priced alternative for THIS kit. */}
                {canOfferAlternative && approvedAlt && !panelOpen && (
                  <button
                    type="button"
                    onClick={() => setBudgetPanelIndex(i)}
                    disabled={dirty || disabled || budgetBusy}
                    className="mt-1.5 ml-9 text-[11px] font-medium text-teal-700 underline decoration-teal-300 decoration-dotted underline-offset-2 hover:text-teal-800 disabled:cursor-not-allowed disabled:text-stone-400 disabled:no-underline"
                  >
                    Budget alternative
                  </button>
                )}

                {substitution && (
                  <button
                    type="button"
                    onClick={() => void restoreOriginalKit(p.kitId)}
                    disabled={dirty || disabled || budgetBusy}
                    className="mt-1.5 ml-9 inline-flex items-center gap-1 text-[11px] font-medium text-stone-600 underline decoration-stone-300 decoration-dotted underline-offset-2 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-stone-400 disabled:no-underline"
                  >
                    <Undo2 className="size-3" />
                    Restore original
                  </button>
                )}

                {panelOpen && approvedAlt && comparison?.bothPricesApproved && (
                  <div className="mt-2 ml-9 rounded-lg border border-teal-200 bg-teal-50/60 p-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                          Current prescription
                        </p>
                        <p className="mt-0.5 font-medium text-slate-900">{p.displayName}</p>
                        <p className="tabular-nums text-stone-600">
                          {formatInrFromMinor(comparison.canonicalPriceMinor!)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-700">
                          Approved budget alternative
                        </p>
                        <p className="mt-0.5 font-medium text-slate-900">
                          {(getKitInfo(approvedAlt.alternativeKitId)?.displayName ?? approvedAlt.alternativeKitId)}
                        </p>
                        <p className="tabular-nums text-stone-600">
                          {formatInrFromMinor(comparison.alternativePriceMinor!)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs font-medium text-teal-800">
                      Patient saving {formatInrFromMinor(comparison.savingMinor!)}
                    </p>
                    <p className="mt-1 text-[11px] text-stone-500">
                      Reason recorded: patient budget / affordability.
                    </p>
                    {budgetError && (
                      <p className="mt-2 rounded bg-rose-50 px-2 py-1 text-[11px] text-rose-700 ring-1 ring-rose-200">
                        {budgetError}
                      </p>
                    )}
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void applyBudgetAlternative(p.kitId, approvedAlt.alternativeKitId)}
                        disabled={budgetBusy}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                      >
                        {budgetBusy && <Loader2 className="size-3.5 animate-spin" />}
                        Use {(getKitInfo(approvedAlt.alternativeKitId)?.displayName ?? approvedAlt.alternativeKitId)}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBudgetPanelIndex(null);
                          setBudgetError(null);
                        }}
                        disabled={budgetBusy}
                        className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-stone-50 disabled:opacity-50"
                      >
                        Keep {p.displayName}
                      </button>
                    </div>
                  </div>
                )}
                </li>
              );
            })}
          </ol>
        )}

        {/* Add kit */}
        {adding ? (
          <div className="rounded-xl border border-stone-200 bg-white">
            <div className="flex items-center justify-between px-3 py-2 border-b border-stone-100">
              <p className="text-xs font-medium text-stone-600">
                Choose a kit to add
              </p>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              {catalog === null ? (
                <div className="flex items-center justify-center py-6 text-stone-400">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              ) : availableToAdd.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-stone-500">
                  Every catalog kit is already in the lineup.
                </p>
              ) : (
                <ul className="space-y-1">
                  {availableToAdd.map((c) => (
                    <li key={c.kitId}>
                      <button
                        type="button"
                        onClick={() => addKit(c)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-teal-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {c.displayName}
                          </p>
                          {c.treatmentObjective && (
                            <p className="truncate text-[11px] text-stone-500">
                              {c.treatmentObjective}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-xs font-medium text-stone-500 tabular-nums">
                          {c.priceLabel}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              void loadCatalog();
            }}
            disabled={disabled}
            // A dashed grey outline read as a disabled placeholder rather
            // than the control that adds a kit. It is the only action in this
            // panel, so it carries the HairOS accent — still bordered, not
            // filled, because the one filled button on the page stays the
            // decision bar's Approve.
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[color:var(--hd-primary)] bg-[color:var(--hd-primary-tint)] px-3 py-2.5 text-xs font-semibold text-[color:var(--hd-primary-dark)] transition-colors hover:bg-[color:var(--hd-primary)] hover:text-white disabled:opacity-50"
          >
            <Plus className="size-3.5" />
            Add a kit
          </button>
        )}

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">
            {error}
          </p>
        )}

        {/* Commit row */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving || disabled}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {saving ? "Saving…" : "Save lineup"}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={!dirty || saving || disabled}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-stone-50 disabled:opacity-40"
            title="Restore the AI-suggested lineup"
          >
            <Undo2 className="size-4" />
            Reset
          </button>
        </div>
        <p className="text-[11px] leading-relaxed text-stone-500">
          Saving creates a new, audited consultation version. Approval and the
          patient cart use your saved lineup — not the original AI suggestion.
        </p>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  disabled,
  label,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`rounded-md p-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        danger
          ? "text-stone-400 hover:bg-rose-50 hover:text-rose-600"
          : "text-stone-500 hover:bg-stone-200/70 hover:text-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

function phasesEqual(a: TreatmentPhase[], b: TreatmentPhase[]): boolean {
  if (a.length !== b.length) return false;
  // Identity of a lineup is its ordered kit ids — reordering, adding, or
  // removing all change this signature.
  return a.every((p, i) => p.kitId === b[i]?.kitId);
}

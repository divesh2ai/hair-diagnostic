"use client";

import { useState } from "react";
import { Loader2, RefreshCw, Trash2, Undo2 } from "lucide-react";
import type { Consultation, TreatmentPhase } from "@shared/types/consultation";
import { KitLineupEditor, type SavedConsultation } from "../KitLineupEditor";
import { TopicalsCard } from "@/components/consultation";
import { ProductImage } from "@/components/kits/ProductImage";
import { PartialKitCheckout } from "@/components/doctor/PartialKitCheckout";
import { useKitCatalog } from "@/lib/doctor/kitCatalog";
import {
  buildProtocolItems,
  summarizeProtocol,
} from "@/lib/doctor/protocolModel";
import { getKitPrice, formatInrFromMinor } from "@/lib/commerce/kitPricing";
import {
  EVENT_LABEL,
  RecordForm,
  STATUS_LABEL,
  fmtDate,
  fmtINR,
  statusTone,
  type PurchaseLedgerState,
} from "@/components/doctor/purchaseLedger";
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
  /**
   * The purchase ledger for the approved order, when one exists. Null/idle
   * before approval. When present and a kit has a matching ledger line, the row
   * gains its purchase facts (recommended / purchased / remaining boxes,
   * deferred/declined status, Record action, and dated history) so the clinical
   * order and its purchases are ONE surface and each kit appears exactly once.
   * Recording never mutates the approved plan above.
   */
  purchase?: PurchaseLedgerState;
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
  purchase,
}: ProtocolSectionProps) {
  const { byKitId } = useKitCatalog();
  const phases = consultation.treatmentPlan.kitPhases;
  const items = buildProtocolItems(phases, byKitId);
  const summary = summarizeProtocol(phases);
  const topicals = consultation.treatmentPlan.topicals ?? [];

  // `busy` gates every control on the section while a persist is in flight,
  // since the remaining server actions (Remove, and undoing a past
  // substitution) advance the version.
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Which kit's purchase recorder is open. Only one at a time, keyed by kitId.
  const [openPurchaseKit, setOpenPurchaseKit] = useState<string | null>(null);

  // The purchase ledger is present only once the approved order exists; before
  // that it is idle (no lines). `hasLedger` gates every purchase affordance.
  const ledger = purchase;
  const hasLedger = !!ledger && ledger.lines.length > 0;
  const purchaseKits = ledger ? ledger.lines.map((l) => ({ id: l.kitId, label: l.kitLabel })) : [];

  /**
   * Governed MRP per box for a kit, in minor units. Post-approval the
   * authoritative figure is the ledger line's server-resolved catalog price;
   * otherwise the governed catalogue (getKitPrice). Never a fabricated
   * fallback — null means "no governed price", which the row states plainly.
   */
  const mrpMinorFor = (kitId: string): number | null => {
    const fromLedger = ledger?.byKitId.get(kitId)?.catalogUnitMinor;
    if (fromLedger != null) return fromLedger;
    return getKitPrice(kitId).amountMinor;
  };

  const closePanels = () => {
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
          Clinical Order &amp; Purchases
        </h2>
        <p className="text-xs text-[color:var(--hd-text-muted)]">
          <span className="font-medium text-[color:var(--hd-text-secondary)]">
            {isApproved ? "Approved order" : "Suggested plan — not yet approved"}
          </span>
          {summary.count > 0 && (
            <>
              {" · "}
              {summary.count} intervention{summary.count === 1 ? "" : "s"}
            </>
          )}
          {summary.addedByDoctor > 0 && (
            <span className="text-[color:var(--hd-primary-dark)]">
              {" · "}
              {summary.addedByDoctor} added by doctor
            </span>
          )}
        </p>
      </div>

      {/* Purchase roll-up — only once an order exists. The approved plan above
          is immutable; these are dated facts about what the patient obtained. */}
      {hasLedger && ledger?.summary && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-xl border border-[color:var(--hd-border)] bg-[color:var(--hd-surface-alt)] px-4 py-2.5 text-sm text-[color:var(--hd-text-secondary)]">
          <span>
            <strong className="text-[color:var(--hd-text)]">
              {ledger.summary.purchasedKits}/{ledger.summary.recommendedKits}
            </strong>{" "}
            kits purchased
          </span>
          <span>
            <strong className="text-[color:var(--hd-text)]">
              {ledger.summary.purchasedBoxes}/{ledger.summary.recommendedBoxes}
            </strong>{" "}
            boxes purchased
          </span>
          <span>
            {ledger.summary.remainingKits} remaining · {ledger.summary.deferredKits} deferred ·{" "}
            {ledger.summary.declinedKits} declined
          </span>
        </div>
      )}

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
            // Replace (offering a budget alternative) is intentionally NOT in
            // the normal Review flow: it mounted an alternative-kit packshot and
            // computed candidates the doctor rarely needs. Kit changes live in
            // the advanced editor ("Request changes"), which loads alternatives
            // only when the doctor opens it. Remove stays inline; a past
            // substitution still shows its one-click Undo below.

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

                    {/* Catalogue identity + governed MRP per box. The identity
                        is the exact canonical kit id the cart and purchase
                        ledger resolve against; the MRP is the governed figure,
                        never an invented fallback. */}
                    {(() => {
                      const mrpMinor = mrpMinorFor(item.kitId);
                      const line = ledger?.byKitId.get(item.kitId);
                      return (
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[color:var(--hd-text-muted)]">
                          <span className="font-mono">{item.kitId}</span>
                          <span aria-hidden>·</span>
                          <span className="font-medium text-[color:var(--hd-text-secondary)]">
                            {mrpMinor != null
                              ? `MRP ${formatInrFromMinor(mrpMinor)} / box`
                              : "Pricing to confirm"}
                          </span>
                          {line && (
                            <>
                              <span aria-hidden>·</span>
                              <span>
                                {line.recommendedBoxes} box
                                {line.recommendedBoxes === 1 ? "" : "es"} recommended
                              </span>
                            </>
                          )}
                        </p>
                      );
                    })()}

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
                    {inlineEditable && removeIndex !== i && (
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[color:var(--hd-border)] pt-3">
                        <button
                          type="button"
                          onClick={() => {
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

                    {/* PURCHASES for this kit — present only once the approved
                        order exists. Recording a purchase is a dated fact and
                        never edits the approved plan above. */}
                    {hasLedger &&
                      (() => {
                        const line = ledger?.byKitId.get(item.kitId);
                        if (!line) return null;
                        const d = line.derived;
                        return (
                          <div className="mt-3 border-t border-[color:var(--hd-border)] pt-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm text-[color:var(--hd-text-secondary)]">
                                <strong className="text-[color:var(--hd-text)]">
                                  {d.purchasedBoxes}/{line.recommendedBoxes}
                                </strong>{" "}
                                boxes purchased
                                {d.remainingBoxes > 0 &&
                                  !["DECLINED", "SUBSTITUTED", "DISCONTINUED"].includes(
                                    d.status,
                                  ) && <> · {d.remainingBoxes} remaining</>}
                                {d.patientReportedBoxes > 0 && (
                                  <>
                                    {" · "}
                                    <span className="text-amber-700">
                                      patient-reported {d.patientReportedBoxes} (unconfirmed)
                                    </span>
                                  </>
                                )}
                                {d.externallyObtainedBoxes > 0 && (
                                  <> · externally obtained {d.externallyObtainedBoxes} (no clinic charge)</>
                                )}
                                {d.dispensedBoxes > 0 && <> · dispensed {d.dispensedBoxes}</>}
                                {d.treatmentStarted && d.treatmentStartedAt && (
                                  <> · started {fmtDate(d.treatmentStartedAt)}</>
                                )}
                              </p>
                              <span
                                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-sm font-medium ${statusTone(
                                  d.status,
                                )}`}
                              >
                                {STATUS_LABEL[d.status]}
                              </span>
                            </div>

                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                disabled={ledger?.busy}
                                onClick={() =>
                                  setOpenPurchaseKit(
                                    openPurchaseKit === item.kitId ? null : item.kitId,
                                  )
                                }
                                className="rounded-md border border-stone-300 bg-white min-h-11 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-stone-50 disabled:opacity-50"
                              >
                                {openPurchaseKit === item.kitId ? "Close" : "Record purchase…"}
                              </button>
                            </div>

                            {openPurchaseKit === item.kitId && ledger && (
                              <RecordForm
                                kits={purchaseKits}
                                currentKitId={item.kitId}
                                defaultBoxes={Math.max(1, d.remainingBoxes || line.recommendedBoxes)}
                                busy={ledger.busy}
                                onCancel={() => setOpenPurchaseKit(null)}
                                onSubmit={async (payload) => {
                                  await ledger.postEvent(item.kitId, payload);
                                  setOpenPurchaseKit(null);
                                }}
                              />
                            )}

                            {line.events.length > 0 && (
                              <ul className="mt-2 space-y-1 border-l-2 border-stone-100 pl-3">
                                {[...line.events]
                                  .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
                                  .map((e) => (
                                    <li key={e.id} className="text-sm text-slate-600">
                                      <span className="text-slate-400">{fmtDate(e.occurredAt)}</span>{" "}
                                      · {EVENT_LABEL[e.eventType]}
                                      {e.boxes != null && (
                                        <> · {e.boxes} box{e.boxes === 1 ? "" : "es"}</>
                                      )}
                                      {e.saleValueMinor != null && <> · sale {fmtINR(e.saleValueMinor)}</>}
                                      {e.transactionId && (
                                        <span className="break-all"> · transaction {e.transactionId}</span>
                                      )}
                                      {e.note && <> · {e.note}</>}
                                    </li>
                                  ))}
                              </ul>
                            )}
                          </div>
                        );
                      })()}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Purchase error + fulfilment, shown once beneath the order. The
          approved lineup is never changed by anything here. */}
      {ledger?.unavailable && (
        <p className="rounded-xl border border-[color:var(--hd-border)] bg-[color:var(--hd-surface-alt)] px-4 py-2.5 text-sm text-[color:var(--hd-text-secondary)]">
          Purchase tracking is not enabled yet in this environment.
        </p>
      )}
      {ledger?.error && (
        <p role="alert" className="text-sm text-[color:var(--hd-critical-ink)]">
          {ledger.error}
        </p>
      )}
      {hasLedger && !ledger?.loading && ledger?.intentId && (
        <PartialKitCheckout
          endpoint={`/api/doctor/orders/${ledger.intentId}/transactions`}
          doctor
          quantitiesAreRemaining
          onChanged={() => void ledger?.reload()}
          items={(ledger?.lines ?? []).map((l) => ({
            kitId: l.kitId,
            label: l.kitLabel,
            unitMinor: l.catalogUnitMinor,
            maxBoxes: ["DECLINED", "DISCONTINUED", "SUBSTITUTED"].includes(l.lineStatus)
              ? 0
              : Math.max(0, l.derived.remainingBoxes - (l.derived.externallyObtainedBoxes ?? 0)),
          }))}
        />
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

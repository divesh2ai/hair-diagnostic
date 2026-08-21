"use client";

import type { Consultation } from "@shared/types/consultation";
import { KitLineupEditor } from "../KitLineupEditor";
import { TopicalsCard } from "@/components/consultation";
import { ProductImage } from "@/components/kits/ProductImage";
import { useKitCatalog } from "@/lib/doctor/kitCatalog";
import {
  buildProtocolItems,
  summarizeProtocol,
  planReasoning,
} from "@/lib/doctor/protocolModel";

// WHAT ARE WE TREATING? — the protocol, and the reasoning that produced it.
//
// ── Why this is not a product list ─────────────────────────────────────────
// The old surface showed kits as cards in a tab: a name, a price-shaped block
// and marketing-length copy. That reads as a shop, and it answers the wrong
// question. A doctor approving a plan needs the clinical chain — what problem
// is being treated, what the treatment is meant to achieve, and which protocol
// does it. So each item leads with the driver and the objective, and the kit
// name sits underneath them as the answer, not the headline.
//
// ── Nothing here is computed ───────────────────────────────────────────────
// Drivers, rationale and sequence come from the persisted engine output;
// objectives come from the authored kit registry. This component chooses
// typography. It does not choose kits, and it does not explain a selection the
// engine did not explain — a missing line stays missing.
//
// ── The editor is reused, not rebuilt ──────────────────────────────────────
// Reorder / remove / add / save all still belong to KitLineupEditor, including
// its optimistic-concurrency handling. This section supplies the clinical
// explanation around it and reports staged edits upward so the decision bar
// can state what is actually about to be approved.

export interface ProtocolSectionProps {
  consultation: Consultation;
  assessmentId: string;
  expectedContentVersion: number;
  /** Approved consultations are locked — the order was cut from this lineup. */
  isApproved: boolean;
  onSaved: () => Promise<void> | void;
  onConflict: () => Promise<void> | void;
  /** Staged, unsaved lineup edits — surfaced so approval can be guarded. */
  onDirtyChange?: (dirty: boolean) => void;
  /**
   * Whether the doctor has opened the lineup for adjustment.
   *
   * The editor is not on screen by default. The common case by a wide margin
   * is a doctor who agrees with the protocol and approves it, and for them a
   * permanently open reorder/remove/add panel is a large block of controls
   * sitting between the plan and the decision — read as something that must be
   * dealt with before approving. "Request changes" on the decision bar opens
   * it, which is also the answer to "what do I press to change this".
   */
  adjustOpen?: boolean;
  /** Close the panel and return to the read-only protocol. */
  onCloseAdjust?: () => void;
  /**
   * Hand the case back for regeneration.
   *
   * Lives inside the panel rather than on the decision bar because it is the
   * escalation FROM adjusting: a doctor reaches for it once they have opened
   * the lineup and concluded the problem is not one to fix by hand.
   */
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
  const reasoning = planReasoning(consultation);
  const topicals = consultation.treatmentPlan.topicals ?? [];

  return (
    <section aria-labelledby="protocol-heading" className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="protocol-heading" className="hd-step-label">
          <span className="hd-step-num" aria-hidden>
            2
          </span>
          The plan
        </h2>
        {/* The decision summary. Counts only what the record can prove — see
            ProtocolSummary on why removals are not claimed here. */}
        <p className="text-xs text-stone-600">
          <span className="font-medium text-slate-800">
            {summary.count === 0
              ? "No interventions selected"
              : `${summary.count} intervention${summary.count === 1 ? "" : "s"} selected`}
          </span>
          {summary.addedByDoctor > 0 && (
            <span className="text-teal-700">
              {" · "}
              {summary.addedByDoctor} added by doctor
            </span>
          )}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-sm text-stone-600">
          No kit protocol was selected for this assessment.
        </p>
      ) : (
        <ol className="space-y-3">
          {items.map((item) => (
            <li
              key={`${item.kitId}-${item.phase}`}
              className="hd-card flex gap-4 px-4 py-4 sm:px-5"
            >
              {/* The packshot. It is here so the doctor recognises what is
                  being dispensed and can spot a wrong product at a glance —
                  a real check, and the reason it is rendered large enough to
                  read the name printed on the carton. Sizing, padding and the
                  no-crop rule live in components/kits/ProductImage. */}
              <ProductImage id={item.kitId} category="kit" size="lg" />

              <div className="min-w-0 flex-1">
              {/* CLINICAL DRIVER → THERAPEUTIC OBJECTIVE → PROTOCOL. The two
                  clinical lines sit above the product name deliberately. */}
              {item.drivers.length > 0 && (
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                  {item.drivers.slice(0, 3).join(" · ")}
                </p>
              )}
              {item.objective && (
                <p className="mt-1 text-sm leading-relaxed text-slate-700">
                  {item.objective}
                </p>
              )}

              <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="text-[11px] font-medium tabular-nums text-stone-400">
                  {item.phase}
                </span>
                <h3 className="font-serif text-lg text-slate-900">{item.name}</h3>
                {item.addedByDoctor && (
                  // Restrained by design. "Dr FACT proposes, the doctor
                  // finalises" — a doctor's own change is not a warning.
                  <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-teal-800">
                    Added by doctor
                  </span>
                )}
              </div>

              {item.rationale && (
                <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-slate-600">
                  {item.rationale}
                </p>
              )}

              {/* Formulation depth is real reference material but not part of
                  the approve decision, so it opens on demand. */}
              {(item.keyIngredients.length > 0 ||
                item.mechanismOfAction.length > 0) && (
                <details className="group mt-2.5">
                  <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[11px] font-medium text-stone-500 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500">
                    Formulation detail
                    <span className="text-stone-400 transition-transform group-open:rotate-180" aria-hidden>
                      ▾
                    </span>
                  </summary>
                  <div className="mt-2 space-y-2 border-l-2 border-stone-200 pl-3">
                    {item.keyIngredients.length > 0 && (
                      <p className="text-xs text-slate-600">
                        <span className="font-medium text-slate-800">
                          Key ingredients:{" "}
                        </span>
                        {item.keyIngredients.join(", ")}
                      </p>
                    )}
                    {item.mechanismOfAction.length > 0 && (
                      <ul className="space-y-1 text-xs text-slate-600">
                        {item.mechanismOfAction.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
              )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* Why this combination, in this order — the only place the engine
          explains the sequence rather than an individual kit. */}
      {(reasoning.sequencing || reasoning.collective) && (
        <div className="space-y-2 border-l-2 border-stone-200 pl-4">
          {reasoning.collective && (
            <p className="max-w-prose text-sm leading-relaxed text-slate-600">
              {reasoning.collective}
            </p>
          )}
          {reasoning.sequencing && (
            <p className="max-w-prose text-sm leading-relaxed text-slate-600">
              {reasoning.sequencing}
            </p>
          )}
        </div>
      )}

      {topicals.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
            Topical recommendations
          </h3>
          <TopicalsCard topicals={topicals} />
        </div>
      )}

      {/* Doctor authority over the lineup. Locked once approved, because the
          kit order has already been cut from exactly this list. */}
      {isApproved ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900">
          Lineup locked — this consultation is approved and the kit order was
          created from the protocol above.
        </p>
      ) : !adjustOpen ? null : (
        <div
          id="adjust-protocol"
          className="hd-card space-y-3 border-[color:var(--hd-attention)]/30 bg-[color:var(--hd-attention-tint)] p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="hd-eyebrow !text-[color:var(--hd-attention)]">
              Adjust protocol — doctor authority
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

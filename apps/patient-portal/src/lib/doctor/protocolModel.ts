// WHAT ARE WE TREATING, AND WHY — the protocol view of a consultation.
//
// ── This module maps; it does not decide ────────────────────────────────────
// Every field below is read from persisted engine output or the authored kit
// registry. There is no scoring, no ranking and no clinical rule here. The
// kit sequence was decided by the kit-scorer, versioned and replayed; a
// presentation layer that re-derived any part of it would be a second,
// untested clinical engine living in the browser.
//
// ── The three lines a doctor actually needs ─────────────────────────────────
//   CLINICAL DRIVER      phase.supportingConditions — the Root Cause Analysis
//                        conditions this kit was selected to address.
//   THERAPEUTIC OBJECTIVE kit registry `treatmentObjective` — the authored
//                        one-sentence aim for the kit ("why this kit").
//   PROTOCOL             phase.displayName.
//
// Each is omitted when its source is empty. A protocol item with no recorded
// driver renders without a driver line rather than borrowing the primary
// diagnosis, which would assert a mapping the engine never made.
//
// ── What we can and cannot say about doctor changes ────────────────────────
// A kit the doctor added carries `meta.addedByDoctor`, so additions are
// provable. Removals and reordering are NOT: the saved consultation holds the
// current lineup only, and the engine's original sequence is not retained
// alongside it. So this module counts what it can prove and stays silent
// about the rest — see `ProtocolSummary`.

import type { Consultation, TreatmentPhase } from "@shared/types/consultation";
import type { KitCatalogItem } from "./kitCatalog";

export interface ProtocolItem {
  /** 1..N, as ordered by the engine or the reviewing doctor. */
  phase: number;
  kitId: string;
  /** The protocol / kit name. */
  name: string;
  /** Root-cause conditions this kit addresses. May be empty. */
  drivers: string[];
  /** Authored registry objective. Null when the kit is not in the registry. */
  objective: string | null;
  /** Per-patient evidence chain for this selection. */
  rationale: string | null;
  /** Provable provenance: this kit was added by the reviewing doctor. */
  addedByDoctor: boolean;
  keyIngredients: string[];
  mechanismOfAction: string[];
}

export interface ProtocolSummary {
  /** Interventions in the lineup the doctor is about to approve. */
  count: number;
  /** Kits added by a doctor. Provable from stored provenance. */
  addedByDoctor: number;
  /**
   * Whether any doctor change to the lineup is provable from stored data.
   *
   * True only when a phase carries doctor provenance. A doctor who removed or
   * reordered kits and saved leaves no such mark, so this stays false — the UI
   * must not claim a modification it cannot evidence, nor claim none was made.
   */
  doctorAdjusted: boolean;
}

/** Reads the doctor-provenance flags the lineup editor writes. */
function addedByDoctor(phase: TreatmentPhase): boolean {
  const meta = (phase as { meta?: { addedByDoctor?: boolean } }).meta;
  if (meta?.addedByDoctor === true) return true;
  return (phase as { doctorEdited?: boolean }).doctorEdited === true;
}

export function buildProtocolItems(
  phases: readonly TreatmentPhase[],
  catalog: ReadonlyMap<string, KitCatalogItem>,
): ProtocolItem[] {
  return phases.map((p, i) => {
    const info = catalog.get(p.kitId);
    return {
      // Trust array order over the stored integer: the editor renumbers on
      // save, but a lineup rendered mid-edit should still read 1..N.
      phase: i + 1,
      kitId: p.kitId,
      name: p.displayName || p.kitId,
      drivers: (p.supportingConditions ?? []).filter(Boolean),
      objective: info?.treatmentObjective?.trim() || null,
      rationale: p.whySelected?.trim() || null,
      addedByDoctor: addedByDoctor(p),
      keyIngredients: p.keyIngredients ?? [],
      mechanismOfAction: p.mechanismOfAction ?? [],
    };
  });
}

export function summarizeProtocol(
  phases: readonly TreatmentPhase[],
): ProtocolSummary {
  const added = phases.filter(addedByDoctor).length;
  return {
    count: phases.length,
    addedByDoctor: added,
    doctorAdjusted: added > 0,
  };
}

/**
 * Plan-level reasoning — why this *combination*, in this order.
 *
 * Distinct from a single kit's rationale and the only place the engine
 * explains sequencing. Returned as plain strings so the section can render
 * them without knowing the engine's shape.
 */
export function planReasoning(consultation: Consultation): {
  sequencing: string | null;
  collective: string | null;
} {
  const r = consultation.rootCauseRationale;
  return {
    sequencing: r?.sequencingRationale?.trim() || null,
    collective: r?.collectiveRationale?.trim() || null,
  };
}

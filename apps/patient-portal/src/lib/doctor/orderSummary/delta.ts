// Patient Order Summary — recommendation delta.
//
// The one question this column answers: how does what the DOCTOR finally
// authorised differ from what HAIROS originally recommended?
//
//   SYSTEM RECOMMENDATION  ConsultationVersion contentVersion=1 kit lineup
//            vs
//   FINAL ORDER            KitOrderIntent.kitIds (== the approved version's
//                          lineup, captured at approval time)
//
// ── What this compares, and what it deliberately does not ────────────────────
// Comparison is on the canonical kit id, never the display label. Two kits with
// similar names are two kits; a kit renamed in the registry is still the same
// kit. String matching (`includes("Gold")`) is never used.
//
// The order model stores no custom doctor-entered kits, no topical products and
// no per-kit quantities (KitOrderIntent.quantities is null in the pilot and
// TreatmentPhase carries only a kitId). Those concepts therefore have no data
// to compare and are not invented here. Quantity IS modelled below so that if
// `quantities` is ever populated the delta already accounts for it — but with
// today's data every kit resolves to a quantity of 1 and `quantityChanged` is
// always empty.
//
// Historical truth: when the original system snapshot is absent (a legacy order
// whose v1 consultation was never stored), the delta is `indeterminate`. The
// final lineup is NEVER substituted for the original — a report that cannot say
// what changed must say so, not guess.

/** One kit line as read from a stored lineup. Quantity defaults to 1. */
export interface KitLineInput {
  kitId: string;
  quantity?: number;
}

/** A normalized, deduplicated kit line. */
export interface NormalizedKitLine {
  kitId: string;
  quantity: number;
}

/** A kit present on both sides whose quantity moved. */
export interface KitQuantityChange {
  kitId: string;
  from: number;
  to: number;
}

/**
 * A removed→added pairing, surfaced ONLY when the change is unambiguously a
 * one-for-one swap (exactly one kit removed and exactly one added). Any other
 * shape is left as independent add/remove rows, which is safer and more
 * auditable than guessing which removal pairs with which addition.
 */
export interface KitReplacement {
  removedKitId: string;
  addedKitId: string;
}

export type OrderDeltaStatus = "unchanged" | "modified" | "indeterminate";

export interface OrderDelta {
  status: OrderDeltaStatus;
  /** In the final order, absent from the system recommendation. */
  added: NormalizedKitLine[];
  /** In the system recommendation, absent from the final order. */
  removed: NormalizedKitLine[];
  /** Same kit id on both sides, quantity differs. */
  quantityChanged: KitQuantityChange[];
  /** Same kit id and quantity on both sides. */
  unchanged: NormalizedKitLine[];
  /**
   * Advisory: a single clean swap, derived from `added`/`removed`. Empty unless
   * exactly one kit was removed and exactly one added (and no quantity change).
   * `added`/`removed` remain populated regardless so a consumer that ignores
   * replacements still sees the full picture.
   */
  replacements: KitReplacement[];
}

/**
 * Collapse a raw lineup into deduplicated, quantity-summed lines keyed by kit
 * id. Ordering is discarded — a reordered lineup is not a change — and blank
 * ids are dropped. A repeated kit id sums its quantities (a lineup that lists
 * the same kit twice means two of it).
 */
export function normalizeLineup(
  lines: readonly KitLineInput[],
): NormalizedKitLine[] {
  const byKit = new Map<string, number>();
  for (const line of lines) {
    const kitId = (line?.kitId ?? "").trim();
    if (!kitId) continue;
    const raw = line.quantity;
    const qty =
      typeof raw === "number" && Number.isFinite(raw) && raw > 0
        ? Math.floor(raw)
        : 1;
    byKit.set(kitId, (byKit.get(kitId) ?? 0) + qty);
  }
  return [...byKit.entries()]
    .map(([kitId, quantity]) => ({ kitId, quantity }))
    .sort((a, b) => a.kitId.localeCompare(b.kitId));
}

/**
 * Compute the delta between the system recommendation and the final order.
 *
 * `system === null` means the original recommendation was never persisted for
 * this record — the result is `indeterminate` and carries no add/remove/change
 * rows, because none can be computed honestly.
 */
export function computeOrderDelta(
  system: readonly KitLineInput[] | null,
  final: readonly KitLineInput[],
): OrderDelta {
  if (system === null) {
    return {
      status: "indeterminate",
      added: [],
      removed: [],
      quantityChanged: [],
      unchanged: [],
      replacements: [],
    };
  }

  const sys = new Map(normalizeLineup(system).map((l) => [l.kitId, l.quantity]));
  const fin = new Map(normalizeLineup(final).map((l) => [l.kitId, l.quantity]));

  const added: NormalizedKitLine[] = [];
  const removed: NormalizedKitLine[] = [];
  const quantityChanged: KitQuantityChange[] = [];
  const unchanged: NormalizedKitLine[] = [];

  for (const [kitId, qty] of fin) {
    if (!sys.has(kitId)) {
      added.push({ kitId, quantity: qty });
    } else {
      const before = sys.get(kitId)!;
      if (before !== qty) quantityChanged.push({ kitId, from: before, to: qty });
      else unchanged.push({ kitId, quantity: qty });
    }
  }
  for (const [kitId, qty] of sys) {
    if (!fin.has(kitId)) removed.push({ kitId, quantity: qty });
  }

  // Deterministic ordering so the rendered column and the export are stable.
  added.sort((a, b) => a.kitId.localeCompare(b.kitId));
  removed.sort((a, b) => a.kitId.localeCompare(b.kitId));
  quantityChanged.sort((a, b) => a.kitId.localeCompare(b.kitId));
  unchanged.sort((a, b) => a.kitId.localeCompare(b.kitId));

  const modified =
    added.length > 0 || removed.length > 0 || quantityChanged.length > 0;

  // A clean one-for-one swap is the only replacement we assert. Anything else
  // stays as independent rows.
  const replacements: KitReplacement[] =
    added.length === 1 && removed.length === 1 && quantityChanged.length === 0
      ? [{ removedKitId: removed[0]!.kitId, addedKitId: added[0]!.kitId }]
      : [];

  return {
    status: modified ? "modified" : "unchanged",
    added,
    removed,
    quantityChanged,
    unchanged,
    replacements,
  };
}

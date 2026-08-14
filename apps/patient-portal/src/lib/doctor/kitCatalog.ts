"use client";

// The orderable kit catalog, fetched once per page and shared.
//
// ── Why a module-level cache ────────────────────────────────────────────────
// Two surfaces need the same registry data: ProtocolSection needs each kit's
// treatment objective to state the therapeutic aim, and KitLineupEditor needs
// the full entry to build a TreatmentPhase when a doctor adds a kit. Before
// this, the editor fetched /api/kits on its own and the objective simply was
// not available to the protocol view. Two independent fetches of an identical,
// immutable catalog is waste the doctor pays for in latency.
//
// The promise — not the resolved array — is cached, so concurrent callers
// mounting in the same tick share one request rather than racing two.
//
// ── This is a registry, not clinical content ───────────────────────────────
// Everything here is authored kit metadata (display name, treatment objective,
// price). Nothing patient-specific lives in this module, so caching it for the
// lifetime of the page cannot leak one patient's data into another's view.

import { useEffect, useMemo, useState } from "react";

export interface KitCatalogItem {
  kitId: string;
  displayName: string;
  /** Registry `treatmentObjective` — "why this kit", one sentence. */
  treatmentObjective: string | null;
  therapeuticStrategy: string[];
  formulationRationale: { group: string; ingredients: string[]; action: string }[];
  priceInr: number;
  priceLabel: string;
}

let inflight: Promise<KitCatalogItem[]> | null = null;

/**
 * Load the catalog, reusing an in-flight or completed request.
 *
 * Resolves to `[]` rather than rejecting. Callers use this for supporting
 * copy: a catalog outage should cost the objective line, never the protocol.
 */
export function loadKitCatalog(): Promise<KitCatalogItem[]> {
  if (!inflight) {
    inflight = fetch("/api/kits", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((j: { items?: KitCatalogItem[] }) => j.items ?? [])
      .catch(() => {
        // Clear the cache so a later mount can retry rather than being stuck
        // with a permanently empty catalog from one dropped request.
        inflight = null;
        return [];
      });
  }
  return inflight;
}

/** Test seam — resets the shared cache between cases. */
export function __resetKitCatalogCache(): void {
  inflight = null;
}

export interface KitCatalogState {
  items: KitCatalogItem[];
  /** kitId → registry entry, for O(1) lookup while rendering phases. */
  byKitId: Map<string, KitCatalogItem>;
  loading: boolean;
}

/**
 * Subscribe to the shared catalog.
 *
 * Never throws and never surfaces an error state: consumers degrade by
 * omitting the objective line. A missing sentence is honest; a fabricated one
 * would not be.
 */
export function useKitCatalog(): KitCatalogState {
  const [items, setItems] = useState<KitCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void loadKitCatalog().then((next) => {
      if (!alive) return;
      setItems(next);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Memoised so consumers get a stable Map identity between renders rather
  // than a fresh one on every paint.
  const byKitId = useMemo(
    () => new Map(items.map((i) => [i.kitId, i])),
    [items],
  );

  return { items, byKitId, loading };
}

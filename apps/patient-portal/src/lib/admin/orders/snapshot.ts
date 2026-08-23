// Kit Order Intent export — data layer.
//
// ── What this exports, and what it deliberately does not ────────────────────
// `KitOrderIntent` is NOT a commercial order. The schema says so at its own
// definition: "This is NOT billing, inventory, payments, or fulfilment — just
// the least amount of state needed for ops to act on the doctor's
// authorization." There is no payment model, no fulfilment model, no order
// line, no SKU, no discount and no captured price anywhere in the database.
//
// So this module exports what actually exists — a doctor's approval-time
// intent to operationalize a kit lineup — and labels money as INDICATIVE,
// because the only price source in the codebase is `KIT_PRICE_INR`, a
// hand-maintained TypeScript constant whose own header says it is "NOT the
// source of truth for actual invoicing, which is owned by the Instamojo/SKU
// integration when it lands".
//
// Nothing here infers a payment state, a delivery state or a business
// vertical. Those columns are absent rather than guessed.

import { z } from "zod";
import type { KitOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
// Deliberately NOT importing `priceForKit`: it substitutes an undocumented
// DEFAULT_PRICE_INR (₹5,500) for any kit missing from the sheet. That default
// has no business rule behind it anywhere in the repo, and silently folding it
// into a financial total makes the dashboard look more complete than the data
// actually is. This module reads the price table directly so an unknown kit
// yields null and is EXCLUDED from monetary aggregation, with the exclusion
// surfaced rather than hidden.
//
// `priceForKit` is left untouched for its other consumers (cart, kit catalogue,
// clinic orders page) — changing their behaviour is out of scope here, though
// the patient-facing cart inheriting a ₹5,500 guess is worth a separate look.
import { KIT_PRICE_INR } from "@/lib/pricing/kitPrices";
import { getKitInfo } from "@hairos/packages/registries/kits/info";

/**
 * Hard ceiling on one export. Never truncate silently: the route returns an
 * explicit validation error above this and asks the admin to narrow filters.
 * Overridable per-environment; the default is deliberately conservative
 * because the workbook is assembled entirely in memory.
 */
export const MAX_EXPORT_ROWS = Number(
  process.env.ADMIN_ORDER_EXPORT_MAX_ROWS ?? 5000,
);

export const orderFilterSchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  state: z.string().trim().min(1).max(100).optional(),
  city: z.string().trim().min(1).max(100).optional(),
  clinicId: z.string().trim().min(1).max(64).optional(),
  // KitOrderStatus is the ONLY status this system stores, and it has exactly
  // two members. There is no separate payment or fulfilment status to filter.
  status: z.enum(["READY_FOR_FULFILMENT", "CANCELLED"]).optional(),
  doctorId: z.string().trim().min(1).max(64).optional(),
});

export type OrderFilters = z.infer<typeof orderFilterSchema>;

export type KitLine = {
  kitId: string;
  displayName: string;
  quantity: number;
  /** null when the kit is absent from the price sheet. Never a guessed value. */
  unitPriceInr: number | null;
  /** False when the kit id is absent from KIT_PRICE_INR. */
  pricedFromSheet: boolean;
  /** False when the kit id has no registry entry — historic or retired kit. */
  inRegistry: boolean;
};

export type OrderIntentRow = {
  intentId: string;
  createdAt: Date;
  status: KitOrderStatus;
  clinicId: string;
  clinicName: string;
  state: string | null;
  city: string | null;
  doctorName: string;
  assessmentId: string;
  /** Patient.id — an opaque cuid. No name, phone, email or address is loaded. */
  patientRef: string;
  /** Assessment.source: how the assessment was captured, not an order channel. */
  assessmentSource: string;
  kits: KitLine[];
  units: number;
  /**
   * null when ANY kit on the intent has no sheet price. A row total computed
   * from a partial lineup would understate the intent while looking exact, so
   * the row is excluded from monetary aggregation entirely and counted as an
   * exclusion instead.
   */
  indicativeValueInr: number | null;
  /** True when this row is excluded from every monetary total. */
  priceUnavailable: boolean;
  /** Any data-quality caveat that makes a figure on this row less trustworthy. */
  dataQualityFlags: string[];
};

export type OrderSnapshot = {
  rows: OrderIntentRow[];
  /** Clinics actually present in `rows` — drives Clinic Summary. */
  clinics: Array<{ id: string; name: string; state: string | null; city: string | null }>;
  /** States actually present in `rows`. */
  states: string[];
  /**
   * The unfiltered universe, for populating filter dropdowns.
   *
   * Kept separate from `clinics`/`states` on purpose: driving the dropdowns
   * off the filtered result would collapse each list to whatever is already
   * selected, and an admin who picked one state could never switch to
   * another without clearing everything.
   */
  allClinics: Array<{ id: string; name: string }>;
  allStates: string[];
  generatedAt: Date;
  filters: OrderFilters;
};

/** `quantities` is `{ kitId: number }` or null when quantities aren't defined yet. */
function quantityFor(quantities: unknown, kitId: string): number {
  if (quantities && typeof quantities === "object" && !Array.isArray(quantities)) {
    const raw = (quantities as Record<string, unknown>)[kitId];
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
      return Math.floor(raw);
    }
  }
  // Absent quantity means one of that kit — the lineup is a set of kits.
  return 1;
}

function buildKitLines(kitIds: string[], quantities: unknown): KitLine[] {
  return kitIds.map((kitId) => {
    const info = getKitInfo(kitId);
    const pricedFromSheet = Object.prototype.hasOwnProperty.call(
      KIT_PRICE_INR,
      kitId,
    );
    return {
      kitId,
      // A kit on a historic intent may have been retired from the registry.
      // Fall back to the raw id rather than dropping the line.
      displayName: info?.displayName ?? kitId,
      quantity: quantityFor(quantities, kitId),
      // No price sheet entry means no price. Not a default.
      unitPriceInr: pricedFromSheet ? KIT_PRICE_INR[kitId]! : null,
      pricedFromSheet,
      inRegistry: info !== null,
    };
  });
}

/**
 * One consistent snapshot for every workbook tab.
 *
 * Runs inside a single interactive transaction. The deployed Prisma client
 * goes through pgbouncer with `connection_limit=1`, so independent parallel
 * queries starve the pool; an interactive transaction is sequential on one
 * connection, which is what pgbouncer expects. Every tab is then derived in
 * memory from `rows`, which is what makes the summaries reconcile exactly to
 * Order Details rather than being recomputed against a shifting database.
 */
export async function loadOrderSnapshot(
  filters: OrderFilters,
): Promise<OrderSnapshot | { overflow: true; count: number; limit: number }> {
  return prisma.$transaction(async (tx) => {
    // Geography lives on ClinicLocation, never on the intent. Resolve the
    // clinic → primary-location map first so state/city can be filtered and
    // reported without a per-row join.
    const clinicRecords = await tx.clinic.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        locations: {
          where: { deletedAt: null, isPrimary: true },
          select: { state: true, city: true },
          take: 1,
        },
      },
    });

    const geography = new Map<string, { name: string; state: string | null; city: string | null }>();
    for (const c of clinicRecords) {
      geography.set(c.id, {
        name: c.name,
        state: c.locations[0]?.state ?? null,
        city: c.locations[0]?.city ?? null,
      });
    }

    // Narrow to clinics matching the geography filters, if any were given.
    let clinicIdScope: string[] | null = null;
    if (filters.state || filters.city || filters.clinicId) {
      clinicIdScope = [...geography.entries()]
        .filter(([id, g]) => {
          if (filters.clinicId && id !== filters.clinicId) return false;
          if (filters.state && (g.state ?? "") !== filters.state) return false;
          if (filters.city && (g.city ?? "") !== filters.city) return false;
          return true;
        })
        .map(([id]) => id);
    }

    const where = {
      ...(clinicIdScope ? { clinicId: { in: clinicIdScope } } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.doctorId ? { doctorId: filters.doctorId } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
      // KitOrderIntent has no `deletedAt` column — it is not soft-deleted.
      // Soft deletion IS applied to every related model that supports it, so
      // an intent belonging to an archived clinic or a soft-deleted
      // assessment is excluded. This is documented in the workbook rather
      // than applied silently.
      clinic: { deletedAt: null },
      assessment: { deletedAt: null },
      doctor: { deletedAt: null },
    };

    // Count before fetching so an oversized export is refused outright
    // instead of being quietly cut to the first N rows.
    const count = await tx.kitOrderIntent.count({ where });
    if (count > MAX_EXPORT_ROWS) {
      return { overflow: true as const, count, limit: MAX_EXPORT_ROWS };
    }

    const intents = await tx.kitOrderIntent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        status: true,
        clinicId: true,
        kitIds: true,
        quantities: true,
        doctor: { select: { name: true } },
        assessment: { select: { id: true, source: true, patientId: true } },
      },
    });

    const rows: OrderIntentRow[] = intents.map((i) => {
      const geo = geography.get(i.clinicId);
      const kits = buildKitLines(i.kitIds, i.quantities);
      const units = kits.reduce((s, k) => s + k.quantity, 0);

      // An intent is valued only when EVERY kit on it has a sheet price, and
      // only when it actually carries kits. Anything else is excluded rather
      // than partially summed.
      const priceUnavailable =
        kits.length === 0 || kits.some((k) => k.unitPriceInr === null);
      const indicativeValueInr = priceUnavailable
        ? null
        : kits.reduce((s, k) => s + k.unitPriceInr! * k.quantity, 0);

      const dataQualityFlags: string[] = [];
      if (!geo?.state) dataQualityFlags.push("No state on clinic's primary location");
      if (kits.some((k) => !k.pricedFromSheet))
        dataQualityFlags.push(
          "Kit absent from price sheet — excluded from indicative value",
        );
      if (kits.some((k) => !k.inRegistry))
        dataQualityFlags.push("Kit has no registry entry — shown by internal id");
      if (kits.length === 0) dataQualityFlags.push("Intent carries no kits");

      return {
        intentId: i.id,
        createdAt: i.createdAt,
        status: i.status,
        clinicId: i.clinicId,
        clinicName: geo?.name ?? i.clinicId,
        state: geo?.state ?? null,
        city: geo?.city ?? null,
        doctorName: i.doctor.name,
        assessmentId: i.assessment.id,
        patientRef: i.assessment.patientId,
        assessmentSource: i.assessment.source,
        kits,
        units,
        indicativeValueInr,
        priceUnavailable,
        dataQualityFlags,
      };
    });

    const representedClinicIds = new Set(rows.map((r) => r.clinicId));

    return {
      rows,
      clinics: [...geography.entries()]
        .filter(([id]) => representedClinicIds.has(id))
        .map(([id, g]) => ({ id, name: g.name, state: g.state, city: g.city })),
      states: [
        ...new Set(rows.map((r) => r.state).filter((s): s is string => !!s)),
      ].sort(),
      // Derived from the unfiltered geography map already in memory — no
      // extra query, and the dropdowns stay stable as filters change.
      allClinics: [...geography.entries()]
        .map(([id, g]) => ({ id, name: g.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      allStates: [
        ...new Set(
          [...geography.values()].map((g) => g.state).filter((s): s is string => !!s),
        ),
      ].sort(),
      generatedAt: new Date(),
      filters,
    };
  });
}

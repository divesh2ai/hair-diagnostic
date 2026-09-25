// Patient Order Summary — canonical clinic reporting query.
//
// ONE service builds the visible table, the CSV and the Excel workbook, so the
// three can never disagree about totals. The page slices a page out of the same
// row set the exports serialise whole.
//
// ── The audit trail this assembles ──────────────────────────────────────────
//   WHAT THE PATIENT PRESENTED WITH   goal + symptoms, from the approved
//                                     consultation's persisted clinical summary
//   WHAT HAIROS RECOMMENDED           ConsultationVersion contentVersion=1 kits
//   WHAT THE DOCTOR CHANGED           delta of v1 vs the final order lineup
//   WHAT WAS FINALLY GIVEN            KitOrderIntent.kitIds (approval snapshot)
//   WHAT THE FINAL ORDER WAS WORTH    indicative value from the price sheet
//
// ── Money is INDICATIVE, never invoiced ─────────────────────────────────────
// The only price source in this system is the hand-maintained KIT_PRICE_INR
// table. There is no persisted per-order price snapshot, so a historical total
// reflects TODAY's sheet. Like the Super Admin export, this reads the table
// DIRECTLY (not `priceForKit`, which substitutes an undocumented ₹5,500 default)
// so a kit with no sheet entry yields null and its order is EXCLUDED from every
// monetary total rather than silently inflated. The exclusion is surfaced, not
// hidden.
//
// ── Historical truth ────────────────────────────────────────────────────────
// The system recommendation comes from the immutable v1 snapshot. When that
// snapshot was never stored (a legacy order), the delta is `indeterminate` and
// the report says so — the final lineup is never passed off as the original.

import { z } from "zod";
import type { KitOrderStatus, PrismaClient } from "@prisma/client";
import type { Consultation } from "@shared/types/consultation";
import { KIT_PRICE_INR } from "@/lib/pricing/kitPrices";
import { DEFAULT_KIT_QUANTITY } from "@/lib/commerce/kitQuantity";
import { getKitInfo } from "@hairos/packages/registries/kits/info";
import { extractKitIds } from "@/lib/consultation/approveAndCreateOrder";
import { buildClinicalSummary } from "@/lib/doctor/clinicalSummary";
import { computeOrderDelta, type OrderDelta } from "./delta";

/**
 * Hard ceiling on one report load. The row set is assembled in memory so
 * metrics reconcile exactly to the table and the export; an oversized range is
 * refused with an actionable message rather than silently truncated.
 */
export const MAX_SUMMARY_ROWS = Number(
  process.env.DOCTOR_ORDER_SUMMARY_MAX_ROWS ?? 2000,
);

export const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export const summaryFilterSchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  doctorId: z.string().trim().min(1).max(64).optional(),
  status: z.enum(["READY_FOR_FULFILMENT", "CANCELLED"]).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  sort: z.enum(["date", "patient", "total"]).default("date"),
  dir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type SummaryFilters = z.infer<typeof summaryFilterSchema>;

/**
 * Tenant scope, derived server-side from the authenticated doctor — NEVER from
 * a client-supplied clinicId. A clinic-scoped caller can only ever see their
 * own clinic's orders; the `all` scope is reserved for Super Admin and is the
 * seam a future cross-clinic report plugs into without weakening isolation.
 */
export type SummaryScope =
  | { kind: "clinic"; clinicId: string }
  | { kind: "all" };

export interface SummaryKitLine {
  kitId: string;
  displayName: string;
  quantity: number;
  /** null when the kit has no price-sheet entry. Never a guessed value. */
  unitPriceInr: number | null;
}

export interface SummaryRow {
  intentId: string;
  createdAt: Date;
  status: KitOrderStatus;
  clinicId: string;
  clinicName: string;
  doctorName: string;
  assessmentId: string;
  patientName: string;
  /** Age at composition time, from the immutable consultation snapshot. */
  age: number | null;
  /** "Female" / "Male" / raw value; null when unrecorded. */
  gender: string | null;
  /** Patient's stated goals, engine-grouped. */
  goals: string[];
  /** Concise clinical symptoms, engine-flagged signals first. */
  symptoms: string[];
  /** v1 system recommendation, resolved to display names. null = unavailable. */
  systemRecommended: SummaryKitLine[] | null;
  /** The final ordered lineup (KitOrderIntent.kitIds). */
  finalKits: SummaryKitLine[];
  /** Sum of final kit quantities (each kit defaults to a two-month supply). */
  finalKitCount: number;
  /** Delta of system vs final. status `indeterminate` when v1 is absent. */
  delta: OrderDelta;
  /**
   * Indicative order value, or null when ANY final kit is unpriced (the whole
   * row is then excluded from monetary totals) or the order carries no kits.
   */
  totalInr: number | null;
  /** Reasons a figure on this row is less than fully trustworthy. */
  dataQualityFlags: string[];
}

export interface SummaryMetrics {
  /** Count of qualifying order rows in range (both statuses). */
  patientOrders: number;
  /** Total final kit units across non-cancelled orders. */
  finalKits: number;
  /** Indicative value of non-cancelled, fully-priced orders. */
  orderValueInr: number;
  /** Non-cancelled orders excluded from value because a kit is unpriced. */
  excludedFromValue: number;
  /** Percentage of delta-determinable orders the doctor modified. */
  doctorModifiedPct: number;
  /** Orders whose delta could be computed (v1 snapshot present). */
  deltaDeterminable: number;
  /** Orders the doctor modified (subset of determinable). */
  doctorModified: number;
}

export interface DoctorOption {
  id: string;
  name: string;
}

export interface SummaryResult {
  /** The page requested — a slice of the full matching set. */
  rows: SummaryRow[];
  /** Metrics computed across the FULL matching set, not just the page. */
  metrics: SummaryMetrics;
  /** Doctors present in the unfiltered clinic scope, for the filter dropdown. */
  doctors: DoctorOption[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  generatedAt: Date;
  filters: SummaryFilters;
}

export type SummaryOverflow = { overflow: true; count: number; limit: number };

// ── Kit resolution + pricing ────────────────────────────────────────────────

function resolveKitLine(kitId: string): SummaryKitLine {
  const info = getKitInfo(kitId);
  const priced = Object.prototype.hasOwnProperty.call(KIT_PRICE_INR, kitId);
  return {
    kitId,
    // A retired kit falls back to its raw id rather than being dropped — an
    // omitted line would understate what shipped.
    displayName: info?.displayName ?? kitId,
    // Default two-month supply per kit, matching the cart and clinic order
    // view — see lib/commerce/kitQuantity. Explicit per-kit quantities are not
    // persisted on the intent yet, so every line uses the default today.
    quantity: DEFAULT_KIT_QUANTITY,
    unitPriceInr: priced ? KIT_PRICE_INR[kitId]! : null,
  };
}

function valueOfLines(lines: SummaryKitLine[]): number | null {
  if (lines.length === 0) return null;
  if (lines.some((l) => l.unitPriceInr === null)) return null;
  return lines.reduce((s, l) => s + l.unitPriceInr! * l.quantity, 0);
}

/** Kit ids whose display name matches a free-text search term. */
function kitIdsMatchingName(term: string): string[] {
  const q = term.toLowerCase();
  return Object.keys(KIT_PRICE_INR).filter((kitId) => {
    const name = getKitInfo(kitId)?.displayName ?? kitId;
    return name.toLowerCase().includes(q) || kitId.toLowerCase().includes(q);
  });
}

// ── Clinical context extraction (reuses the doctor summary builder) ──────────

function extractContext(content: Consultation | null): {
  patientName: string;
  age: number | null;
  gender: string | null;
  goals: string[];
  symptoms: string[];
} {
  if (!content) {
    return { patientName: "—", age: null, gender: null, goals: [], symptoms: [] };
  }
  const patient = content.patient;
  let summary: ReturnType<typeof buildClinicalSummary> | null = null;
  try {
    summary = buildClinicalSummary(content);
  } catch {
    summary = null;
  }

  // Symptoms: the engine-flagged ("attention") signals first, then any other
  // reported selections, so the row leads with what actually drove the case.
  const flagged: string[] = [];
  const rest: string[] = [];
  for (const group of summary?.evidence ?? []) {
    for (const item of group.items) {
      (item.emphasis === "attention" ? flagged : rest).push(item.value);
    }
  }
  const symptoms = [...flagged, ...rest].filter(
    (v, i, a) => v && a.indexOf(v) === i,
  );

  const goals =
    summary && summary.patientGoals.length > 0
      ? summary.patientGoals
      : summary?.clinicalObjective
        ? summary.clinicalObjective.split(" · ").filter(Boolean)
        : [];

  const sex = (patient?.sex ?? "").trim();
  return {
    patientName: patient?.name ?? "—",
    age:
      typeof patient?.age === "number" && Number.isFinite(patient.age)
        ? patient.age
        : null,
    gender: sex ? sex.charAt(0).toUpperCase() + sex.slice(1) : null,
    goals,
    symptoms,
  };
}

// ── Loader ──────────────────────────────────────────────────────────────────

/**
 * Load the full matching row set, metrics and the requested page.
 *
 * Runs in a single interactive transaction: the deployed Prisma client goes
 * through pgbouncer with connection_limit=1, so parallel independent queries
 * starve the pool. Batched `findMany` lookups keyed by id avoid an N+1 across
 * consultations, versions and the price sheet.
 */
export async function loadPatientOrderSummary(
  prisma: PrismaClient,
  scope: SummaryScope,
  filters: SummaryFilters,
): Promise<SummaryResult | SummaryOverflow> {
  return prisma.$transaction(async (tx) => {
    const kitScope =
      filters.search ? kitIdsMatchingName(filters.search) : null;

    const where = {
      // Tenant isolation — a clinic scope is a hard filter the client cannot
      // widen. `all` (Super Admin) omits it.
      ...(scope.kind === "clinic" ? { clinicId: scope.clinicId } : {}),
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
      // Search matches patient name OR doctor name OR a kit on the order.
      ...(filters.search
        ? {
            OR: [
              { assessment: { patient: { name: { contains: filters.search, mode: "insensitive" as const } } } },
              { doctor: { name: { contains: filters.search, mode: "insensitive" as const } } },
              ...(kitScope && kitScope.length > 0
                ? [{ kitIds: { hasSome: kitScope } }]
                : []),
            ],
          }
        : {}),
      // KitOrderIntent has no deletedAt; exclude intents whose related records
      // were archived, mirroring the Super Admin export.
      clinic: { deletedAt: null },
      assessment: { deletedAt: null },
      doctor: { deletedAt: null },
    };

    const count = await tx.kitOrderIntent.count({ where });
    if (count > MAX_SUMMARY_ROWS) {
      return { overflow: true as const, count, limit: MAX_SUMMARY_ROWS };
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
        consultationId: true,
        consultationVersionId: true,
        clinic: { select: { name: true } },
        doctor: { select: { name: true } },
        assessment: { select: { id: true, patient: { select: { name: true } } } },
      },
    });

    // Batch-load the approved version content (demographics/goal/symptoms +
    // final lineup provenance) and the v1 system snapshot (original rec).
    const approvedVersionIds = [
      ...new Set(intents.map((i) => i.consultationVersionId)),
    ];
    const consultationIds = [...new Set(intents.map((i) => i.consultationId))];

    const [approvedVersions, firstVersions] = await Promise.all([
      tx.consultationVersion.findMany({
        where: { id: { in: approvedVersionIds } },
        select: { id: true, content: true },
      }),
      tx.consultationVersion.findMany({
        where: { consultationId: { in: consultationIds }, contentVersion: 1 },
        select: { consultationId: true, content: true },
      }),
    ]);

    const approvedById = new Map(
      approvedVersions.map((v) => [v.id, v.content as unknown as Consultation]),
    );
    const firstByConsultation = new Map(
      firstVersions.map((v) => [
        v.consultationId,
        v.content as unknown as Consultation,
      ]),
    );

    const allRows: SummaryRow[] = intents.map((i) => {
      const approved = approvedById.get(i.consultationVersionId) ?? null;
      const v1 = firstByConsultation.get(i.consultationId) ?? null;

      const ctx = extractContext(approved);
      const finalKits = i.kitIds.map(resolveKitLine);
      const finalKitCount = finalKits.reduce((s, l) => s + l.quantity, 0);

      const systemKitIds = v1 ? extractKitIds(v1) : null;
      const systemRecommended = systemKitIds
        ? systemKitIds.map(resolveKitLine)
        : null;

      const delta = computeOrderDelta(
        systemKitIds ? systemKitIds.map((kitId) => ({ kitId })) : null,
        i.kitIds.map((kitId) => ({ kitId })),
      );

      const totalInr = valueOfLines(finalKits);

      const dataQualityFlags: string[] = [];
      if (!v1) dataQualityFlags.push("Original system recommendation not stored");
      if (finalKits.length === 0) dataQualityFlags.push("Order carries no kits");
      if (finalKits.some((l) => l.unitPriceInr === null))
        dataQualityFlags.push("Kit absent from price sheet — excluded from value");

      return {
        intentId: i.id,
        createdAt: i.createdAt,
        status: i.status,
        clinicId: i.clinicId,
        clinicName: i.clinic.name,
        doctorName: i.doctor.name,
        assessmentId: i.assessment.id,
        patientName: i.assessment.patient?.name ?? ctx.patientName,
        age: ctx.age,
        gender: ctx.gender,
        goals: ctx.goals,
        symptoms: ctx.symptoms,
        systemRecommended,
        finalKits,
        finalKitCount,
        delta,
        totalInr,
        dataQualityFlags,
      };
    });

    // ── Metrics across the FULL matching set ────────────────────────────────
    const active = allRows.filter((r) => r.status !== "CANCELLED");
    const pricedActive = active.filter((r) => r.totalInr !== null);
    const determinable = allRows.filter((r) => r.delta.status !== "indeterminate");
    const modified = determinable.filter((r) => r.delta.status === "modified");

    const metrics: SummaryMetrics = {
      patientOrders: allRows.length,
      finalKits: active.reduce((s, r) => s + r.finalKitCount, 0),
      orderValueInr: pricedActive.reduce((s, r) => s + (r.totalInr ?? 0), 0),
      excludedFromValue: active.length - pricedActive.length,
      deltaDeterminable: determinable.length,
      doctorModified: modified.length,
      doctorModifiedPct: determinable.length
        ? Math.round((modified.length / determinable.length) * 100)
        : 0,
    };

    // ── Sort, then paginate the page slice ──────────────────────────────────
    const sorted = sortRows(allRows, filters.sort, filters.dir);
    const pageSize = filters.pageSize;
    const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
    const page = Math.min(filters.page, pageCount);
    const rows = sorted.slice((page - 1) * pageSize, page * pageSize);

    // Doctor dropdown from the unfiltered tenant scope (stable as filters move).
    const doctorRows = await tx.kitOrderIntent.findMany({
      where: {
        ...(scope.kind === "clinic" ? { clinicId: scope.clinicId } : {}),
        clinic: { deletedAt: null },
        doctor: { deletedAt: null },
      },
      select: { doctorId: true, doctor: { select: { name: true } } },
      distinct: ["doctorId"],
    });
    const doctors = doctorRows
      .map((d) => ({ id: d.doctorId, name: d.doctor.name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      rows,
      metrics,
      doctors,
      total: sorted.length,
      page,
      pageSize,
      pageCount,
      generatedAt: new Date(),
      filters,
    };
  });
}

/**
 * Load EVERY matching row (no page slice) for export. Delegates to the same
 * loader with a page window large enough to hold the whole capped set, so an
 * export can never contain a row the filtered table would not, and its totals
 * are the loader's own metrics.
 */
export async function loadPatientOrderSummaryAll(
  prisma: PrismaClient,
  scope: SummaryScope,
  filters: SummaryFilters,
): Promise<{ rows: SummaryRow[]; metrics: SummaryMetrics; generatedAt: Date } | SummaryOverflow> {
  const result = await loadPatientOrderSummary(prisma, scope, {
    ...filters,
    page: 1,
    // The matching set is already capped at MAX_SUMMARY_ROWS, so one window of
    // that size holds every row in sorted order.
    pageSize: MAX_SUMMARY_ROWS,
  });
  if ("overflow" in result) return result;
  return {
    rows: result.rows,
    metrics: result.metrics,
    generatedAt: result.generatedAt,
  };
}

function sortRows(
  rows: SummaryRow[],
  sort: SummaryFilters["sort"],
  dir: SummaryFilters["dir"],
): SummaryRow[] {
  const factor = dir === "asc" ? 1 : -1;
  const copy = [...rows];
  copy.sort((a, b) => {
    switch (sort) {
      case "patient":
        return factor * a.patientName.localeCompare(b.patientName);
      case "total":
        // Unpriced rows sort as the lowest value in either direction.
        return factor * ((a.totalInr ?? -1) - (b.totalInr ?? -1));
      case "date":
      default:
        return factor * (a.createdAt.getTime() - b.createdAt.getTime());
    }
  });
  return copy;
}

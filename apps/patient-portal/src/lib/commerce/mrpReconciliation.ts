// The input/output contract for reconciling repository prices against the
// authoritative MRP workbook.
//
// This file defines shapes only. It performs no reconciliation and approves
// nothing, because the workbook it describes is not in the repository:
//
//     MRP sheet fluence khushal's copy.xlsx
//       sheet "New MRP of kits"       (e.g. B1061)
//       sheet "Complete formulation"  (e.g. C70, C71, C349)
//
// Those cell references appear in docs/five-kit-real-ingestion-report.md and
// the five-kit audit files. They are PROVENANCE CLUES — evidence that someone
// once held the file — and explicitly not permission to reconstruct the prices
// they refer to.

export type ReconciliationStatus =
  | "MATCH"
  | "MISMATCH"
  | "SOURCE_MISSING"
  | "CATALOGUE_MISSING"
  | "REVIEW_REQUIRED"
  | "APPROVED";

export interface MrpSourceRef {
  workbook: string;
  sheet: string;
  /** A1-style cell, so any figure can be traced back to where it was read. */
  cell: string;
}

export interface ReconciliationRow {
  canonicalKitId: string;
  registryDisplayName: string;
  /** Current repository figure, minor units. Null when absent. */
  repoPriceMinor: number | null;
  /** Authoritative figure, minor units. Null until the workbook is supplied. */
  mrpPriceMinor: number | null;
  /** mrp - repo, minor units. Null unless both sides are present. */
  differenceMinor: number | null;
  source: MrpSourceRef | null;
  status: ReconciliationStatus;
  /**
   * Set only by a human. A row reaching APPROVED is what moves a price into
   * APPROVED_KIT_PRICES_MINOR; nothing computes its way there.
   */
  approvedBy: string | null;
  approvedAt: string | null;
  notes: string | null;
}

export interface ReconciliationReport {
  generatedAt: string;
  workbookPresent: boolean;
  rows: ReconciliationRow[];
  summary: Record<ReconciliationStatus, number>;
}

/**
 * Classify one row. Deliberately never returns APPROVED — approval is a human
 * act recorded on the row, not a computed outcome of two numbers agreeing.
 * MATCH means "the figures agree"; it does not mean "charge this".
 */
export function classifyReconciliation(
  repoPriceMinor: number | null,
  mrpPriceMinor: number | null,
  inCatalogue: boolean,
): ReconciliationStatus {
  if (!inCatalogue) return "CATALOGUE_MISSING";
  if (mrpPriceMinor === null) return "SOURCE_MISSING";
  if (repoPriceMinor === null) return "REVIEW_REQUIRED";
  return repoPriceMinor === mrpPriceMinor ? "MATCH" : "MISMATCH";
}

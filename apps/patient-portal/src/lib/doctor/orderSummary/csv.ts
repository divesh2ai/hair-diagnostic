// Patient Order Summary — CSV export.
//
// UTF-8 with a BOM (so Excel opens Indian names and the ₹ sign correctly),
// RFC-4180 quoting, and a leading apostrophe on any cell that would otherwise
// be read as a formula. The numeric amount is exported RAW (no ₹, no commas) so
// a spreadsheet can sum it; a readable label is a separate column.

import type { KitOrderStatus } from "@prisma/client";
import type { SummaryRow } from "./query";
import {
  deltaColumns,
  deltaSummary,
  kitListText,
  systemRecommendedText,
} from "./present";

const COLUMNS = [
  "Order Date (IST)",
  "Patient Name",
  "Age",
  "Gender",
  "Goal",
  "Symptoms",
  "Doctor",
  "System Recommended Kits",
  "Doctor Added Kits",
  "Doctor Removed Kits",
  "Doctor Quantity Changes",
  "Doctor Changes Summary",
  "Final Kits",
  "Final Kit Count",
  "Final Order Amount (INR)",
  "Order Value Note",
  "Order Status",
  "Assessment Reference",
] as const;

const STATUS_LABEL: Record<KitOrderStatus, string> = {
  READY_FOR_FULFILMENT: "Ready for fulfilment",
  CANCELLED: "Cancelled",
};

/** Excel/Sheets are timezone-naive; shift UTC to IST for display. */
function istStamp(d: Date): string {
  const i = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${i.getUTCFullYear()}-${p(i.getUTCMonth() + 1)}-${p(i.getUTCDate())} ${p(i.getUTCHours())}:${p(i.getUTCMinutes())}`;
}

function escapeCell(value: string | number): string {
  let s = String(value ?? "");
  // Formula-injection guard for the CSV-reopened-in-Excel case.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowToCells(row: SummaryRow): (string | number)[] {
  const cols = deltaColumns(row);
  return [
    istStamp(row.createdAt),
    row.patientName,
    row.age ?? "",
    row.gender ?? "",
    row.goals.join("; "),
    row.symptoms.join("; "),
    row.doctorName,
    systemRecommendedText(row),
    cols.added,
    cols.removed,
    cols.quantityChanges,
    deltaSummary(row),
    kitListText(row.finalKits),
    row.finalKitCount,
    // Raw numeric — empty (not 0) when unavailable, so a SUM is not understated.
    row.totalInr ?? "",
    row.totalInr === null ? "Indicative value unavailable — kit not on price sheet" : "Indicative",
    STATUS_LABEL[row.status],
    row.assessmentId,
  ];
}

export function buildSummaryCsv(rows: SummaryRow[]): string {
  const lines = [COLUMNS.map(escapeCell).join(",")];
  for (const row of rows) {
    lines.push(rowToCells(row).map(escapeCell).join(","));
  }
  // BOM + CRLF line endings (RFC 4180 / Excel-friendly).
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function csvFilename(now: Date): string {
  const i = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `patient-order-summary-${i.getUTCFullYear()}-${p(i.getUTCMonth() + 1)}-${p(i.getUTCDate())}_${p(i.getUTCHours())}${p(i.getUTCMinutes())}-IST.csv`;
}

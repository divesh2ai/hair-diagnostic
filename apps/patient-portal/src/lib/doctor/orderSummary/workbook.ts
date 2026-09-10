// Patient Order Summary — Excel workbook.
//
// Every figure is derived from the SAME `rows` the table and the CSV use, so the
// workbook reconciles to the screen. exceljs is imported only through the server
// export route, so it never reaches a client bundle.
//
// Money is INDICATIVE (live price sheet, no historical snapshot). Orders whose
// lineup includes an unpriced kit contribute NOTHING to the value and show
// "Unavailable" rather than 0 — a zero would be summed and understate the total.

import ExcelJS from "exceljs";
import type { KitOrderStatus } from "@prisma/client";
import type { SummaryRow, SummaryMetrics, SummaryFilters } from "./query";
import { deltaSummary, kitListText, systemRecommendedText } from "./present";

export const SUMMARY_WORKBOOK_SCHEMA = "patient-order-summary/v1";

const NAVY = "FF0E2A47";
const TEAL = "FF117A79";
const MINT = "FFD8F3EF";
const WHITE = "FFFFFFFF";
const AMBER_FILL = "FFFFF7E6";
const AMBER_TEXT = "FFB45309";
const GREEN_FILL = "FFDCFCE7";
const GREEN_TEXT = "FF166534";
const RED_FILL = "FFFEE2E2";
const RED_TEXT = "FFB91C1C";
const RULE = "FFD9E2EC";
const MUTED = "FF64748B";

const FMT_DATE = "yyyy-mm-dd hh:mm";
const FMT_CURRENCY = '"₹"#,##0';
const FMT_COUNT = "#,##0";

const STATUS_LABEL: Record<KitOrderStatus, string> = {
  READY_FOR_FULFILMENT: "Ready for fulfilment",
  CANCELLED: "Cancelled",
};

function safeText(value: string | null | undefined): string {
  const s = (value ?? "").toString();
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

function toIst(d: Date): Date {
  return new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
}

function istStamp(d: Date): string {
  const i = toIst(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${i.getUTCFullYear()}-${p(i.getUTCMonth() + 1)}-${p(i.getUTCDate())} ${p(i.getUTCHours())}:${p(i.getUTCMinutes())} IST`;
}

export function summaryExportFilename(now: Date): string {
  const i = toIst(now);
  const p = (n: number) => String(n).padStart(2, "0");
  return `patient-order-summary-${i.getUTCFullYear()}-${p(i.getUTCMonth() + 1)}-${p(i.getUTCDate())}_${p(i.getUTCHours())}${p(i.getUTCMinutes())}-IST.xlsx`;
}

export function describeSummaryRange(f: SummaryFilters): string {
  if (!f.from && !f.to) return "all dates";
  const from = f.from ? istStamp(new Date(f.from)) : "beginning";
  const to = f.to ? istStamp(new Date(f.to)) : "now";
  return `${from} → ${to}`;
}

export interface SummaryWorkbookMeta {
  clinicLabel: string;
  actorName: string;
  actorRole: string;
  generatedAt: Date;
  filters: SummaryFilters;
  metrics: SummaryMetrics;
}

export async function buildSummaryWorkbook(
  rows: SummaryRow[],
  meta: SummaryWorkbookMeta,
): Promise<Buffer> {
  const { generatedAt, filters, metrics } = meta;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Dr FACT HairOS";
  wb.created = generatedAt;

  // ── Sheet 1 — Patient Order Summary ─────────────────────────────────────
  {
    const ws = wb.addWorksheet("Patient Order Summary");
    ws.columns = [
      { width: 18 }, // Date
      { width: 24 }, // Patient
      { width: 6 }, //  Age
      { width: 10 }, // Gender
      { width: 26 }, // Goal
      { width: 30 }, // Symptoms
      { width: 22 }, // Doctor
      { width: 32 }, // System Recommended
      { width: 34 }, // Doctor Changes
      { width: 32 }, // Final Kits
      { width: 8 }, //  Kit Count
      { width: 16 }, // Total
      { width: 20 }, // Status
      { width: 26 }, // Assessment Ref
    ];

    // Title band + metadata.
    ws.mergeCells(1, 1, 1, 14);
    const t = ws.getCell(1, 1);
    t.value = "Patient Order Summary";
    t.font = { bold: true, size: 15, color: { argb: WHITE } };
    t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    t.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getRow(1).height = 30;

    ws.mergeCells(2, 1, 2, 14);
    const s = ws.getCell(2, 1);
    s.value = `${meta.clinicLabel} · ${describeSummaryRange(filters)} · Generated ${istStamp(generatedAt)} · money is indicative, not invoiced`;
    s.font = { size: 9, italic: true, color: { argb: MUTED } };
    s.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getRow(2).height = 18;

    // Metric strip.
    ws.mergeCells(3, 1, 3, 14);
    const m = ws.getCell(3, 1);
    m.value = `${metrics.patientOrders} patient orders · ${metrics.finalKits} final kits · ₹${metrics.orderValueInr.toLocaleString("en-IN")} order value · ${metrics.doctorModifiedPct}% doctor modified (of ${metrics.deltaDeterminable} determinable)${metrics.excludedFromValue > 0 ? ` · ${metrics.excludedFromValue} excluded from value (unpriced kit)` : ""}`;
    m.font = { size: 10, bold: true, color: { argb: NAVY } };
    m.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MINT } };
    m.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getRow(3).height = 22;

    const headers = [
      "Order Date", "Patient", "Age", "Gender", "Goal", "Symptoms",
      "Doctor", "System Recommended", "Doctor Changes", "Final Kits",
      "Kits", "Total", "Status", "Assessment Ref",
    ];
    const headerRow = ws.getRow(5);
    headers.forEach((h, i) => {
      const c = headerRow.getCell(i + 1);
      c.value = h;
      c.font = { bold: true, size: 10, color: { argb: WHITE } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
      c.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      c.border = { bottom: { style: "thin", color: { argb: RULE } } };
    });
    headerRow.height = 26;

    let r = 6;
    for (const row of rows) {
      const d = ws.getCell(r, 1);
      d.value = toIst(row.createdAt);
      d.numFmt = FMT_DATE;
      ws.getCell(r, 2).value = safeText(row.patientName);
      ws.getCell(r, 3).value = row.age ?? "";
      ws.getCell(r, 3).numFmt = FMT_COUNT;
      ws.getCell(r, 4).value = safeText(row.gender ?? "");
      ws.getCell(r, 5).value = safeText(row.goals.join("; ") || "—");
      ws.getCell(r, 6).value = safeText(row.symptoms.join("; ") || "—");
      ws.getCell(r, 7).value = safeText(row.doctorName);

      const sysCell = ws.getCell(r, 8);
      sysCell.value = safeText(systemRecommendedText(row));
      if (row.systemRecommended === null) {
        sysCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER_FILL } };
        sysCell.font = { color: { argb: AMBER_TEXT }, size: 9, italic: true };
      }

      const changeCell = ws.getCell(r, 9);
      changeCell.value = safeText(deltaSummary(row));
      if (row.delta.status === "modified") {
        changeCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER_FILL } };
        changeCell.font = { color: { argb: AMBER_TEXT }, size: 9 };
      } else if (row.delta.status === "unchanged") {
        changeCell.font = { color: { argb: GREEN_TEXT }, size: 9 };
      } else {
        changeCell.font = { color: { argb: MUTED }, size: 9, italic: true };
      }

      ws.getCell(r, 10).value = safeText(kitListText(row.finalKits));
      ws.getCell(r, 11).value = row.finalKitCount;
      ws.getCell(r, 11).numFmt = FMT_COUNT;

      const total = ws.getCell(r, 12);
      if (row.totalInr === null) {
        total.value = "Unavailable";
        total.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER_FILL } };
        total.font = { color: { argb: AMBER_TEXT }, size: 9, italic: true };
      } else {
        total.value = row.totalInr;
        total.numFmt = FMT_CURRENCY;
      }

      const st = ws.getCell(r, 13);
      st.value = STATUS_LABEL[row.status];
      if (row.status === "READY_FOR_FULFILMENT") {
        st.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_FILL } };
        st.font = { color: { argb: GREEN_TEXT }, bold: true, size: 10 };
      } else {
        st.fill = { type: "pattern", pattern: "solid", fgColor: { argb: RED_FILL } };
        st.font = { color: { argb: RED_TEXT }, bold: true, size: 10 };
      }

      ws.getCell(r, 14).value = safeText(row.assessmentId);

      for (const col of [5, 6, 8, 9, 10]) {
        ws.getCell(r, col).alignment = { wrapText: true, vertical: "top" };
      }
      r += 1;
    }

    if (rows.length > 0) {
      ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: 14 } };
    }
    ws.views = [{ state: "frozen", ySplit: 5, xSplit: 2 }];
  }

  // ── Sheet 2 — Export Metadata ───────────────────────────────────────────
  {
    const ws = wb.addWorksheet("Export Metadata");
    ws.columns = [{ width: 34 }, { width: 82 }];
    ws.mergeCells(1, 1, 1, 2);
    const t = ws.getCell(1, 1);
    t.value = "Export Metadata";
    t.font = { bold: true, size: 13, color: { argb: WHITE } };
    t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    t.alignment = { vertical: "middle", indent: 1 };
    ws.getRow(1).height = 26;

    const entries: Array<[string, string | number]> = [
      ["Clinic scope", meta.clinicLabel],
      ["Date range", describeSummaryRange(filters)],
      ["Generated at (IST)", istStamp(generatedAt)],
      ["Generated by", `${meta.actorName} (${meta.actorRole})`],
      ["Workbook schema", SUMMARY_WORKBOOK_SCHEMA],
      ["Rows exported", rows.length],
      ["Patient orders", metrics.patientOrders],
      ["Final kits (non-cancelled)", metrics.finalKits],
      ["Order value (indicative)", `₹${metrics.orderValueInr.toLocaleString("en-IN")}`],
      ["Orders excluded from value", `${metrics.excludedFromValue} — a kit on the order has no price-sheet entry; units counted, money omitted`],
      ["Doctor modified", `${metrics.doctorModified} of ${metrics.deltaDeterminable} determinable (${metrics.doctorModifiedPct}%)`],
      ["System recommendation source", "ConsultationVersion contentVersion=1 (immutable engine snapshot)"],
      ["Doctor-approved / final source", "KitOrderIntent.kitIds (approval-time snapshot)"],
      ["Money basis", "Indicative only — lib/pricing/kitPrices.ts. No historical price snapshot exists, so totals reflect today's sheet. Not an invoice."],
      ["FIELDS UNAVAILABLE", "No per-kit quantities, no custom doctor-entered kits, no topical-in-order, no payment or fulfilment model exist in the schema. Those columns are omitted, not estimated."],
      ["Legacy records", "Orders whose original v1 recommendation was never stored show 'Historical recommendation unavailable' and are excluded from the doctor-modified rate."],
      ["Timezone", "Asia/Kolkata (UTC+05:30) — all displayed timestamps."],
    ];
    let r = 3;
    for (const [k, v] of entries) {
      ws.getCell(r, 1).value = k;
      ws.getCell(r, 1).font = { bold: true, size: 10, color: { argb: NAVY } };
      const c = ws.getCell(r, 2);
      c.value = typeof v === "number" ? v : safeText(v);
      c.alignment = { wrapText: true, vertical: "top" };
      c.font = { size: 10 };
      if (k === "FIELDS UNAVAILABLE") {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER_FILL } };
        c.font = { size: 10, color: { argb: AMBER_TEXT } };
      }
      ws.getRow(r).height = 24;
      r += 1;
    }
    ws.views = [{ state: "frozen", ySplit: 2 }];
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

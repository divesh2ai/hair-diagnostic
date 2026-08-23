// Kit Order Intent export — workbook builder.
//
// Every figure in every tab is derived from the SAME in-memory `rows` array,
// which is what makes the summaries reconcile exactly to Intent Details. No
// tab re-queries the database, so no tab can disagree with another.
//
// Deliberately absent: a Payment & Fulfilment tab. The spec asked for one;
// this application stores no payment model, no fulfilment model, no tracking
// reference and no delivered timestamp, so the tab would have been eight
// invented columns. Its absence is recorded in Export Metadata rather than
// papered over.

import ExcelJS from "exceljs";
import type { OrderIntentRow, OrderSnapshot } from "./snapshot";

export const WORKBOOK_SCHEMA_VERSION = "kit-order-intents/v1";

// ── Dr FACT administrative palette ─────────────────────────────────────────
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

const NOT_RECORDED = "Not recorded";

/**
 * Neutralise spreadsheet-formula injection.
 *
 * exceljs writes these as shared strings rather than formulas, so Excel will
 * not evaluate them on open. The escape is defence-in-depth for the common
 * downstream case of someone re-saving the sheet as CSV, where a leading
 * `=`, `+`, `-` or `@` IS executed. Applied to every database-originated
 * text cell; documented in the Data Dictionary so the apostrophe is not
 * mistaken for stored data.
 */
export function safeText(value: string | null | undefined): string {
  const s = (value ?? "").toString();
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

/**
 * Excel has no timezone: a date cell is wall-clock. Shift UTC into IST so the
 * displayed value matches what an Indian administrator expects, and state the
 * timezone in Export Metadata so nobody re-applies an offset.
 */
export function toIst(d: Date): Date {
  return new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
}

export function istStamp(d: Date): string {
  const i = toIst(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${i.getUTCFullYear()}-${p(i.getUTCMonth() + 1)}-${p(i.getUTCDate())} ${p(i.getUTCHours())}:${p(i.getUTCMinutes())} IST`;
}

export function exportFilename(now: Date): string {
  const i = toIst(now);
  const p = (n: number) => String(n).padStart(2, "0");
  return `drfact-kit-order-intents-${i.getUTCFullYear()}-${p(i.getUTCMonth() + 1)}-${p(i.getUTCDate())}_${p(i.getUTCHours())}${p(i.getUTCMinutes())}-IST.xlsx`;
}

// ── Aggregations, all derived from `rows` ──────────────────────────────────

/**
 * Sums only rows that carry a real price. Rows whose lineup includes a kit
 * missing from the price sheet contribute NOTHING and are counted separately,
 * so a monetary total is never inflated by a guessed rate.
 */
function valueOf(rows: OrderIntentRow[]): { total: number; valued: number; excluded: number } {
  let total = 0;
  let valued = 0;
  let excluded = 0;
  for (const r of rows) {
    if (r.indicativeValueInr === null) excluded += 1;
    else {
      total += r.indicativeValueInr;
      valued += 1;
    }
  }
  return { total, valued, excluded };
}

export type StateAgg = {
  state: string;
  intents: number;
  units: number;
  indicativeValueInr: number;
  /** Intents in this state excluded from the value because pricing is missing. */
  excludedFromValue: number;
  readyForFulfilment: number;
  cancelled: number;
  clinics: number;
  avgIntentValueInr: number;
};

export function aggregateByState(rows: OrderIntentRow[]): StateAgg[] {
  const map = new Map<string, { rows: OrderIntentRow[]; clinics: Set<string> }>();
  for (const r of rows) {
    const key = r.state ?? NOT_RECORDED;
    if (!map.has(key)) map.set(key, { rows: [], clinics: new Set() });
    const e = map.get(key)!;
    e.rows.push(r);
    e.clinics.add(r.clinicId);
  }
  return [...map.entries()]
    .map(([state, e]) => {
      const v = valueOf(e.rows);
      return {
        state,
        intents: e.rows.length,
        units: e.rows.reduce((s, r) => s + r.units, 0),
        indicativeValueInr: v.total,
        excludedFromValue: v.excluded,
        readyForFulfilment: e.rows.filter((r) => r.status === "READY_FOR_FULFILMENT").length,
        cancelled: e.rows.filter((r) => r.status === "CANCELLED").length,
        clinics: e.clinics.size,
        // Averaged over PRICED intents only — dividing by the full count
        // would silently treat an unpriced intent as a zero-value one.
        avgIntentValueInr: v.valued ? Math.round(v.total / v.valued) : 0,
      };
    })
    .sort((a, b) => b.indicativeValueInr - a.indicativeValueInr);
}

export type ClinicAgg = {
  clinicId: string;
  clinicName: string;
  state: string;
  city: string;
  intents: number;
  units: number;
  indicativeValueInr: number;
  excludedFromValue: number;
  readyForFulfilment: number;
  cancelled: number;
  avgIntentValueInr: number;
  dataQualityCount: number;
};

export function aggregateByClinic(rows: OrderIntentRow[]): ClinicAgg[] {
  const map = new Map<string, OrderIntentRow[]>();
  for (const r of rows) {
    if (!map.has(r.clinicId)) map.set(r.clinicId, []);
    map.get(r.clinicId)!.push(r);
  }
  return [...map.entries()]
    .map(([clinicId, rs]) => {
      const v = valueOf(rs);
      return {
        clinicId,
        clinicName: rs[0]!.clinicName,
        state: rs[0]!.state ?? NOT_RECORDED,
        city: rs[0]!.city ?? NOT_RECORDED,
        intents: rs.length,
        units: rs.reduce((s, r) => s + r.units, 0),
        indicativeValueInr: v.total,
        excludedFromValue: v.excluded,
        readyForFulfilment: rs.filter((r) => r.status === "READY_FOR_FULFILMENT").length,
        cancelled: rs.filter((r) => r.status === "CANCELLED").length,
        avgIntentValueInr: v.valued ? Math.round(v.total / v.valued) : 0,
        dataQualityCount: rs.filter((r) => r.dataQualityFlags.length > 0).length,
      };
    })
    .sort((a, b) => b.indicativeValueInr - a.indicativeValueInr);
}

export type KitAgg = {
  kitId: string;
  displayName: string;
  intents: number;
  units: number;
  /** null for an unpriced kit — never a guessed subtotal. */
  indicativeValueInr: number | null;
  unitPriceInr: number | null;
  pricedFromSheet: boolean;
  inRegistry: boolean;
};

export function aggregateByKit(rows: OrderIntentRow[]): KitAgg[] {
  const map = new Map<string, KitAgg>();
  for (const r of rows) {
    for (const k of r.kits) {
      if (!map.has(k.kitId)) {
        map.set(k.kitId, {
          kitId: k.kitId,
          displayName: k.displayName,
          intents: 0,
          units: 0,
          indicativeValueInr: k.unitPriceInr === null ? null : 0,
          unitPriceInr: k.unitPriceInr,
          pricedFromSheet: k.pricedFromSheet,
          inRegistry: k.inRegistry,
        });
      }
      const e = map.get(k.kitId)!;
      e.intents += 1;
      e.units += k.quantity;
      // Units still accumulate for an unpriced kit — volume is known even
      // when value is not. Only the money stays null.
      if (e.indicativeValueInr !== null && k.unitPriceInr !== null) {
        e.indicativeValueInr += k.unitPriceInr * k.quantity;
      }
    }
  }
  return [...map.values()].sort(
    (a, b) => (b.indicativeValueInr ?? -1) - (a.indicativeValueInr ?? -1),
  );
}

// ── Styling helpers ────────────────────────────────────────────────────────

function titleBand(ws: ExcelJS.Worksheet, span: number, title: string, subtitle: string) {
  ws.mergeCells(1, 1, 1, span);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { bold: true, size: 15, color: { argb: WHITE }, name: "Calibri" };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  t.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 30;

  ws.mergeCells(2, 1, 2, span);
  const s = ws.getCell(2, 1);
  s.value = subtitle;
  s.font = { size: 9, italic: true, color: { argb: MUTED } };
  s.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(2).height = 18;
}

function headerRow(ws: ExcelJS.Worksheet, rowIdx: number, headers: string[]) {
  const row = ws.getRow(rowIdx);
  headers.forEach((h, i) => {
    const c = row.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, size: 10, color: { argb: WHITE } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    c.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    c.border = { bottom: { style: "thin", color: { argb: RULE } } };
  });
  row.height = 28;
  return row;
}

function sectionHeader(ws: ExcelJS.Worksheet, rowIdx: number, span: number, label: string) {
  ws.mergeCells(rowIdx, 1, rowIdx, span);
  const c = ws.getCell(rowIdx, 1);
  c.value = label;
  c.font = { bold: true, size: 11, color: { argb: NAVY } };
  c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MINT } };
  c.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(rowIdx).height = 22;
}

function statusStyle(cell: ExcelJS.Cell, status: string) {
  if (status === "READY_FOR_FULFILMENT") {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_FILL } };
    cell.font = { color: { argb: GREEN_TEXT }, bold: true, size: 10 };
  } else if (status === "CANCELLED") {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: RED_FILL } };
    cell.font = { color: { argb: RED_TEXT }, bold: true, size: 10 };
  }
}

function dataBar(ws: ExcelJS.Worksheet, ref: string) {
  ws.addConditionalFormatting({
    ref,
    rules: [
      {
        type: "dataBar",
        cfvo: [{ type: "min" }, { type: "max" }],
        color: { argb: TEAL },
        priority: 1,
      } as ExcelJS.DataBarRuleType,
    ],
  });
}

export type WorkbookMeta = {
  actorId: string;
  actorRole: string;
  environment: string;
  rowCount: number;
};

export async function buildOrdersWorkbook(
  snapshot: OrderSnapshot,
  meta: WorkbookMeta,
): Promise<Buffer> {
  const { rows, filters, generatedAt } = snapshot;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Dr FACT HairOS — Super Admin";
  wb.created = generatedAt;

  const byState = aggregateByState(rows);
  const byClinic = aggregateByClinic(rows);
  const byKit = aggregateByKit(rows);

  const totalIntents = rows.length;
  const totalUnits = rows.reduce((s, r) => s + r.units, 0);
  const totals = valueOf(rows);
  const totalValue = totals.total;
  const excludedFromValue = totals.excluded;
  const readyCount = rows.filter((r) => r.status === "READY_FOR_FULFILMENT").length;
  const cancelledCount = rows.filter((r) => r.status === "CANCELLED").length;
  const flaggedCount = rows.filter((r) => r.dataQualityFlags.length > 0).length;

  const filterSummary = describeFilters(filters);

  // ── Tab 1 — Executive Summary ────────────────────────────────────────────
  {
    const ws = wb.addWorksheet("Executive Summary");
    ws.columns = [
      { width: 34 }, { width: 18 }, { width: 14 }, { width: 16 },
      { width: 14 }, { width: 14 }, { width: 12 },
    ];
    titleBand(
      ws,
      7,
      "Kit Order Intents — Executive Summary",
      `Generated ${istStamp(generatedAt)} · ${filterSummary}`,
    );

    sectionHeader(ws, 4, 7, "Headline figures");
    const kpis: Array<[string, number, string]> = [
      ["Total kit order intents", totalIntents, FMT_COUNT],
      ["Total kit units", totalUnits, FMT_COUNT],
      ["Indicative value (ops price sheet)", totalValue, FMT_CURRENCY],
      ["Intents priced", totalIntents - excludedFromValue, FMT_COUNT],
      ["Intents EXCLUDED from indicative value (no price)", excludedFromValue, FMT_COUNT],
      ["Ready for fulfilment", readyCount, FMT_COUNT],
      ["Cancelled", cancelledCount, FMT_COUNT],
      ["States represented", byState.filter((s) => s.state !== NOT_RECORDED).length, FMT_COUNT],
      ["Clinics represented", byClinic.length, FMT_COUNT],
      ["Rows with a data-quality flag", flaggedCount, FMT_COUNT],
    ];
    let r = 5;
    for (const [label, value, fmt] of kpis) {
      ws.getCell(r, 1).value = label;
      ws.getCell(r, 1).font = { size: 10, color: { argb: NAVY } };
      const v = ws.getCell(r, 2);
      v.value = value;
      v.numFmt = fmt;
      v.font = { bold: true, size: 11 };
      v.alignment = { horizontal: "right" };
      // Highlight the exclusion so a reader cannot take the value total at
      // face value without seeing what it leaves out.
      if (label.startsWith("Intents EXCLUDED") && value > 0) {
        ws.getCell(r, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER_FILL } };
        ws.getCell(r, 1).font = { size: 10, color: { argb: AMBER_TEXT }, bold: true };
        v.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER_FILL } };
        v.font = { bold: true, size: 11, color: { argb: AMBER_TEXT } };
      }
      r += 1;
    }

    if (excludedFromValue > 0) {
      ws.mergeCells(r, 1, r, 7);
      const c = ws.getCell(r, 1);
      c.value = `${excludedFromValue.toLocaleString()} of ${totalIntents.toLocaleString()} order intents are excluded from the indicative value because at least one kit on them has no price-sheet entry. Their units ARE counted; only their money is omitted. No default rate has been substituted.`;
      c.font = { size: 9, bold: true, color: { argb: AMBER_TEXT } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER_FILL } };
      c.alignment = { wrapText: true, vertical: "top", indent: 1 };
      ws.getRow(r).height = 30;
      r += 1;
    }

    r += 1;
    sectionHeader(ws, r, 7, "Intents by state — ranked");
    r += 1;
    headerRow(ws, r, ["State / UT", "Intents", "Units", "Indicative value", "Clinics"]);
    const stateHeaderRow = r;
    r += 1;
    for (const s of byState) {
      ws.getCell(r, 1).value = safeText(s.state);
      ws.getCell(r, 2).value = s.intents;
      ws.getCell(r, 2).numFmt = FMT_COUNT;
      ws.getCell(r, 3).value = s.units;
      ws.getCell(r, 3).numFmt = FMT_COUNT;
      ws.getCell(r, 4).value = s.indicativeValueInr;
      ws.getCell(r, 4).numFmt = FMT_CURRENCY;
      ws.getCell(r, 5).value = s.clinics;
      ws.getCell(r, 5).numFmt = FMT_COUNT;
      r += 1;
    }
    if (byState.length) dataBar(ws, `B${stateHeaderRow + 1}:B${r - 1}`);

    r += 1;
    sectionHeader(ws, r, 7, "Intents by clinic — ranked");
    r += 1;
    headerRow(ws, r, ["Clinic", "State", "Intents", "Units", "Indicative value"]);
    const clinicHeaderRow = r;
    r += 1;
    for (const c of byClinic) {
      ws.getCell(r, 1).value = safeText(c.clinicName);
      ws.getCell(r, 2).value = safeText(c.state);
      ws.getCell(r, 3).value = c.intents;
      ws.getCell(r, 3).numFmt = FMT_COUNT;
      ws.getCell(r, 4).value = c.units;
      ws.getCell(r, 4).numFmt = FMT_COUNT;
      ws.getCell(r, 5).value = c.indicativeValueInr;
      ws.getCell(r, 5).numFmt = FMT_CURRENCY;
      r += 1;
    }
    if (byClinic.length) dataBar(ws, `C${clinicHeaderRow + 1}:C${r - 1}`);

    r += 2;
    sectionHeader(ws, r, 7, "Data quality and privacy");
    r += 1;
    for (const note of [
      "MONEY IS INDICATIVE, NOT INVOICED. The only price source in this system is a hand-maintained constant table (lib/pricing/kitPrices.ts). It is not an invoice, a payment or a receipt.",
      "This application stores no payment model, no fulfilment model, no SKU, no discount and no delivered timestamp. Those columns are omitted, not estimated.",
      "A KitOrderIntent records a doctor's approval-time authorization to operationalize a kit lineup. It is not a completed commercial order.",
      "Kits absent from the price sheet get NO substituted rate. Intents containing one are excluded from every monetary total and counted as an exclusion; their units are still counted.",
      "No patient name, phone, email, address, clinical answer, diagnosis, narrative or image appears anywhere in this workbook.",
      "Intents belonging to archived clinics or soft-deleted assessments are excluded.",
      "All timestamps are IST (UTC+05:30).",
    ]) {
      ws.mergeCells(r, 1, r, 7);
      const c = ws.getCell(r, 1);
      c.value = note;
      c.font = { size: 9, color: { argb: MUTED } };
      c.alignment = { wrapText: true, vertical: "top", indent: 1 };
      ws.getRow(r).height = 26;
      r += 1;
    }

    ws.views = [{ state: "frozen", ySplit: 3 }];
  }

  // ── Tab 2 — State Summary ────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet("State Summary");
    ws.columns = [
      { width: 26 }, { width: 12 }, { width: 12 }, { width: 20 },
      { width: 18 }, { width: 20 }, { width: 14 }, { width: 14 },
      { width: 20 },
    ];
    titleBand(
      ws,
      9,
      "State Summary",
      `Generated ${istStamp(generatedAt)} · ${filterSummary} · value excludes unpriced intents`,
    );
    headerRow(ws, 3, [
      "State / UT", "Intents", "Units", "Indicative value",
      "Excluded (no price)", "Ready for fulfilment", "Cancelled", "Clinics",
      "Avg priced intent",
    ]);
    let r = 4;
    for (const s of byState) {
      ws.getCell(r, 1).value = safeText(s.state);
      ws.getCell(r, 2).value = s.intents;
      ws.getCell(r, 2).numFmt = FMT_COUNT;
      ws.getCell(r, 3).value = s.units;
      ws.getCell(r, 3).numFmt = FMT_COUNT;
      ws.getCell(r, 4).value = s.indicativeValueInr;
      ws.getCell(r, 4).numFmt = FMT_CURRENCY;
      const ex = ws.getCell(r, 5);
      ex.value = s.excludedFromValue;
      ex.numFmt = FMT_COUNT;
      if (s.excludedFromValue > 0) {
        ex.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER_FILL } };
        ex.font = { color: { argb: AMBER_TEXT }, bold: true };
      }
      ws.getCell(r, 6).value = s.readyForFulfilment;
      ws.getCell(r, 6).numFmt = FMT_COUNT;
      ws.getCell(r, 7).value = s.cancelled;
      ws.getCell(r, 7).numFmt = FMT_COUNT;
      ws.getCell(r, 8).value = s.clinics;
      ws.getCell(r, 8).numFmt = FMT_COUNT;
      ws.getCell(r, 9).value = s.avgIntentValueInr;
      ws.getCell(r, 9).numFmt = FMT_CURRENCY;
      r += 1;
    }
    ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 9 } };
    ws.views = [{ state: "frozen", ySplit: 3 }];
  }

  // ── Tab 3 — Clinic Summary ───────────────────────────────────────────────
  {
    const ws = wb.addWorksheet("Clinic Summary");
    ws.columns = [
      { width: 24 }, { width: 28 }, { width: 20 }, { width: 18 },
      { width: 12 }, { width: 12 }, { width: 20 }, { width: 18 },
      { width: 20 }, { width: 12 }, { width: 20 }, { width: 18 },
    ];
    titleBand(
      ws,
      12,
      "Clinic Summary",
      `Generated ${istStamp(generatedAt)} · ${filterSummary} · value excludes unpriced intents`,
    );
    headerRow(ws, 3, [
      "Clinic ID", "Clinic name", "State / UT", "City", "Intents", "Units",
      "Indicative value", "Excluded (no price)", "Ready for fulfilment",
      "Cancelled", "Avg priced intent", "Rows flagged",
    ]);
    let r = 4;
    for (const c of byClinic) {
      ws.getCell(r, 1).value = safeText(c.clinicId);
      ws.getCell(r, 2).value = safeText(c.clinicName);
      ws.getCell(r, 3).value = safeText(c.state);
      ws.getCell(r, 4).value = safeText(c.city);
      ws.getCell(r, 5).value = c.intents;
      ws.getCell(r, 5).numFmt = FMT_COUNT;
      ws.getCell(r, 6).value = c.units;
      ws.getCell(r, 6).numFmt = FMT_COUNT;
      ws.getCell(r, 7).value = c.indicativeValueInr;
      ws.getCell(r, 7).numFmt = FMT_CURRENCY;
      const cex = ws.getCell(r, 8);
      cex.value = c.excludedFromValue;
      cex.numFmt = FMT_COUNT;
      if (c.excludedFromValue > 0) {
        cex.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER_FILL } };
        cex.font = { color: { argb: AMBER_TEXT }, bold: true };
      }
      ws.getCell(r, 9).value = c.readyForFulfilment;
      ws.getCell(r, 9).numFmt = FMT_COUNT;
      ws.getCell(r, 10).value = c.cancelled;
      ws.getCell(r, 10).numFmt = FMT_COUNT;
      ws.getCell(r, 11).value = c.avgIntentValueInr;
      ws.getCell(r, 11).numFmt = FMT_CURRENCY;
      const flag = ws.getCell(r, 12);
      flag.value = c.dataQualityCount;
      flag.numFmt = FMT_COUNT;
      if (c.dataQualityCount > 0) {
        flag.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER_FILL } };
        flag.font = { color: { argb: AMBER_TEXT }, bold: true };
      }
      r += 1;
    }
    ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 12 } };
    ws.views = [{ state: "frozen", ySplit: 3, xSplit: 2 }];
  }

  // ── Tab 4 — Intent Details ───────────────────────────────────────────────
  {
    const ws = wb.addWorksheet("Intent Details");
    ws.columns = [
      { width: 26 }, { width: 18 }, { width: 20 }, { width: 18 }, { width: 24 },
      { width: 28 }, { width: 24 }, { width: 40 }, { width: 10 }, { width: 18 },
      { width: 20 }, { width: 22 }, { width: 20 }, { width: 18 }, { width: 44 },
    ];
    titleBand(
      ws,
      15,
      "Intent Details — one row per kit order intent",
      `Generated ${istStamp(generatedAt)} · ${filterSummary} · money is indicative, not invoiced`,
    );
    headerRow(ws, 3, [
      "Intent ID", "Created (IST)", "State / UT", "City", "Clinic ID",
      "Clinic name", "Patient reference", "Kits", "Units",
      "Indicative value", "Intent status", "Approving doctor",
      "Assessment ID", "Assessment source", "Data-quality flags",
    ]);
    let r = 4;
    for (const row of rows) {
      ws.getCell(r, 1).value = safeText(row.intentId);
      const d = ws.getCell(r, 2);
      d.value = toIst(row.createdAt);
      d.numFmt = FMT_DATE;
      ws.getCell(r, 3).value = safeText(row.state ?? NOT_RECORDED);
      ws.getCell(r, 4).value = safeText(row.city ?? NOT_RECORDED);
      ws.getCell(r, 5).value = safeText(row.clinicId);
      ws.getCell(r, 6).value = safeText(row.clinicName);
      ws.getCell(r, 7).value = safeText(row.patientRef);
      ws.getCell(r, 8).value = safeText(
        row.kits.map((k) => (k.quantity > 1 ? `${k.displayName} ×${k.quantity}` : k.displayName)).join("; "),
      );
      ws.getCell(r, 9).value = row.units;
      ws.getCell(r, 9).numFmt = FMT_COUNT;
      const val = ws.getCell(r, 10);
      if (row.indicativeValueInr === null) {
        // Text, not 0 — a zero here would be summed by any reader and would
        // silently understate the total it is excluded from.
        val.value = "Unavailable";
        val.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER_FILL } };
        val.font = { color: { argb: AMBER_TEXT }, size: 9, italic: true };
      } else {
        val.value = row.indicativeValueInr;
        val.numFmt = FMT_CURRENCY;
      }
      const st = ws.getCell(r, 11);
      st.value = safeText(row.status);
      statusStyle(st, row.status);
      ws.getCell(r, 12).value = safeText(row.doctorName);
      ws.getCell(r, 13).value = safeText(row.assessmentId);
      ws.getCell(r, 14).value = safeText(row.assessmentSource);
      const fl = ws.getCell(r, 15);
      fl.value = safeText(row.dataQualityFlags.join("; "));
      if (row.dataQualityFlags.length) {
        fl.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER_FILL } };
        fl.font = { color: { argb: AMBER_TEXT }, size: 9 };
      }
      r += 1;
    }
    ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 15 } };
    ws.views = [{ state: "frozen", ySplit: 3, xSplit: 1 }];
  }

  // ── Tab 5 — Kit Summary ──────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet("Kit Summary");
    ws.columns = [
      { width: 40 }, { width: 26 }, { width: 12 }, { width: 12 },
      { width: 20 }, { width: 20 }, { width: 34 },
    ];
    titleBand(ws, 7, "Kit Summary", `Generated ${istStamp(generatedAt)} · ${filterSummary}`);
    headerRow(ws, 3, [
      "Kit", "Kit ID", "Intents", "Units", "Indicative value",
      "Indicative unit price", "Source note",
    ]);
    let r = 4;
    for (const k of byKit) {
      ws.getCell(r, 1).value = safeText(k.displayName);
      ws.getCell(r, 2).value = safeText(k.kitId);
      ws.getCell(r, 3).value = k.intents;
      ws.getCell(r, 3).numFmt = FMT_COUNT;
      ws.getCell(r, 4).value = k.units;
      ws.getCell(r, 4).numFmt = FMT_COUNT;
      const kv = ws.getCell(r, 5);
      const kp = ws.getCell(r, 6);
      if (k.indicativeValueInr === null || k.unitPriceInr === null) {
        kv.value = "Unavailable";
        kv.font = { color: { argb: AMBER_TEXT }, size: 9, italic: true };
        kp.value = "Unavailable";
        kp.font = { color: { argb: AMBER_TEXT }, size: 9, italic: true };
      } else {
        kv.value = k.indicativeValueInr;
        kv.numFmt = FMT_CURRENCY;
        kp.value = k.unitPriceInr;
        kp.numFmt = FMT_CURRENCY;
      }
      const notes: string[] = [];
      if (!k.pricedFromSheet)
        notes.push("Not in price sheet — excluded from value, units still counted");
      if (!k.inRegistry) notes.push("No registry entry — internal id shown");
      const n = ws.getCell(r, 7);
      n.value = safeText(notes.join("; ") || "Price sheet");
      if (notes.length) {
        n.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER_FILL } };
        n.font = { color: { argb: AMBER_TEXT }, size: 9 };
      }
      r += 1;
    }
    if (byKit.length) dataBar(ws, `D4:D${r - 1}`);
    ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 7 } };
    ws.views = [{ state: "frozen", ySplit: 3 }];
  }

  // ── Tab 6 — Export Metadata ──────────────────────────────────────────────
  {
    const ws = wb.addWorksheet("Export Metadata");
    ws.columns = [{ width: 34 }, { width: 82 }];
    titleBand(ws, 2, "Export Metadata", "Provenance for this workbook");
    headerRow(ws, 3, ["Property", "Value"]);
    const entries: Array<[string, string | number | Date]> = [
      ["Generated at (IST)", istStamp(generatedAt)],
      ["Timezone", "Asia/Kolkata (UTC+05:30) — all displayed timestamps"],
      ["Generated by (actor ID)", safeText(meta.actorId)],
      ["Generated by (role)", safeText(meta.actorRole)],
      ["Environment", safeText(meta.environment)],
      ["Workbook schema version", WORKBOOK_SCHEMA_VERSION],
      ["Source model", "KitOrderIntent (+ Clinic, ClinicLocation, Doctor, Assessment)"],
      ["Source row count", meta.rowCount],
      ["Applied filters", safeText(filterSummary)],
      ["Date range included", safeText(describeRange(filters))],
      ["Row limit", `${meta.rowCount} of max ${process.env.ADMIN_ORDER_EXPORT_MAX_ROWS ?? 5000} — exports above the limit are refused, never truncated`],
      ["Soft deletion applied", "Clinic.deletedAt, Assessment.deletedAt, Doctor.deletedAt, ClinicLocation.deletedAt. KitOrderIntent has no deletedAt column."],
      ["FIELDS UNAVAILABLE — payment", "No payment/invoice/transaction model exists. Payment status, payment method and paid flags are OMITTED."],
      ["FIELDS UNAVAILABLE — fulfilment", "No fulfilment model exists. Fulfilment status, tracking reference and delivered timestamp are OMITTED."],
      ["FIELDS UNAVAILABLE — commerce", "No SKU, discount, captured unit price or net invoiced amount is stored. OMITTED."],
      ["FIELDS UNAVAILABLE — vertical", "No business vertical (Hair/Skin/Ortho) exists in the schema. OMITTED."],
      ["Money basis", "Indicative only — lib/pricing/kitPrices.ts, a hand-maintained constant table, explicitly not an invoicing source."],
      ["Unknown-price handling", `No default rate is substituted. ${excludedFromValue} of ${totalIntents} intents are excluded from the indicative value because a kit on them has no price-sheet entry. Units are still counted.`],
      ["Value coverage", `${totalIntents - excludedFromValue} of ${totalIntents} intents contribute to the indicative value.`],
      ["Omitted tab", "Payment & Fulfilment — would require eight fields none of which this application stores."],
      ["Formula-injection handling", "Text beginning = + - @ is prefixed with an apostrophe before writing."],
    ];
    let r = 4;
    for (const [k, v] of entries) {
      ws.getCell(r, 1).value = k;
      ws.getCell(r, 1).font = { bold: true, size: 10, color: { argb: NAVY } };
      const c = ws.getCell(r, 2);
      c.value = v;
      c.alignment = { wrapText: true, vertical: "top" };
      c.font = { size: 10 };
      if (typeof k === "string" && k.startsWith("FIELDS UNAVAILABLE")) {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER_FILL } };
        c.font = { size: 10, color: { argb: AMBER_TEXT } };
      }
      r += 1;
    }
    ws.views = [{ state: "frozen", ySplit: 3 }];
  }

  // ── Tab 7 — Data Dictionary ──────────────────────────────────────────────
  {
    const ws = wb.addWorksheet("Data Dictionary");
    ws.columns = [
      { width: 26 }, { width: 12 }, { width: 34 }, { width: 52 },
      { width: 20 }, { width: 10 }, { width: 40 },
    ];
    titleBand(ws, 7, "Data Dictionary", "Every exported field, its real source, and its privacy class");
    headerRow(ws, 3, [
      "Display name", "Type", "Source model.column", "Definition",
      "Privacy class", "Required", "Notes",
    ]);
    const dict: Array<[string, string, string, string, string, string, string]> = [
      ["Intent ID", "Text", "KitOrderIntent.id", "Primary key of the approval-time kit order intent.", "Internal", "Yes", "Not an invoice or order number."],
      ["Created (IST)", "Date", "KitOrderIntent.createdAt", "When the doctor's approval created the intent.", "Internal", "Yes", "Shifted to IST; Excel dates are timezone-naive."],
      ["State / UT", "Text", "ClinicLocation.state", "State of the clinic's primary location.", "Non-personal", "No", "Nullable; blank shows as 'Not recorded'."],
      ["City", "Text", "ClinicLocation.city", "City of the clinic's primary location.", "Non-personal", "No", "Nullable."],
      ["Clinic ID", "Text", "KitOrderIntent.clinicId", "Tenant identifier.", "Internal", "Yes", ""],
      ["Clinic name", "Text", "Clinic.name", "Clinic display name.", "Non-personal", "Yes", "Business name, not a person."],
      ["Patient reference", "Text", "Assessment.patientId", "Opaque cuid for reconciliation only.", "Pseudonymous", "Yes", "No name, phone, email or address is exported."],
      ["Kits", "Text", "KitOrderIntent.kitIds + registry displayName", "Kit lineup the doctor authorized.", "Non-personal", "Yes", "Retired kits fall back to their internal id."],
      ["Units", "Number", "KitOrderIntent.quantities", "Total kit units on the intent.", "Non-personal", "Yes", "Absent quantity counts as 1 — the lineup is a set of kits."],
      ["Indicative value", "Currency", "lib/pricing/kitPrices.ts", "Sum of indicative unit prices × quantity. 'Unavailable' when any kit on the intent has no price-sheet entry.", "Commercial (indicative)", "No", "NOT invoiced, NOT paid, NOT a receipt. Unavailable rows are EXCLUDED from all totals — no default rate is substituted."],
      ["Excluded (no price)", "Number", "Derived", "Intents omitted from the indicative value because pricing is unavailable.", "Internal", "No", "Their units are still counted; only their money is omitted."],
      ["Intent status", "Text", "KitOrderIntent.status", "READY_FOR_FULFILMENT or CANCELLED.", "Internal", "Yes", "The only status stored; not a payment or delivery state."],
      ["Approving doctor", "Text", "Doctor.name", "Doctor whose approval created the intent.", "Staff identity", "Yes", "Clinician, not a patient."],
      ["Assessment ID", "Text", "Assessment.id", "Source assessment.", "Internal", "Yes", "Identifier only; no clinical content exported."],
      ["Assessment source", "Text", "Assessment.source", "QR / MANUAL / WEB / WHATSAPP.", "Non-personal", "Yes", "Acquisition channel, NOT an order channel."],
      ["Data-quality flags", "Text", "Derived", "Why a figure on the row may be unreliable.", "Internal", "No", "Derived at export time; not stored."],
      ["Payment status", "—", "DOES NOT EXIST", "No payment model in the schema.", "n/a", "n/a", "OMITTED rather than estimated."],
      ["Fulfilment status", "—", "DOES NOT EXIST", "No fulfilment model in the schema.", "n/a", "n/a", "OMITTED rather than estimated."],
      ["SKU", "—", "DOES NOT EXIST", "No sku column anywhere in the schema.", "n/a", "n/a", "OMITTED."],
      ["Discount", "—", "DOES NOT EXIST", "No discount field.", "n/a", "n/a", "OMITTED."],
      ["Tracking reference", "—", "DOES NOT EXIST", "No tracking field.", "n/a", "n/a", "OMITTED."],
      ["Delivered timestamp", "—", "DOES NOT EXIST", "No delivery timestamp.", "n/a", "n/a", "OMITTED."],
      ["Vertical", "—", "DOES NOT EXIST", "No Hair/Skin/Ortho classification.", "n/a", "n/a", "OMITTED."],
    ];
    let r = 4;
    for (const d of dict) {
      d.forEach((v, i) => {
        const c = ws.getCell(r, i + 1);
        c.value = safeText(v);
        c.alignment = { wrapText: true, vertical: "top" };
        c.font = { size: 9 };
      });
      if (d[2] === "DOES NOT EXIST") {
        for (let i = 1; i <= 7; i += 1) {
          ws.getCell(r, i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER_FILL } };
          ws.getCell(r, i).font = { size: 9, color: { argb: AMBER_TEXT } };
        }
      }
      ws.getRow(r).height = 26;
      r += 1;
    }
    ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 7 } };
    ws.views = [{ state: "frozen", ySplit: 3 }];
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

export function describeFilters(f: OrderSnapshot["filters"]): string {
  const parts: string[] = [];
  if (f.from || f.to) parts.push(describeRange(f));
  if (f.state) parts.push(`state=${f.state}`);
  if (f.city) parts.push(`city=${f.city}`);
  if (f.clinicId) parts.push(`clinic=${f.clinicId}`);
  if (f.status) parts.push(`status=${f.status}`);
  if (f.doctorId) parts.push(`doctor=${f.doctorId}`);
  return parts.length ? parts.join(" · ") : "no filters — all intents";
}

function describeRange(f: OrderSnapshot["filters"]): string {
  if (!f.from && !f.to) return "all dates";
  const from = f.from ? istStamp(new Date(f.from)) : "beginning";
  const to = f.to ? istStamp(new Date(f.to)) : "now";
  return `${from} → ${to}`;
}

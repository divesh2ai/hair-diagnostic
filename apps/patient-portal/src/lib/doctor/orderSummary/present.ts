// Patient Order Summary — presentation helpers.
//
// Pure, dependency-free formatting shared by the page, the CSV and the Excel
// workbook so the three render the SAME delta the same way. No I/O, no Prisma,
// no exceljs — safe to import on the client.

import type { OrderDelta } from "./delta";
import type { SummaryKitLine } from "./query";

/**
 * The subset of a summary row these formatters read. Declared structurally so
 * both the server row (createdAt: Date) and the JSON-serialized client row
 * (createdAt: string) satisfy it without a cast — none of these helpers touch
 * createdAt.
 */
export interface PresentableRow {
  delta: OrderDelta;
  systemRecommended: SummaryKitLine[] | null;
  finalKits: SummaryKitLine[];
}

/** Indian-format rupee label. Mirrors lib/pricing/kitPrices.formatInr. */
export function formatInr(v: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);
}

/** Compact ₹3.82L / ₹12,000 style for dense metric tiles. */
export function formatInrCompact(v: number): string {
  if (v >= 100000) return `₹${(v / 100000).toFixed(2).replace(/\.00$/, "")}L`;
  return formatInr(v);
}

/** "29 · Female", "29", "Female", or "—". */
export function formatAgeGender(
  age: number | null,
  gender: string | null,
): string {
  if (age !== null && gender) return `${age} · ${gender}`;
  if (age !== null) return String(age);
  if (gender) return gender;
  return "—";
}

function nameOf(kitId: string, lines: SummaryKitLine[]): string {
  return lines.find((l) => l.kitId === kitId)?.displayName ?? kitId;
}

/**
 * One human line per change, e.g. "+ Iron Up", "− TE Gold",
 * "FPHL Pro 1 → 2", "TE Gold → GI Gold". A clean one-for-one swap renders as a
 * replacement; everything else stays as independent add/remove rows.
 *
 * Names resolve against BOTH lineups so a removed kit (absent from the final
 * order) still shows its display name.
 */
export function deltaLines(row: PresentableRow): string[] {
  const d = row.delta;
  if (d.status === "indeterminate") return [];
  if (d.status === "unchanged") return [];

  const names = [...(row.systemRecommended ?? []), ...row.finalKits];
  const resolve = (kitId: string) => nameOf(kitId, names);

  const lines: string[] = [];

  // Replacements first — they consume their add/remove pair.
  const consumed = new Set<string>();
  for (const r of d.replacements) {
    lines.push(`${resolve(r.removedKitId)} → ${resolve(r.addedKitId)}`);
    consumed.add(r.removedKitId);
    consumed.add(r.addedKitId);
  }
  for (const l of d.removed) {
    if (!consumed.has(l.kitId)) lines.push(`− ${resolve(l.kitId)}`);
  }
  for (const l of d.added) {
    if (!consumed.has(l.kitId)) lines.push(`+ ${resolve(l.kitId)}`);
  }
  for (const q of d.quantityChanged) {
    lines.push(`${resolve(q.kitId)} ${q.from} → ${q.to}`);
  }
  return lines;
}

/** Short label for the Doctor Changes column / export cell. */
export function deltaSummary(row: PresentableRow): string {
  switch (row.delta.status) {
    case "indeterminate":
      return "Historical recommendation unavailable";
    case "unchanged":
      return "No change";
    case "modified":
      return deltaLines(row).join("; ");
  }
}

export function kitListText(lines: SummaryKitLine[]): string {
  if (lines.length === 0) return "—";
  return lines
    .map((l) => (l.quantity > 1 ? `${l.displayName} ×${l.quantity}` : l.displayName))
    .join("; ");
}

export function systemRecommendedText(row: PresentableRow): string {
  if (row.systemRecommended === null) return "Historical recommendation unavailable";
  return kitListText(row.systemRecommended);
}

/** Structured split of delta lines for the CSV's separate columns. */
export function deltaColumns(row: PresentableRow): {
  added: string;
  removed: string;
  quantityChanges: string;
} {
  const d = row.delta;
  if (d.status === "indeterminate" || d.status === "unchanged") {
    return { added: "", removed: "", quantityChanges: "" };
  }
  const names = [...(row.systemRecommended ?? []), ...row.finalKits];
  const resolve = (kitId: string) => nameOf(kitId, names);
  return {
    added: d.added.map((l) => resolve(l.kitId)).join("; "),
    removed: d.removed.map((l) => resolve(l.kitId)).join("; "),
    quantityChanges: d.quantityChanged
      .map((q) => `${resolve(q.kitId)} ${q.from}→${q.to}`)
      .join("; "),
  };
}

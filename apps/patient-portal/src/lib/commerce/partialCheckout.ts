import { evaluateOrderForPatientCharge } from "./sellability";

export interface CheckoutSelection { kitId: string; boxes: number }
export interface CheckoutLine extends CheckoutSelection { unitMinor: number; amountMinor: number }
export class CheckoutError extends Error {
  constructor(public readonly code: string, public readonly status = 409) { super(code); }
}

/** Only selected, currently approved kits become a monetary snapshot. */
export function priceSelection(approvedKitIds: readonly string[], selection: unknown): {
  lines: CheckoutLine[]; amountMinor: number;
} {
  if (!Array.isArray(selection) || selection.length === 0 || selection.length > 30) {
    throw new CheckoutError("select_at_least_one_kit", 400);
  }
  const seen = new Set<string>();
  const requested = selection.map((item: unknown): CheckoutSelection => {
    if (!item || typeof item !== "object") throw new CheckoutError("invalid_selection", 400);
    const { kitId, boxes } = item as CheckoutSelection;
    if (typeof kitId !== "string" || !approvedKitIds.includes(kitId) || seen.has(kitId)) {
      throw new CheckoutError("kit_not_on_order_or_duplicate", 400);
    }
    if (!Number.isSafeInteger(boxes) || boxes < 1 || boxes > 99) throw new CheckoutError("invalid_boxes", 400);
    seen.add(kitId);
    return { kitId, boxes };
  }).sort((a, b) => a.kitId.localeCompare(b.kitId));
  const pricing = evaluateOrderForPatientCharge(requested.map((l) => l.kitId));
  if (!pricing.chargeable) throw new CheckoutError("ORDER_NOT_CHARGEABLE");
  const lines = requested.map((l, i) => {
    const unitMinor = pricing.lines[i]!.chargeableAmountMinor;
    if (unitMinor == null || !Number.isSafeInteger(unitMinor)) throw new CheckoutError("ORDER_NOT_CHARGEABLE");
    return { ...l, unitMinor, amountMinor: unitMinor * l.boxes };
  });
  return { lines, amountMinor: lines.reduce((sum, l) => sum + l.amountMinor, 0) };
}

export function validTransactionKey(key: unknown): key is string {
  return typeof key === "string" && /^[a-zA-Z0-9_-]{16,128}$/.test(key);
}

export function sameSelection(a: readonly CheckoutSelection[], b: unknown): boolean {
  if (!Array.isArray(b) || b.some(v=>!v || typeof v !== "object" || typeof v.kitId !== "string" || !Number.isSafeInteger(v.boxes))) return false;
  const normal = (v: readonly CheckoutSelection[]) => JSON.stringify(v.map(({ kitId, boxes }) => ({ kitId, boxes })).sort((x,y) => x.kitId.localeCompare(y.kitId)));
  return normal(a) === normal(b);
}

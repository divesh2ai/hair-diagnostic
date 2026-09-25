// The default per-kit order quantity, and how a quantity reads as a protocol
// duration. One definition so the patient cart, the clinic order view and the
// doctor order summary can never disagree on either.
//
// ── Boxes, not a rewrite of the prescription ────────────────────────────────
// A kit box is a one-month protocol; the ORDER quantity is how many boxes the
// clinic dispenses. The clinic ships a two-month course by default, so an
// approved order with no explicit per-kit quantity recorded starts every kit
// at 2 (a two-month supply). A doctor can still adjust any line with the
// order-quantity stepper; that explicit choice is persisted per kit
// (KitOrderIntent.quantities) and always wins over this default. Changing the
// order quantity never touches KitOrderIntent.kitIds — the approved
// prescription — see api/cart/[assessmentId]/quantity/route.ts.

/** Boxes dispensed per kit when the order records no explicit quantity. */
export const DEFAULT_KIT_QUANTITY = 2;

/**
 * The protocol-duration label for an order line. A kit box is a one-month
 * protocol, so the months of supply equal the number of boxes: 2 boxes read as
 * a "2-month protocol". Never drops below one month.
 */
export function protocolMonthsLabel(quantity: number): string {
  const months = Math.max(1, Math.round(quantity));
  return `${months}-month protocol`;
}

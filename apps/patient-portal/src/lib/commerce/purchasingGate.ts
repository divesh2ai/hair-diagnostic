// ─────────────────────────────────────────────────────────────────────────────
// PURCHASING KILL-SWITCH  (clinical launch guard, 2026-10)
//
// HairOS launches for Acube as a doctor-supervised CLINICAL RECOMMENDATION
// platform, not a purchasing application. This module is the single source of
// truth for "may money move / may a chargeable order be submitted".
//
// Default is OFF. Purchasing is enabled only when PURCHASING_ENABLED === "true"
// (exact string). Any other value — unset, "1", "false", "yes" — is OFF, so a
// typo or a leftover staging value fails closed, never open.
//
// What this gate does NOT touch, by design:
//   • Doctor clinical approval and KitOrderIntent creation
//     (approveAndCreateOrder) — that is a clinical authorization record, not a
//     sale. The order exists as READY_FOR_FULFILMENT; it is not a charge.
//   • PDF/report generation, review, assessment, dashboard reads.
//
// Kit prices, names, packshots, indications and protocols are NOT affected by
// this gate — they remain fully visible. This switch governs only whether a
// chargeable transaction or order submission may occur.
// ─────────────────────────────────────────────────────────────────────────────

export const PURCHASING_DISABLED_CODE = "PURCHASING_DISABLED";
export const PURCHASING_DISABLED_MESSAGE =
  "Online purchasing is disabled for this release. Your clinic will arrange any kits with you directly.";

/** True only when purchasing is explicitly enabled. Fails closed otherwise. */
export function isPurchasingEnabled(): boolean {
  return process.env.PURCHASING_ENABLED === "true";
}

/**
 * Thrown by data-layer writes (payment/checkout) when purchasing is disabled,
 * so a chargeable row cannot be created even if an HTTP guard is ever missed.
 */
export class PurchasingDisabledError extends Error {
  readonly code = PURCHASING_DISABLED_CODE;
  constructor(message: string = PURCHASING_DISABLED_MESSAGE) {
    super(message);
    this.name = "PurchasingDisabledError";
  }
}

/** Throw unless purchasing is enabled. Call at the top of any money-moving write. */
export function assertPurchasingEnabled(): void {
  if (!isPurchasingEnabled()) {
    throw new PurchasingDisabledError();
  }
}

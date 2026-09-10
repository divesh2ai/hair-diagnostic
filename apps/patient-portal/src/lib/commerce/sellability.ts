// The single authority on whether a kit may be charged to a patient.
//
// Sellability is NOT `price != null`, and it is not `price > 0`. Both of those
// are true today for kits whose identity nobody has confirmed and whose price
// nobody has approved. This module is the one place that decides, and it fails
// closed: every path that cannot prove eligibility returns reasons, not a
// number.
//
// Callers get machine-readable reasons rather than a bare boolean so that an
// internal reviewer can be shown WHY a line is blocked while a patient is
// simply never quoted it.

import {
  resolveKitIdentity,
  type KitIdentity,
  type KitIdentityStatus,
} from "./kitIdentity";
import { getKitPrice, type KitPrice, type KitPriceStatus } from "./kitPricing";

export type NonSellableReason =
  | "KIT_IDENTITY_REQUIRES_REVIEW"
  | "KIT_NOT_IN_CATALOGUE"
  | "PRICE_MISSING"
  | "PRICE_NOT_APPROVED"
  | "KIT_DISABLED";

export interface SellableDecision {
  sellable: boolean;
  /** Empty only when sellable is true. Order is stable for assertions. */
  reasons: NonSellableReason[];
  identityStatus: KitIdentityStatus;
  priceStatus: KitPriceStatus;
  canonicalKitId: string | null;
  /** The raw clinical identifier, always preserved. */
  sourceIdentifierSnapshot: string;
  /**
   * The amount that may be charged, in integer minor units. Non-null ONLY
   * when sellable is true — a PRICE_PRESENT figure is never handed out as a
   * chargeable amount, however tempting the number looks.
   */
  chargeableAmountMinor: number | null;
}

export interface SellabilityInput {
  identity: KitIdentity;
  price: KitPrice;
  /** False for a kit withdrawn from sale. Defaults to true when omitted. */
  active?: boolean;
}

/**
 * The core decision. A kit is sellable only when identity is RESOLVED, the
 * price is PRICE_APPROVED, the kit is in the catalogue, and it is active.
 * Anything else accumulates reasons and blocks.
 */
export function canSellToPatient(input: SellabilityInput): SellableDecision {
  const { identity, price } = input;
  const active = input.active ?? true;
  const reasons: NonSellableReason[] = [];

  if (identity.status === "UNRESOLVED") {
    reasons.push("KIT_IDENTITY_REQUIRES_REVIEW");
  } else if (identity.status === "MISSING") {
    reasons.push("KIT_NOT_IN_CATALOGUE");
  }

  if (price.status === "PRICE_MISSING") {
    reasons.push("PRICE_MISSING");
  } else if (price.status === "PRICE_PRESENT") {
    // The most important line in this file. A number exists; it is not money.
    reasons.push("PRICE_NOT_APPROVED");
  }

  if (!active) reasons.push("KIT_DISABLED");

  const sellable = reasons.length === 0;

  return {
    sellable,
    reasons,
    identityStatus: identity.status,
    priceStatus: price.status,
    canonicalKitId: identity.canonicalKitId,
    sourceIdentifierSnapshot: identity.sourceIdentifierSnapshot,
    chargeableAmountMinor: sellable ? price.amountMinor : null,
  };
}

/**
 * Convenience for the common call site: decide from the raw clinical
 * identifier in one step.
 *
 * An UNRESOLVED identifier is never priced — `getKitPrice` is not even
 * consulted, because asking "what does it cost" about a product you cannot
 * name is how a wrong price gets attached to a wrong kit.
 */
export function evaluateKitForPatientSale(
  rawIdentifier: string,
  options: { active?: boolean } = {},
): SellableDecision {
  const identity = resolveKitIdentity(rawIdentifier);

  if (identity.canonicalKitId === null) {
    return canSellToPatient({
      identity,
      price: {
        status: "PRICE_MISSING",
        amountMinor: null,
        currency: "INR",
        source: "NONE",
      },
      active: options.active,
    });
  }

  return canSellToPatient({
    identity,
    price: getKitPrice(identity.canonicalKitId),
    active: options.active,
  });
}

/**
 * Whole-order gate. An order is chargeable only if every line is sellable —
 * a cart cannot be part-priced, because a patient shown a subtotal will read
 * it as the price of everything in front of them.
 */
export function evaluateOrderForPatientCharge(rawIdentifiers: string[]): {
  chargeable: boolean;
  totalAmountMinor: number | null;
  lines: SellableDecision[];
  blockingReasons: NonSellableReason[];
} {
  const lines = rawIdentifiers.map((id) => evaluateKitForPatientSale(id));
  const chargeable = lines.length > 0 && lines.every((l) => l.sellable);

  const blockingReasons = [
    ...new Set(lines.flatMap((l) => l.reasons)),
  ] as NonSellableReason[];

  return {
    chargeable,
    totalAmountMinor: chargeable
      ? lines.reduce((sum, l) => sum + (l.chargeableAmountMinor ?? 0), 0)
      : null,
    lines,
    blockingReasons,
  };
}

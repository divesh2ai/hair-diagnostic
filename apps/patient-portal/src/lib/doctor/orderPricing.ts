// Doctor Orders — line items and order value, priced by the SAME governance
// authority the patient's cart bills against.
//
// ── Why this exists ─────────────────────────────────────────────────────────
// /api/doctor/orders used to price each stored kit id with
// `priceForKit(kitId) = KIT_PRICE_INR[kitId] ?? 5500`. That lookup is exact-
// match only and never fails: a raw/prescribed identifier that is not a literal
// key in KIT_PRICE_INR (e.g. "PRO IMMUNE VEG", "PRO FACT META B PCOS", a
// hyperthyroid Thyroid variant, the legacy "PHENOTYPE INFLAMATION" spelling) was
// silently quoted at ₹5,500 — a number that corresponds to no product and no
// price sheet. The kit NAME still resolved (getKitInfo normalises aliases), so a
// line read, say, "Pro Immune 5 — ₹5,500" while the patient's cart charged
// ₹2,692 for the very same order.
//
// The patient cart never had this problem because it resolves identity first
// (`resolveKitIdentity`) and prices through the governed approved table
// (`getKitPrice`), surfacing an explicit review/pending state rather than an
// invented number — see lib/commerce/sellability and lib/cart/loadCartData.
//
// This module routes the doctor view through that identical authority
// (`evaluateOrderForPatientCharge`) and maps each decision to the same
// commercial states the cart renders, so the two surfaces cannot disagree about
// what a kit costs — which is what the orders route always intended.

import { getKitInfo } from "@hairos/packages/registries/kits/info";
import { evaluateOrderForPatientCharge } from "@/lib/commerce/sellability";
import { formatInrFromMinor } from "@/lib/commerce/kitPricing";

/** Mirrors the cart's per-line commercial states (lib/cart/loadCartData). */
export type DoctorOrderCommercialState =
  | "CHARGEABLE"
  | "IDENTITY_REVIEW"
  | "UNAVAILABLE"
  | "PRICE_PENDING";

export interface DoctorOrderLineItem {
  kitId: string;
  displayName: string;
  commercialState: DoctorOrderCommercialState;
  /** Rupees. Non-null ONLY when CHARGEABLE — never an invented placeholder. */
  priceInr: number | null;
  /** Formatted rupee string, or null when there is no chargeable price. */
  priceLabel: string | null;
}

export interface DoctorOrderPricing {
  lineItems: DoctorOrderLineItem[];
  /** True only when every line is sellable at an approved price. */
  chargeable: boolean;
  /** Rupees. Null for a part-priced order — no honest total exists. */
  totalInr: number | null;
  totalLabel: string | null;
}

export function buildDoctorOrderPricing(kitIds: string[]): DoctorOrderPricing {
  const commercial = evaluateOrderForPatientCharge(kitIds);

  const lineItems: DoctorOrderLineItem[] = kitIds.map((kitId, i) => {
    const decision = commercial.lines[i]!;

    const commercialState: DoctorOrderCommercialState = decision.sellable
      ? "CHARGEABLE"
      : decision.reasons.includes("KIT_IDENTITY_REQUIRES_REVIEW")
        ? "IDENTITY_REVIEW"
        : decision.reasons.includes("KIT_NOT_IN_CATALOGUE")
          ? "UNAVAILABLE"
          : "PRICE_PENDING";

    const unitMinor = decision.chargeableAmountMinor;

    // Keep the raw id as the name for a historic kit the registry no longer
    // carries, so a line is never dropped — as the orders route documents.
    const displayName =
      getKitInfo(decision.canonicalKitId ?? kitId)?.displayName ?? kitId;

    return {
      kitId,
      displayName,
      commercialState,
      priceInr: unitMinor === null ? null : unitMinor / 100,
      priceLabel: unitMinor === null ? null : formatInrFromMinor(unitMinor),
    };
  });

  const totalMinor = commercial.totalAmountMinor; // chargeable ? Σ : null

  return {
    lineItems,
    chargeable: commercial.chargeable,
    totalInr: totalMinor === null ? null : totalMinor / 100,
    totalLabel: totalMinor === null ? null : formatInrFromMinor(totalMinor),
  };
}

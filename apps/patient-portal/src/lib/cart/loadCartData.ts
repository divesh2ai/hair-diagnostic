import type { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatInr } from "@/lib/pricing/kitPrices";
import { evaluateOrderForPatientCharge } from "@/lib/commerce/sellability";
import { getKitInfo } from "@hairos/packages/registries/kits/info";
import { resolveApprovedOrder } from "@/lib/consultation/approvedOrder";
import { DEFAULT_KIT_QUANTITY } from "@/lib/commerce/kitQuantity";
import { verifyCartToken } from "@/lib/cartToken";
import { requireDoctorContext, assertDoctorInClinic } from "@/lib/auth";

// The single place that resolves "who may see this order, and what do they
// see" — shared by the API route (GET /api/cart/[assessmentId], still used by
// the client-side quantity/confirm writes) and the page's own server
// component.
//
// Before this, the cart PAGE fetched the cart API over HTTP after mounting:
// server-render -> bundle -> hydrate -> fetch -> paint, the exact waterfall
// the doctor dashboard and review page were already rewritten to avoid (see
// their own page.tsx headers). Factoring the query out means the page can
// call it directly during server render, the same way loadReview.ts and
// dashboardStats.ts already do for their surfaces — one fewer round trip, and
// one fewer place that could answer "which order is this" differently.

export type CartCaller =
  | { kind: "patient"; token: string }
  | { kind: "doctor" }
  | { kind: "denied" };

/**
 * Resolve the caller from a cart token, already extracted from the request
 * (a query string on the API route, a searchParam on the page). Token first —
 * it is the patient path, the common case, and costs no database round trip.
 * The doctor-session fallback only runs when there is no usable token.
 */
export async function resolveCartCaller(
  assessmentId: string,
  token: string | null,
): Promise<CartCaller> {
  if (token) {
    const verdict = verifyCartToken(token, assessmentId);
    if (verdict.ok) return { kind: "patient", token };
    // A present-but-invalid token is never upgraded to a session check —
    // falling through would let a bad token probe for a doctor session.
    return { kind: "denied" };
  }

  try {
    const authResult = await requireDoctorContext();
    if (authResult instanceof NextResponse) return { kind: "denied" };
    const { doctor } = authResult;
    const target = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { clinicId: true },
    });
    if (!target) return { kind: "denied" };
    return assertDoctorInClinic(doctor, target.clinicId)
      ? { kind: "denied" }
      : { kind: "doctor" };
  } catch {
    return { kind: "denied" };
  }
}

export interface CartLineItem {
  kitId: string;
  sourceIdentifierSnapshot: string;
  displayName: string | null;
  description: string | null;
  quantity: number;
  commercialState: "CHARGEABLE" | "IDENTITY_REVIEW" | "UNAVAILABLE" | "PRICE_PENDING";
  blockingReasons: string[];
  unitPriceMinor: number | null;
  unitPriceLabel: string | null;
  lineTotalMinor: number | null;
}

export interface CartData {
  viewer: "doctor" | "patient";
  order: {
    id: string;
    status: string;
    consultationVersionId: string;
    contentVersion: number;
  };
  patient: { name: string | null; phone: string | null } | null;
  clinic: {
    name: string;
    slug: string;
    logoUrl: string | null;
    primaryColor: string | null;
  } | null;
  doctor: {
    name: string | null;
    specialization: string | null;
    photoUrl: string | null;
  } | null;
  lineItems: CartLineItem[];
  chargeable: boolean;
  blockingReasons: string[];
  subtotalMinor: number | null;
  subtotalLabel: string | null;
  assessmentId: string;
}

/**
 * The order for an assessment, formatted for either viewer. Returns null on
 * any miss — assessment not found, no approved version, no ready order — so
 * every caller answers "not ready yet" with the same body, never a 401/403
 * that would itself disclose that an order exists.
 */
export async function loadCartData(
  db: PrismaClient,
  assessmentId: string,
  caller: Extract<CartCaller, { kind: "doctor" | "patient" }>,
): Promise<CartData | null> {
  const approved = await resolveApprovedOrder(db, assessmentId);

  const intent = approved
    ? await db.kitOrderIntent.findUnique({
        where: { id: approved.intentId },
        select: {
          id: true,
          kitIds: true,
          status: true,
          assessment: {
            select: {
              id: true,
              patient: { select: { name: true, phone: true } },
            },
          },
          clinic: {
            select: { id: true, name: true, slug: true, logoUrl: true, primaryColor: true },
          },
          doctor: {
            select: { name: true, specialization: true, avatarUrl: true, photoUrl: true },
          },
        },
      })
    : null;

  if (!intent || !approved) return null;

  // Quantity prefers the persisted per-kit map (a doctor's explicit stepper
  // choice) and falls back to the default two-month supply when none was
  // recorded — see lib/commerce/kitQuantity and lib/consultation/approvedOrder.
  const qtyFor = (kitId: string) => approved.quantities?.[kitId] ?? DEFAULT_KIT_QUANTITY;

  // Commercial identity and price are decided by the governance layer, never
  // by the clinical registry and never by a flat placeholder price. See
  // lib/commerce/sellability and lib/commerce/kitIdentity for why.
  const commercial = evaluateOrderForPatientCharge(intent.kitIds);

  const lineItems: CartLineItem[] = intent.kitIds.map((kitId, i) => {
    const decision = commercial.lines[i]!;
    const quantity = qtyFor(kitId);
    const info = decision.canonicalKitId ? getKitInfo(decision.canonicalKitId) : null;

    const commercialState = decision.sellable
      ? ("CHARGEABLE" as const)
      : decision.reasons.includes("KIT_IDENTITY_REQUIRES_REVIEW")
        ? ("IDENTITY_REVIEW" as const)
        : decision.reasons.includes("KIT_NOT_IN_CATALOGUE")
          ? ("UNAVAILABLE" as const)
          : ("PRICE_PENDING" as const);

    const unitPriceMinor = decision.chargeableAmountMinor;

    return {
      kitId,
      sourceIdentifierSnapshot: decision.sourceIdentifierSnapshot,
      displayName: info?.displayName ?? null,
      description: info?.treatmentObjective ?? null,
      quantity,
      commercialState,
      blockingReasons: decision.reasons,
      unitPriceMinor,
      unitPriceLabel: unitPriceMinor === null ? null : formatInr(unitPriceMinor / 100),
      lineTotalMinor: unitPriceMinor === null ? null : unitPriceMinor * quantity,
    };
  });

  // A part-priced order has no honest total — see the cart route's own
  // header for why nothing is invented to fill the gap.
  const subtotalMinor = commercial.chargeable
    ? lineItems.reduce((sum, li) => sum + (li.lineTotalMinor ?? 0), 0)
    : null;

  return {
    viewer: caller.kind,
    order: {
      id: intent.id,
      status: intent.status,
      consultationVersionId: approved.consultationVersionId,
      contentVersion: approved.contentVersion,
    },
    patient: intent.assessment?.patient
      ? { name: intent.assessment.patient.name, phone: intent.assessment.patient.phone }
      : null,
    clinic: intent.clinic
      ? {
          name: intent.clinic.name,
          slug: intent.clinic.slug,
          logoUrl: intent.clinic.logoUrl,
          primaryColor: intent.clinic.primaryColor,
        }
      : null,
    doctor: intent.doctor
      ? {
          name: intent.doctor.name,
          specialization: intent.doctor.specialization,
          photoUrl: intent.doctor.avatarUrl ?? intent.doctor.photoUrl ?? null,
        }
      : null,
    lineItems,
    chargeable: commercial.chargeable,
    blockingReasons: commercial.blockingReasons,
    subtotalMinor,
    subtotalLabel: subtotalMinor === null ? null : formatInr(subtotalMinor / 100),
    assessmentId,
  };
}

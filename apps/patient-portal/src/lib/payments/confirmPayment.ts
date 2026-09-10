import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import {
  ensureFulfilmentRequest,
  type FulfilmentRecord,
} from "@/lib/fulfilment/fulfilmentStore";
import {
  requiresClinicFulfilment,
  resolveFulfilmentMode,
} from "@/lib/fulfilment/fulfilmentMode";
import { markPaid, type PaymentRecord, type PaymentSource } from "./paymentStore";

// The payment → fulfilment contract.
//
// ══ WHICH EVENT TRIGGERS FULFILMENT ═════════════════════════════════════════
//
// PAYMENT_COMPLETED. Not doctor approval. That is read off the existing
// commerce model rather than chosen:
//
//   • The patient cart (`/cart/[assessmentId]`) renders priced line items and
//     a subtotal, and its confirm button is explicitly a placeholder for a
//     payment step ("Payment integration lands … in the next sprint").
//   • `KitOrderIntent`'s own contract says doctor approval is the CLINICAL
//     authorization and that "ops picks up from here" — it is what makes the
//     order legitimate, not what makes it owed.
//   • Nothing in the schema or the app grants kits before payment: there is no
//     credit, invoice, or account-balance model anywhere.
//
// So approval authorises, and payment obliges. Creating a fulfilment request
// at approval would put stock on a courier for an order that may never be
// paid — and, for a clinic-supplied kit, the clinic carries that cost.
//
// The one line to change if that ever stops being true is the call site: this
// function is the only thing that creates a fulfilment request, so moving the
// trigger means calling it from somewhere else, not rewriting the rule in two
// places.
//
// ══ IDEMPOTENCY ═════════════════════════════════════════════════════════════
//
// Two database constraints do the work, and neither is a read-then-write:
//
//   KitOrderPayment.kitOrderIntentId      UNIQUE  → one payment per order
//   ClinicKitFulfilment.kitOrderIntentId  UNIQUE  → one request per order
//
// A gateway that delivers the same webhook fifty times produces exactly one
// PAID row and exactly one fulfilment request. The fulfilment call is gated on
// `outcome === "paid"` as well, so the forty-nine duplicates do not even
// attempt it — and if one did, the constraint would still refuse.

export type ConfirmOutcome = "paid" | "already_paid";

export interface ConfirmPaymentInput {
  kitOrderIntentId: string;
  source: PaymentSource;
  amountMinor: number | null;
  provider: string | null;
  providerRef: string | null;
  /** Set for CLINIC_COUNTER; null for webhooks — no human took that action. */
  recordedByDoctorId: string | null;
  /** Audit attribution for the authenticated identity, when there is one. */
  actorId: string | null;
  actorType: "doctor" | "admin_view" | "system";
  /**
   * When set, the order must belong to this clinic or the confirmation is
   * refused. Supplied by the clinic-counter endpoint. Webhooks pass null: a
   * gateway callback is not scoped to a tenant, and the order it names IS the
   * tenant.
   */
  requireClinicId?: string | null;
}

export type ConfirmPaymentResult =
  | { ok: false; reason: "order_not_found" | "cross_clinic" | "reference_conflict" }
  | {
      ok: true;
      outcome: ConfirmOutcome;
      payment: PaymentRecord;
      /** Null when the order is patient-delivery, or on a duplicate event. */
      fulfilment: FulfilmentRecord | null;
      fulfilmentCreated: boolean;
      mode: "PATIENT" | "CLINIC";
    };

export async function confirmPayment(
  input: ConfirmPaymentInput,
): Promise<ConfirmPaymentResult> {
  // The order is read from the database, never from the caller. A webhook body
  // is attacker-shaped input: it may name an order id, but it must not be able
  // to tell us which clinic that order belongs to, how much it was for, or who
  // the doctor is. Every one of those comes from our own row.
  const intent = await prisma.kitOrderIntent.findUnique({
    where: { id: input.kitOrderIntentId },
    select: {
      id: true,
      clinicId: true,
      doctorId: true,
      assessmentId: true,
      status: true,
    },
  });

  if (!intent) return { ok: false, reason: "order_not_found" };
  if (input.requireClinicId && intent.clinicId !== input.requireClinicId) {
    return { ok: false, reason: "cross_clinic" };
  }

  // `fulfilmentMode` is on the unapplied migration, so it is read over raw SQL
  // by the fulfilment store rather than through the typed client above.
  const { readFulfilmentMode } = await import("@/lib/fulfilment/fulfilmentStore");
  const storedMode = await readFulfilmentMode(intent.id);
  const { mode, explicit } = resolveFulfilmentMode(storedMode);

  const paid = await markPaid({
    kitOrderIntentId: intent.id,
    clinicId: intent.clinicId,
    assessmentId: intent.assessmentId,
    source: input.source,
    amountMinor: input.amountMinor,
    provider: input.provider,
    providerRef: input.providerRef,
    recordedByDoctorId: input.recordedByDoctorId,
  });

  if (paid.outcome === "reference_conflict") {
    // The same gateway payment id has arrived for a second, different order.
    // Nothing is written and no fulfilment is triggered: one payment cannot
    // settle two orders, and guessing which one it belongs to would be worse
    // than refusing. Audited so an operator can reconcile it by hand.
    await writeAuditLog({
      action: "KIT_ORDER_PAYMENT_DUPLICATE_IGNORED",
      entityType: "KitOrderIntent",
      entityId: intent.id,
      assessmentId: intent.assessmentId,
      clinicId: intent.clinicId,
      actorId: input.actorId,
      actorType: input.actorType === "system" ? "system" : input.actorType,
      metadata: {
        source: input.source,
        provider: input.provider,
        providerRef: input.providerRef,
        reason: "reference_already_used_by_another_order",
      },
    });
    return { ok: false, reason: "reference_conflict" };
  }

  if (paid.outcome === "already_paid") {
    // Audited, at low volume, because a duplicate is the normal case and the
    // interesting signal is a duplicate arriving days later or from a second
    // provider — which this row makes visible without turning the audit log
    // into a webhook access log.
    await writeAuditLog({
      action: "KIT_ORDER_PAYMENT_DUPLICATE_IGNORED",
      entityType: "KitOrderIntent",
      entityId: intent.id,
      assessmentId: intent.assessmentId,
      clinicId: intent.clinicId,
      actorId: input.actorId,
      actorType: input.actorType === "system" ? "system" : input.actorType,
      metadata: {
        source: input.source,
        provider: input.provider,
        // The provider's own reference, which is a commercial identifier and
        // not patient data — it is what a finance reconciliation needs.
        providerRef: input.providerRef,
      },
    });
    return {
      ok: true,
      outcome: "already_paid",
      payment: paid.payment,
      fulfilment: null,
      fulfilmentCreated: false,
      mode,
    };
  }

  await writeAuditLog({
    action: "KIT_ORDER_PAYMENT_CONFIRMED",
    entityType: "KitOrderIntent",
    entityId: intent.id,
    assessmentId: intent.assessmentId,
    clinicId: intent.clinicId,
    actorId: input.actorId,
    actorType: input.actorType === "system" ? "system" : input.actorType,
    metadata: {
      source: input.source,
      provider: input.provider,
      providerRef: input.providerRef,
      amountMinor: paid.payment.amountMinor,
      currency: paid.payment.currency,
    },
  });

  // ── The fulfilment trigger ────────────────────────────────────────────────
  // Only for a clinic-supplied order. A patient-delivery order deliberately
  // produces NO clinic fulfilment request — there is nothing for the clinic's
  // ops queue to do with it, and a request nobody can action is worse than
  // none at all because it makes the queue untrustworthy.
  if (!requiresClinicFulfilment(mode)) {
    return {
      ok: true,
      outcome: "paid",
      payment: paid.payment,
      fulfilment: null,
      fulfilmentCreated: false,
      mode,
    };
  }

  const { fulfilment, created } = await ensureFulfilmentRequest({
    kitOrderIntentId: intent.id,
    clinicId: intent.clinicId,
    doctorId: intent.doctorId,
    assessmentId: intent.assessmentId,
    mode,
  });

  if (created) {
    await writeAuditLog({
      action: "KIT_FULFILMENT_REQUESTED",
      entityType: "ClinicKitFulfilment",
      entityId: fulfilment.id,
      assessmentId: intent.assessmentId,
      clinicId: intent.clinicId,
      actorId: input.actorId,
      // The system created this, whoever confirmed the payment. Attributing it
      // to the clinic user who took the money would claim they made an ops
      // decision they were not asked to make.
      actorType: "system",
      metadata: {
        kitOrderIntentId: intent.id,
        mode,
        // Whether the destination was chosen or defaulted — see
        // lib/fulfilment/fulfilmentMode. Ops should be able to tell.
        modeExplicit: explicit,
        trigger: "PAYMENT_COMPLETED",
      },
    });
  }

  return {
    ok: true,
    outcome: "paid",
    payment: paid.payment,
    fulfilment,
    fulfilmentCreated: created,
    mode,
  };
}

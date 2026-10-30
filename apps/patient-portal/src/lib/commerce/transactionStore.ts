import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertPurchasingEnabled } from "./purchasingGate";
import { guardedPurchase } from "./purchaseStore";
import { CheckoutError, priceSelection, sameSelection, validTransactionKey, type CheckoutLine, type CheckoutSelection } from "./partialCheckout";
import { DEFAULT_KIT_QUANTITY } from "./kitQuantity";
import { deriveLineState, type KitPurchaseEventType, type KitPurchaseLineStatus } from "./kitPurchaseModel";

export interface PurchaseTransaction {
  id: string; kitOrderIntentId: string; clinicId: string; assessmentId: string;
  clientTransactionId: string; selection: CheckoutLine[]; amountMinor: number;
  currency: string; status: "PENDING" | "PAID" | "REFUNDED" | "CANCELLED";
  reference: string | null; reason: string | null; createdAt: Date; paidAt: Date | null; refundedAt: Date | null;
}
type Tx = Prisma.TransactionClient;

export async function listPurchaseTransactions(clinicId: string, intentId: string) {
  return guardedPurchase(() => prisma.$queryRaw<PurchaseTransaction[]>`
    SELECT * FROM "KitPurchaseTransaction" WHERE "clinicId"=${clinicId}
    AND "kitOrderIntentId"=${intentId} ORDER BY "createdAt" DESC`);
}

async function lockedOrder(tx: Tx, clinicId: string, intentId: string, requireCurrent = true) {
  // Every checkout/payment/control operation takes this lock first. Concurrent
  // requests cannot oversell the outstanding recommendation or bypass a stop.
  const rows = await tx.$queryRaw<Array<{id: string; assessmentId: string; patientId: string; kitIds: string[]; quantities: unknown; current: boolean}>>`
    SELECT i.id, i."assessmentId", c."patientId", i."kitIds", i.quantities,
      (c."currentVersionId"=i."consultationVersionId" AND v."approvalStatus"::text='APPROVED'
       AND i.status::text='READY_FOR_FULFILMENT') AS current
    FROM "KitOrderIntent" i JOIN "Consultation" c ON c.id=i."consultationId"
    JOIN "ConsultationVersion" v ON v.id=i."consultationVersionId"
    WHERE i.id=${intentId} AND i."clinicId"=${clinicId} FOR UPDATE OF i,c`;
  if (!rows[0]) throw new CheckoutError("not_found", 404);
  if (requireCurrent && !rows[0].current) throw new CheckoutError("plan_requires_review");
  return rows[0];
}

async function assertAvailable(tx: Tx, clinicId: string, intentId: string, lines: CheckoutLine[], quantities: unknown) {
  for (const item of lines) {
    const [line] = await tx.$queryRaw<Array<{id:string; recommendedBoxes:number; lineStatus:KitPurchaseLineStatus}>>`
      SELECT id,"recommendedBoxes","lineStatus"::text AS "lineStatus" FROM "KitPurchaseLine"
      WHERE "clinicId"=${clinicId} AND "kitOrderIntentId"=${intentId} AND "kitId"=${item.kitId}`;
    if (line && ["DECLINED","DISCONTINUED","SUBSTITUTED"].includes(line.lineStatus)) throw new CheckoutError("kit_requires_review");
    const events = line ? await tx.$queryRaw<Array<{eventType:KitPurchaseEventType; boxes:number|null; occurredAt:Date}>>`
      SELECT "eventType"::text AS "eventType",boxes,"occurredAt" FROM "KitPurchaseEvent"
      WHERE "clinicId"=${clinicId} AND "kitPurchaseLineId"=${line.id}` : [];
    const raw = quantities && typeof quantities === "object" ? (quantities as Record<string,number>)[item.kitId] : null;
    const recommended = line?.recommendedBoxes ?? (Number.isSafeInteger(raw) && raw! > 0 ? raw! : DEFAULT_KIT_QUANTITY);
    const state = deriveLineState(recommended, line?.lineStatus ?? "RECOMMENDED", events.map(e=>({...e, occurredAt:e.occurredAt.toISOString()})));
    if (item.boxes > Math.max(0, state.remainingBoxes - state.externallyObtainedBoxes)) throw new CheckoutError("quantity_exceeds_outstanding");
  }
}

export async function createPurchaseTransaction(input: { clinicId:string; intentId:string; clientTransactionId:unknown; selection:unknown }) {
  assertPurchasingEnabled();
  if (!validTransactionKey(input.clientTransactionId)) throw new CheckoutError("invalid_transaction_id",400);
  const key = input.clientTransactionId;
  return guardedPurchase(() => prisma.$transaction(async tx => {
    const order = await lockedOrder(tx,input.clinicId,input.intentId);
    const [prior] = await tx.$queryRaw<PurchaseTransaction[]>`SELECT * FROM "KitPurchaseTransaction"
      WHERE "clinicId"=${input.clinicId} AND "kitOrderIntentId"=${input.intentId} AND "clientTransactionId"=${key}`;
    // Compare the original selection before re-pricing a retry: history is immutable.
    if (prior) {
      if (!Array.isArray(input.selection) || !sameSelection(prior.selection,input.selection as CheckoutSelection[])) throw new CheckoutError("idempotency_conflict");
      return {transaction:prior,created:false};
    }
    const priced = priceSelection(order.kitIds,input.selection);
    const pending = await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM "KitPurchaseTransaction" WHERE "clinicId"=${input.clinicId}
      AND "kitOrderIntentId"=${input.intentId} AND status='PENDING'`;
    if (pending.length) throw new CheckoutError("pending_checkout_exists");
    // A legacy whole-order payment cannot safely be inferred into partial lines.
    const legacy = await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM "KitOrderPayment" WHERE "kitOrderIntentId"=${input.intentId} AND status::text='PAID'`;
    if (legacy.length) throw new CheckoutError("legacy_payment_requires_reconciliation");
    await assertAvailable(tx,input.clinicId,input.intentId,priced.lines,order.quantities);
    const id = crypto.randomUUID();
    const [transaction] = await tx.$queryRaw<PurchaseTransaction[]>`INSERT INTO "KitPurchaseTransaction"
      (id,"kitOrderIntentId","clinicId","assessmentId","clientTransactionId",selection,"amountMinor")
      VALUES (${id},${input.intentId},${input.clinicId},${order.assessmentId},${key},${JSON.stringify(priced.lines)}::jsonb,${priced.amountMinor}) RETURNING *`;
    return {transaction,created:true};
  }, {timeout:15000}));
}

/** Clinic-counter evidence only. Does not initiate a gateway charge or refund. */
export async function transitionPurchaseTransaction(input: {
  clinicId:string; intentId:string; transactionId:string; doctorId:string;
  action:"PAID"|"REFUNDED"|"CANCELLED"; reference?:string; reason?:string;
}) {
  assertPurchasingEnabled();
  return guardedPurchase(() => prisma.$transaction(async tx => {
    const order = await lockedOrder(tx,input.clinicId,input.intentId,input.action === "PAID");
    const [transaction] = await tx.$queryRaw<PurchaseTransaction[]>`SELECT * FROM "KitPurchaseTransaction"
      WHERE id=${input.transactionId} AND "clinicId"=${input.clinicId} AND "kitOrderIntentId"=${input.intentId} FOR UPDATE`;
    if (!transaction) throw new CheckoutError("not_found",404);
    if (transaction.status === input.action) {
      if (input.action === "PAID" && transaction.reference !== input.reference?.trim()) throw new CheckoutError("idempotency_conflict");
      if (input.action !== "PAID" && transaction.reason !== input.reason?.trim()) throw new CheckoutError("idempotency_conflict");
      return {transaction,created:false};
    }
    if (input.action === "PAID") {
      if (transaction.status !== "PENDING") throw new CheckoutError("invalid_payment_transition");
      if (!input.reference?.trim() || input.reference.length > 128) throw new CheckoutError("reference_required",400);
      const fresh = priceSelection(order.kitIds,transaction.selection);
      if (fresh.amountMinor !== transaction.amountMinor || fresh.lines.some(line=> {
        const stored=transaction.selection.find(s=>s.kitId===line.kitId);
        return !stored || stored.boxes!==line.boxes || stored.unitMinor!==line.unitMinor || stored.amountMinor!==line.amountMinor;
      })) throw new CheckoutError("price_changed_restart_checkout");
      await assertAvailable(tx,input.clinicId,input.intentId,transaction.selection,order.quantities);
    } else if (!input.reason?.trim() || input.reason.length > 2000) throw new CheckoutError("reason_required",400);
    if (input.action === "CANCELLED" && transaction.status !== "PENDING") throw new CheckoutError("invalid_payment_transition");
    if (input.action === "REFUNDED" && transaction.status !== "PAID") throw new CheckoutError("invalid_payment_transition");

    if (input.action !== "CANCELLED") for (const item of transaction.selection) {
      const raw = order.quantities && typeof order.quantities === "object" ? (order.quantities as Record<string,number>)[item.kitId] : null;
      const rec = Number.isSafeInteger(raw) && raw! > 0 ? raw! : DEFAULT_KIT_QUANTITY;
      const lineId = crypto.randomUUID();
      await tx.$executeRaw`INSERT INTO "KitPurchaseLine" (id,"kitOrderIntentId","clinicId","assessmentId","patientId","kitId","kitLabel","recommendedBoxes","updatedAt")
        VALUES (${lineId},${input.intentId},${input.clinicId},${order.assessmentId},${order.patientId},${item.kitId},${item.kitId},${rec},NOW())
        ON CONFLICT ("kitOrderIntentId","kitId") DO NOTHING`;
      const [line] = await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM "KitPurchaseLine" WHERE "kitOrderIntentId"=${input.intentId} AND "kitId"=${item.kitId} AND "clinicId"=${input.clinicId}`;
      const types = input.action === "PAID" ? ["PURCHASE_CONFIRMED_BY_CLINIC","PAYMENT_RECORDED"] : ["REFUNDED"];
      for (const type of types) await tx.$executeRaw`INSERT INTO "KitPurchaseEvent"
        (id,"kitPurchaseLineId","clinicId","assessmentId","eventType",boxes,"catalogUnitMinor","saleValueMinor","occurredAt","recordedByDoctorId",note,"clientEventId","transactionId")
        VALUES (${crypto.randomUUID()},${line.id},${input.clinicId},${order.assessmentId},${type}::"KitPurchaseEventType",
          ${type === "PAYMENT_RECORDED" ? null : item.boxes},${item.unitMinor},${type === "PURCHASE_CONFIRMED_BY_CLINIC" ? null : item.amountMinor},NOW(),${input.doctorId},${input.reason?.trim() ?? null},${transaction.id+":"+type},${transaction.id})`;
    }
    const [updated] = await tx.$queryRaw<PurchaseTransaction[]>`UPDATE "KitPurchaseTransaction" SET status=${input.action},
      reference=COALESCE(${input.reference?.trim() ?? null},reference),"recordedByDoctorId"=${input.doctorId},reason=${input.reason?.trim() ?? null},
      "paidAt"=CASE WHEN ${input.action}='PAID' THEN NOW() ELSE "paidAt" END,
      "refundedAt"=CASE WHEN ${input.action}='REFUNDED' THEN NOW() ELSE "refundedAt" END,"updatedAt"=NOW()
      WHERE id=${transaction.id} AND "clinicId"=${input.clinicId} RETURNING *`;
    return {transaction:updated,created:true};
  }, {timeout:15000})).catch(err => {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2010" && (err.meta as {code?:string})?.code === "23505") throw new CheckoutError("reference_already_used");
    throw err;
  });
}

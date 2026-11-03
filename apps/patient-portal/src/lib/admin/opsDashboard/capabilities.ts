// Capability-gated reads: confirmed orders / revenue (KitOrderPayment) and
// report delivery (WhatsappDelivery).
//
// Both back onto migrations (20260829_post_approval_workflow,
// 20260908_whatsapp_report_delivery) that some environments have not applied.
// The rule the whole dashboard follows: an un-provisioned surface reports
// "Not connected", never a fabricated zero. A clinic with real paid orders and
// a clinic in a database that cannot answer the question must never render the
// same "₹0 / 0 orders".
//
// So these reads are deliberately isolated: each is its own guarded raw query,
// and ANY failure degrades that one section to NOT_CONNECTED while the core
// dashboard (clinics, assessments, approvals, reports-available) keeps working.
// They never throw into the overview loader.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CapabilityState } from "./types";

export interface PaymentByClinic {
  paidOrders: number;
  paidOrdersInWindow: number;
  /** Paise. Summed from KitOrderPayment.amountMinor where status = PAID. */
  revenueMinor: number;
}

export interface DeliveryByClinic {
  reportsSent: number;
  reportsSentInWindow: number;
  reportsDelivered: number;
  reportsDeliveredInWindow: number;
  /** Failed REPORT sends needing attention. */
  reportsFailed: number;
}

export interface CapabilityResult<T> {
  state: CapabilityState;
  byClinic: Map<string, T>;
}

interface WindowArg {
  fromIso: string;
  toIso: string;
}

/** Undefined table/column/object → the migration is simply not applied here. */
function isNotProvisioned(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2010") {
    const meta = (err.meta ?? {}) as { code?: string; message?: string };
    if (["42P01", "42703", "42704", "22P02"].includes(meta.code ?? "")) return true;
    return /does not exist|undefined (table|column)|invalid input value for enum/i.test(
      meta.message ?? err.message,
    );
  }
  // Prisma may also surface these as validation/unknown errors for raw SQL.
  const msg = err instanceof Error ? err.message : String(err);
  return /does not exist|relation .* does not exist|column .* does not exist/i.test(msg);
}

interface PaymentRow {
  clinicId: string | null;
  paid: bigint | number;
  paidWindow: bigint | number;
  revenueMinor: bigint | number;
}

/**
 * Paid orders + revenue per clinic, from KitOrderPayment. "Confirmed order" =
 * status PAID (a browser can never write this; only PROVIDER_WEBHOOK or
 * CLINIC_COUNTER). A KitOrderIntent is NOT counted here — it is a doctor's
 * authorization, not money received.
 */
export async function loadPaymentsByClinic(
  window: WindowArg,
): Promise<CapabilityResult<PaymentByClinic>> {
  try {
    const rows = await prisma.$queryRaw<PaymentRow[]>(Prisma.sql`
      SELECT "clinicId",
             COUNT(*) FILTER (WHERE "status" = 'PAID'::"KitOrderPaymentStatus") AS "paid",
             COUNT(*) FILTER (
               WHERE "status" = 'PAID'::"KitOrderPaymentStatus"
                 AND "paidAt" >= ${window.fromIso}::timestamptz
                 AND "paidAt" <  ${window.toIso}::timestamptz
             ) AS "paidWindow",
             COALESCE(SUM("amountMinor") FILTER (WHERE "status" = 'PAID'::"KitOrderPaymentStatus"), 0) AS "revenueMinor"
        FROM "KitOrderPayment"
       GROUP BY "clinicId"
    `);
    const byClinic = new Map<string, PaymentByClinic>();
    for (const r of rows) {
      if (!r.clinicId) continue;
      byClinic.set(r.clinicId, {
        paidOrders: Number(r.paid),
        paidOrdersInWindow: Number(r.paidWindow),
        revenueMinor: Number(r.revenueMinor),
      });
    }
    return { state: "CONNECTED", byClinic };
  } catch (err) {
    if (!isNotProvisioned(err)) {
      console.warn(
        "[ops-dashboard] payments read failed, reporting NOT_CONNECTED:",
        err instanceof Error ? err.message : String(err),
      );
    }
    return { state: "NOT_CONNECTED", byClinic: new Map() };
  }
}

interface DeliveryRow {
  clinicId: string | null;
  sent: bigint | number;
  sentWindow: bigint | number;
  delivered: bigint | number;
  deliveredWindow: bigint | number;
  failed: bigint | number;
}

/**
 * Report send + provider-delivery evidence per clinic, from WhatsappDelivery.
 *
 * "Sent" = the provider ACCEPTED the message (status SENT or DELIVERED).
 * "Delivered" = a provider delivery receipt arrived (status DELIVERED). These
 * are two different metrics on purpose — a send is not proof of delivery — and
 * the dashboard keeps them in separate columns. Scoped to subject = 'REPORT'
 * so a cart link is never miscounted as a report.
 */
export async function loadDeliveriesByClinic(
  window: WindowArg,
): Promise<CapabilityResult<DeliveryByClinic>> {
  try {
    const rows = await prisma.$queryRaw<DeliveryRow[]>(Prisma.sql`
      SELECT "clinicId",
             COUNT(*) FILTER (WHERE "subject" = 'REPORT' AND "status" IN ('SENT'::"DeliveryStatus", 'DELIVERED'::"DeliveryStatus")) AS "sent",
             COUNT(*) FILTER (
               WHERE "subject" = 'REPORT' AND "status" IN ('SENT'::"DeliveryStatus", 'DELIVERED'::"DeliveryStatus")
                 AND "sentAt" >= ${window.fromIso}::timestamptz AND "sentAt" < ${window.toIso}::timestamptz
             ) AS "sentWindow",
             COUNT(*) FILTER (WHERE "subject" = 'REPORT' AND "status" = 'DELIVERED'::"DeliveryStatus") AS "delivered",
             COUNT(*) FILTER (
               WHERE "subject" = 'REPORT' AND "status" = 'DELIVERED'::"DeliveryStatus"
                 AND "deliveredAt" >= ${window.fromIso}::timestamptz AND "deliveredAt" < ${window.toIso}::timestamptz
             ) AS "deliveredWindow",
             COUNT(*) FILTER (WHERE "subject" = 'REPORT' AND "status" = 'FAILED'::"DeliveryStatus") AS "failed"
        FROM "WhatsappDelivery"
       GROUP BY "clinicId"
    `);
    const byClinic = new Map<string, DeliveryByClinic>();
    for (const r of rows) {
      if (!r.clinicId) continue;
      byClinic.set(r.clinicId, {
        reportsSent: Number(r.sent),
        reportsSentInWindow: Number(r.sentWindow),
        reportsDelivered: Number(r.delivered),
        reportsDeliveredInWindow: Number(r.deliveredWindow),
        reportsFailed: Number(r.failed),
      });
    }
    return { state: "CONNECTED", byClinic };
  } catch (err) {
    if (!isNotProvisioned(err)) {
      console.warn(
        "[ops-dashboard] delivery read failed, reporting NOT_CONNECTED:",
        err instanceof Error ? err.message : String(err),
      );
    }
    return { state: "NOT_CONNECTED", byClinic: new Map() };
  }
}

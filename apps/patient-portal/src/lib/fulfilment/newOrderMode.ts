import type { Prisma, PrismaClient } from "@prisma/client";
import { mergeClinicSettings } from "@/lib/clinic/settings";
import type { FulfilmentMode } from "./fulfilmentMode";

// Where a NEWLY CREATED order's kits are destined.
//
// ══ THE GAP THIS CLOSES ═════════════════════════════════════════════════════
//
// The first cut left `KitOrderIntent.fulfilmentMode` null on every new order
// and resolved null to CLINIC at read time. That worked, and it was wrong in a
// way worth naming: it made a permanent commercial decision — who receives the
// stock, and therefore who carries the cost of it — by omission, and left no
// record that anyone had decided anything. Every order looked identical to
// every other, so a clinic that later moved to direct-to-patient dispatch would
// find its whole order history retroactively reinterpreted the moment the
// default changed.
//
// Now: the clinic states its arrangement once, and every new order is STAMPED
// with the value that was in force when it was placed. Changing the setting
// affects the next order, never the last one.
//
// ══ WHY THE CLINIC AND NOT THE DOCTOR ═══════════════════════════════════════
//
// Fulfilment destination is a commercial arrangement between the platform and
// a clinic, not a clinical judgement about a patient. A doctor approving
// twenty plans a day should not answer the same logistics question twenty
// times — a question asked that often is answered by reflex, which is a silent
// default with extra clicks and worse data.
//
// The doctor keeps a per-order override for the genuine exception (a patient
// who cannot come back in), on the order itself, before it enters fulfilment.

/**
 * Resolve the destination for an order about to be created at this clinic.
 *
 * Reads `Clinic.settings.defaultFulfilmentMode`, which `mergeClinicSettings`
 * fills from `DEFAULT_CLINIC_SETTINGS` when a clinic has never set one. That
 * fallback is CLINIC for Wave 0 — but it is a NAMED default that gets written
 * onto the row, not a null anyone has to interpret later.
 *
 * Never throws: a clinic whose settings blob is unreadable still gets an order.
 */
export async function resolveNewOrderFulfilmentMode(
  prisma: PrismaClient | Prisma.TransactionClient,
  clinicId: string,
): Promise<FulfilmentMode> {
  try {
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { settings: true },
    });
    const settings = mergeClinicSettings(clinic?.settings);
    return settings.defaultFulfilmentMode === "PATIENT" ? "PATIENT" : "CLINIC";
  } catch {
    return "CLINIC";
  }
}

/**
 * Validate a caller-supplied mode.
 *
 * The override endpoint receives this from a browser, so the string is
 * untrusted: an unvalidated value would reach a `::"KitFulfilmentMode"` cast
 * and either fail loudly or — worse, if the enum ever grows — quietly select a
 * state no product rule covers. Two literals in, or nothing.
 */
export function parseFulfilmentMode(value: unknown): FulfilmentMode | null {
  return value === "PATIENT" || value === "CLINIC" ? value : null;
}

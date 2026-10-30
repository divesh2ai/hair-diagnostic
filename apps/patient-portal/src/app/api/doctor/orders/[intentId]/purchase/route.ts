// /api/doctor/orders/[intentId]/purchase
//
//   GET   — READ-ONLY. One view per recommended kit with derived
//           purchased/remaining boxes and status, plus the dated event ledger.
//           It does not write: lines are synthesised from the approved order
//           when none are persisted yet, and only materialised on the first
//           write below. Governed prices are resolved SERVER-SIDE for display.
//   POST  — append a dated purchase/dispense/treatment event (keyed by kitId),
//           idempotently. Requires a stable clientEventId.
//   PATCH — set a kit's control status (defer/decline/substitute/discontinue).
//
// The approved order (KitOrderIntent.kitIds / quantities) is NEVER mutated. A
// write only ever touches the line for a kit that is actually on THIS order,
// resolved by (intentId, kitId) — a line from another order cannot be reached.
// Governed catalog prices are never taken from the request; the browser may
// only supply a separately-recorded offline sale value.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { DEFAULT_KIT_QUANTITY } from "@/lib/commerce/kitQuantity";
import { buildDoctorOrderPricing } from "@/lib/doctor/orderPricing";
import {
  assertPurchasingEnabled,
  PurchasingDisabledError,
  PURCHASING_DISABLED_CODE,
} from "@/lib/commerce/purchasingGate";
import {
  deriveLineState,
  summarisePlan,
  validatePurchaseEvent,
  isMoneyEvent,
  requiresReason,
  type KitPurchaseEventType,
  type KitPurchaseLineStatus,
  type PurchaseEventInput,
} from "@/lib/commerce/kitPurchaseModel";
import {
  ensurePurchaseLines,
  listLinesByIntent,
  listEventsByIntent,
  readLineByKit,
  appendPurchaseEvent,
  PURCHASE_NOT_PROVISIONED,
  PurchaseNotProvisionedError,
  type PurchaseEventRecord,
} from "@/lib/commerce/purchaseStore";

export const dynamic = "force-dynamic";

function recommendedBoxesFor(quantities: unknown, kitId: string): number {
  if (quantities && typeof quantities === "object") {
    const v = (quantities as Record<string, unknown>)[kitId];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return Math.trunc(v);
  }
  return DEFAULT_KIT_QUANTITY;
}

/**
 * Governed catalog price per kit, resolved SERVER-SIDE from the pricing engine
 * — never trusted from the browser. Returns minor units (paise) or null when
 * the kit is not chargeable / has no governed price. No price is invented.
 */
function governedUnitMinor(kitIds: string[]): Map<string, number | null> {
  const out = new Map<string, number | null>();
  try {
    const pricing = buildDoctorOrderPricing(kitIds);
    for (const li of pricing.lineItems) {
      out.set(li.kitId, li.priceInr == null ? null : Math.round(li.priceInr * 100));
    }
  } catch {
    // Pricing resolution must never break recording; leave prices null.
  }
  for (const kitId of kitIds) if (!out.has(kitId)) out.set(kitId, null);
  return out;
}

function notProvisioned(err: unknown): NextResponse | null {
  if (err instanceof PurchaseNotProvisionedError) {
    return NextResponse.json({ error: PURCHASE_NOT_PROVISIONED }, { status: 503 });
  }
  return null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ intentId: string }> }) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor } = authResult;
  const { intentId } = await ctx.params;

  const intent = await loadIntent(intentId, doctor.clinicId);
  if (!intent || !intent.consultation?.patientId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    // READ-ONLY: read whatever is persisted FOR THIS ORDER; do not create lines
    // here, and do not read by assessment (a re-approval can leave a second
    // intent on the same assessment — reading by assessment would mix them).
    const [persistedLines, events] = await Promise.all([
      listLinesByIntent(doctor.clinicId, intent.id),
      listEventsByIntent(doctor.clinicId, intent.id),
    ]);
    const prices = governedUnitMinor(intent.kitIds);

    const eventsByLine = new Map<string, PurchaseEventRecord[]>();
    for (const e of events) {
      const arr = eventsByLine.get(e.kitPurchaseLineId) ?? [];
      arr.push(e);
      eventsByLine.set(e.kitPurchaseLineId, arr);
    }
    const toInputs = (evs: PurchaseEventRecord[]): PurchaseEventInput[] =>
      evs.map((e) => ({ eventType: e.eventType, boxes: e.boxes, occurredAt: e.occurredAt }));

    // One view per kit on the approved order, preserving the full plan. A kit
    // with a persisted line uses it; a kit without one is shown as RECOMMENDED
    // with no events (and lineId null) — visible, never implied as purchased.
    const byKit = new Map(persistedLines.map((l) => [l.kitId, l]));
    const lineViews = intent.kitIds.map((kitId) => {
      const line = byKit.get(kitId);
      const recommendedBoxes = line?.recommendedBoxes ?? recommendedBoxesFor(intent.quantities, kitId);
      const evs = line ? eventsByLine.get(line.id) ?? [] : [];
      return {
        kitId,
        lineId: line?.id ?? null,
        kitLabel: line?.kitLabel ?? kitId,
        recommendedBoxes,
        lineStatus: line?.lineStatus ?? "RECOMMENDED",
        substituteKitId: line?.substituteKitId ?? null,
        controlReason: line?.controlReason ?? null,
        catalogUnitMinor: prices.get(kitId) ?? null,
        events: evs,
        derived: deriveLineState(recommendedBoxes, line?.lineStatus ?? "RECOMMENDED", toInputs(evs)),
      };
    });

    const summary = summarisePlan(
      lineViews.map((v) => ({
        recommendedBoxes: v.recommendedBoxes,
        storedStatus: v.lineStatus as KitPurchaseLineStatus,
        events: toInputs(v.events),
      })),
    );

    return NextResponse.json({ intentId: intent.id, summary, lines: lineViews });
  } catch (err) {
    const np = notProvisioned(err);
    if (np) return np;
    throw err;
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ intentId: string }> }) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor, authUserId, authRole, mode } = authResult;
  const { intentId } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as {
    kitId?: string;
    eventType?: string;
    boxes?: number | null;
    reason?: string | null;
    saleValueMinor?: number | null;
    currency?: string;
    kitOrderPaymentId?: string | null;
    occurredAt?: string;
    clientEventId?: string;
    substituteKitId?: string;
  };

  if (!body.kitId) return NextResponse.json({ error: "kitId_required" }, { status: 400 });
  // A stable idempotency key is mandatory: it is how a retried submit is made
  // safe. Without it we cannot tell a replay from a second real action.
  if (typeof body.clientEventId !== "string" || body.clientEventId.trim().length === 0 || body.clientEventId.length > 128) {
    return NextResponse.json({ error: "clientEventId_required" }, { status: 400 });
  }
  // Governed price is never accepted from the client; reject if supplied so a
  // caller cannot believe it took effect.
  if ("catalogUnitMinor" in body) {
    return NextResponse.json({ error: "catalog_price_is_server_resolved" }, { status: 400 });
  }
  const validationError = validatePurchaseEvent({
    eventType: body.eventType,
    boxes: body.boxes,
    reason: body.reason,
    saleValueMinor: body.saleValueMinor,
  });
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  const eventType = body.eventType as KitPurchaseEventType;
  if (["PAYMENT_RECORDED", "REFUNDED"].includes(eventType) || body.saleValueMinor != null || body.kitOrderPaymentId != null) {
    return NextResponse.json({ error: "use_selected_transaction" }, { status: 409 });
  }

  const intent = await loadIntent(intentId, doctor.clinicId);
  if (!intent || !intent.consultation?.patientId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // The kit must be on THIS approved order.
  if (!intent.kitIds.includes(body.kitId)) {
    return NextResponse.json({ error: "kit_not_on_order" }, { status: 400 });
  }

  if (eventType === "SUBSTITUTED" && (typeof body.substituteKitId !== "string" || body.substituteKitId === body.kitId || !intent.kitIds.includes(body.substituteKitId))) {
    return NextResponse.json({ error: "substitute_must_be_on_approved_plan" }, { status: 400 });
  }
  // Money recording passes through the purchasing kill-switch, exactly like
  // lib/payments/paymentStore. Quantity / dispensing / clinical-state records
  // carry no money and are always allowed.
  if (isMoneyEvent(eventType, body.saleValueMinor ?? null)) {
    try {
      assertPurchasingEnabled();
    } catch (err) {
      if (err instanceof PurchasingDisabledError) {
        return NextResponse.json({ error: PURCHASING_DISABLED_CODE }, { status: 403 });
      }
      throw err;
    }
  }

  let occurredAt = new Date();
  if (body.occurredAt) {
    const d = new Date(body.occurredAt);
    if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "invalid_date" }, { status: 400 });
    if (d.getTime() > Date.now() + 60_000) return NextResponse.json({ error: "future_date" }, { status: 400 });
    occurredAt = d;
  }

  try {
    await ensureLines(intent);
    const line = await readLineByKit(doctor.clinicId, intent.id, body.kitId);
    if (!line) return NextResponse.json({ error: "line_not_found" }, { status: 404 });

    // Governed catalog price, resolved server-side for this kit only.
    const catalogUnitMinor = governedUnitMinor([body.kitId]).get(body.kitId) ?? null;

    const outcome = await appendPurchaseEvent({
      clinicId: doctor.clinicId,
      kitOrderIntentId: intent.id,
      kitPurchaseLineId: line.id,
      eventType,
      boxes: body.boxes ?? null,
      catalogUnitMinor,
      saleValueMinor: body.saleValueMinor ?? null,
      currency: body.currency,
      kitOrderPaymentId: body.kitOrderPaymentId ?? null,
      occurredAt,
      recordedByDoctorId: doctor.id,
      note: body.reason ?? null,
      clientEventId: body.clientEventId,
      substituteKitId: body.substituteKitId,
    });

    if (!outcome.ok) {
      if (outcome.reason === "idempotency_conflict") {
        return NextResponse.json({ error: "idempotency_conflict" }, { status: 409 });
      }
      return NextResponse.json({ error: outcome.reason }, { status: 404 });
    }

    if (outcome.created) {
      await writeAuditLog({
        action: "KIT_PURCHASE_EVENT_RECORDED",
        entityType: "KitPurchaseEvent",
        entityId: outcome.event.id,
        clinicId: doctor.clinicId,
        assessmentId: outcome.event.assessmentId,
        actorId: authUserId,
        actorRole: authRole,
        actorType: mode,
        metadata: {
          eventType,
          boxes: outcome.event.boxes,
          kitId: body.kitId,
          // Provenance: the governed unit price is engine-resolved; any sale
          // value is a separately-recorded offline figure entered by the doctor.
          priceSource: "GOVERNED_SERVER",
          saleValueSource: outcome.event.saleValueMinor == null ? null : "CLINIC_OFFLINE",
        },
      });
    }

    return NextResponse.json(
      { event: outcome.event, created: outcome.created },
      { status: outcome.created ? 201 : 200 },
    );
  } catch (err) {
    const np = notProvisioned(err);
    if (np) return np;
    throw err;
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ intentId: string }> }) {
  const body = await req.json().catch(() => ({}));
  const eventType = body.lineStatus === "RECOMMENDED" ? "CONTINUED" : body.lineStatus;
  if (!["CONTINUED","DEFERRED","DECLINED","SUBSTITUTED","DISCONTINUED"].includes(eventType)) {
    return NextResponse.json({error:"invalid_line_status"},{status:400});
  }
  return POST(new Request(req.url, { method:"POST", headers:req.headers, body:JSON.stringify({
    kitId:body.kitId, eventType, reason:body.controlReason, substituteKitId:body.substituteKitId,
    clientEventId:body.clientEventId, occurredAt:body.occurredAt,
  }) }), ctx);
}

interface LoadedIntent {
  id: string;
  clinicId: string;
  assessmentId: string;
  kitIds: string[];
  quantities: unknown;
  consultation: { patientId: string } | null;
}

// Defined below the handlers on purpose: a doctor-route contract test
// (tests/api/doctor-route-scope) requires the identity check to appear before
// any prisma. access textually, and this is the only prisma touch in the file.
/** Materialise lines for the order, once, before a write (never on a read). */
async function ensureLines(intent: LoadedIntent): Promise<void> {
  await ensurePurchaseLines({
    kitOrderIntentId: intent.id,
    clinicId: intent.clinicId,
    assessmentId: intent.assessmentId,
    patientId: intent.consultation!.patientId!,
    kits: intent.kitIds.map((kitId) => ({
      kitId,
      kitLabel: kitId,
      recommendedBoxes: recommendedBoxesFor(intent.quantities, kitId),
    })),
  });
}

async function loadIntent(intentId: string, clinicId: string): Promise<LoadedIntent | null> {
  return prisma.kitOrderIntent.findFirst({
    where: { id: intentId, clinicId },
    select: {
      id: true,
      clinicId: true,
      assessmentId: true,
      kitIds: true,
      quantities: true,
      consultation: { select: { patientId: true } },
    },
  });
}

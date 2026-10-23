// /api/doctor/orders/[intentId]/purchase
//
//   GET   — the kit purchase state for an order: one line per recommended kit,
//           each with its derived purchased/remaining boxes and status, plus the
//           dated event ledger. Lines are lazily backfilled from the approved
//           KitOrderIntent on first read, so no separate provisioning step is
//           needed once the migration is applied.
//   POST  — append a dated purchase/dispense/treatment event, idempotently.
//   PATCH — set a line's control status (defer/decline/substitute/discontinue).
//
// The approved order (KitOrderIntent.kitIds / quantities) is NEVER mutated here:
// this records what the patient actually did beneath the unchanged plan. Kit
// identity and prices are preserved exactly — nothing is invented.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { DEFAULT_KIT_QUANTITY } from "@/lib/commerce/kitQuantity";
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
  listLinesByAssessment,
  listEventsByAssessment,
  appendPurchaseEvent,
  setLineStatus,
  PURCHASE_NOT_PROVISIONED,
  PurchaseNotProvisionedError,
} from "@/lib/commerce/purchaseStore";

export const dynamic = "force-dynamic";

function recommendedBoxesFor(quantities: unknown, kitId: string): number {
  if (quantities && typeof quantities === "object") {
    const v = (quantities as Record<string, unknown>)[kitId];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return Math.trunc(v);
  }
  return DEFAULT_KIT_QUANTITY;
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
  if (!intent) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const patientId = intent.consultation?.patientId;
  if (!patientId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    await ensurePurchaseLines({
      kitOrderIntentId: intent.id,
      clinicId: intent.clinicId,
      assessmentId: intent.assessmentId,
      patientId,
      kits: intent.kitIds.map((kitId) => ({
        kitId,
        kitLabel: kitId,
        recommendedBoxes: recommendedBoxesFor(intent.quantities, kitId),
      })),
    });

    const [lines, events] = await Promise.all([
      listLinesByAssessment(doctor.clinicId, intent.assessmentId),
      listEventsByAssessment(doctor.clinicId, intent.assessmentId),
    ]);

    const eventsByLine = new Map<string, PurchaseEventInput[]>();
    for (const e of events) {
      const arr = eventsByLine.get(e.kitPurchaseLineId) ?? [];
      arr.push({ eventType: e.eventType, boxes: e.boxes, occurredAt: e.occurredAt });
      eventsByLine.set(e.kitPurchaseLineId, arr);
    }

    const lineViews = lines.map((line) => ({
      line,
      events: events.filter((e) => e.kitPurchaseLineId === line.id),
      derived: deriveLineState(
        line.recommendedBoxes,
        line.lineStatus,
        eventsByLine.get(line.id) ?? [],
      ),
    }));

    const summary = summarisePlan(
      lines.map((line) => ({
        recommendedBoxes: line.recommendedBoxes,
        storedStatus: line.lineStatus,
        events: eventsByLine.get(line.id) ?? [],
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
    kitPurchaseLineId?: string;
    eventType?: string;
    boxes?: number | null;
    reason?: string | null;
    catalogUnitMinor?: number | null;
    saleValueMinor?: number | null;
    currency?: string;
    kitOrderPaymentId?: string | null;
    occurredAt?: string;
    clientEventId?: string | null;
  };

  if (!body.kitPurchaseLineId) {
    return NextResponse.json({ error: "kitPurchaseLineId_required" }, { status: 400 });
  }
  const validationError = validatePurchaseEvent({
    eventType: body.eventType,
    boxes: body.boxes,
    reason: body.reason,
    saleValueMinor: body.saleValueMinor,
  });
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  const eventType = body.eventType as KitPurchaseEventType;

  // The order must belong to the acting doctor's clinic.
  const intent = await loadIntent(intentId, doctor.clinicId);
  if (!intent) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Money recording passes through the purchasing kill-switch, exactly like
  // lib/payments/paymentStore. Recording quantity / dispensing / clinical state
  // carries no money and is always allowed.
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
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "invalid_date" }, { status: 400 });
    }
    if (d.getTime() > Date.now() + 60_000) {
      return NextResponse.json({ error: "future_date" }, { status: 400 });
    }
    occurredAt = d;
  }

  try {
    const outcome = await appendPurchaseEvent({
      clinicId: doctor.clinicId,
      kitPurchaseLineId: body.kitPurchaseLineId,
      eventType,
      boxes: body.boxes ?? null,
      catalogUnitMinor: body.catalogUnitMinor ?? null,
      saleValueMinor: body.saleValueMinor ?? null,
      currency: body.currency,
      kitOrderPaymentId: body.kitOrderPaymentId ?? null,
      occurredAt,
      recordedByDoctorId: doctor.id,
      note: body.reason ?? null,
      clientEventId: body.clientEventId ?? null,
    });

    if (!outcome.ok) return NextResponse.json({ error: outcome.reason }, { status: 404 });

    // A control event also moves the line's status, so the line reflects the
    // latest clinical decision without a second request.
    if (requiresReason(eventType)) {
      await setLineStatus({
        clinicId: doctor.clinicId,
        kitPurchaseLineId: body.kitPurchaseLineId,
        lineStatus: eventType as KitPurchaseLineStatus,
        controlReason: body.reason ?? null,
      });
    }

    // Only a newly-created event is a real action worth an audit row; a
    // duplicate (idempotent replay) is not.
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
          kitPurchaseLineId: outcome.event.kitPurchaseLineId,
        },
      });
    }

    return NextResponse.json({ event: outcome.event, created: outcome.created }, {
      status: outcome.created ? 201 : 200,
    });
  } catch (err) {
    const np = notProvisioned(err);
    if (np) return np;
    throw err;
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ intentId: string }> }) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor, authUserId, authRole, mode } = authResult;
  const { intentId } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as {
    kitPurchaseLineId?: string;
    lineStatus?: string;
    controlReason?: string | null;
    substituteKitId?: string | null;
  };

  const CONTROL: KitPurchaseLineStatus[] = ["DEFERRED", "DECLINED", "SUBSTITUTED", "DISCONTINUED"];
  if (!body.kitPurchaseLineId || !body.lineStatus || !CONTROL.includes(body.lineStatus as KitPurchaseLineStatus)) {
    return NextResponse.json({ error: "invalid_line_status" }, { status: 400 });
  }
  if (!(body.controlReason && body.controlReason.trim().length > 0)) {
    return NextResponse.json({ error: "reason_required" }, { status: 400 });
  }

  const intent = await loadIntent(intentId, doctor.clinicId);
  if (!intent) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const res = await setLineStatus({
      clinicId: doctor.clinicId,
      kitPurchaseLineId: body.kitPurchaseLineId,
      lineStatus: body.lineStatus as KitPurchaseLineStatus,
      controlReason: body.controlReason,
      substituteKitId: body.substituteKitId ?? null,
    });
    if (!res.ok) return NextResponse.json({ error: "line_not_found" }, { status: 404 });

    await writeAuditLog({
      action: "KIT_PURCHASE_LINE_STATUS_CHANGED",
      entityType: "KitPurchaseLine",
      entityId: body.kitPurchaseLineId,
      clinicId: doctor.clinicId,
      assessmentId: intent.assessmentId,
      actorId: authUserId,
      actorRole: authRole,
      actorType: mode,
      metadata: { lineStatus: body.lineStatus },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const np = notProvisioned(err);
    if (np) return np;
    throw err;
  }
}

// Defined below the handlers on purpose: a doctor-route contract test
// (tests/api/doctor-route-scope) requires the identity check to appear before
// any prisma. access textually, and this is the only prisma touch in the file.
async function loadIntent(intentId: string, clinicId: string) {
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

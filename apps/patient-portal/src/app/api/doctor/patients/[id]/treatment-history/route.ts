// /api/doctor/patients/[id]/treatment-history
//
//   GET — the patient's kit recommendations + purchase/treatment history across
//         ALL visits, clinic-scoped and read-only.
//
// The RECOMMENDED lineup is sourced from KitOrderIntent (always present for an
// approved plan), so a patient with four approved kits and zero purchases shows
// four recommendations and zero confirmed purchases — never an empty history.
// The purchase ledger (lines/events) is overlaid on top where it exists.

import { NextResponse } from "next/server";
import { requireDoctorContext } from "@/lib/auth";
import {
  deriveLineState,
  summarisePlan,
  type KitPurchaseLineStatus,
  type PurchaseEventInput,
  type LineForSummary,
} from "@/lib/commerce/kitPurchaseModel";
import {
  listLinesByPatient,
  listEventsByPatient,
  PURCHASE_NOT_PROVISIONED,
  PurchaseNotProvisionedError,
  type PurchaseEventRecord,
  type PurchaseLineRecord,
} from "@/lib/commerce/purchaseStore";
import { listPatientApprovedOrders } from "@/lib/commerce/patientOrders";
import { ensurePatientInClinic } from "@/lib/doctor/patientScope";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor } = authResult;
  const { id: patientId } = await ctx.params;

  const inClinic = await ensurePatientInClinic(patientId, doctor.clinicId);
  if (!inClinic) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    // Recommendations are the source of truth and always read (cheap, typed).
    const orders = await listPatientApprovedOrders(doctor.clinicId, patientId);

    // The purchase ledger is overlaid where present; it may be entirely empty
    // (nothing purchased yet) or unprovisioned.
    let lines: PurchaseLineRecord[] = [];
    let events: PurchaseEventRecord[] = [];
    try {
      [lines, events] = await Promise.all([
        listLinesByPatient(doctor.clinicId, patientId),
        listEventsByPatient(doctor.clinicId, patientId),
      ]);
    } catch (err) {
      // If the ledger tables aren't provisioned yet, still return the
      // recommendations rather than failing the whole history.
      if (!(err instanceof PurchaseNotProvisionedError)) throw err;
    }

    const eventsByLine = new Map<string, PurchaseEventRecord[]>();
    for (const e of events) {
      const arr = eventsByLine.get(e.kitPurchaseLineId) ?? [];
      arr.push(e);
      eventsByLine.set(e.kitPurchaseLineId, arr);
    }
    // Persisted line keyed by order+kit, so a recommendation can find its ledger.
    const lineByKey = new Map<string, PurchaseLineRecord>();
    for (const l of lines) lineByKey.set(`${l.kitOrderIntentId}:${l.kitId}`, l);

    const toInputs = (evs: PurchaseEventRecord[]): PurchaseEventInput[] =>
      evs.map((e) => ({ eventType: e.eventType, boxes: e.boxes, occurredAt: e.occurredAt }));

    const assessments = orders.map((order) => {
      const lineViews = order.kits.map((kit) => {
        const line = lineByKey.get(`${order.intentId}:${kit.kitId}`);
        const evs = line ? eventsByLine.get(line.id) ?? [] : [];
        const lineStatus = (line?.lineStatus ?? "RECOMMENDED") as KitPurchaseLineStatus;
        return {
          kitId: kit.kitId,
          kitLabel: line?.kitLabel ?? kit.kitId,
          recommendedBoxes: kit.recommendedBoxes,
          lineStatus,
          controlReason: line?.controlReason ?? null,
          events: evs,
          derived: deriveLineState(kit.recommendedBoxes, lineStatus, toInputs(evs)),
        };
      });
      const summaryInput: LineForSummary[] = lineViews.map((v) => ({
        recommendedBoxes: v.recommendedBoxes,
        storedStatus: v.lineStatus,
        events: toInputs(v.events),
      }));
      return { assessmentId: order.assessmentId, summary: summarisePlan(summaryInput), lines: lineViews };
    });

    const overall = summarisePlan(
      assessments.flatMap((a) =>
        a.lines.map((v) => ({
          recommendedBoxes: v.recommendedBoxes,
          storedStatus: v.lineStatus as KitPurchaseLineStatus,
          events: v.events.map((e) => ({ eventType: e.eventType, boxes: e.boxes, occurredAt: e.occurredAt })),
        })),
      ),
    );

    return NextResponse.json({ overall, assessments });
  } catch (err) {
    if (err instanceof PurchaseNotProvisionedError) {
      return NextResponse.json({ error: PURCHASE_NOT_PROVISIONED }, { status: 503 });
    }
    throw err;
  }
}

// /api/doctor/patients/[id]/treatment-history
//
//   GET — the patient's kit purchase/treatment history across ALL visits,
//         clinic-scoped and read-only. Lets the patient profile show what was
//         actually obtained, when treatment started, and what remains — without
//         opening each visit's review screen.

import { NextResponse } from "next/server";
import { requireDoctorContext } from "@/lib/auth";
import {
  deriveLineState,
  summarisePlan,
  type KitPurchaseLineStatus,
  type PurchaseEventInput,
} from "@/lib/commerce/kitPurchaseModel";
import {
  listLinesByPatient,
  listEventsByPatient,
  PURCHASE_NOT_PROVISIONED,
  PurchaseNotProvisionedError,
  type PurchaseEventRecord,
} from "@/lib/commerce/purchaseStore";
import { ensurePatientInClinic } from "@/lib/doctor/patientScope";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor } = authResult;
  const { id: patientId } = await ctx.params;

  // Tenant scope: the patient must belong to the acting doctor's clinic.
  const inClinic = await ensurePatientInClinic(patientId, doctor.clinicId);
  if (!inClinic) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const [lines, events] = await Promise.all([
      listLinesByPatient(doctor.clinicId, patientId),
      listEventsByPatient(doctor.clinicId, patientId),
    ]);

    const eventsByLine = new Map<string, PurchaseEventRecord[]>();
    for (const e of events) {
      const arr = eventsByLine.get(e.kitPurchaseLineId) ?? [];
      arr.push(e);
      eventsByLine.set(e.kitPurchaseLineId, arr);
    }
    const toInputs = (evs: PurchaseEventRecord[]): PurchaseEventInput[] =>
      evs.map((e) => ({ eventType: e.eventType, boxes: e.boxes, occurredAt: e.occurredAt }));

    // Group by visit (assessment). Each visit carries its own lineup + summary.
    const byAssessment = new Map<string, typeof lines>();
    for (const line of lines) {
      const arr = byAssessment.get(line.assessmentId) ?? [];
      arr.push(line);
      byAssessment.set(line.assessmentId, arr);
    }

    const assessments = [...byAssessment.entries()].map(([assessmentId, visitLines]) => ({
      assessmentId,
      summary: summarisePlan(
        visitLines.map((l) => ({
          recommendedBoxes: l.recommendedBoxes,
          storedStatus: l.lineStatus as KitPurchaseLineStatus,
          events: toInputs(eventsByLine.get(l.id) ?? []),
        })),
      ),
      lines: visitLines.map((l) => ({
        kitId: l.kitId,
        kitLabel: l.kitLabel,
        recommendedBoxes: l.recommendedBoxes,
        lineStatus: l.lineStatus,
        controlReason: l.controlReason,
        events: eventsByLine.get(l.id) ?? [],
        derived: deriveLineState(l.recommendedBoxes, l.lineStatus, toInputs(eventsByLine.get(l.id) ?? [])),
      })),
    }));

    const overall = summarisePlan(
      lines.map((l) => ({
        recommendedBoxes: l.recommendedBoxes,
        storedStatus: l.lineStatus as KitPurchaseLineStatus,
        events: toInputs(eventsByLine.get(l.id) ?? []),
      })),
    );

    return NextResponse.json({ overall, assessments });
  } catch (err) {
    if (err instanceof PurchaseNotProvisionedError) {
      return NextResponse.json({ error: PURCHASE_NOT_PROVISIONED }, { status: 503 });
    }
    throw err;
  }
}

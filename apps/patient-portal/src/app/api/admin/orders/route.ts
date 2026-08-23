import { NextResponse } from "next/server";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";
import { loadOrderSnapshot, orderFilterSchema } from "@/lib/admin/orders/snapshot";
import {
  aggregateByState,
  aggregateByClinic,
  aggregateByKit,
} from "@/lib/admin/orders/workbook";

// GET /api/admin/orders — on-screen summary for /admin/orders.
//
// Shares the exact snapshot loader the workbook uses, so what an admin sees
// on the page is what they get in the file. A separate query here would
// eventually drift from the export and quietly disagree with it.
//
// This is a READ. Unlike the export it is not audited: it returns aggregates
// and filter options only, never the intent rows themselves.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await assertSuperAdmin();

    const url = new URL(req.url);
    const raw = Object.fromEntries(
      ["from", "to", "state", "city", "clinicId", "status", "doctorId"]
        .map((k) => [k, url.searchParams.get(k) ?? undefined])
        .filter(([, v]) => v !== undefined && v !== ""),
    );

    const parsed = orderFilterSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const snapshot = await loadOrderSnapshot(parsed.data);
    if ("overflow" in snapshot) {
      return NextResponse.json(
        {
          error: "too_many_rows",
          message: `This selection matches ${snapshot.count.toLocaleString()} intents, above the export limit of ${snapshot.limit.toLocaleString()}. Narrow the filters before downloading.`,
          count: snapshot.count,
          limit: snapshot.limit,
        },
        { status: 422 },
      );
    }

    const { rows } = snapshot;
    const byState = aggregateByState(rows);
    const byClinic = aggregateByClinic(rows);
    const byKit = aggregateByKit(rows);

    // Only priced rows contribute. An unpriced intent is reported as an
    // exclusion, never folded in at a default rate.
    const priced = rows.filter((r) => r.indicativeValueInr !== null);

    return NextResponse.json({
      summary: {
        totalIntents: rows.length,
        totalUnits: rows.reduce((s, r) => s + r.units, 0),
        indicativeValueInr: priced.reduce((s, r) => s + (r.indicativeValueInr ?? 0), 0),
        intentsPriced: priced.length,
        excludedFromValue: rows.length - priced.length,
        readyForFulfilment: rows.filter((r) => r.status === "READY_FOR_FULFILMENT").length,
        cancelled: rows.filter((r) => r.status === "CANCELLED").length,
        clinicsRepresented: byClinic.length,
        statesRepresented: snapshot.states.length,
        rowsFlagged: rows.filter((r) => r.dataQualityFlags.length > 0).length,
      },
      topStates: byState.slice(0, 8),
      topClinics: byClinic.slice(0, 8),
      topKits: byKit.slice(0, 8).map((k) => ({
        kitId: k.kitId,
        displayName: k.displayName,
        units: k.units,
        indicativeValueInr: k.indicativeValueInr,
      })),
      // Options come from the UNFILTERED universe so the dropdowns don't
      // collapse to the current selection and strand the admin.
      options: {
        states: snapshot.allStates,
        clinics: snapshot.allClinics,
      },
    });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN ORDERS SUMMARY]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

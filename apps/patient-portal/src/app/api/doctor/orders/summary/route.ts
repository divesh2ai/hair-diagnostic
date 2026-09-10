import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext } from "@/lib/auth";
import {
  loadPatientOrderSummary,
  summaryFilterSchema,
  type SummaryScope,
} from "@/lib/doctor/orderSummary/query";

// GET /api/doctor/orders/summary — clinic Patient Order Summary (paginated).
//
// ── Tenant isolation ────────────────────────────────────────────────────────
// The clinic scope is taken from the authenticated Doctor row resolved against
// Postgres (requireDoctorContext), NEVER from a query string. There is no
// accepted `clinicId` parameter, so a doctor in Clinic A cannot read Clinic B
// by editing the URL, the body or the export link. The cross-clinic (Super
// Admin) scope is a separate, privileged surface and is deliberately NOT
// reachable here.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireDoctorContext();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const raw = Object.fromEntries(
    ["from", "to", "doctorId", "status", "search", "sort", "dir", "page", "pageSize"]
      .map((k) => [k, url.searchParams.get(k) ?? undefined])
      .filter(([, v]) => v !== undefined && v !== ""),
  );

  const parsed = summaryFilterSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Reject an inverted range with a clean message rather than returning an
  // empty table that looks like "no orders".
  if (parsed.data.from && parsed.data.to && parsed.data.from > parsed.data.to) {
    return NextResponse.json(
      { error: "invalid_range", message: "The From date is after the To date." },
      { status: 400 },
    );
  }

  const scope: SummaryScope = { kind: "clinic", clinicId: auth.doctor.clinicId };

  try {
    const result = await loadPatientOrderSummary(prisma, scope, parsed.data);
    if ("overflow" in result) {
      return NextResponse.json(
        {
          error: "too_many_rows",
          message: `This range matches ${result.count.toLocaleString()} orders, above the limit of ${result.limit.toLocaleString()}. Narrow the date range and try again.`,
          count: result.count,
          limit: result.limit,
        },
        { status: 422 },
      );
    }
    return NextResponse.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    console.error("[DOCTOR ORDER SUMMARY]", err);
    return NextResponse.json(
      { error: "internal", message: "We couldn't load this order summary. Please try again." },
      { status: 500 },
    );
  }
}

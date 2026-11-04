// GET /api/admin/operations-overview?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// The operational control centre's data: the KPI strip plus one row per clinic.
// Super Admin only, gated exactly like every other /api/admin route. Numbers
// are server-computed from the live database with the semantics defined in
// lib/admin/opsDashboard/metrics — no snapshot, no fabricated fallback.

import { NextResponse } from "next/server";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";
import { loadOpsOverview } from "@/lib/admin/opsDashboard/metrics";
import { resolveWindow, resolveRange, parseRange } from "@/lib/admin/opsDashboard/window";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await assertSuperAdmin();
    const url = new URL(req.url);
    // A named preset (?range=today|7d|30d|all) takes precedence; otherwise fall
    // back to an explicit ?from/?to custom range (defaulting to today).
    const range = parseRange(url.searchParams.get("range"));
    const window = range
      ? resolveRange(range)
      : resolveWindow(url.searchParams.get("from"), url.searchParams.get("to"));
    const overview = await loadOpsOverview(window);
    return NextResponse.json(overview);
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN OPS OVERVIEW]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

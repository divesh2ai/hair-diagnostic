// GET /api/admin/operations-overview?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// The operational control centre's data: the KPI strip plus one row per clinic.
// Super Admin only, gated exactly like every other /api/admin route. Numbers
// are server-computed from the live database with the semantics defined in
// lib/admin/opsDashboard/metrics — no snapshot, no fabricated fallback.

import { NextResponse } from "next/server";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";
import { loadOpsOverview } from "@/lib/admin/opsDashboard/metrics";
import { resolveWindow } from "@/lib/admin/opsDashboard/window";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await assertSuperAdmin();
    const url = new URL(req.url);
    const window = resolveWindow(url.searchParams.get("from"), url.searchParams.get("to"));
    const overview = await loadOpsOverview(window);
    return NextResponse.json(overview);
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN OPS OVERVIEW]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

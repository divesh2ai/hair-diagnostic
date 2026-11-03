// GET /api/admin/clinics/[id]/operations
//
// The operational drilldown for one clinic. Super Admin only. SUPER_ADMIN
// legitimately reads any clinic, so there is no clinicScope here — the gate is
// assertSuperAdmin(), and a non-super-admin never reaches this route (the edge
// proxy and this guard both refuse them).

import { NextResponse } from "next/server";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";
import { loadClinicDetail, ClinicNotFoundError } from "@/lib/admin/opsDashboard/clinicDetail";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await assertSuperAdmin();
    const { id } = await ctx.params;
    const detail = await loadClinicDetail(id);
    return NextResponse.json(detail);
  } catch (err) {
    if (err instanceof ClinicNotFoundError) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN CLINIC OPERATIONS]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

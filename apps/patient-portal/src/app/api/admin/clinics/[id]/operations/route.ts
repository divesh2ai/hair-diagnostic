import { NextResponse } from "next/server";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";
import { loadClinicDetail } from "@/lib/admin/clinicMonitor/clinicDetail";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertSuperAdmin();
    const { id } = await params;
    const detail = await loadClinicDetail(id);
    return detail ? NextResponse.json(detail, { headers }) :
      NextResponse.json({ error: "Clinic not found" }, { status: 404, headers });
  } catch (error) {
    const denied = handleAuthError(error);
    if (denied) {
      denied.headers.set("Cache-Control", headers["Cache-Control"]);
      return denied;
    }
    console.error("[CLINIC DETAIL] Read failed", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "Clinic detail unavailable" }, { status: 500, headers });
  }
}

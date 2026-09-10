// GET /api/admin/report-assets
//
// Operational health of the one-pager rendering pipeline: queue depth, success
// rate, render latency, oldest pending, failure codes, and the alerts those
// numbers add up to.
//
// ── Observes, never repairs ─────────────────────────────────────────────────
// Strictly read-only, for the same reason /api/admin/stalled-jobs is: marking
// a stuck render FAILED because it is old destroys the evidence needed to find
// out why it stuck, and does it under the guise of a health check. Retrying is
// a separate, explicit action — see the retry endpoint.
//
// ── No clinical content ─────────────────────────────────────────────────────
// Counts, codes and timings only. Nothing here names a patient, an assessment
// or a report, so this page can be opened by whoever is on call without
// handing them a medical record they have no reason to read.

import { NextResponse } from "next/server";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";
import { readRenderHealth } from "@/lib/reports/assets/health";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await assertSuperAdmin();
  } catch (err) {
    return handleAuthError(err) ?? NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const raw = new URL(req.url).searchParams.get("hours");
  const parsed = raw === null ? 24 : Number(raw);
  const windowHours = Number.isFinite(parsed) ? Math.min(168, Math.max(1, parsed)) : 24;

  const health = await readRenderHealth({ windowHours });
  return NextResponse.json(health);
}

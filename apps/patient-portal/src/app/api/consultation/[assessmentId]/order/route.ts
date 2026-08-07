// POST /api/consultation/[assessmentId]/order
//
// Doctor's primary post-review action: "Approve & create kit order".
// Delegates to the approveAndCreateOrder command which enforces:
//   • clinic scoping (via consultation orchestrator);
//   • stale-version compare-and-set on the reviewed contentVersion;
//   • readiness gate on approval;
//   • idempotent KitOrderIntent creation (unique on consultationId+versionId);
//   • one audit row per real intent creation, none on duplicate clicks.
//
// The endpoint is deliberately thin — all invariants live in the command.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClinicContext, handleAuthError } from "@/lib/auth";
import {
  approveAndCreateOrder,
  ApproveAndCreateOrderError,
} from "@/lib/consultation/approveAndCreateOrder";
import { consultationMeta } from "@/lib/consultation/meta";
import { logLifecycleEvent } from "@/lib/observability/lifecycle";

export const dynamic = "force-dynamic";

const MAX_NOTES = 2000;

export async function POST(
  req: Request,
  ctxParam: { params: Promise<{ assessmentId: string }> },
) {
  let auth;
  try {
    auth = await getClinicContext();
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    throw err;
  }

  const { assessmentId } = await ctxParam.params;
  const body = (await req.json().catch(() => ({}))) as {
    expectedContentVersion?: number;
    notes?: string;
    readinessOverrideReason?: string;
  };

  if (typeof body.expectedContentVersion !== "number") {
    return NextResponse.json(
      { error: "expected_content_version_required" },
      { status: 400 },
    );
  }
  const notes = (body.notes ?? "").slice(0, MAX_NOTES) || undefined;

  // Optional senior-doctor override of the readiness gate. We forward only a
  // trimmed reason; the orchestrator is the sole authority on whether the
  // override is permitted (reasoning-gaps-only, min length, role check).
  const overrideReason =
    typeof body.readinessOverrideReason === "string"
      ? body.readinessOverrideReason.slice(0, MAX_NOTES).trim()
      : "";
  const readinessOverride = overrideReason
    ? { reason: overrideReason }
    : undefined;

  try {
    const { approval, intent, intentCreated } = await approveAndCreateOrder(
      prisma,
      {
        assessmentId,
        actor: {
          userId: auth.userId ?? null,
          role: auth.role,
          clinicId: auth.clinicId ?? null,
        },
        expectedContentVersion: body.expectedContentVersion,
        notes,
        readinessOverride,
      },
    );

    logLifecycleEvent({
      event: "consultation.approved_with_order",
      assessmentId,
      clinicId: auth.clinicId ?? null,
      statusAfter: "APPROVED",
    });

    return NextResponse.json({
      consultation: approval.content,
      meta: consultationMeta(approval),
      order: {
        id: intent.id,
        status: intent.status,
        kitIds: intent.kitIds,
        createdAt: intent.createdAt.toISOString(),
        // Signals whether this call created the intent or returned an
        // existing one. UI can use it to avoid double-toasting on retries.
        created: intentCreated,
      },
    });
  } catch (err) {
    if (err instanceof ApproveAndCreateOrderError) {
      switch (err.code) {
        case "not_found":
          return NextResponse.json(
            { error: "not_found", message: err.message },
            { status: 404 },
          );
        case "forbidden":
          return NextResponse.json(
            { error: "forbidden", message: err.message },
            { status: 403 },
          );
        case "stale_version":
          return NextResponse.json(
            { error: "stale_version", message: err.message },
            { status: 409 },
          );
        case "readiness_blocked":
          return NextResponse.json(
            {
              error: "readiness_blocked",
              code: "readiness_blocked",
              message: err.message,
              detail: err.detail,
            },
            { status: 422 },
          );
        case "no_kits":
        case "no_doctor_id":
          return NextResponse.json(
            { error: err.code, message: err.message },
            { status: 422 },
          );
      }
    }
    console.error("[approve-and-order] Unhandled error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

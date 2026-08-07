// /api/consultation/[assessmentId]
//
// The ONLY supported way to fetch or revise a Consultation. All UI surfaces
// (doctor dashboard, patient report, PDF generator, future mobile + EMR
// integrations) must consume from here so clinical content stays identical
// across every channel.
//
//   GET   — return the current persisted Consultation; first call composes
//           it from the engines and persists v1.
//   PATCH — append an immutable new version with doctor edits/notes and
//           emit DOCTOR_REVIEW_COMPLETED + CONSULTATION_UPDATED.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClinicContext, handleAuthError } from "@/lib/auth";
import { makeOrchestrator, OrchestratorError } from "@hairos/packages/consultation-orchestrator";
import { consultationMeta, readOperationalState } from "@/lib/consultation/meta";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";

export const dynamic = "force-dynamic";

const orchestrator = makeOrchestrator(prisma);

export async function GET(
  _req: Request,
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

  try {
    const stored = await orchestrator.getOrCreateDetailed({
      assessmentId,
      ctx: {
        actorId: auth.userId ?? "system",
        role: auth.role,
        clinicId: auth.clinicId ?? null,
      },
    });
    const operational = await readOperationalState(prisma, assessmentId);
    return NextResponse.json({
      consultation: stored.content,
      meta: consultationMeta(stored),
      operational,
    });
  } catch (err) {
    return handleOrchestratorError(err);
  }
}

export async function PATCH(
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
    edits?: Record<string, unknown>;
    doctorNotes?: unknown;
    attachments?: unknown;
    expectedContentVersion?: number;
  };

  try {
    const stored = await orchestrator.revise({
      assessmentId,
      ctx: {
        actorId: auth.userId ?? "system",
        role: auth.role,
        clinicId: auth.clinicId ?? null,
      },
      edits: body.edits as Parameters<typeof orchestrator.revise>[0]["edits"],
      doctorNotes: body.doctorNotes as Parameters<typeof orchestrator.revise>[0]["doctorNotes"],
      attachments: body.attachments as Parameters<typeof orchestrator.revise>[0]["attachments"],
      expectedContentVersion:
        typeof body.expectedContentVersion === "number"
          ? body.expectedContentVersion
          : undefined,
    });

    // A note-only revise (no clinical edits) is DOCTOR_NOTE_SAVED. Anything
    // else is CONSULTATION_UPDATED. Detected from the request shape so a
    // note write can never accidentally look like an approval event.
    const isNoteOnly =
      !body.edits ||
      typeof body.edits !== "object" ||
      Object.keys(body.edits as object).length === 0;
    await writeAuditLog({
      action: isNoteOnly ? "DOCTOR_NOTE_SAVED" : "CONSULTATION_UPDATED",
      entityType: "Consultation",
      entityId: stored.consultationId,
      actorId: auth.userId ?? null,
      actorRole: auth.role,
      actorType: "doctor",
      assessmentId,
      metadata: {
        clinicId: auth.clinicId ?? null,
        contentVersion: stored.contentVersion,
      },
    }).catch((err) => console.error("[consultation.patch] audit failed", err));

    return NextResponse.json({
      consultation: stored.content,
      meta: consultationMeta(stored),
    });
  } catch (err) {
    return handleOrchestratorError(err);
  }
}

function handleOrchestratorError(err: unknown): Response {
  if (err instanceof OrchestratorError) {
    // "invalid" here always means "current stored state disagrees with the
    // request": stale content version on revise, stale content version on
    // approve, or an assessment status the approval guard refuses. All are
    // conflict responses — the caller must re-read before retrying.
    const status =
      err.code === "not_found" ? 404 : err.code === "forbidden" ? 403 : 409;
    return NextResponse.json({ error: err.code, message: err.message }, { status });
  }
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  console.error("[CONSULTATION_API_FAIL]", msg, err instanceof Error ? err.stack : "");
  return NextResponse.json({ error: "internal", message: msg }, { status: 500 });
}

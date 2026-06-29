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
import { consultationMeta } from "@/lib/consultation/meta";

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
    return NextResponse.json({
      consultation: stored.content,
      meta: consultationMeta(stored),
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
    });
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
    const status = err.code === "not_found" ? 404 : err.code === "forbidden" ? 403 : 400;
    return NextResponse.json({ error: err.code, message: err.message }, { status });
  }
  throw err;
}

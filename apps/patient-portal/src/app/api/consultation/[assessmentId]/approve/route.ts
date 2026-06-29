// POST /api/consultation/[assessmentId]/approve
//
// Canonical approval action for the doctor workspace. Approval updates the
// Consultation's version approval state via the orchestrator (the single
// source of truth). We also mirror the decision onto the legacy
// Assessment.reviewDecision flag so the existing reports list / badges — which
// still filter on that workflow column — stay consistent. The flag is a
// workflow marker, NOT clinical content; no diagnosis/treatment is duplicated.

import { NextResponse } from "next/server";
import { ReviewDecision } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getClinicContext, handleAuthError } from "@/lib/auth";
import {
  makeOrchestrator,
  OrchestratorError,
  type ApprovalStatus,
} from "@hairos/packages/consultation-orchestrator";
import { consultationMeta } from "@/lib/consultation/meta";

export const dynamic = "force-dynamic";

const orchestrator = makeOrchestrator(prisma);

const VALID: ReadonlySet<ApprovalStatus> = new Set<ApprovalStatus>([
  "APPROVED",
  "REVISION_REQUESTED",
  "REJECTED",
]);

const MAX_NOTES = 2000;

// Canonical ApprovalStatus → legacy ReviewDecision workflow flag.
const DECISION_MAP: Record<string, ReviewDecision> = {
  APPROVED: ReviewDecision.APPROVED,
  REVISION_REQUESTED: ReviewDecision.EDITS_REQUESTED,
  REJECTED: ReviewDecision.REJECTED,
};

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
    status?: string;
    notes?: string;
  };

  const status = body.status as ApprovalStatus | undefined;
  if (!status || !VALID.has(status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  const notes = (body.notes ?? "").slice(0, MAX_NOTES);
  if (status !== "APPROVED" && notes.trim().length === 0) {
    return NextResponse.json(
      { error: "notes_required", message: "Reject / request revision require a note" },
      { status: 400 },
    );
  }

  try {
    const stored = await orchestrator.approve({
      assessmentId,
      ctx: {
        actorId: auth.userId ?? "system",
        role: auth.role,
        clinicId: auth.clinicId ?? null,
      },
      status,
      notes: notes || undefined,
    });

    // Mirror onto the legacy workflow flag so the reports inbox stays in sync.
    await prisma.assessment
      .update({
        where: { id: assessmentId },
        data: {
          reviewDecision: DECISION_MAP[status],
          reviewerName: auth.userId ?? null,
          reviewNotes: notes,
          reviewedAt: new Date(),
        },
      })
      .catch(() => {
        // The consultation approval already succeeded and is the source of
        // truth; a legacy-flag write failure must not fail the request.
      });

    return NextResponse.json({
      consultation: stored.content,
      meta: consultationMeta(stored),
    });
  } catch (err) {
    if (err instanceof OrchestratorError) {
      const code = err.code === "not_found" ? 404 : err.code === "forbidden" ? 403 : 400;
      return NextResponse.json({ error: err.code, message: err.message }, { status: code });
    }
    throw err;
  }
}

import { NextResponse } from "next/server";
import { ReviewDecision, SystemRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

// Authenticated counterpart to POST /api/review/[token]/ — used by the
// Doctor Workspace at /doctor/reports/[id]. Same validation rules as the
// token route; reviewer name/email come from the JWT instead of free-text.

const VALID = new Set(["APPROVED", "EDITS_REQUESTED", "REJECTED"]);
const MAX_NOTES = 2000;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(
    SystemRole.DOCTOR,
    SystemRole.CLINIC_ADMIN,
    SystemRole.SUPER_ADMIN,
  );
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  let body: { decision?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.decision || !VALID.has(body.decision)) {
    return NextResponse.json({ error: "invalid_decision" }, { status: 400 });
  }
  const notes = (body.notes ?? "").slice(0, MAX_NOTES);
  if (body.decision !== "APPROVED" && notes.trim().length === 0) {
    return NextResponse.json(
      { error: "notes_required", reason: "Edits requested / Reject require a note" },
      { status: 400 },
    );
  }

  // Scope check — doctor / clinic_admin can only decide on cases in their
  // clinic. SUPER_ADMIN bypasses this.
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    select: { id: true, clinicId: true, deletedAt: true, status: true },
  });
  if (!assessment || assessment.deletedAt) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (
    auth.user_role !== SystemRole.SUPER_ADMIN &&
    auth.clinic_id !== assessment.clinicId
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const updated = await prisma.assessment.update({
    where: { id },
    data: {
      reviewDecision: body.decision as ReviewDecision,
      reviewerName: auth.email ?? auth.sub,
      reviewerEmail: auth.email ?? null,
      reviewNotes: notes,
      reviewedAt: new Date(),
    },
    select: {
      id: true,
      reviewDecision: true,
      reviewerName: true,
      reviewerEmail: true,
      reviewNotes: true,
      reviewedAt: true,
    },
  });

  return NextResponse.json({ ok: true, review: updated });
}

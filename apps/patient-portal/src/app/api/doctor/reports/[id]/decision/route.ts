import { NextResponse } from "next/server";
import { ReviewDecision } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext, assertDoctorInClinic } from "@/lib/auth";

// Authenticated counterpart to POST /api/review/[token]/ — used by the
// Doctor Workspace at /doctor/reports/[id]. Reviewer identity comes from
// the verified Doctor row (not the JWT email), so an admin acting via a
// linked Doctor row is recorded as the doctor they actually are.

const VALID = new Set(["APPROVED", "EDITS_REQUESTED", "REJECTED"]);
const MAX_NOTES = 2000;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor } = authResult;

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

  // Doctor-scoped mutation — cross-clinic access is not permitted, even
  // for admins with a linked Doctor row. The 404 masks existence for
  // cases outside the doctor's clinic.
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    select: { id: true, clinicId: true, deletedAt: true, status: true },
  });
  if (!assessment || assessment.deletedAt) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (assertDoctorInClinic(doctor, assessment.clinicId)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const updated = await prisma.assessment.update({
    where: { id },
    data: {
      reviewDecision: body.decision as ReviewDecision,
      // The review claim — see the same stamp in
      // /api/consultation/[assessmentId]/approve. Clinic-QR submissions are
      // unassigned by design; the doctor who decides is the reviewer of
      // record, and this is the first moment that is known rather than
      // guessed.
      reviewingDoctorId: doctor.id,
      reviewerName: doctor.name,
      reviewerEmail: doctor.email,
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

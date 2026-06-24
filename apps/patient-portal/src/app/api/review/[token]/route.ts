import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyReviewToken } from "@/lib/reviewToken";

// Map our verifier errors to user-facing messages + HTTP codes. We never
// leak the specific failure shape (signature vs expiry vs payload) beyond
// the high-level distinction needed to render the right UI state.
const ERROR_RESPONSE = {
  MALFORMED:        { status: 400, message: "This review link is malformed." },
  INVALID_SIGNATURE:{ status: 401, message: "This review link is not valid." },
  EXPIRED:          { status: 410, message: "This review link has expired." },
  INVALID_PAYLOAD:  { status: 400, message: "This review link is not readable." },
} as const;

const VALID_DECISIONS = new Set(["APPROVED", "EDITS_REQUESTED", "REJECTED"]);
const MAX_NOTES_LEN = 2000;
const MAX_NAME_LEN = 120;
const MAX_EMAIL_LEN = 200;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const result = verifyReviewToken(token);
  if (!result.ok) {
    const m = ERROR_RESPONSE[result.error];
    return NextResponse.json({ success: false, error: m.message }, { status: m.status });
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id: result.assessmentId },
    select: {
      id: true,
      status: true,
      reviewDecision: true,
      reviewerName: true,
      reviewerEmail: true,
      reviewNotes: true,
      reviewedAt: true,
      clinic: { select: { id: true, name: true, slug: true } },
      patient: { select: { name: true, age: true, gender: true } },
    },
  });

  if (!assessment) {
    return NextResponse.json(
      { success: false, error: "Report not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    assessmentId: assessment.id,
    status: assessment.status,
    clinic: assessment.clinic,
    patient: assessment.patient,
    review: {
      decision: assessment.reviewDecision,
      reviewerName: assessment.reviewerName,
      reviewerEmail: assessment.reviewerEmail,
      notes: assessment.reviewNotes,
      reviewedAt: assessment.reviewedAt,
    },
    expiresAt: result.expiresAt,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const result = verifyReviewToken(token);
  if (!result.ok) {
    const m = ERROR_RESPONSE[result.error];
    return NextResponse.json({ success: false, error: m.message }, { status: m.status });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        decision?: string;
        reviewerName?: string;
        reviewerEmail?: string;
        notes?: string;
      }
    | null;
  if (!body) {
    return NextResponse.json(
      { success: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const decision = (body.decision ?? "").toUpperCase();
  if (!VALID_DECISIONS.has(decision)) {
    return NextResponse.json(
      { success: false, error: "Decision must be APPROVED, EDITS_REQUESTED, or REJECTED." },
      { status: 400 },
    );
  }

  const reviewerName = (body.reviewerName ?? "").trim().slice(0, MAX_NAME_LEN);
  const reviewerEmail = (body.reviewerEmail ?? "").trim().slice(0, MAX_EMAIL_LEN);
  const notes = (body.notes ?? "").trim().slice(0, MAX_NOTES_LEN);

  if (!reviewerName) {
    return NextResponse.json(
      { success: false, error: "Reviewer name is required." },
      { status: 400 },
    );
  }

  // EDITS_REQUESTED and REJECTED both need notes — an Approve without
  // notes is fine but a rejection without reasoning is not actionable.
  if (decision !== "APPROVED" && !notes) {
    return NextResponse.json(
      { success: false, error: "Please add notes explaining the decision." },
      { status: 400 },
    );
  }

  const updated = await prisma.assessment.update({
    where: { id: result.assessmentId },
    data: {
      reviewDecision: decision as "APPROVED" | "EDITS_REQUESTED" | "REJECTED",
      reviewerName,
      reviewerEmail: reviewerEmail || null,
      reviewNotes: notes || null,
      reviewedAt: new Date(),
    },
    select: {
      id: true,
      reviewDecision: true,
      reviewerName: true,
      reviewedAt: true,
    },
  });

  return NextResponse.json({ success: true, review: updated });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext } from "@/lib/auth";
import { reviewQueueSql } from "@/lib/doctor/reviewQueue";

export const dynamic = "force-dynamic";

// GET /api/doctor/queue/next?exclude=<assessmentId>  ->  { next | null }
//
// The handoff at the end of a review: the doctor approves, and the next
// patient is one click away instead of a trip back to the list.
//
// ── Why this is not part of /api/doctor/stats ────────────────────────────────
// The dashboard loader is polled every 15 seconds and carries five counts, a
// queue slice and the in-clinic list. Pulling all of that to learn one id
// would be the most expensive possible way to ask the cheapest possible
// question. This runs once per approval, selects three columns, and reads the
// same FIFO order and membership rule from lib/doctor/reviewQueue — so it can
// never disagree with the count the doctor just saw, and it can never hand the
// doctor a case that refuses to open (see REVIEWABLE_SOURCE_SQL).
//
// It returns an id and a name, and nothing clinical. The review page itself is
// where the case is loaded.

export async function GET(req: Request) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor } = authResult;

  // The case just decided. Its reviewDecision has already moved off PENDING,
  // so it is normally out of the queue anyway — this guards the window where
  // the read races the write, which would otherwise hand the doctor straight
  // back to the patient they just finished.
  const exclude = new URL(req.url).searchParams.get("exclude");

  try {
    // Raw, so `concern` is extracted from the JSON in Postgres. A Prisma
    // `select` cannot reach a path inside a Json column, so it would have to
    // ship the whole rawResponses blob — the entire questionnaire — to read
    // one string. `concern` only decides which review surface the case opens
    // on (hair vs the dedicated skin pages).
    const rows = await prisma.$queryRaw<
      Array<{ id: string; patientName: string; concern: string | null }>
    >`
      SELECT
        a.id,
        p.name                                  AS "patientName",
        a."rawResponses"->'__meta'->>'concern'  AS "concern"
      FROM "Assessment" a
      JOIN "Patient" p ON p.id = a."patientId"
      WHERE ${reviewQueueSql(doctor.clinicId)}
        AND (${exclude}::text IS NULL OR a.id <> ${exclude})
      -- FIFO. The same rule as every other queue surface: longest wait first.
      ORDER BY a."submittedAt" ASC NULLS LAST
      LIMIT 1
    `;

    const next = rows[0];
    if (!next) return NextResponse.json({ next: null });

    return NextResponse.json({
      next: { id: next.id, patientName: next.patientName, concern: next.concern },
    });
  } catch (err) {
    console.error("[DOCTOR QUEUE NEXT]", err);
    return NextResponse.json({ next: null, error: "Internal server error" }, { status: 500 });
  }
}

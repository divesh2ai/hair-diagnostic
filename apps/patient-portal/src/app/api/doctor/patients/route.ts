import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext } from "@/lib/auth";
import {
  nextAppointmentByPatient,
  AppointmentsNotProvisionedError,
  type AppointmentRecord,
} from "@/lib/doctor/appointments";
import { listClinicBranches } from "@/lib/clinics/branches";

export const dynamic = "force-dynamic";

// Doctor-facing patient list. Scoped to the caller's own Doctor row's
// clinic — no `?clinicId=` override. Cross-clinic inspection belongs on
// /api/admin/* under a SUPER_ADMIN role check; routing it through the
// Doctor API would grant Doctor-role identity to a super-admin's queries
// in a different clinic, which is not the security model.
//
// ── Each row carries where the patient stands ───────────────────────────────
// The list renders a status per patient, so the status has to come from here
// rather than be guessed client-side from `assessmentCount`. Two different
// facts are returned and never conflated:
//
//   lastStatus         — how far the PIPELINE got on the latest assessment.
//   lastReviewDecision — whether the DOCTOR has signed it off.
//
// The registry's green mark tracks the second one. A report can finish
// generating (status COMPLETED) while still sitting unread in the review
// queue; showing that as "done" would mark the doctor's own outstanding work
// as complete.
//
// ── Registry cap ────────────────────────────────────────────────────────────
// The client filters, sorts and searches the full list in the browser, which
// is right for a clinic-sized register and wrong beyond it. LIST_CAP is high
// enough that no real clinic reaches it today and low enough to bound the
// response; `truncated` tells the UI when it is showing a prefix, so it can
// say so instead of quietly under-reporting the clinic's size.
const LIST_CAP = 500;

export async function GET(req: Request) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor } = authResult;

  const url = new URL(req.url);
  const doctorId = url.searchParams.get("doctorId");

  try {
    const [clinic, patients, branches] = await Promise.all([
      prisma.clinic.findUnique({
        where: { id: doctor.clinicId },
        select: { timezone: true },
      }),
      prisma.patient.findMany({
        where: {
          clinicId: doctor.clinicId,
          ...(doctorId ? { doctorId } : {}),
          deletedAt: null,
        },
        take: LIST_CAP,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { assessments: true } },
          assessments: {
            take: 1,
            orderBy: { submittedAt: "desc" },
            select: {
              id: true,
              status: true,
              reviewDecision: true,
              submittedAt: true,
              // Which branch the latest assessment was taken at. Drives the
              // registry's branch filter. Null for assessments from before
              // branch attribution and for generic-URL walk-ins.
              clinicLocationId: true,
            },
          },
        },
      }),
      // The clinic's selectable branches, for the registry's branch filter.
      // Scoped to the caller's own clinic — same boundary as the patient list.
      listClinicBranches(prisma, doctor.clinicId),
    ]);

    // branchName by location id, so a row can show where its latest assessment
    // was taken without a per-row lookup. Soft-deleted/closed branches are not
    // listed, so an assessment at one resolves to null — shown as unfiltered.
    const branchNameById = new Map(branches.map((b) => [b.id, b.branchName]));

    // `concern` decides which review surface a row's action button opens —
    // skin cases have their own (see lib/doctor/reviewHref), and without it
    // every one of them would deep-link to the hair review page.
    //
    // It lives at rawResponses->'__meta'->>'concern', which Prisma cannot
    // project: asking for it through `select` means selecting the whole
    // `rawResponses` blob, i.e. dragging every patient's full questionnaire
    // across the wire to read one short string. So it is one extra indexed
    // lookup over the latest-assessment ids instead — two queries in total, and
    // deliberately not a query per row.
    const latestIds = patients
      .map((p) => p.assessments[0]?.id)
      .filter((id): id is string => Boolean(id));

    const concerns = new Map<string, string | null>();
    if (latestIds.length > 0) {
      const rows = await prisma.$queryRaw<
        Array<{ id: string; concern: string | null }>
      >(Prisma.sql`
        SELECT a.id, a."rawResponses"->'__meta'->>'concern' AS "concern"
        FROM "Assessment" a
        WHERE a.id IN (${Prisma.join(latestIds)})
      `);
      for (const r of rows) concerns.set(r.id, r.concern);
    }

    // Appointments are optional infrastructure until
    // prisma/migrations/20260821_appointments is applied. The registry must
    // keep working without them, so a missing table costs the "next visit"
    // column and nothing else.
    let nextAppointments = new Map<string, AppointmentRecord>();
    let appointmentsProvisioned = true;
    try {
      nextAppointments = await nextAppointmentByPatient({
        clinicId: doctor.clinicId,
      });
    } catch (err) {
      if (!(err instanceof AppointmentsNotProvisionedError)) throw err;
      appointmentsProvisioned = false;
    }

    return NextResponse.json({
      timeZone: clinic?.timezone || "Asia/Kolkata",
      appointmentsProvisioned,
      truncated: patients.length === LIST_CAP,
      // The clinic's branches, so the registry can offer "All / <branch>" chips
      // only when the clinic actually has branches. One or zero → no chips.
      branches: branches.map((b) => ({ id: b.id, branchName: b.branchName })),
      patients: patients.map((p) => {
        const latest = p.assessments[0];
        const next = nextAppointments.get(p.id);
        const lastBranchId = latest?.clinicLocationId ?? null;
        return {
          id: p.id,
          name: p.name,
          phone: p.phone,
          assessmentCount: p._count.assessments,
          lastAssessment: latest?.submittedAt?.toISOString(),
          lastAssessmentId: latest?.id ?? null,
          lastConcern: latest ? (concerns.get(latest.id) ?? null) : null,
          lastStatus: latest?.status ?? null,
          lastReviewDecision: latest?.reviewDecision ?? null,
          // Branch of the latest assessment. Id drives filtering; name is for
          // display. Null when unattributed or the branch is no longer listed.
          lastBranchId,
          lastBranchName: lastBranchId ? (branchNameById.get(lastBranchId) ?? null) : null,
          nextAppointment: next
            ? {
                id: next.id,
                scheduledAt: next.scheduledAt,
                reason: next.reason,
              }
            : null,
        };
      }),
    });
  } catch (error) {
    console.error("Doctor patients API:", error);
    return NextResponse.json({ patients: [], error: "Internal" }, { status: 500 });
  }
}

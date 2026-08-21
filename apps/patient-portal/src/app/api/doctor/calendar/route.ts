import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext } from "@/lib/auth";
import {
  dayKey,
  monthWindowUtc,
  type DayKey,
  type MonthKey,
} from "@/lib/format/clinicDay";
import {
  listAppointmentsInWindow,
  AppointmentsNotProvisionedError,
  APPOINTMENTS_NOT_PROVISIONED,
  type AppointmentRecord,
} from "@/lib/doctor/appointments";

export const dynamic = "force-dynamic";

// The doctor calendar: one clinic month, in one request.
//
// ── Why the whole month, not one day at a time ──────────────────────────────
// The grid must show which days have anything on them BEFORE the doctor clicks
// — a calendar whose cells are all blank until you probe them is a date picker,
// not a calendar. Once every day's count is loaded, the day's contents cost
// nothing extra, so they ship together and clicking a date is instant with no
// spinner and no second round trip. A clinic month is hundreds of rows, not
// hundreds of thousands; ENTRY_CAP below is the guard, not pagination.
//
// ── Two kinds of thing on one day ──────────────────────────────────────────
// Assessments are what HAPPENED: a patient submitted, and the row is immutable
// clinical history. Appointments are what is INTENDED: someone is expected.
// They are counted and rendered separately and are never merged into a single
// "events" list, because the difference is exactly what the doctor is reading
// the calendar to find out.
//
// ── Scoping ─────────────────────────────────────────────────────────────────
// Clinic-scoped, not doctor-scoped. A doctor opening the clinic calendar is
// asking what happened at their clinic that day; filtering to only the cases
// they personally reviewed would hide a colleague's morning and make the day
// look empty. Cross-CLINIC reads remain impossible — clinicId comes from the
// resolved Doctor row and there is no query-param override.

/** Guard against a pathological month; not a pagination scheme. */
const ENTRY_CAP = 400;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Raw row shape. This query is raw rather than a Prisma `select` for one
// reason: `concern` lives at rawResponses->'__meta'->>'concern', and Prisma
// cannot project a JSON path. Selecting `rawResponses` to read one string
// would drag every patient's full questionnaire payload across the wire for a
// month of cases. Without `concern`, every skin case on the calendar would
// deep-link to the hair review surface — see lib/doctor/reviewHref.
interface AssessmentRow {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  submittedAt: Date;
  status: string;
  reviewDecision: string;
  primaryDiagnosis: string | null;
  severity: string | null;
  concern: string | null;
}

type AssessmentEntry = Omit<AssessmentRow, "submittedAt"> & {
  submittedAt: string;
};

interface DayBucket {
  assessments: AssessmentEntry[];
  appointments: AppointmentRecord[];
}

export async function GET(req: Request) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor } = authResult;

  const month = new URL(req.url).searchParams.get("month") ?? "";
  if (!MONTH_RE.test(month)) {
    return NextResponse.json(
      { error: "bad_request", reason: "month must be YYYY-MM" },
      { status: 400 },
    );
  }

  try {
    const clinic = await prisma.clinic.findUnique({
      where: { id: doctor.clinicId },
      select: { timezone: true },
    });
    const timeZone = clinic?.timezone || "Asia/Kolkata";

    const { fromUtc, toUtc } = monthWindowUtc(month as MonthKey);

    // Appointments are optional infrastructure until the migration runs. A
    // missing table degrades this endpoint to "assessments only" rather than
    // failing the whole calendar — the history half needs no new schema and
    // must keep working.
    let appointments: AppointmentRecord[] = [];
    let appointmentsProvisioned = true;
    try {
      appointments = await listAppointmentsInWindow({
        clinicId: doctor.clinicId,
        fromUtc,
        toUtc,
      });
    } catch (err) {
      if (!(err instanceof AppointmentsNotProvisionedError)) throw err;
      appointmentsProvisioned = false;
    }

    const rows = await prisma.$queryRaw<AssessmentRow[]>(Prisma.sql`
      SELECT
        a.id                                   AS "id",
        a."submittedAt"                        AS "submittedAt",
        a.status::text                         AS "status",
        a."reviewDecision"::text               AS "reviewDecision",
        p.id                                   AS "patientId",
        p.name                                 AS "patientName",
        p.phone                                AS "patientPhone",
        sev.content->>'primaryDiagnosis'       AS "primaryDiagnosis",
        sev.content->>'severity'               AS "severity",
        a."rawResponses"->'__meta'->>'concern' AS "concern"
      FROM "Assessment" a
      JOIN "Patient" p ON p.id = a."patientId"
      LEFT JOIN "AIArtifact" sev
             ON sev."assessmentId" = a.id AND sev.type = 'SEVERITY_ANALYSIS'
      WHERE a."clinicId" = ${doctor.clinicId}
        AND a."deletedAt" IS NULL
        AND a."submittedAt" >= ${fromUtc}
        AND a."submittedAt" <  ${toUtc}
      ORDER BY a."submittedAt" ASC
      LIMIT ${ENTRY_CAP}
    `);

    const days: Record<DayKey, DayBucket> = {};
    const bucket = (key: DayKey): DayBucket =>
      (days[key] ??= { assessments: [], appointments: [] });

    for (const a of rows) {
      if (!a.submittedAt) continue;
      // The clinic's wall clock decides the day, never the server's and never
      // UTC — see lib/format/clinicDay for why that distinction is load-bearing.
      const key = dayKey(a.submittedAt, timeZone);
      if (key.slice(0, 7) !== month) continue; // window slack, not this month
      bucket(key).assessments.push({
        ...a,
        patientName: a.patientName || "(unnamed)",
        submittedAt: a.submittedAt.toISOString(),
      });
    }

    for (const appt of appointments) {
      const key = dayKey(appt.scheduledAt, timeZone);
      if (key.slice(0, 7) !== month) continue;
      bucket(key).appointments.push(appt);
    }

    return NextResponse.json({
      month,
      timeZone,
      days,
      appointmentsProvisioned,
      ...(appointmentsProvisioned
        ? {}
        : { appointmentsReason: APPOINTMENTS_NOT_PROVISIONED }),
      truncated: rows.length === ENTRY_CAP,
    });
  } catch (error) {
    console.error("[DOCTOR CALENDAR API]", error);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { classifyAuthProvider } from "@/lib/admin/clinicMonitor/authProvider";
import type { ClinicOpsRow, OpsOverview } from "@/lib/admin/clinicMonitor/model";

export const dynamic = "force-dynamic";

type MetricRow = Omit<ClinicOpsRow, "topDoctor" | "authProvider" | "doctors" | "usage" | "lastAssessmentAt" | "lastReviewAt"> & {
  lastAssessmentAt: Date | null;
  lastReviewAt: Date | null;
  doctors: { name: string; hasLinkedUid: boolean; providers: string[]; lastSignInAt: string | null }[];
};

const dayMs = 24 * 60 * 60 * 1000;
const noStore = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    await assertSuperAdmin();
    // Aggregate on the database. Never send patient records, identity IDs or
    // contact information to the monitoring page.
    const rows = await prisma.$queryRaw<MetricRow[]>`
      WITH assessment_metrics AS (
        SELECT "clinicId",
          count(DISTINCT "patientId")::int AS "assessedPatientCount",
          count(*)::int AS "assessmentCount",
          count(*) FILTER (WHERE "submittedAt" >= (now() AT TIME ZONE 'UTC') - interval '7 days')::int AS "assessments7d",
          max("submittedAt") AT TIME ZONE 'UTC' AS "lastAssessmentAt",
          max("reviewedAt") AT TIME ZONE 'UTC' AS "lastReviewAt"
        FROM public."Assessment"
        WHERE "deletedAt" IS NULL AND "submittedAt" IS NOT NULL
        GROUP BY "clinicId"
      ), doctor_metrics AS (
        SELECT d."clinicId",
          jsonb_agg(jsonb_build_object(
            'name', d.name,
            'hasLinkedUid', coalesce(d."supabaseUserId", d."supabasePhoneUserId") IS NOT NULL,
            'providers', coalesce(auth_data.providers, ARRAY[]::text[]),
            'lastSignInAt', auth_data.last_login
          ) ORDER BY d."isPrimary" DESC, d.name, d.id) AS doctors
        FROM public."Doctor" d
        JOIN public."Clinic" c ON c.id = d."clinicId" AND c."deletedAt" IS NULL AND c.status <> 'ARCHIVED'
        LEFT JOIN LATERAL (
          SELECT array_agg(DISTINCT i.provider) FILTER (WHERE i.provider IS NOT NULL) AS providers,
            max(u.last_sign_in_at) AS last_login
          FROM auth.users u
          LEFT JOIN auth.identities i ON i.user_id = u.id
          WHERE u.id::text IN (d."supabaseUserId", d."supabasePhoneUserId")
        ) auth_data ON true
        WHERE d."deletedAt" IS NULL AND d."isActive"
        GROUP BY d."clinicId"
      )
      SELECT c.id AS "clinicId", c.name, c.slug, c.status::text, c."isActive",
        coalesce(a."assessedPatientCount", 0) AS "assessedPatientCount",
        coalesce(a."assessmentCount", 0) AS "assessmentCount",
        coalesce(a."assessments7d", 0) AS "assessments7d",
        a."lastAssessmentAt", a."lastReviewAt", coalesce(d.doctors, '[]'::jsonb) AS doctors
      FROM public."Clinic" c
      LEFT JOIN assessment_metrics a ON a."clinicId" = c.id
      LEFT JOIN doctor_metrics d ON d."clinicId" = c.id
      WHERE c."deletedAt" IS NULL AND c.status <> 'ARCHIVED'
    `;
    const now = Date.now();
    const clinics = rows.map(({ doctors: sourceDoctors, lastAssessmentAt, lastReviewAt, ...row }): ClinicOpsRow => {
      const doctors = sourceDoctors.map(({ name, hasLinkedUid, providers, lastSignInAt }) => ({
        name, lastSignInAt,
        authProvider: classifyAuthProvider({ readable: true, hasLinkedUid, providers }),
      }));
      const daysSinceAssessment = lastAssessmentAt ? (now - lastAssessmentAt.getTime()) / dayMs : null;
      const usage = row.status !== "ACTIVE" || !row.isActive ? "inactive"
        : daysSinceAssessment === null ? "notStarted"
        : daysSinceAssessment < 7 ? "recent"
        : daysSinceAssessment < 14 ? "followUp"
        : "inactive";
      return {
        ...row, doctors, usage,
        lastAssessmentAt: lastAssessmentAt?.toISOString() ?? null,
        lastReviewAt: lastReviewAt?.toISOString() ?? null,
        topDoctor: doctors[0] ? { name: doctors[0].name } : null,
        authProvider: doctors[0]?.authProvider ?? "NOT_LINKED",
      };
    });
    const doctors = clinics.flatMap((row) => row.doctors);
    const doctorsLoggedIn = doctors.filter((doctor) => doctor.lastSignInAt).length;
    const payload: OpsOverview = {
      clinics,
      kpis: { doctorsLoggedIn, loginPending: doctors.length - doctorsLoggedIn },
    };
    return NextResponse.json(payload, { headers: noStore });
  } catch (error) {
    const response = handleAuthError(error);
    if (response) {
      response.headers.set("Cache-Control", noStore["Cache-Control"]);
      return response;
    }
    console.error("[CLINIC MONITOR] Metrics unavailable", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "Clinic monitoring unavailable" }, { status: 500, headers: noStore });
  }
}

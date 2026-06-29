import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getClinicContext, handleAuthError, isSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await getClinicContext();
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    throw err;
  }

  const url = new URL(req.url);
  const q = url.searchParams;

  const dateFrom = q.get("dateFrom");
  const dateTo = q.get("dateTo");
  // Non-Super-Admins are pinned to their own clinic regardless of query param.
  const requestedClinicId = q.get("clinicId");
  const clinicId = isSuperAdmin(ctx.role) ? requestedClinicId : ctx.clinicId;
  const doctorId = q.get("doctorId");
  const status = q.get("status");
  const diagnosis = q.get("diagnosis");
  const severity = q.get("severity");
  const assignedTo = q.get("assignedTo");
  const decision = q.get("decision");
  const limit = Math.min(Number(q.get("limit") ?? 100), 500);
  const offset = Math.max(Number(q.get("offset") ?? 0), 0);

  const where: Prisma.Sql[] = [Prisma.sql`a."deletedAt" IS NULL`];
  if (dateFrom) where.push(Prisma.sql`a."submittedAt" >= ${new Date(dateFrom)}`);
  if (dateTo) where.push(Prisma.sql`a."submittedAt" <= ${new Date(dateTo)}`);
  if (clinicId) where.push(Prisma.sql`a."clinicId" = ${clinicId}`);
  if (doctorId) where.push(Prisma.sql`p."doctorId" = ${doctorId}`);
  if (status) where.push(Prisma.sql`a."status"::text = ${status}`);
  if (assignedTo) where.push(Prisma.sql`a."reviewingDoctorId" = ${assignedTo}`);
  if (decision) where.push(Prisma.sql`a."reviewDecision"::text = ${decision}`);
  if (diagnosis) where.push(Prisma.sql`sev.content->>'primaryDiagnosis' = ${diagnosis}`);
  if (severity) where.push(Prisma.sql`sev.content->>'severity' = ${severity}`);

  const whereSql = Prisma.sql`WHERE ${Prisma.join(where, ` AND `)}`;

  try {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        submittedAt: Date;
        status: string;
        patientId: string;
        patientName: string;
        patientPhone: string | null;
        clinicId: string;
        clinicName: string;
        careDoctorId: string | null;
        careDoctorName: string | null;
        reviewerId: string | null;
        reviewerName: string | null;
        decision: string | null;
        decisionReviewerName: string | null;
        decisionAt: Date | null;
        primaryDiagnosis: string | null;
        severity: string | null;
      }>
    >(Prisma.sql`
      SELECT
        a.id,
        a."submittedAt",
        a.status::text                                 AS "status",
        p.id                                           AS "patientId",
        p.name                                         AS "patientName",
        p.phone                                        AS "patientPhone",
        c.id                                           AS "clinicId",
        c.name                                         AS "clinicName",
        cd.id                                          AS "careDoctorId",
        cd.name                                        AS "careDoctorName",
        rev.id                                         AS "reviewerId",
        rev.name                                       AS "reviewerName",
        a."reviewDecision"::text                       AS "decision",
        a."reviewerName"                               AS "decisionReviewerName",
        a."reviewedAt"                                 AS "decisionAt",
        sev.content->>'primaryDiagnosis'               AS "primaryDiagnosis",
        sev.content->>'severity'                       AS "severity"
      FROM "Assessment" a
      JOIN "Patient" p   ON p.id = a."patientId"
      JOIN "Clinic" c    ON c.id = a."clinicId"
      LEFT JOIN "Doctor" cd  ON cd.id = p."doctorId"
      LEFT JOIN "Doctor" rev ON rev.id = a."reviewingDoctorId"
      LEFT JOIN "AIArtifact" sev
             ON sev."assessmentId" = a.id AND sev.type = 'SEVERITY_ANALYSIS'
      ${whereSql}
      ORDER BY a."submittedAt" DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `);

    const totalRow = await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM "Assessment" a
      JOIN "Patient" p ON p.id = a."patientId"
      LEFT JOIN "AIArtifact" sev
             ON sev."assessmentId" = a.id AND sev.type = 'SEVERITY_ANALYSIS'
      ${whereSql}
    `);

    return NextResponse.json({
      rows: rows.map((r) => ({
        ...r,
        submittedAt: r.submittedAt?.toISOString?.() ?? null,
        decisionAt: r.decisionAt?.toISOString?.() ?? null,
      })),
      total: Number(totalRow[0]?.total ?? 0),
      limit,
      offset,
    });
  } catch (err) {
    console.error("[DOCTOR REPORTS API]", err);
    return NextResponse.json({ rows: [], total: 0, error: "Internal server error" }, { status: 500 });
  }
}

import { prisma } from "@/lib/prisma";
import { classifyAuthProvider } from "./authProvider";
import type { ClinicDetail } from "./detailModel";

type RawDoctor = Omit<ClinicDetail["doctors"][number], "authProvider" | "lastSignIn"> & { id: string };
type RawDetail = Omit<ClinicDetail, "doctors"> & { doctors: RawDoctor[] };
type Auth = { id: string; providers: string[]; login: Date | null; found: boolean };

export async function loadClinicDetail(id: string): Promise<ClinicDetail | null> {
  // Retain the prior operational reader's clinic-scoped cohorts, version-bound
  // assets and separate delivery/kit signals. Project no patient fields.
  const [row] = await prisma.$queryRaw<{ detail: RawDetail }[]>`
    WITH clinic AS (
     SELECT id, name, status::text FROM public."Clinic" WHERE id = ${id} AND "deletedAt" IS NULL AND status <> 'ARCHIVED'
    ), locations AS (
     SELECT l.id, l."branchName", l.city, l."isPrimary", l.status::text FROM public."ClinicLocation" l JOIN clinic c ON c.id=l."clinicId" WHERE l."deletedAt" IS NULL
    ), cohort AS (
     SELECT a.id,a."patientId",a."clinicLocationId",a."submittedAt",a.status::text AS processing,
       a."reviewedAt",a."reviewingDoctorId",a."reviewDecision"::text,
       co.id AS consultation,co."createdAt" AS consulted,v.id AS version,v."approvalStatus"::text AS review,
       v."approvedAt",v."approvedBy"
     FROM public."Assessment" a JOIN clinic c ON c.id=a."clinicId"
     LEFT JOIN public."Consultation" co ON co."assessmentId"=a.id AND co."clinicId"=c.id AND co."patientId"=a."patientId"
     LEFT JOIN public."ConsultationVersion" v ON v.id=co."currentVersionId" AND v."consultationId"=co.id
     WHERE a."deletedAt" IS NULL AND a."submittedAt" IS NOT NULL
    ), pdf AS (
     SELECT p.* FROM public."ReportAsset" p JOIN cohort a ON a.id=p."assessmentId" AND a.consultation=p."consultationId" AND a.version=p."consultationVersionId"
     JOIN clinic c ON c.id=p."clinicId"
     WHERE a.review='APPROVED'
    ), delivery AS (
     SELECT w."assessmentId",w.status::text,w."createdAt",w."sentAt",w."deliveredAt",
       (lower(coalesce(w."providerStatus",'')) IN ('delivered','read') AND w."deliveredAt" IS NOT NULL) AS confirmed
     FROM public."WhatsappDelivery" w JOIN cohort a ON a.id=w."assessmentId" JOIN clinic c ON c.id=w."clinicId"
     WHERE w.subject='REPORT'
    ), cases AS (
     SELECT a.*,
       (a."reviewedAt" IS NOT NULL OR (a.review='APPROVED' AND a."approvedAt" IS NOT NULL)) AS reviewed,
       CASE WHEN EXISTS (SELECT 1 FROM pdf p WHERE p."assessmentId"=a.id AND p.type='PATIENT_REPORT_PDF' AND p.status='READY' AND nullif(p."storagePath",'') IS NOT NULL) THEN 'Ready'
         WHEN EXISTS (SELECT 1 FROM pdf p WHERE p."assessmentId"=a.id AND p.type='PATIENT_REPORT_PDF' AND p.status IN ('PENDING','QUEUED','RENDERING')) THEN 'Queued / processing'
         WHEN EXISTS (SELECT 1 FROM pdf p WHERE p."assessmentId"=a.id AND p.type='PATIENT_REPORT_PDF' AND p.status='FAILED') THEN 'Failed'
         ELSE 'Not recorded' END AS report
     FROM cohort a
    ), kits AS (
     SELECT k.status::text,k."createdAt",a."clinicLocationId" FROM public."KitOrderIntent" k JOIN cohort a ON a.id=k."assessmentId" AND a.consultation=k."consultationId" JOIN clinic c ON c.id=k."clinicId"
    ), doctors AS (
     SELECT d.id,d.name,d."isPrimary",d."provisioningStatus"::text AS onboarding,
       (d."supabaseUserId" IS NOT NULL OR d."supabasePhoneUserId" IS NOT NULL) AS linked,
       (SELECT max(l."createdAt") FROM public."AuditLog" l WHERE l."clinicId"=d."clinicId" AND l."actorType"='doctor'
          AND l."actorId" IN (d."supabaseUserId",d."supabasePhoneUserId")
          AND l.action IN ('DOCTOR_NOTE_SAVED','CONSULTATION_UPDATED','CONSULTATION_APPROVED','CONSULTATION_NEEDS_REVISION','CONSULTATION_REJECTED')) AS "lastAction",
       (SELECT count(*)::int FROM cases a WHERE a.reviewed AND (a."reviewingDoctorId"=d.id OR a."approvedBy" IN (d.id,d."supabaseUserId",d."supabasePhoneUserId"))) AS reviews
     FROM public."Doctor" d JOIN clinic c ON c.id=d."clinicId" WHERE d."deletedAt" IS NULL AND d."isActive"
    ), events AS (
     SELECT 'Assessment submitted' label,"submittedAt" at,"clinicLocationId" branch FROM cohort
     UNION ALL SELECT 'Consultation generated',consulted,"clinicLocationId" FROM cohort WHERE consulted IS NOT NULL
     UNION ALL SELECT 'Doctor review recorded',greatest("reviewedAt","approvedAt"),"clinicLocationId" FROM cases WHERE reviewed
     UNION ALL SELECT 'PDF generated',p."generatedAt",a."clinicLocationId" FROM pdf p JOIN cohort a ON a.id=p."assessmentId" WHERE p.type='PATIENT_REPORT_PDF' AND p.status='READY' AND p."generatedAt" IS NOT NULL
     UNION ALL SELECT 'Kit intent created',"createdAt","clinicLocationId" FROM kits
     UNION ALL SELECT 'WhatsApp delivery confirmed',w."deliveredAt",a."clinicLocationId" FROM delivery w JOIN cohort a ON a.id=w."assessmentId" WHERE w.confirmed
    )
    SELECT jsonb_build_object(
     'name',c.name,'status',c.status,
     'branches',coalesce((SELECT jsonb_agg(jsonb_build_object('name',l."branchName",'city',l.city,'primary',l."isPrimary",'status',l.status,
       'assessments',(SELECT count(*) FROM cohort a WHERE a."clinicLocationId"=l.id)) ORDER BY l."isPrimary" DESC,l."branchName") FROM locations l),'[]'),
     'unattributed',(SELECT count(*) FROM cohort a WHERE NOT EXISTS(SELECT 1 FROM locations l WHERE l.id=a."clinicLocationId")),
     'doctors',coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d."isPrimary" DESC,d.name) FROM doctors d),'[]'),
     'metrics',(SELECT jsonb_build_object(
       'assessed',count(*),'patients',count(DISTINCT "patientId"),'consultations',count(consultation),
       'lastAssessment',max("submittedAt"),'lastReview',max(greatest("reviewedAt","approvedAt")) FILTER (WHERE reviewed),
       'last7',count(*) FILTER(WHERE "submittedAt">=(now() AT TIME ZONE 'UTC')-interval '7 days'),
       'last30',count(*) FILTER(WHERE "submittedAt">=(now() AT TIME ZONE 'UTC')-interval '30 days'),
       'completed',count(*) FILTER(WHERE processing='COMPLETED'),'missing',count(*) FILTER(WHERE processing='COMPLETED' AND consultation IS NULL),
       'reviewed',count(*) FILTER(WHERE reviewed),'pending',count(*) FILTER(WHERE review='PENDING_REVIEW'),
       'approved',count(*) FILTER(WHERE review='APPROVED'),'ready',count(*) FILTER(WHERE report='Ready'),
       'delivered',(SELECT count(DISTINCT "assessmentId") FROM delivery WHERE confirmed)
     ) FROM cases),
     'reports',(SELECT jsonb_build_object('queued',count(*) FILTER(WHERE status IN ('PENDING','QUEUED','RENDERING')),'failed',count(*) FILTER(WHERE status='FAILED')) FROM pdf),
     'kits',(SELECT jsonb_build_object('intents',count(*),'cancelled',count(*) FILTER(WHERE status='CANCELLED')) FROM kits),
     'delivery',(SELECT jsonb_build_object('sent',count(*) FILTER(WHERE "sentAt" IS NOT NULL OR status IN ('SENT','DELIVERED')),
       'confirmed',count(*) FILTER(WHERE confirmed),'failed',count(*) FILTER(WHERE status='FAILED'),
       'latest',(SELECT CASE WHEN w.confirmed THEN 'Provider confirmed' WHEN w.status='DELIVERED' THEN 'Confirmation unavailable' ELSE w.status END FROM delivery w ORDER BY w."createdAt" DESC LIMIT 1)
     ) FROM delivery),
     'recent',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.at DESC) FROM (
       SELECT a."submittedAt" at,a.processing,coalesce(a.review,CASE WHEN a.reviewed THEN a."reviewDecision" ELSE 'Not recorded' END) review,a.report,
         l."branchName" AS branch FROM cases a LEFT JOIN locations l ON l.id=a."clinicLocationId" ORDER BY a."submittedAt" DESC,a.id LIMIT 10
     ) r),'[]'),
     'activity',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.at DESC) FROM (
       SELECT e.label,e.at,l."branchName" AS branch FROM events e LEFT JOIN locations l ON l.id=e.branch ORDER BY e.at DESC,e.label LIMIT 12
     ) e),'[]')
    ) detail FROM clinic c
  `;
  if (!row) return null;
  let auth: Auth[] | null = null;
  try {
    auth = await prisma.$queryRaw<Auth[]>`
      SELECT d.id,coalesce(array_agg(DISTINCT i.provider) FILTER(WHERE i.provider IS NOT NULL),ARRAY[]::text[]) providers,
        max(u.last_sign_in_at) login, count(u.id) > 0 found
      FROM public."Doctor" d
      LEFT JOIN auth.users u ON u.id::text IN (d."supabaseUserId",d."supabasePhoneUserId")
      LEFT JOIN auth.identities i ON i.user_id=u.id
      WHERE d."clinicId"=${id} AND d."deletedAt" IS NULL AND d."isActive"
      GROUP BY d.id
    `;
  } catch {
    // Fail closed on auth metrics without hiding the independently verified workflow.
  }
  return { ...row.detail, doctors: row.detail.doctors.map(({ id: doctorId, ...doctor }) => {
    const identity = auth?.find((item) => item.id === doctorId);
    return { ...doctor, lastSignIn: identity?.login?.toISOString() ?? null,
      authProvider: classifyAuthProvider({ readable: !!identity && (!doctor.linked || identity.found), hasLinkedUid: doctor.linked, providers: identity?.providers ?? [] }) };
  }) };
}

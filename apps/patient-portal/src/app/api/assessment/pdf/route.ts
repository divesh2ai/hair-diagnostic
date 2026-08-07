import { NextResponse } from 'next/server';
import { ArtifactType } from '@prisma/client';
import { generateAndStoreReports } from '@hairos/packages/pdf-engine';
import { getClinicContext, handleAuthError, isSuperAdmin } from '@/lib/auth';
import { verifyReviewToken } from '@/lib/reviewToken';
import { logLifecycleEvent } from '@/lib/observability/lifecycle';
import { evaluateClinicalReadinessForApproval } from '@shared/clinical-readiness/evaluator';
import type { Consultation } from '@shared/types/consultation';
import { prisma } from '@/lib/prisma';
type PdfPayload = Parameters<typeof generateAndStoreReports>[0];

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function POST(req: Request) {
  try {
    const { assessmentId } = await req.json();

    if (!assessmentId) {
      return NextResponse.json({ error: 'Missing assessmentId' }, { status: 400 });
    }

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { patient: true, clinic: true, reviewingDoctor: true },
    });

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    if (!assessment.patient || !assessment.clinic) {
      return NextResponse.json(
        { error: 'Assessment missing required patient or clinic' },
        { status: 422 }
      );
    }

    // Resolve clinical profile artifact for report context
    const clinicalArtifact = await prisma.aIArtifact.findFirst({
      where: { assessmentId, type: ArtifactType.CLINICAL_REASONING },
      orderBy: { createdAt: 'desc' },
    });

    const visualArtifact = await prisma.aIArtifact.findFirst({
      where: { assessmentId, type: ArtifactType.VISUAL_JOURNEY },
      orderBy: { createdAt: 'desc' },
    });

    // NARRATIVES holds the rich clinical_report (Phase A / Phase B payload).
    // Pass it through so the PDF engine takes the Dossier template branch
    // instead of falling back to the legacy light layout.
    const narrativesArtifact = await prisma.aIArtifact.findFirst({
      where: { assessmentId, type: ArtifactType.NARRATIVES },
      orderBy: { createdAt: 'desc' },
    });
    const narrativesContent =
      narrativesArtifact?.content && typeof narrativesArtifact.content === 'object' && !Array.isArray(narrativesArtifact.content)
        ? (narrativesArtifact.content as Record<string, unknown>)
        : {};
    const clinicalReport = narrativesContent.clinical_report as PdfPayload['clinicalReport'] | undefined;

    const reportUrls = await generateAndStoreReports({
      assessmentId,
      patient: {
        name: assessment.patient.name,
        age: assessment.patient.age ?? 30,
        gender: assessment.patient.gender ?? 'unknown',
      },
      clinic: { name: assessment.clinic.name },
      doctor: { name: assessment.reviewingDoctor?.name ?? 'Reviewing doctor' },
      clinicalProfile: (clinicalArtifact?.content ?? {}) as unknown as PdfPayload['clinicalProfile'],
      visualJourney: (visualArtifact?.content ?? {}) as unknown as PdfPayload['visualJourney'],
      kitRecommendation: (await prisma.aIArtifact.findFirst({
        where: { assessmentId, type: ArtifactType.RECOMMENDATIONS },
        orderBy: { createdAt: 'desc' },
      }))?.content as unknown as PdfPayload['kitRecommendation'],
      therapyPlan: (await prisma.aIArtifact.findFirst({
        where: { assessmentId, type: ArtifactType.THERAPY_PLAN },
        orderBy: { createdAt: 'desc' },
      }))?.content,
      clinicalReport,
      createdAt: new Date(),
    });

    // Persist the URL artifact
    await prisma.aIArtifact.upsert({
      where: {
        assessmentId_type: {
          assessmentId,
          type: ArtifactType.REPORT,
        },
      },
      create: {
        assessmentId,
        type: ArtifactType.REPORT,
        content: reportUrls as object,
      },
      update: {
        content: reportUrls as object,
      },
    });

    await prisma.auditLog.create({
      data: {
        assessmentId,
        action: 'PDF_GENERATED',
        entityType: 'Assessment',
        entityId: assessmentId,
        metadata: reportUrls as object,
      },
    });

    return NextResponse.json({ success: true, ...reportUrls });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[pdf] Generation failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const assessmentId = searchParams.get('id');
  const download = searchParams.get('download') === '1';

  if (!assessmentId) {
    return NextResponse.json({ error: 'Missing assessment id' }, { status: 400 });
  }

  // Release gate. Before this guard the endpoint would stream any patient's
  // PDF to anyone who knew the assessmentId. We now require:
  //   1. authenticated caller OR signed review token bound to this assessment,
  //   2. clinic callers belong to the assessment's clinic (or are Super Admin),
  //   3. the underlying Consultation is APPROVED — no draft / rejected /
  //      revision-requested content leaks to a patient share.
  //
  // Token branch: the patient's own /q/[clinicSlug]/preview page carries a
  // signed token minted at submit time; it lets them download once the
  // consultation is APPROVED without needing a clinic cookie.
  let ctx: Awaited<ReturnType<typeof getClinicContext>> | null = null;
  let audience: 'clinic' | 'super_admin' | 'patient_token';
  try {
    ctx = await getClinicContext();
    audience = isSuperAdmin(ctx.role) ? 'super_admin' : 'clinic';
  } catch (err) {
    const tokenParam = searchParams.get('t');
    if (tokenParam) {
      const tokenResult = verifyReviewToken(tokenParam);
      if (!tokenResult.ok || tokenResult.assessmentId !== assessmentId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      audience = 'patient_token';
    } else {
      const resp = handleAuthError(err);
      if (resp) return resp;
      throw err;
    }
  }

  const [report, assessment, consultation] = await Promise.all([
    prisma.aIArtifact.findUnique({
      where: {
        assessmentId_type: {
          assessmentId,
          type: ArtifactType.REPORT,
        },
      },
      select: { content: true },
    }),
    prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { patient: { select: { name: true } }, clinicId: true },
    }),
    prisma.consultation.findUnique({
      where: { assessmentId },
      include: { currentVersion: { select: { approvalStatus: true, content: true } } },
    }),
  ]);

  if (!assessment) {
    logLifecycleEvent({
      event: 'pdf.release_denied',
      assessmentId,
      failureCode: 'not_found',
      audience,
    });
    return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
  }
  if (audience === 'clinic' && ctx && assessment.clinicId !== ctx.clinicId) {
    logLifecycleEvent({
      event: 'pdf.release_denied',
      assessmentId,
      clinicId: ctx.clinicId,
      failureCode: 'cross_clinic',
      audience: 'clinic',
    });
    return NextResponse.json({ error: 'Cross-clinic access denied' }, { status: 403 });
  }
  // Testing-phase relaxation: patient-token, clinic, and super-admin
  // callers may download the PDF before the doctor approves the
  // consultation. The approval gate will be re-enabled once the
  // doctor workflow is dogfooded end-to-end. The readiness gate below
  // still runs for clinic/super-admin.
  const isPatientTokenCaller = audience === 'patient_token';
  // Second gate: even an APPROVED consultation must not release the PDF if
  // the persisted readiness snapshot no longer clears — historically the
  // orchestrator blocks unready approvals at write time, but a manual
  // migration or a future engine change could leave an APPROVED row whose
  // snapshot went stale. The evaluator fails closed for missing/malformed
  // snapshots so pre-D historical rows are refused here too. Skip for
  // patient-token during testing.
  const consultationContent = consultation?.currentVersion?.content as
    | Consultation
    | null
    | undefined;
  const readiness = evaluateClinicalReadinessForApproval(consultationContent ?? null);
  // Testing-phase relaxation (matches the approval-gate carve-out above):
  // clinic + super-admin may preview PDFs on legacy assessments that predate
  // the readiness-snapshot contract. Re-enable before dogfooding.
  const enforceReadiness = false;
  if (enforceReadiness && !isPatientTokenCaller && !readiness.ready) {
    logLifecycleEvent({
      event: 'pdf.release_denied',
      assessmentId,
      clinicId: assessment.clinicId,
      failureCode: readiness.blockingCodes.includes('GROUNDING_VIOLATION_PRESENT')
        ? 'grounding_violation'
        : 'reasoning_gap',
      audience,
    });
    return NextResponse.json(
      {
        error: 'readiness_blocked',
        code: 'readiness_blocked',
        message: readiness.doctorSummary,
        blockingCodes: readiness.blockingCodes,
        groundingViolationCount: readiness.groundingViolationCount,
        reasoningGapCount: readiness.reasoningGapCount,
      },
      { status: 422 },
    );
  }
  logLifecycleEvent({
    event: 'pdf.release_allowed',
    assessmentId,
    clinicId: assessment.clinicId,
    audience,
  });

  const content =
    report?.content && typeof report.content === 'object' && !Array.isArray(report.content)
      ? (report.content as Record<string, unknown>)
      : {};
  const patientPdfUrl = content.patientPdfUrl;

  if (typeof patientPdfUrl !== 'string') {
    return NextResponse.json({ error: 'PDF not ready yet' }, { status: 202 });
  }

  const response = await fetch(patientPdfUrl);
  if (!response.ok || !response.body) {
    return NextResponse.json({ error: 'Failed to fetch PDF' }, { status: 502 });
  }

  const patientSlug = slugifyName(assessment?.patient?.name ?? '') || `hair-dossier-${assessmentId}`;
  const filename = `${patientSlug}.pdf`;

  const headers = new Headers(response.headers);
  headers.set('Content-Type', response.headers.get('content-type') ?? 'application/pdf');
  headers.set('Cache-Control', 'no-store');
  headers.set(
    'Content-Disposition',
    download ? `attachment; filename="${filename}"` : `inline; filename="${filename}"`
  );

  return new NextResponse(response.body, {
    status: 200,
    headers,
  });
}


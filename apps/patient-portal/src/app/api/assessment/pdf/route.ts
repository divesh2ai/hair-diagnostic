import { NextResponse } from 'next/server';
import { PrismaClient, ArtifactType } from '@prisma/client';
import { generateAndStoreReports } from '@hairos/packages/pdf-engine';

const prisma = new PrismaClient();
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

  const [report, assessment] = await Promise.all([
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
      select: { patient: { select: { name: true } } },
    }),
  ]);

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


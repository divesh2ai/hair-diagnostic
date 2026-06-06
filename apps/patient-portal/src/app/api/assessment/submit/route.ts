import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { safeDispatchOrchestration } from '@/lib/orchestration/dispatch';
import { AssessmentSource, AssessmentStatus, Prisma } from '@prisma/client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SubmitBody {
  clinicSlug: string;
  answers: Record<string, unknown>;
  patientInfo?: {
    name?: string;
    phone?: string;
    email?: string;
  };
}

// ─── Route Handler ────────────────────────────────────────────────────────────

function getSubmitErrorResponse(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);

  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    message.includes("Can't reach database server") ||
    message.includes("Environment variable not found: DATABASE_URL") ||
    message.includes("Missing URL environment variable")
  ) {
    return {
      status: 503,
      body: {
        success: false,
        error: 'Database connection unavailable. Please check the Supabase database connection.',
      },
    };
  }

  return {
    status: 500,
    body: { success: false, error: 'Internal server error' },
  };
}

export async function POST(req: Request) {
  console.log('[SUBMIT] API START');

  // ── Rate limit ──────────────────────────────────────────────────────────────
  const ip = req.headers.get('x-forwarded-for') ?? 'local';
  const { ok } = rateLimit(`submit:${ip}`, 20, 60_000);
  if (!ok) {
    return NextResponse.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 });
  }

  // ── STEP 1: Parse + validate request body ───────────────────────────────────
  let body: SubmitBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  console.log('[SUBMIT] BODY', {
    clinicSlug: body.clinicSlug,
    answerCount: Object.keys(body.answers ?? {}).length,
    patientInfo: body.patientInfo,
  });

  const { clinicSlug, answers, patientInfo = {} } = body;

  if (!clinicSlug || typeof clinicSlug !== 'string' || clinicSlug.trim() === '') {
    return NextResponse.json(
      { success: false, error: 'clinicSlug is required' },
      { status: 400 }
    );
  }

  if (!answers || typeof answers !== 'object' || Object.keys(answers).length === 0) {
    return NextResponse.json(
      { success: false, error: 'answers must be a non-empty object' },
      { status: 400 }
    );
  }

  try {
    // ── STEP 2a: Resolve clinic by slug ────────────────────────────────────────
    const clinic = await prisma.clinic.findUnique({
      where: { slug: clinicSlug.trim() },
      select: { id: true, name: true, isActive: true },
    });

    if (!clinic) {
      console.error('[SUBMIT] CLINIC NOT FOUND', clinicSlug);
      return NextResponse.json(
        { success: false, error: `Clinic '${clinicSlug}' not found` },
        { status: 404 }
      );
    }

    if (!clinic.isActive) {
      return NextResponse.json(
        { success: false, error: 'Clinic is not accepting assessments' },
        { status: 403 }
      );
    }

    console.log('[SUBMIT] CLINIC', clinic.id);

    // ── STEP 2b: Resolve doctor (optional — first active doctor in clinic) ─────
    // Doctor is optional at submission. Can be assigned by clinic admin later.
    const doctor = await prisma.doctor.findFirst({
      where: { clinicId: clinic.id, isActive: true },
      select: { id: true },
    });

    console.log('[SUBMIT] DOCTOR', doctor?.id ?? 'none — will assign later');

    // ── STEP 3: Persist assessment atomically ──────────────────────────────────
    // Extract patient demographics from answers (real protocol IDs: age, sex, name)
    const patientName =
      (patientInfo.name ?? '').trim() ||
      String(answers.name ?? '').trim() ||
      'Anonymous';

    const patientPhone =
      (patientInfo.phone ?? '').trim() ||
      null;

    const patientEmail =
      (patientInfo.email ?? '').trim() ||
      null;

    const patientAge =
      answers.age !== undefined ? Number(answers.age) : null;

    const patientGender =
      (answers.sex as string | undefined) ??
      (patientInfo as Record<string, string>).gender ??
      null;

    const assessment = await prisma.$transaction(async (tx) => {
      // Create a new Patient record for every assessment submission.
      // Patients without auth accounts are anonymous clinic visitors.
      const patient = await tx.patient.create({
        data: {
          clinicId: clinic.id,
          doctorId:  doctor?.id ?? null,
          name:      patientName,
          phone:     patientPhone,
          email:     patientEmail,
          age:       patientAge !== null && !isNaN(patientAge) ? patientAge : null,
          gender:    patientGender,
        },
      });

      // Create the Assessment record.
      // reviewingDoctorId is optional — set to the first clinic doctor if available.
      const newAssessment = await tx.assessment.create({
        data: {
          clinicId:          clinic.id,
          patientId:         patient.id,
          reviewingDoctorId: doctor?.id ?? null,
          status:            AssessmentStatus.PENDING,
          source:            AssessmentSource.WEB,
          rawResponses:      answers as Prisma.InputJsonValue,
        },
      });

      // Persist each question-answer pair as a structured AssessmentResponse row.
      // Enables per-question analytics and future re-processing without re-parsing rawResponses.
      const responseRows = Object.entries(answers).map(([questionId, answer]) => ({
        assessmentId: newAssessment.id,
        questionId,
        answer: (Array.isArray(answer) ? answer : answer) as Prisma.InputJsonValue,
      }));

      if (responseRows.length > 0) {
        await tx.assessmentResponse.createMany({ data: responseRows });
      }

      return newAssessment;
    });

    console.log('[SUBMIT] ASSESSMENT CREATED', assessment.id);

// ── STEP 5: Trigger orchestration asynchronously ─────────────────────────
void safeDispatchOrchestration(assessment.id);

    // ── STEP 4: Return success immediately ─────────────────────────────────────
    return NextResponse.json({
      success: true,
      assessmentId: assessment.id,
    });

  } catch (err) {
    console.error('[SUBMIT] ERROR', err);
    const response = getSubmitErrorResponse(err);
    return NextResponse.json(response.body, { status: response.status });
  }
}

import { NextResponse, after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { safeDispatchOrchestration } from '@/lib/orchestration/dispatch';
import { signReviewToken } from '@/lib/reviewToken';
import { AssessmentSource, AssessmentStatus, Prisma } from '@prisma/client';
import {
  buildAssessmentResponseRows,
  withConcernMetadata,
} from './persistence';

// ─── Patient name + age normalisation ────────────────────────────────────────
// Names must be letters/spaces/.'- only and stored in Proper Case.
// Age must be a whole number between 10 and 150.

const AGE_MIN = 10;
const AGE_MAX = 150;

function sanitiseName(raw: string): string {
  return raw.replace(/[^A-Za-z\s.'-]/g, '').replace(/\s+/g, ' ').trim();
}

function toProperCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[\s.'-])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

function normaliseName(raw: unknown): { value: string; rejected: boolean } {
  if (typeof raw !== 'string') return { value: '', rejected: false };
  const containedDigit = /\d/.test(raw);
  const cleaned = toProperCase(sanitiseName(raw));
  return { value: cleaned, rejected: containedDigit };
}

function normaliseAge(raw: unknown): { value: number | null; error: string | null } {
  if (raw === null || raw === undefined || raw === '') return { value: null, error: null };
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return { value: null, error: 'Age must be a whole number.' };
  }
  if (n < AGE_MIN || n > AGE_MAX) {
    return { value: null, error: `Age must be between ${AGE_MIN} and ${AGE_MAX}.` };
  }
  return { value: n, error: null };
}

// ─── Types ───────────────────────────────────────────────────────────────────

// Accepted concern values. Doctor queue filters/badges read from this list.
// Kept in sync with `Concern` in apps/patient-portal/src/types/questionnaire.ts —
// duplicated here as a plain literal set because the API route deliberately
// avoids importing browser-runtime modules.
const CONCERN_VALUES = ['hair', 'skin_acne', 'skin_pigmentation', 'skin_anti_ageing'] as const;
type Concern = (typeof CONCERN_VALUES)[number];

function normaliseConcern(raw: unknown): Concern | null {
  return typeof raw === 'string' && (CONCERN_VALUES as readonly string[]).includes(raw)
    ? (raw as Concern)
    : null;
}

interface SubmitBody {
  clinicSlug: string;
  answers: Record<string, unknown>;
  concern?: Concern;
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
    body: {
      success: false,
      error:
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : `Internal server error: ${message}`,
    },
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
    concern: body.concern,
    answerCount: Object.keys(body.answers ?? {}).length,
    patientInfo: body.patientInfo,
  });

  const { clinicSlug, answers, patientInfo = {} } = body;
  const concern = normaliseConcern(body.concern);
  if (!concern) {
    return NextResponse.json(
      { success: false, error: 'A valid assessment concern is required.' },
      { status: 400 },
    );
  }

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
    const rawName =
      (patientInfo.name ?? '').trim() || String(answers.name ?? '').trim() || '';
    const nameNorm = normaliseName(rawName);
    if (nameNorm.rejected) {
      return NextResponse.json(
        { success: false, error: 'Patient name cannot contain numbers — use letters only.' },
        { status: 400 },
      );
    }
    const patientName = nameNorm.value || 'Anonymous';

    const patientPhone =
      (patientInfo.phone ?? '').trim() ||
      null;

    const patientEmail =
      (patientInfo.email ?? '').trim() ||
      null;

    const ageNorm = normaliseAge(answers.age);
    if (ageNorm.error) {
      return NextResponse.json(
        { success: false, error: ageNorm.error },
        { status: 400 },
      );
    }
    const patientAge = ageNorm.value;

    // Mirror the normalised values into the answers payload so downstream
    // engines (clinical, narrative, report) see the cleaned versions.
    // `__meta` is a reserved key for cross-cutting session metadata that lives
    // alongside the answer keys but is NOT a question. It is filtered out
    // before persisting per-question AssessmentResponse rows below.
    const normalisedAnswers = withConcernMetadata({
      ...answers,
      name: patientName,
      ...(patientAge !== null ? { age: patientAge } : {}),
    }, concern);

    const patientGender =
      (answers.sex as string | undefined) ??
      (patientInfo as Record<string, string>).gender ??
      null;

    const skinIntakeId = concern.startsWith('skin_') && answers.__meta && typeof answers.__meta === 'object'
      ? String((answers.__meta as Record<string, unknown>).skinIntakeId ?? '')
      : '';
    const linkedSkinAssessment = skinIntakeId
      ? await prisma.assessment.findFirst({
          where: {
            clinicId: clinic.id,
            rawResponses: { path: ['__meta', 'skinIntakeId'], equals: skinIntakeId },
          },
          orderBy: { createdAt: 'desc' },
          select: { patientId: true },
        })
      : null;

    const assessment = await prisma.$transaction(async (tx) => {
      // Widened window: on Supabase pooled connections a cold Prisma engine
      // + Patient/Assessment/AssessmentResponse write can breach the 5s default.

      // Create a new Patient record for every assessment submission.
      // Patients without auth accounts are anonymous clinic visitors.
      const patient = linkedSkinAssessment
        ? { id: linkedSkinAssessment.patientId }
        : await tx.patient.create({
            data: {
              clinicId: clinic.id,
              doctorId:  doctor?.id ?? null,
              name:      patientName,
              phone:     patientPhone,
              email:     patientEmail,
              age:       patientAge,
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
          rawResponses:      normalisedAnswers as Prisma.InputJsonValue,
        },
      });

      // Persist each question-answer pair as a structured AssessmentResponse row.
      // Enables per-question analytics and future re-processing without re-parsing rawResponses.
      // Prisma's Json column rejects `undefined`; coerce to null so the row still writes.
      const responseRows = buildAssessmentResponseRows(
        newAssessment.id,
        normalisedAnswers,
      ).map((row) => ({ ...row, answer: row.answer as Prisma.InputJsonValue }));

      if (responseRows.length > 0) {
        await tx.assessmentResponse.createMany({ data: responseRows });
      }

      return newAssessment;
    }, { maxWait: 10_000, timeout: 20_000 });

    console.log('[SUBMIT] ASSESSMENT CREATED', assessment.id);

    // ── STEP 5: Trigger orchestration via Vercel `after()` ──────────────────
    // Previously this was `void safeDispatchOrchestration(...)` — a detached
    // promise. On Vercel serverless the lambda can freeze the moment the
    // response returns, silently abandoning Phase A/B mid-flight. Wrapping in
    // `after()` keeps the invocation alive until the callback resolves. This
    // is the same durable-dispatch shape used by /api/assessment/orchestrate.
    // safeDispatchOrchestration relies on claimPhaseA() internally, so a
    // patient double-submit or an orchestrate retry can never spawn a second
    // Phase A for the same assessment.
    // HairOS orchestration is strictly hair-only. Skin FACT submissions stay
    // PENDING until the dedicated skin clinical review pipeline handles them.
    if (concern === 'hair') {
      after(() => safeDispatchOrchestration(assessment.id));
    }

    // ── STEP 4: Return success immediately ─────────────────────────────────────
    // Signed token so the patient's own processing/preview pages (which are
    // anonymous public routes) can read the full assessment status payload.
    // Without it, /api/assessment/status falls through to the anonymous
    // branch that strips out narratives and the clinical report never
    // renders on /q/[clinicSlug]/preview/[assessmentId].
    const previewToken = signReviewToken(assessment.id);

    return NextResponse.json({
      success: true,
      assessmentId: assessment.id,
      previewToken,
    });

  } catch (err) {
    console.error('[SUBMIT] ERROR', err);
    const response = getSubmitErrorResponse(err);
    return NextResponse.json(response.body, { status: response.status });
  }
}

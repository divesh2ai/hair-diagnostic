import { NextResponse, after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { describeSchemaDrift, isSchemaDriftError } from '@/lib/prismaErrors';
import { rateLimit } from '@/lib/rate-limit';
import { safeDispatchOrchestration } from '@/lib/orchestration/dispatch';
import { AssessmentSource, AssessmentStatus, Prisma } from '@prisma/client';
import {
  buildAssessmentResponseRows,
  withConcernMetadata,
  withLocaleMetadata,
} from './persistence';
import { resolvePatientForIntake, toRelationship } from '@/lib/patient/identity';
import { resolveVisitType, toRelationshipState } from '@/lib/patient/visit';
import { readIntakeSessionForLinking } from '@/lib/patient/intakeSession';

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

// Patient-facing display locales. Mirrors ASSESSMENT_LOCALES in
// apps/patient-portal/src/lib/assessment-i18n/types.ts and the SupportedLanguage
// Prisma enum — duplicated as a plain literal set for the same reason as
// CONCERN_VALUES above: this route must not import browser-runtime modules.
const LOCALE_VALUES = ['en', 'hi'] as const;
type SubmitLocale = (typeof LOCALE_VALUES)[number];

/**
 * Locale is presentation metadata, never clinical input. An unknown or absent
 * value degrades to English rather than rejecting the submission — a patient
 * must never lose a completed assessment over a display preference.
 */
function normaliseLocale(raw: unknown): SubmitLocale {
  return typeof raw === 'string' && (LOCALE_VALUES as readonly string[]).includes(raw)
    ? (raw as SubmitLocale)
    : 'en';
}

interface SubmitBody {
  clinicSlug: string;
  answers: Record<string, unknown>;
  concern?: Concern;
  /** Language the patient answered in. Optional — older clients omit it. */
  locale?: string;
  /**
   * Why the patient is here today, as stated at the intake gate. Advisory:
   * the server re-resolves identity itself and will not accept an intent that
   * contradicts the relationship it resolved. Absent for older clients and for
   * flows with no intake gate (skin), which persist null rather than a guess.
   */
  visitType?: string;
  /**
   * The signed intake session the patient started under, when they came
   * through the intake gate. Used for exactly one thing: closing the
   * ClinicVisit opened at intake, in the transaction that creates this
   * Assessment. It authorises nothing and carries no clinical input.
   */
  intakeToken?: string;
  patientInfo?: {
    name?: string;
    phone?: string;
    email?: string;
  };
}

// ─── Route Handler ────────────────────────────────────────────────────────────

function getSubmitErrorResponse(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);

  // Identity resolution and the visit-intent columns are both written on the
  // submit path, so this route carries the same migration dependency as
  // /api/patient/lookup — and it fails at the *end* of a completed assessment
  // rather than at the start.
  //
  // It fails loudly and on purpose. The tempting alternative — fall back to a
  // plain patient.create without the identity key — would silently recreate the
  // one-Patient-row-per-submission behaviour that D1 exists to eliminate, and
  // would do it invisibly in production. A submission that cannot be filed
  // against a resolved identity must not be filed at all.
  if (isSchemaDriftError(err)) {
    console.error(
      `[SUBMIT] identity/visit schema not migrated — missing ${describeSchemaDrift(err)}. ` +
        `Apply prisma/migrations/20260812_patient_mobile_identity and ` +
        `prisma/migrations/20260812_visit_intent before serving this route.`,
    );
    return {
      status: 503,
      body: {
        success: false,
        code: 'ASSESSMENT_SCHEMA_UNAVAILABLE',
        error:
          'This clinic is being updated and cannot accept assessments right now. Please tell the reception desk.',
      },
    };
  }

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

  // Shape only. `patientInfo` now carries the mobile number from the intake
  // gate, and a phone number in a log line is a patient identifier sitting in
  // Vercel's log retention where nothing scopes it to the clinic. What is
  // useful for debugging is whether the fields arrived, not what they said.
  console.log('[SUBMIT] BODY', {
    clinicSlug: body.clinicSlug,
    concern: body.concern,
    answerCount: Object.keys(body.answers ?? {}).length,
    visitType: body.visitType,
    hasPatientName: Boolean(body.patientInfo?.name),
    hasPatientPhone: Boolean(body.patientInfo?.phone),
  });

  const { clinicSlug, answers, patientInfo = {} } = body;
  const locale = normaliseLocale(body.locale);
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

    // ── STEP 2b: Reviewing doctor — deliberately NOT assigned here ────────────
    //
    // This used to be `doctor.findFirst({ clinicId, isActive })`, which handed
    // every patient in the clinic to whichever doctor Postgres returned first.
    // In a single-doctor clinic that looked like it worked. In a HairOS clinic
    // with several doctors it is simply wrong: it names a reviewer nobody
    // chose, and the other doctors' queues read empty while one doctor's fills
    // with cases they never agreed to take.
    //
    // The clinic QR is a CLINIC entry point. It leads to the clinic's shared
    // Review Queue, and any authorised doctor there may pick the case up.
    // `reviewingDoctorId` therefore stays null until a doctor actually decides
    // on the case, at which point the decision routes stamp themselves as the
    // reviewer of record — that stamp IS the claim, and it is the only moment
    // at which the platform knows the answer rather than guessing it.
    //
    // Nothing here does round-robin or load balancing. An unassigned case is a
    // truthful representation of a shared queue, not a gap to be filled.

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
    const normalisedAnswers = withLocaleMetadata(
      withConcernMetadata({
        ...answers,
        name: patientName,
        ...(patientAge !== null ? { age: patientAge } : {}),
      }, concern),
      locale,
    );

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

    // The ClinicVisit to close, if this patient came through the intake gate.
    // Signature-checked but NOT expiry-checked: a 30-minute session can expire
    // under an unhurried assessment, and refusing the link then would leave
    // the patient rendered as still-filling-in the assessment they just
    // submitted. It grants nothing — see readIntakeSessionForLinking.
    const linkedVisit = body.intakeToken
      ? readIntakeSessionForLinking(body.intakeToken)
      : null;

    const { assessment, identityState } = await prisma.$transaction(async (tx) => {
      // Widened window: on Supabase pooled connections a cold Prisma engine
      // + Patient/Assessment/AssessmentResponse write can breach the 5s default.

      // Identity resolution, not blind creation. A returning patient must land
      // on their existing record or the doctor has no previous care to show.
      // Runs inside the transaction so a double-submit can't interleave into
      // two patient rows. See lib/patient/identity.
      const resolved = await resolvePatientForIntake(tx, {
        clinicId: clinic.id,
        // Patient.doctorId is the patient's doctor of care, and it is read
        // only when a NEW patient row is created — a returning patient keeps
        // whoever they already have. There is nobody to name at a clinic-QR
        // walk-in, so a new record starts without a doctor of care rather than
        // with an arbitrary one.
        doctorId: null,
        rawPhone: patientPhone,
        linkedPatientId: linkedSkinAssessment?.patientId ?? null,
        details: {
          name:   patientName,
          age:    patientAge,
          gender: patientGender,
          email:  patientEmail,
        },
      });

      // Relationship is taken from the identity resolution that just ran, never
      // from the request. A client can claim to be a returning patient; only
      // the lookup can establish it. AMBIGUOUS is preserved as itself — a
      // quarantined visit is not a confirmed returning patient, and filing it
      // as one would erase the single fact reception needs.
      const relationshipState = toRelationshipState(resolved.identityState);
      // Intent, in contrast, is only knowable from the patient. It is accepted
      // as submitted for a returning visit, derived for a new one, and left
      // null when a returning submission carries none.
      const visitType = resolveVisitType(relationshipState, body.visitType);

      // Create the Assessment record. This — and only this — is the moment an
      // Assessment row exists: the invariant that Assessment means SUBMITTED
      // is what every count, queue and engine downstream depends on.
      //
      // reviewingDoctorId is left null on purpose; see STEP 2b.
      const newAssessment = await tx.assessment.create({
        data: {
          clinicId:          clinic.id,
          patientId:         resolved.patientId,
          reviewingDoctorId: null,
          status:            AssessmentStatus.PENDING,
          source:            AssessmentSource.WEB,
          rawResponses:      normalisedAnswers as Prisma.InputJsonValue,
          visitType,
          patientRelationship: relationshipState,
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

      // Close the in-clinic visit. Inside the transaction so the two facts
      // move together: a submission that rolls back must not leave a patient
      // shown as finished, and a patient shown as finished must have an
      // assessment to show for it.
      //
      // updateMany, not update, and guarded three ways:
      //   * clinicId  — a token from another clinic cannot claim this visit
      //   * assessmentId IS NULL — a visit is claimed once; a replayed
      //     submission matches zero rows instead of violating the unique index
      //   * zero matches are fine — older clients, the skin flow, and any
      //     intake whose visit was never opened all submit without one
      if (linkedVisit) {
        await tx.clinicVisit.updateMany({
          where: {
            intakeSessionId: linkedVisit.sessionId,
            clinicId: clinic.id,
            assessmentId: null,
          },
          data: { assessmentId: newAssessment.id },
        });
      }

      return { assessment: newAssessment, identityState: resolved.identityState };
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
    // No preview token. This response used to carry a signed HMAC bound to the
    // assessment, which the patient's processing and preview pages presented
    // to read the full status payload — narratives, clinical report and all.
    // That was the mechanism by which a patient saw engine output before any
    // doctor had opened the case.
    //
    // The patient journey now ends at /q/[clinicSlug]/thank-you, so there is
    // no patient-facing page left that needs to read this assessment, and a
    // token handed to the browser is a capability that outlives the tab. The
    // clinic reads the case through an authenticated session instead.
    //
    // Skin FACT posts to this same route and never read the token — its
    // questionnaires use `assessmentId` only — so its response shape is
    // unchanged in every field it consumes.
    return NextResponse.json({
      success: true,
      assessmentId: assessment.id,
      // NEW | RETURNING as resolved at intake. Coarse by design, and
      // deliberately NOT the same value as the `patientRelationship` column
      // written above: the column keeps AMBIGUOUS, this response collapses it
      // to RETURNING. Telling an anonymous caller that their number appears on
      // two records is a statement about someone's clinic attendance; the
      // clinic reads the real state from the row and the audit log.
      patientRelationship: toRelationship(identityState),
    });

  } catch (err) {
    console.error('[SUBMIT] ERROR', err);
    const response = getSubmitErrorResponse(err);
    return NextResponse.json(response.body, { status: response.status });
  }
}

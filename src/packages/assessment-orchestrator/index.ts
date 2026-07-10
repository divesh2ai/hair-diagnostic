import { PrismaClient, Prisma, ArtifactType, AssessmentStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  claimPhaseA,
  reclaimStalePhaseA,
  renewLease,
  LeaseLostError,
  ReclaimNotEligibleError,
  MAX_PHASE_A_ATTEMPTS,
} from "./claim";

export {
  PhaseAAlreadyRunningError,
  LeaseLostError,
  ReclaimNotEligibleError,
} from "./claim";
import { normalizeQuestionnaire } from "../questionnaire-normalizer";
import { generateAndStoreReports } from "../pdf-engine";
import type { ReportInputPayload } from "../pdf-engine/types";
import { evaluateClinicalProfile } from "../ai-engine/clinical-engine/evaluateClinicalProfile";
import { mapTherapyNeeds } from "../ai-engine/therapy-engine/mapTherapyNeeds";
import { scoreKits } from "../ai-engine/kit-scorer/scoreKits";
import { OPEN_CLINIC } from "../../sandbox/loaders/fixtureLoader";
import type { PatientAnswers } from "../types";
import { mapPortalToPatientAnswers } from "./mapPortalAnswers";
import { logAssessmentEvent } from "./events";
import { runReviewPathwayShadowGuarded } from "./review-pathway/runReviewPathwayShadowGuarded";
import type { AssessmentArtifact } from "@shared/types/assessment";
import { buildNarrative } from "../ai-engine/explanations/builders/buildNarrative";
import type { ExplanationContext } from "../ai-engine/explanations/types";
import { persistNarrativeArtifact } from "./persistence/persistArtifacts";
import { assembleAssessmentNarratives } from "./narratives/assembleNarratives";
import { buildClinicalReport } from "../ai-engine/report-engine";
import { buildClinicalFacts } from "../ai-engine/clinical-facts";
import {
  buildClinicalContext,
  validateReasoningCompleteness,
  formatReasoningGaps,
} from "../ai-engine/clinical-context";
import { buildFourChapterNarrative } from "../narrative-engine";
import { buildDoctorConsultation } from "../ai-engine/narrative-engine/consultation/buildDoctorConsultation";
import type { NarrativePipelineInput } from "../ai-engine/narrative-engine/types";
import {
  PhaseRecorder,
  StageTimer,
  logPhase,
  logStage,
} from "./instrumentation";

// ─── Prisma Singleton ─────────────────────────────────────────────────────────

const g = globalThis as unknown as { _hairosPrisma?: PrismaClient };
const prisma: PrismaClient = g._hairosPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g._hairosPrisma = prisma;

// ─── Feature flags ────────────────────────────────────────────────────────────
// Visual journey and video are Phase 2. Default OFF — they contribute zero
// stages, zero CPU, zero DB writes while disabled.

const FEATURE_VISUAL_JOURNEY = process.env.FEATURE_VISUAL_JOURNEY === "true";
const FEATURE_VIDEO_PIPELINE = process.env.FEATURE_VIDEO_PIPELINE === "true";
const DEBUG_ORCH = process.env.DEBUG_ORCH === "true";

function debug(...args: unknown[]): void {
  if (DEBUG_ORCH) console.log(...args);
}

// ─── Pipeline Context ────────────────────────────────────────────────────────
// Shared, mutable bag of outputs from Phase A passed to Phase B. Eliminates
// re-reading artifacts from Postgres just to feed the PDF stage.

export interface PipelineContext {
  assessmentId: string;
  executionId: string;
  phaseAStart: number;
  phaseBStart: number | null;

  // Patient / clinic — read once at orchestration start
  patient: { name: string; age: number | null; gender: string | null };
  clinic: { name: string };
  clinicId: string;
  assessmentStatus: AssessmentStatus;
  reviewingDoctorName: string | null;
  answers: PatientAnswers;
  rawAnswers: Record<string, unknown>;

  // Phase A outputs (populated in order)
  normalizedProfile?: Record<string, unknown>;
  clinical?: ReturnType<typeof evaluateClinicalProfile>;
  therapy?: ReturnType<typeof mapTherapyNeeds>;
  recommendations?: ReturnType<typeof scoreKits>;
  clinicalFacts?: ReturnType<typeof buildClinicalFacts>;
  clinicalReport?: ReturnType<typeof buildClinicalReport>;
  doctorConsultation?: ReturnType<typeof buildDoctorConsultation>;
  clinicalContext?: ReturnType<typeof buildClinicalContext>;

  // Phase B outputs
  narrativesPayload?: Record<string, unknown>;
}

// ─── Stage helpers ────────────────────────────────────────────────────────────

/**
 * Run a stage with timing/counter instrumentation. The runner gets a
 * StageTimer so it can attribute Prisma calls (`t.tick("db")`) and external
 * HTTP (`t.tick("external")`). On success/failure we write one
 * OrchestrationLog row (no separate RUNNING/SUCCESS rows — that's a 2× write
 * cost we don't need) and emit a single structured console line.
 */
async function runStage<T>(
  ctx: PipelineContext,
  phase: PhaseRecorder,
  stage: string,
  fn: (t: StageTimer) => Promise<T> | T,
): Promise<T> {
  const t = new StageTimer(stage);
  try {
    const result = await fn(t);
    const m = t.finish();
    phase.record(m);
    logStage(ctx.assessmentId, m);
    // Single OrchestrationLog row per stage (was previously two — RUNNING +
    // SUCCESS — that doubled write count for pure observability).
    await prisma.orchestrationLog.create({
      data: {
        assessmentId: ctx.assessmentId,
        stage,
        status: "SUCCESS",
        durationMs: m.durationMs,
        metadata: t.asMetadata(),
      },
    });
    return result;
  } catch (err) {
    const m = t.finish();
    phase.record(m);
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ORCH-STAGE-FAIL] ${stage} ${m.durationMs}ms: ${message}`);
    await prisma.orchestrationLog
      .create({
        data: {
          assessmentId: ctx.assessmentId,
          stage,
          status: "FAILED",
          durationMs: m.durationMs,
          error: message,
          metadata: t.asMetadata(),
        },
      })
      .catch(() => {});
    throw err;
  }
}

/**
 * Persist a stage's artifact + checkpoint the assessment in ONE round trip
 * via prisma.$transaction. Was previously two sequential writes.
 *
 * Phase A callers pass `leaseExecutionId` so the checkpoint update refuses
 * to write if the lease was reclaimed. Phase B callers omit it because
 * Phase B safety comes from the AIArtifact upsert unique constraint and
 * the outer status compare-and-set, not from the lease.
 */
async function persistStageOutput(
  ctx: PipelineContext,
  t: StageTimer,
  type: ArtifactType,
  content: unknown,
  durationMs: number,
  checkpoint: string | null,
  leaseExecutionId: string | null = null,
): Promise<void> {
  // Artifact upsert is safe under lease loss: the unique (assessmentId, type)
  // constraint means the reclaimed worker's rewrite is idempotent. We do not
  // lease-guard artifact writes to avoid dropping work that would otherwise
  // be the same content.
  await prisma.aIArtifact.upsert({
    where: { assessmentId_type: { assessmentId: ctx.assessmentId, type } },
    create: {
      assessmentId: ctx.assessmentId,
      type,
      content: content as Prisma.InputJsonValue,
      generationMs: durationMs,
    },
    update: {
      content: content as Prisma.InputJsonValue,
      generationMs: durationMs,
    },
  });
  t.tick("db");

  if (checkpoint) {
    if (leaseExecutionId) {
      await renewLease(prisma, ctx.assessmentId, leaseExecutionId, {
        lastCompletedStage: checkpoint,
      });
    } else {
      await prisma.assessment.update({
        where: { id: ctx.assessmentId },
        data: { lastCompletedStage: checkpoint },
      });
    }
    t.tick("db");
  }
}

async function setStatus(
  ctx: PipelineContext,
  t: StageTimer | null,
  status: AssessmentStatus,
  extra: Record<string, unknown> = {},
  leaseExecutionId: string | null = null,
): Promise<void> {
  if (leaseExecutionId) {
    await renewLease(prisma, ctx.assessmentId, leaseExecutionId, {
      status,
      orchestrationStage: status.toLowerCase(),
      ...extra,
    });
  } else {
    await prisma.assessment.update({
      where: { id: ctx.assessmentId },
      data: { status, orchestrationStage: status.toLowerCase(), ...extra },
    });
  }
  t?.tick("db");
}

// ─── Phase A: Doctor-Critical ────────────────────────────────────────────────
// Stages required before the doctor can begin consultation. Awaited by the
// caller — total target is 3–5 seconds.

async function runPhaseA(ctx: PipelineContext): Promise<PhaseRecorder> {
  const phase = new PhaseRecorder("A");
  const lease = ctx.executionId;

  // 1. Normalize ─────────────────────────────────────────────────────────────
  await runStage(ctx, phase, "normalize", async (t) => {
    const profile = normalizeQuestionnaire(ctx.rawAnswers);
    t.tick("cpu");
    ctx.normalizedProfile = profile as unknown as Record<string, unknown>;
    await persistStageOutput(
      ctx,
      t,
      ArtifactType.CLINICAL_REASONING,
      profile,
      Date.now() - phase.metrics.startedAt,
      "normalize",
      lease,
    );
    t.note("fieldCount", Object.keys(profile as object).length);
  });

  // 2. Clinical engine ──────────────────────────────────────────────────────
  await setStatus(ctx, null, AssessmentStatus.RUNNING_CLINICAL_ENGINE, {}, lease);
  ctx.assessmentStatus = AssessmentStatus.RUNNING_CLINICAL_ENGINE;
  await runStage(ctx, phase, "clinical", async (t) => {
    const stageStart = Date.now();
    const clinical = evaluateClinicalProfile(ctx.answers);
    t.tick("cpu");
    ctx.clinical = clinical;
    await persistStageOutput(
      ctx,
      t,
      ArtifactType.SEVERITY_ANALYSIS,
      clinical,
      Date.now() - stageStart,
      "clinical",
      lease,
    );
  });

  // 3. Therapy ──────────────────────────────────────────────────────────────
  await runStage(ctx, phase, "therapy", async (t) => {
    const stageStart = Date.now();
    const therapy = mapTherapyNeeds(ctx.clinical!);
    t.tick("cpu");
    ctx.therapy = therapy;
    await persistStageOutput(
      ctx,
      t,
      ArtifactType.THERAPY_PLAN,
      therapy,
      Date.now() - stageStart,
      "therapy",
      lease,
    );
  });

  // 4. Recommendations ──────────────────────────────────────────────────────
  await setStatus(ctx, null, AssessmentStatus.GENERATING_RECOMMENDATIONS, {}, lease);
  ctx.assessmentStatus = AssessmentStatus.GENERATING_RECOMMENDATIONS;
  await runStage(ctx, phase, "recommendations", async (t) => {
    const stageStart = Date.now();
    const recs = scoreKits(ctx.clinical!, ctx.therapy!, ctx.answers, OPEN_CLINIC, {
      tier: "STANDARD",
      maxKits: 5,
    });
    t.tick("cpu");
    ctx.recommendations = recs;
    await persistStageOutput(
      ctx,
      t,
      ArtifactType.RECOMMENDATIONS,
      recs,
      Date.now() - stageStart,
      "recommendations",
      lease,
    );
  });

  // 5. Clinical summary — facts + clinical report + doctor consultation +
  //    clinical context. These pieces are what the doctor dashboard reads to
  //    begin consultation. Persisted under NARRATIVES so the existing
  //    DoctorConsultationViewer / consultation aggregator pick them up
  //    immediately. Patient narratives + lifestyle + prognosis are written
  //    later in Phase B as a merge update.
  await runStage(ctx, phase, "clinical_summary", async (t) => {
    const stageStart = Date.now();
    const facts = buildClinicalFacts(ctx.answers, ctx.clinical!);
    const clinicalReport = buildClinicalReport(
      {
        name: ctx.patient.name,
        age: ctx.patient.age ?? 30,
        sex: ctx.patient.gender ?? "unknown",
      },
      ctx.clinical!,
      ctx.therapy!,
      ctx.recommendations!,
      ctx.answers,
    );
    const doctorConsultation = buildDoctorConsultation({
      patient: ctx.answers,
      clinicalProfile: ctx.clinical!,
      therapyPlan: ctx.therapy!,
      kitRecommendation: ctx.recommendations!,
      explanationResult: {} as NarrativePipelineInput["explanationResult"],
      narrativeLength: "detailed",
    } as NarrativePipelineInput);
    const fourChapterNarrative = buildFourChapterNarrative(clinicalReport);
    const clinicalContext = buildClinicalContext({
      assessmentId: ctx.assessmentId,
      facts,
      profile: ctx.clinical!,
      kitRecommendation: ctx.recommendations!,
      groundingViolations: [],
    });
    t.tick("cpu", 5);

    ctx.clinicalFacts = facts;
    ctx.clinicalReport = clinicalReport;
    ctx.doctorConsultation = doctorConsultation;
    ctx.clinicalContext = clinicalContext;

    // Slim NARRATIVES payload — doctor-facing fields only. Phase B will
    // overwrite with the same fields plus the composed patient narratives.
    const phaseAPayload = {
      clinical_report: clinicalReport,
      four_chapter_narrative: fourChapterNarrative,
      doctor_consultation: doctorConsultation,
      clinical_context: clinicalContext,
      grounding_violations: [],
      phase: "A" as const,
    };

    await persistNarrativeArtifact(
      prisma,
      ctx.assessmentId,
      phaseAPayload,
      Date.now() - stageStart,
    );
    t.tick("db");

    // Review-pathway shadow evaluation. Additive persistence only; runs
    // after Phase A clinical outputs are finalized and BEFORE the outer
    // CLINICAL_READY lease-renew. Extracted so the try/catch guard can
    // be unit-tested without booting the whole pipeline. Return value
    // is intentionally void — the orchestrator does not branch on the
    // pathway result.
    await runReviewPathwayShadowGuarded(prisma, {
      assessmentId: ctx.assessmentId,
      clinicId: ctx.clinicId,
      answers: ctx.answers,
      clinical: ctx.clinical!,
      therapy: ctx.therapy!,
      recommendations: ctx.recommendations!,
    });
    t.tick("cpu");

    await renewLease(prisma, ctx.assessmentId, lease, {
      lastCompletedStage: "clinical_summary",
    });
    t.tick("db");
  });

  // ── Doctor-ready checkpoint ─────────────────────────────────────────────
  // Guarded by the lease: a reclaimed original worker cannot mark a stale
  // execution CLINICAL_READY on top of the new execution's in-flight work.
  await renewLease(prisma, ctx.assessmentId, lease, {
    status: AssessmentStatus.CLINICAL_READY,
    orchestrationStage: "clinical_ready",
  });
  await logAssessmentEvent(prisma, ctx.assessmentId, "RECOMMENDATIONS_COMPLETE", {
    stage: "clinical_ready",
    durationMs: Date.now() - ctx.phaseAStart,
  });

  phase.finish();
  logPhase(ctx.assessmentId, phase.metrics);
  return phase;
}

// ─── Phase B: Background ─────────────────────────────────────────────────────
// Patient narratives + PDF. Runs after the response has been flushed via
// Vercel `after()`. Failures here do not affect doctor consultation — they
// flip status to PARTIAL_FAILURE so the dashboard can surface "PDF retry".

async function runPhaseB(ctx: PipelineContext): Promise<PhaseRecorder> {
  ctx.phaseBStart = Date.now();
  const phase = new PhaseRecorder("B");

  await prisma.assessment.update({
    where: { id: ctx.assessmentId },
    data: {
      status: AssessmentStatus.REPORT_GENERATING,
      orchestrationStage: "report_generating",
    },
  });

  // 6. Patient narratives ──────────────────────────────────────────────────
  await runStage(ctx, phase, "narratives", async (t) => {
    const stageStart = Date.now();
    const context: ExplanationContext = {
      clinicalProfile: ctx.clinical!,
      therapyNeeds: ctx.therapy!,
      kitRecommendation: ctx.recommendations!,
      narrativeLength: "detailed",
      patientName: ctx.patient.name,
      patientAnswers: ctx.answers,
      // Reuse the facts already computed in Phase A — avoids the double
      // buildClinicalFacts call the old pipeline made.
      facts: ctx.clinicalFacts,
    };
    const assembled = assembleAssessmentNarratives(context);
    const base = buildNarrative(context);
    t.tick("cpu", 2);

    // Re-attach reasoning gaps to the already-built clinical context.
    const reasoning = validateReasoningCompleteness(ctx.clinicalContext!, [
      { name: "doctor_narrative",    text: assembled.doctor_narrative.full ?? "" },
      { name: "patient_narrative",   text: assembled.patient_narrative.full ?? "" },
      { name: "therapy_explanation", text: assembled.therapy_explanation.full ?? "" },
      { name: "lifestyle_plan",      text: assembled.lifestyle_plan.full ?? "" },
      { name: "prognosis",           text: assembled.prognosis.full ?? "" },
      { name: "monitoring_plan",     text: assembled.monitoring_plan.full ?? "" },
    ]);
    if (!reasoning.valid && DEBUG_ORCH) {
      console.warn(
        `[Orchestrator] Reasoning gaps:\n${formatReasoningGaps(reasoning)}`,
      );
    }
    const clinicalContext = {
      ...ctx.clinicalContext!,
      // Phase A built the context with empty violations (narratives didn't
      // exist yet); fold in the real list now that we've composed them.
      groundingViolations: assembled.groundingViolations,
      reasoningGaps: reasoning.gaps,
    };

    const narrativesPayload = {
      doctor_narrative:    assembled.doctor_narrative,
      patient_narrative:   assembled.patient_narrative,
      therapy_explanation: assembled.therapy_explanation,
      lifestyle_plan:      assembled.lifestyle_plan,
      prognosis:           assembled.prognosis,
      monitoring_plan:     assembled.monitoring_plan,
      doctorSummary:       base.doctorSummary,
      patientSummary:      base.patientSummary,
      narrative:           base.narrative,
      length:              base.length,
      clinical_report:     ctx.clinicalReport!,
      doctor_consultation: ctx.doctorConsultation!,
      enrichedTherapyNeeds: assembled.enrichedTherapyNeeds,
      enrichedRootCauses:  assembled.enrichedRootCauses,
      grounding_violations: assembled.groundingViolations,
      clinical_context:    clinicalContext,
      phase: "B" as const,
    };
    ctx.narrativesPayload = narrativesPayload;

    await persistNarrativeArtifact(
      prisma,
      ctx.assessmentId,
      narrativesPayload,
      Date.now() - stageStart,
    );
    t.tick("db");
    t.note("groundingViolations", assembled.groundingViolations.length);
    t.note("reasoningGaps", reasoning.gaps.length);
  });

  // 7. PDF generation ──────────────────────────────────────────────────────
  await setStatus(ctx, null, AssessmentStatus.GENERATING_REPORT);
  await runStage(ctx, phase, "pdf", async (t) => {
    const stageStart = Date.now();
    const payload = ctx.narrativesPayload as
      | { grounding_violations?: unknown; clinical_context?: { reasoningGaps?: unknown } }
      | undefined;
    const groundingViolations =
      (payload?.grounding_violations as ReportInputPayload["groundingViolations"]) ?? [];
    const reasoningGaps =
      (payload?.clinical_context?.reasoningGaps as ReportInputPayload["reasoningGaps"]) ?? [];

    const pdfPayload: ReportInputPayload = {
      assessmentId: ctx.assessmentId,
      patient: {
        name: ctx.patient.name,
        age: ctx.patient.age ?? 30,
        gender: ctx.patient.gender ?? "unknown",
      },
      clinic: { name: ctx.clinic.name },
      doctor: { name: ctx.reviewingDoctorName ?? ctx.clinic.name },
      clinicalProfile: ctx.normalizedProfile as unknown as ReportInputPayload["clinicalProfile"],
      visualJourney: null,
      kitRecommendation: ctx.recommendations as unknown as ReportInputPayload["kitRecommendation"],
      therapyPlan: ctx.therapy ?? null,
      clinicalReport: ctx.clinicalReport as ReportInputPayload["clinicalReport"],
      createdAt: new Date(),
      groundingViolations,
      reasoningGaps,
      // Never let evidence-grounding or reasoning-completeness gaps sink the
      // whole PDF for the patient — they're recorded on the assessment for
      // the doctor to review, but the report itself must still ship (in the
      // rich Dossier template, not a legacy fallback).
      bypassGroundingViolations: true,
      bypassReasoningGaps: true,
    };
    console.log(
      `[ORCH] PDF-STAGE ${ctx.assessmentId} clinicalReport=${ctx.clinicalReport ? "present" : "MISSING"} ` +
      `groundingViolations=${groundingViolations.length} reasoningGaps=${reasoningGaps.length}`,
    );

    const reportUrls = await generateAndStoreReports(pdfPayload);
    t.tick("external"); // Supabase Storage upload
    t.note("patientPdfUrl", reportUrls.patientPdfUrl);

    await persistStageOutput(
      ctx,
      t,
      ArtifactType.REPORT,
      reportUrls,
      Date.now() - stageStart,
      "pdf",
    );
    await logAssessmentEvent(prisma, ctx.assessmentId, "REPORT_GENERATED", {
      stage: "pdf",
      durationMs: Date.now() - stageStart,
    });
  });

  // ── Final status ────────────────────────────────────────────────────────
  await prisma.assessment.update({
    where: { id: ctx.assessmentId },
    data: {
      status: AssessmentStatus.COMPLETED,
      completedAt: new Date(),
      orchestrationStage: "complete",
      orchestrationMeta: {
        executionId: ctx.executionId,
        pipelineVersion: "3.0.0-phase-split",
        phaseADurationMs: ctx.phaseBStart - ctx.phaseAStart,
        phaseBDurationMs: Date.now() - ctx.phaseBStart,
        totalDurationMs: Date.now() - ctx.phaseAStart,
      },
    },
  });

  phase.finish();
  logPhase(ctx.assessmentId, phase.metrics);
  return phase;
}

// ─── Public entry points ──────────────────────────────────────────────────────

/**
 * Phase A only. Caller awaits this and gets back as soon as CLINICAL_READY
 * is set. Use `runPhaseBInBackground(ctx)` to continue with patient
 * narratives + PDF.
 *
 * Returns the populated PipelineContext so the caller can schedule Phase B
 * without re-loading the assessment.
 */
export async function runAssessmentPhaseA(
  assessmentId: string,
): Promise<PipelineContext> {
  const executionId = randomUUID();
  console.log(`[ORCH] PHASE-A-START ${executionId} ${assessmentId}`);

  // Atomic claim BEFORE loading assessment data — updateMany returns the
  // number of rows updated; only the winner proceeds. Two concurrent
  // requests can never both flip the row from PENDING â†’ NORMALIZING because
  // the second one finds no matching row (status is no longer PENDING).
  await claimPhaseA(prisma, assessmentId, executionId);

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { patient: true, clinic: true, reviewingDoctor: true },
  });
  if (!assessment) throw new Error(`Assessment ${assessmentId} not found`);

  const raw = (assessment.rawResponses ?? {}) as Record<string, unknown>;
  const answers = mapPortalToPatientAnswers(raw) as PatientAnswers;
  debug("[ORCH] RAW", raw);
  debug("[ORCH] MAPPED", answers);

  const ctx: PipelineContext = {
    assessmentId,
    executionId,
    phaseAStart: Date.now(),
    phaseBStart: null,
    answers,
    rawAnswers: raw,
    patient: {
      name: assessment.patient.name,
      age: assessment.patient.age,
      gender: assessment.patient.gender,
    },
    clinic: { name: assessment.clinic.name },
    clinicId: assessment.clinicId,
    assessmentStatus: assessment.status,
    reviewingDoctorName: assessment.reviewingDoctor?.name ?? null,
  };
  await logAssessmentEvent(prisma, assessmentId, "ORCHESTRATION_STARTED", {
    stage: "normalize",
    metadata: { executionId },
  });

  try {
    await runPhaseA(ctx);
    console.log(
      `[ORCH] PHASE-A-DONE ${assessmentId} ${Date.now() - ctx.phaseAStart}ms`,
    );
    return ctx;
  } catch (err) {
    // Lease loss = a reclaim path took over. The new execution owns the row;
    // this worker must abort silently without markFatal (which would clobber
    // the fresh execution's state).
    if (err instanceof LeaseLostError) {
      console.log(
        `[ORCH] LEASE-LOST ${assessmentId} exec=${ctx.executionId} — aborting cleanly`,
      );
      throw err;
    }
    await markFatal(ctx, err);
    throw err;
  }
}

/**
 * Schedule Phase B (narratives + PDF). Intended to be called from a Vercel
 * `after()` callback. Errors are swallowed and recorded as PARTIAL_FAILURE
 * because Phase A already returned to the doctor.
 */
export async function runAssessmentPhaseB(ctx: PipelineContext): Promise<void> {
  try {
    await runPhaseB(ctx);
    console.log(
      `[ORCH] PHASE-B-DONE ${ctx.assessmentId} ${Date.now() - (ctx.phaseBStart ?? Date.now())}ms`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ORCH] PHASE-B-FAIL ${ctx.assessmentId}: ${msg}`);
    await prisma.assessment
      .update({
        where: { id: ctx.assessmentId },
        data: {
          status: AssessmentStatus.PARTIAL_FAILURE,
          lastError: `Phase B: ${msg}`,
        },
      })
      .catch(() => {});
    await logAssessmentEvent(prisma, ctx.assessmentId, "FAILED", {
      stage: "phase_b",
      message: msg,
    }).catch(() => {});
  }
}

/**
 * Backwards-compatible single-call entry point — runs A then B sequentially
 * in the same invocation. Used by the local dev dispatch path and any
 * existing caller that hasn't been split yet. New callers should prefer the
 * Phase A / Phase B split so the doctor isn't blocked on PDF.
 */
export async function orchestrateAssessment(assessmentId: string): Promise<void> {
  try {
    const ctx = await runAssessmentPhaseA(assessmentId);
    await runAssessmentPhaseB(ctx);
  } catch (err) {
    // markFatal already called inside runAssessmentPhaseA on Phase A failure.
    // Phase B failures are caught inside runAssessmentPhaseB. Anything that
    // reaches here is a Phase A throw that's already been recorded.
    throw err;
  }
}

async function markFatal(ctx: PipelineContext, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[ORCH] FATAL ${ctx.assessmentId}: ${message}`);
  await logAssessmentEvent(prisma, ctx.assessmentId, "FAILED", {
    message,
  }).catch(() => {});
  await prisma.assessment
    .update({
      where: { id: ctx.assessmentId },
      data: {
        status: AssessmentStatus.FAILED,
        lastError: message,
      },
    })
    .catch(() => {});
}

// ─── Resume ──────────────────────────────────────────────────────────────────
// Resume re-enters from Phase A (idempotent — completed artifacts are
// overwritten with identical content, then Phase B runs). Simpler than the
// per-stage resume in v2 and almost always faster because clinical CPU work
// is sub-second.

export async function resumeOrchestration(assessmentId: string): Promise<void> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: {
      id: true,
      retryCount: true,
      status: true,
      phaseAAttempt: true,
      phaseALeaseExpiresAt: true,
    },
  });
  if (!assessment) throw new Error(`Assessment ${assessmentId} not found`);

  const MAX_RETRIES = 3;
  if (assessment.retryCount >= MAX_RETRIES) {
    console.warn(`[ORCH] Max retries (${MAX_RETRIES}) reached for ${assessmentId}`);
    return;
  }

  // If the row is stuck mid-Phase-A with an expired lease, take ownership
  // atomically before falling through to orchestrateAssessment. A live lease
  // means another worker is actually running — leave it alone.
  const now = new Date();
  const stuckMidRun =
    assessment.phaseALeaseExpiresAt &&
    assessment.phaseALeaseExpiresAt < now &&
    assessment.phaseAAttempt < MAX_PHASE_A_ATTEMPTS;
  if (stuckMidRun) {
    try {
      const newExecutionId = randomUUID();
      const reclaim = await reclaimStalePhaseA(prisma, assessmentId, newExecutionId, now);
      await logAssessmentEvent(prisma, assessmentId, "PHASE_A_RECLAIMED", {
        message: `Reclaimed stale Phase A execution ${reclaim.oldExecutionId ?? "unknown"}`,
        metadata: {
          oldExecutionId: reclaim.oldExecutionId,
          newExecutionId: reclaim.newExecutionId,
          attempt: reclaim.attempt,
          staleMs: reclaim.staleMs,
        },
      });
    } catch (err) {
      if (err instanceof ReclaimNotEligibleError) {
        console.log(
          `[ORCH] RECLAIM-SKIP ${assessmentId}: ${err.reason} — falling through`,
        );
      } else {
        throw err;
      }
    }
  }

  const jitter = Math.floor(Math.random() * 1000);
  const backoff = Math.min(1000 * Math.pow(2, assessment.retryCount) + jitter, 30_000);

  await prisma.assessment.update({
    where: { id: assessmentId },
    data: { retryCount: { increment: 1 }, status: AssessmentStatus.QUEUED },
  });
  await logAssessmentEvent(prisma, assessmentId, "RETRY_STARTED", {
    metadata: { retryCount: assessment.retryCount + 1, backoffMs: backoff },
  });

  await new Promise<void>((resolve) => setTimeout(resolve, backoff));
  await orchestrateAssessment(assessmentId);
}

// ─── Feature-flag introspection (for ops dashboards / tests) ─────────────────

export function getOrchestratorFeatureFlags() {
  return {
    visualJourney: FEATURE_VISUAL_JOURNEY,
    videoPipeline: FEATURE_VIDEO_PIPELINE,
    debug: DEBUG_ORCH,
  };
}

// ─── Status query (unchanged contract) ───────────────────────────────────────

export async function getOrchestrationStatus(assessmentId: string) {
  const [assessment, logs, artifacts, events] = await Promise.all([
    prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: {
        id: true,
        status: true,
        orchestrationStage: true,
        orchestrationMeta: true,
        executionId: true,
        retryCount: true,
        lastCompletedStage: true,
        lastError: true,
        submittedAt: true,
        queuedAt: true,
        startedAt: true,
        completedAt: true,
        updatedAt: true,
        patient: { select: { name: true, age: true, gender: true } },
        clinic: { select: { name: true } },
      },
    }),
    prisma.orchestrationLog.findMany({
      where: { assessmentId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.aIArtifact.findMany({
      where: { assessmentId },
      select: {
        id: true,
        type: true,
        content: true,
        createdAt: true,
        generationMs: true,
        schemaVersion: true,
        engineVersion: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.assessmentEvent.findMany({
      where: { assessmentId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const artifactMap: Record<string, AssessmentArtifact> = Object.fromEntries(
    artifacts.map((artifact) => [
      artifact.type,
      {
        id: artifact.id,
        type: artifact.type,
        content: artifact.content,
        createdAt: artifact.createdAt.toISOString(),
        generationMs: artifact.generationMs,
        schemaVersion: artifact.schemaVersion,
        engineVersion: artifact.engineVersion,
      },
    ]),
  );

  return { assessment, logs, artifacts: artifactMap, events };
}

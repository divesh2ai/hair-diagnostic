import { PrismaClient,Prisma, ArtifactType, AssessmentStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { normalizeQuestionnaire } from "../questionnaire-normalizer";
import { buildVisualJourney } from "../visual-recommendation-engine";
import { expandVisualJourney, mergeVisualJourneySections } from "../visual-recommendation-engine/expandVisualJourney";
import { generateAndStoreReports } from "../pdf-engine";
import type { ReportInputPayload } from "../pdf-engine/types";
import { evaluateClinicalProfile } from "../ai-engine/clinical-engine/evaluateClinicalProfile";
import { mapTherapyNeeds } from "../ai-engine/therapy-engine/mapTherapyNeeds";
import { scoreKits } from "../ai-engine/kit-scorer/scoreKits";
import { OPEN_CLINIC } from "../../sandbox/loaders/fixtureLoader";
import type { PatientAnswers } from "../types";
import { mapPortalToPatientAnswers } from "./mapPortalAnswers";
import { logAssessmentEvent } from "./events";
import type { AssessmentArtifact } from "@shared/types/assessment";
import { buildNarrative } from "../ai-engine/explanations/builders/buildNarrative";
import {
  composeClinicalNarrative,
  composePatientNarrative,
  composeTherapyExplanation,
  composeLifestylePlan,
  composePrognosis,
} from "../ai-engine/explanations/composers";
import type { ExplanationContext } from "../ai-engine/explanations/types";
import { validateArtifactPayload } from "./validation/validateArtifact";
import { persistArtifact, persistNarrativeArtifact } from "./persistence/persistArtifacts";
import { assembleAssessmentNarratives, formatEnrichedNarratives } from "./narratives/assembleNarratives";
import { buildClinicalReport } from "../ai-engine/report-engine";
import { buildFourChapterNarrative } from "../narrative-engine";
import { build3DAvatarScript } from "../ai-engine/narrative-engine/build3DAvatarScript";
import { buildDoctorConsultation } from "../ai-engine/narrative-engine/consultation/buildDoctorConsultation";
import type { NarrativePipelineInput } from "../ai-engine/narrative-engine/types";
import { startAvatarVideoRender, probeVideoStatus } from "../video-engine";
import type { VideoArtifactContent } from "../video-engine";

// ─── Prisma Singleton ─────────────────────────────────────────────────────────
// Shared within the package process lifetime. Prevents connection thrash during
// Next.js hot-reload in dev via globalThis guard.

const g = globalThis as unknown as { _hairosPrisma?: PrismaClient };
const prisma: PrismaClient = g._hairosPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g._hairosPrisma = prisma;

// ─── Stage Ordering ────────────────────────────────────────────────────────────

type StageName =
  | "normalize"
  | "clinical"
  | "therapy"
  | "recommendations"
  | "narratives"
  | "videoScript"
  | "videoRender"
  | "visual"
  | "pdf";

const STAGE_ORDER: StageName[] = [
  "normalize",
  "clinical",
  "therapy",
  "recommendations",
  "narratives",
  "videoScript",
  "videoRender",
  "visual",
  "pdf",
];

// Artifact written by each stage — used for idempotency checks on resume.
const STAGE_ARTIFACT: Record<StageName, ArtifactType> = {
  normalize:       ArtifactType.CLINICAL_REASONING,  // Fix: was SEVERITY_ANALYSIS (normalize writes CLINICAL_REASONING)
  clinical:        ArtifactType.SEVERITY_ANALYSIS,
  therapy:         ArtifactType.THERAPY_PLAN,
  recommendations: ArtifactType.RECOMMENDATIONS,
  narratives:      ArtifactType.NARRATIVES,
  videoScript:     ArtifactType.VIDEO_SCRIPT,
  videoRender:     ArtifactType.AVATAR_VIDEO,
  visual:          ArtifactType.VISUAL_JOURNEY,
  pdf:             ArtifactType.REPORT,
};

// ─── Orchestration Context ─────────────────────────────────────────────────────

interface OrchestrationContext {
  assessmentId: string;
  executionId: string;
  pipelineStart: number;
  answers: PatientAnswers;
  normalizedProfile: Record<string, unknown>;
  patient: { name: string; age: number | null; gender: string | null };
  clinic: { name: string };
  reviewingDoctorName: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * GATE #1: Artifact Payload Validation
 * Validates payload before DB write, fails fast, no regeneration.
 */
async function upsertArtifact(
  assessmentId: string,
  type: ArtifactType,
  content: unknown,
  generationMs?: number
): Promise<void> {
  // ── GATE #1: Validate before persist ──────────────────────────────────────
  try {
    validateArtifactPayload(type, content);
    console.log(`[GATE #1] VALIDATION PASSED ${assessmentId} ${type}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[GATE #1] VALIDATION FAILED ${assessmentId} ${type}:`, message);
    throw err;
  }

  // ── Persist with verification ────────────────────────────────────────────
  await prisma.aIArtifact.upsert({
    where: { assessmentId_type: { assessmentId, type } },
    create: {
      assessmentId,
      type,
      content: content as Prisma.InputJsonValue,
      generationMs: generationMs ?? null,
    },
    update: {
      content: content as Prisma.InputJsonValue,
      generationMs: generationMs ?? null,
    },
  });
}

async function logOrchestrationStage(
  assessmentId: string,
  stage: StageName,
  status: "RUNNING" | "SUCCESS" | "FAILED",
  opts: { durationMs?: number; error?: string; metadata?: Record<string, unknown> } = {}
): Promise<void> {
  await prisma.orchestrationLog.create({
    data: {
      assessmentId,
      stage,
      status,
      durationMs: opts.durationMs ?? null,
      error: opts.error ?? null,
      metadata: (opts.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}

async function setStatus(assessmentId: string, status: AssessmentStatus, extra: Record<string, unknown> = {}): Promise<void> {
  await prisma.assessment.update({
    where: { id: assessmentId },
    data: { status, orchestrationStage: status.toLowerCase(), ...extra },
  });
}

async function stageAlreadyComplete(assessmentId: string, stage: StageName): Promise<boolean> {
  const artifact = await prisma.aIArtifact.findUnique({
    where: { assessmentId_type: { assessmentId, type: STAGE_ARTIFACT[stage] } },
    select: { id: true },
  });
  return artifact !== null;
}

// ─── Per-Stage Runners ─────────────────────────────────────────────────────────

async function runNormalization(ctx: OrchestrationContext): Promise<Record<string, unknown>> {
  const start = Date.now();
  await logOrchestrationStage(ctx.assessmentId, "normalize", "RUNNING");

  const profile = normalizeQuestionnaire(ctx.normalizedProfile as Record<string, unknown>);

  await upsertArtifact(ctx.assessmentId, ArtifactType.CLINICAL_REASONING, profile, Date.now() - start);
  await logOrchestrationStage(ctx.assessmentId, "normalize", "SUCCESS", {
    durationMs: Date.now() - start,
    metadata: { fieldCount: Object.keys(profile as object).length },
  });
  await logAssessmentEvent(prisma, ctx.assessmentId, "NORMALIZATION_COMPLETE", {
    stage: "normalize",
    durationMs: Date.now() - start,
  });
  await prisma.assessment.update({
    where: { id: ctx.assessmentId },
    data: { lastCompletedStage: "normalize" },
  });

  return profile as Record<string, unknown>;
}

async function runClinicalEngine(ctx: OrchestrationContext): Promise<ReturnType<typeof evaluateClinicalProfile>> {
  const start = Date.now();
  await logOrchestrationStage(ctx.assessmentId, "clinical", "RUNNING");

  const clinical = evaluateClinicalProfile(ctx.answers);
  console.log("[ORCH] CLINICAL OUTPUT");
  console.log(JSON.stringify(clinical, null, 2));
  await upsertArtifact(ctx.assessmentId, ArtifactType.SEVERITY_ANALYSIS, clinical, Date.now() - start);
  await logOrchestrationStage(ctx.assessmentId, "clinical", "SUCCESS", { durationMs: Date.now() - start });
  await logAssessmentEvent(prisma, ctx.assessmentId, "CLINICAL_ENGINE_COMPLETE", {
    stage: "clinical",
    durationMs: Date.now() - start,
  });
  await prisma.assessment.update({
    where: { id: ctx.assessmentId },
    data: { lastCompletedStage: "clinical" },
  });

  return clinical;
}

async function runTherapy(
  ctx: OrchestrationContext,
  clinical: ReturnType<typeof evaluateClinicalProfile>
): Promise<ReturnType<typeof mapTherapyNeeds>> {
  const start = Date.now();
  await logOrchestrationStage(ctx.assessmentId, "therapy", "RUNNING");

  const therapy = mapTherapyNeeds(clinical);
  await upsertArtifact(ctx.assessmentId, ArtifactType.THERAPY_PLAN, therapy, Date.now() - start);
  await logOrchestrationStage(ctx.assessmentId, "therapy", "SUCCESS", { durationMs: Date.now() - start });
  await prisma.assessment.update({
    where: { id: ctx.assessmentId },
    data: { lastCompletedStage: "therapy" },
  });

  return therapy;
}

async function runRecommendations(
  ctx: OrchestrationContext,
  clinical: ReturnType<typeof evaluateClinicalProfile>,
  therapy: ReturnType<typeof mapTherapyNeeds>
): Promise<ReturnType<typeof scoreKits>> {
  const start = Date.now();
  await logOrchestrationStage(ctx.assessmentId, "recommendations", "RUNNING");

  const recommendations = scoreKits(clinical, therapy, ctx.answers, OPEN_CLINIC, {
    tier: "STANDARD",
    maxKits: 5,
  });
  await upsertArtifact(ctx.assessmentId, ArtifactType.RECOMMENDATIONS, recommendations, Date.now() - start);
  await logOrchestrationStage(ctx.assessmentId, "recommendations", "SUCCESS", { durationMs: Date.now() - start });
  await logAssessmentEvent(prisma, ctx.assessmentId, "RECOMMENDATIONS_COMPLETE", {
    stage: "recommendations",
    durationMs: Date.now() - start,
  });
  await prisma.assessment.update({
    where: { id: ctx.assessmentId },
    data: { lastCompletedStage: "recommendations" },
  });
  return recommendations;
}

async function runNarratives(
  ctx: OrchestrationContext,
  clinical: ReturnType<typeof evaluateClinicalProfile>,
  therapy: ReturnType<typeof mapTherapyNeeds>,
  recommendations: ReturnType<typeof scoreKits>
): Promise<void> {
  const start = Date.now();
  await logOrchestrationStage(ctx.assessmentId, "narratives", "RUNNING");

  const context: ExplanationContext = {
    clinicalProfile: clinical,
    therapyNeeds: therapy,
    kitRecommendation: recommendations,
    narrativeLength: "detailed",
    patientName: ctx.patient.name,
  };

  // ── Content assembly: Compose + enrich narratives with expansions ─────────
  const assembled = assembleAssessmentNarratives(context);
  const base = buildNarrative(context);

  const clinicalReport = buildClinicalReport(
    {
      name: ctx.patient.name,
      age: ctx.patient.age ?? 30,
      sex: ctx.patient.gender ?? "unknown",
    },
    clinical,
    therapy,
    recommendations,
    ctx.answers
  );

  // ── Phase 1: FourChapterNarrative (additive) ─────────────────────────────
  // Single canonical narrative payload derived purely from ClinicalReport.
  // Phase 1 only produces and persists it. No renderer consumes it yet.
  const fourChapterNarrative = buildFourChapterNarrative(clinicalReport);

  // ── Doctor consultation (5-chapter runtime-agnostic script) ──────────────
  // Reuses the exact clinical inputs the report uses — no duplicated logic.
  // Persisted alongside the narratives so the patient report's
  // DoctorConsultationViewer can render it immediately on report load.
  const doctorConsultation = buildDoctorConsultation({
    patient: ctx.answers,
    clinicalProfile: clinical,
    therapyPlan: therapy,
    kitRecommendation: recommendations,
    explanationResult: {} as NarrativePipelineInput["explanationResult"],
    narrativeLength: "detailed",
  } as NarrativePipelineInput);

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
    clinical_report:     clinicalReport,
    four_chapter_narrative: fourChapterNarrative,
    doctor_consultation: doctorConsultation,
    // Enriched content for rendering
    enrichedTherapyNeeds: assembled.enrichedTherapyNeeds,
    enrichedRootCauses:  assembled.enrichedRootCauses,
  };

  // ── GATE #2: Narrative Persistence Integrity ──────────────────────────────
  // Validates → persists → verifies. Hard failure if any step fails.
  // No silent catches. Only marks stage complete after verification.
  try {
    await persistNarrativeArtifact(
      prisma,
      ctx.assessmentId,
      narrativesPayload,
      Date.now() - start
    );
    console.log(`[GATE #2] PERSISTENCE VERIFIED ${ctx.assessmentId}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[GATE #2] PERSISTENCE FAILED ${ctx.assessmentId}:`, message);
    throw err;
  }

  await logOrchestrationStage(ctx.assessmentId, "narratives", "SUCCESS", {
    durationMs: Date.now() - start,
  });
  await logAssessmentEvent(prisma, ctx.assessmentId, "NARRATIVES_COMPLETE", {
    stage: "narratives",
    durationMs: Date.now() - start,
  });
  await prisma.assessment.update({
    where: { id: ctx.assessmentId },
    data: { lastCompletedStage: "narratives" },
  });
}

async function runVideoScript(
  ctx: OrchestrationContext,
  clinical: ReturnType<typeof evaluateClinicalProfile>,
  therapy: ReturnType<typeof mapTherapyNeeds>,
  recommendations: ReturnType<typeof scoreKits>
): Promise<ReturnType<typeof build3DAvatarScript> | null> {
  const start = Date.now();
  await logOrchestrationStage(ctx.assessmentId, "videoScript", "RUNNING");

  // build3DAvatarScript only reads patient / clinicalProfile / therapyPlan /
  // kitRecommendation / prognosis. explanationResult is required by the type
  // but unused at runtime — pass a minimal cast to keep the contract.
  const scriptInput = {
    patient: ctx.answers,
    clinicalProfile: clinical,
    therapyPlan: therapy,
    kitRecommendation: recommendations,
    explanationResult: {} as NarrativePipelineInput["explanationResult"],
    narrativeLength: "detailed" as const,
    includeAvatarScript: true,
    includeWhatsAppSummary: false,
  } as NarrativePipelineInput;

  const script = build3DAvatarScript(scriptInput);

  await upsertArtifact(ctx.assessmentId, ArtifactType.VIDEO_SCRIPT, script, Date.now() - start);
  await logOrchestrationStage(ctx.assessmentId, "videoScript", "SUCCESS", {
    durationMs: Date.now() - start,
    metadata: { sceneCount: script.scenes.length },
  });
  await prisma.assessment.update({
    where: { id: ctx.assessmentId },
    data: { lastCompletedStage: "videoScript" },
  });

  return script;
}

async function runVideoRender(
  ctx: OrchestrationContext,
  script: ReturnType<typeof build3DAvatarScript>
): Promise<void> {
  const start = Date.now();
  await logOrchestrationStage(ctx.assessmentId, "videoRender", "RUNNING");

  const initial = await startAvatarVideoRender({
    assessmentId: ctx.assessmentId,
    script,
  });

  await upsertArtifact(ctx.assessmentId, ArtifactType.AVATAR_VIDEO, initial, Date.now() - start);
  await logOrchestrationStage(ctx.assessmentId, "videoRender", "SUCCESS", {
    durationMs: Date.now() - start,
    metadata: { status: initial.status, provider: initial.provider },
  });
  await prisma.assessment.update({
    where: { id: ctx.assessmentId },
    data: { lastCompletedStage: "videoRender" },
  });

  // Kick off background poll — does NOT block the rest of the pipeline.
  void pollVideoUntilSettled(ctx.assessmentId);
}

/**
 * Background poller — advances the AVATAR_VIDEO artifact from RENDERING to
 * READY/FAILED. Runs out-of-band; safe to call concurrently because each
 * tick re-reads the latest artifact content.
 */
async function pollVideoUntilSettled(assessmentId: string): Promise<void> {
  const MAX_TICKS = 60;       // 60 * 5s = 5 minutes hard ceiling
  const INTERVAL_MS = 5_000;

  for (let i = 0; i < MAX_TICKS; i++) {
    await new Promise<void>((r) => setTimeout(r, INTERVAL_MS));
    try {
      const row = await prisma.aIArtifact.findUnique({
        where: { assessmentId_type: { assessmentId, type: ArtifactType.AVATAR_VIDEO } },
      });
      const current = row?.content as VideoArtifactContent | undefined;
      if (!current) return;
      if (current.status === "READY" || current.status === "FAILED") return;

      const next = await probeVideoStatus(current);
      if (next === current) continue;

      await prisma.aIArtifact.update({
        where: { assessmentId_type: { assessmentId, type: ArtifactType.AVATAR_VIDEO } },
        data: { content: next as unknown as Prisma.InputJsonValue },
      });

      if (next.status === "READY" || next.status === "FAILED") return;
    } catch (err) {
      console.error("[Orchestrator] video poll error", {
        assessmentId,
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }
  }
}

async function runVisualJourney(
  ctx: OrchestrationContext,
  normalizedProfile: Record<string, unknown>,
  clinical: ReturnType<typeof evaluateClinicalProfile>,
  therapy: ReturnType<typeof mapTherapyNeeds>,
  recommendations: ReturnType<typeof scoreKits>
): Promise<ReturnType<typeof buildVisualJourney>> {
  const start = Date.now();
  await logOrchestrationStage(ctx.assessmentId, "visual", "RUNNING");

  const baseVisual = buildVisualJourney(ctx.assessmentId, normalizedProfile);

  // ── Expand visual journey with clinical narrative sections ─────────────────
  const expandedVisual = expandVisualJourney(baseVisual, clinical, therapy, recommendations);
  const finalVisual = mergeVisualJourneySections(baseVisual, expandedVisual.clinicalNarrativeSections);

  await upsertArtifact(ctx.assessmentId, ArtifactType.VISUAL_JOURNEY, finalVisual, Date.now() - start);
  await logOrchestrationStage(ctx.assessmentId, "visual", "SUCCESS", { durationMs: Date.now() - start });
  console.log(`[CONTENT-EXPANSION] Visual journey populated with ${finalVisual.sections.length} sections`);
  await prisma.assessment.update({
    where: { id: ctx.assessmentId },
    data: { lastCompletedStage: "visual" },
  });

  return finalVisual;
}

async function runReportGeneration(
  ctx: OrchestrationContext,
  normalizedProfile: Record<string, unknown>,
  visual: ReturnType<typeof buildVisualJourney>
): Promise<void> {
  const start = Date.now();
  await logOrchestrationStage(ctx.assessmentId, "pdf", "RUNNING");
  const [recommendationsArtifact, therapyArtifact, narrativesArtifact] = await Promise.all([
    prisma.aIArtifact.findUnique({
      where: { assessmentId_type: { assessmentId: ctx.assessmentId, type: ArtifactType.RECOMMENDATIONS } },
    }),
    prisma.aIArtifact.findUnique({
      where: { assessmentId_type: { assessmentId: ctx.assessmentId, type: ArtifactType.THERAPY_PLAN } },
    }),
    prisma.aIArtifact.findUnique({
      where: { assessmentId_type: { assessmentId: ctx.assessmentId, type: ArtifactType.NARRATIVES } },
    }),
  ]);

  const narrativesContent = narrativesArtifact?.content as Record<string, unknown> | null;
  const clinicalReport = narrativesContent?.clinical_report ?? null;

  const pdfPayload: ReportInputPayload = {
    assessmentId: ctx.assessmentId,
    patient: {
      name: ctx.patient.name,
      age: ctx.patient.age ?? 30,
      gender: ctx.patient.gender ?? "unknown",
    },
    clinic: { name: ctx.clinic.name },
    doctor: { name: ctx.reviewingDoctorName ?? ctx.clinic.name },
    clinicalProfile: normalizedProfile as unknown as ReportInputPayload["clinicalProfile"],
    visualJourney: visual,
    kitRecommendation: (recommendationsArtifact?.content ?? null) as unknown as ReportInputPayload["kitRecommendation"],
    therapyPlan: therapyArtifact?.content ?? null,
    clinicalReport: clinicalReport as ReportInputPayload["clinicalReport"],
    createdAt: new Date(),
  };

  const reportUrls = await generateAndStoreReports(pdfPayload);
  await upsertArtifact(ctx.assessmentId, ArtifactType.REPORT, reportUrls, Date.now() - start);
  await logOrchestrationStage(ctx.assessmentId, "pdf", "SUCCESS", {
    durationMs: Date.now() - start,
    metadata: reportUrls as Record<string, unknown>,
  });
  await logAssessmentEvent(prisma, ctx.assessmentId, "REPORT_GENERATED", {
    stage: "pdf",
    durationMs: Date.now() - start,
  });
  await prisma.assessment.update({
    where: { id: ctx.assessmentId },
    data: { lastCompletedStage: "pdf" },
  });
}

// ─── Core Orchestrator ─────────────────────────────────────────────────────────

export async function orchestrateAssessment(assessmentId: string): Promise<void> {
  const executionId = randomUUID();
  console.log(`[Orchestrator] START ${executionId} → ${assessmentId}`);

  try {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { patient: true, clinic: true, reviewingDoctor: true },
    });

    if (!assessment) {
      throw new Error(`Assessment ${assessmentId} not found`);
    }

    const raw = (assessment.rawResponses ?? {}) as Record<string, unknown>;
    const answers = mapPortalToPatientAnswers(raw) as PatientAnswers;
    console.log("[ORCH] RAW RESPONSES");
    console.log(JSON.stringify(raw, null, 2));

    console.log("[ORCH] MAPPED ANSWERS");
    console.log(JSON.stringify(answers, null, 2));

    const ctx: OrchestrationContext = {
      assessmentId,
      executionId,
      pipelineStart: Date.now(),
      answers,
      normalizedProfile: raw,
      patient: {
        name: assessment.patient.name,
        age: assessment.patient.age,
        gender: assessment.patient.gender,
      },
      clinic: { name: assessment.clinic.name },
      reviewingDoctorName: assessment.reviewingDoctor?.name ?? null,
    };

    // Transition: PENDING → QUEUED → NORMALIZING
    await setStatus(assessmentId, AssessmentStatus.QUEUED, {
      executionId,
      queuedAt: new Date(),
    });
    await logAssessmentEvent(prisma, assessmentId, "QUEUED", {
      metadata: { executionId },
    });

    await setStatus(assessmentId, AssessmentStatus.NORMALIZING, {
      startedAt: new Date(),
    });
    await logAssessmentEvent(prisma, assessmentId, "ORCHESTRATION_STARTED", {
      stage: "normalize",
      metadata: { executionId },
    });

    // ── Stage 1: Normalize (critical — abort if this fails) ──────────────────
    let normalizedProfile: Record<string, unknown> = raw;
    if (!(await stageAlreadyComplete(assessmentId, "normalize"))) {
      normalizedProfile = await runNormalization(ctx);
    }
    ctx.normalizedProfile = normalizedProfile;

    // ── Stage 2: Clinical Engine ──────────────────────────────────────────────
    let clinical!: ReturnType<typeof evaluateClinicalProfile>;
    await setStatus(assessmentId, AssessmentStatus.RUNNING_CLINICAL_ENGINE);

    const clinicalFailed = !(await stageAlreadyComplete(assessmentId, "clinical"));
    if (clinicalFailed) {
      try {
        clinical = await runClinicalEngine(ctx);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await logOrchestrationStage(assessmentId, "clinical", "FAILED", { error: msg });
        await logAssessmentEvent(prisma, assessmentId, "FAILED", { stage: "clinical", message: msg });
        console.error(`[Orchestrator] clinical stage failed ${assessmentId}:`, msg);
        throw err;
      }
    } else {
      const artifact = await prisma.aIArtifact.findUnique({
        where: { assessmentId_type: { assessmentId, type: ArtifactType.SEVERITY_ANALYSIS } },
      });
      clinical = (artifact?.content ?? {}) as ReturnType<typeof evaluateClinicalProfile>;
    }

    // ── Stage 3: Therapy Plan ─────────────────────────────────────────────────
    let therapy!: ReturnType<typeof mapTherapyNeeds>;
    if (clinical) {
      if (!(await stageAlreadyComplete(assessmentId, "therapy"))) {
        try {
          therapy = await runTherapy(ctx, clinical);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await logOrchestrationStage(assessmentId, "therapy", "FAILED", { error: msg });
          await logAssessmentEvent(prisma, assessmentId, "FAILED", { stage: "therapy", message: msg });
          console.error(`[Orchestrator] therapy stage failed ${assessmentId}:`, msg);
        }
      } else {
        const artifact = await prisma.aIArtifact.findUnique({
          where: { assessmentId_type: { assessmentId, type: ArtifactType.THERAPY_PLAN } },
        });
        therapy = (artifact?.content ?? {}) as ReturnType<typeof mapTherapyNeeds>;
      }
    }

    // ── Stage 4: Recommendations ──────────────────────────────────────────────
    await setStatus(assessmentId, AssessmentStatus.GENERATING_RECOMMENDATIONS);

    let recommendations: ReturnType<typeof scoreKits> | null = null;
    if (clinical && therapy) {
      if (!(await stageAlreadyComplete(assessmentId, "recommendations"))) {
        try {
          recommendations = await runRecommendations(ctx, clinical, therapy);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await logOrchestrationStage(assessmentId, "recommendations", "FAILED", { error: msg });
          console.error(`[Orchestrator] recommendations stage failed ${assessmentId}:`, msg);
        }
      } else {
        const recArtifact = await prisma.aIArtifact.findUnique({
          where: { assessmentId_type: { assessmentId, type: ArtifactType.RECOMMENDATIONS } },
        });
        recommendations = (recArtifact?.content ?? null) as ReturnType<typeof scoreKits> | null;
      }
    }

    // ── Stage 5: Narratives ───────────────────────────────────────────────────
    await setStatus(assessmentId, AssessmentStatus.GENERATING_NARRATIVE);

    if (clinical && therapy && recommendations) {
      if (!(await stageAlreadyComplete(assessmentId, "narratives"))) {
        try {
          await runNarratives(ctx, clinical, therapy, recommendations);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await logOrchestrationStage(assessmentId, "narratives", "FAILED", { error: msg });
          await logAssessmentEvent(prisma, assessmentId, "FAILED", { stage: "narratives", message: msg });
          console.error(`[Orchestrator] narratives stage failed ${assessmentId}:`, msg);
        }
      }
    }

    // ── Stage 5b: Video Script ────────────────────────────────────────────────
    // Video is the patient's primary artifact. Script + render kick off BEFORE
    // visual journey / PDF so the result page can hero the video as soon as
    // possible. The render itself is async — kicked off here, completed by
    // pollVideoUntilSettled in the background.
    await setStatus(assessmentId, AssessmentStatus.GENERATING_VIDEO_SCRIPT);

    let videoScript: ReturnType<typeof build3DAvatarScript> | null = null;
    if (clinical && therapy && recommendations) {
      if (!(await stageAlreadyComplete(assessmentId, "videoScript"))) {
        try {
          videoScript = await runVideoScript(ctx, clinical, therapy, recommendations);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await logOrchestrationStage(assessmentId, "videoScript", "FAILED", { error: msg });
          console.error(`[Orchestrator] videoScript stage failed ${assessmentId}:`, msg);
        }
      } else {
        const artifact = await prisma.aIArtifact.findUnique({
          where: { assessmentId_type: { assessmentId, type: ArtifactType.VIDEO_SCRIPT } },
        });
        videoScript = (artifact?.content ?? null) as ReturnType<typeof build3DAvatarScript> | null;
      }
    }

    // ── Stage 5c: Video Render (kick off, do NOT block visual/pdf) ────────────
    await setStatus(assessmentId, AssessmentStatus.RENDERING_VIDEO);

    if (videoScript) {
      if (!(await stageAlreadyComplete(assessmentId, "videoRender"))) {
        try {
          await runVideoRender(ctx, videoScript);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await logOrchestrationStage(assessmentId, "videoRender", "FAILED", { error: msg });
          console.error(`[Orchestrator] videoRender stage failed ${assessmentId}:`, msg);
        }
      } else {
        // On resume, restart the background poller in case the artifact is
        // still RENDERING but the previous process died.
        void pollVideoUntilSettled(assessmentId);
      }
    }

    // ── Stage 6: Visual Journey ───────────────────────────────────────────────
    let visual!: ReturnType<typeof buildVisualJourney>;
    if (!(await stageAlreadyComplete(assessmentId, "visual"))) {
      try {
        visual = await runVisualJourney(ctx, normalizedProfile, clinical, therapy, recommendations);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await logOrchestrationStage(assessmentId, "visual", "FAILED", { error: msg });
        console.error(`[Orchestrator] visual stage failed ${assessmentId}:`, msg);
      }
    } else {
      const artifact = await prisma.aIArtifact.findUnique({
        where: { assessmentId_type: { assessmentId, type: ArtifactType.VISUAL_JOURNEY } },
      });
      visual = (artifact?.content ?? {}) as ReturnType<typeof buildVisualJourney>;
    }

    // ── Stage 7: Report Generation ────────────────────────────────────────────
    await setStatus(assessmentId, AssessmentStatus.GENERATING_REPORT);

    if (!(await stageAlreadyComplete(assessmentId, "pdf"))) {
      try {
        await runReportGeneration(ctx, normalizedProfile, visual);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await logOrchestrationStage(assessmentId, "pdf", "FAILED", { error: msg });
        await logAssessmentEvent(prisma, assessmentId, "FAILED", { stage: "pdf", message: msg });
        console.error(`[Orchestrator] pdf stage failed ${assessmentId}:`, msg);
      }
    }

    // ── Determine final status ────────────────────────────────────────────────
    const finalArtifacts = await prisma.aIArtifact.findMany({
      where: { assessmentId },
      select: { type: true },
    });

    const completedTypes = new Set(finalArtifacts.map((a) => a.type));
    const criticalTypes = [ArtifactType.CLINICAL_REASONING, ArtifactType.SEVERITY_ANALYSIS, ArtifactType.RECOMMENDATIONS];
    const allCriticalDone = criticalTypes.every((t) => completedTypes.has(t));
    const finalStatus = allCriticalDone
  ? AssessmentStatus.COMPLETED
  : AssessmentStatus.PARTIAL_FAILURE;

console.log("[ORCH] FINAL STATUS", {
  assessmentId,
  finalStatus,
  completedTypes: Array.from(completedTypes),
});

await prisma.assessment.update({
  where: { id: assessmentId },
  data: {
    status: finalStatus,
    completedAt: new Date(),
    orchestrationStage: "complete",
    orchestrationMeta: {
      executionId,
      pipelineVersion: "2.0.0-production",
      totalDurationMs: Date.now() - ctx.pipelineStart,
      completedTypes: Array.from(completedTypes),
    },
  },
});

    await logAssessmentEvent(prisma, assessmentId, "RETRY_SUCCEEDED", {
      message: `Pipeline finished with status ${finalStatus}`,
      metadata: { executionId, totalDurationMs: Date.now() - ctx.pipelineStart },
    });

    await prisma.auditLog.create({
      data: {
        assessmentId,
        action: "ORCHESTRATION_COMPLETED",
        entityType: "Assessment",
        entityId: assessmentId,
        metadata: {
          executionId,
          finalStatus,
          durationMs: Date.now() - ctx.pipelineStart,
        },
      },
    });

    console.log(`[Orchestrator] DONE ${executionId} → ${assessmentId} [${finalStatus}] ${Date.now() - ctx.pipelineStart}ms`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;

    console.error(`[Orchestrator] FATAL ${assessmentId}:`, {
  message,
  stack,
});

    await logAssessmentEvent(prisma, assessmentId, "FAILED", {
      message,
      metadata: { stack },
    }).catch(() => {});

    await prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        status: AssessmentStatus.FAILED,
        lastError: message,
        orchestrationMeta: { error: message, executionId: undefined },
      },
    }).catch(() => {});

    await prisma.auditLog.create({
      data: {
        assessmentId,
        action: "ORCHESTRATION_FAILED",
        entityType: "Assessment",
        entityId: assessmentId,
        metadata: { error: message },
      },
    }).catch(() => {});
  }
}

// ─── Resume Orchestration (retry-safe) ────────────────────────────────────────
// Re-enters from the last incomplete stage. Idempotent: completed stages are
// skipped based on artifact presence, so safe to call multiple times.

export async function resumeOrchestration(assessmentId: string): Promise<void> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, status: true, retryCount: true },
  });

  if (!assessment) throw new Error(`Assessment ${assessmentId} not found`);

  const MAX_RETRIES = 3;
  if (assessment.retryCount >= MAX_RETRIES) {
    console.warn(`[Orchestrator] Max retries (${MAX_RETRIES}) reached for ${assessmentId}`);
    return;
  }

  const jitter = Math.floor(Math.random() * 1000);
  const backoff = Math.min(1000 * Math.pow(2, assessment.retryCount) + jitter, 30_000);

  await prisma.assessment.update({
    where: { id: assessmentId },
    data: {
      retryCount: { increment: 1 },
      status: AssessmentStatus.QUEUED,
    },
  });

  await logAssessmentEvent(prisma, assessmentId, "RETRY_STARTED", {
    metadata: { retryCount: assessment.retryCount + 1, backoffMs: backoff },
  });

  console.log(`[Orchestrator] RETRY #${assessment.retryCount + 1} in ${backoff}ms → ${assessmentId}`);

  await new Promise<void>((resolve) => setTimeout(resolve, backoff));
  await orchestrateAssessment(assessmentId);
}

// ─── Status Query ─────────────────────────────────────────────────────────────

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
    ])
  );

  return { assessment, logs, artifacts: artifactMap, events };
}

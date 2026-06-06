import prisma from '../prismaClient';
import { randomUUID } from 'crypto';
import type {
  Assessment,
  AssessmentResponse,
  AIArtifact,
  OrchestrationLog,
  AssessmentStatus,
  ArtifactType,
} from '@prisma/client';

/**
 * Assessment Service
 * 
 * Handles complete lifecycle of clinical assessments:
 * - Creation with patient data
 * - Response persistence
 * - Orchestration coordination
 * - Status tracking
 * - Artifact management
 * - Error recovery
 */

export interface CreateAssessmentInput {
  patientId: string;
  clinicId: string;
  doctorId: string;
  source?: 'QR' | 'MANUAL' | 'WEB' | 'WHATSAPP';
  metadata?: Record<string, any>;
}

export interface SubmitResponsesInput {
  assessmentId: string;
  responses: Array<{
    questionId: string;
    answer: any;
  }>;
}

export interface PersistArtifactInput {
  assessmentId: string;
  type: ArtifactType;
  content: any;
  engineVersion?: string;
  schemaVersion?: string;
  generationMs?: number;
}

export interface UpdateOrchestrationStatusInput {
  assessmentId: string;
  stage: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  durationMs?: number;
  confidence?: number;
  uncertainty?: Record<string, any>;
  error?: string;
}

/**
 * Create a new assessment for a patient
 */
export async function createAssessment(
  input: CreateAssessmentInput
): Promise<Assessment> {
  const assessment = await prisma.assessment.create({
    data: {
      id: randomUUID(),
      patientId: input.patientId,
      clinicId: input.clinicId,
      doctorId: input.doctorId,
      source: input.source || 'WEB',
      status: 'PENDING',
      orchestrationMeta: {
        createdAt: new Date().toISOString(),
        ...input.metadata,
      },
      submittedAt: new Date(),
    },
    include: {
      patient: true,
      clinic: true,
      doctor: true,
    },
  });

  // Audit log
  await logAudit({
    action: 'ASSESSMENT_CREATED',
    entityType: 'Assessment',
    entityId: assessment.id,
    metadata: { source: input.source },
  });

  return assessment;
}

/**
 * Get assessment by ID with all related data
 */
export async function getAssessment(assessmentId: string) {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      patient: true,
      clinic: true,
      doctor: true,
      responses: true,
      artifacts: {
        orderBy: { createdAt: 'asc' },
      },
      orchestrationLogs: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!assessment) {
    throw new Error(`Assessment not found: ${assessmentId}`);
  }

  return assessment;
}

/**
 * Get assessments for a clinic (paginated)
 */
export async function getClinicAssessments(
  clinicId: string,
  options: {
    page?: number;
    limit?: number;
    status?: AssessmentStatus;
    doctorId?: string;
  } = {}
) {
  const page = options.page || 1;
  const limit = options.limit || 50;
  const skip = (page - 1) * limit;

  const where: any = { clinicId };
  if (options.status) where.status = options.status;
  if (options.doctorId) where.doctorId = options.doctorId;

  const [assessments, total] = await Promise.all([
    prisma.assessment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: true,
        doctor: true,
      },
    }),
    prisma.assessment.count({ where }),
  ]);

  return {
    assessments,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get assessments for a doctor (patients they manage)
 */
export async function getDoctorAssessments(
  doctorId: string,
  options: {
    page?: number;
    limit?: number;
    status?: AssessmentStatus;
  } = {}
) {
  const page = options.page || 1;
  const limit = options.limit || 50;
  const skip = (page - 1) * limit;

  const where: any = { doctorId };
  if (options.status) where.status = options.status;

  const [assessments, total] = await Promise.all([
    prisma.assessment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: true,
        clinic: true,
      },
    }),
    prisma.assessment.count({ where }),
  ]);

  return {
    assessments,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Submit assessment responses (questionnaire answers)
 */
export async function submitResponses(
  input: SubmitResponsesInput
): Promise<AssessmentResponse[]> {
  const assessment = await getAssessment(input.assessmentId);

  if (assessment.status !== 'PENDING') {
    throw new Error(`Cannot submit responses for assessment in status: ${assessment.status}`);
  }

  // Create response records
  const responses = await Promise.all(
    input.responses.map((r) =>
      prisma.assessmentResponse.create({
        data: {
          assessmentId: input.assessmentId,
          questionId: r.questionId,
          answer: r.answer,
        },
      })
    )
  );

  // Update assessment status to QUEUED (orchestration not yet started)
  await prisma.assessment.update({
    where: { id: input.assessmentId },
    data: { status: 'QUEUED' },
  });

  // Audit log
  await logAudit({
    action: 'RESPONSES_SUBMITTED',
    entityType: 'Assessment',
    entityId: input.assessmentId,
    metadata: {
      responseCount: responses.length,
    },
  });

  return responses;
}

/**
 * Persist AI artifact from pipeline stage
 */
export async function persistArtifact(
  input: PersistArtifactInput
): Promise<AIArtifact> {
  const artifact = await prisma.aIArtifact.create({
    data: {
      assessmentId: input.assessmentId,
      type: input.type,
      content: input.content,
      engineVersion: input.engineVersion,
      schemaVersion: input.schemaVersion,
      generationMs: input.generationMs,
    },
  });

  // Audit log
  await logAudit({
    action: 'ARTIFACT_PERSISTED',
    entityType: 'AIArtifact',
    entityId: artifact.id,
    metadata: {
      assessmentId: input.assessmentId,
      artifactType: input.type,
    },
  });

  return artifact;
}

/**
 * Get all artifacts for an assessment
 */
export async function getArtifacts(assessmentId: string, type?: ArtifactType) {
  const where: any = { assessmentId };
  if (type) where.type = type;

  return prisma.aIArtifact.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Update orchestration status and log stage progress
 */
export async function updateOrchestrationStatus(
  input: UpdateOrchestrationStatusInput
): Promise<OrchestrationLog> {
  const log = await prisma.orchestrationLog.create({
    data: {
      assessmentId: input.assessmentId,
      stage: input.stage,
      status: input.status,
      durationMs: input.durationMs,
      confidence: input.confidence,
      uncertainty: input.uncertainty,
      error: input.error,
    },
  });

  // Update assessment status based on stage completion
  if (input.status === 'COMPLETED') {
    await prisma.assessment.update({
      where: { id: input.assessmentId },
      data: {
        orchestrationStage: input.stage,
      },
    });
  }

  if (input.status === 'FAILED') {
    await prisma.assessment.update({
      where: { id: input.assessmentId },
      data: {
        status: 'FAILED',
        lastError: input.error,
      },
    });
  }

  return log;
}

/**
 * Get orchestration timeline for assessment
 */
export async function getOrchestrationTimeline(assessmentId: string) {
  return prisma.orchestrationLog.findMany({
    where: { assessmentId },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Mark assessment as completed (all stages passed)
 */
export async function completeAssessment(
  assessmentId: string,
  hasReports: boolean = false
): Promise<Assessment> {
  const status = hasReports ? 'COMPLETED' : 'PARTIAL_FAILURE';
  
  const assessment = await prisma.assessment.update({
    where: { id: assessmentId },
    data: {
      status: status as AssessmentStatus,
      completedAt: new Date(),
    },
  });

  await logAudit({
    action: 'ASSESSMENT_COMPLETED',
    entityType: 'Assessment',
    entityId: assessmentId,
    metadata: { status },
  });

  return assessment;
}

/**
 * Mark assessment as failed with error details
 */
export async function failAssessment(
  assessmentId: string,
  error: string,
  retryable: boolean = true
): Promise<Assessment> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
  });

  if (!assessment) {
    throw new Error(`Assessment not found: ${assessmentId}`);
  }

  const newRetryCount = assessment.retryCount + 1;
  const shouldFail = !retryable || newRetryCount >= 3;

  const updated = await prisma.assessment.update({
    where: { id: assessmentId },
    data: {
      status: shouldFail ? 'FAILED' : 'PENDING',
      lastError: error,
      retryCount: newRetryCount,
    },
  });

  await logAudit({
    action: 'ASSESSMENT_FAILED',
    entityType: 'Assessment',
    entityId: assessmentId,
    metadata: {
      error,
      retryable,
      retryCount: newRetryCount,
      willRetry: !shouldFail,
    },
  });

  return updated;
}

/**
 * Retry failed assessment (reset to PENDING)
 */
export async function retryAssessment(assessmentId: string): Promise<Assessment> {
  const assessment = await prisma.assessment.update({
    where: { id: assessmentId },
    data: {
      status: 'PENDING',
      lastError: null,
    },
  });

  await logAudit({
    action: 'ASSESSMENT_RETRY',
    entityType: 'Assessment',
    entityId: assessmentId,
  });

  return assessment;
}

/**
 * Store audit log for tracking changes
 */
export async function logAudit(input: {
  action: string;
  entityType: string;
  entityId: string;
  actorId?: string;
  actorType?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        actorId: input.actorId,
        actorType: input.actorType,
        metadata: input.metadata,
      },
    });
  } catch (err) {
    console.error('Failed to log audit event:', err);
    // Don't throw - audit failures shouldn't break main flow
  }
}

/**
 * Get audit trail for assessment
 */
export async function getAuditTrail(assessmentId: string) {
  return prisma.auditLog.findMany({
    where: { entityId: assessmentId },
    orderBy: { createdAt: 'asc' },
  });
}

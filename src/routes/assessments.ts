import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as assessmentService from '../services/assessmentService';
import { orchestrateAssessment, getOrchestrationStatus } from '../packages/assessment-orchestrator';
import prisma from '../prismaClient';

/**
 * Assessment API Routes
 * 
 * Handles all assessment lifecycle operations:
 * - Creation
 * - Response submission
 * - Status polling
 * - Review & approval
 * - Report delivery
 */

const router = Router();

// ============ VALIDATION SCHEMAS ============

const CreateAssessmentSchema = z.object({
  patientId: z.string().min(1),
  clinicId: z.string().min(1),
  doctorId: z.string().min(1),
  source: z.enum(['QR', 'MANUAL', 'WEB', 'WHATSAPP']).optional(),
});

const SubmitResponsesSchema = z.object({
  responses: z.array(
    z.object({
      questionId: z.string(),
      answer: z.any(),
    })
  ),
});

const ReviewAssessmentSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  notes: z.string().optional(),
  doctorId: z.string().min(1),
});

// ============ MIDDLEWARE ============

// Validation middleware
function validateRequest(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      (req as any).validated = validated;
      next();
    } catch (err: any) {
      res.status(400).json({
        error: 'validation_error',
        details: err.errors,
      });
    }
  };
}

// Error handler
function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ============ ROUTES ============

/**
 * POST /api/assessments/create
 * Create a new assessment
 */
router.post(
  '/create',
  validateRequest(CreateAssessmentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const validated = (req as any).validated;

    const assessment = await assessmentService.createAssessment({
      patientId: validated.patientId,
      clinicId: validated.clinicId,
      doctorId: validated.doctorId,
      source: validated.source || 'WEB',
    });

    res.status(201).json({
      success: true,
      assessment,
    });
  })
);

/**
 * GET /api/assessments/:id
 * Get assessment with all related data
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const assessment = await assessmentService.getAssessment(req.params.id);
    const auditTrail = await assessmentService.getAuditTrail(req.params.id);

    res.json({
      success: true,
      assessment,
      auditTrail,
    });
  })
);

/**
 * GET /api/assessments
 * List assessments for clinic or doctor
 * Query: ?clinicId=X&doctorId=Y&status=PENDING&page=1&limit=50
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { clinicId, doctorId, status, page, limit } = req.query;

    if (!clinicId) {
      return res.status(400).json({
        error: 'clinicId required',
      });
    }

    if (doctorId) {
      // Get doctor's assessments
      const result = await assessmentService.getDoctorAssessments(
        doctorId as string,
        {
          page: page ? parseInt(page as string) : 1,
          limit: limit ? parseInt(limit as string) : 50,
          status: status as any,
        }
      );
      return res.json({ success: true, ...result });
    }

    // Get clinic assessments
    const result = await assessmentService.getClinicAssessments(
      clinicId as string,
      {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 50,
        status: status as any,
        doctorId: doctorId as string,
      }
    );

    res.json({ success: true, ...result });
  })
);

/**
 * POST /api/assessments/:id/submit
 * Submit responses and start orchestration
 */
router.post(
  '/:id/submit',
  validateRequest(SubmitResponsesSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const validated = (req as any).validated;
    const assessmentId = req.params.id;

    // Convert responses array to object
    const responseMap: Record<string, any> = {};
    for (const resp of validated.responses) {
      responseMap[resp.questionId] = resp.answer;
    }

    // Submit responses
    await assessmentService.submitResponses({
      assessmentId,
      responses: validated.responses,
    });

    // Store raw response map for orchestrator then fire async
    await prisma.assessment.update({
      where: { id: assessmentId },
      data: { rawResponses: responseMap },
    });
    orchestrateAssessment(assessmentId).catch((err) =>
      console.error(`[assessments] Orchestration failed for ${assessmentId}:`, err)
    );

    res.json({
      success: true,
      assessmentId,
      status: 'QUEUED',
      message: 'Assessment submitted. Poll /status for progress.',
    });
  })
);

/**
 * GET /api/assessments/:id/status
 * Poll for orchestration progress
 */
router.get(
  '/:id/status',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await getOrchestrationStatus(req.params.id);

    if (!data.assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    res.json({
      success: true,
      ...data,
    });
  })
);

/**
 * GET /api/assessments/:id/artifacts
 * Get all persisted artifacts for assessment
 */
router.get(
  '/:id/artifacts',
  asyncHandler(async (req: Request, res: Response) => {
    const { type } = req.query;

    const artifacts = await assessmentService.getArtifacts(
      req.params.id,
      type as any
    );

    res.json({
      success: true,
      artifacts,
      count: artifacts.length,
    });
  })
);

/**
 * GET /api/assessments/:id/orchestration
 * Get orchestration timeline and logs
 */
router.get(
  '/:id/orchestration',
  asyncHandler(async (req: Request, res: Response) => {
    const timeline = await assessmentService.getOrchestrationTimeline(
      req.params.id
    );

    res.json({
      success: true,
      timeline,
      stages: timeline.map((log) => log.stage),
    });
  })
);

/**
 * POST /api/assessments/:id/review
 * Doctor review and approval (Phase 1 foundation)
 */
router.post(
  '/:id/review',
  validateRequest(ReviewAssessmentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const validated = (req as any).validated;
    const assessmentId = req.params.id;

    const assessment = await assessmentService.getAssessment(assessmentId);

    // For now, just update status
    // In Phase 2, this will trigger report generation and delivery
    const updated = await prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        status: validated.status === 'APPROVED' ? 'COMPLETED' : 'FAILED',
        orchestrationMeta: {
          ...(assessment.orchestrationMeta as Record<string, any>),
          reviewedBy: validated.doctorId,
          reviewedAt: new Date().toISOString(),
          reviewStatus: validated.status,
          reviewNotes: validated.notes,
        },
      },
    });

    await assessmentService.logAudit({
      action: 'ASSESSMENT_REVIEWED',
      entityType: 'Assessment',
      entityId: assessmentId,
      actorId: validated.doctorId,
      actorType: 'DOCTOR',
      metadata: {
        status: validated.status,
        notes: validated.notes,
      },
    });

    res.json({
      success: true,
      assessment: updated,
      message: `Assessment ${validated.status.toLowerCase()}`,
    });
  })
);

/**
 * POST /api/assessments/:id/retry
 * Retry failed assessment
 */
router.post(
  '/:id/retry',
  asyncHandler(async (req: Request, res: Response) => {
    const assessment = await assessmentService.retryAssessment(req.params.id);

    res.json({
      success: true,
      assessment,
      message: 'Assessment reset to PENDING for retry',
    });
  })
);

/**
 * GET /api/assessments/:id/audit
 * Get complete audit trail
 */
router.get(
  '/:id/audit',
  asyncHandler(async (req: Request, res: Response) => {
    const auditTrail = await assessmentService.getAuditTrail(req.params.id);

    res.json({
      success: true,
      auditTrail,
      count: auditTrail.length,
    });
  })
);

// ============ ERROR HANDLER ============

router.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Assessment API error:', err);

  if (err.message.includes('not found')) {
    return res.status(404).json({
      error: 'not_found',
      message: err.message,
    });
  }

  res.status(500).json({
    error: 'internal_error',
    message: err.message,
  });
});

export default router;

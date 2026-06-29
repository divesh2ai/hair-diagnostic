import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../prismaClient";
import { makeOrchestrator } from "../packages/consultation-orchestrator";
import { AccessContext } from "../packages/consultation-orchestrator/orchestrator";
import type { StoredVersion } from "../packages/consultation-orchestrator/ports";

const router = Router();
const orchestrator = makeOrchestrator(prisma);

// Error handler utility
function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

const ReviseSchema = z.object({
  doctorNotes: z.array(
    z.object({
      id: z.string(),
      doctorId: z.string(),
      doctorName: z.string().optional(),
      body: z.string(),
      createdAt: z.string(),
      updatedAt: z.string().optional(),
      visibleToPatient: z.boolean(),
    })
  ).optional(),
  attachments: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(["IMAGE", "PDF", "VIDEO", "LAB_REPORT", "OTHER"]),
      url: z.string(),
      label: z.string().optional(),
      uploadedAt: z.string(),
      uploadedBy: z.string(),
      sizeBytes: z.number().optional(),
      mime: z.string().optional(),
    })
  ).optional(),
  edits: z.object({
    diagnosis: z.any().optional(),
    treatmentPlan: z.any().optional(),
    followUp: z.any().optional(),
    patientEducation: z.any().optional(),
  }).optional(),
});

const ApproveSchema = z.object({
  status: z.enum(["APPROVED", "PENDING_REVIEW", "REVISION_REQUESTED", "REJECTED"]),
  notes: z.string().optional(),
});

// Context builder based on headers/mock values for Doctor role scope
function buildAccessContext(req: Request): AccessContext {
  const actorId = (req.headers["x-actor-id"] as string) || "system-doctor";
  const role = (req.headers["x-actor-role"] as string) || "DOCTOR";
  const clinicId = (req.headers["x-clinic-id"] as string) || null;

  return {
    actorId,
    role,
    clinicId,
  };
}

/**
 * GET /api/consultation/:assessmentId
 * Retrieves or composes the canonical consultation for an assessment.
 */
router.get(
  "/:assessmentId",
  asyncHandler(async (req: Request, res: Response) => {
    const { assessmentId } = req.params;
    const ctx = buildAccessContext(req);

    const stored = await orchestrator.getOrCreateDetailed({
      assessmentId,
      ctx,
    });

    res.json({
      success: true,
      consultation: stored.content,
      meta: toMeta(stored),
    });
  })
);

/**
 * POST /api/consultation/:assessmentId/revise
 * Creates a new ConsultationVersion with doctor edits or notes.
 */
router.post(
  "/:assessmentId/revise",
  asyncHandler(async (req: Request, res: Response) => {
    const { assessmentId } = req.params;
    const ctx = buildAccessContext(req);
    const parsed = ReviseSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "validation_error",
        details: parsed.error.errors,
      });
    }

    const stored = await orchestrator.revise({
      assessmentId,
      ctx,
      doctorNotes: parsed.data.doctorNotes,
      attachments: parsed.data.attachments,
      edits: parsed.data.edits,
    });

    res.json({
      success: true,
      consultation: stored.content,
      meta: toMeta(stored),
    });
  })
);

/**
 * POST /api/consultation/:assessmentId/approve
 * Approves a version of the consultation.
 */
router.post(
  "/:assessmentId/approve",
  asyncHandler(async (req: Request, res: Response) => {
    const { assessmentId } = req.params;
    const ctx = buildAccessContext(req);
    const parsed = ApproveSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "validation_error",
        details: parsed.error.errors,
      });
    }

    const stored = await orchestrator.approve({
      assessmentId,
      ctx,
      status: parsed.data.status,
      notes: parsed.data.notes,
    });

    res.json({
      success: true,
      consultation: stored.content,
      meta: toMeta(stored),
    });
  })
);

/** Approval + version metadata surfaced alongside the clinical content. */
function toMeta(stored: StoredVersion) {
  return {
    contentVersion: stored.contentVersion,
    approvalStatus: stored.metadata.approvalStatus ?? "PENDING_REVIEW",
    approvedBy: stored.metadata.approvedBy ?? null,
    approvedAt: stored.metadata.approvedAt ?? null,
    approvalNotes: stored.metadata.approvalNotes ?? null,
    lastUpdatedAt: stored.content.audit?.lastUpdatedAt ?? stored.createdAt,
  };
}

export default router;

// Doctor Clinical Validation Loop — pilot-scope audit writer.
//
// The AuditLog table already exists; this helper unifies the small set of
// pilot-critical events so every action ends up with the same shape (actor,
// clinic, entity, metadata). Callers pass a strict AuditEvent name so a typo
// can't invent a new event silently.
//
// Metadata is intentionally scrubbed at the call site — this helper does not
// enforce PII scrubbing but the shape is small and every caller in the pilot
// scope keeps to a fixed schema. NEVER put raw questionnaire answers, tokens,
// passwords, or unnecessary patient PII into `metadata`.

import type { Prisma, PrismaClient } from "@prisma/client";
import { SystemRole } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

export type AuditAction =
  | "CONSULTATION_CREATED"
  | "CLINICAL_PROCESSING_COMPLETED"
  | "CLINICAL_PROCESSING_FAILED"
  | "DOCTOR_NOTE_SAVED"
  | "CONSULTATION_UPDATED"
  | "CONSULTATION_APPROVED"
  | "CONSULTATION_NEEDS_REVISION"
  | "CONSULTATION_REJECTED"
  | "RECOMMENDATION_FEEDBACK_SUBMITTED"
  | "REPORT_GENERATION_STARTED"
  | "REPORT_GENERATION_FAILED"
  | "REPORT_RETRIED"
  | "REPORT_GENERATED"
  | "KIT_ORDER_INTENT_CREATED"
  | "KIT_ORDER_INTENT_CANCELLED"
  | "PHASE_A_RECLAIMED";

export type AuditActorType = "doctor" | "admin" | "system" | "patient";

export interface WriteAuditLogInput {
  action: AuditAction;
  entityType: string;
  entityId: string;
  actorId?: string | null;
  actorRole?: SystemRole | null;
  actorType?: AuditActorType | null;
  clinicId?: string | null;
  assessmentId?: string | null;
  /** Small structured envelope — never PII / tokens / raw answers. */
  metadata?: Record<string, unknown> | null;
  /** Overrides the Prisma client (tests). */
  prismaClient?: PrismaClient | Prisma.TransactionClient;
}

/**
 * Persist one audit row. Fire-and-forget wrappers are allowed at call sites
 * where the audit failing must not fail the request; when the caller is
 * inside a transaction, pass `prismaClient: tx` so the audit row commits
 * atomically with the state change it describes.
 */
export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  const client = (input.prismaClient ?? defaultPrisma) as PrismaClient;
  await client.auditLog.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      actorType: input.actorType ?? null,
      assessmentId: input.assessmentId ?? null,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

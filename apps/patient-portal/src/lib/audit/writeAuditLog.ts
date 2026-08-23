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
  | "PHASE_A_RECLAIMED"
  | "DOCTOR_INVITATION_CREATED"
  | "DOCTOR_INVITATION_RESENT"
  | "DOCTOR_INVITATION_CANCELLED"
  | "DOCTOR_INVITATION_EXPIRED"
  /**
   * A clinical record was opened for review. Reads were previously unaudited,
   * so a super admin viewing a patient's consultation through a Doctor
   * identity left no trace — the one access a compliance reviewer most needs
   * to find. Written fire-and-forget: never on the critical path.
   */
  | "CLINICAL_RECORD_VIEWED"
  /**
   * Super Admin console mutations. Every one of these was previously silent:
   * a Super Admin could create, reconfigure, suspend or archive a tenant and
   * leave no trace at all, which made the audit log blind to the most
   * privileged actor on the platform. CLINIC_ARCHIVED is the sharpest of the
   * set — it soft-deletes an entire tenant.
   *
   * These rows are written on the request path (awaited, not fire-and-forget):
   * an admin mutation that cannot be attributed should fail rather than
   * silently succeed unrecorded.
   */
  | "CLINIC_CREATED"
  | "CLINIC_UPDATED"
  | "CLINIC_SUSPENDED"
  | "CLINIC_ACTIVATED"
  | "CLINIC_ARCHIVED"
  | "CLINIC_LOCATION_CREATED"
  | "CLINIC_LOCATION_UPDATED"
  | "CLINIC_LOCATION_DELETED"
  | "PLATFORM_SETTINGS_UPDATED"
  /**
   * A Super Admin downloaded the platform-wide kit order intent workbook.
   *
   * This is a bulk privileged read that crosses every tenant boundary at
   * once, so it is audited like a mutation and the export FAILS CLOSED: if
   * the audit row cannot be written the workbook is not returned. A
   * privileged cross-tenant export that leaves no trace is precisely what an
   * audit log exists to prevent.
   *
   * Metadata carries the filter envelope and row count only — never the
   * exported contents, and never a patient identifier.
   */
  | "ADMIN_ORDER_EXPORT";

/**
 * `admin_view` is a distinct actor type, not a synonym for `admin`: it marks a
 * super admin reading a clinic's consultation across the tenant boundary,
 * which is the access an audit reader most needs to be able to pick out. The
 * consultation routes have been writing it since they were built — it was
 * simply missing from this union, so every one of those call sites was a type
 * error (harmless at runtime, since AuditLog.actorType is a plain String).
 */
export type AuditActorType =
  | "doctor"
  | "admin"
  | "admin_view"
  | "system"
  | "patient";

export interface WriteAuditLogInput {
  action: AuditAction;
  entityType: string;
  entityId: string;
  actorId?: string | null;
  actorRole?: SystemRole | null;
  actorType?: AuditActorType | null;
  /**
   * NOT PERSISTED. `AuditLog` has no clinicId column — the audit reader
   * derives clinic through `assessment.clinic`, so only assessment-linked
   * rows carry a clinic. This field is accepted for call-site readability and
   * silently dropped by the writer below.
   *
   * Consequence for admin mutations: a clinic create / suspend / archive has
   * no assessment, so it cannot be linked to a clinic at all under the
   * current schema, and shows "—" in the audit page's Clinic column. Admin
   * callers therefore repeat the clinic id + slug inside `metadata` so the
   * row is still searchable. Fixing this properly needs an AuditLog.clinicId
   * column, which is a schema change and out of scope here.
   */
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

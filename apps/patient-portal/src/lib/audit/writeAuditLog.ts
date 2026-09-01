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

// The action names themselves now live in ./actions as a runtime array, so the
// audit console can render a picker from them and the API can tell an unknown
// action apart from a genuinely quiet one. The semantics of the sharper events
// are documented below; the list itself is in that file.
//
//   CLINICAL_RECORD_VIEWED
//     A clinical record was opened for review. Reads were previously
//     unaudited, so a super admin viewing a patient's consultation through a
//     Doctor identity left no trace — the one access a compliance reviewer
//     most needs to find. Written fire-and-forget: never on the critical path.
//
//   CLINIC_* / PLATFORM_SETTINGS_UPDATED
//     Super Admin console mutations. Every one of these was previously silent:
//     a Super Admin could create, reconfigure, suspend or archive a tenant and
//     leave no trace at all. CLINIC_ARCHIVED is the sharpest of the set — it
//     soft-deletes an entire tenant. Written on the request path (awaited): an
//     admin mutation that cannot be attributed should fail rather than
//     silently succeed unrecorded.
//
//   ADMIN_ORDER_EXPORT / AUDIT_LOG_EXPORTED
//     Bulk privileged reads that cross every tenant boundary at once, so they
//     are audited like mutations and FAIL CLOSED: if the audit row cannot be
//     written the export is not returned. A privileged cross-tenant export
//     that leaves no trace is precisely what an audit log exists to prevent.
//     AUDIT_LOG_EXPORTED covers the audit console's own CSV — the one export
//     that reveals the platform's complete activity history.
//
//   DOCTOR_ORDER_SUMMARY_EXPORT
//     A clinic-scoped download, so not a cross-tenant read like the two above
//     — but it carries patient-level clinical context, so it is recorded.
//
//   PATIENT_REPORT_SHARED / PATIENT_CART_SHARED
//     A clinician deliberately sending clinical information to a patient's
//     phone. Metadata carries the subject and a short token fingerprint —
//     never the token, never the phone number, never the link.
export type { AuditAction } from "./actions";
import type { AuditAction } from "./actions";

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

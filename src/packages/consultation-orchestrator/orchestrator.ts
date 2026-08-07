// ConsultationOrchestrator — the ONLY supported entry point for getting,
// creating, or revising a Consultation. UI surfaces, the PDF pipeline, the
// video pipeline, and future EMR integrations must all consume from here so
// the clinical content stays identical across surfaces.
//
// Business logic lives in the domain layer (buildConsultation + the clinical
// engines). The orchestrator coordinates services: validate -> load inputs ->
// compose -> persist immutable version -> emit events -> return.

import type { PatientAnswers } from "../types";
import { buildConsultation } from "./domain/buildConsultation";
import type { Consultation, DoctorNote, ConsultationAttachment } from "@shared/types/consultation";
import { contentHash } from "./versioning/contentHash";
import {
  evaluateClinicalReadinessForApproval,
  type ReadinessDecision,
} from "@shared/clinical-readiness/evaluator";
import type {
  ApprovalStatus,
  AssessmentLoader,
  ClinicBrandingLoader,
  ConsultationRepo,
  DoctorPreferencesLoader,
  EventBus,
  OrgDefaultsLoader,
  PreviousConsultationsLoader,
  StoredVersion,
} from "./ports";

export interface OrchestratorDeps {
  assessments: AssessmentLoader;
  branding: ClinicBrandingLoader;
  doctorPrefs: DoctorPreferencesLoader;
  orgDefaults: OrgDefaultsLoader;
  previousConsultations: PreviousConsultationsLoader;
  repo: ConsultationRepo;
  bus: EventBus;
}

export interface AccessContext {
  /** Auth-derived caller identity, used for createdBy + audit. */
  actorId: string;
  /** Auth-derived role; orchestrator uses it for permission gates. */
  role: string;
  /** Clinic the caller belongs to. Null/undefined = super-admin. */
  clinicId: string | null;
}

export interface GetOrCreateInput {
  assessmentId: string;
  ctx: AccessContext;
}

export interface ReviseInput {
  assessmentId: string;
  ctx: AccessContext;
  /** Doctor-authored notes appended to the version. */
  doctorNotes?: DoctorNote[];
  /** Attachments to attach to the new version. */
  attachments?: ConsultationAttachment[];
  /**
   * Optional partial override of the composed Consultation. Whitelisted to
   * fields a doctor may edit; other keys are ignored. The orchestrator
   * recomposes from the engines first, then merges these overrides on top.
   */
  edits?: Partial<Pick<Consultation, "diagnosis" | "treatmentPlan" | "followUp" | "patientEducation">>;
  /**
   * When provided, the revise call fails with "invalid" if the current
   * persisted version has advanced past this number. The doctor UI sends
   * the version it loaded so that a colleague's concurrent edit cannot be
   * silently overwritten by a stale draft. Optional so scripted / migration
   * callers can still no-op recompose.
   */
  expectedContentVersion?: number;
}

export class ConsultationOrchestrator {
  constructor(private readonly deps: OrchestratorDeps) {}

  /**
   * Return the current persisted Consultation for the assessment, composing
   * + persisting it on first read. Idempotent — repeated calls return the
   * same version unless the upstream engines produce different content.
   */
  async getOrCreate(input: GetOrCreateInput): Promise<Consultation> {
    return (await this.getOrCreateDetailed(input)).content;
  }

  /**
   * Like getOrCreate, but returns the full StoredVersion so callers (the API
   * layer, audit views) can surface approval + version metadata alongside the
   * clinical content without a second round-trip.
   */
  async getOrCreateDetailed(input: GetOrCreateInput): Promise<StoredVersion> {
    const existing = await this.deps.repo.getLatestByAssessment(input.assessmentId);
    if (existing) {
      this.assertCanRead(existing, input.ctx);
      return existing;
    }
    return this.composeAndStore(input);
  }

  /**
   * Force-compose a new consultation (or first version) from the engines and
   * persist it. Used internally by getOrCreate and by the assessment pipeline
   * when a new assessment completes.
   */
  async create(input: GetOrCreateInput): Promise<Consultation> {
    return (await this.composeAndStore(input)).content;
  }

  private async composeAndStore(input: GetOrCreateInput): Promise<StoredVersion> {
    const a = await this.deps.assessments.load(input.assessmentId);
    if (!a) throw new OrchestratorError("not_found", `Assessment ${input.assessmentId} not found`);
    this.assertCanReadClinic(a.clinicId, input.ctx);

    const [branding, doctorPrefs, orgDefaults, prevs] = await Promise.all([
      this.deps.branding.load(a.clinicId),
      this.deps.doctorPrefs.load(a.reviewingDoctorId),
      this.deps.orgDefaults.load(a.clinicId),
      this.deps.previousConsultations.load(a.patientId, a.id),
    ]);

    const budgetTier = doctorPrefs?.budgetTier ?? orgDefaults.defaultBudgetTier;

    const composed = buildConsultation({
      patient: a.patient,
      assessment: {
        id: a.id,
        submittedAt: a.submittedAt,
        rawAnswers: a.rawAnswers,
        source: a.source,
      },
      answers: a.rawAnswers as unknown as PatientAnswers,
      evidence: {
        previousConsultationIds: prevs.map((p) => p.id),
      },
      budgetTier,
      actorId: input.ctx.actorId,
    });

    const decorated = applyBranding(composed, branding);
    const hash = contentHash(decorated);

    const stored = await this.deps.repo.createWithInitialVersion({
      assessmentId: a.id,
      clinicId: a.clinicId,
      patientId: a.patientId,
      content: decorated,
      contentHash: hash,
      engineVersions: decorated.version.engines as unknown as Record<string, string>,
      actorId: input.ctx.actorId,
      events: [
        {
          type: "CONSULTATION_CREATED",
          consultationId: "__pending__",
          occurredAt: new Date().toISOString(),
          actorId: input.ctx.actorId,
          payload: {
            assessmentId: a.id,
            clinicId: a.clinicId,
            patientId: a.patientId,
            contentVersion: 1,
          },
        },
        {
          type: "RAG_INDEX_REQUESTED",
          consultationId: "__pending__",
          occurredAt: new Date().toISOString(),
          actorId: input.ctx.actorId,
          payload: { reason: "CREATED" },
        },
      ],
    });

    // Dispatch out-of-band so the request returns quickly. Failures here
    // never roll back the persisted version; they're retried from the outbox.
    void this.deps.bus.dispatchPending(stored.consultationId).catch(() => {});

    return stored;
  }

  /**
   * Append a new immutable version reflecting the doctor's edits. No-op if
   * the recomposed content is byte-identical to the current version.
   */
  async revise(input: ReviseInput): Promise<StoredVersion> {
    const existing = await this.deps.repo.getLatestByAssessment(input.assessmentId);
    if (!existing) {
      throw new OrchestratorError(
        "not_found",
        `No consultation exists for assessment ${input.assessmentId}; call getOrCreate first`,
      );
    }
    this.assertCanRead(existing, input.ctx);
    this.assertCanRevise(input.ctx);

    if (
      typeof input.expectedContentVersion === "number" &&
      input.expectedContentVersion !== existing.contentVersion
    ) {
      throw new OrchestratorError(
        "invalid",
        `Consultation has advanced past version ${input.expectedContentVersion}; latest is ${existing.contentVersion}`,
      );
    }

    const base = existing.content;
    const next: Consultation = {
      ...base,
      ...(input.edits ?? {}),
      doctorNotes: input.doctorNotes ?? base.doctorNotes,
      attachments: input.attachments ?? base.attachments,
      version: {
        ...base.version,
        contentVersion: existing.contentVersion + 1,
      },
      audit: {
        ...base.audit,
        lastUpdatedAt: new Date().toISOString(),
        lastUpdatedBy: input.ctx.actorId,
        events: [
          ...base.audit.events,
          { at: new Date().toISOString(), by: input.ctx.actorId, kind: "EDITED" },
        ],
      },
    };

    // Hash only the clinical content (diagnosis, treatmentPlan, notes, etc.),
    // excluding the `audit` block which always changes (timestamps, event list).
    // This ensures a no-op revise() is correctly detected as byte-identical
    // even though audit.lastUpdatedAt would differ.
    const clinicalContent = (c: Consultation) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { audit: _audit, ...rest } = c;
      return rest;
    };
    const hash = contentHash(clinicalContent(next));
    if (hash === contentHash(clinicalContent({ ...base, version: { ...base.version, contentVersion: existing.contentVersion + 1 } }))) {
      // Clinical content unchanged — skip creating a new version.
      return existing;
    }

    const stored = await this.deps.repo.appendVersion({
      consultationId: existing.consultationId,
      content: next,
      contentHash: hash,
      engineVersions: next.version.engines as unknown as Record<string, string>,
      actorId: input.ctx.actorId,
      events: [
        {
          // Doctor edits are edits, not approvals. Approval-only side effects
          // (patient notify, RAG index of approved content) must be driven by
          // CONSULTATION_APPROVED emitted from approve() and nowhere else.
          type: "CONSULTATION_UPDATED",
          consultationId: existing.consultationId,
          occurredAt: new Date().toISOString(),
          actorId: input.ctx.actorId,
          payload: {
            kind: "DOCTOR_EDIT",
            doctorId: input.ctx.actorId,
            previousVersion: existing.contentVersion,
            nextVersion: existing.contentVersion + 1,
            changedFields: Object.keys(input.edits ?? {}),
          },
        },
        {
          type: "RAG_INDEX_REQUESTED",
          consultationId: existing.consultationId,
          occurredAt: new Date().toISOString(),
          actorId: input.ctx.actorId,
          payload: { reason: "REVISED" },
        },
      ],
    });

    void this.deps.bus.dispatchPending(stored.consultationId).catch(() => {});

    return stored;
  }

  /**
   * Set approval status for the current version. Doctor approves the
   * patient-facing version here; only APPROVED versions should be surfaced
   * to patients.
   */
  async approve(input: {
    assessmentId: string;
    ctx: AccessContext;
    status: ApprovalStatus;
    notes?: string;
    /**
     * When provided (e.g. from the WhatsApp review-token flow, where the
     * reviewer opened a specific snapshot of the report), we refuse to
     * approve a later version the reviewer has never seen. Doctor-dashboard
     * approvals omit this — they always mean "approve current latest".
     */
    expectedContentVersion?: number;
    /**
     * Senior-doctor override of the clinical-readiness gate. Accepts a typed
     * clinical justification. STRICT LIMIT: an override may bypass reasoning
     * gaps ONLY — never grounding violations, nor a missing/malformed
     * snapshot. A grounding violation is a hard safety stop no clinician
     * signs past, and a missing snapshot means the content was never
     * validated at all. Enforced server-side here so no client can widen it.
     */
    readinessOverride?: { reason: string };
  }): Promise<StoredVersion> {
    const existing = await this.deps.repo.getLatestByAssessment(input.assessmentId);
    if (!existing) {
      throw new OrchestratorError(
        "not_found",
        `No consultation exists for assessment ${input.assessmentId}`,
      );
    }
    this.assertCanRead(existing, input.ctx);
    this.assertCanRevise(input.ctx);

    // Stale-version guard for token-scoped approvals. A newer draft exists
    // that the reviewer never saw — surface it rather than silently blessing
    // content the sender didn't intend.
    if (
      typeof input.expectedContentVersion === "number" &&
      input.expectedContentVersion !== existing.contentVersion
    ) {
      throw new OrchestratorError(
        "invalid",
        `Consultation has advanced past version ${input.expectedContentVersion}; latest is ${existing.contentVersion}`,
      );
    }

    // Assessment-state guard. Approval only makes sense once the clinical
    // pipeline has produced something to approve. Reject non-terminal /
    // still-processing / FAILED cases so a doctor can't sign off on content
    // that doesn't exist yet or that the pipeline aborted on.
    const a = await this.deps.assessments.load(input.assessmentId);
    if (a && a.status && !APPROVABLE_ASSESSMENT_STATUSES.has(a.status)) {
      throw new OrchestratorError(
        "invalid",
        `Assessment status ${a.status} is not eligible for approval`,
      );
    }

    // Clinical readiness guard. Only enforced on the APPROVED transition —
    // requesting revisions or rejecting a consultation must remain possible
    // precisely because the readiness snapshot is non-empty. The evaluator
    // fails closed for historical / malformed snapshots.
    let overrideRecord: {
      reason: string;
      reasoningGapCount: number;
      overriddenBy: string;
      at: string;
    } | null = null;
    if (input.status === "APPROVED") {
      const readiness = evaluateClinicalReadinessForApproval(existing.content);
      if (!readiness.ready) {
        // A senior doctor may sign past a reasoning gap with a typed
        // justification — but ONLY reasoning gaps, and never via a synthetic
        // token-reviewer identity. Grounding violations and missing/malformed
        // snapshots are hard stops that no override widens.
        const reasoningGapsOnly =
          readiness.groundingViolationCount === 0 &&
          readiness.reasoningGapCount > 0 &&
          readiness.blockingCodes.every((c) => c === "REASONING_GAP_PRESENT");
        const reason = input.readinessOverride?.reason?.trim() ?? "";
        const overrideEligible =
          reasoningGapsOnly &&
          reason.length >= MIN_READINESS_OVERRIDE_REASON &&
          input.ctx.role.toUpperCase() !== "TOKEN_REVIEWER";

        if (!overrideEligible) {
          throw new ReadinessBlockedError(readiness);
        }
        overrideRecord = {
          reason,
          reasoningGapCount: readiness.reasoningGapCount,
          overriddenBy: input.ctx.actorId,
          at: new Date().toISOString(),
        };
      }
    }

    // Idempotency: same status + same approver against the same version is a
    // no-op. Prevents duplicate CONSULTATION_APPROVED on double-click / retry
    // from the WhatsApp review link. We compare current metadata, not the
    // request body, so a genuine status change (APPROVED → REJECTED) still
    // goes through.
    if (
      existing.metadata.approvalStatus === input.status &&
      existing.metadata.approvedBy === input.ctx.actorId
    ) {
      return existing;
    }

    const stored = await this.deps.repo.setApproval({
      consultationId: existing.consultationId,
      contentVersion: existing.contentVersion,
      status: input.status,
      approverId: input.ctx.actorId,
      notes: input.notes,
      events:
        input.status === "APPROVED"
          ? [
              {
                type: "CONSULTATION_APPROVED",
                consultationId: existing.consultationId,
                occurredAt: new Date().toISOString(),
                actorId: input.ctx.actorId,
                payload: {
                  approvedBy: input.ctx.actorId,
                  notes: input.notes,
                  // When present, this approval bypassed the readiness gate
                  // via an explicit doctor override — kept on the immutable
                  // event so the audit trail records who signed past what.
                  ...(overrideRecord ? { readinessOverride: overrideRecord } : {}),
                },
              },
            ]
          : [],
    });

    void this.deps.bus.dispatchPending(stored.consultationId).catch(() => {});
    return stored;
  }

  // ── Permissions ──────────────────────────────────────────────────────────

  private assertCanRead(v: StoredVersion, ctx: AccessContext) {
    if (isSuperAdmin(ctx.role)) return;
    if (!ctx.clinicId) {
      throw new OrchestratorError("forbidden", "Missing clinic context");
    }
    if (v.clinicId !== ctx.clinicId) {
      throw new OrchestratorError("forbidden", "Cross-clinic access denied");
    }
  }

  private assertCanReadClinic(clinicId: string, ctx: AccessContext) {
    if (isSuperAdmin(ctx.role)) return;
    if (ctx.clinicId !== clinicId) {
      throw new OrchestratorError("forbidden", "Cross-clinic access denied");
    }
  }

  private assertCanRevise(ctx: AccessContext) {
    if (!REVISE_ROLES.has(ctx.role.toUpperCase())) {
      throw new OrchestratorError("forbidden", `Role ${ctx.role} cannot revise consultations`);
    }
  }
}

// TOKEN_REVIEWER is the synthetic role we mint for the signed-token WhatsApp
// review flow (/api/review/[token]). The token itself is HMAC-signed by the
// server, so anyone holding one has already been vouched for by us; we still
// route approvals through the same orchestrator boundary so the audit trail,
// event emission, and stale-version guard stay identical to dashboard
// approvals.
const REVISE_ROLES = new Set([
  "SUPER_ADMIN",
  "ORG_ADMIN",
  "CLINIC_ADMIN",
  "DOCTOR",
  "TOKEN_REVIEWER",
]);

// Assessment statuses under which approving the consultation is meaningful.
// Anything else (still-processing, failed) is refused so nobody signs off on
// content the pipeline hasn't produced or has abandoned.
const APPROVABLE_ASSESSMENT_STATUSES = new Set([
  "CLINICAL_READY",
  "REPORT_GENERATING",
  "COMPLETED",
  "PARTIAL_FAILURE",
]);

// A readiness override must carry a substantive clinical justification —
// not "ok" or a stray keystroke. Mirrors the doctor-note minimum intent.
const MIN_READINESS_OVERRIDE_REASON = 10;

function isSuperAdmin(role: string): boolean {
  return role.toUpperCase() === "SUPER_ADMIN";
}

function applyBranding(c: Consultation, branding: { name: string } | null): Consultation {
  if (!branding) return c;
  // Branding is presentation-only and doesn't change clinical content. We
  // stash it under a non-clinical extension so renderers can read it without
  // touching the engine pipeline.
  const extended = c as Consultation & { branding?: { clinicName: string } };
  extended.branding = { clinicName: branding.name };
  return extended;
}

export class OrchestratorError extends Error {
  constructor(public readonly code: "not_found" | "forbidden" | "invalid", message: string) {
    super(message);
    this.name = "OrchestratorError";
  }
}

// Distinct error class so route handlers can return a stable 422 and a
// structured payload without string-matching messages. Carries the full
// decision so the doctor UI can render violations without a second fetch;
// callers are responsible for stripping detail before sending to a
// patient-scoped surface (use toPatientSafeReadinessDecision).
export class ReadinessBlockedError extends Error {
  public readonly code = "readiness_blocked" as const;
  constructor(public readonly decision: ReadinessDecision) {
    super(decision.doctorSummary);
    this.name = "ReadinessBlockedError";
  }
}

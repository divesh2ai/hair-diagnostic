// Ports — the orchestrator depends only on these interfaces. Concrete
// Prisma-backed adapters live in ./infra. Tests and the sandbox can swap in
// in-memory implementations without touching the orchestration code.

import type { Consultation } from "@shared/types/consultation";
import type { ConsultationEvent } from "./events/types";

export interface AssessmentLoad {
  id: string;
  clinicId: string;
  patientId: string;
  submittedAt: string;
  source: string;
  rawAnswers: Record<string, unknown>;
  patient: {
    id: string;
    name: string;
    age: number;
    sex: string;
    phone: string | null;
    email: string | null;
  };
  reviewingDoctorId: string | null;
}

export interface DoctorPreferences {
  doctorId: string;
  preferredLanguage: string;
  budgetTier: "ESSENTIAL" | "STANDARD" | "COMPREHENSIVE";
  notes?: string;
}

export interface ClinicBranding {
  clinicId: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  tagline: string | null;
  footerText: string | null;
  pdfBranding: Record<string, unknown> | null;
  reportBranding: Record<string, unknown> | null;
}

export interface OrgDefaults {
  organizationId: string | null;
  defaultLanguage: string;
  defaultBudgetTier: "ESSENTIAL" | "STANDARD" | "COMPREHENSIVE";
}

export type ApprovalStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REVISION_REQUESTED"
  | "REJECTED";

// Provenance + approval metadata stored alongside each immutable version.
// Provenance fields are null for purely deterministic engine output (no LLM
// in the loop today); they're plumbed through so future RAG/LLM compositions
// are auditable from day one without another migration.
export interface VersionMetadata {
  llmModel?: string | null;
  promptVersion?: string | null;
  knowledgeBaseVersion?: string | null;
  approvalStatus?: ApprovalStatus;
  approvedBy?: string | null;
  approvedAt?: string | null;
  approvalNotes?: string | null;
}

export interface StoredVersion {
  id: string;
  consultationId: string;
  contentVersion: number;
  content: Consultation;
  contentHash: string;
  createdAt: string;
  createdBy: string;
  metadata: VersionMetadata;
}

export interface AssessmentLoader {
  load(assessmentId: string): Promise<AssessmentLoad | null>;
}

export interface DoctorPreferencesLoader {
  load(doctorId: string | null): Promise<DoctorPreferences | null>;
}

export interface ClinicBrandingLoader {
  load(clinicId: string): Promise<ClinicBranding | null>;
}

export interface OrgDefaultsLoader {
  load(clinicId: string): Promise<OrgDefaults>;
}

export interface PreviousConsultationsLoader {
  load(patientId: string, excludeAssessmentId: string): Promise<{ id: string }[]>;
}

export interface ConsultationRepo {
  /** Latest persisted version, or null if no consultation exists yet. */
  getLatestByAssessment(assessmentId: string): Promise<StoredVersion | null>;

  /** A specific version (for audit/diff views). */
  getVersion(consultationId: string, contentVersion: number): Promise<StoredVersion | null>;

  /**
   * Create the consultation row + version 1 + initial events in a single tx.
   * Idempotent: if a consultation already exists for the assessment, this
   * returns the latest version instead of inserting a duplicate.
   */
  createWithInitialVersion(args: {
    assessmentId: string;
    clinicId: string;
    patientId: string;
    content: Consultation;
    contentHash: string;
    engineVersions: Record<string, string>;
    metadata?: VersionMetadata;
    actorId: string;
    events: ConsultationEvent[];
  }): Promise<StoredVersion>;

  /**
   * Append an immutable version and atomically advance currentVersionId.
   * No-op (returns latest) if contentHash matches the current version.
   */
  appendVersion(args: {
    consultationId: string;
    content: Consultation;
    contentHash: string;
    engineVersions: Record<string, string>;
    metadata?: VersionMetadata;
    actorId: string;
    events: ConsultationEvent[];
  }): Promise<StoredVersion>;

  /**
   * Mark a specific version APPROVED (or REVISION_REQUESTED / REJECTED).
   * The version row itself is still immutable in content; only the approval
   * state mutates. Emits CONSULTATION_APPROVED.
   */
  setApproval(args: {
    consultationId: string;
    contentVersion: number;
    status: ApprovalStatus;
    approverId: string;
    notes?: string;
    events: ConsultationEvent[];
  }): Promise<StoredVersion>;
}

export interface EventBus {
  /** Dispatch persisted PENDING events. Implementations decide sync vs async. */
  dispatchPending(consultationId: string): Promise<void>;
}

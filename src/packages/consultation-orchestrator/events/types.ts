// Domain event shapes emitted by the ConsultationOrchestrator.
//
// Every downstream side-effect (PDF, video, RAG indexing, notifications)
// should originate from an event — never from a direct call inside the
// orchestrator. The orchestrator's only job is to compose a Consultation,
// persist it, and announce what happened.

export type ConsultationEventType =
  | "CONSULTATION_CREATED"
  | "CONSULTATION_UPDATED"
  | "CONSULTATION_APPROVED"
  | "DOCTOR_REVIEW_COMPLETED"
  | "REPORT_GENERATED"
  | "PDF_GENERATED"
  | "VIDEO_GENERATION_REQUESTED"
  | "VIDEO_GENERATED"
  | "RAG_INDEX_REQUESTED"
  | "PATIENT_NOTIFICATION_REQUESTED"
  | "PATIENT_NOTIFIED"
  | "FOLLOWUP_CREATED";

interface BaseEvent<T extends ConsultationEventType, P> {
  type: T;
  consultationId: string;
  consultationVersionId?: string;
  occurredAt: string;
  actorId: string;
  payload: P;
}

export type ConsultationCreated = BaseEvent<
  "CONSULTATION_CREATED",
  { assessmentId: string; clinicId: string; patientId: string; contentVersion: number }
>;

export type ConsultationUpdated = BaseEvent<
  "CONSULTATION_UPDATED",
  {
    kind: "DOCTOR_EDIT" | "SYSTEM_REGENERATE";
    doctorId?: string;
    previousVersion: number;
    nextVersion: number;
    changedFields: string[];
  }
>;

export type DoctorReviewCompleted = BaseEvent<
  "DOCTOR_REVIEW_COMPLETED",
  { decision: "APPROVED" | "EDITS_REQUESTED" | "REJECTED"; doctorId: string; notes?: string }
>;

export type ReportGenerated = BaseEvent<
  "REPORT_GENERATED",
  { reportArtifactId: string }
>;

export type PdfGenerated = BaseEvent<
  "PDF_GENERATED",
  { patientPdfUrl: string; doctorPdfUrl?: string }
>;

export type VideoGenerationRequested = BaseEvent<
  "VIDEO_GENERATION_REQUESTED",
  { variant: "AVATAR" | "EXPLAINER"; locale: string }
>;

export type RAGIndexRequested = BaseEvent<
  "RAG_INDEX_REQUESTED",
  { reason: "CREATED" | "REVISED" }
>;

export type PatientNotificationRequested = BaseEvent<
  "PATIENT_NOTIFICATION_REQUESTED",
  { channel: "WHATSAPP" | "EMAIL" | "SMS" | "IN_APP"; templateKey: string }
>;

export type ConsultationApproved = BaseEvent<
  "CONSULTATION_APPROVED",
  { approvedBy: string; notes?: string }
>;

export type VideoGenerated = BaseEvent<
  "VIDEO_GENERATED",
  { variant: "AVATAR" | "EXPLAINER"; locale: string; videoUrl: string; durationSeconds?: number }
>;

export type PatientNotified = BaseEvent<
  "PATIENT_NOTIFIED",
  { channel: "WHATSAPP" | "EMAIL" | "SMS" | "IN_APP"; templateKey: string; messageId?: string }
>;

export type FollowupCreated = BaseEvent<
  "FOLLOWUP_CREATED",
  { followupId: string; scheduledFor: string; cadence: string }
>;

export type ConsultationEvent =
  | ConsultationCreated
  | ConsultationUpdated
  | ConsultationApproved
  | DoctorReviewCompleted
  | ReportGenerated
  | PdfGenerated
  | VideoGenerationRequested
  | VideoGenerated
  | RAGIndexRequested
  | PatientNotificationRequested
  | PatientNotified
  | FollowupCreated;

// Public surface of the consultation-orchestrator package.

export {
  ConsultationOrchestrator,
  OrchestratorError,
  ReadinessBlockedError,
} from "./orchestrator";
export type {
  AccessContext,
  GetOrCreateInput,
  ReviseInput,
  OrchestratorDeps,
} from "./orchestrator";

export { buildConsultation } from "./domain/buildConsultation";
export type { BuildConsultationInput } from "./domain/buildConsultation";

export { contentHash } from "./versioning/contentHash";

export type { ConsultationEvent, ConsultationEventType } from "./events/types";
export { buildDefaultHandlers } from "./events/handlers";
export type { HandlerMap, EventHandler } from "./events/handlers";

export type {
  ApprovalStatus,
  AssessmentLoader,
  ClinicBrandingLoader,
  ConsultationRepo,
  DoctorPreferencesLoader,
  EventBus,
  OrgDefaultsLoader,
  PreviousConsultationsLoader,
  StoredVersion,
  VersionMetadata,
} from "./ports";

export { prismaConsultationRepo } from "./infra/prismaRepo";
export { prismaOutboxBus } from "./infra/outboxBus";
export {
  prismaAssessmentLoader,
  prismaClinicBrandingLoader,
  prismaDoctorPreferencesLoader,
  prismaOrgDefaultsLoader,
  prismaPreviousConsultationsLoader,
} from "./infra/loaders";

export { makeOrchestrator } from "./factory";

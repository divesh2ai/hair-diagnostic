// ─── Narrative Engine — Public API ───────────────────────────────────────────

// Pipeline entry point
export { narrativePipeline, NarrativePipelineError } from './narrativePipeline';

// Individual builders (for composable use)
export { buildDoctorReport } from './buildDoctorReport';
export { buildPatientReport } from './buildPatientReport';
export { buildPDFPayload } from './buildPDFPayload';
export { build3DAvatarScript } from './build3DAvatarScript';
export { buildDoctorDashboardCard } from './buildDoctorDashboardCard';
export { buildWhatsAppSummary } from './buildWhatsAppSummary';
export { buildPrognosisNarrative, buildTherapyExplanations, buildFollowupPlan } from './buildFinalNarrative';

// Doctor consultation (5-chapter runtime-agnostic script — the new primary
// experience; replaces the cinematic avatar script as the consultation source
// of truth, though build3DAvatarScript stays for legacy callers).
export {
  buildDoctorConsultation,
  validateDoctorConsultation,
  CONSULTATION_CHAPTER_ORDER,
  CONSULTATION_SCRIPT_VERSION,
  type DoctorConsultationScript,
  type ConsultationChapter,
  type ConsultationChapterId,
  type ConsultationGreeting,
  type ConsultationClosing,
  type ConsultationContext,
  type ConsultationLanguage,
  type ConsultationMetadata,
  type FollowUpPrompt,
  type GestureCategory,
  type BuildDoctorConsultationOptions,
} from './consultation';

// Types
export type {
  NarrativePipelineInput,
  NarrativePipelineOutput,
  DoctorReport,
  PatientReport,
  PDFPayload,
  PDFSection,
  PDFTable,
  PDFIngredientCard,
  PDFChartData,
  AvatarScript,
  AvatarScene,
  AvatarDialogueSegment,
  AvatarEmotion,
  DoctorDashboardCard,
  WhatsAppSummary,
  NarrativeSection,
  TimelineEvent,
  TherapyExplanation,
  KitNarrative,
  PrognosisNarrative,
  RecoveryExpectation,
  FollowupPlan,
  FollowupPriority,
  EducationalInsight,
  ConfidenceExplanation,
  NarrativeMetadata,
  NarrativeLength,
  NarrativeTarget,
  NarrativeTone,
  ValidationResult,
  IngredientHighlight,
} from './types';

// Validators
export { validateNarrativeContext } from './validators/validateNarrativeContext';
export { validatePDFPayload } from './validators/validatePDFPayload';
export { validateAvatarScript } from './validators/validateAvatarScript';

// Mappers (for advanced / composable use)
export { mapClinicalToNarrative } from './mappers/mapClinicalToNarrative';
export { mapSeverityToTone } from './mappers/mapSeverityToTone';
export { mapTherapyToTimeline, mapTherapyToClinicianTimeline } from './mappers/mapTherapyToTimeline';
export { mapConditionToEducation } from './mappers/mapConditionToEducation';
export { mapKitToNarrativeBundle } from './mappers/mapKitToNarrativeBundle';

// Formatters (for advanced use)
export { formatTimelineAsMarkdown, formatTimelineAsBullets, formatTimelineForPDF } from './formatters/formatTimeline';
export { formatMarkdownBullets, formatBoldBullets, formatWhatsAppBullets, formatSectionBlock } from './formatters/formatBulletList';
export { formatAvatarSpeech } from './formatters/formatAvatarSpeech';

// Constants
export {
  DIAGNOSIS_LABELS,
  RECOVERY_WINDOWS,
  ROOT_CAUSE_LABELS,
  THERAPY_NEED_LABELS,
  THERAPY_NEED_PATIENT_LABELS,
  SEVERITY_CLINICAL_LABELS,
  MEDICAL_DISCLAIMERS,
  PATIENT_DISCLAIMERS,
  PIPELINE_VERSION,
} from './constants';

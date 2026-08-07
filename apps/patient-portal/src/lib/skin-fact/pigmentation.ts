import protocolJson from '@hairos/packages/ai-engine/questionnaire-engine/schema/skin-pigmentation.schema.json';
import { emptySkinCommonAnswers, isValidSkinCommonProfile, skinCommonStorageKey, skinConcernDraftKey, type SkinCommonAnswers, type SkinCommonProfile } from './skinJourney';

export const PIGMENTATION_PROTOCOL = protocolJson;
export const PIGMENTATION_PROTOCOL_ID = 'skin-pigmentation';
export const PIGMENTATION_PROTOCOL_VERSION = '1.0.0';
export const COMMON_INTAKE_VERSION = '2.0.0';

export type ConsultationStatus = 'REQUIRED' | 'SCHEDULING_PENDING' | 'SCHEDULED' | 'COMPLETED' | 'RESCHEDULE_REQUIRED';
export type UploadView = 'FRONT' | 'LEFT' | 'RIGHT' | 'BODY' | 'PRESCRIPTION';

export interface StorageReference {
  kind: 'supabase_storage';
  bucket: 'clinical-images';
  path: string;
  sessionId: string;
  questionId: string;
  view: UploadView;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export type CommonIntakeAnswers = SkinCommonAnswers;
export type CommonIntakeState = SkinCommonProfile;

export type PigmentationAnswers = Record<string, string | string[] | StorageReference | Record<string, StorageReference> | undefined>;
export interface PigmentationDraft {
  productType: 'SKIN_FACT'; concernType: 'PIGMENTATION'; protocolId: 'skin-pigmentation';
  protocolVersion: '1.0.0'; clinicSlug: string; sessionId: string; commonIntakeId: string; skinIntakeId: string; selectedConcernCount: number;
  stepId: string; answers: PigmentationAnswers;
}

export const emptyCommonAnswers = emptySkinCommonAnswers;

export function commonStorageKey(clinicSlug: string) { return skinCommonStorageKey(clinicSlug); }
export function pigmentationStorageKey(clinicSlug: string, intakeId = 'legacy') { return skinConcernDraftKey('PIGMENTATION', clinicSlug, intakeId); }
export function createSessionId() { return crypto.randomUUID(); }

export function isValidCommonState(value: unknown, clinicSlug: string): value is CommonIntakeState {
  return isValidSkinCommonProfile(value, clinicSlug);
}

export function isValidPigmentationDraft(value: unknown, clinicSlug: string): value is PigmentationDraft {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<PigmentationDraft>;
  return v.productType === 'SKIN_FACT' && v.concernType === 'PIGMENTATION' && v.protocolId === PIGMENTATION_PROTOCOL_ID && v.protocolVersion === PIGMENTATION_PROTOCOL_VERSION && v.clinicSlug === clinicSlug && typeof v.sessionId === 'string' && typeof v.commonIntakeId === 'string' && typeof v.skinIntakeId === 'string' && typeof v.selectedConcernCount === 'number' && !!v.answers;
}

export function hasProductSelection(answer: unknown) {
  return Array.isArray(answer) && answer.some((value) => value !== 'none');
}

export function visiblePigmentationStepIds(answers: PigmentationAnswers): string[] {
  const ids = ['PIG_01', 'PIG_02', 'PIG_03'];
  if (answers.PIG_03 === 'yes' || answers.PIG_03 === 'unsure') ids.push('PIG_04');
  ids.push('PIG_05');
  if (hasProductSelection(answers.PIG_05)) ids.push('PIG_06');
  ids.push('PIG_07', 'PIG_08', 'PIG_09', 'PIG_11');
  if (answers.PIG_11 === 'yes') ids.push('PIG_12', 'PIG_13');
  ids.push('PIG_14', 'PIG_15', 'REVIEW');
  return ids;
}

export const FACIAL_LOCATIONS = new Set(['forehead', 'temples', 'periorbital', 'cheeks', 'perioral', 'chin']);
export function requiredImageViews(answers: PigmentationAnswers): UploadView[] {
  const locations = Array.isArray(answers.PIG_02) ? answers.PIG_02 : [];
  const views: UploadView[] = [];
  if (locations.some((value) => FACIAL_LOCATIONS.has(value))) views.push('FRONT', 'LEFT', 'RIGHT');
  if (locations.includes('body_other')) views.push('BODY');
  return views;
}

export function pruneHiddenPigmentationAnswers(input: PigmentationAnswers): PigmentationAnswers {
  const next = { ...input };
  // Remove the retired HairOS/dandruff field from rehydrated legacy drafts.
  delete next.PIG_10;
  if (next.PIG_03 !== 'yes' && next.PIG_03 !== 'unsure') delete next.PIG_04;
  if (!hasProductSelection(next.PIG_05)) delete next.PIG_06;
  if (next.PIG_07 !== 'yes') delete next.PIG_07_MEDICATION_DETAILS;
  if (next.PIG_08 !== 'yes') delete next.PIG_08_MEDICAL_HISTORY_DETAILS;
  if (next.PIG_11 !== 'yes') { delete next.PIG_12; delete next.PIG_12_OTHER_TREATMENT; delete next.PIG_13; delete next.PIG_13_PRESCRIPTION; }
  if (!Array.isArray(next.PIG_12) || !next.PIG_12.includes('other_treatment')) delete next.PIG_12_OTHER_TREATMENT;
  if (!Array.isArray(next.PIG_02) || !next.PIG_02.includes('body_other')) delete next.PIG_02_BODY_LOCATION;
  if (next.PIG_13 !== 'upload') delete next.PIG_13_PRESCRIPTION;
  return next;
}

export function buildPigmentationSubmission(common: CommonIntakeState, draft: PigmentationDraft) {
  const pigmentation = pruneHiddenPigmentationAnswers(draft.answers);
  const acneHistory = pigmentation.PIG_09;
  return {
    name: common.answers.name,
    age: Number(common.answers.age),
    sex: common.answers.gender,
    __meta: {
      productType: 'SKIN_FACT', concernType: 'PIGMENTATION', concern: 'skin_pigmentation',
      protocolId: PIGMENTATION_PROTOCOL_ID, protocolVersion: PIGMENTATION_PROTOCOL_VERSION,
      commonIntakeVersion: COMMON_INTAKE_VERSION, clinicSlug: common.clinicSlug,
      commonIntakeId: common.sessionId, skinIntakeId: draft.skinIntakeId, skinConcernCount: draft.selectedConcernCount, assessmentSessionId: draft.sessionId, consultationStatus: 'REQUIRED',
      ...(acneHistory && acneHistory !== 'no_acne_history' ? { linkedConcern: 'ACNE_HISTORY' } : {}),
    },
    commonInitial: common.answers,
    pigmentation: { ...pigmentation, consultationStatus: 'REQUIRED' },
  };
}


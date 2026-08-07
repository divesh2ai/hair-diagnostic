import protocolJson from '@hairos/packages/ai-engine/questionnaire-engine/schema/skin-anti-ageing.schema.json';
import {
  skinCommonStorageKey,
  type SkinCommonProfile,
} from './skinJourney';

export const ANTI_AGEING_PROTOCOL = protocolJson;
export const ANTI_AGEING_PROTOCOL_ID = 'skin-anti-ageing';
export const ANTI_AGEING_PROTOCOL_VERSION = '1.0.0';
export const ANTI_AGEING_STATUS = 'PENDING_REVIEW';

export type AntiAgeingUploadView = 'FRONT' | 'LEFT' | 'RIGHT' | 'DOCUMENT';
export interface AntiAgeingStorageReference {
  kind: 'supabase_storage';
  bucket: 'clinical-images';
  path: string;
  sessionId: string;
  questionId: string;
  view: AntiAgeingUploadView;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export type AntiAgeingAnswer =
  | string
  | string[]
  | AntiAgeingStorageReference[]
  | Record<string, AntiAgeingStorageReference>
  | undefined;
export type AntiAgeingAnswers = Record<string, AntiAgeingAnswer>;

export interface AntiAgeingDraft {
  productType: 'SKIN_FACT';
  concernType: 'ANTI_AGEING';
  protocolId: 'skin-anti-ageing';
  protocolVersion: '1.0.0';
  clinicSlug: string;
  patientSessionId: string;
  commonIntakeId: string;
  skinIntakeId: string;
  selectedConcernCount: number;
  stepId: string;
  answers: AntiAgeingAnswers;
}

export function antiAgeingStorageKey(clinicSlug: string) {
  return `drfact:skin-fact:anti-ageing:${clinicSlug}`;
}

export function commonStorageKey(clinicSlug: string) {
  return skinCommonStorageKey(clinicSlug);
}

export function isValidAntiAgeingDraft(
  value: unknown,
  clinicSlug: string,
  patientSessionId?: string,
  skinIntakeId?: string,
): value is AntiAgeingDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<AntiAgeingDraft>;
  return draft.productType === 'SKIN_FACT'
    && draft.concernType === 'ANTI_AGEING'
    && draft.protocolId === ANTI_AGEING_PROTOCOL_ID
    && draft.protocolVersion === ANTI_AGEING_PROTOCOL_VERSION
    && draft.clinicSlug === clinicSlug
    && typeof draft.patientSessionId === 'string'
    && (!patientSessionId || draft.patientSessionId === patientSessionId)
    && typeof draft.skinIntakeId === 'string'
    && (!skinIntakeId || draft.skinIntakeId === skinIntakeId)
    && typeof draft.commonIntakeId === 'string'
    && typeof draft.selectedConcernCount === 'number'
    && !!draft.answers;
}

export function hasSelection(value: unknown) {
  return Array.isArray(value) && value.some((item) => item !== 'none');
}

export function toggleExclusiveSelection(
  current: string[],
  value: string,
  exclusiveValue?: string,
) {
  if (current.includes(value)) return current.filter((item) => item !== value);
  if (exclusiveValue && value === exclusiveValue) return [value];
  return [...current.filter((item) => item !== exclusiveValue), value];
}

export function visibleAntiAgeingStepIds(answers: AntiAgeingAnswers) {
  const ids = ['AA_01'];
  if (Array.isArray(answers.AA_01) && answers.AA_01.includes('other')) ids.push('AA_01A');
  ids.push('AA_02', 'AA_03', 'AA_04');
  if (hasSelection(answers.AA_04)) ids.push('AA_05');
  ids.push('AA_06');
  if (answers.AA_06 === 'yes') ids.push('AA_06A');
  ids.push('AA_07');
  if (answers.AA_07 === 'yes') {
    ids.push('AA_08');
    if (Array.isArray(answers.AA_08) && answers.AA_08.includes('other')) ids.push('AA_08A');
  }
  ids.push('AA_09', 'AA_10', 'AA_11');
  if (hasSelection(answers.AA_11)) ids.push('AA_12');
  ids.push('AA_13');
  return ids;
}

export const requiredAntiAgeingImageViews = ['FRONT', 'LEFT', 'RIGHT'] as const;

export function pruneHiddenAntiAgeingAnswers(input: AntiAgeingAnswers) {
  const next = { ...input };
  if (!Array.isArray(next.AA_01) || !next.AA_01.includes('other')) delete next.AA_01A;
  if (!hasSelection(next.AA_04)) delete next.AA_05;
  if (next.AA_06 !== 'yes') delete next.AA_06A;
  if (next.AA_07 !== 'yes') {
    delete next.AA_08;
    delete next.AA_08A;
  } else if (!Array.isArray(next.AA_08) || !next.AA_08.includes('other')) {
    delete next.AA_08A;
  }
  if (!hasSelection(next.AA_11)) delete next.AA_12;
  return next;
}

export function containsInlineBinary(value: unknown) {
  return /data:(?:image|application)\//i.test(JSON.stringify(value))
    || /"base64"/i.test(JSON.stringify(value));
}

export function buildAntiAgeingSubmission(common: SkinCommonProfile, draft: AntiAgeingDraft) {
  const antiAgeing = pruneHiddenAntiAgeingAnswers(draft.answers);
  if (containsInlineBinary(antiAgeing)) throw new Error('Inline image or document data is not allowed.');
  return {
    name: common.answers.name,
    age: Number(common.answers.age),
    sex: common.answers.gender,
    __meta: {
      productType: 'SKIN_FACT',
      concernType: 'ANTI_AGEING',
      concern: 'skin_anti_ageing',
      protocolId: ANTI_AGEING_PROTOCOL_ID,
      protocolVersion: ANTI_AGEING_PROTOCOL_VERSION,
      status: ANTI_AGEING_STATUS,
      clinicSlug: common.clinicSlug,
      commonIntakeId: common.sessionId,
      skinIntakeId: draft.skinIntakeId,
      assessmentSessionId: draft.patientSessionId,
      skinConcernCount: draft.selectedConcernCount,
    },
    commonInitial: common.answers,
    antiAgeing: {
      ...antiAgeing,
      reviewStatus: ANTI_AGEING_STATUS,
    },
  };
}

import { describe, expect, it } from 'vitest';
import {
  PIGMENTATION_PROTOCOL, PIGMENTATION_PROTOCOL_ID, buildPigmentationSubmission,
  commonStorageKey, isValidCommonState, isValidPigmentationDraft, pigmentationStorageKey,
  pruneHiddenPigmentationAnswers, requiredImageViews,
  visiblePigmentationStepIds, type CommonIntakeState, type PigmentationDraft,
} from '../../apps/patient-portal/src/lib/skin-fact/pigmentation';

const common: CommonIntakeState={productType:'SKIN_FACT',intakeType:'COMMON',version:'2.0.0',clinicSlug:'drfact-mumbai',sessionId:'00000000-0000-4000-8000-000000000001',completedAt:'2026-07-28T00:00:00.000Z',answers:{name:'Ananya Sharma',age:'32',gender:'Female',skinType:'Combination',sensitiveSkin:'No'}};
const draft=(answers:Record<string,any>={}):PigmentationDraft=>({productType:'SKIN_FACT',concernType:'PIGMENTATION',protocolId:'skin-pigmentation',protocolVersion:'1.0.0',clinicSlug:'drfact-mumbai',sessionId:'00000000-0000-4000-8000-000000000002',commonIntakeId:common.sessionId,skinIntakeId:'intake-123',selectedConcernCount:2,stepId:'PIG_01',answers});

describe('Skin FACT common intake isolation',()=>{
 it('uses clinic-scoped Skin FACT keys, never HairOS',()=>{expect(commonStorageKey('a')).toBe('drfact:skin-fact:common:a');expect(pigmentationStorageKey('a','intake')).toBe('drfact:skin-fact:pigmentation:a:intake');expect(commonStorageKey('a')).not.toContain('hair-os')});
 it('rehydrates only compatible clinic state',()=>{expect(isValidCommonState(common,'drfact-mumbai')).toBe(true);expect(isValidCommonState(common,'other')).toBe(false);expect(isValidCommonState({...common,productType:'HAIR_OS'},'drfact-mumbai')).toBe(false)});
});

describe('independent pigmentation protocol',()=>{
 it('has independent typed metadata and 14 source questions',()=>{expect(PIGMENTATION_PROTOCOL_ID).toBe('skin-pigmentation');expect(PIGMENTATION_PROTOCOL.protocolId).not.toBe('skin-acne');expect(PIGMENTATION_PROTOCOL.questions).toHaveLength(14)});
 it('begins with duration and contains only concern-specific question IDs',()=>{expect(PIGMENTATION_PROTOCOL.questions[0].id).toBe('PIG_01');expect(PIGMENTATION_PROTOCOL.questions[0].title).toBe('How long have you had pigmentation?');expect(PIGMENTATION_PROTOCOL.questions.every((question)=>question.id.startsWith('PIG_'))).toBe(true)});
 it('keeps common intake identity outside Pigmentation answers',()=>{const value=draft({PIG_01:'less_than_6_months'});expect(value.commonIntakeId).toBe(common.sessionId);expect(value.answers).not.toHaveProperty('name');expect(value.answers).not.toHaveProperty('skinType')});
 it('rehydrates only Pigmentation state for the same clinic and version',()=>{const value=draft();expect(isValidPigmentationDraft(value,'drfact-mumbai')).toBe(true);expect(isValidPigmentationDraft({...value,concernType:'ACNE'},'drfact-mumbai')).toBe(false);expect(isValidPigmentationDraft(value,'another-clinic')).toBe(false)});
 it('shows sun pattern only for yes or unsure',()=>{expect(visiblePigmentationStepIds({PIG_03:'yes'})).toContain('PIG_04');expect(visiblePigmentationStepIds({PIG_03:'unsure'})).toContain('PIG_04');expect(visiblePigmentationStepIds({PIG_03:'no'})).not.toContain('PIG_04')});
 it('shows product names only for a selected product',()=>{expect(visiblePigmentationStepIds({PIG_05:['skin_lightening_cream']})).toContain('PIG_06');expect(visiblePigmentationStepIds({PIG_05:['none']})).not.toContain('PIG_06')});
 it('shows previous-care branches only after Yes',()=>{expect(visiblePigmentationStepIds({PIG_11:'yes'})).toEqual(expect.arrayContaining(['PIG_12','PIG_13']));expect(visiblePigmentationStepIds({PIG_11:'no'})).not.toContain('PIG_12')});
 it('calculates facial and body image requirements independently',()=>{expect(requiredImageViews({PIG_02:['cheeks']})).toEqual(['FRONT','LEFT','RIGHT']);expect(requiredImageViews({PIG_02:['body_other']})).toEqual(['BODY']);expect(requiredImageViews({PIG_02:['cheeks','body_other']})).toEqual(['FRONT','LEFT','RIGHT','BODY'])});
 it('removes hidden stale answers before submission',()=>{const clean=pruneHiddenPigmentationAnswers({PIG_03:'no',PIG_04:'regular_outdoor',PIG_05:['none'],PIG_06:'old',PIG_07:'no',PIG_07_MEDICATION_DETAILS:'old',PIG_11:'no',PIG_12:['laser_treatment'],PIG_13:'upload',PIG_13_PRESCRIPTION:{kind:'supabase_storage'} as any});expect(clean).not.toHaveProperty('PIG_04');expect(clean).not.toHaveProperty('PIG_06');expect(clean).not.toHaveProperty('PIG_07_MEDICATION_DETAILS');expect(clean).not.toHaveProperty('PIG_12');expect(clean).not.toHaveProperty('PIG_13_PRESCRIPTION')});
 it('submits typed Skin FACT metadata and never base64',()=>{const payload=buildPigmentationSubmission(common,draft({PIG_09:'previous_acne',PIG_14:{FRONT:{kind:'supabase_storage',bucket:'clinical-images',path:'sessions/x/front.jpg'}} as any}));expect(payload.__meta).toMatchObject({productType:'SKIN_FACT',concernType:'PIGMENTATION',concern:'skin_pigmentation',commonIntakeId:common.sessionId,skinIntakeId:'intake-123',linkedConcern:'ACNE_HISTORY',consultationStatus:'REQUIRED'});expect(JSON.stringify(payload)).not.toMatch(/base64|data:image/);expect(payload.pigmentation.consultationStatus).toBe('REQUIRED')});
 it('omits the removed dandruff field from legacy drafts and submission',()=>{const payload=buildPigmentationSubmission(common,draft({PIG_10:'yes'}));expect(payload.pigmentation).not.toHaveProperty('PIG_10')});
});

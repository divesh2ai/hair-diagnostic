import { describe, expect, it } from 'vitest';
import {
  ANTI_AGEING_PROTOCOL, ANTI_AGEING_PROTOCOL_ID, ANTI_AGEING_PROTOCOL_VERSION,
  antiAgeingStorageKey, buildAntiAgeingSubmission, containsInlineBinary,
  hasSelection, isValidAntiAgeingDraft, pruneHiddenAntiAgeingAnswers,
  requiredAntiAgeingImageViews, toggleExclusiveSelection, visibleAntiAgeingStepIds,
  type AntiAgeingDraft,
} from '../../apps/patient-portal/src/lib/skin-fact/antiAgeing';
import type { SkinCommonProfile } from '../../apps/patient-portal/src/lib/skin-fact/skinJourney';

const common:SkinCommonProfile={productType:'SKIN_FACT',intakeType:'COMMON',version:'2.0.0',clinicSlug:'drfact-mumbai',sessionId:'patient-1',completedAt:'2026-07-29T00:00:00.000Z',answers:{name:'Ananya Sharma',age:'44',gender:'Female',skinType:'Combination',sensitiveSkin:'No'}};
const draft=(answers:Record<string,any>={}):AntiAgeingDraft=>({productType:'SKIN_FACT',concernType:'ANTI_AGEING',protocolId:'skin-anti-ageing',protocolVersion:'1.0.0',clinicSlug:'drfact-mumbai',patientSessionId:'patient-1',commonIntakeId:'patient-1',skinIntakeId:'intake-1',selectedConcernCount:1,stepId:'AA_01',answers});

describe('Anti-Ageing protocol isolation and metadata',()=>{
  it('01 uses the dedicated protocol ID',()=>expect(ANTI_AGEING_PROTOCOL_ID).toBe('skin-anti-ageing'));
  it('02 uses protocol version 1.0.0',()=>expect(ANTI_AGEING_PROTOCOL_VERSION).toBe('1.0.0'));
  it('03 declares Skin FACT product type',()=>expect(ANTI_AGEING_PROTOCOL.productType).toBe('SKIN_FACT'));
  it('04 declares Anti-Ageing concern type',()=>expect(ANTI_AGEING_PROTOCOL.concernType).toBe('ANTI_AGEING'));
  it('05 contains fifteen protocol question nodes',()=>expect(ANTI_AGEING_PROTOCOL.questions).toHaveLength(15));
  it('06 contains only AA question IDs',()=>expect(ANTI_AGEING_PROTOCOL.questions.every((q)=>q.id.startsWith('AA_'))).toBe(true));
  it('07 keeps the final review separate from questions',()=>expect(ANTI_AGEING_PROTOCOL.review.id).toBe('AA_13'));
  it('08 defaults submission to pending review',()=>expect(ANTI_AGEING_PROTOCOL.submission.status).toBe('PENDING_REVIEW'));
  it('09 disables patient-facing diagnosis',()=>expect(ANTI_AGEING_PROTOCOL.submission.patientFacingDiagnosis).toBe(false));
  it('10 disables patient-facing recommendations',()=>expect(ANTI_AGEING_PROTOCOL.submission.patientFacingRecommendations).toBe(false));
  it('11 uses the exact isolated clinic key',()=>expect(antiAgeingStorageKey('drfact-mumbai')).toBe('drfact:skin-fact:anti-ageing:drfact-mumbai'));
  it('12 storage key does not use HairOS',()=>expect(antiAgeingStorageKey('x')).not.toMatch(/hair/i));
  it('13 storage key does not use Acne',()=>expect(antiAgeingStorageKey('x')).not.toMatch(/acne/i));
  it('14 storage key does not use Pigmentation',()=>expect(antiAgeingStorageKey('x')).not.toMatch(/pigmentation/i));
});

describe('Anti-Ageing branching and exclusion rules',()=>{
  it('15 starts with AA-01',()=>expect(visibleAntiAgeingStepIds({})[0]).toBe('AA_01'));
  it('16 shows AA-01A for another concern',()=>expect(visibleAntiAgeingStepIds({AA_01:['other']})).toContain('AA_01A'));
  it('17 hides AA-01A otherwise',()=>expect(visibleAntiAgeingStepIds({AA_01:['fine_lines']})).not.toContain('AA_01A'));
  it('18 shows product names for products',()=>expect(visibleAntiAgeingStepIds({AA_04:['sunscreen']})).toContain('AA_05'));
  it('19 hides product names for none',()=>expect(visibleAntiAgeingStepIds({AA_04:['none']})).not.toContain('AA_05'));
  it('20 shows medical details for yes',()=>expect(visibleAntiAgeingStepIds({AA_06:'yes'})).toContain('AA_06A'));
  it('21 hides medical details for no',()=>expect(visibleAntiAgeingStepIds({AA_06:'no'})).not.toContain('AA_06A'));
  it('22 shows previous treatments for yes',()=>expect(visibleAntiAgeingStepIds({AA_07:'yes'})).toContain('AA_08'));
  it('23 hides previous treatments for no',()=>expect(visibleAntiAgeingStepIds({AA_07:'no'})).not.toContain('AA_08'));
  it('24 shows other treatment details conditionally',()=>expect(visibleAntiAgeingStepIds({AA_07:'yes',AA_08:['other']})).toContain('AA_08A'));
  it('25 shows educational video interest for selected topics',()=>expect(visibleAntiAgeingStepIds({AA_11:['microneedling']})).toContain('AA_12'));
  it('26 hides video interest when none is exclusive',()=>expect(visibleAntiAgeingStepIds({AA_11:['none']})).not.toContain('AA_12'));
  it('27 always ends at AA-13 review',()=>expect(visibleAntiAgeingStepIds({}).at(-1)).toBe('AA_13'));
  it('28 none removes other selected values',()=>expect(toggleExclusiveSelection(['sunscreen'],'none','none')).toEqual(['none']));
  it('29 a regular choice removes none',()=>expect(toggleExclusiveSelection(['none'],'retinoid','none')).toEqual(['retinoid']));
  it('30 detects meaningful selections',()=>expect(hasSelection(['none','sunscreen'])).toBe(true));
});

describe('Anti-Ageing identity, uploads and submission safety',()=>{
  it('31 validates matching clinic, patient and intake identity',()=>expect(isValidAntiAgeingDraft(draft(),'drfact-mumbai','patient-1','intake-1')).toBe(true));
  it('32 rejects another patient session',()=>expect(isValidAntiAgeingDraft(draft(),'drfact-mumbai','patient-2','intake-1')).toBe(false));
  it('33 rejects another intake',()=>expect(isValidAntiAgeingDraft(draft(),'drfact-mumbai','patient-1','intake-2')).toBe(false));
  it('34 requires exactly front, left and right views',()=>expect(requiredAntiAgeingImageViews).toEqual(['FRONT','LEFT','RIGHT']));
  it('35 prunes hidden stale answers and emits review-only metadata',()=>{
    const clean=pruneHiddenAntiAgeingAnswers({AA_01:['fine_lines'],AA_01A:'old',AA_04:['none'],AA_05:'old',AA_06:'no',AA_06A:'old',AA_07:'no',AA_08:['laser_or_light'],AA_08A:'old',AA_11:['none'],AA_12:'yes'});
    expect(clean).not.toHaveProperty('AA_01A');expect(clean).not.toHaveProperty('AA_05');expect(clean).not.toHaveProperty('AA_06A');expect(clean).not.toHaveProperty('AA_08');expect(clean).not.toHaveProperty('AA_12');
    const payload=buildAntiAgeingSubmission(common,draft({AA_01:['fine_lines'],AA_02:'moderate',AA_10:{FRONT:{kind:'supabase_storage',bucket:'clinical-images',path:'sessions/front.jpg'}} as any}));
    expect(payload.__meta).toMatchObject({productType:'SKIN_FACT',concernType:'ANTI_AGEING',concern:'skin_anti_ageing',protocolId:'skin-anti-ageing',status:'PENDING_REVIEW',skinIntakeId:'intake-1'});
    expect(payload.antiAgeing.reviewStatus).toBe('PENDING_REVIEW');expect(containsInlineBinary(payload)).toBe(false);expect(JSON.stringify(payload)).not.toMatch(/diagnosis|prescription|recommendation/i);
  });
});

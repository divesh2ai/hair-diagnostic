import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildAssessmentResponseRows, withConcernMetadata } from '../../apps/patient-portal/src/app/api/assessment/submit/persistence';
import { adaptProtocol } from '../../apps/patient-portal/src/runtime/protocolAdapter';
import { getProtocolForConcern, loadProtocol } from '../../apps/patient-portal/src/runtime/protocolLoader';
import { isQuestionVisible } from '../../apps/patient-portal/src/runtime/visibilityEngine';
import { skinAcneProtocol } from '../../src/packages/ai-engine/questionnaire-engine/protocol/skinAcneProtocol';

function question(id: string) {
  const found = getProtocolForConcern('skin_acne').find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Missing acne question: ${id}`);
  return found;
}

describe('skin protocol loading and adapter parsing', () => {
  it('loads the acne protocol without changing the default hair protocol', () => {
    const skin = loadProtocol('default', undefined, 'skin_acne');
    const hair = loadProtocol();

    expect(skin.questions[0]?.id).toBe('age');
    expect(skin.questions.some((item) => item.id === 'acne_photos')).toBe(true);
    expect(skin.questions.some((item) => item.id === 'prescription_upload')).toBe(true);
    expect(hair.questions.some((item) => item.id === 'acne_photos')).toBe(false);
  });

  it('adapts skin sections, upload types, options, and show conditions', () => {
    const adapted = adaptProtocol(skinAcneProtocol);
    const upload = adapted.find((item) => item.id === 'acne_photos');
    const medicines = adapted.find((item) => item.id === 'current_medicines_list');

    expect(upload).toMatchObject({
      category: 'skin_safety_uploads',
      type: 'image_upload',
      required: false,
    });
    expect(medicines?.showIf).toEqual({
      questionId: 'current_medicines',
      value: 'Yes',
    });
  });
});

describe('skin conditional visibility', () => {
  it('shows the menstrual question only for Female', () => {
    const menstrual = question('menstrual_cycle_regular');
    expect(isQuestionVisible(menstrual, { sex: 'Female' })).toBe(true);
    expect(isQuestionVisible(menstrual, { sex: 'Male' })).toBe(false);
    expect(isQuestionVisible(menstrual, {})).toBe(false);
  });

  it('shows medicine detail only after Yes', () => {
    const detail = question('current_medicines_list');
    expect(isQuestionVisible(detail, { current_medicines: 'Yes' })).toBe(true);
    expect(isQuestionVisible(detail, { current_medicines: 'No' })).toBe(false);
  });

  it('shows every previous-treatment follow-up only after Yes', () => {
    for (const id of [
      'prev_treatments_tried',
      'prev_treatment_prescribed',
      'prev_treatment_outcome',
    ]) {
      expect(isQuestionVisible(question(id), { prev_treatment_taken: 'Yes' })).toBe(true);
      expect(isQuestionVisible(question(id), { prev_treatment_taken: 'No' })).toBe(false);
    }
  });

  it('shows allergy details only after Yes', () => {
    const detail = question('allergies_list');
    expect(isQuestionVisible(detail, { allergies_present: 'Yes' })).toBe(true);
    expect(isQuestionVisible(detail, { allergies_present: 'No' })).toBe(false);
    expect(isQuestionVisible(detail, { allergies_present: 'Not sure' })).toBe(false);
  });
});

describe('concern persistence and rehydration', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('persists concern, current step, and answers and restores the acne protocol', async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
      removeItem: (key: string) => void values.delete(key),
      clear: () => values.clear(),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() { return values.size; },
    };
    vi.stubGlobal('localStorage', storage);

    const firstModule = await import('../../apps/patient-portal/src/stores/useAssessmentStore');
    const firstStore = firstModule.useAssessmentStore;
    const acne = getProtocolForConcern('skin_acne');
    firstStore.getState().setConcern('skin_acne', acne);
    firstStore.getState().setAnswer('age', 29);
    firstStore.getState().goToStep(5);

    const saved = JSON.parse(storage.getItem('drfact-assessment-storage') ?? '{}');
    expect(saved.state).toMatchObject({
      concern: 'skin_acne',
      currentStepIndex: 5,
      answers: { age: 29 },
    });

    vi.resetModules();
    const restoredModule = await import('../../apps/patient-portal/src/stores/useAssessmentStore');
    await restoredModule.useAssessmentStore.persist.rehydrate();
    const restored = restoredModule.useAssessmentStore.getState();
    expect(restored.concern).toBe('skin_acne');
    expect(restored.currentStepIndex).toBe(5);
    expect(restored.answers.age).toBe(29);
    expect(restored.protocol?.some((item) => item.id === 'acne_photos')).toBe(true);
  });
});

describe('submission metadata filtering', () => {
  it('stores concern under rawResponses metadata but omits metadata rows', () => {
    const rawResponses = withConcernMetadata(
      { age: 29, sex: 'Female', __meta: { sessionId: 'session-1' } },
      'skin_acne',
    );
    const rows = buildAssessmentResponseRows('assessment-1', rawResponses);

    expect(rawResponses.__meta).toEqual({
      sessionId: 'session-1',
      concern: 'skin_acne',
    });
    expect(rows.map((row) => row.questionId)).toEqual(['age', 'sex']);
    expect(rows.some((row) => row.questionId === '__meta')).toBe(false);
  });
});
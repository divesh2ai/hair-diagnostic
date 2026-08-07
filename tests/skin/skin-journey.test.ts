import { describe, expect, it } from 'vitest';
import {
  SKIN_CONCERN_ORDER,
  concernRoute,
  createSkinFactIntake,
  markConcernComplete,
  migrateSelectedConcerns,
  nextIncompleteConcern,
  normalizeSkinConcerns,
  skinConcernDraftKey,
  type SkinConcern,
} from '../../apps/patient-portal/src/lib/skin-fact/skinJourney';

describe('Skin FACT multi-concern selection', () => {
  it.each([
    [['ACNE'], ['ACNE']],
    [['ACNE', 'PIGMENTATION'], ['ACNE', 'PIGMENTATION']],
    [['ACNE', 'PIGMENTATION', 'ANTI_AGEING'], [...SKIN_CONCERN_ORDER]],
  ])('supports valid selection %j', (input, expected) => {
    expect(normalizeSkinConcerns(input)).toEqual(expected);
  });

  it('deduplicates concerns and excludes Hair Loss', () => {
    expect(normalizeSkinConcerns(['PIGMENTATION', 'HAIR_LOSS', 'PIGMENTATION', 'ACNE']))
      .toEqual(['ACNE', 'PIGMENTATION']);
  });

  it('migrates old primary and additional concern fields', () => {
    expect(migrateSelectedConcerns({ primaryConcern: 'PIGMENTATION', additionalConcern: 'ACNE' }))
      .toEqual(['ACNE', 'PIGMENTATION']);
  });

  it('migrates old additionalConcerns arrays and removes duplicates', () => {
    expect(migrateSelectedConcerns({
      primaryConcern: 'ACNE',
      additionalConcerns: ['PIGMENTATION', 'ACNE', 'ANTI_AGEING'],
    })).toEqual(['ACNE', 'PIGMENTATION', 'ANTI_AGEING']);
  });

  it('requires at least one concern', () => {
    expect(() => createSkinFactIntake('clinic', 'session', [])).toThrow(
      'Select at least one concern to continue.',
    );
  });

  it.each([
    [['ACNE'], 'ACNE'],
    [['PIGMENTATION'], 'PIGMENTATION'],
    [['ANTI_AGEING'], 'ANTI_AGEING'],
    [['ACNE', 'ANTI_AGEING'], 'ACNE'],
    [['PIGMENTATION', 'ANTI_AGEING'], 'PIGMENTATION'],
  ] as [SkinConcern[], SkinConcern][])('starts the first selected concern for %j', (selected, first) => {
    const intake = createSkinFactIntake('clinic', 'session', selected);
    expect(intake.selectedConcerns[intake.currentConcernIndex]).toBe(first);
    expect(concernRoute('clinic', first)).toContain(first.toLowerCase().replace('_', '-'));
  });

  it('runs all concerns in deterministic order and preserves completed concerns', () => {
    let intake = createSkinFactIntake('clinic', 'session', ['ANTI_AGEING', 'PIGMENTATION', 'ACNE']);
    expect(intake.selectedConcerns).toEqual(['ACNE', 'PIGMENTATION', 'ANTI_AGEING']);
    intake = markConcernComplete(intake, 'ACNE', 'assessment-acne');
    expect(nextIncompleteConcern(intake)).toBe('PIGMENTATION');
    intake = markConcernComplete(intake, 'PIGMENTATION', 'assessment-pigmentation');
    expect(nextIncompleteConcern(intake)).toBe('ANTI_AGEING');
    intake = markConcernComplete(intake, 'ANTI_AGEING', 'assessment-anti-ageing');
    expect(nextIncompleteConcern(intake)).toBeNull();
    expect(intake.status).toBe('SUBMITTED');
    expect(intake.assessmentIds).toEqual({
      ACNE: 'assessment-acne',
      PIGMENTATION: 'assessment-pigmentation',
      ANTI_AGEING: 'assessment-anti-ageing',
    });
  });

  it('isolates concern draft namespaces under one intake id', () => {
    const keys = SKIN_CONCERN_ORDER.map((concern) =>
      skinConcernDraftKey(concern, 'clinic', 'intake-123'));
    expect(new Set(keys).size).toBe(3);
    expect(keys.every((key) => key.includes('intake-123'))).toBe(true);
  });
});

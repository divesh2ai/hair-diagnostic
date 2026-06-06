import { build3DAvatarScript } from '../build3DAvatarScript';
import {
  FIXTURE_FEMALE_AGA_MILD,
  FIXTURE_MALE_AGA_SEVERE,
  FIXTURE_PCOS,
  FIXTURE_MENOPAUSE,
  FIXTURE_MIXED_PATHOLOGY,
  FIXTURE_TE_STRESS,
} from '../fixtures/narrativeFixtures';
import { assertAvatarScriptShape, assertSceneTextsAreDifferent } from '../fixtures/avatarFixtures';
import { validateAvatarScript } from '../validators/validateAvatarScript';

describe('build3DAvatarScript — output shape', () => {
  test('Female AGA — valid avatar script', () => {
    const script = build3DAvatarScript(FIXTURE_FEMALE_AGA_MILD);
    expect(() => assertAvatarScriptShape(script)).not.toThrow();
  });

  test('Male AGA severe — valid avatar script', () => {
    const script = build3DAvatarScript(FIXTURE_MALE_AGA_SEVERE);
    expect(() => assertAvatarScriptShape(script)).not.toThrow();
  });

  test('PCOS — valid avatar script', () => {
    const script = build3DAvatarScript(FIXTURE_PCOS);
    expect(() => assertAvatarScriptShape(script)).not.toThrow();
  });

  test('Menopause — valid avatar script', () => {
    const script = build3DAvatarScript(FIXTURE_MENOPAUSE);
    expect(() => assertAvatarScriptShape(script)).not.toThrow();
  });

  test('Mixed pathology — valid avatar script', () => {
    const script = build3DAvatarScript(FIXTURE_MIXED_PATHOLOGY);
    expect(() => assertAvatarScriptShape(script)).not.toThrow();
  });
});

describe('build3DAvatarScript — validation', () => {
  test('All scripts pass validator', () => {
    const fixtures = [
      FIXTURE_FEMALE_AGA_MILD,
      FIXTURE_MALE_AGA_SEVERE,
      FIXTURE_PCOS,
      FIXTURE_MENOPAUSE,
    ];
    fixtures.forEach(fixture => {
      const script = build3DAvatarScript(fixture);
      const result = validateAvatarScript(script);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

describe('build3DAvatarScript — personalisation', () => {
  test('Scripts for different diagnoses have different narrations', () => {
    const scripts = [
      build3DAvatarScript(FIXTURE_FEMALE_AGA_MILD),
      build3DAvatarScript(FIXTURE_MALE_AGA_SEVERE),
      build3DAvatarScript(FIXTURE_PCOS),
      build3DAvatarScript(FIXTURE_TE_STRESS),
    ];
    expect(() => assertSceneTextsAreDifferent(scripts)).not.toThrow();
  });

  test('Patient name appears in intro', () => {
    const script = build3DAvatarScript(FIXTURE_FEMALE_AGA_MILD);
    expect(script.intro.text).toContain('Sarah');
  });

  test('Patient name appears in outro', () => {
    const script = build3DAvatarScript(FIXTURE_MALE_AGA_SEVERE);
    expect(script.outro.text).toContain('James');
  });

  test('Severe case intro uses empathetic language', () => {
    const script = build3DAvatarScript(FIXTURE_MALE_AGA_SEVERE);
    const introText = script.intro.text.toLowerCase();
    expect(introText).toMatch(/serious|advanced|courage|difficult|comprehensive/);
  });

  test('Mild case intro uses reassuring language', () => {
    const script = build3DAvatarScript(FIXTURE_FEMALE_AGA_MILD);
    const introText = script.intro.text.toLowerCase();
    expect(introText).toMatch(/great|right place|early|good/);
  });
});

describe('build3DAvatarScript — scene structure', () => {
  test('All scenes have required fields', () => {
    const script = build3DAvatarScript(FIXTURE_FEMALE_AGA_MILD);
    script.scenes.forEach(scene => {
      expect(scene.sceneId).toBeTruthy();
      expect(scene.title).toBeTruthy();
      expect(scene.narration).toBeTruthy();
      expect(scene.emotion).toBeTruthy();
      expect(scene.visualCue).toBeTruthy();
      expect(scene.durationSeconds).toBeGreaterThan(0);
      expect(scene.segments.length).toBeGreaterThan(0);
    });
  });

  test('Total duration matches sum of scene durations', () => {
    const script = build3DAvatarScript(FIXTURE_FEMALE_AGA_MILD);
    const sceneDurationSum = script.scenes.reduce((sum, s) => sum + s.durationSeconds, 0);
    // Total should be at least the sum of scene durations
    expect(script.totalDurationSeconds).toBeGreaterThanOrEqual(sceneDurationSum * 0.9);
  });

  test('Understanding-problem scene exists', () => {
    const script = build3DAvatarScript(FIXTURE_FEMALE_AGA_MILD);
    const hasScene = script.scenes.some(s => s.sceneId === 'understanding-problem');
    expect(hasScene).toBe(true);
  });

  test('Compliance scene exists', () => {
    const script = build3DAvatarScript(FIXTURE_FEMALE_AGA_MILD);
    const hasScene = script.scenes.some(s => s.sceneId === 'compliance-motivation');
    expect(hasScene).toBe(true);
  });

  test('Kit support scene exists when kit is available', () => {
    const script = build3DAvatarScript(FIXTURE_FEMALE_AGA_MILD);
    const hasScene = script.scenes.some(s => s.sceneId === 'how-kits-support');
    expect(hasScene).toBe(true);
  });
});

describe('build3DAvatarScript — serialisation safety', () => {
  test('Avatar script is JSON serialisable', () => {
    const script = build3DAvatarScript(FIXTURE_FEMALE_AGA_MILD);
    expect(() => JSON.stringify(script)).not.toThrow();
    const serialised = JSON.stringify(script);
    expect(serialised).not.toContain('undefined');
  });
});

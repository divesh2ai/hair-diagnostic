import { describe, test, expect } from 'vitest';
import { buildDoctorConsultation } from '../consultation/buildDoctorConsultation';
import { validateDoctorConsultation } from '../consultation/validateConsultation';
import { CONSULTATION_CHAPTER_ORDER } from '../consultation/types';
import {
  FIXTURE_FEMALE_AGA_MILD,
  FIXTURE_MALE_AGA_SEVERE,
  FIXTURE_PCOS,
  FIXTURE_MENOPAUSE,
  FIXTURE_MIXED_PATHOLOGY,
  FIXTURE_TE_STRESS,
} from '../fixtures/narrativeFixtures';

describe('buildDoctorConsultation — chapter structure', () => {
  test('produces exactly 5 chapters in canonical order', () => {
    const script = buildDoctorConsultation(FIXTURE_FEMALE_AGA_MILD);
    expect(script.chapters).toHaveLength(5);
    expect(script.chapters.map(c => c.id)).toEqual([...CONSULTATION_CHAPTER_ORDER]);
    expect(script.chapters.map(c => c.chapterNumber)).toEqual([1, 2, 3, 4, 5]);
  });

  test('each chapter has a headline phrased as a patient question', () => {
    const script = buildDoctorConsultation(FIXTURE_FEMALE_AGA_MILD);
    script.chapters.forEach(c => expect(c.headline).toMatch(/\?$/));
  });

  test('gesture categories match the spec mapping', () => {
    const script = buildDoctorConsultation(FIXTURE_MALE_AGA_SEVERE);
    const gestures = script.chapters.map(c => c.gestureCategory);
    expect(gestures).toEqual(['explanation', 'explanation', 'educational', 'reassurance', 'summary']);
  });
});

describe('buildDoctorConsultation — narration content', () => {
  test('chapter 1 contains the diagnosis label and patient name', () => {
    const script = buildDoctorConsultation(FIXTURE_FEMALE_AGA_MILD);
    expect(script.chapters[0].narration).toContain(script.patientName);
    expect(script.chapters[0].narration.toLowerCase()).toContain(
      script.context.diagnosisLabel.toLowerCase(),
    );
  });

  test('chapter 3 (inside-your-body) names the patient root causes biologically', () => {
    const script = buildDoctorConsultation(FIXTURE_PCOS);
    const narration = script.chapters[2].narration.toLowerCase();
    expect(narration).toMatch(/follicle|hormone|cycle/);
    expect(narration).toContain('reversible');
  });

  test('chapter 4 mentions the recovery window from clinical context', () => {
    const script = buildDoctorConsultation(FIXTURE_MENOPAUSE);
    expect(script.chapters[3].narration).toContain(script.context.recoveryWindow);
  });

  test('chapter 5 includes therapy + kit + compliance content when a kit exists', () => {
    const script = buildDoctorConsultation(FIXTURE_FEMALE_AGA_MILD);
    const narration = script.chapters[4].narration;
    expect(narration.toLowerCase()).toMatch(/consistency|every single day|routine/);
  });
});

describe('buildDoctorConsultation — greeting + closing', () => {
  test('greeting contains the patient name', () => {
    const script = buildDoctorConsultation(FIXTURE_FEMALE_AGA_MILD);
    expect(script.greeting.segment.text).toContain('Sarah');
  });

  test('closing contains the patient name', () => {
    const script = buildDoctorConsultation(FIXTURE_MALE_AGA_SEVERE);
    expect(script.closing.segment.text).toContain('James');
  });

  test('severe-case greeting uses empathetic language', () => {
    const script = buildDoctorConsultation(FIXTURE_MALE_AGA_SEVERE);
    expect(script.greeting.segment.text.toLowerCase()).toMatch(
      /courage|serious|advanced|comprehensive/,
    );
  });
});

describe('buildDoctorConsultation — follow-up prompts', () => {
  test('every chapter exposes at least 2 follow-up prompts', () => {
    const script = buildDoctorConsultation(FIXTURE_FEMALE_AGA_MILD);
    script.chapters.forEach(c => {
      expect(c.followUpPrompts.length).toBeGreaterThanOrEqual(2);
    });
  });

  test('follow-up prompt ids are namespaced by chapter id', () => {
    const script = buildDoctorConsultation(FIXTURE_FEMALE_AGA_MILD);
    script.chapters.forEach(c => {
      c.followUpPrompts.forEach(p => {
        expect(p.id.startsWith(`${c.id}:`)).toBe(true);
        expect(p.chapterId).toBe(c.id);
      });
    });
  });

  test('multi-cause profile gets the "multiple-causes" follow-up', () => {
    const script = buildDoctorConsultation(FIXTURE_MIXED_PATHOLOGY);
    const ch2 = script.chapters[1];
    expect(ch2.followUpPrompts.some(p => p.id.endsWith(':multiple-causes'))).toBe(true);
  });
});

describe('buildDoctorConsultation — validator', () => {
  test('every fixture produces a valid consultation script', () => {
    const fixtures = [
      FIXTURE_FEMALE_AGA_MILD,
      FIXTURE_MALE_AGA_SEVERE,
      FIXTURE_PCOS,
      FIXTURE_MENOPAUSE,
      FIXTURE_MIXED_PATHOLOGY,
      FIXTURE_TE_STRESS,
    ];
    fixtures.forEach(fixture => {
      const script = buildDoctorConsultation(fixture);
      const result = validateDoctorConsultation(script);
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
    });
  });

  test('catches a chapter inserted out of order', () => {
    const script = buildDoctorConsultation(FIXTURE_FEMALE_AGA_MILD);
    const swapped = {
      ...script,
      chapters: [
        script.chapters[1],
        script.chapters[0],
        script.chapters[2],
        script.chapters[3],
        script.chapters[4],
      ] as typeof script.chapters,
    };
    const result = validateDoctorConsultation(swapped);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('chapters[0].id'))).toBe(true);
  });
});

describe('buildDoctorConsultation — personalisation', () => {
  test('different fixtures produce different chapter narrations', () => {
    const scripts = [
      buildDoctorConsultation(FIXTURE_FEMALE_AGA_MILD),
      buildDoctorConsultation(FIXTURE_MALE_AGA_SEVERE),
      buildDoctorConsultation(FIXTURE_PCOS),
      buildDoctorConsultation(FIXTURE_TE_STRESS),
    ];
    const signatures = scripts.map(s => s.chapters.map(c => c.narration).join('|'));
    expect(new Set(signatures).size).toBe(scripts.length);
  });

  test('total estimated duration equals greeting + chapters + closing', () => {
    const script = buildDoctorConsultation(FIXTURE_FEMALE_AGA_MILD);
    const sum =
      script.greeting.estimatedDurationSeconds +
      script.chapters.reduce((s, c) => s + c.estimatedDurationSeconds, 0) +
      script.closing.estimatedDurationSeconds;
    expect(script.totalEstimatedDurationSeconds).toBe(sum);
  });
});

describe('buildDoctorConsultation — serialisation safety', () => {
  test('script is JSON serialisable without "undefined" leaks', () => {
    const script = buildDoctorConsultation(FIXTURE_FEMALE_AGA_MILD);
    const serialised = JSON.stringify(script);
    expect(() => JSON.parse(serialised)).not.toThrow();
    expect(serialised).not.toContain('undefined');
  });

  test('script does not carry provider-specific fields', () => {
    const script = buildDoctorConsultation(FIXTURE_FEMALE_AGA_MILD);
    const serialised = JSON.stringify(script).toLowerCase();
    expect(serialised).not.toMatch(/heygen|avatar_id|voice_id|did_provider/);
  });
});

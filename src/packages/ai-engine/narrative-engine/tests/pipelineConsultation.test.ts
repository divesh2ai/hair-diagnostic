import { describe, test, expect } from 'vitest';
import { narrativePipeline } from '../narrativePipeline';
import { CONSULTATION_CHAPTER_ORDER } from '../consultation/types';
import {
  FIXTURE_FEMALE_AGA_MILD,
  FIXTURE_MALE_AGA_SEVERE,
  FIXTURE_PCOS,
  FIXTURE_MENOPAUSE,
  FIXTURE_MIXED_PATHOLOGY,
  FIXTURE_TE_STRESS,
  FIXTURE_HYPOTHYROID,
} from '../fixtures/narrativeFixtures';

// ─── Phase 1 — pipeline integration ──────────────────────────────────────────
// Verifies doctorConsultation is generated automatically by the pipeline,
// alongside (not in place of) the existing doctor/patient reports and the
// legacy avatarScript path.

describe('narrativePipeline — doctorConsultation existence', () => {
  test('emits doctorConsultation on every fixture', () => {
    const fixtures = [
      FIXTURE_FEMALE_AGA_MILD,
      FIXTURE_MALE_AGA_SEVERE,
      FIXTURE_PCOS,
      FIXTURE_MENOPAUSE,
      FIXTURE_MIXED_PATHOLOGY,
      FIXTURE_TE_STRESS,
      FIXTURE_HYPOTHYROID,
    ];
    for (const f of fixtures) {
      const out = narrativePipeline(f);
      expect(out.doctorConsultation).toBeDefined();
      expect(out.doctorConsultation.metadata.version).toBe('1.0');
    }
  });

  test('does not require includeAvatarScript flag', () => {
    const out = narrativePipeline({ ...FIXTURE_FEMALE_AGA_MILD, includeAvatarScript: false });
    expect(out.doctorConsultation).toBeDefined();
    expect(out.avatarScript).toBeUndefined();
  });
});

describe('narrativePipeline — chapter structure', () => {
  test('produces exactly 5 chapters', () => {
    const out = narrativePipeline(FIXTURE_FEMALE_AGA_MILD);
    expect(out.doctorConsultation.chapters).toHaveLength(5);
  });

  test('chapter order matches CONSULTATION_CHAPTER_ORDER', () => {
    const out = narrativePipeline(FIXTURE_MALE_AGA_SEVERE);
    expect(out.doctorConsultation.chapters.map(c => c.id)).toEqual([...CONSULTATION_CHAPTER_ORDER]);
    expect(out.doctorConsultation.chapters.map(c => c.chapterNumber)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('narrativePipeline — follow-up questions', () => {
  test('every chapter exposes at least 2 follow-up prompts', () => {
    const out = narrativePipeline(FIXTURE_PCOS);
    for (const chapter of out.doctorConsultation.chapters) {
      expect(chapter.followUpPrompts.length).toBeGreaterThanOrEqual(2);
      for (const prompt of chapter.followUpPrompts) {
        expect(prompt.id).toBeTruthy();
        expect(prompt.question).toBeTruthy();
        expect(prompt.chapterId).toBe(chapter.id);
      }
    }
  });
});

describe('narrativePipeline — backward compatibility', () => {
  test('doctorReport remains unchanged when consultation is added', () => {
    const out = narrativePipeline(FIXTURE_FEMALE_AGA_MILD);
    expect(out.doctorReport).toBeDefined();
    expect(out.doctorReport.clinicalSummary.body.length).toBeGreaterThan(0);
    expect(out.doctorReport.primaryDiagnosis.body.length).toBeGreaterThan(0);
    expect(out.doctorReport.rootCauseAnalysis.body.length).toBeGreaterThan(0);
  });

  test('patientReport remains unchanged when consultation is added', () => {
    const out = narrativePipeline(FIXTURE_FEMALE_AGA_MILD);
    expect(out.patientReport).toBeDefined();
    expect(out.patientReport.whatIsHappening.body.length).toBeGreaterThan(0);
    expect(out.patientReport.whyItIsHappening.body.length).toBeGreaterThan(0);
  });

  test('avatarScript still produced when includeAvatarScript is true', () => {
    const out = narrativePipeline({ ...FIXTURE_MALE_AGA_SEVERE, includeAvatarScript: true });
    expect(out.avatarScript).toBeDefined();
    expect(out.avatarScript!.scenes.length).toBeGreaterThan(0);
  });

  test('pdfPayload, dashboardCard, metadata still produced', () => {
    const out = narrativePipeline(FIXTURE_FEMALE_AGA_MILD);
    expect(out.pdfPayload).toBeDefined();
    expect(out.dashboardCard).toBeDefined();
    expect(out.metadata).toBeDefined();
  });
});

describe('narrativePipeline — consultation shares clinical inputs', () => {
  test('consultation diagnosis matches doctor report primary diagnosis', () => {
    const out = narrativePipeline(FIXTURE_MENOPAUSE);
    expect(out.doctorConsultation.context.diagnosisKey).toBe(
      FIXTURE_MENOPAUSE.clinicalProfile.primaryDiagnosis,
    );
  });

  test('consultation root causes match clinical profile root causes', () => {
    const out = narrativePipeline(FIXTURE_MIXED_PATHOLOGY);
    expect(out.doctorConsultation.context.rootCauses).toEqual(
      FIXTURE_MIXED_PATHOLOGY.clinicalProfile.rootCauses,
    );
  });
});

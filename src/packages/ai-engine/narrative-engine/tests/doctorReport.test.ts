import { buildDoctorReport } from '../buildDoctorReport';
import {
  FIXTURE_FEMALE_AGA_MILD,
  FIXTURE_MALE_AGA_SEVERE,
  FIXTURE_PCOS,
  FIXTURE_HYPOTHYROID,
  FIXTURE_MIXED_PATHOLOGY,
  FIXTURE_TE_STRESS,
  ALL_FIXTURES,
} from '../fixtures/narrativeFixtures';

describe('buildDoctorReport — section presence', () => {
  test('All required sections are present', () => {
    const report = buildDoctorReport(FIXTURE_FEMALE_AGA_MILD);

    expect(report.clinicalSummary).toBeDefined();
    expect(report.primaryDiagnosis).toBeDefined();
    expect(report.differentialDiagnoses).toBeDefined();
    expect(report.severityAssessment).toBeDefined();
    expect(report.rootCauseAnalysis).toBeDefined();
    expect(report.signalInterpretation).toBeDefined();
    expect(report.therapyLogic).toBeDefined();
    expect(report.kitRationale).toBeDefined();
    expect(report.ingredientMechanisms).toBeDefined();
    expect(report.prognosis).toBeDefined();
    expect(report.riskFactors).toBeDefined();
    expect(report.contraindications).toBeDefined();
    expect(report.followUpRecommendations).toBeDefined();
    expect(report.expectedRecoveryTimeline).toBeDefined();
  });

  test('Structured data fields are present', () => {
    const report = buildDoctorReport(FIXTURE_FEMALE_AGA_MILD);

    expect(report.confidenceExplanation).toBeDefined();
    expect(report.kitNarratives.length).toBeGreaterThan(0);
    expect(report.therapyExplanations.length).toBeGreaterThan(0);
    expect(report.prognosisNarrative).toBeDefined();
    expect(report.followupPlan).toBeDefined();
    expect(report.metadata).toBeDefined();
  });
});

describe('buildDoctorReport — content quality', () => {
  test('Primary diagnosis section contains diagnosis label', () => {
    const report = buildDoctorReport(FIXTURE_FEMALE_AGA_MILD);
    expect(report.primaryDiagnosis.body).toContain('Androgenetic Alopecia');
  });

  test('Root cause analysis lists all root causes', () => {
    const report = buildDoctorReport(FIXTURE_PCOS);
    const bulletText = (report.rootCauseAnalysis.bullets ?? []).join(' ');
    expect(bulletText).toContain('PCOS');
  });

  test('Kit rationale contains protocol label', () => {
    const report = buildDoctorReport(FIXTURE_FEMALE_AGA_MILD);
    expect(report.kitRationale.body).toContain('Female AGA Foundation Protocol');
  });

  test('Each kit narrative has ingredient highlights', () => {
    const report = buildDoctorReport(FIXTURE_FEMALE_AGA_MILD);
    report.kitNarratives.forEach(kit => {
      expect(kit.ingredientHighlights.length).toBeGreaterThan(0);
      kit.ingredientHighlights.forEach(ingredient => {
        expect(ingredient.name).toBeTruthy();
        expect(ingredient.mechanism).toBeTruthy();
      });
    });
  });

  test('Ingredient mechanisms section has bullets', () => {
    const report = buildDoctorReport(FIXTURE_FEMALE_AGA_MILD);
    expect(report.ingredientMechanisms.bullets!.length).toBeGreaterThan(0);
  });

  test('Contraindications section flags pregnancy', () => {
    const pregnantInput = {
      ...FIXTURE_FEMALE_AGA_MILD,
      patient: { ...FIXTURE_FEMALE_AGA_MILD.patient, is_pregnant: true },
    };
    const report = buildDoctorReport(pregnantInput);
    const contraBullets = (report.contraindications.bullets ?? []).join(' ');
    expect(contraBullets).toContain('Pregnancy');
  });

  test('Severe case severity assessment mentions advanced follicular miniaturisation', () => {
    const report = buildDoctorReport(FIXTURE_MALE_AGA_SEVERE);
    expect(report.severityAssessment.body).toContain('Advanced follicular miniaturisation');
  });

  test('Follow-up priority is higher for severe than mild', () => {
    const mildReport = buildDoctorReport(FIXTURE_FEMALE_AGA_MILD);
    const severeReport = buildDoctorReport(FIXTURE_MALE_AGA_SEVERE);

    expect(mildReport.followupPlan.priority).toBe('low');
    expect(severeReport.followupPlan.priority).toBe('high');
  });
});

describe('buildDoctorReport — personalisation across fixtures', () => {
  test('Clinical summaries differ between all fixtures', () => {
    const summaries = Object.values(ALL_FIXTURES).map(f => buildDoctorReport(f).clinicalSummary.body);
    const uniqueSummaries = new Set(summaries);
    expect(uniqueSummaries.size).toBe(summaries.length);
  });

  test('Prognosis narratives differ between conditions', () => {
    const agaPrognosis = buildDoctorReport(FIXTURE_FEMALE_AGA_MILD).prognosisNarrative.shortSummary;
    const tePrognosis = buildDoctorReport(FIXTURE_PCOS).prognosisNarrative.shortSummary;
    expect(agaPrognosis).not.toEqual(tePrognosis);
  });

  test('Mixed pathology report has more therapy explanations than single condition', () => {
    const singleReport = buildDoctorReport(FIXTURE_TE_STRESS);
    const multiReport = buildDoctorReport(FIXTURE_MIXED_PATHOLOGY);
    expect(multiReport.therapyExplanations.length).toBeGreaterThan(singleReport.therapyExplanations.length);
  });
});

describe('buildDoctorReport — metadata', () => {
  test('Metadata diagnosis key matches primary diagnosis', () => {
    const report = buildDoctorReport(FIXTURE_FEMALE_AGA_MILD);
    expect(report.metadata.diagnosisKey).toBe('AGA_FEMALE_123');
  });

  test('Metadata generatedAt is valid ISO string', () => {
    const report = buildDoctorReport(FIXTURE_FEMALE_AGA_MILD);
    expect(() => new Date(report.generatedAt)).not.toThrow();
  });
});

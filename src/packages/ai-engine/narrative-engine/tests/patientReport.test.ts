import { buildPatientReport } from '../buildPatientReport';
import {
  FIXTURE_FEMALE_AGA_MILD,
  FIXTURE_MALE_AGA_SEVERE,
  FIXTURE_PCOS,
  FIXTURE_TE_STRESS,
  FIXTURE_MENOPAUSE,
  FIXTURE_MIXED_PATHOLOGY,
  FIXTURE_HYPOTHYROID,
  ALL_FIXTURES,
} from '../fixtures/narrativeFixtures';

describe('buildPatientReport — section presence', () => {
  test('All required sections are present', () => {
    const report = buildPatientReport(FIXTURE_FEMALE_AGA_MILD);

    expect(report.greeting).toBeTruthy();
    expect(report.whatIsHappening).toBeDefined();
    expect(report.whyItIsHappening).toBeDefined();
    expect(report.isItReversible).toBeDefined();
    expect(report.howTherapiesWork).toBeDefined();
    expect(report.howKitsHelp).toBeDefined();
    expect(report.whatToExpect).toBeDefined();
    expect(report.realisticTimeline).toBeDefined();
    expect(report.preventionAdvice).toBeDefined();
    expect(report.reassuranceSection).toBeDefined();
    expect(report.kitNarratives).toBeDefined();
    expect(report.prognosisNarrative).toBeDefined();
    expect(report.followupPlan).toBeDefined();
    expect(report.educationalInsights).toBeDefined();
  });
});

describe('buildPatientReport — tone and content', () => {
  test('Mild case greeting is reassuring', () => {
    const report = buildPatientReport(FIXTURE_FEMALE_AGA_MILD);
    const body = report.whatIsHappening.body.toLowerCase();
    expect(body).toMatch(/early|great|right time|best/);
  });

  test('Severe case language is empathetic', () => {
    const report = buildPatientReport(FIXTURE_MALE_AGA_SEVERE);
    const body = report.whatIsHappening.body.toLowerCase();
    expect(body).toMatch(/advanced|difficult|serious|significant/);
  });

  test('Reversible condition (TE) states condition is reversible', () => {
    const report = buildPatientReport(FIXTURE_TE_STRESS);
    expect(report.isItReversible.body).toContain('reversible');
  });

  test('Chronic condition (AGA) states condition is chronic', () => {
    const report = buildPatientReport(FIXTURE_FEMALE_AGA_MILD);
    expect(report.isItReversible.body).toContain('chronic');
  });

  test('Patient name appears in greeting', () => {
    const report = buildPatientReport(FIXTURE_FEMALE_AGA_MILD);
    expect(report.greeting).toContain('Sarah');
  });

  test('Hypothyroid report mentions thyroid', () => {
    const report = buildPatientReport(FIXTURE_HYPOTHYROID);
    const allText = [
      report.whyItIsHappening.body,
      (report.whyItIsHappening.bullets ?? []).join(' '),
      report.howTherapiesWork.body,
    ].join(' ').toLowerCase();
    expect(allText).toContain('thyroid');
  });

  test('PCOS report mentions hormonal factors', () => {
    const report = buildPatientReport(FIXTURE_PCOS);
    const allText = [
      report.whyItIsHappening.body,
      (report.whyItIsHappening.bullets ?? []).join(' '),
    ].join(' ').toLowerCase();
    expect(allText).toMatch(/pcos|hormone|androgen/);
  });

  test('Prevention advice contains actionable items', () => {
    const report = buildPatientReport(FIXTURE_FEMALE_AGA_MILD);
    expect(report.preventionAdvice.bullets!.length).toBeGreaterThan(2);
  });

  test('Reassurance section is present and non-empty', () => {
    Object.values(ALL_FIXTURES).forEach(fixture => {
      const report = buildPatientReport(fixture);
      expect(report.reassuranceSection.body.length).toBeGreaterThan(50);
    });
  });
});

describe('buildPatientReport — kit narratives', () => {
  test('Kit narratives have patient-friendly purpose', () => {
    const report = buildPatientReport(FIXTURE_FEMALE_AGA_MILD);
    report.kitNarratives.forEach(kit => {
      expect(kit.patientFriendlyPurpose.length).toBeGreaterThan(0);
      expect(kit.expectedTimeline.length).toBeGreaterThan(0);
      expect(kit.consistencyNote.length).toBeGreaterThan(0);
    });
  });

  test('Mixed pathology report has multiple kit narratives', () => {
    const report = buildPatientReport(FIXTURE_MIXED_PATHOLOGY);
    expect(report.kitNarratives.length).toBeGreaterThanOrEqual(3);
  });
});

describe('buildPatientReport — educational insights', () => {
  test('AGA report includes DHT education', () => {
    const report = buildPatientReport(FIXTURE_FEMALE_AGA_MILD);
    const topics = report.educationalInsights.map(i => i.topic.toLowerCase());
    const hasDHT = topics.some(t => t.includes('dht') || t.includes('follicle') || t.includes('aga'));
    expect(hasDHT).toBe(true);
  });

  test('Educational insights have all required fields', () => {
    const report = buildPatientReport(FIXTURE_FEMALE_AGA_MILD);
    report.educationalInsights.forEach(insight => {
      expect(insight.topic).toBeTruthy();
      expect(insight.patientFriendlyExplanation).toBeTruthy();
      expect(insight.clinicalContext).toBeTruthy();
      expect(insight.relevantBecause).toBeTruthy();
    });
  });
});

describe('buildPatientReport — personalisation across all fixtures', () => {
  test('whatIsHappening differs across all fixtures', () => {
    const bodies = Object.values(ALL_FIXTURES).map(
      f => buildPatientReport(f).whatIsHappening.body
    );
    const unique = new Set(bodies);
    expect(unique.size).toBe(bodies.length);
  });

  test('Timelines have correct number of events', () => {
    Object.values(ALL_FIXTURES).forEach(fixture => {
      const report = buildPatientReport(fixture);
      expect(report.realisticTimeline.bullets!.length).toBeGreaterThan(2);
    });
  });
});

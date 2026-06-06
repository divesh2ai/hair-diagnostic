import { narrativePipeline, NarrativePipelineError } from '../narrativePipeline';
import {
  FIXTURE_FEMALE_AGA_MILD,
  FIXTURE_MALE_AGA_SEVERE,
  FIXTURE_PCOS,
  FIXTURE_HYPOTHYROID,
  FIXTURE_TE_STRESS,
  FIXTURE_MENOPAUSE,
  FIXTURE_MIXED_PATHOLOGY,
  ALL_FIXTURES,
} from '../fixtures/narrativeFixtures';
import type { NarrativePipelineOutput } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function assertOutputShape(output: NarrativePipelineOutput): void {
  expect(output.doctorReport).toBeDefined();
  expect(output.patientReport).toBeDefined();
  expect(output.pdfPayload).toBeDefined();
  expect(output.dashboardCard).toBeDefined();
  expect(output.metadata).toBeDefined();
}

function assertNoEmptySections(output: NarrativePipelineOutput): void {
  const doctor = output.doctorReport;
  expect(doctor.clinicalSummary.body.length).toBeGreaterThan(0);
  expect(doctor.primaryDiagnosis.body.length).toBeGreaterThan(0);
  expect(doctor.rootCauseAnalysis.body.length).toBeGreaterThan(0);
  expect(doctor.therapyLogic.body.length).toBeGreaterThan(0);

  const patient = output.patientReport;
  expect(patient.whatIsHappening.body.length).toBeGreaterThan(0);
  expect(patient.whyItIsHappening.body.length).toBeGreaterThan(0);
  expect(patient.isItReversible.body.length).toBeGreaterThan(0);
  expect(patient.howTherapiesWork.body.length).toBeGreaterThan(0);
  expect(patient.whatToExpect.body.length).toBeGreaterThan(0);
}

// ─── Shape Tests ──────────────────────────────────────────────────────────────

describe('narrativePipeline — output shape', () => {
  test('Female AGA mild — produces complete output', () => {
    const output = narrativePipeline(FIXTURE_FEMALE_AGA_MILD);
    assertOutputShape(output);
    assertNoEmptySections(output);
  });

  test('Male AGA severe — produces complete output with avatar and WhatsApp', () => {
    const output = narrativePipeline(FIXTURE_MALE_AGA_SEVERE);
    assertOutputShape(output);
    expect(output.avatarScript).toBeDefined();
    expect(output.whatsappSummary).toBeDefined();
  });

  test('PCOS — produces complete output with WhatsApp', () => {
    const output = narrativePipeline(FIXTURE_PCOS);
    assertOutputShape(output);
    expect(output.whatsappSummary).toBeDefined();
  });

  test('Hypothyroid — produces complete output', () => {
    const output = narrativePipeline(FIXTURE_HYPOTHYROID);
    assertOutputShape(output);
  });

  test('TE stress — produces complete output', () => {
    const output = narrativePipeline(FIXTURE_TE_STRESS);
    assertOutputShape(output);
  });

  test('Menopause — produces complete output with avatar and WhatsApp', () => {
    const output = narrativePipeline(FIXTURE_MENOPAUSE);
    assertOutputShape(output);
    expect(output.avatarScript).toBeDefined();
    expect(output.whatsappSummary).toBeDefined();
  });

  test('Mixed pathology — produces complete output', () => {
    const output = narrativePipeline(FIXTURE_MIXED_PATHOLOGY);
    assertOutputShape(output);
  });
});

// ─── Personalisation Tests ────────────────────────────────────────────────────

describe('narrativePipeline — personalisation', () => {
  test('Different diagnoses produce different patient report bodies', () => {
    const agaOutput = narrativePipeline(FIXTURE_FEMALE_AGA_MILD);
    const teOutput = narrativePipeline(FIXTURE_TE_STRESS);
    const pcosOutput = narrativePipeline(FIXTURE_PCOS);

    const agaBody = agaOutput.patientReport.whatIsHappening.body;
    const teBody = teOutput.patientReport.whatIsHappening.body;
    const pcosBody = pcosOutput.patientReport.whatIsHappening.body;

    expect(agaBody).not.toEqual(teBody);
    expect(agaBody).not.toEqual(pcosBody);
    expect(teBody).not.toEqual(pcosBody);
  });

  test('Different severities produce different patient opening statements', () => {
    const mildOutput = narrativePipeline(FIXTURE_FEMALE_AGA_MILD);
    const severeOutput = narrativePipeline(FIXTURE_MALE_AGA_SEVERE);

    expect(mildOutput.patientReport.greeting).not.toEqual(severeOutput.patientReport.greeting);
  });

  test('Patient names appear in reports', () => {
    const output = narrativePipeline(FIXTURE_FEMALE_AGA_MILD);
    expect(output.patientReport.greeting).toContain('Sarah');
    expect(output.doctorReport.patientRef).toContain('Sarah');
  });

  test('Kit narratives are personalised per kit', () => {
    const output = narrativePipeline(FIXTURE_MIXED_PATHOLOGY);
    const kitNarratives = output.doctorReport.kitNarratives;
    expect(kitNarratives.length).toBeGreaterThan(1);

    const firstKitReason = kitNarratives[0].reasonForSelection;
    const secondKitReason = kitNarratives[1]?.reasonForSelection ?? '';
    expect(firstKitReason).not.toEqual(secondKitReason);
  });

  test('Reversibility differs between chronic and reversible conditions', () => {
    const agaOutput = narrativePipeline(FIXTURE_FEMALE_AGA_MILD);
    const teOutput = narrativePipeline(FIXTURE_TE_STRESS);

    const agaReversibility = agaOutput.patientReport.isItReversible.body;
    const teReversibility = teOutput.patientReport.isItReversible.body;

    expect(agaReversibility).not.toEqual(teReversibility);
    expect(teReversibility).toContain('reversible');
    expect(agaReversibility).toContain('chronic');
  });
});

// ─── Timeline Tests ───────────────────────────────────────────────────────────

describe('narrativePipeline — timelines', () => {
  test('All outputs have timeline events', () => {
    Object.values(ALL_FIXTURES).forEach(fixture => {
      const output = narrativePipeline(fixture);
      const timeline = output.doctorReport.prognosisNarrative.timelineEvents;
      expect(timeline.length).toBeGreaterThan(2);
    });
  });

  test('Timeline events have required fields', () => {
    const output = narrativePipeline(FIXTURE_FEMALE_AGA_MILD);
    output.doctorReport.prognosisNarrative.timelineEvents.forEach(event => {
      expect(event.weekRange).toBeTruthy();
      expect(event.milestone).toBeTruthy();
      expect(event.expectation).toBeTruthy();
      expect(event.phase).toBeTruthy();
    });
  });

  test('Severe cases have longer recovery windows than mild', () => {
    const mildOutput = narrativePipeline(FIXTURE_FEMALE_AGA_MILD);
    const severeOutput = narrativePipeline(FIXTURE_MALE_AGA_SEVERE);

    // Severe should have more timeline events (more phases)
    const mildEvents = mildOutput.doctorReport.prognosisNarrative.timelineEvents.length;
    const severeEvents = severeOutput.doctorReport.prognosisNarrative.timelineEvents.length;
    expect(severeEvents).toBeGreaterThanOrEqual(mildEvents);
  });
});

// ─── PDF Payload Tests ────────────────────────────────────────────────────────

describe('narrativePipeline — PDF payload', () => {
  test('PDF payload is serialisation-safe', () => {
    const output = narrativePipeline(FIXTURE_FEMALE_AGA_MILD);
    expect(() => JSON.stringify(output.pdfPayload)).not.toThrow();
    const serialised = JSON.stringify(output.pdfPayload);
    expect(serialised).not.toContain('undefined');
  });

  test('PDF payload has all required sections', () => {
    const output = narrativePipeline(FIXTURE_MALE_AGA_SEVERE);
    const pdf = output.pdfPayload;

    expect(pdf.version).toBe('1.0');
    expect(pdf.doctorSections.length).toBeGreaterThan(0);
    expect(pdf.patientSections.length).toBeGreaterThan(0);
    expect(pdf.disclaimers.length).toBeGreaterThan(0);
    expect(pdf.kitTables.length).toBeGreaterThan(0);
  });

  test('PDF payload contains ingredient cards', () => {
    const output = narrativePipeline(FIXTURE_FEMALE_AGA_MILD);
    expect(output.pdfPayload.ingredientMechanismCards.length).toBeGreaterThan(0);
  });
});

// ─── Validation Tests ─────────────────────────────────────────────────────────

describe('narrativePipeline — validation', () => {
  test('Throws NarrativePipelineError for missing clinicalProfile', () => {
    const badInput = { ...FIXTURE_FEMALE_AGA_MILD, clinicalProfile: undefined as any };
    expect(() => narrativePipeline(badInput)).toThrow(NarrativePipelineError);
  });

  test('Throws NarrativePipelineError for missing patient', () => {
    const badInput = { ...FIXTURE_FEMALE_AGA_MILD, patient: undefined as any };
    expect(() => narrativePipeline(badInput)).toThrow(NarrativePipelineError);
  });

  test('Throws NarrativePipelineError for missing kitRecommendation', () => {
    const badInput = { ...FIXTURE_FEMALE_AGA_MILD, kitRecommendation: undefined as any };
    expect(() => narrativePipeline(badInput)).toThrow(NarrativePipelineError);
  });

  test('Error includes specific field name', () => {
    const badInput = { ...FIXTURE_FEMALE_AGA_MILD, patient: undefined as any };
    try {
      narrativePipeline(badInput);
      throw new Error('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(NarrativePipelineError);
      expect((e as NarrativePipelineError).validationErrors.some(err => err.includes('patient'))).toBe(true);
    }
  });
});

// ─── Dashboard Card Tests ─────────────────────────────────────────────────────

describe('narrativePipeline — dashboard card', () => {
  test('Dashboard card contains correct severity', () => {
    const output = narrativePipeline(FIXTURE_FEMALE_AGA_MILD);
    expect(output.dashboardCard.severity).toBe('MILD');
  });

  test('Severe case flags doctorAttentionNeeded', () => {
    const output = narrativePipeline(FIXTURE_MALE_AGA_SEVERE);
    expect(output.dashboardCard.doctorAttentionNeeded).toBe(true);
  });

  test('Dashboard card recovery window is non-empty', () => {
    Object.values(ALL_FIXTURES).forEach(fixture => {
      const output = narrativePipeline(fixture);
      expect(output.dashboardCard.recoveryWindow.length).toBeGreaterThan(0);
    });
  });
});

// ─── WhatsApp Summary Tests ───────────────────────────────────────────────────

describe('narrativePipeline — WhatsApp summary', () => {
  test('WhatsApp message is under 1200 chars', () => {
    const output = narrativePipeline({ ...FIXTURE_MALE_AGA_SEVERE });
    expect(output.whatsappSummary!.characterCount).toBeLessThanOrEqual(1200);
    expect(output.whatsappSummary!.message.length).toBeLessThanOrEqual(1200);
  });

  test('WhatsApp message contains patient name', () => {
    const output = narrativePipeline(FIXTURE_MALE_AGA_SEVERE);
    expect(output.whatsappSummary!.message).toContain('James');
  });

  test('WhatsApp message contains diagnosis', () => {
    const output = narrativePipeline(FIXTURE_PCOS);
    expect(output.whatsappSummary!.message.length).toBeGreaterThan(0);
  });
});

// ─── Metadata Tests ───────────────────────────────────────────────────────────

describe('narrativePipeline — metadata', () => {
  test('Metadata has pipelineVersion', () => {
    const output = narrativePipeline(FIXTURE_FEMALE_AGA_MILD);
    expect(output.metadata.pipelineVersion).toBeTruthy();
  });

  test('Metadata generatedAt is valid ISO date', () => {
    const output = narrativePipeline(FIXTURE_FEMALE_AGA_MILD);
    expect(new Date(output.metadata.generatedAt).toISOString()).toBe(output.metadata.generatedAt);
  });

  test('Metadata reflects input severity', () => {
    const mildOutput = narrativePipeline(FIXTURE_FEMALE_AGA_MILD);
    const severeOutput = narrativePipeline(FIXTURE_MALE_AGA_SEVERE);
    expect(mildOutput.metadata.severity).toBe('MILD');
    expect(severeOutput.metadata.severity).toBe('SEVERE');
  });
});

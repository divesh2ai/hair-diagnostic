import type { DoctorReport } from './types';
import type { PatientReport } from './types';
import type {
  PDFPayload,
  PDFSection,
  PDFTable,
  PDFIngredientCard,
  PDFChartData,
  NarrativePipelineInput,
} from './types';
import { formatTimelineForPDF } from './formatters/formatTimeline';
import { MEDICAL_DISCLAIMERS, PATIENT_DISCLAIMERS } from './constants';
import { resolvePatientName, nowISO } from './utils';
import { mapTherapyToTimeline } from './mappers/mapTherapyToTimeline';

// ─── PDF Payload Builder ──────────────────────────────────────────────────────

export function buildPDFPayload(
  input: NarrativePipelineInput,
  doctorReport: DoctorReport,
  patientReport: PatientReport
): PDFPayload {
  const patientName = resolvePatientName(input.patient);
  const patientRef = patientName;

  const doctorSections = buildDoctorPDFSections(doctorReport);
  const patientSections = buildPatientPDFSections(patientReport);
  const kitTables = buildKitTables(doctorReport);
  const prognosisTables = buildPrognosisTables(doctorReport);
  const ingredientCards = buildIngredientCards(doctorReport);
  const therapyTimeline = mapTherapyToTimeline(
    input.therapyPlan,
    input.kitRecommendation,
    input.clinicalProfile
  );

  return {
    version: '1.0',
    generatedAt: nowISO(),
    patientRef,
    patientName,
    clinicBrandingPlaceholder: '{{CLINIC_LOGO}} {{CLINIC_NAME}} {{CLINIC_ADDRESS}}',
    doctorSections,
    patientSections,
    therapyTimeline,
    kitTables,
    prognosisTables,
    ingredientMechanismCards: ingredientCards,
    disclaimers: [...MEDICAL_DISCLAIMERS, ...PATIENT_DISCLAIMERS],
    metadata: doctorReport.metadata,
  };
}

// ─── Doctor PDF Sections ──────────────────────────────────────────────────────

function buildDoctorPDFSections(report: DoctorReport): readonly PDFSection[] {
  const sections = [
    report.clinicalSummary,
    report.primaryDiagnosis,
    report.differentialDiagnoses,
    report.severityAssessment,
    report.rootCauseAnalysis,
    report.signalInterpretation,
    report.therapyLogic,
    report.kitRationale,
    report.ingredientMechanisms,
    report.prognosis,
    report.riskFactors,
    report.contraindications,
    report.followUpRecommendations,
    report.expectedRecoveryTimeline,
  ];

  return sections.map((section, idx) => ({
    id: section.id,
    title: section.title,
    content: section.body,
    bullets: section.bullets,
    pageBreakBefore: idx > 0 && ['kit-rationale', 'prognosis', 'recovery-timeline'].includes(section.id),
  }));
}

// ─── Patient PDF Sections ─────────────────────────────────────────────────────

function buildPatientPDFSections(report: PatientReport): readonly PDFSection[] {
  const sections = [
    report.whatIsHappening,
    report.whyItIsHappening,
    report.isItReversible,
    report.howTherapiesWork,
    report.howKitsHelp,
    report.whatToExpect,
    report.realisticTimeline,
    report.preventionAdvice,
    report.reassuranceSection,
  ];

  return sections.map((section, idx) => ({
    id: section.id,
    title: section.title,
    content: section.body,
    bullets: section.bullets,
    pageBreakBefore: idx > 0 && ['how-therapies-work', 'what-to-expect', 'realistic-timeline'].includes(section.id),
  }));
}

// ─── Kit Tables ───────────────────────────────────────────────────────────────

function buildKitTables(report: DoctorReport): readonly PDFTable[] {
  return report.kitNarratives.map(kit => ({
    title: `Kit: ${kit.displayName} (Phase ${kit.phase})`,
    headers: ['Attribute', 'Detail'],
    rows: [
      ['Kit ID', kit.kitId],
      ['Phase', String(kit.phase)],
      ['Selection Reason', kit.reasonForSelection],
      ['Targeted Mechanisms', kit.targetedMechanisms.join(', ')],
      ['Expected Timeline', kit.expectedTimeline],
      ['Usage Importance', kit.usageImportance],
    ] as readonly (readonly string[])[],
    footnote: kit.consistencyNote,
  }));
}

// ─── Prognosis Tables ─────────────────────────────────────────────────────────

function buildPrognosisTables(report: DoctorReport): readonly PDFTable[] {
  const prog = report.prognosisNarrative;

  const recoveryTable: PDFTable = {
    title: 'Recovery Expectation Summary',
    headers: ['Scenario', 'Outcome'],
    rows: [
      ['Best Case', prog.recoveryExpectation.bestCase],
      ['Typical Case', prog.recoveryExpectation.typicalCase],
      ['Conservative Case', prog.recoveryExpectation.conservativeCase],
    ] as readonly (readonly string[])[],
    footnote: prog.recoveryExpectation.variabilityNote,
  };

  const timelineTable: PDFTable = {
    title: 'Treatment Timeline',
    headers: ['Period', 'Phase', 'Milestone', 'Expected Outcome', 'Certainty'],
    rows: formatTimelineForPDF(prog.timelineEvents) as readonly (readonly string[])[],
  };

  return [recoveryTable, timelineTable];
}

// ─── Ingredient Cards ─────────────────────────────────────────────────────────

function buildIngredientCards(report: DoctorReport): readonly PDFIngredientCard[] {
  const allIngredients = report.kitNarratives.flatMap(k => k.ingredientHighlights);

  // Deduplicate by ingredient name
  const seen = new Set<string>();
  const unique: PDFIngredientCard[] = [];

  for (const ingredient of allIngredients) {
    if (!seen.has(ingredient.name)) {
      seen.add(ingredient.name);
      unique.push({
        ingredientName: ingredient.name,
        role: ingredient.role,
        mechanism: ingredient.mechanism,
        evidenceLevel: ingredient.evidenceNote,
        targetConditions: [report.metadata.diagnosisKey.replace(/_/g, ' ')],
      });
    }
  }

  return unique;
}

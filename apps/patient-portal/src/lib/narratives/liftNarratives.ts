import type {
  AssessmentNarratives,
  EnrichedRootCause,
  EnrichedTherapyNeed,
  NarrativeSection,
} from "@shared/types/assessment";

const EMPTY_SECTION: NarrativeSection = {
  full: "",
  short: "",
  segments: [],
  length: "detailed",
  target: "patient-report",
  locale: "en",
  generatedAt: "",
};

function asNarrativeSection(value: unknown): NarrativeSection | undefined {
  if (!value || typeof value !== "object") return undefined;
  const section = value as Record<string, unknown>;
  if (typeof section.full !== "string" && typeof section.short !== "string") return undefined;
  return {
    full: typeof section.full === "string" ? section.full : "",
    short: typeof section.short === "string" ? section.short : "",
    segments: Array.isArray(section.segments)
      ? section.segments
          .filter((seg): seg is { label: string; text: string } => {
            return (
              !!seg &&
              typeof seg === "object" &&
              typeof (seg as Record<string, unknown>).label === "string" &&
              typeof (seg as Record<string, unknown>).text === "string"
            );
          })
          .map((seg) => ({ label: seg.label, text: seg.text }))
      : [],
    length: typeof section.length === "string" ? section.length : "detailed",
    target: typeof section.target === "string" ? section.target : "patient-report",
    locale: typeof section.locale === "string" ? section.locale : "en",
    generatedAt: typeof section.generatedAt === "string" ? section.generatedAt : "",
  };
}

/**
 * Lifts the persisted NARRATIVES artifact envelope into the V2 read contract.
 */
export function liftNarratives(content: unknown): AssessmentNarratives | null {
  if (!content || typeof content !== "object") return null;
  const payload = content as Record<string, unknown>;

  const doctorNarrative = asNarrativeSection(payload.doctor_narrative);
  const patientNarrative = asNarrativeSection(payload.patient_narrative);
  if (!doctorNarrative && !patientNarrative) return null;

  const executiveSummary =
    (typeof payload.doctorSummary === "string" && payload.doctorSummary.trim()) ||
    (typeof payload.patientSummary === "string" && payload.patientSummary.trim()) ||
    doctorNarrative?.short ||
    patientNarrative?.short ||
    "";

  return {
    executiveSummary,
    doctorNarrative: doctorNarrative ?? EMPTY_SECTION,
    patientNarrative: patientNarrative ?? EMPTY_SECTION,
    therapyExplanation: asNarrativeSection(payload.therapy_explanation) ?? EMPTY_SECTION,
    lifestylePlan: asNarrativeSection(payload.lifestyle_plan) ?? EMPTY_SECTION,
    prognosis: asNarrativeSection(payload.prognosis) ?? EMPTY_SECTION,
    monitoringPlan: asNarrativeSection(payload.monitoring_plan) ?? EMPTY_SECTION,
    enrichedTherapyNeeds: Array.isArray(payload.enrichedTherapyNeeds)
      ? (payload.enrichedTherapyNeeds as EnrichedTherapyNeed[])
      : [],
    enrichedRootCauses: Array.isArray(payload.enrichedRootCauses)
      ? (payload.enrichedRootCauses as EnrichedRootCause[])
      : [],
    clinicalReport:
      payload.clinical_report && typeof payload.clinical_report === "object"
        ? (payload.clinical_report as Record<string, unknown>)
        : null,
    doctorConsultation:
      payload.doctor_consultation && typeof payload.doctor_consultation === "object"
        ? (payload.doctor_consultation as Record<string, unknown>)
        : null,
  };
}

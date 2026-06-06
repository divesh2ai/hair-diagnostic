import type { PatientAnswers } from "../types";
import type { QuestionnaireSubmission } from "../orchestration/types";

const toStrArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : [];

/** Maps patient-portal real protocol IDs to PatientAnswers. IDs now match field names directly. */
export function mapPortalToPatientAnswers(raw: Record<string, unknown>): PatientAnswers {
  const sexRaw = String(raw.sex ?? "").toLowerCase();
  const sex = sexRaw === "female" ? "Female" : "Male";

  return {
    name: raw.name != null ? String(raw.name) : undefined,
    sex,
    age: String(raw.age ?? 30),
    goal: Array.isArray(raw.goal) ? raw.goal.map(String) : raw.goal != null ? [String(raw.goal)] : [],
    duration: raw.duration != null ? String(raw.duration) : undefined,
    count: raw.count != null ? String(raw.count) : undefined,
    grade: raw.grade != null ? String(raw.grade) : undefined,
    hairtype: toStrArr(raw.hairtype),
    scalp: toStrArr(raw.scalp),
    cause: toStrArr(raw.cause),
    immunity: toStrArr(raw.immunity),
    lifestyle: toStrArr(raw.lifestyle),
    thyroid: Array.isArray(raw.thyroid)
      ? raw.thyroid.map(String)
      : raw.thyroid != null ? String(raw.thyroid) : undefined,
    hormonal: toStrArr(raw.hormonal),
    hormonal_issues: [],
    gut: toStrArr(raw.gut),
    deficiency: toStrArr(raw.deficiency),
    diet: toStrArr(raw.diet),
    treatment: toStrArr(raw.treatment),
    medical: raw.medical != null ? String(raw.medical) : undefined,
    medical_detail: raw.medical_detail != null ? String(raw.medical_detail) : undefined,
  };
}

/** Maps portal answers to modular questionnaire-engine submission keys. */
export function mapPortalToPipelineSubmission(raw: Record<string, unknown>): QuestionnaireSubmission {
  const pa = mapPortalToPatientAnswers(raw);
  return {
    age: pa.age,
    biologicalSex: String(pa.sex).toLowerCase() === "female" ? "female" : "male",
    primaryConcerns: Array.isArray(pa.goal) ? pa.goal : [String(pa.goal)],
    onsetDurationMonths: 6,
    scalpCondition: (pa.scalp ?? []).some((s) => s.toLowerCase().includes("oily"))
      ? "OILY"
      : (pa.scalp ?? []).some((s) => s.toLowerCase().includes("inflam"))
        ? "INFLAMED"
        : "NORMAL",
    ludwigScale: "",
    norwoodScale: String(pa.grade ?? ""),
    thinningAreas: pa.hairtype ?? [],
    stressLevel: (pa.lifestyle ?? []).some((l) => l.toLowerCase().includes("high"))
      ? "HIGH"
      : "LOW",
    dietQuality: "FAIR",
    smokingStatus: false,
    familyHistoryOfHairLoss: (pa.cause ?? []).some((c) => c.toLowerCase().includes("family")),
    knownDeficiencies: pa.deficiency ?? [],
    currentMedications: [],
    labMarkers: {},
    legacyAnswers: pa,
  };
}

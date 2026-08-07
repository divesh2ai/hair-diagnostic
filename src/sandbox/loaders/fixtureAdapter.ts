import * as fs from "fs";
import * as path from "path";
import type { ClinicalPatientFixture, ExpectedClinicalSignals, ExpectedRecommendations, ExpectedNarrativePatterns } from "../types";
import type { PatientAnswers } from "../../packages/types";

// Probe both monorepo-root and portal-relative paths (see fixtureLoader.ts for rationale).
const FIXTURES_DIR = (() => {
  if (process.env.HAIROS_FIXTURES_DIR) return process.env.HAIROS_FIXTURES_DIR;
  const fromRoot = path.resolve(process.cwd(), "tests", "fixtures", "patients");
  if (fs.existsSync(fromRoot)) return fromRoot;
  return path.resolve(process.cwd(), "../..", "tests", "fixtures", "patients");
})();

interface LegacyFixture {
  id: string;
  description: string;
  budget?: "ESSENTIAL" | "STANDARD" | "COMPREHENSIVE";
  answers: PatientAnswers;
  expected: {
    diagnoses: string[];
    scalpStates: string[];
    rootCauses: string[];
    therapyNeeds: string[];
    topKit?: string;
    mustIncludeKits: string[];
    mustExcludeKits: string[];
    mustTriggerRules: string[];
    mustBlockRules: string[];
  };
}

export function adaptLegacyFixture(fixtureId: string): ClinicalPatientFixture {
  const filePath = path.join(FIXTURES_DIR, `${fixtureId}.json`);
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as LegacyFixture;

  const expectedClinicalSignals: ExpectedClinicalSignals = {
    diagnoses: raw.expected.diagnoses as ExpectedClinicalSignals["diagnoses"],
    scalpStates: raw.expected.scalpStates as ExpectedClinicalSignals["scalpStates"],
    rootCauses: raw.expected.rootCauses as ExpectedClinicalSignals["rootCauses"],
    therapyNeeds: raw.expected.therapyNeeds as ExpectedClinicalSignals["therapyNeeds"],
    severity: "MODERATE",
  };

  const expectedRecommendations: ExpectedRecommendations = {
    topKit: raw.expected.topKit ?? (raw.expected.mustIncludeKits || [])[0] ?? "",
    mustIncludeKits: raw.expected.mustIncludeKits,
    mustExcludeKits: raw.expected.mustExcludeKits,
    mustTriggerRules: raw.expected.mustTriggerRules,
    mustBlockRules: raw.expected.mustBlockRules,
  };

  const expectedNarrativePatterns: ExpectedNarrativePatterns = {
    doctorNarrativeMustContain: [],
    patientNarrativeMustContain: [],
  };

  return {
    patient: {
      id: raw.id,
      name: raw.id.replace(/_/g, " "),
      age: Number(raw.answers.age) || 35,
      sex: String(raw.answers.sex).toLowerCase() === "female" ? "Female" : "Male",
      description: raw.description,
    },
    questionnaireAnswers: raw.answers,
    expectedClinicalSignals,
    expectedRecommendations,
    expectedNarrativePatterns,
    budget: raw.budget,
    clinicalNotes: raw.description,
  };
}

export function listAllFixtureIds(): string[] {
  if (!fs.existsSync(FIXTURES_DIR)) return [];
  return fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

import * as fs from "fs";
import * as path from "path";
import type { ClinicalPatientFixture } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE LOADER
// Loads structured ClinicalPatientFixture files from tests/fixtures/patients/
// ─────────────────────────────────────────────────────────────────────────────

// ─── Path Resolution ──────────────────────────────────────────────────────────
// process.cwd() varies by execution context:
//   • Backend server / jest     → monorepo root (D:\Dr Fact Folder\RAG Chatbot)
//   • Next.js portal (dev/prod) → apps/patient-portal
// We probe both locations and use whichever exists.
// Override with env var HAIROS_FIXTURES_DIR for CI / deployment.
function resolveFixturesDir(): string {
  if (process.env.HAIROS_FIXTURES_DIR) return process.env.HAIROS_FIXTURES_DIR;
  const fromRoot = path.resolve(process.cwd(), "tests", "fixtures", "patients");
  if (fs.existsSync(fromRoot)) return fromRoot;
  const fromPortal = path.resolve(process.cwd(), "../..", "tests", "fixtures", "patients");
  if (fs.existsSync(fromPortal)) return fromPortal;
  return fromRoot; // fallback — will produce a clear "not found" error
}

function resolveBaselinesDir(): string {
  if (process.env.HAIROS_BASELINES_DIR) return process.env.HAIROS_BASELINES_DIR;
  const fromRoot = path.resolve(process.cwd(), "tests", "baselines");
  if (fs.existsSync(fromRoot)) return fromRoot;
  return path.resolve(process.cwd(), "../..", "tests", "baselines");
}

const FIXTURES_DIR = resolveFixturesDir();
const BASELINES_DIR = resolveBaselinesDir();

/**
 * Load a single fixture by its patient ID (filename without .json).
 */
export function loadClinicalFixture(fixtureId: string): ClinicalPatientFixture {
  const filePath = path.join(FIXTURES_DIR, `${fixtureId}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`[FixtureLoader] Fixture not found: ${filePath}`);
  }
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;
  if (raw.patient && raw.questionnaireAnswers) {
    const fixture = raw as ClinicalPatientFixture;
    validateFixtureShape(fixture, fixtureId);
    return fixture;
  }
  const { adaptLegacyFixture } = require("./fixtureAdapter") as typeof import("./fixtureAdapter");
  return adaptLegacyFixture(fixtureId);
}

/**
 * Load all fixtures from the patients directory.
 */
export function loadAllClinicalFixtures(): ClinicalPatientFixture[] {
  if (!fs.existsSync(FIXTURES_DIR)) {
    throw new Error(`[FixtureLoader] Fixtures directory not found: ${FIXTURES_DIR}`);
  }
  return fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const raw = fs.readFileSync(path.join(FIXTURES_DIR, f), "utf-8");
      const fixture = JSON.parse(raw) as ClinicalPatientFixture;
      if (!fixture.budget) fixture.budget = "STANDARD";
      return fixture;
    });
}

/**
 * Load all fixtures matching a category prefix (e.g. "pcos_", "male_aga_").
 */
export function loadFixturesByCategory(prefix: string): ClinicalPatientFixture[] {
  return loadAllClinicalFixtures().filter((f) =>
    f.patient.id.toLowerCase().startsWith(prefix.toLowerCase())
  );
}

/**
 * Load a baseline output snapshot for a fixture, if it exists.
 */
export function loadBaseline(fixtureId: string): Record<string, unknown> | null {
  const filePath = path.join(BASELINES_DIR, `${fixtureId}.baseline.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as Record<string, unknown>;
}

/**
 * Write a baseline snapshot to disk.
 */
export function writeBaseline(fixtureId: string, data: Record<string, unknown>): void {
  if (!fs.existsSync(BASELINES_DIR)) {
    fs.mkdirSync(BASELINES_DIR, { recursive: true });
  }
  const filePath = path.join(BASELINES_DIR, `${fixtureId}.baseline.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * List all fixture IDs from the patients directory.
 */
export function listFixtureIds(): string[] {
  if (!fs.existsSync(FIXTURES_DIR)) return [];
  return fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

// ─────────────────────────────────────────────────────────────────────────────
// BUDGET PROFILES
// ─────────────────────────────────────────────────────────────────────────────

export type BudgetTier = "ESSENTIAL" | "STANDARD" | "COMPREHENSIVE";

export function budgetForFixture(fixture: ClinicalPatientFixture): { tier: BudgetTier; maxKits: number } {
  const budgetMap: Record<BudgetTier, { tier: BudgetTier; maxKits: number }> = {
    ESSENTIAL: { tier: "ESSENTIAL", maxKits: 2 },
    STANDARD: { tier: "STANDARD", maxKits: 5 },
    COMPREHENSIVE: { tier: "COMPREHENSIVE", maxKits: 7 },
  };
  return budgetMap[fixture.budget ?? "STANDARD"];
}

// ─────────────────────────────────────────────────────────────────────────────
// CLINIC CONFIG — All kits open for regression testing
// ─────────────────────────────────────────────────────────────────────────────

export const OPEN_CLINIC = {
  clinicId: "sandbox-qa-clinic",
  availableKits: [
    "HAIR FACT TE GOLD",
    "HAIR FACT TE GOLD VEG",
    "PRO FACT META B",
    "PRO FACT META B HYPOTHYROID",
    "PRO FACT META B PCOS",
    "PRO FACT META B MENOPAUSE",
    "PRO FACT META B POSTMENOPAUSE",
    "F-PCOS -1",
    "F-PCOS VEG -1",
    "FPHL",
    "MPHL",
    "IRON UP GOLD",
    "PRO FACT GI GOLD",
    "OXIDATIVE STRESS",
    "RAPID WEIGHT LOSS SHIELD",
    "PHENOTYPE INFLAMATION",
    "PRO IMMUNE GOLD",
    "PRO IMMUNE VEG",
    "HAIR FACT HAIR BREAKAGE REPAIR(HBR)",
    "EARLY GREYING CARE GOLD",
    "EARLY GREYING CARE VEG",
    "LACTIHEALTH",
    "HAIR FACT TTM (OCD)",
    "HAIR FACT ALOPECIA AREATA",
    "HAIR FACT NIGHT SHIFT",
    "HAIR FACT FREQUENT FLYERS",
    "HAIR FACT PERI MENOPAUSE",
    "HAIR FACT PERI MENOPAUSE VEG",
    "HEALTHY - 9",
    "PRO FACT THYROID CARE",
    "FH WELL 3",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

export function validateFixtureShape(fixture: unknown, id: string): void {
  const f = fixture as ClinicalPatientFixture;
  const errors: string[] = [];

  if (!f.patient?.id) errors.push("Missing patient.id");
  if (!f.patient?.sex) errors.push("Missing patient.sex");
  if (!f.patient?.age) errors.push("Missing patient.age");
  if (!f.questionnaireAnswers) errors.push("Missing questionnaireAnswers");
  if (!f.questionnaireAnswers?.sex) errors.push("Missing questionnaireAnswers.sex");
  if (!f.questionnaireAnswers?.goal) errors.push("Missing questionnaireAnswers.goal");
  if (!f.expectedClinicalSignals) errors.push("Missing expectedClinicalSignals");
  if (!Array.isArray(f.expectedClinicalSignals?.diagnoses)) errors.push("expectedClinicalSignals.diagnoses must be array");
  if (!f.expectedRecommendations) errors.push("Missing expectedRecommendations");
  if (!Array.isArray(f.expectedRecommendations?.mustIncludeKits)) errors.push("expectedRecommendations.mustIncludeKits must be array");
  if (!f.expectedNarrativePatterns) errors.push("Missing expectedNarrativePatterns");

  if (errors.length > 0) {
    throw new Error(`[FixtureLoader] Invalid fixture "${id}":\n  - ${errors.join("\n  - ")}`);
  }
}

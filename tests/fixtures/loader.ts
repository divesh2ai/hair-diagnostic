import * as fs from 'fs';
import * as path from 'path';
import type { PatientAnswers } from '../../src/packages/types';

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface PatientFixture {
  id: string;
  description: string;
  budget: 'ESSENTIAL' | 'STANDARD' | 'COMPREHENSIVE';
  answers: PatientAnswers;
  expected: FixtureExpectations;
}

export interface FixtureExpectations {
  diagnoses: string[];
  scalpStates: string[];
  rootCauses: string[];
  therapyNeeds: string[];
  topKit: string;
  mustIncludeKits: string[];
  mustExcludeKits: string[];
  mustTriggerRules: string[];
  mustBlockRules: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// LOADER
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURES_DIR = path.join(__dirname, 'patients');

export function loadFixture(fixtureId: string): PatientFixture {
  const filePath = path.join(FIXTURES_DIR, `${fixtureId}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Fixture not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  const fixture = JSON.parse(raw) as PatientFixture;
  if (!fixture.budget) fixture.budget = 'STANDARD';
  return fixture;
}

export function loadAllFixtures(): PatientFixture[] {
  if (!fs.existsSync(FIXTURES_DIR)) {
    throw new Error(`Fixtures directory not found: ${FIXTURES_DIR}`);
  }
  return fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const raw = fs.readFileSync(path.join(FIXTURES_DIR, f), 'utf-8');
      const fixture = JSON.parse(raw) as PatientFixture;
      if (!fixture.budget) fixture.budget = 'STANDARD';
      return fixture;
    });
}

export function loadFixturesByCategory(category: string): PatientFixture[] {
  return loadAllFixtures().filter((f) => f.id.startsWith(category));
}

// ─────────────────────────────────────────────────────────────────────────────
// BUDGET PROFILES
// ─────────────────────────────────────────────────────────────────────────────

export type BudgetTier = 'ESSENTIAL' | 'STANDARD' | 'COMPREHENSIVE';

export function budgetForFixture(fixture: PatientFixture) {
  const budgetMap: Record<BudgetTier, { tier: BudgetTier; maxKits: number }> = {
    ESSENTIAL:     { tier: 'ESSENTIAL',     maxKits: 2 },
    STANDARD:      { tier: 'STANDARD',      maxKits: 5 },
    COMPREHENSIVE: { tier: 'COMPREHENSIVE', maxKits: 7 },
  };
  return budgetMap[fixture.budget ?? 'STANDARD'];
}

// ─────────────────────────────────────────────────────────────────────────────
// OPEN CLINIC CONFIG (all kits available — used for regression tests)
// ─────────────────────────────────────────────────────────────────────────────

export const OPEN_CLINIC = {
  clinicId: 'regression-test-clinic',
  availableKits: [
    'HAIR FACT TE GOLD',
    'HAIR FACT TE GOLD VEG',
    'PRO FACT META B',
    'PRO FACT META B HYPOTHYROID',
    'PRO FACT META B PCOS',
    'PRO FACT META B MENOPAUSE',
    'PRO FACT META B POSTMENOPAUSE',
    'F-PCOS -1',
    'F-PCOS VEG -1',
    'FPHL',
    'FPHL PLUS',
    'MPHL',
    'MPHL PLUS',
    'IRON UP GOLD',
    'PRO FACT GI GOLD',
    'OXIDATIVE STRESS',
    'RAPID WEIGHT LOSS SHIELD',
    'PHENOTYPE INFLAMATION',
    'PRO IMMUNE GOLD',
    'PRO IMMUNE VEG',
    'HAIR FACT HAIR BREAKAGE REPAIR(HBR)',
    'EARLY GREYING CARE GOLD',
    'EARLY GREYING CARE VEG',
    'LACTIHEALTH',
    'HAIR FACT TTM (OCD)',
    'HAIR FACT ALOPECIA AREATA',
    'HAIR FACT NIGHT SHIFT',
    'HAIR FACT FREQUENT FLYERS',
    'HAIR FACT PERI MENOPAUSE',
    'HAIR FACT PERI MENOPAUSE VEG',
    'HEALTHY - 9',
    'PRO FACT THYROID CARE',
    'FH WELL 3',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE VALIDATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function validateFixtureSchema(fixture: PatientFixture): string[] {
  const errors: string[] = [];
  if (!fixture.id)          errors.push('Missing id');
  if (!fixture.description) errors.push('Missing description');
  if (!fixture.answers)     errors.push('Missing answers');
  if (!fixture.expected)    errors.push('Missing expected');
  if (!fixture.answers?.sex)  errors.push('Missing answers.sex');
  if (!fixture.answers?.age)  errors.push('Missing answers.age');
  if (!fixture.answers?.goal) errors.push('Missing answers.goal');
  if (!Array.isArray(fixture.expected?.diagnoses))      errors.push('expected.diagnoses must be array');
  if (!Array.isArray(fixture.expected?.mustIncludeKits)) errors.push('expected.mustIncludeKits must be array');
  if (!Array.isArray(fixture.expected?.mustExcludeKits)) errors.push('expected.mustExcludeKits must be array');
  if (!Array.isArray(fixture.expected?.mustTriggerRules)) errors.push('expected.mustTriggerRules must be array');
  if (!Array.isArray(fixture.expected?.mustBlockRules))   errors.push('expected.mustBlockRules must be array');
  return errors;
}

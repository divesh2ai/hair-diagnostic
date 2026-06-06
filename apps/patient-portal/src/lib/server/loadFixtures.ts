/**
 * loadFixtures.ts — Portal-aware fixture discovery
 *
 * Resolves the monorepo fixtures directory correctly regardless of whether
 * the process is started from the portal app (apps/patient-portal/) or the
 * monorepo root.  Supports an env-var override for CI / deployment.
 *
 * This is the ONLY place in the portal that reads fixture files directly.
 * All other modules (runQASession, evaluateClinicalProfile, …) are called
 * from the API route and do NOT need this loader themselves.
 */

import fs from 'fs';
import path from 'path';

// ─── Path Resolution ─────────────────────────────────────────────────────────

function resolveFixturesDir(): string {
  // Explicit override — useful for Docker / CI
  if (process.env.HAIROS_FIXTURES_DIR) return process.env.HAIROS_FIXTURES_DIR;

  // When Next.js dev/prod starts from apps/patient-portal/:
  //   process.cwd() = D:\Dr Fact Folder\RAG Chatbot\apps\patient-portal
  //   ../.. = monorepo root
  const fromPortal = path.resolve(process.cwd(), '../../tests/fixtures/patients');
  if (fs.existsSync(fromPortal)) return fromPortal;

  // Fallback: process started from monorepo root (e.g. jest)
  const fromRoot = path.resolve(process.cwd(), 'tests/fixtures/patients');
  if (fs.existsSync(fromRoot)) return fromRoot;

  // Return the portal-relative path so error messages are clear
  return fromPortal;
}

const FIXTURES_DIR = resolveFixturesDir();

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface FixtureMetadata {
  id: string;
  title: string;
  description: string;
  condition: string;
  severity: string;
  tags: string[];
  budget: 'ESSENTIAL' | 'STANDARD' | 'COMPREHENSIVE';
  expectedKits: string[];
  patient: { age: number; sex: string };
}

export interface LoadedFixture {
  metadata: FixtureMetadata;
  /** Raw questionnaire answers — compatible with PatientAnswers */
  answers: Record<string, unknown>;
  expected: {
    diagnoses: string[];
    scalpStates: string[];
    rootCauses: string[];
    therapyNeeds: string[];
    mustIncludeKits: string[];
    mustExcludeKits: string[];
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Returns metadata for every fixture in the patients directory. */
export function loadFixtureMetadataList(): FixtureMetadata[] {
  if (!fs.existsSync(FIXTURES_DIR)) {
    console.warn(`[loadFixtures] Fixtures directory not found: ${FIXTURES_DIR}`);
    return [];
  }
  return fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((filename) => {
      const filePath = path.join(FIXTURES_DIR, filename);
      try {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
        return [extractMetadata(filename.replace(/\.json$/, ''), raw)];
      } catch (err) {
        console.error(`[loadFixtures] Skipping unparseable fixture ${filename}:`, err);
        return [];
      }
    });
}

/** Load a single fixture by ID (filename without .json).  Throws if not found. */
export function loadFixtureById(id: string): LoadedFixture {
  const filePath = path.join(FIXTURES_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `[loadFixtures] Fixture "${id}" not found. Looked in: ${FIXTURES_DIR}`
    );
  }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
  return parseFullFixture(id, raw);
}

// ─── Internal Parsers ─────────────────────────────────────────────────────────

function extractMetadata(id: string, raw: Record<string, unknown>): FixtureMetadata {
  // Supports both new format (patient + questionnaireAnswers) and legacy format (answers + expected)
  const isNew = 'patient' in raw && 'questionnaireAnswers' in raw;

  const patientBlock = (isNew ? raw.patient : null) as Record<string, unknown> | null;
  const answersBlock = (isNew ? raw.questionnaireAnswers : raw.answers) as Record<string, unknown> | null;
  const signals      = (isNew ? raw.expectedClinicalSignals : null) as Record<string, unknown> | null;
  const legacy       = (!isNew ? raw.expected : null) as Record<string, unknown> | null;
  const recs         = (isNew ? raw.expectedRecommendations : null) as Record<string, unknown> | null;

  const diagnoses     = ((signals?.diagnoses   ?? legacy?.diagnoses   ?? []) as string[]);
  const rootCauses    = ((signals?.rootCauses  ?? legacy?.rootCauses  ?? []) as string[]);
  const severity      = String(signals?.severity ?? 'MODERATE');
  const mustInclude   = ((recs?.mustIncludeKits ?? legacy?.mustIncludeKits ?? []) as string[]);

  return {
    id,
    title: id.replace(/_\d+$/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    description: String(raw.description ?? raw.clinicalNotes ?? id),
    condition: diagnoses[0] ?? 'UNKNOWN',
    severity,
    tags: [...new Set([...diagnoses, ...rootCauses])],
    budget: (raw.budget ?? 'STANDARD') as 'ESSENTIAL' | 'STANDARD' | 'COMPREHENSIVE',
    expectedKits: mustInclude,
    patient: {
      age: Number(patientBlock?.age ?? answersBlock?.age ?? 35),
      sex: String(patientBlock?.sex ?? answersBlock?.sex ?? 'Unknown'),
    },
  };
}

function parseFullFixture(id: string, raw: Record<string, unknown>): LoadedFixture {
  const isNew = 'patient' in raw && 'questionnaireAnswers' in raw;

  const answersBlock = (isNew ? raw.questionnaireAnswers : raw.answers) as Record<string, unknown>;
  const signals      = (isNew ? raw.expectedClinicalSignals : null) as Record<string, unknown> | null;
  const legacy       = (!isNew ? raw.expected : null) as Record<string, unknown> | null;
  const recs         = (isNew ? raw.expectedRecommendations : null) as Record<string, unknown> | null;

  return {
    metadata: extractMetadata(id, raw),
    answers: answersBlock ?? {},
    expected: {
      diagnoses:     ((signals?.diagnoses     ?? legacy?.diagnoses     ?? []) as string[]),
      scalpStates:   ((signals?.scalpStates   ?? legacy?.scalpStates   ?? []) as string[]),
      rootCauses:    ((signals?.rootCauses    ?? legacy?.rootCauses    ?? []) as string[]),
      therapyNeeds:  ((signals?.therapyNeeds  ?? legacy?.therapyNeeds  ?? []) as string[]),
      mustIncludeKits: ((recs?.mustIncludeKits ?? legacy?.mustIncludeKits ?? []) as string[]),
      mustExcludeKits: ((recs?.mustExcludeKits ?? legacy?.mustExcludeKits ?? []) as string[]),
    },
  };
}

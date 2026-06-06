/**
 * Loads the three frozen registries once and exposes them as typed
 * read-only structures. Crashes loudly on any malformed entry — the
 * pipeline depends on these invariants.
 */

import fs from "node:fs";
import path from "node:path";

const REG_ROOT = path.resolve(__dirname, "..", "..", "..", "..", "src", "packages", "registries");

export interface SignalEntry {
  id: string;
  confidenceBase: number;
  pathwayRelevance: Array<{ pathwayId: string; weight: number; modulation?: string }>;
  causeRelevance: Array<{ causeId: string; contribution: number }>;
  conflictingSignals?: string[];
}

export interface PathwayEntry {
  id: string;
  activationRules: {
    gateMode: "required-any" | "required-aggregate" | "modulator-no-gate";
    minActivation: number;
    amplifiedBy?: Array<{ pathwayId: string; magnitude: number; when: string }>;
  };
  requiredSignals: Array<{ signalId: string; weight: number; minConfidence?: number }>;
  supportingSignals: Array<{ signalId: string; weight: number }>;
  inhibitorySignals?: Array<{ signalId: string; weight: number }>;
}

export interface CauseLegacyMapping {
  legacyDiagnosisKey: string;
  parityStrategy: string;
  coWith?: string;
}

export interface CauseEntry {
  id: string;
  priorProbability: number;
  contributingPathways: Array<{
    pathwayId: string;
    logLikelihoodRatio: number;
    role: string;
    minActivation: number;
  }>;
  contributingSignals: Array<{
    signalId: string;
    logLikelihoodRatio: number;
    role: string;
  }>;
  dissentRules: { competingCauses: string[]; maxDissentForLead: number };
  compositeRule?: {
    minimumActivePathways: number;
    minimumPathwayActivation: number;
    minimumDissentBetweenTopTwoCauses: number;
  };
  legacyMappings: CauseLegacyMapping[];
}

export interface Registries {
  signals: Map<string, SignalEntry>;
  pathways: Map<string, PathwayEntry>;
  causes: Map<string, CauseEntry>;
  /** All cause entries in declaration order (priors). */
  causesOrdered: CauseEntry[];
}

let cached: Registries | null = null;

export function loadRegistries(): Registries {
  if (cached) return cached;

  const rawSignals = JSON.parse(fs.readFileSync(path.join(REG_ROOT, "signals", "registry.json"), "utf8")) as { signals: SignalEntry[] };
  const rawPathways = JSON.parse(fs.readFileSync(path.join(REG_ROOT, "pathways", "registry.json"), "utf8")) as { pathways: PathwayEntry[] };
  const rawCauses = JSON.parse(fs.readFileSync(path.join(REG_ROOT, "causes", "registry.json"), "utf8")) as { causes: CauseEntry[] };

  const signals = new Map<string, SignalEntry>();
  for (const s of rawSignals.signals) signals.set(s.id, s);

  const pathways = new Map<string, PathwayEntry>();
  for (const p of rawPathways.pathways) pathways.set(p.id, p);

  const causes = new Map<string, CauseEntry>();
  for (const c of rawCauses.causes) causes.set(c.id, c);

  cached = { signals, pathways, causes, causesOrdered: rawCauses.causes };
  return cached;
}

export function resetRegistriesForTest(): void {
  cached = null;
}

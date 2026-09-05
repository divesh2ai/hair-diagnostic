// The single authority on how an engine diagnosis becomes doctor-facing text.
//
// ── Why this module exists ──────────────────────────────────────────────────
// The consultation composer used to take its headline diagnosis from
// `clinicalReport.patientSummary.clinicalInterpretation[0].condition`, on the
// stated assumption that the engine puts the leading condition first. It does
// not. That array is built in QUESTIONNAIRE order — the Q4 "suspected cause"
// answers are mapped first — de-duplicated and sliced. Position 0 is therefore
// whichever cause checkbox the patient happened to tick, and nothing else.
//
// The consequence was a doctor-facing headline that contradicted the engine:
// a PCOS_ONLY case headlined "Metabolic — polygenic drivers", a THYROID_HYPO
// case headlined "Stress-induced TE", an AGA_MALE_123 case on an MPHL protocol
// headlined "Stress-Related Shedding". 20 of 21 stored staging consultations
// disagreed with their own `primaryKey`.
//
// ── The contract ────────────────────────────────────────────────────────────
// `ClinicalProfile.primaryDiagnosis` is the authoritative diagnosis. It is a
// `DiagnosisKey` — a closed union — produced by `evaluateClinicalProfile` and
// persisted verbatim as `AIArtifact(SEVERITY_ANALYSIS).content.primaryDiagnosis`.
// `DIAGNOSIS_LABELS` is the approved human rendering of that union, and is
// typed `Record<DiagnosisKey, string>` so a new key cannot be added to the
// engine without a label being added here in the same commit.
//
// Nothing else may originate a primary diagnosis. Not interpretation order,
// not suspected causes, not the first evidence item, not the first
// recommendation, not narrative prose, not the kit sequence.

import type { DiagnosisKey } from "../../types";
import { DIAGNOSIS_LABELS } from "../narrative-engine/constants";

/**
 * Raised when the engine hands us a primary diagnosis outside `DiagnosisKey`.
 *
 * This is deliberately fatal for the primary. The alternative — quietly
 * substituting a neighbouring string, or title-casing the raw key into
 * something that reads like a clinical finding — is how the original defect
 * stayed invisible for so long. A composition that cannot name the diagnosis
 * must not produce a headline at all.
 */
export class UnsupportedPrimaryDiagnosisError extends Error {
  public readonly received: unknown;

  constructor(received: unknown) {
    super(
      `Unsupported primary diagnosis ${JSON.stringify(received)}. ` +
        `It is not a member of DiagnosisKey, so no approved label exists for it. ` +
        `Add the key to DiagnosisKey and DIAGNOSIS_LABELS together, or fix the engine.`,
    );
    this.name = "UnsupportedPrimaryDiagnosisError";
    this.received = received;
  }
}

/**
 * The label map's own keys are the runtime source of truth for membership.
 *
 * Derived from `DIAGNOSIS_LABELS` rather than written out a second time: the
 * map is typed `Record<DiagnosisKey, string>`, so TypeScript already refuses
 * to compile it with a key missing or misspelt. Re-listing the union here
 * would create a third copy that could drift from both.
 */
const DIAGNOSIS_KEYS: ReadonlySet<string> = new Set(Object.keys(DIAGNOSIS_LABELS));

/** Narrowing guard for values arriving from persisted JSON or across a boundary. */
export function isDiagnosisKey(value: unknown): value is DiagnosisKey {
  return typeof value === "string" && DIAGNOSIS_KEYS.has(value);
}

export interface ResolvedPrimaryDiagnosis {
  /** The authoritative engine key, unchanged. */
  key: DiagnosisKey;
  /** The approved human rendering of that key. */
  label: string;
}

/**
 * Resolve the doctor-facing primary diagnosis from the authoritative engine key.
 *
 * Deterministic and total over `DiagnosisKey`: the same key always yields the
 * same label, and the result depends on nothing except the key itself — not on
 * the patient's answer order, not on any array the report happens to carry.
 *
 * @throws UnsupportedPrimaryDiagnosisError when `raw` is not a `DiagnosisKey`.
 */
export function resolvePrimaryDiagnosis(raw: unknown): ResolvedPrimaryDiagnosis {
  if (!isDiagnosisKey(raw)) {
    throw new UnsupportedPrimaryDiagnosisError(raw);
  }
  return { key: raw, label: DIAGNOSIS_LABELS[raw] };
}

/**
 * Label a NON-primary diagnosis (a differential / secondary finding).
 *
 * Same map, softer failure. A differential is supporting context rather than
 * the clinical headline, and refusing to open a consultation because one
 * secondary key is unrecognised would deny the doctor a record over a detail.
 * Unknown keys degrade to a readable form of the key itself, which is honest —
 * it reads as an unmapped code rather than as an authored clinical finding.
 */
export function labelForSecondaryDiagnosis(raw: unknown): string {
  if (isDiagnosisKey(raw)) return DIAGNOSIS_LABELS[raw];
  return String(raw ?? "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─────────────────────────────────────────────────────────────────────────────
// CLINICAL SIGNAL REGISTRY — Phase 1 of HairOS V2 Intelligence Pipeline
//
// A ClinicalSignal is a *biological phenotype assertion* produced from one or
// more patient answers. Signals are the single source of truth from which the
// Pathway Engine (Phase 2), Root Cause Engine (Phase 3), Recovery Engine
// (Phase 4), Objective Engine (Phase 5), and Narrative Engine (Phase 7)
// reason.
//
// Design rules:
//   - Signals are biology-shaped, not scoring-shaped. (No "AGA_SCORE_+5" here —
//     that lives in clinical-engine/rules/.)
//   - Every signal carries its narrative meaning so downstream layers never
//     need to re-derive what the signal means in human terms.
//   - Detected signals carry the *evidence* that produced them, so the
//     Explainability Engine (Phase 10) can always answer "why".
//   - Weights are intentionally coarse (LOW / MEDIUM / HIGH) — pathway scoring
//     uses these as multipliers, not as raw numbers.
// ─────────────────────────────────────────────────────────────────────────────

/** High-level domain a signal belongs to. */
export type SignalCategory =
  | 'SHEDDING'             // hair-fall observations: count, duration
  | 'PATTERN'              // miniaturization / parting / grade evidence
  | 'SCALP'                // scalp surface phenotype (oily, dry, inflamed, …)
  | 'INFLAMMATION'         // active inflammatory drivers (scalp + systemic)
  | 'IMMUNE'               // immune dysregulation evidence
  | 'HORMONAL'             // PCOS, menopause, post-partum, pregnancy
  | 'THYROID'              // thyroid / metabolic-endocrine
  | 'METABOLIC'            // obesity, diabetes, sedentary
  | 'OXIDATIVE'            // smoking, vaping, alcohol, pollution
  | 'NUTRITIONAL'          // iron, vegetarian diet, crash dieting, GLP-1
  | 'GUT'                  // gut-hair axis
  | 'SHAFT'                // breakage, heat/chemical, hard water
  | 'LIFESTYLE'            // night shift, frequent flying, gym/bodybuilding
  | 'PSYCH_NEURO'          // stress, anxiety, depression, OCD/TTM
  | 'GENETIC'              // family history / genetic predisposition
  | 'ILLNESS'              // recent illness, surgery, medication, chronic medical
  | 'GOAL'                 // patient-stated goal (regrow-only, grey concern, …)
  | 'DEMOGRAPHIC';         // age, sex modifiers that condition other signals

/** Biological system the signal speaks to. Pathway Engine reads this. */
export type BiologicalSystem =
  | 'HAIR_CYCLE'           // anagen/telogen dynamics
  | 'FOLLICLE'             // miniaturization, follicular reserve
  | 'SCALP_BARRIER'        // sebaceous, microbiome, barrier integrity
  | 'IMMUNE_SYSTEM'
  | 'ENDOCRINE'            // sex hormones, thyroid, insulin
  | 'METABOLIC_SYSTEM'
  | 'REDOX'                // oxidative / antioxidant balance
  | 'NUTRITION'            // micronutrient + protein supply
  | 'GUT_AXIS'
  | 'SHAFT_INTEGRITY'
  | 'CIRCADIAN'
  | 'NEURO_PSYCH'
  | 'GENOMIC'
  | 'SYSTEMIC_HEALTH'
  | 'NONE';                // demographic / goal signals

export type SignalWeight = 'LOW' | 'MEDIUM' | 'HIGH';

/** Catalog entry — describes what the signal *means*, not whether it fired. */
export interface ClinicalSignal {
  readonly id: string;
  readonly category: SignalCategory;
  readonly biologicalSystem: BiologicalSystem;
  /** How heavily this signal modulates severity in downstream engines. */
  readonly severityWeight: SignalWeight;
  /** How diagnostic this signal is (HIGH = near-pathognomonic, LOW = soft hint). */
  readonly confidenceWeight: SignalWeight;
  /** One-sentence biological/clinical meaning, used by the Narrative Engine. */
  readonly narrativeMeaning: string;
  /** Optional: pathway IDs this signal *typically* contributes to. Authoring
   *  hint for Phase 2 — the pathway engine still computes its own contributions. */
  readonly typicalPathways?: readonly string[];
}

/** A single piece of evidence that produced a DetectedSignal. */
export interface SignalEvidence {
  /** Question id from questionnaire.schema.json — e.g. "duration", "scalp". */
  readonly questionId: string;
  /** The matched answer fragment (substring, label, or raw value). */
  readonly value: string;
  /** Optional human-readable note ("Female, age < 30 + Genetics"). */
  readonly note?: string;
}

/** A signal that *fired* for a specific patient, with its evidence trail. */
export interface DetectedSignal {
  readonly id: string;
  readonly evidence: readonly SignalEvidence[];
  /** Effective confidence after combining catalog confidence + evidence count. */
  readonly confidence: SignalWeight;
  /** Effective severity from catalog × evidence strength. */
  readonly severity: SignalWeight;
}

/** Output of the registry for one patient. */
export interface DetectedSignalSet {
  readonly signals: readonly DetectedSignal[];
  /** Map for O(1) lookup. */
  readonly byId: Readonly<Record<string, DetectedSignal>>;
  /** Catalog version this run was produced against. */
  readonly registryVersion: string;
}

/** Convenience predicate type for catalog lookup helpers. */
export type SignalId = string;

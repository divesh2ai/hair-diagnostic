/**
 * HAIROS_REPLAY_CASE_SCHEMA.ts
 *
 * Canonical TypeScript schema for HairOS Clinical Replay Corpus V2.
 *
 * Every case file under tests/fixtures/replay-corpus-v2/cases/*.json
 * MUST conform to ClinicalReplayCase. The ReplayRunner reads only
 * these fields. The validators read only the `expected*` block.
 *
 * Stable contract: bumping any required field requires a corpus
 * version bump in HAIROS_CLINICAL_REPLAY_CORPUS_V2.md.
 */

// ── Registry-grounded ID aliases ────────────────────────────────────────────
// These are nominal aliases. The actual valid value set lives in the
// registries under src/packages/registries/{signals,pathways,causes}/registry.json
// and is enforced at validation time (see HAIROS_VALIDATION_ENGINE_SPEC.md).

export type SignalId = string;     // must exist in signals/registry.json
export type PathwayId = string;    // must exist in pathways/registry.json
export type CauseId = string;      // must exist in causes/registry.json
export type LegacyDiagnosisKey = string; // legacy enum (DrFACT_Condition_Mapping)

// ── Severity, class enums ──────────────────────────────────────────────────

export type Severity = "mild" | "moderate" | "severe";

export type PresentationClarity =
  | "clear"
  | "ambiguous"
  | "conflicting"
  | "edge_case";

export type ProtocolClass =
  | "MPHL"                // male AGA driven
  | "FPHL"                // female AGA driven
  | "TE_ACUTE"
  | "TE_CHRONIC"
  | "TE_POST_ILLNESS"
  | "PCOS"
  | "HORMONAL"            // thyroid / peri-menopause
  | "INFLAMMATORY"
  | "AUTOIMMUNE_AA"
  | "NUTRITIONAL"
  | "GUT_AXIS"
  | "SHAFT_REPAIR"
  | "MULTIFACTORIAL";

export type TherapyNeed =
  | "DHT_SUPPRESSION"
  | "IMMUNE_MODULATION"
  | "INFLAMMATION_CONTROL"
  | "CYCLE_RESTORATION"
  | "STRESS_DOWNREGULATION"
  | "NUTRITIONAL_REPLETION"
  | "ENDOCRINE_OPTIMIZATION"
  | "METABOLIC_OPTIMIZATION"
  | "GUT_REPAIR"
  | "SCALP_DECONGESTION"
  | "SHAFT_RECONSTRUCTION"
  | "AUTOIMMUNE_QUIESCENCE";

export type MonitoringRequirement =
  | "FERRITIN_4M"
  | "VITAMIN_D_4M"
  | "B12_4M"
  | "TSH_3M"
  | "FREE_T4_3M"
  | "FREE_T3_3M"
  | "HBA1C_3M"
  | "ANDROGEN_PANEL_6M"
  | "SHED_COUNT_MONTHLY"
  | "GLOBAL_PHOTO_3M"
  | "TRICHOSCOPY_6M"
  | "SCALP_EXAM_3M"
  | "WEIGHT_MONTHLY"
  | "MENSTRUAL_DIARY"
  | "STRESS_PHQ_MONTHLY";

export type NarrativeTheme =
  | "ANDROGENIC_PROGRESSION"
  | "CYCLE_RESET"
  | "ENDOCRINE_REBALANCE"
  | "INFLAMMATORY_QUIESCENCE"
  | "AUTOIMMUNE_CONTROL"
  | "NUTRITIONAL_RESTORATION"
  | "GUT_RECOVERY"
  | "SHAFT_RECONSTRUCTION"
  | "STRESS_RECOVERY"
  | "MULTIFACTORIAL_COORDINATION"
  | "REVERSIBILITY_REASSURANCE"
  | "EXPECTATION_SETTING_SLOW";

// ── Demographic & questionnaire ────────────────────────────────────────────

export interface DemographicProfile {
  /** "Male" | "Female" — clinical sex, not gender identity. */
  sex: "Male" | "Female";
  /** Integer string years; range enforced by validator. */
  age: string;
  /** Free-text region or null. Used by environmental risk scoring. */
  region?: string | null;
  /** "Vegetarian" | "Vegan" | "Mixed" — defaults to "Mixed". */
  dietType?: "Vegetarian" | "Vegan" | "Mixed";
  /** Optional BMI band: "underweight" | "normal" | "overweight" | "obese". */
  bmiBand?: "underweight" | "normal" | "overweight" | "obese";
}

/**
 * QuestionnaireAnswers mirrors the legacy Q-engine answer shape so cases
 * can drive both the legacy adapter and the new ClinicalProfile path.
 *
 * Keys MUST match the question keys used by the production questionnaire
 * (sex, age, goal[], grade, scalp[], cause[], lifestyle[], thyroid[],
 *  hormonal[], immunity[], deficiency[], gut[], diet[], hairtype[],
 *  treatment[], duration, count, ...).
 *
 * Any answers field whose key is not in the legacy schema MUST live under
 * `extended` to keep the legacy adapter pure.
 */
export interface QuestionnaireAnswers {
  sex: "Male" | "Female";
  age: string;
  goal: string[];
  grade?: string;
  scalp?: string[];
  cause?: string[];
  lifestyle?: string[];
  thyroid?: string[];
  hormonal?: string[];
  immunity?: string[];
  deficiency?: string[];
  gut?: string[];
  diet?: string[];
  hairtype?: string[];
  treatment?: string[];
  duration?: string;
  count?: string;
  extended?: Record<string, unknown>;
}

// ── Expectations ───────────────────────────────────────────────────────────

export interface ExpectedSignalAssertion {
  signalId: SignalId;
  /** Minimum confidence we expect the signal extractor to attach. */
  minConfidence: number; // 0..1
  /** Optional — if set, signal MUST fire as a "primary" surface in UI. */
  mustBePrimary?: boolean;
}

export interface ExpectedPathwayAssertion {
  pathwayId: PathwayId;
  /** Minimum activation we expect the pathway engine to emit. */
  minActivation: number; // 0..1
  /** "leading" | "supporting" | "modulator" — semantic role for the case. */
  role: "leading" | "supporting" | "modulator";
}

export interface ExpectedRootCauseAssertion {
  causeId: CauseId;
  /** Minimum posterior probability. */
  minPosterior: number; // 0..1
  /** "lead" | "co-lead" | "candidate" — surfacing role. */
  surfaceAs: "lead" | "co-lead" | "candidate";
}

export interface ExpectedDiagnosis {
  /** Canonical primary diagnosis (cause-system canonical name). */
  primary: CauseId;
  /** Optional secondary co-explanations (may be empty). */
  secondary?: CauseId[];
  /** Legacy enum the diagnosis adapter MUST emit (parity gate). */
  legacyDiagnosisKey: LegacyDiagnosisKey;
  /** Permissible legacy alternates (parity tolerance set). */
  legacyDiagnosisKeyAlternates?: LegacyDiagnosisKey[];
}

export interface ExpectedProtocol {
  protocolClass: ProtocolClass;
  /** Kit-id substrings that MUST appear in the recommended kit stack. */
  mustIncludeKits: string[];
  /** Kit-id substrings that MUST NOT appear. */
  mustExcludeKits: string[];
  /** Rule IDs from the kit-scorer that MUST fire (gates the kit set). */
  mustTriggerRules?: string[];
  /** Rule IDs that MUST block (the case must NOT trip these gates). */
  mustBlockRules?: string[];
}

export interface ExpectedMonitoring {
  required: MonitoringRequirement[];
  /** Optional — surfaced if relevant but not required. */
  recommended?: MonitoringRequirement[];
  /** Forbidden — MUST NOT be requested (over-monitoring guard). */
  forbidden?: MonitoringRequirement[];
}

export interface ExpectedNarrative {
  themes: NarrativeTheme[];
  /** Substring tokens the narrative MUST contain (case-insensitive). */
  mustContainTokens?: string[];
  /** Substring tokens the narrative MUST NOT contain. */
  mustNotContainTokens?: string[];
}

// ── Adversarial extension ──────────────────────────────────────────────────

export interface AdversarialMeta {
  /** Marks this as an adversarial case for the failure registry. */
  isAdversarial: true;
  /** The cause/condition this case is designed to misdiagnose if naive. */
  expectedPrimaryDriver: CauseId;
  /** Co-drivers ranked. */
  expectedSecondaryDrivers: CauseId[];
  /** Documented failure modes the case is designed to surface. */
  commonFailureModes: Array<{
    failureMode: string;
    impactedComponent:
      | "SIGNAL"
      | "PATHWAY"
      | "ROOTCAUSE"
      | "PROTOCOL"
      | "MONITORING"
      | "NARRATIVE";
    description: string;
  }>;
}

// ── Top-level ──────────────────────────────────────────────────────────────

export interface ClinicalReplayCase {
  /** Stable kebab-case id; MUST match filename without .json */
  caseId: string;
  /** Corpus version this case was authored under. */
  corpusVersion: "2.0.0";
  /** One-line human description for the failure registry UI. */
  description: string;
  /** Primary clinical category (drives distribution coverage). */
  category:
    | "MALE_AGA"
    | "FPHL"
    | "PCOS"
    | "ACUTE_TE"
    | "CHRONIC_TE"
    | "POST_COVID_TE"
    | "ALOPECIA_AREATA"
    | "INFLAMMATORY_SCALP"
    | "MULTIFACTORIAL";
  severity: Severity;
  presentationClarity: PresentationClarity;

  demographicProfile: DemographicProfile;
  questionnaireAnswers: QuestionnaireAnswers;

  expectedSignals: ExpectedSignalAssertion[];
  expectedPathways: ExpectedPathwayAssertion[];
  expectedRootCauses: ExpectedRootCauseAssertion[];
  expectedDiagnosis: ExpectedDiagnosis;
  expectedSeverity: Severity;
  expectedProtocolClass: ProtocolClass;
  expectedTherapyNeeds: TherapyNeed[];
  expectedMonitoringRequirements: ExpectedMonitoring;
  expectedNarrativeThemes: ExpectedNarrative;

  /**
   * REQUIRED. Must explicitly explain:
   *  - why the expected primary diagnosis is correct
   *  - why each plausible competing diagnosis is less likely
   * Two paragraphs minimum. No placeholder text.
   */
  clinicalRationale: {
    whyPrimary: string;
    whyNotCompetitors: Record<CauseId, string>;
  };

  /** Present iff the case is adversarial. */
  adversarial?: AdversarialMeta;
}

// ── Discriminators / helpers ──────────────────────────────────────────────

export const isAdversarialCase = (
  c: ClinicalReplayCase
): c is ClinicalReplayCase & { adversarial: AdversarialMeta } =>
  c.adversarial?.isAdversarial === true;

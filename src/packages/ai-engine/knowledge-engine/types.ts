/**
 * Knowledge Engine — Core Type Definitions
 *
 * All interfaces, enums, and registries for the HairOS structured
 * knowledge layer. No AI generation. No LLM calls. Deterministic only.
 */

// Re-export shared platform types so engine-internal files have one import point
export type {
  DiagnosisKey,
  TherapyNeed,
  RootCause,
  ScalpState,
  Severity,
  KitId,
} from '../../types';

import type { DiagnosisKey, TherapyNeed, RootCause, ScalpState, Severity, KitId } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// CLASSIFICATION ENUMS
// ─────────────────────────────────────────────────────────────────────────────

export type EvidenceLevel =
  | 'STRONG'       // RCT / meta-analysis
  | 'MODERATE'     // cohort or controlled studies
  | 'EMERGING'     // case series or preliminary trials
  | 'EXPERT'       // clinical consensus / expert opinion
  | 'THEORETICAL'; // mechanistic rationale only

export type IngredientCategory =
  | 'DHT_INHIBITOR'
  | 'VASODILATOR'
  | 'PEPTIDE'
  | 'ANTIFUNGAL'
  | 'ANTI_INFLAMMATORY'
  | 'VITAMIN_MINERAL'
  | 'ADAPTOGEN'
  | 'HORMONE_MODULATOR'
  | 'ANTIOXIDANT'
  | 'KERATIN_SUPPORT'
  | 'PROBIOTIC'
  | 'BOTANICAL'
  | 'GROWTH_FACTOR';

export type TherapyCategory =
  | 'TOPICAL'
  | 'ORAL_SUPPLEMENT'
  | 'PRESCRIPTION_ORAL'
  | 'INJECTABLE'
  | 'DEVICE'
  | 'LIFESTYLE';

export type PrognosisTimeframe =
  | 'SHORT_TERM'   // 0–3 months
  | 'MEDIUM_TERM'  // 3–6 months
  | 'LONG_TERM';   // 6–12+ months

export type PenetrationDepth =
  | 'SURFACE'       // stratum corneum only
  | 'EPIDERMAL'     // epidermis
  | 'DERMAL'        // dermis
  | 'FOLLICULAR'    // targeted follicle delivery
  | 'TRANSDERMAL';  // systemic absorption potential

export type LifestyleCategory =
  | 'NUTRITION'
  | 'SLEEP'
  | 'STRESS'
  | 'EXERCISE'
  | 'CHEMICAL_EXPOSURE'
  | 'HEAT_STYLING'
  | 'SCALP_CARE'
  | 'HYDRATION';

// ─────────────────────────────────────────────────────────────────────────────
// CONDITION KNOWLEDGE
// ─────────────────────────────────────────────────────────────────────────────

export interface ConditionMechanism {
  readonly label: string;
  readonly description: string;
  readonly pathway: string;
  readonly evidenceLevel: EvidenceLevel;
}

export interface ConditionTrigger {
  readonly label: string;
  readonly description: string;
  readonly rootCause: RootCause;
  readonly modifiable: boolean;
}

export interface SymptomProfile {
  readonly symptom: string;
  readonly onset: string;
  readonly severity: Severity;
  readonly visible: boolean;
}

export interface ProgressionStage {
  readonly stage: number;
  readonly label: string;
  readonly description: string;
  readonly clinicalMarkers: readonly string[];
  readonly reversible: boolean;
}

export interface PrognosisEntry {
  readonly timeframe: PrognosisTimeframe;
  readonly withTreatment: string;
  readonly withoutTreatment: string;
  readonly caveat?: string;
}

export interface ContraindicationEntry {
  readonly label: string;
  readonly description: string;
  readonly severity: 'ABSOLUTE' | 'RELATIVE' | 'CAUTION';
  readonly affectedTherapies: readonly TherapyNeed[];
}

export interface ConfidenceFactor {
  readonly factor: string;
  readonly direction: 'INCREASES_CONFIDENCE' | 'DECREASES_CONFIDENCE';
  /** 0.0 – 1.0 */
  readonly weight: number;
}

export interface ConditionKnowledge {
  readonly diagnosisKey: DiagnosisKey;
  readonly displayName: string;
  readonly shortName: string;
  readonly icd10?: string;
  readonly description: string;
  readonly clinicalDescription: string;
  readonly mechanisms: readonly ConditionMechanism[];
  readonly triggers: readonly ConditionTrigger[];
  readonly symptoms: readonly SymptomProfile[];
  readonly progression: readonly ProgressionStage[];
  readonly prognosis: readonly PrognosisEntry[];
  readonly recommendedTherapies: readonly TherapyNeed[];
  readonly contraindications: readonly ContraindicationEntry[];
  readonly confidenceFactors: readonly ConfidenceFactor[];
  readonly relatedConditions: readonly DiagnosisKey[];
  readonly rootCauses: readonly RootCause[];
  readonly prevalence?: string;
  readonly evidenceLevel: EvidenceLevel;
  readonly references?: readonly string[];
  readonly lastReviewed: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// INGREDIENT KNOWLEDGE
// ─────────────────────────────────────────────────────────────────────────────

export interface IngredientInteraction {
  readonly ingredient: string;
  readonly type: 'SYNERGISTIC' | 'ANTAGONISTIC' | 'NEUTRAL';
  readonly note: string;
}

export interface DosageGuidance {
  readonly typical: string;
  readonly minimum?: string;
  readonly maximum?: string;
  readonly unit: string;
  readonly frequency: string;
  readonly notes?: string;
}

export interface IngredientKnowledge {
  readonly ingredientId: string;
  readonly displayName: string;
  readonly aliases: readonly string[];
  readonly category: IngredientCategory;
  readonly mechanismsOfAction: readonly string[];
  readonly targetedNeeds: readonly TherapyNeed[];
  readonly evidenceLevel: EvidenceLevel;
  readonly clinicalEvidence: string;
  readonly contraindications: readonly string[];
  readonly pregnancySafe: boolean | 'CONSULT_REQUIRED';
  readonly breastfeedingSafe: boolean | 'CONSULT_REQUIRED';
  readonly dosageGuidance: DosageGuidance;
  readonly interactions: readonly IngredientInteraction[];
  readonly sideEffects: readonly string[];
  readonly onsetOfAction: string;
  readonly references?: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// KIT KNOWLEDGE
// ─────────────────────────────────────────────────────────────────────────────

export interface KitComponent {
  readonly type: 'TOPICAL' | 'ORAL' | 'DEVICE';
  readonly productId: string;
  readonly displayName: string;
  readonly role: string;
  readonly optional: boolean;
}

export interface KitKnowledge {
  readonly kitId: KitId;
  readonly displayName: string;
  readonly shortName: string;
  readonly category: string;
  readonly description: string;
  readonly clinicalRationale: string;
  readonly targetDiagnoses: readonly DiagnosisKey[];
  readonly targetTherapyNeeds: readonly TherapyNeed[];
  readonly components: readonly KitComponent[];
  readonly keyIngredients: readonly string[];
  readonly contraindications: readonly string[];
  readonly pregnancySafe: boolean;
  readonly expectedOutcomes: readonly string[];
  readonly timeToEffect: string;
  readonly phaseCompatibility: readonly number[];
  readonly evidenceLevel: EvidenceLevel;
  readonly lastReviewed: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TOPICAL KNOWLEDGE
// ─────────────────────────────────────────────────────────────────────────────

export interface PenetrationProfile {
  readonly depth: PenetrationDepth;
  readonly mechanism: string;
  readonly enhancers: readonly string[];
  readonly onset: string;
}

export interface FollicularTargetingProfile {
  readonly targeted: boolean;
  readonly mechanism: string;
  readonly specificity: 'HIGH' | 'MODERATE' | 'LOW';
  readonly phase: 'ANAGEN' | 'CATAGEN' | 'TELOGEN' | 'ALL_PHASES';
  readonly description: string;
}

export interface ApplicationGuidance {
  readonly frequency: string;
  readonly amount: string;
  readonly method: string;
  readonly timing: string;
  readonly hairStatus: 'DRY' | 'DAMP' | 'EITHER';
  readonly coverage: string;
  readonly duration: string;
  readonly notes: readonly string[];
}

export interface IrritationProfile {
  readonly riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
  readonly commonReactions: readonly string[];
  readonly riskFactors: readonly string[];
  readonly monitoringAdvice: string;
  readonly escalationCriteria: readonly string[];
}

export interface InflammationModulationProfile {
  readonly modulates: boolean;
  readonly mechanism?: string;
  readonly targets: readonly string[];
  readonly expectedEffect: 'REDUCES' | 'NEUTRAL' | 'MAY_INCREASE';
  readonly clinicalNote: string;
}

export interface TopicalKnowledge {
  readonly topicalId: string;
  readonly displayName: string;
  readonly formulation: string;
  readonly activeIngredients: readonly string[];
  readonly ingredientIds: readonly string[];
  readonly scalpPenetration: PenetrationProfile;
  readonly follicularTargeting: FollicularTargetingProfile;
  readonly applicationGuidance: ApplicationGuidance;
  readonly irritationRisks: IrritationProfile;
  readonly inflammationModulation: InflammationModulationProfile;
  readonly targetScalpStates: readonly ScalpState[];
  readonly targetTherapyNeeds: readonly TherapyNeed[];
  readonly contraindications: readonly string[];
  readonly pregnancySafe: boolean | 'CONSULT_REQUIRED';
  readonly mechanisms: readonly string[];
  readonly evidenceLevel: EvidenceLevel;
  readonly lastReviewed: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// THERAPY KNOWLEDGE
// ─────────────────────────────────────────────────────────────────────────────

export interface TherapyMechanism {
  readonly label: string;
  readonly pathway: string;
  readonly targetTissue: string;
  readonly description: string;
  readonly evidenceLevel: EvidenceLevel;
}

export interface TherapyKnowledge {
  readonly therapyNeed: TherapyNeed;
  readonly displayName: string;
  readonly description: string;
  readonly clinicalRationale: string;
  readonly mechanisms: readonly TherapyMechanism[];
  readonly category: TherapyCategory;
  readonly targetConditions: readonly DiagnosisKey[];
  readonly targetRootCauses: readonly RootCause[];
  readonly expectedBiomarkers: readonly string[];
  readonly monitoringParameters: readonly string[];
  readonly evidenceLevel: EvidenceLevel;
  readonly contraindications: readonly string[];
  readonly lastReviewed: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGNOSIS KNOWLEDGE
// ─────────────────────────────────────────────────────────────────────────────

export interface PrognosisOutcome {
  readonly timeframe: PrognosisTimeframe;
  readonly label: string;
  readonly description: string;
  readonly successRate?: string;
  readonly clinicalNote: string;
}

export interface PrognosisModifier {
  readonly factor: string;
  readonly direction: 'IMPROVES' | 'WORSENS' | 'NEUTRAL';
  readonly magnitude: 'HIGH' | 'MODERATE' | 'LOW';
  readonly rationale: string;
}

export interface PrognosisKnowledge {
  readonly diagnosisKey: DiagnosisKey;
  readonly severity: Severity;
  readonly displayName: string;
  readonly baselineOutcome: string;
  readonly withOptimalTreatment: string;
  readonly withoutTreatment: string;
  readonly outcomes: readonly PrognosisOutcome[];
  readonly modifiers: readonly PrognosisModifier[];
  readonly keySuccessFactors: readonly string[];
  readonly warningSignals: readonly string[];
  readonly referralCriteria: readonly string[];
  readonly evidenceLevel: EvidenceLevel;
  readonly lastReviewed: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// LIFESTYLE KNOWLEDGE
// ─────────────────────────────────────────────────────────────────────────────

export interface LifestyleRecommendation {
  readonly action: string;
  readonly rationale: string;
  readonly frequency: string;
  readonly priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface LifestyleGuidanceKnowledge {
  readonly guidanceId: string;
  readonly category: LifestyleCategory;
  readonly displayName: string;
  readonly description: string;
  readonly relevantConditions: readonly DiagnosisKey[];
  readonly relevantRootCauses: readonly RootCause[];
  readonly recommendations: readonly LifestyleRecommendation[];
  readonly avoidances: readonly string[];
  readonly evidenceLevel: EvidenceLevel;
  readonly patientNote: string;
  readonly clinicalNote: string;
  readonly lastReviewed: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY TYPES  (loader output)
// ─────────────────────────────────────────────────────────────────────────────

export type ConditionKnowledgeRegistry = Readonly<
  Partial<Record<DiagnosisKey, ConditionKnowledge>>
>;

export type IngredientKnowledgeRegistry = Readonly<
  Record<string, IngredientKnowledge>
>;

export type KitKnowledgeRegistry = Readonly<Record<KitId, KitKnowledge>>;

export type TopicalKnowledgeRegistry = Readonly<
  Record<string, TopicalKnowledge>
>;

export type TherapyKnowledgeRegistry = Readonly<
  Partial<Record<TherapyNeed, TherapyKnowledge>>
>;

export type PrognosisKnowledgeRegistry = Readonly<
  Partial<Record<DiagnosisKey, Partial<Record<Severity, PrognosisKnowledge>>>>
>;

export type LifestyleKnowledgeRegistry = Readonly<
  Record<string, LifestyleGuidanceKnowledge>
>;

// ─────────────────────────────────────────────────────────────────────────────
// RETRIEVAL RESULT WRAPPERS
// ─────────────────────────────────────────────────────────────────────────────

export interface KnowledgeRetrievalResult<T> {
  readonly found: boolean;
  readonly data: T | null;
  readonly source: string;
  readonly retrievedAt: string;
}

export interface MultiKnowledgeRetrievalResult<T> {
  readonly results: readonly T[];
  readonly count: number;
  readonly source: string;
  readonly retrievedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION RESULT
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

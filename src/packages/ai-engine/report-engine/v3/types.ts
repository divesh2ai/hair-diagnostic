/**
 * HairOS Report — Narrative Engine V3
 *
 * Spec: HAIROS_REPORT_NARRATIVE_ENGINE_V3.
 *
 * The V3 narrative is a tight, patient-facing voice layer built on top of the
 * V4 ClinicalReport. It enforces a single logical chain:
 *
 *   Signals → Barriers → Strategy → Kits → Ingredients → Outlook → Lifestyle
 *
 * V4 (ClinicalReport) is the structured source of truth. V3 (this module) is
 * the spoken voice — concise, never generic, every line tied to the patient.
 */

export type NarrativeV3SchemaVersion = "v3-narrative";

// ─────────────────────────────────────────────────────────────────────────────
// §1 — Clinical Summary & Hair Growth Barriers
// ─────────────────────────────────────────────────────────────────────────────

export interface BarrierImpact {
  /** Patient-friendly barrier name (e.g. "Follicular Miniaturisation"). */
  name: string;
  /** 1–2 sentence clinical interpretation in dermatologist voice. */
  clinicalInterpretation: string;
  /** 2–4 short bullets describing how this barrier shows up in the hair. */
  impactOnHair: string[];
}

export interface ClinicalSummarySection {
  /** Opening sentence — "Based on your assessment, we identified…" */
  leadIn: string;
  /** Bulleted list of identified factors / conditions (≤ 5). */
  identifiedFactors: string[];
  /** Single closing sentence on the collective effect. */
  collectiveEffect: string;
  /** Section heading. */
  barriersHeading: string;
  /** Hair growth barriers — 3–5 max. */
  barriers: BarrierImpact[];
}

// ─────────────────────────────────────────────────────────────────────────────
// §2 — Personalised Recovery Strategy
// ─────────────────────────────────────────────────────────────────────────────

export interface RecoveryStrategySection {
  /** Section heading. */
  heading: string;
  /** 1–2 sentence intro paragraph. */
  intro: string;
  /** 3–6 focus areas as bullets — no ingredients, no kit names yet. */
  focusAreas: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// §3 — Recommended Recovery Protocol
//
// Kit mechanism (therapeutic focus) and ingredient mechanism (formulation
// rationale) are rendered side-by-side INSIDE the same card per the latest
// spec — no separate ingredient section.
// ─────────────────────────────────────────────────────────────────────────────

/** Verbatim formulation-rationale group from "All Kits Info". */
export interface FormulationGroupLine {
  /** Functional grouping, e.g. "DHT modulators". */
  group: string;
  /** What this group does — verbatim from the source doc. */
  action: string;
  /** Ingredients in this group, exactly as named in the source. */
  ingredients: string[];
}

export interface RecommendedKitEntry {
  /** Kit display name as the patient-facing card title. */
  name: string;
  /** 2–3 line patient-friendly evidence chain. */
  whySelected: string;
  /** 3–5 therapeutic-focus bullets — short noun phrases (kit mechanism). */
  therapeuticFocus: string[];
  /** Verbatim formulation rationale groups (ingredient mechanism). */
  formulationGroups: FormulationGroupLine[];
}

export interface RecommendedKitsSection {
  heading: string;
  intro: string;
  kits: RecommendedKitEntry[];
}

// ─────────────────────────────────────────────────────────────────────────────
// §5 — Expected Recovery Milestones
// ─────────────────────────────────────────────────────────────────────────────

export interface RecoveryOutlookEntry {
  /** Period label — e.g. "Month 1", "Months 2–3". */
  period: string;
  /** 1–3 short milestone bullets. */
  milestones: string[];
}

export interface RecoveryOutlookSection {
  heading: string;
  entries: RecoveryOutlookEntry[];
}

// ─────────────────────────────────────────────────────────────────────────────
// §6 — Diet & Lifestyle Recommendations
// ─────────────────────────────────────────────────────────────────────────────

export interface DietLifestyleLine {
  /** Concrete action — short imperative. */
  recommendation: string;
  /** ONE sentence on why it matters for this patient. */
  whyItMatters: string;
  /** Optional — the barrier / condition this maps back to. */
  mappedBarrier?: string;
}

export interface DietLifestyleSection {
  heading: string;
  recommendations: DietLifestyleLine[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-level narrative
// ─────────────────────────────────────────────────────────────────────────────

export interface NarrativeReportV3 {
  schemaVersion: NarrativeV3SchemaVersion;
  generatedAt: string;
  patientName: string;
  clinicalSummary: ClinicalSummarySection;
  recoveryStrategy: RecoveryStrategySection;
  recommendedKits: RecommendedKitsSection;
  recoveryOutlook: RecoveryOutlookSection;
  dietAndLifestyle: DietLifestyleSection;
}

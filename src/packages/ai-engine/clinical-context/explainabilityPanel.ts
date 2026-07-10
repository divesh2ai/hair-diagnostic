/**
 * Doctor Explainability Panel — data adapter.
 *
 * Produces the structured object the Doctor Dashboard renders as a
 * collapsible "Clinical Reasoning" section. The shape is intentionally
 * presentational: each field corresponds 1:1 to a UI block, so the frontend
 * is a thin renderer over this object — no re-derivation, no re-parsing.
 *
 * Five blocks, matching the spec:
 *
 *   1. Detected Conditions     ← inferred root causes / diagnosis
 *   2. Clinical Inference      ← biology suggested by detected conditions
 *   3. Interaction Rules       ← rules that fired during kit selection
 *   4. Selected Kits           ← kit + per-kit "because…" line
 *   5. Rejected Kits           ← kit + reason + replacement
 *
 * Reports from groundingViolations + reasoningGaps are surfaced as
 * a 6th block ("Open Questions") so doctors can see exactly what the
 * self-reflection pass found unresolved.
 */

import type { ClinicalContext } from './types';
import type { RootCause } from '../../types';
import { explainKits } from './explainKits';
import type { KitExplanation, RejectedKitExplanation } from './explainKits';

// ── Public types ───────────────────────────────────────────────────────────

export interface DetectedCondition {
  /** Stable identifier for the condition (RootCause key or diagnosis key). */
  readonly id: string;
  /** Display label for the chip / row. */
  readonly label: string;
  /** Optional source — "reported" if patient said it, "inferred" if engine concluded it. */
  readonly source: 'reported' | 'inferred';
}

export interface ClinicalInferenceItem {
  readonly id: string;
  readonly statement: string;
  /** Detected conditions that justify the inference. */
  readonly derivedFrom: readonly string[];
}

export interface InteractionRuleItem {
  readonly ruleId: string;
  /** Human-readable label for the rule. */
  readonly label: string;
}

export interface OpenQuestionItem {
  readonly id: string;
  /** "grounding" | "reasoning" — origin of the question. */
  readonly kind: 'grounding' | 'reasoning';
  readonly message: string;
}

export interface ExplainabilityPanel {
  readonly assessmentId: string;
  readonly detectedConditions: readonly DetectedCondition[];
  readonly clinicalInferences: readonly ClinicalInferenceItem[];
  readonly interactionRules: readonly InteractionRuleItem[];
  readonly selectedKits: readonly KitExplanation[];
  readonly rejectedKits: readonly RejectedKitExplanation[];
  readonly openQuestions: readonly OpenQuestionItem[];
}

// ── Detected conditions ────────────────────────────────────────────────────

const ROOT_CAUSE_LABEL: Record<RootCause, string> = {
  STRESS:               'Stress',
  DHT:                  'DHT-driven thinning',
  GENETICS:             'Genetic pattern',
  IRON_DEFICIENCY:      'Iron deficiency',
  HYPOTHYROID:          'Hypothyroidism',
  HYPERTHYROID:         'Hyperthyroidism',
  PCOS:                 'PCOS',
  METABOLIC:            'Metabolic involvement',
  POOR_NUTRITION:       'Nutritional gaps',
  POST_PARTUM:          'Post-partum',
  GUT_MALABSORPTION:    'Gut malabsorption',
  OXIDATIVE_STRESS:     'Oxidative load',
  MEDICATION:           'Medication trigger',
  ILLNESS:              'Recent illness',
  RAPID_WEIGHT_LOSS:    'Rapid weight loss',
  AUTOIMMUNE:           'Autoimmune',
  CIRCADIAN_DISRUPTION: 'Circadian disruption',
  TRICHOTILLOMANIA:     'Pulling behaviour',
  HORMONAL_SHIFT:       'Hormonal transition',
};

/** Which root causes are typically *reported* by the patient (vs. inferred). */
const REPORTED_ROOT_CAUSES = new Set<RootCause>([
  'STRESS',
  'PCOS',
  'HYPOTHYROID',
  'HYPERTHYROID',
  'POST_PARTUM',
  'HORMONAL_SHIFT',
  'GUT_MALABSORPTION',
  'TRICHOTILLOMANIA',
  'AUTOIMMUNE',
  'CIRCADIAN_DISRUPTION',
  'MEDICATION',
  'ILLNESS',
  'RAPID_WEIGHT_LOSS',
  'OXIDATIVE_STRESS',
]);

function buildDetectedConditions(context: ClinicalContext): DetectedCondition[] {
  const out: DetectedCondition[] = [];
  // Primary diagnosis first.
  out.push({
    id: context.primaryDiagnosis,
    label: context.primaryDiagnosis.replace(/_/g, ' '),
    source: 'inferred',
  });
  // Then each root cause.
  for (const rc of context.facts.inferred.rootCauses) {
    out.push({
      id: rc,
      label: ROOT_CAUSE_LABEL[rc] ?? rc,
      source: REPORTED_ROOT_CAUSES.has(rc) ? 'reported' : 'inferred',
    });
  }
  return out;
}

// ── Clinical inferences ────────────────────────────────────────────────────

interface InferenceRule {
  readonly id: string;
  readonly statement: string;
  /** Inference fires when ALL of these root causes are detected. */
  readonly when: readonly RootCause[];
}

const INFERENCE_RULES: readonly InferenceRule[] = [
  {
    id: 'microInflammation',
    statement:
      'Microscopic perifollicular inflammation likely — early pattern hair loss is frequently associated with subclinical inflammation even when the scalp is reported normal.',
    when: ['DHT'],
  },
  {
    id: 'insulinResistance',
    statement: 'Insulin resistance suspected as a metabolic driver feeding hyperandrogenism.',
    when: ['PCOS'],
  },
  {
    id: 'metabolicPCOS',
    statement:
      'Combined PCOS + metabolic involvement → hormonal correction must precede follicle stimulation.',
    when: ['PCOS', 'METABOLIC'],
  },
  {
    id: 'hpaAxis',
    statement:
      'HPA axis activation likely — sustained cortisol shortens anagen and synchronises telogen shift.',
    when: ['STRESS'],
  },
  {
    id: 'ironTransport',
    statement:
      'Reduced oxygen / nutrient transport to the dermal papilla due to low iron status.',
    when: ['IRON_DEFICIENCY'],
  },
  {
    id: 'absorptionDeficit',
    statement:
      'Nutrient absorption deficit limiting follicle support, even when dietary intake looks adequate.',
    when: ['GUT_MALABSORPTION'],
  },
];

function buildClinicalInferences(context: ClinicalContext): ClinicalInferenceItem[] {
  const detected = new Set(context.facts.inferred.rootCauses);
  return INFERENCE_RULES
    .filter((rule) => rule.when.every((rc) => detected.has(rc)))
    .map((rule) => ({
      id: rule.id,
      statement: rule.statement,
      derivedFrom: rule.when,
    }));
}

// ── Interaction rules ──────────────────────────────────────────────────────

function buildInteractionRules(context: ClinicalContext): InteractionRuleItem[] {
  return context.interactionRules.map((rule) => ({
    ruleId: rule,
    label: humaniseRuleId(rule),
  }));
}

function humaniseRuleId(rule: string): string {
  return rule
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Open questions (grounding + reasoning gaps) ────────────────────────────

function buildOpenQuestions(context: ClinicalContext): OpenQuestionItem[] {
  const out: OpenQuestionItem[] = [];
  for (const v of context.groundingViolations) {
    out.push({
      id: `${v.section}.${v.ruleId}`,
      kind: 'grounding',
      message: `[${v.section}] "${v.matchedText}" — ${v.claim} (missing: ${v.missingEvidence.join(', ')}).`,
    });
  }
  for (const g of context.reasoningGaps) {
    out.push({
      id: `${g.kind}.${g.subject}`,
      kind: 'reasoning',
      message: g.message,
    });
  }
  return out;
}

// ── Public entry point ─────────────────────────────────────────────────────

export function buildExplainabilityPanel(context: ClinicalContext): ExplainabilityPanel {
  const { selected, rejected } = explainKits(context);
  return {
    assessmentId: context.assessmentId,
    detectedConditions: buildDetectedConditions(context),
    clinicalInferences: buildClinicalInferences(context),
    interactionRules: buildInteractionRules(context),
    selectedKits: selected,
    rejectedKits: rejected,
    openQuestions: buildOpenQuestions(context),
  };
}

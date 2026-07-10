/**
 * Kit Explanation Composer
 *
 * Turns `ClinicalContext.selectedKits` into structured, evidence-grounded
 * explanations of WHY each kit is in the protocol. This is the single
 * adapter every consumer (patient narrative Section 3, doctor dashboard
 * Recommendations panel, AI avatar Scene 3) reads from — stops the class
 * of bug where each composer re-derives kit rationale and they disagree.
 *
 * Every explanation answers the four questions from the spec:
 *   1. Which condition triggered this kit?
 *   2. Which biological mechanism does it address?
 *   3. Why does it precede / follow the other kits?
 *   4. Which interaction rule enabled or prioritised it?
 */

import type { ClinicalContext, SelectedKit, RejectedKit } from './types';
import type { RootCause, TherapyNeed } from '../../types';
import { getKitInfo } from '../../registries/kits/info';

// ── Public types ───────────────────────────────────────────────────────────

export interface KitExplanation {
  readonly kitId: string;
  readonly displayName: string;
  readonly phase: number;

  /** "Selected because PCOS and Prediabetes were detected." */
  readonly triggeredBy: string;
  /** Detected root causes / conditions that justify this kit. */
  readonly triggers: readonly RootCause[];

  /** "Addresses insulin resistance, androgen excess and metabolic dysfunction." */
  readonly mechanism: string;
  /** Therapy needs the kit satisfies. */
  readonly addresses: readonly TherapyNeed[];

  /** "Phase 1: prepares the follicular environment before pattern-correction therapy." */
  readonly sequencingNote: string;

  /** Interaction rule(s) that enabled / prioritised this kit. */
  readonly enabledByRules: readonly string[];

  /**
   * Combined patient-facing paragraph — used when the consumer just wants
   * a single block of text rather than the structured fields above.
   */
  readonly paragraph: string;
}

export interface RejectedKitExplanation {
  readonly kitId: string;
  readonly displayName: string;
  readonly removedByRule: string;
  readonly reason: string;
  /** Display names (not ids) of kits that superseded this one. */
  readonly supersededBy: readonly string[];
  /** "Hair Boost Recovery — Rejected. Superseded by Phenotype. Rule: Inflammation-first sequencing." */
  readonly summary: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const ROOT_CAUSE_DISPLAY: Record<RootCause, string> = {
  STRESS:               'stress-related shedding',
  DHT:                  'androgenic / DHT-driven thinning',
  GENETICS:             'a genetic / family pattern',
  IRON_DEFICIENCY:      'low iron status',
  HYPOTHYROID:          'hypothyroid involvement',
  HYPERTHYROID:         'hyperthyroid involvement',
  PCOS:                 'PCOS',
  METABOLIC:            'metabolic / insulin involvement',
  POOR_NUTRITION:       'nutritional gaps',
  POST_PARTUM:          'post-partum shedding',
  GUT_MALABSORPTION:    'gut malabsorption',
  OXIDATIVE_STRESS:     'oxidative load',
  MEDICATION:           'medication-related shedding',
  ILLNESS:              'post-illness shedding',
  RAPID_WEIGHT_LOSS:    'rapid weight loss',
  AUTOIMMUNE:           'an autoimmune component',
  CIRCADIAN_DISRUPTION: 'disrupted sleep / circadian rhythm',
  TRICHOTILLOMANIA:     'a pulling behaviour',
  HORMONAL_SHIFT:       'a hormonal transition',
};

const THERAPY_NEED_MECHANISM: Partial<Record<TherapyNeed, string>> = {
  DHT_SUPPRESSION:      'blocking the conversion of testosterone to DHT at sensitive follicles',
  INFLAMMATION_CONTROL: 'calming the perifollicular inflammatory environment',
  FOLLICLE_STIMULATION: 'stimulating the follicular dermal papilla',
  METABOLIC_SUPPORT:    'restoring metabolic and insulin balance',
  IMMUNE_MODULATION:    'modulating immune activity around the follicle',
  IRON_REPLETION:       'restoring iron stores and oxygen delivery to the follicle',
  HORMONAL_REBALANCING: 'rebalancing the hormonal axis',
  ANTIOXIDANT_SUPPORT:  'reducing oxidative damage to the follicle',
  GUT_RESTORATION:      'restoring gut barrier function and nutrient absorption',
  THYROID_SUPPORT:      'supporting thyroid-mediated metabolic tempo',
  CIRCADIAN_RESET:      'restoring the overnight follicular repair window',
  SHAFT_REPAIR:         'repairing the hair shaft and cuticle',
  SHEDDING_ARREST:      'arresting active shedding',
  LACTATION_SUPPORT:    'supporting nutritional needs during lactation',
  MELANOCYTE_PROTECTION: 'protecting follicular melanocytes',
  ANDROGENIC_CORRECTION: 'correcting androgenic excess at the follicle',
  NEUROLOGICAL_OCD_SUPPORT: 'reducing the neurological drivers of pulling behaviour',
  WEIGHT_LOSS_RECOVERY: 'restoring the nutrient reserves depleted by weight loss',
  PREGNANCY_SUPPORT:    'meeting the nutritional demand of pregnancy',
};

function joinList(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function phaseSequencingNote(phase: number, totalPhases: number): string {
  if (totalPhases <= 1) return 'This kit is the focal point of the protocol.';
  if (phase === 1) {
    return 'Phase 1 prepares the foundation before downstream phases run.';
  }
  if (phase === totalPhases) {
    return `Phase ${phase} is sequenced last — it builds on the corrections made in earlier phases.`;
  }
  return `Phase ${phase} runs after the earlier phases have stabilised the environment, so this kit can operate at full effect.`;
}

function resolveDisplayName(kitId: string, fallback: string): string {
  const info = getKitInfo(kitId);
  return info?.displayName ?? fallback;
}

// ── Per-kit explanation ────────────────────────────────────────────────────

function explainOneKit(sk: SelectedKit, totalPhases: number): KitExplanation {
  const triggers = sk.rationale.drivenBy;
  const addresses = sk.rationale.satisfies;
  const displayName = resolveDisplayName(sk.kitId, sk.displayName);

  const triggeredBy = triggers.length === 0
    ? `Selected to address ${joinList(addresses) || 'the recommendation set'}.`
    : `Selected because ${joinList(triggers.map((t) => ROOT_CAUSE_DISPLAY[t]))} ${triggers.length === 1 ? 'was' : 'were'} detected.`;

  const mechanismParts = addresses
    .map((n) => THERAPY_NEED_MECHANISM[n])
    .filter((s): s is string => Boolean(s));
  const mechanism = mechanismParts.length > 0
    ? `This kit works by ${joinList(mechanismParts)}.`
    : (sk.rationale.rationale || 'Mechanism details are in the kit information panel.');

  const sequencingNote = phaseSequencingNote(sk.phase, totalPhases);

  const enabledByRules = sk.rationale.enabledBy;
  const ruleNote = enabledByRules.length > 0
    ? ` Prioritised by: ${joinList(enabledByRules)}.`
    : '';

  const paragraph = [
    triggeredBy,
    mechanism,
    sequencingNote + ruleNote,
  ].join(' ');

  return {
    kitId: sk.kitId,
    displayName,
    phase: sk.phase,
    triggeredBy,
    triggers,
    mechanism,
    addresses,
    sequencingNote,
    enabledByRules,
    paragraph,
  };
}

// ── Rejected-kit explanation ───────────────────────────────────────────────

function explainOneRejection(rk: RejectedKit): RejectedKitExplanation {
  const displayName = resolveDisplayName(rk.kitId, rk.kitId);
  const supersededBy = (rk.supersededBy ?? []).map((id) => resolveDisplayName(id, id));
  const supersedeFragment = supersededBy.length > 0
    ? ` Superseded by ${joinList(supersededBy)}.`
    : '';
  const reasonFragment = rk.reason ? ` Reason: ${rk.reason}.` : '';
  const summary = `${displayName} — Rejected.${supersedeFragment} Rule: ${rk.removedByRule}.${reasonFragment}`;
  return {
    kitId: rk.kitId,
    displayName,
    removedByRule: rk.removedByRule,
    reason: rk.reason,
    supersededBy,
    summary,
  };
}

// ── Public entry point ─────────────────────────────────────────────────────

export interface KitExplanations {
  readonly selected: readonly KitExplanation[];
  readonly rejected: readonly RejectedKitExplanation[];
}

export function explainKits(context: ClinicalContext): KitExplanations {
  const phases = new Set(context.selectedKits.map((k) => k.phase));
  const totalPhases = phases.size;
  const selected = context.selectedKits.map((sk) => explainOneKit(sk, totalPhases));
  const rejected = context.rejectedKits.map(explainOneRejection);
  return { selected, rejected };
}

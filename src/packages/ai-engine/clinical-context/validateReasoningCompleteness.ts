/**
 * Self-Reflection Completeness Validator
 *
 * Runs after composition and asks the questions a senior dermatologist
 * would ask before signing off on a consultation:
 *
 *   1. Does every recommended kit have a reason tied to a detected condition?
 *   2. Is every detected condition discussed somewhere in the narrative?
 *   3. Does every selected kit get named in the narrative?
 *   4. Are any narrative sections empty?
 *   5. Are the phases monotonically sequenced?
 *
 * This is complementary to `validateEvidenceGrounding` — that validator
 * blocks claims the patient never reported; this validator blocks
 * recommendations the report doesn't explain.
 */

import type { ClinicalContext, SelectedKit } from './types';
import type { RootCause } from '../../types';
import { getKitInfo } from '../../registries/kits/info';

export type ReasoningGapKind =
  | 'kit.missingTrigger'
  | 'kit.notDiscussedInNarrative'
  | 'condition.notDiscussedInNarrative'
  | 'narrative.emptySection'
  | 'sequencing.gap';

export interface ReasoningGap {
  readonly kind: ReasoningGapKind;
  /** Stable id of the affected entity (kitId, condition name, section name). */
  readonly subject: string;
  /** Human-readable summary used in dashboard + logs. */
  readonly message: string;
}

export interface ReasoningCompletenessResult {
  readonly valid: boolean;
  readonly gaps: readonly ReasoningGap[];
}

export interface NarrativeSection {
  readonly name: string;
  readonly text: string;
}

// ── Per-check implementations ──────────────────────────────────────────────

function checkKitTriggers(context: ClinicalContext): ReasoningGap[] {
  const gaps: ReasoningGap[] = [];
  for (const kit of context.selectedKits) {
    const hasTrigger = kit.rationale.drivenBy.length > 0
      || kit.rationale.satisfies.length > 0
      || (kit.rationale.rationale && kit.rationale.rationale.trim().length > 0);
    if (!hasTrigger) {
      gaps.push({
        kind: 'kit.missingTrigger',
        subject: kit.kitId,
        message: `Kit "${kit.displayName}" is in the protocol but has no driver, therapy need, or rationale text — cannot explain why it was selected.`,
      });
    }
  }
  return gaps;
}

function kitNamePatterns(kit: SelectedKit): RegExp[] {
  const info = getKitInfo(kit.kitId);
  const names = new Set<string>();
  if (info?.displayName) names.add(info.displayName);
  if (kit.displayName) names.add(kit.displayName);
  // Always include the kitId as a fallback — composer may render the id
  // directly for kits without a registry entry.
  names.add(kit.kitId);
  return Array.from(names).map(
    (n) => new RegExp(escapeRegExp(n), 'i'),
  );
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function checkKitsDiscussed(
  context: ClinicalContext,
  sections: readonly NarrativeSection[],
): ReasoningGap[] {
  if (sections.length === 0) return [];
  const corpus = sections.map((s) => s.text).join('\n');
  const gaps: ReasoningGap[] = [];
  for (const kit of context.selectedKits) {
    const patterns = kitNamePatterns(kit);
    const mentioned = patterns.some((re) => re.test(corpus));
    if (!mentioned) {
      gaps.push({
        kind: 'kit.notDiscussedInNarrative',
        subject: kit.kitId,
        message: `Kit "${kit.displayName}" is in the protocol but is not named anywhere in the patient-facing narrative.`,
      });
    }
  }
  return gaps;
}

const ROOT_CAUSE_KEYWORDS: Record<RootCause, RegExp> = {
  STRESS:               /\bstress\b/i,
  DHT:                  /\bDHT\b|androgen/i,
  GENETICS:             /\b(genetic|hereditary|family\s+pattern)\b/i,
  IRON_DEFICIENCY:      /\biron\b|ferritin/i,
  HYPOTHYROID:          /\b(hypothyroid|thyroid)\b/i,
  HYPERTHYROID:         /\b(hyperthyroid|thyroid)\b/i,
  PCOS:                 /\bPCOS\b|polycystic/i,
  METABOLIC:            /\b(metabolic|insulin|prediabet)/i,
  POOR_NUTRITION:       /\b(nutrition|deficien|dietary)/i,
  POST_PARTUM:          /\bpost.?partum\b|post.?delivery|breastfeed|lactat/i,
  GUT_MALABSORPTION:    /\bgut\b|GI|gastro|malabs/i,
  OXIDATIVE_STRESS:     /oxidative|antioxidant/i,
  MEDICATION:           /\bmedicat/i,
  ILLNESS:              /\billness\b|surgery|infection/i,
  RAPID_WEIGHT_LOSS:    /weight.?loss|crash/i,
  AUTOIMMUNE:           /\b(autoimmune|alopecia\s+areata)\b/i,
  CIRCADIAN_DISRUPTION: /\b(circadian|sleep|night.?shift)\b/i,
  TRICHOTILLOMANIA:     /\b(pulling|trichotillomania|TTM)\b/i,
  HORMONAL_SHIFT:       /\bhormon/i,
};

function checkConditionsDiscussed(
  context: ClinicalContext,
  sections: readonly NarrativeSection[],
): ReasoningGap[] {
  if (sections.length === 0) return [];
  const corpus = sections.map((s) => s.text).join('\n');
  const gaps: ReasoningGap[] = [];
  for (const rc of context.facts.inferred.rootCauses) {
    const re = ROOT_CAUSE_KEYWORDS[rc];
    if (!re) continue;
    if (!re.test(corpus)) {
      gaps.push({
        kind: 'condition.notDiscussedInNarrative',
        subject: rc,
        message: `Detected condition "${rc}" was used to drive recommendations but never appears in the narrative — the patient cannot see why this kit set was chosen.`,
      });
    }
  }
  return gaps;
}

function checkEmptySections(sections: readonly NarrativeSection[]): ReasoningGap[] {
  const gaps: ReasoningGap[] = [];
  for (const s of sections) {
    if (!s.text || s.text.trim().length === 0) {
      gaps.push({
        kind: 'narrative.emptySection',
        subject: s.name,
        message: `Narrative section "${s.name}" is empty — the patient gets a blank page where reasoning should appear.`,
      });
    }
  }
  return gaps;
}

function checkSequencing(context: ClinicalContext): ReasoningGap[] {
  const phases = context.sequencing.map((p) => p.phase).sort((a, b) => a - b);
  if (phases.length === 0) return [];
  const gaps: ReasoningGap[] = [];
  for (let i = 0; i < phases.length; i++) {
    if (phases[i] !== i + 1) {
      gaps.push({
        kind: 'sequencing.gap',
        subject: `phase-${phases[i]}`,
        message: `Phase sequencing has a gap: expected phase ${i + 1}, found ${phases[i]}. Phases should be monotonic starting from 1.`,
      });
      break;
    }
  }
  return gaps;
}

// ── Public entry point ─────────────────────────────────────────────────────

export function validateReasoningCompleteness(
  context: ClinicalContext,
  sections: readonly NarrativeSection[],
): ReasoningCompletenessResult {
  const gaps: ReasoningGap[] = [
    ...checkKitTriggers(context),
    ...checkKitsDiscussed(context, sections),
    ...checkConditionsDiscussed(context, sections),
    ...checkEmptySections(sections),
    ...checkSequencing(context),
  ];
  return { valid: gaps.length === 0, gaps };
}

export function formatReasoningGaps(result: ReasoningCompletenessResult): string {
  if (result.valid) return '';
  return result.gaps
    .map((g) => `  • [${g.kind}] ${g.subject} — ${g.message}`)
    .join('\n');
}

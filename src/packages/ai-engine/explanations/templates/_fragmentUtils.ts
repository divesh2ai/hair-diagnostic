// ─────────────────────────────────────────────────────────────────────────────
// Fragment Utilities — internal to the templates layer
//
// Pure functions for deterministic fragment selection and assembly.
// No Math.random() is used anywhere in this file.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Fragment,
  FragmentConditionKey,
  FragmentConditions,
  AssembledSection,
} from './types';
import type { ClinicalProfile } from '../../clinical-engine/types';
import type { NarrativeLength } from '../types';

// ─── Convenience constructors (keep template files readable) ─────────────────

/** Fragment with a single, invariant text. */
export function f(text: string, priority = 5): Fragment {
  return { variants: [text], priority };
}

/** Fragment with multiple variants — deterministic selection by patient seed. */
export function v(
  priority: number,
  ...variants: string[]
): Fragment {
  return { variants: variants, priority };
}

/** Conditional fragment — included only when the named condition is true. */
export function c(
  condition: FragmentConditionKey,
  text: string,
  priority = 4
): Fragment {
  return { variants: [text], condition, priority };
}

/** Conditional fragment with variants. */
export function cv(
  condition: FragmentConditionKey,
  priority: number,
  ...variants: string[]
): Fragment {
  return { variants: variants, condition, priority };
}

// ─── Deterministic hash ───────────────────────────────────────────────────────

/** djb2-style hash — stable across runtimes, always positive. */
function hashCode(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

// ─── Patient seed ─────────────────────────────────────────────────────────────

/**
 * Builds a deterministic seed string from the clinical profile.
 * Same patient → same seed → same variant selections → reproducible narrative.
 * Different patients → different seeds → language variation.
 */
export function buildPatientSeed(profile: ClinicalProfile): string {
  const ageBucket = Math.floor(profile.flags.age / 10) * 10;
  return `${profile.primaryDiagnosis}_${profile.severity}_${ageBucket}_${profile.flags.isMale ? 'M' : 'F'}`;
}

// ─── Variant selection ────────────────────────────────────────────────────────

/**
 * Picks one variant from a fragment's variant array using the patient seed.
 * The same seed always picks the same index, ensuring reproducibility.
 */
export function pickVariant(fragment: Fragment, seed: string): string {
  const { variants } = fragment;
  if (variants.length === 0) return '';
  if (variants.length === 1) return variants[0];
  return variants[hashCode(seed) % variants.length];
}

// ─── Condition resolution ─────────────────────────────────────────────────────

/** Builds a FragmentConditions map from a ClinicalProfile. */
export function resolveConditions(profile: ClinicalProfile): FragmentConditions {
  const { flags, secondaryDiagnoses, severity } = profile;
  return {
    always:            true,
    isGrade45:         flags.isGrade45,
    isGrade123:        flags.isGrade123,
    isMale:            flags.isMale,
    isFemale:          !flags.isMale,
    isPregnant:        flags.isPregnant,
    isVeg:             flags.isVeg,
    hasGLP1Early:      flags.hasGLP1Early,
    hasGLP1Late:       flags.hasGLP1Late,
    hasGreyGoal:       flags.hasGreyGoal,
    hasActiveShedding: flags.hasActiveShedding,
    hasNoVisibleFall:  flags.hasNoVisibleFall,
    hasSecondaryDx:    secondaryDiagnoses.length > 0,
    severityMild:      severity === 'MILD',
    severityModerate:  severity === 'MODERATE',
    severitySevere:    severity === 'SEVERE',
  };
}

// ─── Fragment filtering ───────────────────────────────────────────────────────

/** Returns only fragments whose condition is met (or has no condition). */
export function filterFragments(
  fragments: ReadonlyArray<Fragment>,
  conditions: FragmentConditions
): Fragment[] {
  return fragments.filter((f) => {
    const cond = f.condition ?? 'always';
    if (cond === 'always') return true;
    return conditions[cond] === true;
  });
}

// ─── Section assembly ─────────────────────────────────────────────────────────

/** Max fragments per section for each NarrativeLength. */
const LENGTH_LIMITS: Record<NarrativeLength, number> = {
  short:    1,
  medium:   2,
  detailed: 999,
};

/**
 * Assembles a set of fragments into a single text string.
 *
 * Steps:
 * 1. Filter by conditions
 * 2. Sort by priority descending (higher = more important)
 * 3. Truncate to length limit
 * 4. Pick deterministic variant for each
 * 5. Join into a single sentence/paragraph
 */
export function assembleSection(
  key: string,
  fragments: ReadonlyArray<Fragment>,
  conditions: FragmentConditions,
  seed: string,
  length: NarrativeLength = 'medium'
): AssembledSection {
  const filtered = filterFragments(fragments, conditions);
  const sorted = [...filtered].sort((a, b) => (b.priority ?? 5) - (a.priority ?? 5));
  const limited = sorted.slice(0, LENGTH_LIMITS[length]);

  const texts = limited
    .map((frag) => pickVariant(frag, seed))
    .filter(Boolean);

  return {
    key,
    text: texts.join(' '),
    fragmentCount: texts.length,
  };
}

// ─── Sentence connectors ──────────────────────────────────────────────────────

/** Joins section texts into a coherent paragraph, inserting connectors. */
export function joinSections(sections: AssembledSection[]): string {
  return sections
    .map((s) => s.text.trim())
    .filter(Boolean)
    .join(' ');
}

/** Ensures the assembled text ends with a full stop. */
export function ensureTermination(text: string): string {
  const t = text.trimEnd();
  if (!t || t.endsWith('.') || t.endsWith('?') || t.endsWith('!')) return t;
  return `${t}.`;
}

/** Capitalises the first character of a string. */
export function cap(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Full pipeline: assemble, join, capitalise, terminate. */
export function assembleAndFinish(
  sections: Array<{ key: string; fragments: ReadonlyArray<Fragment> }>,
  conditions: FragmentConditions,
  seed: string,
  length: NarrativeLength
): string {
  const assembled = sections.map(({ key, fragments }) =>
    assembleSection(key, fragments, conditions, seed, length)
  );
  return ensureTermination(cap(joinSections(assembled)));
}

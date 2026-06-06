// ─────────────────────────────────────────────────────────────────────────────
// Composer Utilities — internal to the composers layer
//
// Shared helpers: ComposedNarrative construction, truncation, segment joining.
// ─────────────────────────────────────────────────────────────────────────────

import type { NarrativeLength }                            from '../types';
import type { ComposedNarrative, ComposedSegment, NarrativeTarget, TargetConstraints } from './types';

// ─── Build ComposedNarrative ──────────────────────────────────────────────────

/**
 * Assembles the final ComposedNarrative from resolved segments.
 * Applies target-specific truncation (WhatsApp, avatar).
 */
export function buildComposedNarrative(
  segments: ComposedSegment[],
  length: NarrativeLength,
  target: NarrativeTarget,
  locale: string,
  constraints: TargetConstraints
): ComposedNarrative {
  const raw = segments.map((s) => s.text).filter(Boolean).join(' ');

  const full  = constraints.maxChars ? truncateToChars(raw, constraints.maxChars) : raw;
  const short = segments[0]?.text
    ? constraints.maxSegmentChars
      ? truncateToChars(segments[0].text, constraints.maxSegmentChars)
      : segments[0].text
    : '';

  const finalSegments = constraints.maxSegmentChars
    ? segments.map((s) => ({
        label: s.label,
        text:  truncateToChars(s.text, constraints.maxSegmentChars ?? 1200),
      }))
    : segments;

  return {
    full,
    short,
    segments: finalSegments,
    length,
    target,
    locale,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Truncation helper ────────────────────────────────────────────────────────

/**
 * Truncates text to at most `maxChars` characters, breaking at the last
 * complete word and appending an ellipsis if truncation occurred.
 */
export function truncateToChars(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const sliced = text.slice(0, maxChars - 1);
  const lastSpace = sliced.lastIndexOf(' ');
  const cut = lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced;
  return `${cut.trimEnd()}…`;
}

// ─── Segment builder helper ───────────────────────────────────────────────────

/** Builds a ComposedSegment, returning null when text is empty. */
export function makeSegment(label: string, text: string): ComposedSegment | null {
  const clean = text.trim();
  return clean ? { label, text: clean } : null;
}

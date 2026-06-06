// ─────────────────────────────────────────────────────────────────────────────
// Composer Layer Types
//
// Defines the output contracts for all composer functions.
// Composers accept ExplanationContext and ComposeOptions and return
// ComposedNarrative objects targeted to a specific delivery platform.
// ─────────────────────────────────────────────────────────────────────────────

import type { NarrativeLength } from '../types';

// ─── Delivery targets ─────────────────────────────────────────────────────────

/**
 * Each target has its own character limits, formatting rules, and section
 * structure. TARGET_CONSTRAINTS enforces these at composition time.
 */
export type NarrativeTarget =
  | 'pdf'               // full clinical report — no character limit
  | 'doctor-dashboard'  // structured, labelled sections for dashboard UI
  | 'patient-report'    // plain-language report for patient download
  | 'whatsapp'          // plain text, ≤500 characters, no markdown
  | 'avatar'            // short voiced segments, ≤300 characters each
  | 'api';              // raw structured JSON for integrations

// ─── Constraints per target ───────────────────────────────────────────────────

export interface TargetConstraints {
  readonly maxChars?: number;        // hard character ceiling (undefined = unlimited)
  readonly maxSegmentChars?: number; // per-segment ceiling (avatar segments etc.)
  readonly allowMarkdown: boolean;
  readonly defaultLength: NarrativeLength;
  readonly sectioned: boolean;       // true → each section is individually labelled
}

export const TARGET_CONSTRAINTS: Record<NarrativeTarget, TargetConstraints> = {
  'pdf': {
    allowMarkdown:    true,
    defaultLength:    'detailed',
    sectioned:        true,
  },
  'doctor-dashboard': {
    allowMarkdown:    true,
    defaultLength:    'medium',
    sectioned:        true,
  },
  'patient-report': {
    allowMarkdown:    true,
    defaultLength:    'medium',
    sectioned:        true,
  },
  'whatsapp': {
    maxChars:         500,
    allowMarkdown:    false,
    defaultLength:    'short',
    sectioned:        false,
  },
  'avatar': {
    maxSegmentChars:  300,
    allowMarkdown:    false,
    defaultLength:    'short',
    sectioned:        false,
  },
  'api': {
    allowMarkdown:    false,
    defaultLength:    'detailed',
    sectioned:        true,
  },
};

// ─── Compose options ──────────────────────────────────────────────────────────

export interface ComposeOptions {
  readonly length?: NarrativeLength;
  readonly target?: NarrativeTarget;
  readonly locale?: string;          // ISO 639-1 (e.g. 'en', 'ar') — reserved for i18n
}

// ─── Composed segment ─────────────────────────────────────────────────────────

/** A labelled block within a composed narrative. */
export interface ComposedSegment {
  readonly label: string;
  readonly text: string;
}

// ─── Composed narrative ───────────────────────────────────────────────────────

/** The output shape returned by every top-level compose function. */
export interface ComposedNarrative {
  /** Concatenated full text of all segments. */
  readonly full: string;
  /** First segment only — for WhatsApp / avatar / short displays. */
  readonly short: string;
  /** Individual labelled sections for structured UIs. */
  readonly segments: ComposedSegment[];
  readonly length: NarrativeLength;
  readonly target: NarrativeTarget;
  readonly locale: string;
  /** ISO 8601 timestamp of composition. */
  readonly generatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Compose Lifestyle Plan
//
// Selects relevant lifestyle templates based on patient flags, then assembles
// personalised lifestyle recommendations covering impact, recommendation, and
// timeframe for each applicable factor.
//
// Selection logic:
//   stress    → always included (cortisol is universally relevant)
//   sleep     → always included (GH pulsatility affects all patients)
//   nutrition → always included (follicular substrate is always relevant)
//   exercise  → included unless contraindicated by active pregnancy or GLP-1 early phase
// ─────────────────────────────────────────────────────────────────────────────

import type { ExplanationContext }        from '../types';
import type { LifestyleTemplate }         from '../templates/types';
import type { ComposeOptions, ComposedNarrative, ComposedSegment } from './types';
import { TARGET_CONSTRAINTS }             from './types';
import { STRESS_LIFESTYLE_TEMPLATE }      from '../templates/lifestyle/stress';
import { SLEEP_LIFESTYLE_TEMPLATE }       from '../templates/lifestyle/sleep';
import { NUTRITION_LIFESTYLE_TEMPLATE }   from '../templates/lifestyle/nutrition';
import { EXERCISE_LIFESTYLE_TEMPLATE }    from '../templates/lifestyle/exercise';
import {
  buildPatientSeed,
  resolveConditions,
  assembleSection,
  ensureTermination,
  cap,
}                                         from '../templates/_fragmentUtils';
import { buildComposedNarrative, makeSegment } from './_composeUtils';

// ─── Lifestyle factor selection ───────────────────────────────────────────────

function selectTemplates(context: ExplanationContext): LifestyleTemplate[] {
  const { flags } = context.clinicalProfile;
  const selected: LifestyleTemplate[] = [
    STRESS_LIFESTYLE_TEMPLATE,
    SLEEP_LIFESTYLE_TEMPLATE,
    NUTRITION_LIFESTYLE_TEMPLATE,
  ];
  // Exercise is included unless the patient is pregnant or in active GLP-1 phase
  if (!flags.isPregnant && !flags.hasGLP1Early) {
    selected.push(EXERCISE_LIFESTYLE_TEMPLATE);
  }
  return selected;
}

// ─── Main composer ────────────────────────────────────────────────────────────

/**
 * Produces a personalised lifestyle plan narrative.
 *
 * For each selected lifestyle template, sections are:
 * impact → recommendation → timeframe.
 * Each lifestyle factor is labelled (e.g., "Stress Management — Impact").
 */
export function composeLifestylePlan(
  context: ExplanationContext,
  options: ComposeOptions = {}
): ComposedNarrative {
  const { clinicalProfile } = context;
  const target      = options.target  ?? 'patient-report';
  const constraints = TARGET_CONSTRAINTS[target];
  const length      = options.length  ?? constraints.defaultLength;
  const locale      = options.locale  ?? 'en';

  const seed       = buildPatientSeed(clinicalProfile);
  const conditions = resolveConditions(clinicalProfile);
  const templates  = selectTemplates(context);

  const FACTOR_LABELS: Record<string, string> = {
    stress:    'Stress Management',
    sleep:     'Sleep Optimisation',
    nutrition: 'Nutrition',
    exercise:  'Physical Activity',
  };

  const segments: ComposedSegment[] = [];

  for (const template of templates) {
    const factorLabel = FACTOR_LABELS[template.factorKey] ?? template.factorKey;

    const sectionDefs = [
      { label: `${factorLabel} — Why It Matters`, fragments: template.impact },
      { label: `${factorLabel} — What To Do`,     fragments: template.recommendation },
      { label: `${factorLabel} — Timeline`,       fragments: template.timeframe },
    ];

    for (const { label, fragments } of sectionDefs) {
      const assembled = assembleSection(
        `${template.factorKey}_${label}`,
        fragments,
        conditions,
        seed,
        length
      );
      const seg = makeSegment(label, ensureTermination(cap(assembled.text)));
      if (seg) segments.push(seg);
    }
  }

  return buildComposedNarrative(segments, length, target, locale, constraints);
}

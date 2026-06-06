// ─────────────────────────────────────────────────────────────────────────────
// Compose Prognosis
//
// Maps Severity → PrognosisStage → PrognosisTemplate, then assembles a
// structured prognosis narrative covering timeline, probability, caveats,
// and recovery trajectory.
// ─────────────────────────────────────────────────────────────────────────────

import type { ExplanationContext }        from '../types';
import type { ComposeOptions, ComposedNarrative, ComposedSegment } from './types';
import { TARGET_CONSTRAINTS }             from './types';
import { SEVERITY_TO_STAGE }              from '../templates/types';
import { EARLY_PROGNOSIS_TEMPLATE }       from '../templates/prognosis/early';
import { MODERATE_PROGNOSIS_TEMPLATE }    from '../templates/prognosis/moderate';
import { ADVANCED_PROGNOSIS_TEMPLATE }    from '../templates/prognosis/advanced';
import type { PrognosisTemplate }         from '../templates/types';
import {
  buildPatientSeed,
  resolveConditions,
  assembleSection,
  ensureTermination,
  cap,
}                                         from '../templates/_fragmentUtils';
import { buildComposedNarrative, makeSegment } from './_composeUtils';

// ─── Prognosis template registry ─────────────────────────────────────────────

const PROGNOSIS_TEMPLATES: Record<string, PrognosisTemplate> = {
  early:    EARLY_PROGNOSIS_TEMPLATE,
  moderate: MODERATE_PROGNOSIS_TEMPLATE,
  advanced: ADVANCED_PROGNOSIS_TEMPLATE,
};

// ─── Main composer ────────────────────────────────────────────────────────────

/**
 * Assembles a prognosis narrative appropriate to the patient's severity level.
 *
 * Section order: timeline → probability → caveats → recovery.
 */
export function composePrognosis(
  context: ExplanationContext,
  options: ComposeOptions = {}
): ComposedNarrative {
  const { clinicalProfile } = context;
  const target      = options.target  ?? 'patient-report';
  const constraints = TARGET_CONSTRAINTS[target];
  const length      = options.length  ?? constraints.defaultLength;
  const locale      = options.locale  ?? 'en';

  const stage      = SEVERITY_TO_STAGE[clinicalProfile.severity];
  const template   = PROGNOSIS_TEMPLATES[stage];
  const seed       = buildPatientSeed(clinicalProfile);
  const conditions = resolveConditions(clinicalProfile);

  const sectionDefs = [
    { label: 'Expected Timeline',      fragments: template.timeline },
    { label: 'Recovery Probability',   fragments: template.probability },
    { label: 'Important Caveats',      fragments: template.caveats },
    { label: 'Recovery Trajectory',    fragments: template.recovery },
  ];

  const segments: ComposedSegment[] = sectionDefs
    .map(({ label, fragments }) => {
      const assembled = assembleSection(label, fragments, conditions, seed, length);
      return makeSegment(label, ensureTermination(cap(assembled.text)));
    })
    .filter((s): s is ComposedSegment => s !== null);

  return buildComposedNarrative(segments, length, target, locale, constraints);
}

// ─────────────────────────────────────────────────────────────────────────────
// Compose Clinical Narrative
//
// Assembles a doctor-audience clinical narrative for a given patient profile.
// Maps DiagnosisKey → ClinicalCategory → ClinicalTemplate, then composes each
// template section into a structured ComposedNarrative.
// ─────────────────────────────────────────────────────────────────────────────

import type { ExplanationContext }        from '../types';
import type { ClinicalTemplate }          from '../templates/types';
import type { ComposeOptions, ComposedNarrative, ComposedSegment } from './types';
import { TARGET_CONSTRAINTS }             from './types';
import {
  DIAGNOSIS_CATEGORY_MAP,
  SEVERITY_TO_STAGE,
}                                         from '../templates/types';
import { AGA_DOCTOR_TEMPLATE }            from '../templates/doctor/aga';
import { TE_DOCTOR_TEMPLATE }             from '../templates/doctor/te';
import { PCOS_DOCTOR_TEMPLATE }           from '../templates/doctor/pcos';
import { THYROID_DOCTOR_TEMPLATE }        from '../templates/doctor/thyroid';
import { INFLAMMATION_DOCTOR_TEMPLATE }   from '../templates/doctor/inflammation';
import { AA_DOCTOR_TEMPLATE }             from '../templates/doctor/aa';
import { MULTIFACTORIAL_DOCTOR_TEMPLATE } from '../templates/doctor/multifactorial';
import {
  buildPatientSeed,
  resolveConditions,
  assembleSection,
  ensureTermination,
  cap,
}                                         from '../templates/_fragmentUtils';
import { buildComposedNarrative }         from './_composeUtils';

// ─── Doctor template registry ────────────────────────────────────────────────

const DOCTOR_TEMPLATES: Record<string, ClinicalTemplate> = {
  aga:            AGA_DOCTOR_TEMPLATE,
  te:             TE_DOCTOR_TEMPLATE,
  pcos:           PCOS_DOCTOR_TEMPLATE,
  thyroid:        THYROID_DOCTOR_TEMPLATE,
  inflammation:   INFLAMMATION_DOCTOR_TEMPLATE,
  aa:             AA_DOCTOR_TEMPLATE,
  multifactorial: MULTIFACTORIAL_DOCTOR_TEMPLATE,
};

// ─── Main composer ────────────────────────────────────────────────────────────

/**
 * Produces a doctor-audience clinical narrative for the patient.
 *
 * Section order: opening → mechanism → severity context → treatment → prognosis
 * → closing (if present). Each section becomes a labelled ComposedSegment.
 */
export function composeClinicalNarrative(
  context: ExplanationContext,
  options: ComposeOptions = {}
): ComposedNarrative {
  const { clinicalProfile } = context;
  const target   = options.target  ?? 'doctor-dashboard';
  const constraints = TARGET_CONSTRAINTS[target];
  const length   = options.length  ?? constraints.defaultLength;
  const locale   = options.locale  ?? 'en';

  const category   = DIAGNOSIS_CATEGORY_MAP[clinicalProfile.primaryDiagnosis] ?? 'inflammation';
  const template   = DOCTOR_TEMPLATES[category];
  const seed       = buildPatientSeed(clinicalProfile);
  const conditions = resolveConditions(clinicalProfile);

  const { sections } = template;

  // Resolve the correct severity bucket
  const stage = SEVERITY_TO_STAGE[clinicalProfile.severity];
  const severityFragments =
    stage === 'advanced' ? sections.severity.severe :
    stage === 'moderate' ? sections.severity.moderate :
    sections.severity.mild;

  const sectionDefs: Array<{ label: string; fragments: typeof sections.opening }> = [
    { label: 'Clinical Overview',    fragments: sections.opening },
    { label: 'Pathophysiology',      fragments: sections.mechanism },
    { label: 'Severity Assessment',  fragments: severityFragments },
    { label: 'Treatment Rationale',  fragments: sections.treatment },
    { label: 'Prognosis',            fragments: sections.prognosis },
    ...(sections.closing ? [{ label: 'Clinical Notes', fragments: sections.closing }] : []),
  ];

  const segments: ComposedSegment[] = sectionDefs
    .map(({ label, fragments }) => {
      const assembled = assembleSection(label, fragments, conditions, seed, length, context.facts);
      const text = ensureTermination(cap(assembled.text));
      return text ? { label, text } : null;
    })
    .filter((s): s is ComposedSegment => s !== null);

  return buildComposedNarrative(segments, length, target, locale, constraints);
}

// ─────────────────────────────────────────────────────────────────────────────
// Compose Patient Narrative
//
// Assembles a patient-audience narrative for a given patient profile.
// Uses the patient template set and personalises with the patient's name.
// ─────────────────────────────────────────────────────────────────────────────

import type { ExplanationContext }        from '../types';
import type { ClinicalTemplate }          from '../templates/types';
import type { ComposeOptions, ComposedNarrative, ComposedSegment } from './types';
import { TARGET_CONSTRAINTS }             from './types';
import { DIAGNOSIS_CATEGORY_MAP, SEVERITY_TO_STAGE } from '../templates/types';
import { AGA_PATIENT_TEMPLATE }            from '../templates/patient/aga';
import { TE_PATIENT_TEMPLATE }             from '../templates/patient/te';
import { PCOS_PATIENT_TEMPLATE }           from '../templates/patient/pcos';
import { THYROID_PATIENT_TEMPLATE }        from '../templates/patient/thyroid';
import { INFLAMMATION_PATIENT_TEMPLATE }   from '../templates/patient/inflammation';
import { AA_PATIENT_TEMPLATE }             from '../templates/patient/aa';
import { MULTIFACTORIAL_PATIENT_TEMPLATE } from '../templates/patient/multifactorial';
import {
  buildPatientSeed,
  resolveConditions,
  assembleSection,
  ensureTermination,
  cap,
}                                         from '../templates/_fragmentUtils';
import { buildComposedNarrative, makeSegment } from './_composeUtils';

// ─── Patient template registry ────────────────────────────────────────────────

const PATIENT_TEMPLATES: Record<string, ClinicalTemplate> = {
  aga:            AGA_PATIENT_TEMPLATE,
  te:             TE_PATIENT_TEMPLATE,
  pcos:           PCOS_PATIENT_TEMPLATE,
  thyroid:        THYROID_PATIENT_TEMPLATE,
  inflammation:   INFLAMMATION_PATIENT_TEMPLATE,
  aa:             AA_PATIENT_TEMPLATE,
  multifactorial: MULTIFACTORIAL_PATIENT_TEMPLATE,
};

// ─── Main composer ────────────────────────────────────────────────────────────

/**
 * Produces a patient-audience narrative.
 *
 * If `context.patientName` is provided the first segment is personalised with
 * a greeting. Section order: opening → mechanism → severity → treatment →
 * prognosis → closing (if present).
 */
export function composePatientNarrative(
  context: ExplanationContext,
  options: ComposeOptions = {}
): ComposedNarrative {
  const { clinicalProfile, patientName } = context;
  const target      = options.target  ?? 'patient-report';
  const constraints = TARGET_CONSTRAINTS[target];
  const length      = options.length  ?? constraints.defaultLength;
  const locale      = options.locale  ?? 'en';

  const category   = DIAGNOSIS_CATEGORY_MAP[clinicalProfile.primaryDiagnosis] ?? 'inflammation';
  const template   = PATIENT_TEMPLATES[category];
  const seed       = buildPatientSeed(clinicalProfile);
  const conditions = resolveConditions(clinicalProfile);

  const { sections } = template;

  const stage = SEVERITY_TO_STAGE[clinicalProfile.severity];
  const severityFragments =
    stage === 'advanced' ? sections.severity.severe :
    stage === 'moderate' ? sections.severity.moderate :
    sections.severity.mild;

  const sectionDefs: Array<{ label: string; fragments: typeof sections.opening }> = [
    { label: 'What Is Happening',    fragments: sections.opening },
    { label: 'Why This Occurs',      fragments: sections.mechanism },
    { label: 'Your Situation',       fragments: severityFragments },
    { label: 'Your Treatment Plan',  fragments: sections.treatment },
    { label: 'What To Expect',       fragments: sections.prognosis },
    ...(sections.closing ? [{ label: 'Important Notes', fragments: sections.closing }] : []),
  ];

  const segments: ComposedSegment[] = sectionDefs
    .map(({ label, fragments }) => {
      const assembled = assembleSection(label, fragments, conditions, seed, length);
      return makeSegment(label, ensureTermination(cap(assembled.text)));
    })
    .filter((s): s is ComposedSegment => s !== null);

  // Prepend greeting when name is available
  const withGreeting: ComposedSegment[] = patientName
    ? [{ label: 'Greeting', text: `Hello ${patientName},` }, ...segments]
    : segments;

  return buildComposedNarrative(withGreeting, length, target, locale, constraints);
}

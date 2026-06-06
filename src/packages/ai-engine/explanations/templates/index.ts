// ─── Template Layer — Public Exports ─────────────────────────────────────────
// Re-exports every template object, the fragment utilities, and shared types.
// Consumers import from this file rather than individual template modules.

export type {
  Fragment,
  FragmentConditionKey,
  FragmentConditions,
  ClinicalCategory,
  ClinicalTemplate,
  PrognosisStage,
  PrognosisTemplate,
  TherapyTemplateKey,
  TherapyTemplate,
  LifestyleTemplateKey,
  LifestyleTemplate,
  AssembledSection,
} from './types';

export { SEVERITY_TO_STAGE, DIAGNOSIS_CATEGORY_MAP } from './types';

// ─── Fragment utilities ───────────────────────────────────────────────────────

export {
  f,
  v,
  c,
  cv,
  buildPatientSeed,
  pickVariant,
  resolveConditions,
  filterFragments,
  assembleSection,
  joinSections,
  ensureTermination,
  cap,
  assembleAndFinish,
} from './_fragmentUtils';

// ─── Doctor templates ─────────────────────────────────────────────────────────

export { AGA_DOCTOR_TEMPLATE }            from './doctor/aga';
export { TE_DOCTOR_TEMPLATE }             from './doctor/te';
export { PCOS_DOCTOR_TEMPLATE }           from './doctor/pcos';
export { THYROID_DOCTOR_TEMPLATE }        from './doctor/thyroid';
export { INFLAMMATION_DOCTOR_TEMPLATE }   from './doctor/inflammation';
export { AA_DOCTOR_TEMPLATE }             from './doctor/aa';
export { MULTIFACTORIAL_DOCTOR_TEMPLATE } from './doctor/multifactorial';

// ─── Patient templates ────────────────────────────────────────────────────────

export { AGA_PATIENT_TEMPLATE }            from './patient/aga';
export { TE_PATIENT_TEMPLATE }             from './patient/te';
export { PCOS_PATIENT_TEMPLATE }           from './patient/pcos';
export { THYROID_PATIENT_TEMPLATE }        from './patient/thyroid';
export { INFLAMMATION_PATIENT_TEMPLATE }   from './patient/inflammation';
export { AA_PATIENT_TEMPLATE }             from './patient/aa';
export { MULTIFACTORIAL_PATIENT_TEMPLATE } from './patient/multifactorial';

// ─── Prognosis templates ──────────────────────────────────────────────────────

export { EARLY_PROGNOSIS_TEMPLATE }      from './prognosis/early';
export { MODERATE_PROGNOSIS_TEMPLATE }   from './prognosis/moderate';
export { ADVANCED_PROGNOSIS_TEMPLATE }   from './prognosis/advanced';

// ─── Therapy templates ────────────────────────────────────────────────────────

export { MINOXIDIL_THERAPY_TEMPLATE }         from './therapies/minoxidil';
export { PEPTIDES_THERAPY_TEMPLATE }          from './therapies/peptides';
export { ANTI_INFLAMMATORY_THERAPY_TEMPLATE } from './therapies/antiInflammatory';
export { METABOLIC_THERAPY_TEMPLATE }         from './therapies/metabolic';

// ─── Lifestyle templates ──────────────────────────────────────────────────────

export { STRESS_LIFESTYLE_TEMPLATE }     from './lifestyle/stress';
export { SLEEP_LIFESTYLE_TEMPLATE }      from './lifestyle/sleep';
export { NUTRITION_LIFESTYLE_TEMPLATE }  from './lifestyle/nutrition';
export { EXERCISE_LIFESTYLE_TEMPLATE }   from './lifestyle/exercise';

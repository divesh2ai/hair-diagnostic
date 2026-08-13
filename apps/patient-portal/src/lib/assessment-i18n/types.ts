/**
 * Patient-assessment localisation — type contracts.
 *
 * ARCHITECTURE RULE (non-negotiable):
 * This layer is *presentation only*. Question IDs, option IDs (`option.id`,
 * which the protocol defines as `SchemaOption.value`) and every answer written
 * into the assessment store stay in their canonical English form regardless of
 * locale. Nothing here may be read by scoring, visibility, skip, exclusivity,
 * diagnosis, kit-mapping or report logic.
 *
 *   Hindi presentation → stable question ID + answer code → clinical engine
 *
 * The reverse arrow (Hindi text → clinical logic) must never exist.
 */

import { LOCALE_LABELS, LOCALES, isLocale, type Locale } from '@/lib/i18n/types';

/**
 * Patient-facing assessment locales. Reuses the platform `Locale` union
 * (which mirrors the `SupportedLanguage` Prisma enum) so we never grow a second
 * locale registry. `ASSESSMENT_LOCALES` is the subset actually offered to
 * patients today.
 *
 * Adding a language is a content change: a chrome dictionary in `locales/`, a
 * content pack in `content/`, an entry here and one in `CONTENT_PACKS`.
 * Gujarati/Punjabi/Tamil/Telugu additionally need a script font (Marathi did
 * not — it shares Devanagari with Hindi). Kannada and Bengali are not in the
 * platform `Locale` union or the Prisma enum yet, so those two also need a
 * registry entry and an additive enum migration.
 */
export const ASSESSMENT_LOCALES = ['en', 'hi', 'mr'] as const satisfies readonly Locale[];
export type AssessmentLocale = (typeof ASSESSMENT_LOCALES)[number];

export const DEFAULT_ASSESSMENT_LOCALE: AssessmentLocale = 'en';

export function isAssessmentLocale(value: unknown): value is AssessmentLocale {
  return (
    typeof value === 'string' &&
    (ASSESSMENT_LOCALES as readonly string[]).includes(value)
  );
}

/** Maps an assessment locale to the `SupportedLanguage` Prisma enum member. */
export function toSupportedLanguage(locale: AssessmentLocale): string {
  return locale.toUpperCase();
}

export { LOCALE_LABELS, LOCALES, isLocale };
export type { Locale };

// ─────────────────────────────────────────────────────────────────────────────
// UI CHROME DICTIONARY
// Everything the patient reads that is NOT protocol content: buttons, hints,
// validation, photo flow, submission and processing copy.
//
// English is the master. `hi` must satisfy the same type, so TypeScript fails
// the build on a missing Hindi chrome key — see locales/hi.ts.
// ─────────────────────────────────────────────────────────────────────────────

export type AssessmentDictionary = {
  /** Language gate shown before the first question. */
  gate: {
    eyebrow: string;
    titleEnglish: string;
    titleNative: string;
    body: string;
    continueLabel: string;
    /** Reassurance row under the picker. */
    metaDuration: string;
    metaPrivacy: string;
    metaReview: string;
    switchHint: string;
  };
  /**
   * Pre-assessment intake gate: name + mobile, then visit intent for a
   * returning patient. Operational copy, not protocol content — nothing here
   * is a question and none of it affects the question count or progress.
   */
  intake: {
    eyebrow: string;
    title: string;
    body: string;
    nameLabel: string;
    namePlaceholder: string;
    mobileLabel: string;
    mobilePlaceholder: string;
    /** Why we ask. Reassurance, not a legal notice. */
    mobileHint: string;
    privacyNote: string;
    continueLabel: string;
    checking: string;
    nameRequired: string;
    nameInvalid: string;
    /** Keyed to `PhoneRejection` in lib/patient/phone. */
    phoneEmpty: string;
    phoneTooShort: string;
    phoneTooLong: string;
    phoneNotAMobile: string;
    phoneMalformed: string;
    /** Server unreachable — the patient's connection may genuinely be at fault. */
    connectionErrorTitle: string;
    connectionErrorBody: string;
    /**
     * Server reachable but identity lookup is switched off / not yet migrated.
     * Must not blame the patient's network and must not promise that waiting
     * helps in seconds — a human has to act.
     */
    unavailableTitle: string;
    unavailableBody: string;
    continueAnyway: string;
    /** Returning-patient step. */
    returningTitle: string;
    returningBody: string;
    intentFollowUp: string;
    intentKitFulfilment: string;
    intentConditionChanged: string;
    intentNewConcern: string;
    intentReassessment: string;
    intentRequired: string;
  };
  common: {
    back: string;
    skip: string;
    retry: string;
    language: string;
    languageSwitchLabel: string;
  };
  questionnaire: {
    /** Eyebrow above each question title, e.g. "QUESTION 04". */
    questionEyebrow: string;
    /** Progress readout, e.g. "Question 4 of 21". */
    progressCounter: string;
    multiSelectHint: string;
    selectedCount: string;
    enterHintPrefix: string;
    enterHintSuffix: string;
    beginChapter: string;
    beginFinalChapter: string;
    chapterAriaLabel: string;
    progressAriaLabel: string;
    loading: string;
    forwardContinue: string;
    forwardComplete: string;
    forwardSubmitting: string;
  };
  input: {
    textPlaceholder: string;
    textareaPlaceholder: string;
    numberPlaceholder: string;
  };
  validation: {
    required: string;
    outOfRange: string;
  };
  photo: {
    tapToAdd: string;
    fileHint: string;
    uploading: string;
    savedSecurely: string;
    replace: string;
    remove: string;
    retryUpload: string;
    previewAlt: string;
    errorType: string;
    errorSize: string;
    errorGeneric: string;
    errorRemove: string;
    guidanceLighting: string;
  };
  submission: {
    submitting: string;
    doNotClose: string;
    completeTitle: string;
    completeBody: string;
    failedTitle: string;
  };
  processing: {
    warmupEyebrow: string;
    warmupHead: string;
    warmupSub: string;
    warmupEta: string;
    step1Eyebrow: string;
    step1Head: string;
    step1Sub: string;
    step1Eta: string;
    step2Eyebrow: string;
    step2Head: string;
    step2Sub: string;
    step2Eta: string;
    step3Eyebrow: string;
    step3Head: string;
    step3Sub: string;
    step3Eta: string;
    step4Eyebrow: string;
    step4Head: string;
    step4Sub: string;
    step4Eta: string;
    step5Eyebrow: string;
    step5Head: string;
    step5Sub: string;
    step5Eta: string;
    doneEyebrow: string;
    doneHead: string;
    doneSub: string;
    errorTitle: string;
    errorBody: string;
  };
  /** Patient-visible bridge stage names. Display only — zone maths is untouched. */
  bridgeStages: {
    identity: string;
    biological: string;
    lifestyle: string;
    stress: string;
    hormonal: string;
    nutritional: string;
    scalp: string;
    environmental: string;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// PROTOCOL CONTENT PACK
//
// Overrides for protocol-authored copy, keyed by the *canonical* identifiers.
// English deliberately has NO pack: English display text is read straight from
// the protocol, so the question bank keeps exactly one source of truth and can
// never drift from its own translation.
// ─────────────────────────────────────────────────────────────────────────────

export interface QuestionContent {
  /** Overrides `question.title`. */
  title: string;
  /** Overrides `question.subtitle`. */
  subtitle?: string;
  /** Overrides `question.helperText`. */
  helper?: string;
  /** Overrides `question.validation.placeholder`. */
  placeholder?: string;
  /** Overrides `question.validation.errorMessage`. */
  errorMessage?: string;
  /** Overrides `question.mutualExclusivityToast`. */
  exclusivityToast?: string;
  /**
   * Option labels keyed by the canonical option ID (`SchemaOption.value`).
   * The key is the immutable answer code — never a translated string.
   */
  options?: Record<string, string>;
}

export interface SectionContent {
  title: string;
  body: string;
}

export interface AssessmentContentPack {
  /** Keyed by protocol `sectionId` (e.g. `S1_PATIENT_IDENTITY`). */
  sections: Record<string, SectionContent>;
  /** Keyed by protocol `question.id` (e.g. `hairtype`). */
  questions: Record<string, QuestionContent>;
}

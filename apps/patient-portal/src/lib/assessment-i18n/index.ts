export {
  ASSESSMENT_LOCALES,
  DEFAULT_ASSESSMENT_LOCALE,
  LOCALE_LABELS,
  isAssessmentLocale,
  toSupportedLanguage,
  type AssessmentContentPack,
  type AssessmentDictionary,
  type AssessmentLocale,
  type QuestionContent,
  type SectionContent,
} from './types';

export {
  CONTENT_PACKS,
  DICTIONARIES,
  createAssessmentTranslator,
  type AssessmentDictionaryPath,
  type AssessmentTranslator,
} from './resolver';

export {
  validateContentCompleteness,
  validateLocaleCompleteness,
  type CompletenessReport,
} from './completeness';

export {
  clampLocaleToAvailable,
  resolveAvailableLocales,
  shouldOfferLanguageChoice,
} from './availability';

export {
  useAssessmentLocale,
  useAssessmentTranslator,
  useAvailableAssessmentLocales,
  useSyncDocumentLocale,
} from './useAssessmentTranslator';

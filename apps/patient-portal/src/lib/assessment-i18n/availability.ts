/**
 * Which languages a given clinic offers its patients.
 *
 * Three constraints intersect:
 *
 *   1. `Clinic.supportedLanguages` — what this clinic wants to offer. Empty
 *      means "all", which is the schema's documented default.
 *   2. `ASSESSMENT_LOCALES` — what the platform can actually render a full
 *      assessment in today. A clinic may legitimately be configured for Tamil
 *      before a Tamil content pack exists.
 *   3. A non-empty result — a patient must always have at least one language,
 *      so an intersection that comes out empty falls back to English.
 *
 * Getting (2) wrong is the dangerous one: offering a language with no content
 * pack would drop the patient into a fully English assessment behind a Tamil
 * button. The intersection makes that impossible.
 */

import {
  ASSESSMENT_LOCALES,
  DEFAULT_ASSESSMENT_LOCALE,
  isAssessmentLocale,
  type AssessmentLocale,
} from './types';

/**
 * @param supported `SupportedLanguage` enum members from the clinic record
 *   (`["EN", "HI"]`). Undefined or empty = offer everything available.
 */
export function resolveAvailableLocales(
  supported?: readonly string[] | null,
): AssessmentLocale[] {
  const all = [...ASSESSMENT_LOCALES];

  if (!supported || supported.length === 0) return all;

  // The Prisma enum is uppercase (`HI`); locale codes are lowercase (`hi`).
  const requested = new Set(
    supported
      .map((value) => String(value).toLowerCase())
      .filter(isAssessmentLocale),
  );

  const offered = all.filter((locale) => requested.has(locale));

  // A clinic configured only for languages we cannot yet render must still be
  // able to take an assessment.
  return offered.length > 0 ? offered : [DEFAULT_ASSESSMENT_LOCALE];
}

/**
 * True when the patient should be given a choice at all. A clinic offering one
 * language gets no gate and no switcher — a one-item picker is noise.
 */
export function shouldOfferLanguageChoice(available: readonly AssessmentLocale[]): boolean {
  return available.length > 1;
}

/**
 * Coerce a stored/persisted locale into one this clinic actually offers.
 *
 * Guards the case where a patient picked Hindi at clinic A, then scanned
 * clinic B's QR where Hindi is not offered — the persisted locale would
 * otherwise render a language the clinic has switched off.
 */
export function clampLocaleToAvailable(
  locale: AssessmentLocale,
  available: readonly AssessmentLocale[],
): AssessmentLocale {
  if (available.includes(locale)) return locale;
  return available[0] ?? DEFAULT_ASSESSMENT_LOCALE;
}

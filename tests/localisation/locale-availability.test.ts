/**
 * Per-clinic language availability.
 *
 * The rule that matters clinically: a clinic must never be able to offer a
 * language we cannot fully render. Showing a मराठी button that drops the
 * patient into an English assessment is worse than not offering Marathi.
 */

import { describe, expect, it } from 'vitest';

import {
  clampLocaleToAvailable,
  resolveAvailableLocales,
  shouldOfferLanguageChoice,
} from '@/lib/assessment-i18n/availability';
import { ASSESSMENT_LOCALES } from '@/lib/assessment-i18n/types';

describe('resolveAvailableLocales', () => {
  it('offers everything when the clinic has no preference', () => {
    // Empty is the schema default and documented as "all locales offered".
    expect(resolveAvailableLocales([])).toEqual([...ASSESSMENT_LOCALES]);
    expect(resolveAvailableLocales(undefined)).toEqual([...ASSESSMENT_LOCALES]);
    expect(resolveAvailableLocales(null)).toEqual([...ASSESSMENT_LOCALES]);
  });

  it('honours an explicit subset', () => {
    expect(resolveAvailableLocales(['EN', 'MR'])).toEqual(['en', 'mr']);
    expect(resolveAvailableLocales(['HI'])).toEqual(['hi']);
  });

  it('maps the uppercase Prisma enum onto lowercase locale codes', () => {
    expect(resolveAvailableLocales(['EN', 'HI'])).toEqual(['en', 'hi']);
  });

  it('preserves the platform ordering, not the clinic\'s array order', () => {
    // English first is a deliberate presentation choice; a clinic reordering
    // its column must not reorder the picker.
    expect(resolveAvailableLocales(['MR', 'HI', 'EN'])).toEqual([...ASSESSMENT_LOCALES]);
  });

  it('drops languages the platform cannot render yet', () => {
    // Tamil is a valid SupportedLanguage but has no content pack. Offering it
    // would put the patient into an English assessment behind a Tamil label.
    expect(resolveAvailableLocales(['EN', 'TA'])).toEqual(['en']);
    expect(resolveAvailableLocales(['HI', 'GU', 'PA'])).toEqual(['hi']);
  });

  it('falls back to English rather than offering nothing', () => {
    // A clinic configured only for languages we cannot render must still be
    // able to take an assessment.
    expect(resolveAvailableLocales(['TA', 'TE'])).toEqual(['en']);
    expect(resolveAvailableLocales(['NONSENSE'])).toEqual(['en']);
  });

  it('ignores unknown values instead of throwing', () => {
    expect(resolveAvailableLocales(['EN', 'KLINGON', 'HI'])).toEqual(['en', 'hi']);
  });

  it('is case-insensitive about the incoming values', () => {
    expect(resolveAvailableLocales(['en', 'hi'])).toEqual(['en', 'hi']);
    expect(resolveAvailableLocales(['Hi', 'Mr'])).toEqual(['hi', 'mr']);
  });

  it('never returns duplicates', () => {
    const result = resolveAvailableLocales(['EN', 'EN', 'HI', 'HI']);
    expect(result).toEqual([...new Set(result)]);
  });
});

describe('shouldOfferLanguageChoice', () => {
  it('is false for a single-language clinic', () => {
    expect(shouldOfferLanguageChoice(resolveAvailableLocales(['EN']))).toBe(false);
    expect(shouldOfferLanguageChoice(resolveAvailableLocales(['HI']))).toBe(false);
    // Also false when the fallback collapsed the list to English.
    expect(shouldOfferLanguageChoice(resolveAvailableLocales(['TA']))).toBe(false);
  });

  it('is true once there is a real decision to make', () => {
    expect(shouldOfferLanguageChoice(resolveAvailableLocales(['EN', 'HI']))).toBe(true);
    expect(shouldOfferLanguageChoice(resolveAvailableLocales([]))).toBe(true);
  });
});

describe('clampLocaleToAvailable', () => {
  it('leaves an offered locale alone', () => {
    expect(clampLocaleToAvailable('hi', ['en', 'hi', 'mr'])).toBe('hi');
  });

  it('repairs a locale the clinic does not offer', () => {
    // Patient chose Hindi at clinic A, then scanned clinic B's English-only QR.
    expect(clampLocaleToAvailable('hi', ['en'])).toBe('en');
    expect(clampLocaleToAvailable('mr', ['en', 'hi'])).toBe('en');
  });

  it('falls back to the first offered locale, not blindly to English', () => {
    // A Hindi-only clinic should land on Hindi, not English.
    expect(clampLocaleToAvailable('mr', ['hi'])).toBe('hi');
  });

  it('survives an empty list', () => {
    expect(clampLocaleToAvailable('hi', [])).toBe('en');
  });
});

describe('every offered locale is fully renderable', () => {
  it('only ever returns locales that have a content pack or are the default', async () => {
    const { CONTENT_PACKS } = await import('@/lib/assessment-i18n/resolver');
    const everyPossibleClinicConfig = [
      [],
      ['EN'],
      ['HI'],
      ['MR'],
      ['EN', 'HI'],
      ['EN', 'MR'],
      ['HI', 'MR'],
      ['EN', 'HI', 'MR'],
      ['EN', 'HI', 'MR', 'GU', 'PA', 'TA', 'TE'],
    ];

    for (const config of everyPossibleClinicConfig) {
      for (const locale of resolveAvailableLocales(config)) {
        const renderable = locale === 'en' || Boolean(CONTENT_PACKS[locale]);
        expect(renderable, `${locale} offered for config ${JSON.stringify(config)}`).toBe(true);
      }
    }
  });
});

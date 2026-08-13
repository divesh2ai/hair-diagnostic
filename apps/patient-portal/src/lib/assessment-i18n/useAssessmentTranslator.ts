'use client';

import { useEffect, useMemo } from 'react';

import { useAssessmentStore } from '@/stores/useAssessmentStore';

import {
  clampLocaleToAvailable,
  resolveAvailableLocales,
  shouldOfferLanguageChoice,
} from './availability';
import { createAssessmentTranslator, type AssessmentTranslator } from './resolver';
import { LOCALE_COOKIE } from '@/lib/i18n/types';
import type { AssessmentLocale } from './types';

/**
 * The assessment locale lives in the zustand store rather than a dedicated
 * React context, so it rides along with the answers it belongs to: one
 * persisted session object, one rehydration path, no second source of truth to
 * keep in sync on refresh or resume.
 *
 * `createAssessmentTranslator` is pure and cheap, so memoising per component on
 * `locale` is enough — no provider needed.
 */
export function useAssessmentTranslator(): AssessmentTranslator {
  const locale = useAssessmentStore((state) => state.locale);
  return useMemo(() => createAssessmentTranslator(locale), [locale]);
}

export function useAssessmentLocale(): {
  locale: AssessmentLocale;
  setLocale: (locale: AssessmentLocale) => void;
} {
  const locale = useAssessmentStore((state) => state.locale);
  const setLocale = useAssessmentStore((state) => state.setLocale);
  return { locale, setLocale };
}

/**
 * The languages this clinic offers, derived from `clinicData.supportedLanguages`
 * and intersected with what the platform can actually render.
 *
 * Also repairs a stale persisted locale: a patient who chose Hindi at one
 * clinic and then scans another clinic's QR must not be shown Hindi if that
 * clinic has it switched off. The repair happens here rather than in the store
 * so it re-evaluates whenever the clinic changes.
 */
export function useAvailableAssessmentLocales(): {
  available: AssessmentLocale[];
  offersChoice: boolean;
} {
  const supportedLanguages = useAssessmentStore(
    (state) => state.clinicData?.supportedLanguages,
  );
  const locale = useAssessmentStore((state) => state.locale);
  const setLocale = useAssessmentStore((state) => state.setLocale);

  const available = useMemo(
    () => resolveAvailableLocales(supportedLanguages),
    [supportedLanguages],
  );

  useEffect(() => {
    const clamped = clampLocaleToAvailable(locale, available);
    if (clamped !== locale) setLocale(clamped);
  }, [available, locale, setLocale]);

  return { available, offersChoice: shouldOfferLanguageChoice(available) };
}

/**
 * Keeps `<html lang>` in step with the patient's choice so screen readers pick
 * the right voice and the Devanagari font stack in globals.css can key off
 * `:lang(hi)`.
 *
 * Also mirrors the choice into the existing platform locale cookie, so a
 * patient who later lands on a server-rendered surface is greeted in the same
 * language. The cookie is a mirror, never the source of truth — the store is.
 */
export function useSyncDocumentLocale(locale: AssessmentLocale): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const previous = document.documentElement.lang;
    document.documentElement.lang = locale;
    document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    return () => {
      document.documentElement.lang = previous;
    };
  }, [locale]);
}

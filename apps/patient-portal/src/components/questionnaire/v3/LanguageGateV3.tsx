'use client';

import { useEffect } from 'react';
import { ArrowRight, Check, Clock, Lock, Stethoscope } from 'lucide-react';

import {
  LOCALE_LABELS,
  createAssessmentTranslator,
  useAssessmentLocale,
  useAvailableAssessmentLocales,
  type AssessmentLocale,
} from '@/lib/assessment-i18n';
import { useAssessmentStore } from '@/stores/useAssessmentStore';

import styles from './LanguageGateV3.module.css';

/**
 * Chapter zero: the language choice.
 *
 * Shown once, before the first question, and only until the patient has
 * chosen — after that the compact switcher in the progress band takes over.
 *
 * The screen previews as you pick: tapping हिन्दी re-renders this screen in
 * Hindi immediately, so the patient can confirm they can read it before
 * committing to a 21-question assessment. The pick is written to the store
 * right away (so a refresh mid-pick keeps it) while `confirmLocale` — which is
 * what actually dismisses this screen — waits for the continue button.
 */
export function LanguageGateV3() {
  const { locale, setLocale } = useAssessmentLocale();
  const { available, offersChoice } = useAvailableAssessmentLocales();
  const confirmLocale = useAssessmentStore((state) => state.confirmLocale);

  // Driven by the store, not local state: the gate is already rendering in the
  // patient's picked language, which is the preview.
  const selected: AssessmentLocale = locale;
  const { t } = createAssessmentTranslator(selected);

  // A clinic offering one language has no choice to present. Confirm silently
  // so the patient goes straight to question one instead of tapping through a
  // screen with a single option.
  useEffect(() => {
    if (!offersChoice) confirmLocale();
  }, [confirmLocale, offersChoice]);

  useEffect(() => {
    // Enter confirms, matching the questionnaire's Enter-to-continue rhythm.
    // Skips the language buttons so Enter there picks rather than confirms.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.repeat) return;
      if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el?.closest('[data-locale-choice]')) return;
      event.preventDefault();
      confirmLocale();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [confirmLocale]);

  // The confirm effect above dismisses this screen on the next commit; render
  // nothing rather than flashing a one-option picker.
  if (!offersChoice) return null;

  return (
    <main className={styles.gate} lang={selected}>
      <div className={styles.inner}>
        <span className={styles.eyebrow}>{t('gate.eyebrow')}</span>

        <div className={styles.titles}>
          {/* Both scripts, always — the one screen a patient may reach without
              being able to read the app's current language. */}
          <h1 className={styles.titleEnglish} lang="en">
            {t('gate.titleEnglish')}
          </h1>
          <p className={styles.titleNative} lang="hi">
            {t('gate.titleNative')}
          </p>
        </div>

        <p className={styles.body}>{t('gate.body')}</p>

        <div className={styles.choices}>
          {available.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className={styles.choice}
              aria-pressed={selected === candidate}
              data-locale-choice=""
              onClick={() => setLocale(candidate)}
            >
              <span className={styles.choiceText}>
                <span className={styles.choiceNative} lang={candidate}>
                  {LOCALE_LABELS[candidate].native}
                </span>
                <span className={styles.choiceEnglish} lang="en">
                  {LOCALE_LABELS[candidate].english}
                </span>
              </span>
              <span className={styles.choiceMark} aria-hidden="true">
                {selected === candidate ? <Check size={14} strokeWidth={3} /> : null}
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className={styles.continueButton}
          onClick={confirmLocale}
          autoFocus
        >
          {t('gate.continueLabel')}
          <ArrowRight size={18} aria-hidden="true" />
        </button>

        <div className={styles.meta}>
          <span className={styles.metaItem}>
            <Clock size={13} aria-hidden="true" /> {t('gate.metaDuration')}
          </span>
          <span className={styles.metaItem}>
            <Lock size={13} aria-hidden="true" /> {t('gate.metaPrivacy')}
          </span>
          <span className={styles.metaItem}>
            <Stethoscope size={13} aria-hidden="true" /> {t('gate.metaReview')}
          </span>
        </div>

        <p className={styles.switchHint}>{t('gate.switchHint')}</p>
      </div>
    </main>
  );
}

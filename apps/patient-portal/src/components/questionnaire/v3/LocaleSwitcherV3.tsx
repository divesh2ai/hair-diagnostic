'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';

import {
  LOCALE_LABELS,
  useAssessmentLocale,
  useAssessmentTranslator,
  useAvailableAssessmentLocales,
  type AssessmentLocale,
} from '@/lib/assessment-i18n';
import { useAssessmentStore } from '@/stores/useAssessmentStore';

import styles from './LocaleSwitcherV3.module.css';

interface LocaleSwitcherV3Props {
  compact?: boolean;
  /**
   * Treat a pick here as the patient's deliberate language decision, so the
   * assessment's language gate is skipped.
   *
   * Set on the clinic landing page, where the switcher IS the language choice.
   * Left off inside the assessment, where the gate has already run and the
   * switcher is only a correction.
   */
  confirmOnSelect?: boolean;
}

/**
 * Language dropdown. Used in the clinic landing header (with `confirmOnSelect`)
 * and in the assessment's sticky progress band.
 *
 * A dropdown rather than a row of pills because the offered list is
 * clinic-configurable and grows with each language we ship — three pills
 * already filled a 390px header edge to edge.
 *
 * Renders nothing when the clinic offers a single language: a one-item picker
 * is noise, and hiding it is what makes per-clinic filtering visible.
 *
 * Hand-rolled rather than built on a menu library because `@base-ui/react` is
 * declared in package.json but is not actually installed in this workspace.
 * Keyboard contract implemented here: Enter/Space/Arrow opens, Arrow moves,
 * Home/End jump, Enter/Space selects, Escape and Tab close and return focus.
 *
 * `data-locale-switcher` is read by the journey's global Enter-to-continue
 * handler, which skips advancing while focus is anywhere inside this control.
 * The popup is deliberately NOT portalled so it stays inside that subtree.
 */
export function LocaleSwitcherV3({
  compact = false,
  confirmOnSelect = false,
}: LocaleSwitcherV3Props) {
  const { locale, setLocale } = useAssessmentLocale();
  const { available, offersChoice } = useAvailableAssessmentLocales();
  const confirmLocale = useAssessmentStore((state) => state.confirmLocale);
  const { t } = useAssessmentTranslator();

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listId = useId();

  const close = useCallback(
    (returnFocus = true) => {
      setOpen(false);
      if (returnFocus) triggerRef.current?.focus();
    },
    [],
  );

  const openList = useCallback(() => {
    const current = Math.max(0, available.indexOf(locale));
    setActiveIndex(current);
    setOpen(true);
  }, [available, locale]);

  // Move DOM focus onto the active row so screen readers announce it and
  // :focus-visible tracks arrow keys.
  useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.focus();
  }, [activeIndex, open]);

  // Dismiss on outside pointer. Pointerdown rather than click so the popup
  // closes before a tap on the page behind it activates anything.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  const choose = useCallback(
    (candidate: AssessmentLocale) => {
      setLocale(candidate);
      if (confirmOnSelect) confirmLocale();
      close();
    },
    [close, confirmLocale, confirmOnSelect, setLocale],
  );

  const onListKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % available.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((index) => (index - 1 + available.length) % available.length);
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(available.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        close();
        break;
      case 'Tab':
        // Let focus leave naturally, but do not leave an orphaned popup open.
        close(false);
        break;
      default:
        break;
    }
  };

  const onTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openList();
    }
  };

  if (!offersChoice) return null;

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${compact ? styles.compact : ''}`}
      data-locale-switcher=""
    >
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={t('common.languageSwitchLabel')}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={onTriggerKeyDown}
      >
        <Globe size={13} className={styles.triggerIcon} aria-hidden="true" />
        {/* The label is already in the target script, so declare its language
            rather than inheriting the page's. */}
        <span lang={locale}>{LOCALE_LABELS[locale].native}</span>
        <ChevronDown size={13} className={styles.chevron} aria-hidden="true" />
      </button>

      {open && (
        <ul
          id={listId}
          className={styles.popup}
          role="listbox"
          aria-label={t('common.language')}
          onKeyDown={onListKeyDown}
        >
          {available.map((candidate, index) => (
            <li key={candidate} role="none">
              <button
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                type="button"
                role="option"
                aria-selected={locale === candidate}
                data-active={index === activeIndex}
                className={styles.option}
                tabIndex={index === activeIndex ? 0 : -1}
                onClick={() => choose(candidate)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span className={styles.optionText}>
                  <span className={styles.optionNative} lang={candidate}>
                    {LOCALE_LABELS[candidate].native}
                  </span>
                  <span className={styles.optionEnglish} lang="en">
                    {LOCALE_LABELS[candidate].english}
                  </span>
                </span>
                <Check size={14} strokeWidth={3} className={styles.optionMark} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

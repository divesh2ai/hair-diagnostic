/**
 * Translation resolver for the patient assessment.
 *
 * Two resolution paths, both fallback-safe:
 *
 *  1. CHROME (`t('common.back')`) — read from the locale dictionary, falling
 *     back to English, falling back to the raw key. Because the dictionaries
 *     are typed, a missing key is normally a compile error; the runtime
 *     fallback exists so a hand-rolled key never renders `undefined`.
 *
 *  2. PROTOCOL CONTENT (`tQuestion`, `tOption`, `tSection`) — read from the
 *     locale's content pack, falling back to the protocol's own English text.
 *     English has no pack at all: it *is* the protocol. That is what keeps a
 *     single source of truth for the question bank.
 *
 * The resolver never sees an answer value on its way into the store — it only
 * maps a canonical ID to display text on its way out to the screen.
 */

import type { Question, QuestionOption } from '@/types/questionnaire';

import { hiContent } from './content/hi';
import { mrContent } from './content/mr';
import { en } from './locales/en';
import { hi } from './locales/hi';
import { mr } from './locales/mr';
import {
  DEFAULT_ASSESSMENT_LOCALE,
  type AssessmentContentPack,
  type AssessmentDictionary,
  type AssessmentLocale,
} from './types';

export const DICTIONARIES: Record<AssessmentLocale, AssessmentDictionary> = { en, hi, mr };

/**
 * Content packs by locale. `en` is intentionally absent — English display text
 * comes from the protocol itself, never from a parallel copy that could drift.
 */
export const CONTENT_PACKS: Partial<Record<AssessmentLocale, AssessmentContentPack>> = {
  hi: hiContent,
  mr: mrContent,
};

type Vars = Record<string, string | number>;

function walk(dictionary: unknown, parts: string[]): string | null {
  let cursor: unknown = dictionary;
  for (const part of parts) {
    if (cursor && typeof cursor === 'object' && part in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }
  return typeof cursor === 'string' ? cursor : null;
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_match, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}

/** Dot path into `AssessmentDictionary`, e.g. `"questionnaire.beginChapter"`. */
type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Paths<T> = T extends object
  ? { [K in keyof T]: T[K] extends object ? Join<K, Paths<T[K]>> : K }[keyof T]
  : never;
export type AssessmentDictionaryPath = Paths<AssessmentDictionary>;

export interface AssessmentTranslator {
  locale: AssessmentLocale;
  /** `true` when the patient is reading a non-default language. */
  isLocalised: boolean;
  /** Chrome string by dot path, with `{var}` interpolation. */
  t: (key: AssessmentDictionaryPath, vars?: Vars) => string;
  /** Question prompt. Falls back to `question.title`. */
  tQuestionTitle: (question: Question) => string;
  /** Question subtitle. Falls back to `question.subtitle` (may be undefined). */
  tQuestionSubtitle: (question: Question) => string | undefined;
  /** Helper text. Falls back to `question.helperText` (may be undefined). */
  tQuestionHelper: (question: Question) => string | undefined;
  /** Input placeholder. Falls back to the protocol placeholder, then `fallback`. */
  tPlaceholder: (question: Question, fallback: string) => string;
  /** Range/format error copy. Falls back to the protocol's own message. */
  tErrorMessage: (question: Question) => string | undefined;
  /** Mutual-exclusivity toast. Falls back to the protocol's own toast. */
  tExclusivityToast: (question: Question) => string | undefined;
  /** Option label. Falls back to `option.label`. NEVER touches `option.id`. */
  tOption: (questionId: string, option: QuestionOption) => string;
  /** Chapter card copy. Falls back to the supplied English title/body. */
  tSection: (sectionId: string, fallback: { title: string; body: string }) => {
    title: string;
    body: string;
  };
}

/**
 * Build a translator bound to one locale. Pure and cheap — safe to call in a
 * `useMemo` on every locale change.
 */
export function createAssessmentTranslator(locale: AssessmentLocale): AssessmentTranslator {
  const dictionary = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_ASSESSMENT_LOCALE];
  const pack = CONTENT_PACKS[locale];

  const t = (key: AssessmentDictionaryPath, vars?: Vars): string => {
    const parts = key.split('.');
    const localised = walk(dictionary, parts);
    if (localised !== null) return interpolate(localised, vars);

    const english = walk(DICTIONARIES[DEFAULT_ASSESSMENT_LOCALE], parts);
    if (english !== null) {
      warnMissing(`chrome:${key}`, locale);
      return interpolate(english, vars);
    }

    warnMissing(`chrome:${key}`, locale);
    // Last resort: the key itself is more debuggable than an empty node, but
    // this branch is unreachable while the dictionaries stay typed.
    return key;
  };

  const contentFor = (questionId: string) => pack?.questions[questionId];

  return {
    locale,
    isLocalised: locale !== DEFAULT_ASSESSMENT_LOCALE,
    t,

    tQuestionTitle: (question) => {
      const localised = contentFor(question.id)?.title;
      if (!localised && pack) warnMissing(`question:${question.id}.title`, locale);
      return localised ?? question.title;
    },

    tQuestionSubtitle: (question) => contentFor(question.id)?.subtitle ?? question.subtitle,

    tQuestionHelper: (question) => contentFor(question.id)?.helper ?? question.helperText,

    tPlaceholder: (question, fallback) =>
      contentFor(question.id)?.placeholder ?? question.validation?.placeholder ?? fallback,

    tErrorMessage: (question) =>
      contentFor(question.id)?.errorMessage ?? question.validation?.errorMessage,

    tExclusivityToast: (question) =>
      contentFor(question.id)?.exclusivityToast ?? question.mutualExclusivityToast,

    tOption: (questionId, option) => {
      const localised = contentFor(questionId)?.options?.[option.id];
      if (!localised && pack) warnMissing(`option:${questionId}.${option.id}`, locale);
      return localised ?? option.label;
    },

    tSection: (sectionId, fallback) => pack?.sections[sectionId] ?? fallback,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Development-time missing-key reporting
//
// Silent in production (a patient must never see a warning, and a missing key
// already degrades gracefully to English). Deduplicated so a re-render loop
// can't flood the console.
// ─────────────────────────────────────────────────────────────────────────────

const warned = new Set<string>();

function warnMissing(key: string, locale: AssessmentLocale): void {
  if (process.env.NODE_ENV === 'production') return;
  const marker = `${locale}:${key}`;
  if (warned.has(marker)) return;
  warned.add(marker);
  console.warn(
    `[assessment-i18n] Missing "${locale}" translation for ${key} — falling back to English.`,
  );
}

/** Test-only: clears the dedup set so warning assertions stay independent. */
export function __resetMissingKeyWarnings(): void {
  warned.clear();
}

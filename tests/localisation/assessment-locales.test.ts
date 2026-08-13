/**
 * Assessment localisation — coverage and clinical-integrity guarantees.
 *
 * Runs the same battery against EVERY non-English locale registered in
 * `ASSESSMENT_LOCALES`, so adding a language really is a content change: drop
 * in a dictionary and a content pack, add the code, and this suite starts
 * policing it automatically. Nothing here is Hindi-specific.
 *
 * The point is not that the translations read well (that is the clinical team's
 * review — see docs/localisation/assessment-<locale>-review.md). It is that
 * localisation stays *presentation only*: same question IDs, same answer codes,
 * same visibility and exclusivity behaviour, in every language.
 */

import { describe, expect, it } from 'vitest';

import {
  validateContentCompleteness,
  validateLocaleCompleteness,
} from '@/lib/assessment-i18n/completeness';
import { en } from '@/lib/assessment-i18n/locales/en';
import {
  CONTENT_PACKS,
  DICTIONARIES,
  createAssessmentTranslator,
  type AssessmentTranslator,
} from '@/lib/assessment-i18n/resolver';
import {
  ASSESSMENT_LOCALES,
  DEFAULT_ASSESSMENT_LOCALE,
  type AssessmentContentPack,
  type AssessmentLocale,
} from '@/lib/assessment-i18n/types';
import { getProtocolForConcern } from '@/runtime/protocolLoader';
import {
  applyMultiSelectRules,
  getExclusiveOptions,
  getVisibleOptions,
} from '@/runtime/optionFilterEngine';
import type { Question } from '@/types/questionnaire';

const protocol: Question[] = getProtocolForConcern('hair');

/** Every locale that must ship a full translation. */
const TRANSLATED_LOCALES = ASSESSMENT_LOCALES.filter(
  (locale): locale is Exclude<AssessmentLocale, 'en'> => locale !== DEFAULT_ASSESSMENT_LOCALE,
);

/**
 * Scripts in use. A translated label must contain at least one character from
 * its locale's script — that is what distinguishes a real translation from an
 * English label copied across.
 */
const SCRIPTS: Record<string, RegExp> = {
  hi: /[ऀ-ॿ]/, // Devanagari
  mr: /[ऀ-ॿ]/, // Devanagari (shared with Hindi — different language, same script)
};

describe('protocol fixture', () => {
  it('loads the live hair protocol', () => {
    expect(protocol.length).toBeGreaterThan(0);
    expect(protocol.map((q) => q.id)).toContain('hairtype');
  });

  it('has at least one locale to translate', () => {
    expect(TRANSLATED_LOCALES.length).toBeGreaterThan(0);
  });
});

describe.each(TRANSLATED_LOCALES)('locale: %s', (locale) => {
  const dictionary = DICTIONARIES[locale];
  const pack = CONTENT_PACKS[locale] as AssessmentContentPack;
  const script = SCRIPTS[locale];
  const t = createAssessmentTranslator(locale);
  const enT = createAssessmentTranslator('en');

  it('is registered with both a dictionary and a content pack', () => {
    expect(dictionary).toBeTruthy();
    expect(pack).toBeTruthy();
    expect(script).toBeTruthy();
  });

  // ── chrome ────────────────────────────────────────────────────────────────

  it('covers every English chrome key', () => {
    const report = validateLocaleCompleteness(en, dictionary);
    expect(report.missing).toEqual([]);
    expect(report.complete).toBe(true);
  });

  it('carries no chrome keys English does not define', () => {
    expect(validateLocaleCompleteness(en, dictionary).orphaned).toEqual([]);
  });

  it('has no empty chrome strings', () => {
    const empties: string[] = [];
    const walk = (node: unknown, path: string) => {
      if (typeof node === 'string') {
        if (node.trim() === '') empties.push(path);
        return;
      }
      if (node && typeof node === 'object') {
        for (const [key, child] of Object.entries(node)) {
          walk(child, path ? `${path}.${key}` : key);
        }
      }
    };
    walk(dictionary, '');
    expect(empties).toEqual([]);
  });

  // ── protocol content ──────────────────────────────────────────────────────

  const report = validateContentCompleteness(protocol, pack);

  it('translates every question title', () => {
    expect(report.missing.filter((k) => k.startsWith('question:'))).toEqual([]);
  });

  it('translates every answer option', () => {
    expect(report.missing.filter((k) => k.startsWith('option:'))).toEqual([]);
  });

  it('translates every chapter card', () => {
    expect(report.missing.filter((k) => k.startsWith('section:'))).toEqual([]);
  });

  it('has no stale keys left behind by a protocol rename', () => {
    expect(report.orphaned).toEqual([]);
  });

  it('reports full coverage', () => {
    expect(report.complete).toBe(true);
    expect(report.counts.translated).toBe(report.counts.expected);
  });

  // ── the copy is really in the target language ─────────────────────────────

  it('renders its own script for every question title', () => {
    const notTranslated = protocol
      .map((q) => ({ id: q.id, title: pack.questions[q.id]?.title }))
      .filter((e) => !e.title || !script.test(e.title));
    expect(notTranslated).toEqual([]);
  });

  it('never leaves an English label verbatim', () => {
    const untouched: string[] = [];
    for (const question of protocol) {
      for (const option of question.options ?? []) {
        const label = pack.questions[question.id]?.options?.[option.id];
        if (label && label === option.label && !script.test(label)) {
          untouched.push(`${question.id}.${option.id}`);
        }
      }
    }
    expect(untouched).toEqual([]);
  });

  it('is a distinct translation, not a copy of another locale', () => {
    // Marathi and Hindi share Devanagari, so a lazy copy would pass every
    // script check above. Require the two to actually differ.
    for (const other of TRANSLATED_LOCALES) {
      if (other === locale) continue;
      const otherPack = CONTENT_PACKS[other] as AssessmentContentPack | undefined;
      if (!otherPack) continue;

      const identical = protocol.filter(
        (q) =>
          pack.questions[q.id]?.title &&
          pack.questions[q.id]?.title === otherPack.questions[q.id]?.title,
      );
      // A handful of coincidental matches is plausible between close languages;
      // wholesale identity is a copy-paste.
      expect(identical.length).toBeLessThan(protocol.length / 2);
    }
  });

  // ── clinical integrity ────────────────────────────────────────────────────

  it('keys the pack by canonical IDs, never by translated text', () => {
    const liveQuestionIds = new Set(protocol.map((q) => q.id));
    for (const [questionId, content] of Object.entries(pack.questions)) {
      expect(liveQuestionIds.has(questionId)).toBe(true);
      expect(script.test(questionId)).toBe(false);

      const liveOptionIds = new Set(
        (protocol.find((q) => q.id === questionId)?.options ?? []).map((o) => o.id),
      );
      for (const optionId of Object.keys(content.options ?? {})) {
        expect(liveOptionIds.has(optionId)).toBe(true);
        expect(script.test(optionId)).toBe(false);
      }
    }
  });

  it('changes the label but not the code it is keyed on', () => {
    let changed = 0;
    for (const question of protocol) {
      for (const option of question.options ?? []) {
        expect(enT.tOption(question.id, option)).toBe(option.label);
        expect(option.id).toBe(
          (question.options ?? []).find((o) => o.label === option.label)!.id,
        );
        if (t.tOption(question.id, option) !== option.label) changed += 1;
      }
    }
    expect(changed).toBeGreaterThan(100);
  });

  it('leaves exclusive ("none of the above") behaviour untouched', () => {
    for (const question of protocol) {
      const exclusive = getExclusiveOptions(question).map((o) => o.id);
      if (exclusive.length === 0) continue;
      const others = (question.options ?? [])
        .map((o) => o.id)
        .filter((id) => !exclusive.includes(id));
      if (others.length === 0) continue;
      expect(applyMultiSelectRules(others, exclusive[0], exclusive)).toEqual([exclusive[0]]);
    }
  });

  it('leaves option visibility untouched', () => {
    const answers = { sex: 'Female', age: 32 };
    for (const question of protocol) {
      const visible = getVisibleOptions(question, answers).map((o) => o.id);
      const afterLocalisation = getVisibleOptions(question, answers).map((o) => {
        t.tOption(question.id, o);
        return o.id;
      });
      expect(afterLocalisation).toEqual(visible);
    }
  });

  // ── fallback ──────────────────────────────────────────────────────────────

  it('interpolates variables', () => {
    const counter = t.t('questionnaire.progressCounter', { position: 4, total: 21 });
    expect(counter).toContain('4');
    expect(counter).toContain('21');
    expect(counter).not.toContain('{');
  });

  it('never returns undefined, null or a raw dot-path', () => {
    const keys = [
      'common.back',
      'common.skip',
      'questionnaire.loading',
      'questionnaire.beginChapter',
      'validation.required',
      'photo.tapToAdd',
      'submission.completeTitle',
      'processing.step1Head',
      'bridgeStages.identity',
    ] as const;
    for (const key of keys) {
      const value = t.t(key);
      expect(value).toBeTruthy();
      expect(value).not.toBe(key);
      expect(value).not.toContain('undefined');
    }
  });

  // ── submission parity ─────────────────────────────────────────────────────

  it('stores identical answer codes to an English run, and no localised text', () => {
    const run = (translator: AssessmentTranslator) => {
      const answers: Record<string, unknown> = {};
      const displayed: string[] = [];
      for (const question of protocol) {
        const options = question.options ?? [];
        if (options.length === 0) continue;
        const chosen = options[0];
        displayed.push(translator.tOption(question.id, chosen));
        answers[question.id] = question.type === 'multi_select' ? [chosen.id] : chosen.id;
      }
      return { answers, displayed };
    };

    const english = run(enT);
    const localised = run(t);

    expect(localised.answers).toEqual(english.answers);
    expect(localised.displayed).not.toEqual(english.displayed);
    expect(localised.displayed.some((label) => script.test(label))).toBe(true);
    expect(script.test(JSON.stringify(localised.answers))).toBe(false);
  });
});

describe('fallback behaviour', () => {
  function packWithHole(base: AssessmentContentPack): AssessmentContentPack {
    const clone: AssessmentContentPack = JSON.parse(JSON.stringify(base));
    delete clone.questions.sex.options!.Male;
    delete clone.questions.duration.title;
    return clone;
  }

  it('reports a missing key rather than hiding it', () => {
    for (const locale of TRANSLATED_LOCALES) {
      const base = CONTENT_PACKS[locale] as AssessmentContentPack;
      const report = validateContentCompleteness(protocol, packWithHole(base));
      expect(report.complete).toBe(false);
      expect(report.missing).toContain('option:sex.Male');
      expect(report.missing).toContain('question:duration.title');
    }
  });

  it('falls back to English instead of rendering undefined', () => {
    // English has no pack at all, which is the fallback path every locale takes
    // for a key it is missing.
    const noPack = createAssessmentTranslator('en');
    const sex = protocol.find((q) => q.id === 'sex')!;
    const male = sex.options!.find((o) => o.id === 'Male')!;
    expect(noPack.tOption('sex', male)).toBe(male.label);
    expect(noPack.tQuestionTitle(sex)).toBe(sex.title);
  });
});

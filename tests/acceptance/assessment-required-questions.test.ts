import { describe, it, expect } from 'vitest';
import { getDefaultProtocol } from '@/runtime/protocolLoader';

// ─────────────────────────────────────────────────────────────────────────────
// Assessment completeness (2026-10-15): every question must be answered before
// the patient can proceed, EXCEPT the final free-text "Anything else?" (`extra`).
//
// Conditionally-shown questions (those with a skipIf) stay required, which is
// safe: AssessmentV3Journey auto-advances past a question that is not visible
// (see the isQuestionVisible effect), so `required` only ever gates a question
// the patient is actually shown. This test locks the schema's required flags so
// a future edit cannot silently make a clinical question skippable again.
// ─────────────────────────────────────────────────────────────────────────────

describe('Assessment — all questions required except the last', () => {
  const protocol = getDefaultProtocol();

  it('exposes more than a handful of questions (schema loaded)', () => {
    expect(protocol.length).toBeGreaterThan(15);
  });

  it('only the final free-text question (`extra`) is optional', () => {
    const optional = protocol.filter((q) => !q.required).map((q) => q.id);
    expect(optional).toEqual(['extra']);
  });

  it('`extra` is the last question and stays optional', () => {
    const last = protocol[protocol.length - 1];
    expect(last.id).toBe('extra');
    expect(last.required).toBeFalsy();
  });

  it('every non-final question is required', () => {
    protocol.slice(0, -1).forEach((q) => {
      expect(q.required, `question "${q.id}" must be required`).toBe(true);
    });
  });
});

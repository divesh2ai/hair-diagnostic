import { describe, it, expect } from 'vitest';
import { masterProtocol } from '@hairos/packages/ai-engine/questionnaire-engine/protocol/masterProtocol';
import { adaptProtocol } from '@/runtime/protocolAdapter';

// ─────────────────────────────────────────────────────────────────────────────
// Requirement: the female Hormonal / reproductive-health question must NOT be
// skippable — the patient has to make an explicit choice (at minimum "None of
// the above") before the assessment advances.
//
// The v3 flow derives both the Skip control and the Continue gate from
// `question.required` (AssessmentV3Journey: `onSkip` is only wired when
// `!question.required`, and `canContinue` requires a non-empty answer for a
// required multi_select). So requiring an answer here is exactly a matter of
// the adapted question reporting `required: true`.
// ─────────────────────────────────────────────────────────────────────────────

describe('Hormonal question — not skippable', () => {
  const questions = adaptProtocol(masterProtocol);
  const hormonal = questions.find((q) => q.id === 'hormonal');

  it('exists in the adapted protocol', () => {
    expect(hormonal).toBeDefined();
  });

  it('is required, so the Skip control is withheld and Continue stays gated until answered', () => {
    expect(hormonal?.required).toBe(true);
  });

  it('still offers an explicit "None of the above" escape hatch', () => {
    const values = hormonal?.options?.map((o) => o.id) ?? [];
    expect(values).toContain('None of the above');
  });
});

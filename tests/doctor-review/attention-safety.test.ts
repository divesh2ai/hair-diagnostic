import { describe, expect, it } from 'vitest';
import {
  buildAttentionItems,
  extractSafetyFlags,
} from '../../apps/patient-portal/src/lib/doctor/clinicalAttention';
import type { Consultation } from '../../packages/shared/types/consultation';

// Safety flags used to sit inside a "Safety alerts" list in the product tab —
// the single most decision-relevant class of warning, one click away from the
// screen that approves the plan. They now lead the attention section.
//
// Two rules are defended here. Safety must come FIRST, ahead of every
// completeness advisory, because a contraindication outranks "the narrative is
// incomplete". And the section must still render nothing on a clean case:
// adding a new item source is exactly how a silent region starts emitting a
// reassuring card on every routine patient.

const QUIET_INPUT = {
  confidence: null,
  readiness: null,
  degradedReasons: [],
};

describe('extractSafetyFlags', () => {
  it('reads contraindications, cautions and allergy flags', () => {
    const consultation = {
      safety: {
        contraindications: [{ label: 'Isotretinoin', reason: 'Active course' }],
        cautions: [{ label: 'Pregnancy' }],
        allergyFlags: ['Peanut'],
      },
    } as unknown as Consultation;

    expect(extractSafetyFlags(consultation)).toEqual([
      { label: 'Isotretinoin', reason: 'Active course', source: 'Contraindication' },
      { label: 'Pregnancy', reason: null, source: 'Caution' },
      { label: 'Peanut', reason: null, source: 'Allergy' },
    ]);
  });

  it('returns nothing for a record with no safety block', () => {
    // Absence of the block is not a claim that the patient has none — it just
    // means nothing was recorded, so nothing is asserted either way.
    expect(extractSafetyFlags({} as unknown as Consultation)).toEqual([]);
  });

  it('skips entries with no label rather than rendering a blank alert', () => {
    const consultation = {
      safety: { contraindications: [{ reason: 'orphaned' }], allergyFlags: [''] },
    } as unknown as Consultation;
    expect(extractSafetyFlags(consultation)).toEqual([]);
  });
});

describe('buildAttentionItems with safety', () => {
  it('stays completely silent on a clean case', () => {
    // The regression this file exists to prevent.
    expect(buildAttentionItems({ ...QUIET_INPUT, safety: [] })).toEqual([]);
    expect(buildAttentionItems(QUIET_INPUT)).toEqual([]);
  });

  it('surfaces a contraindication as an attention item', () => {
    const items = buildAttentionItems({
      ...QUIET_INPUT,
      safety: [
        { label: 'Isotretinoin', reason: 'Active course', source: 'Contraindication' },
      ],
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'attention',
      title: 'Contraindication: Isotretinoin',
      detail: 'Active course',
    });
  });

  it('puts safety ahead of completeness advisories', () => {
    const items = buildAttentionItems({
      confidence: {
        overall: { band: 'low', rationale: 'Thin inputs.' },
      } as unknown as Consultation['confidence'],
      readiness: { groundingViolationCount: 0, reasoningGapCount: 2 } as never,
      degradedReasons: ['LEGACY_RAW_RESPONSES_MISSING'],
      safety: [{ label: 'Pregnancy', reason: null, source: 'Caution' }],
    });

    // A contraindication must not be pushed below "incomplete reasoning".
    expect(items[0].title).toBe('Caution: Pregnancy');
    expect(items.length).toBeGreaterThan(1);
  });

  it('never renders implementation language for a degraded record', () => {
    const items = buildAttentionItems({
      ...QUIET_INPUT,
      degradedReasons: ['LEGACY_RAW_RESPONSES_MISSING'],
    });
    const text = JSON.stringify(items);
    expect(text).not.toMatch(/rawResponses|LEGACY_DEGRADED|null/);
  });
});

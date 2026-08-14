import { describe, expect, it } from 'vitest';
import {
  buildProtocolItems,
  summarizeProtocol,
  planReasoning,
} from '../../apps/patient-portal/src/lib/doctor/protocolModel';
import type { KitCatalogItem } from '../../apps/patient-portal/src/lib/doctor/kitCatalog';
import type {
  Consultation,
  TreatmentPhase,
} from '../../packages/shared/types/consultation';

// The rule these tests defend: the protocol view MAPS engine output. It never
// derives, ranks, or invents a clinical mapping.
//
// The specific failure being prevented is a plausible-looking therapeutic
// objective appearing under a kit the registry says nothing about. A doctor
// reading "Reduce inflammatory burden" has no way to tell whether a clinician
// authored it or a frontend composed it from a diagnosis string, and the
// second is a clinical claim nobody made.

function phase(over: Partial<TreatmentPhase> = {}): TreatmentPhase {
  return {
    phase: 1,
    kitId: 'KIT_A',
    displayName: 'Kit A',
    whySelected: 'Selected for the recorded signals.',
    supportingConditions: [],
    keyIngredients: [],
    mechanismOfAction: [],
    formulationGroups: [],
    ...over,
  } as TreatmentPhase;
}

function catalogItem(over: Partial<KitCatalogItem> = {}): KitCatalogItem {
  return {
    kitId: 'KIT_A',
    displayName: 'Kit A',
    treatmentObjective: 'Reduce inflammatory follicular stress.',
    therapeuticStrategy: [],
    formulationRationale: [],
    priceInr: 0,
    priceLabel: '₹0',
    ...over,
  };
}

const EMPTY_CATALOG = new Map<string, KitCatalogItem>();

describe('buildProtocolItems — condition → objective → protocol', () => {
  it('maps the driver, objective and protocol from their real sources', () => {
    const catalog = new Map([['KIT_A', catalogItem()]]);
    const [item] = buildProtocolItems(
      [
        phase({
          supportingConditions: ['Scalp inflammation'],
          whySelected: 'Scalp findings indicate an inflammatory component.',
        }),
      ],
      catalog,
    );

    // Driver comes from the Root Cause conditions the engine attached to the
    // kit; objective from the authored registry; rationale from the engine's
    // per-patient evidence chain. Three sources, none of them this module.
    expect(item.drivers).toEqual(['Scalp inflammation']);
    expect(item.objective).toBe('Reduce inflammatory follicular stress.');
    expect(item.name).toBe('Kit A');
    expect(item.rationale).toBe(
      'Scalp findings indicate an inflammatory component.',
    );
  });

  it('leaves the objective null when the registry does not carry one', () => {
    // The load-bearing case. An unknown kit must render WITHOUT an objective
    // line rather than borrowing the diagnosis or the kit name to fill it.
    const [item] = buildProtocolItems([phase({ kitId: 'KIT_UNKNOWN' })], EMPTY_CATALOG);
    expect(item.objective).toBeNull();
  });

  it('does not invent a driver for a kit the engine did not map', () => {
    const [item] = buildProtocolItems([phase({ supportingConditions: [] })], EMPTY_CATALOG);
    expect(item.drivers).toEqual([]);
  });

  it('preserves canonical order and numbers positionally', () => {
    const items = buildProtocolItems(
      [
        phase({ kitId: 'KIT_A', displayName: 'Kit A' }),
        phase({ kitId: 'KIT_B', displayName: 'Kit B' }),
        phase({ kitId: 'KIT_C', displayName: 'Kit C' }),
      ],
      EMPTY_CATALOG,
    );
    expect(items.map((i) => i.kitId)).toEqual(['KIT_A', 'KIT_B', 'KIT_C']);
    expect(items.map((i) => i.phase)).toEqual([1, 2, 3]);
  });

  it('renumbers from array order, not from the stored phase integer', () => {
    // After a doctor reorders, the stored integers are stale until save. The
    // doctor reasons about "which comes first", so array order wins.
    const items = buildProtocolItems(
      [phase({ kitId: 'KIT_B', phase: 2 }), phase({ kitId: 'KIT_A', phase: 1 })],
      EMPTY_CATALOG,
    );
    expect(items.map((i) => [i.kitId, i.phase])).toEqual([
      ['KIT_B', 1],
      ['KIT_A', 2],
    ]);
  });

  it('keeps a duplicated kitId as two distinct entries', () => {
    const items = buildProtocolItems(
      [phase({ kitId: 'KIT_A' }), phase({ kitId: 'KIT_A' })],
      EMPTY_CATALOG,
    );
    expect(items).toHaveLength(2);
    expect(items[0].phase).not.toBe(items[1].phase);
  });
});

describe('summarizeProtocol — only what the record can prove', () => {
  it('counts the interventions the doctor is about to approve', () => {
    const summary = summarizeProtocol([
      phase({ kitId: 'KIT_A' }),
      phase({ kitId: 'KIT_B' }),
      phase({ kitId: 'KIT_C' }),
    ]);
    expect(summary.count).toBe(3);
  });

  it('counts a doctor-added kit from its stored provenance', () => {
    const summary = summarizeProtocol([
      phase({ kitId: 'KIT_A' }),
      phase({ kitId: 'KIT_B', meta: { addedByDoctor: true } } as Partial<TreatmentPhase>),
    ]);
    expect(summary.addedByDoctor).toBe(1);
    expect(summary.doctorAdjusted).toBe(true);
  });

  it('claims no modification on an untouched engine lineup', () => {
    // The other half of the honesty rule: a clean lineup must not be labelled
    // "adjusted by doctor" merely because the consultation has been re-saved.
    const summary = summarizeProtocol([phase({ kitId: 'KIT_A' })]);
    expect(summary.addedByDoctor).toBe(0);
    expect(summary.doctorAdjusted).toBe(false);
  });

  it('reports an empty lineup as zero rather than throwing', () => {
    expect(summarizeProtocol([])).toEqual({
      count: 0,
      addedByDoctor: 0,
      doctorAdjusted: false,
    });
  });
});

describe('planReasoning', () => {
  it('returns the engine sequencing and collective rationale verbatim', () => {
    const consultation = {
      rootCauseRationale: {
        categories: [],
        sequencingRationale: 'Hormonal axis leads.',
        collectiveRationale: 'Together these cover the full picture.',
      },
    } as unknown as Consultation;

    expect(planReasoning(consultation)).toEqual({
      sequencing: 'Hormonal axis leads.',
      collective: 'Together these cover the full picture.',
    });
  });

  it('returns nulls when the engine recorded no plan reasoning', () => {
    const consultation = {} as unknown as Consultation;
    expect(planReasoning(consultation)).toEqual({
      sequencing: null,
      collective: null,
    });
  });
});

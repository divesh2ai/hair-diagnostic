import { describe, expect, test } from 'vitest';
import { getKitSelectionLeadIn } from '../src/packages/ai-engine/shared/kitSelectionOpeners';

describe('getKitSelectionLeadIn', () => {
  test('returns the exact TE Gold opener', () => {
    expect(getKitSelectionLeadIn('HAIR FACT TE GOLD')).toBe(
      'This kit is formulated to address stress and weakness of the follicles that cause telogen effluvium. The formulation also protects from androgen sensitivity.'
    );
  });

  test('returns the vegetarian TE Gold opener for the VEG variant', () => {
    expect(getKitSelectionLeadIn('HAIR FACT TE GOLD VEG')).toBe(
      'This kit is formulated to address stress and weakness of the follicles that cause telogen effluvium. The formulation also protects from androgen sensitivity utilizing vegetarian options.'
    );
  });

  test('returns the MPHL opener', () => {
    expect(getKitSelectionLeadIn('MPHL')).toBe(
      'This kit is formulated to address perifollicular inflammation, counter the hormonal imbalance and loss of growth seen in male pattern hair loss. The formulation also protects from androgen sensitivity.'
    );
  });

  test('returns the thyroid opener for the live engine alias', () => {
    expect(getKitSelectionLeadIn('PRO FACT THYROID CARE')).toBe(
      'This kit is formulated to address thyroid dysfunction, reduce oxidative stress, counter inflammation, improve cellular metabolism and support hair growth. The formulation also protects from androgen sensitivity.'
    );
  });

  test('returns the meta B hypothyroid opener for the live engine alias', () => {
    expect(getKitSelectionLeadIn('PRO FACT META B HYPOTHYROID')).toBe(
      'This kit is formulated to address thyroid dysfunction, reduce oxidative stress, counter inflammation, improve cellular metabolism and support hair growth with vegetarian options. The formulation also protects from androgen sensitivity.'
    );
  });

  test('returns the GI Gold opener', () => {
    expect(getKitSelectionLeadIn('GI_GOLD')).toBe(
      'This kit is formulated to neutralize the effects of mediators of stress, counter inflammation, reduce oxidative stress, repair cellular damage, restore epithelial integrity, improve digestion, dysbiosis and gut health which together will support better hair growth. The formulation also protects from androgen sensitivity.'
    );
  });

  test('returns null for unsupported kits', () => {
    expect(getKitSelectionLeadIn('UNMAPPED KIT')).toBeNull();
  });
});

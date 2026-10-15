import { describe, it, expect } from 'vitest';
import { resolveKitImage } from '@/lib/kits/kitImage';
import { getKitInfo } from '@hairos/packages/registries/kits/info';

// ─────────────────────────────────────────────────────────────────────────────
// Post-menopause kit identity — name + packshot must never collapse to Peri.
//
// Two production bugs this locks (2026-10-15):
//   1. getKitInfo("PRO FACT META B POSTMENOPAUSE") returned the PERI entry's
//      display name ("HAIR FACT PERI MENOPAUSE"), so the doctor-review rail and
//      every getKitInfo caller mislabelled the post-menopause kit as peri.
//   2. resolveKitImage("POST_MENOPAUSE") (the canonical id the doctor-added
//      lineup stores) fell through the generic MENOPAUSE rule to the peri
//      packshot, because the only post rule required "META B" before "POST".
//
// The one-pager (which recomputes from kitId) was already correct; these lock
// the OTHER surfaces to it. No new SKU, no clinical-content change.
// ─────────────────────────────────────────────────────────────────────────────

const POST_NAME = 'PRO FACT META B POST-MENOPAUSE';
const POST_IMAGE_CODE = 'PRO_FACT_META_B_POSTMENOPAUSE';
const PERI_IMAGE_CODE = 'HAIR_FACT_PERI_MENOPAUSE';

const POST_SPELLINGS = [
  'PRO FACT META B POSTMENOPAUSE',
  'PRO FACT META B POST-MENOPAUSE',
  'POST_MENOPAUSE',
  'POSTMENOPAUSE',
  'POST-MENOPAUSE',
];

describe('Post-menopause kit identity resolvers', () => {
  for (const id of POST_SPELLINGS) {
    it(`resolveKitImage("${id}") → the post-menopause packshot, never peri`, () => {
      const img = resolveKitImage(id);
      expect(img, `image must resolve for "${id}"`).toBeTruthy();
      expect(img!.code).toBe(POST_IMAGE_CODE);
      expect(img!.src).toContain('pro_fact_meta_b_post_menopause.png');
      expect(img!.src.toLowerCase()).not.toContain('peri');
    });
  }

  for (const id of ['PRO FACT META B POSTMENOPAUSE', 'POST_MENOPAUSE', 'POST-MENOPAUSE']) {
    it(`getKitInfo("${id}") → the post-menopause name, never the peri name`, () => {
      const info = getKitInfo(id);
      expect(info, `getKitInfo must resolve for "${id}"`).toBeTruthy();
      expect(info!.displayName).toBe(POST_NAME);
      expect(info!.displayName).not.toMatch(/PERI/i);
    });
  }

  it('veg spellings resolve to the post-menopause (Veg) identity, never peri', () => {
    expect(getKitInfo('PRO FACT META B POSTMENOPAUSE VEG')!.displayName).toBe(`${POST_NAME} (Veg)`);
    expect(getKitInfo('POST_MENOPAUSE_VEG')!.displayName).toBe(`${POST_NAME} (Veg)`);
    expect(resolveKitImage('POST_MENOPAUSE_VEG')!.code).toBe(POST_IMAGE_CODE);
  });

  it('the Peri kit is untouched — still resolves to Peri name and packshot', () => {
    const img = resolveKitImage('HAIR FACT PERI MENOPAUSE');
    expect(img!.code).toBe(PERI_IMAGE_CODE);
    expect(getKitInfo('HAIR FACT PERI MENOPAUSE')!.displayName).toBe('HAIR FACT PERI MENOPAUSE');
  });
});

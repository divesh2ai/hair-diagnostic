import type { KitId } from '../../types';

// Resolves veg/gender/grade-aware kit aliases at runtime.
// Pure function — no side effects, no clinic config, no state.
export function resolveKit(kitId: KitId, isVeg: boolean, isMale: boolean): KitId {
  if (!kitId || kitId === 'AGA_GENDER') return isMale ? 'MPHL' : 'FPHL';
  if (kitId === 'HAIR FACT TE GOLD'        && isVeg) return 'HAIR FACT TE GOLD VEG';
  if (kitId === 'HAIR FACT PERI MENOPAUSE' && isVeg) return 'HAIR FACT PERI MENOPAUSE VEG';
  if (kitId === 'F-PCOS -1'                && isVeg) return 'F-PCOS VEG -1';
  if (kitId === 'PRO IMMUNE GOLD'          && isVeg) return 'PRO IMMUNE VEG';
  if (kitId === 'EARLY GREYING CARE GOLD'  && isVeg) return 'EARLY GREYING CARE VEG';
  return kitId;
}

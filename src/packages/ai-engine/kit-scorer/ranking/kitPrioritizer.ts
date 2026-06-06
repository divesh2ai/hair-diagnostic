import type { KitId } from '../../../types';

// Lifts specific kits to the front of the sequence in clinical priority order.
// Extracted from the liftPhase() logic in getFunnelKits().
// Order: TE GOLD first (active shedding arrest), then IRON (correction), then PCOS kits.
export function prioritizeKits(phases: KitId[], teGoldKit: KitId): KitId[] {
  const PRIORITY_ORDER: KitId[] = [
    teGoldKit,
    'IRON UP GOLD',
    'F-PCOS -1',
    'F-PCOS VEG -1',
    'PRO FACT META B PCOS',
  ];

  const prioritized: KitId[] = [];
  const remaining = [...phases];

  for (const kitName of PRIORITY_ORDER) {
    const idx = remaining.indexOf(kitName);
    if (idx >= 0) {
      const removed = remaining.splice(idx, 1);
      if (removed[0] !== undefined) prioritized.push(removed[0]);
    }
  }

  return [...prioritized, ...remaining];
}

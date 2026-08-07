/**
 * Bridge triggers = the chapters carried by the progressive-bridge artwork.
 *
 * Chapter 1 (Patient Identity) is the "arrival" moment — it has no orb baked
 * into the hero art, so we anchor it to the far-left approach of the bridge
 * (imagePct 2) and, on mobile, to the very top of the vertical scene.
 * Chapters 2–8 map one-to-one to the seven orbs (biological → environmental).
 *
 * Each trigger owns a horizontal band of assessment progress; whichever band
 * the current `progress` value lands in is the "active" trigger, and its
 * imagePct tells the desktop viewport where to pin the on-screen glow.
 */
export type BridgeTriggerId =
  | 'identity'
  | 'biological'
  | 'lifestyle'
  | 'stress'
  | 'hormonal'
  | 'nutritional'
  | 'scalp'
  | 'environmental';

export interface BridgeTrigger {
  id: BridgeTriggerId;
  index: number;
  /** Horizontal center in the desktop hero art, 0–100 (% of image width). */
  imagePct: number;
  label: string;
}

export const BRIDGE_TRIGGERS: BridgeTrigger[] = [
  { id: 'identity', index: 1, imagePct: 2, label: 'Patient Identity' },
  { id: 'biological', index: 2, imagePct: 11, label: 'Biological Factors' },
  { id: 'lifestyle', index: 3, imagePct: 24, label: 'Lifestyle Habits' },
  { id: 'stress', index: 4, imagePct: 37, label: 'Stress & Mental Wellbeing' },
  { id: 'hormonal', index: 5, imagePct: 49, label: 'Hormonal Balance' },
  { id: 'nutritional', index: 6, imagePct: 62, label: 'Nutritional Status' },
  { id: 'scalp', index: 7, imagePct: 75, label: 'Scalp Health' },
  { id: 'environmental', index: 8, imagePct: 88, label: 'Environmental Factors' },
];

const ZONE = 100 / BRIDGE_TRIGGERS.length;

/** The trigger whose progress zone currently contains `progress`. */
export function triggerForProgress(progress: number): BridgeTrigger {
  const clamped = Math.max(0, Math.min(100, progress));
  const idx = Math.min(BRIDGE_TRIGGERS.length - 1, Math.floor(clamped / ZONE));
  return BRIDGE_TRIGGERS[idx];
}

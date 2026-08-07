export type BridgeStageId =
  | 'surface'
  | 'lifestyle'
  | 'hormonal'
  | 'follicle'
  | 'pathway';

export interface BridgeStage {
  id: BridgeStageId;
  index: number;
  range: [number, number];
  title: string;
  copy: string;
  short: string;
}

export const BRIDGE_STAGES: BridgeStage[] = [
  {
    id: 'surface',
    index: 1,
    range: [0, 20],
    title: 'Looking beneath the surface',
    copy: 'The first foundation of the pathway becomes visible in the biological environment.',
    short: 'Beneath the surface',
  },
  {
    id: 'lifestyle',
    index: 2,
    range: [20, 40],
    title: 'Understanding stress and lifestyle signals',
    copy: 'Stress-wave and lifestyle signals illuminate. The first incomplete section receives scaffolding.',
    short: 'Stress & lifestyle',
  },
  {
    id: 'hormonal',
    index: 3,
    range: [40, 60],
    title: 'Connecting hormonal and metabolic pathways',
    copy: 'Hormonal particles and metabolic channels activate. Bridge pillars rise through the centre.',
    short: 'Hormonal & metabolic',
  },
  {
    id: 'follicle',
    index: 4,
    range: [60, 80],
    title: 'Mapping the follicle environment',
    copy: 'Scalp, nutrition and inflammatory signals appear. Nutrient particles move through vessel-like pathways.',
    short: 'Follicle environment',
  },
  {
    id: 'pathway',
    index: 5,
    range: [80, 100],
    title: 'Building your personalised recovery pathway',
    copy: 'Final segments connect. A restrained light travels across the completed pathway.',
    short: 'Recovery pathway',
  },
];

export function stageForProgress(progress: number): BridgeStage {
  const clamped = Math.max(0, Math.min(100, progress));
  return (
    BRIDGE_STAGES.find(
      (stage) => clamped >= stage.range[0] && clamped < stage.range[1],
    ) ?? BRIDGE_STAGES[BRIDGE_STAGES.length - 1]
  );
}

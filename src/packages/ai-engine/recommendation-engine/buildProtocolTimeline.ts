export interface TimelineMonth {
  readonly month: string;
  readonly expectations: readonly string[];
}

export interface ProtocolTimelineResult {
  readonly timeline: readonly TimelineMonth[];
}

export const buildProtocolTimeline = (): ProtocolTimelineResult => {
  return {
    timeline: [
      {
        month: 'Month 1',
        expectations: ['Shedding reduction', 'Scalp health normalization']
      },
      {
        month: 'Month 2',
        expectations: ['Inflammation stabilization', 'Reduced follicular stress']
      },
      {
        month: 'Month 3',
        expectations: ['Early regrowth signs', 'Improved hair caliber']
      },
      {
        month: 'Month 4-6',
        expectations: ['Density improvement', 'Maximum topical benefits']
      }
    ]
  };
};

import type { TimelineEvent } from '../types';

// ─── Timeline Formatters ──────────────────────────────────────────────────────

export function formatTimelineAsMarkdown(events: readonly TimelineEvent[]): string {
  return events
    .map(e => {
      const conditional = e.isConditional ? ' *(conditional)*' : '';
      return [
        `### ${e.weekRange} — ${e.milestone}${conditional}`,
        e.expectation,
        `*${e.confidenceNote}*`,
      ].join('\n');
    })
    .join('\n\n');
}

export function formatTimelineAsBullets(events: readonly TimelineEvent[]): readonly string[] {
  return events.map(e => {
    const conditional = e.isConditional ? ' (if adherence maintained)' : '';
    return `**${e.weekRange}**: ${e.milestone}${conditional} — ${e.expectation}`;
  });
}

export function formatTimelineForWhatsApp(events: readonly TimelineEvent[]): string {
  return events
    .map(e => `📍 ${e.weekRange}: ${e.milestone}`)
    .join('\n');
}

export function formatTimelineForPDF(events: readonly TimelineEvent[]): readonly string[][] {
  return events.map(e => [
    e.weekRange,
    e.phase.charAt(0).toUpperCase() + e.phase.slice(1),
    e.milestone,
    e.expectation.length > 120 ? e.expectation.slice(0, 117) + '...' : e.expectation,
    e.isConditional ? 'Conditional' : 'Expected',
  ]);
}

export function formatTimelinePhaseLabel(phase: TimelineEvent['phase']): string {
  const labels: Record<TimelineEvent['phase'], string> = {
    early: 'Early Phase',
    mid: 'Mid Phase',
    late: 'Late Phase',
    maintenance: 'Maintenance',
  };
  return labels[phase];
}

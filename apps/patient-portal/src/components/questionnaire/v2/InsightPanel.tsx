'use client';

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HairStoryFactor, FactorConfidence } from './insightRules';

interface InsightPanelProps {
  factors: HairStoryFactor[];
}

const BUCKETS: { key: FactorConfidence; label: string; emptyHint?: string }[] = [
  { key: 'strong',     label: 'Strong signals' },
  { key: 'possible',   label: 'Possible contributors' },
  { key: 'evaluating', label: 'Still evaluating' },
];

const TINT: Record<FactorConfidence, { dot: string; text: string }> = {
  strong:     { dot: 'bg-emerald-500 text-white',                text: 'text-slate-900 font-semibold' },
  possible:   { dot: 'bg-amber-500/90 text-white',               text: 'text-slate-800 font-medium' },
  evaluating: { dot: 'bg-slate-200 text-slate-400',              text: 'text-slate-400' },
};

/**
 * "Hair Intelligence" — desktop-only sticky panel that groups factors into
 * three confidence buckets so patients see the model thinking, not just a
 * binary checklist. Purely presentational; no API.
 */
export function InsightPanel({ factors }: InsightPanelProps) {
  const grouped = BUCKETS.map(b => ({
    ...b,
    items: factors.filter(f => f.confidence === b.key),
  }));

  const total = factors.length;
  const detectedCount = factors.filter(f => f.confidence !== 'evaluating').length;

  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200/70 bg-white/80 p-4',
        'shadow-[0_8px_24px_-16px_rgba(15,23,42,0.18)]',
      )}
      aria-label="Hair intelligence"
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600">
          <Sparkles className="w-3.5 h-3.5" aria-hidden />
          Hair intelligence
        </span>
        <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
          {detectedCount}/{total}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {grouped.map(group => {
          if (group.items.length === 0) return null;
          return (
            <section key={group.key}>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                {group.label}
              </h3>
              <ul className="mt-2 flex flex-col gap-1.5">
                {group.items.map(f => (
                  <li key={f.id} className="flex items-center gap-2.5 text-[13px] leading-snug">
                    <motion.span
                      layout
                      initial={false}
                      transition={{ duration: 0.25 }}
                      className={cn(
                        'w-4 h-4 rounded-full grid place-items-center text-[10px] font-bold shrink-0',
                        TINT[f.confidence].dot,
                      )}
                      aria-hidden
                    >
                      {f.confidence === 'evaluating' ? '○' : '✓'}
                    </motion.span>
                    <span className={TINT[f.confidence].text}>{f.label}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] text-slate-400 leading-snug">
        Updated live from your answers. Not a diagnosis.
      </p>
    </div>
  );
}

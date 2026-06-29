'use client';

import { motion } from 'framer-motion';
import { Clock, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionIntroContent, HairStoryFactor } from './insightRules';

interface SectionIntroProps {
  content: SectionIntroContent;
  signals?: HairStoryFactor[];
  sectionIndex: number;
  sectionTotal: number;
  onContinue: () => void;
}

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.45, ease: [0.2, 0.8, 0.2, 1] as const },
});

/**
 * Cinematic section transition.
 *
 *  • Oversized two-digit section index in Fraunces — drives the "chapter" feel.
 *  • Editorial title pairs with a soft tagline and a glance-able time hint.
 *  • Contextual Hair Intelligence card surfaces strong/possible signals so far —
 *    the only place the persistent panel used to live; now a moment, not a fixture.
 */
export function SectionIntro({
  content,
  signals = [],
  sectionIndex,
  sectionTotal,
  onContinue,
}: SectionIntroProps) {
  const meaningful = signals.filter(s => s.confidence !== 'evaluating');
  const indexLabel = String(sectionIndex).padStart(2, '0');

  return (
    <motion.section
      key={content.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.5 }}
      className="relative min-h-[70vh] flex flex-col items-center justify-center text-center"
      aria-label={`${content.title} section introduction`}
    >
      {/* Oversized chapter number — sits behind the title as an editorial mark */}
      <motion.span
        {...fade(0)}
        aria-hidden
        className={cn(
          'font-display font-light leading-none select-none',
          'text-[88px] sm:text-[140px] lg:text-[200px]',
          'bg-clip-text text-transparent',
          'bg-gradient-to-b from-slate-900/15 via-slate-900/8 to-transparent',
        )}
      >
        {indexLabel}
      </motion.span>

      <motion.span
        {...fade(0.08)}
        className="-mt-3 sm:-mt-6 text-[11px] sm:text-xs uppercase tracking-[0.22em] font-semibold text-indigo-600"
      >
        Chapter {sectionIndex} of {sectionTotal}
      </motion.span>

      <motion.h1
        {...fade(0.16)}
        className={cn(
          'mt-5 font-display font-medium tracking-tight text-slate-900 leading-[0.98]',
          'text-[44px] sm:text-[72px] lg:text-[96px]',
        )}
      >
        {content.title}
      </motion.h1>

      <motion.p
        {...fade(0.24)}
        className="mt-6 max-w-[44ch] text-[17px] sm:text-xl text-slate-600 leading-relaxed"
      >
        {content.body}
      </motion.p>

      {content.estimateLabel && (
        <motion.span
          {...fade(0.32)}
          className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500"
        >
          <Clock className="w-3.5 h-3.5" aria-hidden />
          {content.estimateLabel}
        </motion.span>
      )}

      {/* Contextual Hair Intelligence */}
      {meaningful.length > 0 && (
        <motion.div
          {...fade(0.4)}
          className={cn(
            'mt-10 w-full max-w-[460px]',
            'rounded-[28px] border border-white/70 bg-white/70 backdrop-blur-2xl',
            'p-5 sm:p-6 text-left',
            'shadow-[0_30px_80px_-30px_rgba(99,102,241,0.5),0_0_0_1px_rgba(255,255,255,0.6)_inset]',
          )}
        >
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600">
            <Sparkles className="w-3.5 h-3.5" aria-hidden />
            Interesting finding
          </span>
          <p className="mt-2 text-[15px] text-slate-700">
            Your answers so far suggest stronger signals for:
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {meaningful.map(s => (
              <li key={s.id} className="flex items-center gap-2.5 text-[15px]">
                <span
                  className={cn(
                    'w-5 h-5 rounded-full grid place-items-center text-[11px] font-bold text-white shrink-0',
                    s.confidence === 'strong'
                      ? 'bg-gradient-to-br from-emerald-400 to-emerald-600'
                      : 'bg-gradient-to-br from-amber-400 to-amber-600',
                  )}
                  aria-hidden
                >
                  ✓
                </span>
                <span className="text-slate-900 font-medium">{s.label}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      <motion.button
        {...fade(0.48)}
        type="button"
        onClick={onContinue}
        whileTap={{ scale: 0.97 }}
        whileHover={{ y: -2 }}
        className={cn(
          'mt-12 sm:mt-14 inline-flex items-center justify-center gap-2',
          'h-14 sm:h-16 px-9 sm:px-12 rounded-full',
          'bg-slate-900 hover:bg-slate-800 text-white',
          'text-base sm:text-lg font-semibold',
          'shadow-[0_24px_60px_-20px_rgba(15,23,42,0.55)]',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/25',
        )}
        autoFocus
      >
        Begin <ArrowRight className="w-5 h-5" />
      </motion.button>
    </motion.section>
  );
}

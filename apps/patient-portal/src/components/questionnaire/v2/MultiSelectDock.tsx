'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MultiSelectDockProps {
  selectedCount: number;
  isAnswered: boolean;
  isLast: boolean;
  isSubmitting: boolean;
  onContinue: () => void;
  /** Optional skip handler — when present, shows a tertiary "Skip" link. */
  onSkip?: () => void;
}

/**
 * Sticky action dock for multi-select questions and the final step.
 *
 * Visual rules:
 *  - Selection chip slides in only when there is something to confirm.
 *  - On the last visible question the CTA flips to emerald "Complete"
 *    so the patient has a clear sense of arrival.
 */
export function MultiSelectDock({
  selectedCount,
  isAnswered,
  isLast,
  isSubmitting,
  onContinue,
  onSkip,
}: MultiSelectDockProps) {
  return (
    <div className="flex items-center gap-3">
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.span
            key="count"
            initial={{ opacity: 0, x: -8, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -8, scale: 0.9 }}
            transition={{ duration: 0.18 }}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/[0.06] px-3 py-1.5 text-sm font-semibold text-slate-700 tabular-nums shrink-0"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-900" aria-hidden />
            {selectedCount} selected
          </motion.span>
        )}
      </AnimatePresence>

      {onSkip && !isAnswered && (
        <button
          type="button"
          onClick={onSkip}
          className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors px-3 py-2"
        >
          Skip
        </button>
      )}

      <motion.button
        type="button"
        onClick={onContinue}
        disabled={!isAnswered || isSubmitting}
        whileTap={{ scale: 0.98 }}
        whileHover={{ y: -1 }}
        className={cn(
          'flex-1 h-14 sm:h-[60px] rounded-full',
          'text-base sm:text-lg font-semibold tracking-tight',
          'inline-flex items-center justify-center gap-2',
          'transition-colors duration-150',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          isLast
            ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-500 hover:to-emerald-800 text-white shadow-[0_24px_60px_-20px_rgba(5,150,105,0.55)]'
            : 'bg-slate-900 hover:bg-slate-800 text-white shadow-[0_24px_60px_-20px_rgba(15,23,42,0.55)]',
        )}
      >
        {isSubmitting
          ? 'Analyzing…'
          : isLast
            ? <>Complete assessment <CheckCircle2 className="w-5 h-5" /></>
            : <>Continue <ArrowRight className="w-5 h-5" /></>}
      </motion.button>
    </div>
  );
}

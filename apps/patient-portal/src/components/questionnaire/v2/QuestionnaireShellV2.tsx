'use client';

import { ReactNode, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate as animateValue } from 'framer-motion';
import { cn } from '@/lib/utils';
import { QuestionCategory } from '@/types/questionnaire';
import { ChevronLeft, Clock } from 'lucide-react';

export interface CategoryMeta {
  id: QuestionCategory | string;
  label: string;
  icon: string;
}

interface QuestionnaireShellV2Props {
  clinicName?: string;
  sectionTitle: string;
  sectionIndex: number;
  sectionTotal: number;
  nextSectionLabel?: string;
  completionPercent: number;
  estimatedMinutesRemaining?: number;
  /**
   * Position of the current question *within its section* (1-based).
   * Surfaced in the header so progress is visible on every step, even
   * when the section title and overall % barely move.
   */
  questionInSection?: { current: number; total: number };
  canGoBack: boolean;
  onBack: () => void;
  children: ReactNode;
  dock?: ReactNode;
}

/**
 * Immersive single-column shell.
 *
 *  • Atmospheric canvas (drifting aurora + film grain) provided by `.atmosphere`.
 *  • A single floating glass pill at the top is the *only* persistent UI
 *    chrome — back, section, progress and time live inside one element.
 *  • The content well centres at 960–1080 px with vertical breathing room so
 *    the editorial-serif question can own the screen.
 */
export function QuestionnaireShellV2({
  clinicName,
  sectionTitle,
  sectionIndex,
  sectionTotal,
  nextSectionLabel,
  completionPercent,
  estimatedMinutesRemaining,
  questionInSection,
  canGoBack,
  onBack,
  children,
  dock,
}: QuestionnaireShellV2Props) {
  const timeLabel =
    estimatedMinutesRemaining == null ? null :
    estimatedMinutesRemaining <= 0 ? 'Almost done' :
    estimatedMinutesRemaining === 1 ? '1 min left' :
    `${estimatedMinutesRemaining} min left`;

  return (
    <div className="atmosphere min-h-[100dvh] w-full flex flex-col">
      {/* ── Floating glass header ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 px-3 sm:px-6 pt-3 sm:pt-5">
        <motion.header
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
          className={cn(
            'mx-auto w-full max-w-[1080px]',
            'flex items-center gap-2 sm:gap-3',
            'rounded-full border border-white/60',
            'bg-white/65 backdrop-blur-2xl',
            'shadow-[0_24px_60px_-30px_rgba(15,23,42,0.25),0_0_0_1px_rgba(255,255,255,0.6)_inset]',
            'pl-2 pr-3 sm:pl-3 sm:pr-4 py-2',
          )}
          aria-label="Assessment header"
        >
          {/* Back chip */}
          <button
            type="button"
            onClick={onBack}
            disabled={!canGoBack}
            className={cn(
              'shrink-0 inline-flex items-center justify-center',
              'h-10 w-10 sm:h-11 sm:w-11 rounded-full',
              'bg-white/70 border border-white/80',
              'text-slate-700 hover:text-slate-900 hover:bg-white',
              'transition-all duration-200 active:scale-95',
              'disabled:opacity-30 disabled:hover:bg-white/70 disabled:cursor-not-allowed',
            )}
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Section context — cross-fades on section change so updates are obvious */}
          <div className="min-w-0 flex-1 px-1 sm:px-2 overflow-hidden">
            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.18em] font-semibold text-indigo-600/90 truncate">
              Section {sectionIndex} of {sectionTotal}
              {questionInSection && questionInSection.total > 0 && (
                <span className="ml-1 sm:ml-2 inline-flex items-center px-1.5 py-px rounded-full bg-indigo-100/80 text-indigo-700 text-[9px] sm:text-[10px] font-bold tabular-nums normal-case tracking-normal">
                  Q {questionInSection.current}/{questionInSection.total}
                </span>
              )}
              {nextSectionLabel && (
                <span className="hidden sm:inline text-slate-400 font-medium normal-case tracking-normal"> · Next: {nextSectionLabel}</span>
              )}
            </p>
            <AnimatePresence mode="wait">
              <motion.p
                key={sectionTitle}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
                className="text-[14px] sm:text-[15px] font-semibold text-slate-900 leading-tight truncate -mt-px"
              >
                {sectionTitle}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Progress + time */}
          <div className="shrink-0 flex items-center gap-2 sm:gap-3">
            {timeLabel && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                <Clock className="w-3 h-3" aria-hidden /> {timeLabel}
              </span>
            )}
            <ProgressRing percent={completionPercent} />
          </div>
        </motion.header>

        {/* Mobile-only time pill, sits just under the header */}
        {timeLabel && (
          <p className="sm:hidden mt-2 text-center text-[11px] font-medium text-slate-500">
            <Clock className="inline w-3 h-3 mr-1 -mt-0.5" aria-hidden />
            {timeLabel}
            {clinicName && <span className="text-slate-400"> · {clinicName}</span>}
          </p>
        )}
      </div>

      {/* ── Centered content well ──────────────────────────────────────────── */}
      <main
        className={cn(
          'relative flex-1 w-full',
          'px-4 sm:px-8 lg:px-12',
          'pt-10 sm:pt-16 lg:pt-24',
          dock ? 'pb-[140px] lg:pb-24' : 'pb-24',
        )}
      >
        <div className="mx-auto w-full max-w-[960px] xl:max-w-[1080px]">
          <AnimatePresence mode="wait">{children}</AnimatePresence>
        </div>
      </main>

      {/* ── Desktop dock — floating glass at bottom of content well ────────── */}
      {dock && (
        <div className="hidden lg:block px-4 sm:px-8 lg:px-12 pb-10">
          <div className="mx-auto w-full max-w-[960px] xl:max-w-[1080px]">{dock}</div>
        </div>
      )}

      {/* ── Mobile / tablet sticky dock ────────────────────────────────────── */}
      {dock && (
        <div
          className={cn(
            'lg:hidden fixed bottom-0 inset-x-0 z-30',
            'bg-white/85 backdrop-blur-2xl border-t border-white/60',
            'px-4 sm:px-6 pt-3 pb-[max(env(safe-area-inset-bottom),14px)]',
            'shadow-[0_-18px_50px_-20px_rgba(15,23,42,0.18)]',
          )}
        >
          <div className="mx-auto w-full max-w-[680px]">{dock}</div>
        </div>
      )}
    </div>
  );
}

/* ─── Progress ring ─────────────────────────────────────────────────────── */

function ProgressRing({ percent }: { percent: number }) {
  const size = 40;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = c - (clamped / 100) * c;

  // Smooth count-up animation on the percentage label so every increment is
  // visible — even a 1% bump produces a tick.
  const display = useMotionValue(clamped);
  const rounded = useTransform(display, (v) => Math.round(v));
  useEffect(() => {
    const controls = animateValue(display, clamped, {
      duration: 0.6,
      ease: [0.2, 0.8, 0.2, 1],
    });
    return () => controls.stop();
  }, [clamped, display]);

  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(clamped)}% complete`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="#6366F1" />
            <stop offset="55%"  stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="url(#ringGrad)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
      <motion.span className="absolute inset-0 grid place-items-center text-[10px] font-bold text-slate-900 tabular-nums">
        {rounded}
      </motion.span>
    </div>
  );
}

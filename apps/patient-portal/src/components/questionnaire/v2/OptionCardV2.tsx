'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { QuestionOption } from '@/types/questionnaire';
import { cn } from '@/lib/utils';

interface OptionCardV2Props {
  option: QuestionOption;
  isSelected: boolean;
  multi: boolean;
  onSelect: () => void;
  /**
   * Density controls internal spacing/typography for the card.
   *  - 'tile'    : compact 2-line cards (icon + label) — used when an option
   *                grid contains 6+ choices with no descriptions.
   *  - 'card'    : default — icon + label + optional 1-line description.
   *  - 'feature' : large icon-art + label + description (used when options ≤ 4).
   */
  density?: 'tile' | 'card' | 'feature';
}

/**
 * Unified single/multi-select card. Designed to feel tactile on touch
 * (whileTap shrinks, instant border colour swap, ripple-free) without
 * sacrificing keyboard accessibility (focus-visible ring, role="radio"/"checkbox").
 */
export function OptionCardV2({
  option,
  isSelected,
  multi,
  onSelect,
  density = 'card',
}: OptionCardV2Props) {
  const hasImage = !!option.image?.url;
  const hasIllustration = !hasImage && !!option.illustration?.url;

  return (
    <motion.button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={isSelected}
      onClick={onSelect}
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: isSelected ? -3 : -2 }}
      animate={{ y: isSelected ? -3 : 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      className={cn(
        'group relative w-full text-left',
        'rounded-[28px] border transition-colors duration-200',
        'backdrop-blur-xl',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/25',
        'min-h-[88px]',
        isSelected
          ? [
              'border-indigo-500/70',
              'bg-gradient-to-br from-white/95 via-indigo-50/80 to-fuchsia-50/60',
              'shadow-[0_30px_60px_-25px_rgba(99,102,241,0.55),0_0_0_1px_rgba(255,255,255,0.7)_inset,0_-2px_0_0_rgba(99,102,241,0.18)_inset]',
            ].join(' ')
          : [
              'border-white/60',
              'bg-white/65',
              'shadow-[0_18px_40px_-28px_rgba(15,23,42,0.25),0_0_0_1px_rgba(255,255,255,0.55)_inset]',
              'hover:bg-white/85 hover:border-white/90',
            ].join(' '),
      )}
    >
      {/* Selection chip */}
      <span
        className={cn(
          'absolute top-3 right-3 z-10',
          'w-7 h-7 rounded-full grid place-items-center',
          'transition-all duration-200',
          isSelected
            ? 'bg-indigo-600 text-white scale-100 opacity-100 ring-4 ring-indigo-600/15'
            : 'bg-white border-2 border-slate-200 text-transparent scale-90 opacity-70',
        )}
        aria-hidden
      >
        <Check className="w-4 h-4" strokeWidth={3} />
      </span>

      {/* Image variant — photographic, full-bleed crop */}
      {hasImage && (
        <div className="aspect-[4/3] w-full overflow-hidden rounded-t-[22px] bg-slate-100">
          <img
            src={option.image!.url}
            alt={option.image!.alt}
            className={cn(
              'w-full h-full object-cover transition-transform duration-300',
              isSelected ? 'scale-[1.02]' : 'group-hover:scale-[1.02]',
            )}
            loading="lazy"
          />
        </div>
      )}

      {/* Illustration variant — editorial diagram, contained, transparent bg */}
      {hasIllustration && (
        <div
          className={cn(
            'w-full grid place-items-center overflow-hidden rounded-t-[22px]',
            'bg-gradient-to-b from-slate-50 to-white',
            density === 'feature' ? 'aspect-[5/3]' : 'aspect-[4/3]',
          )}
        >
          <img
            src={option.illustration!.url}
            alt={option.illustration!.alt}
            className={cn(
              'max-h-[78%] max-w-[78%] object-contain transition-transform duration-300',
              isSelected ? 'scale-[1.04]' : 'group-hover:scale-[1.02]',
            )}
            loading="lazy"
          />
        </div>
      )}

      {/* Body */}
      <div
        className={cn(
          'flex',
          density === 'tile' ? 'flex-col items-center text-center gap-2 p-4' :
          density === 'feature' ? 'flex-col gap-3 p-5' :
          'flex-row items-start gap-3 p-4 sm:p-5',
        )}
      >
        {!hasImage && !hasIllustration && option.icon && (
          <span
            className={cn(
              'shrink-0 grid place-items-center rounded-2xl',
              density === 'tile' ? 'w-12 h-12 text-2xl' :
              density === 'feature' ? 'w-14 h-14 text-3xl' :
              'w-12 h-12 text-2xl',
              isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700',
              'transition-colors duration-150',
            )}
            aria-hidden
          >
            {option.icon}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h4
            className={cn(
              'font-semibold leading-tight break-words hyphens-auto',
              density === 'tile' ? 'text-[13px] sm:text-sm' :
              density === 'feature' ? 'text-base sm:text-lg' :
              'text-sm sm:text-base',
              isSelected ? 'text-indigo-900' : 'text-slate-800',
            )}
            style={{ wordBreak: 'break-word' }}
          >
            {option.label}
          </h4>
          {option.description && density !== 'tile' && (
            <p
              className={cn(
                'mt-1 leading-snug break-words',
                isSelected ? 'text-indigo-700/80' : 'text-slate-500',
                density === 'feature' ? 'text-[15px]' : 'text-sm',
              )}
            >
              {option.description}
            </p>
          )}
        </div>
      </div>
    </motion.button>
  );
}

'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

/**
 * OPTION BUTTON COMPONENT
 *
 * Single-select answer button extracted from legacy component.
 * Features:
 * - Icon/visual support (left side)
 * - Option text and optional description
 * - Hover/focus states
 * - ChevronRight hint icon (indicates action)
 *
 * Used for "choice" type questions in questionnaires.
 */

interface OptionButtonProps {
  /** Option display text */
  label: string;

  /** Optional description text (smaller, secondary) */
  description?: string;

  /** Icon or visual element (rendered left of text) */
  visual?: ReactNode;

  /** Click handler */
  onClick?: () => void;

  /** Is this option currently selected */
  isSelected?: boolean;

  /** Optional className for button */
  className?: string;

  /** Optional className for text section */
  textClassName?: string;

  /** Show right chevron hint (default: true) */
  showChevron?: boolean;

  /** Custom visual container className */
  visualContainerClassName?: string;
}

export function OptionButton({
  label,
  description,
  visual,
  onClick,
  isSelected = false,
  className,
  textClassName,
  showChevron = true,
  visualContainerClassName,
}: OptionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        // Base styling
        'group flex items-center justify-between p-4 rounded-2xl',
        'border transition-all text-left',
        // Hover and selection states
        isSelected
          ? 'border-[#2a5c3a] bg-[#f7fbf7]'
          : 'border-[#ddd8cc] bg-white hover:border-[#2a5c3a] hover:bg-[#f7fbf7] hover:shadow-md',
        className
      )}
    >
      {/* Content Section */}
      <div className="flex items-center gap-4 w-full">
        {/* Visual/Icon Container */}
        {visual && (
          <div
            className={cn(
              'p-1 bg-[#fffdf9] rounded-xl',
              'border border-[#ddd8cc]/40',
              'flex-shrink-0 flex items-center justify-center',
              visualContainerClassName
            )}
          >
            {visual}
          </div>
        )}

        {/* Text Container */}
        <div className={cn('flex-1', textClassName)}>
          <span className="text-sm font-semibold font-sans text-gray-800 leading-tight">
            {label}
          </span>
          {description && (
            <p className="text-xs text-[#aaa] font-sans mt-1">{description}</p>
          )}
        </div>
      </div>

      {/* Right Chevron Hint */}
      {showChevron && (
        <ChevronRight
          className={cn(
            'w-4 h-4 flex-shrink-0 ml-2 transition-colors',
            isSelected ? 'text-[#2a5c3a]' : 'text-[#ddd8cc] group-hover:text-[#2a5c3a]'
          )}
        />
      )}
    </button>
  );
}

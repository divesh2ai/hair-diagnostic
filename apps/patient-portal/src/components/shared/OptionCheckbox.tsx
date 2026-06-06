'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

/**
 * OPTION CHECKBOX COMPONENT
 *
 * Multi-select answer card extracted from legacy component.
 * Features:
 * - Icon/visual support (optional)
 * - Selected state with checkmark
 * - Smooth color transitions
 * - Proper accessibility
 *
 * Used for "multi" type questions in questionnaires.
 */

interface OptionCheckboxProps {
  /** Option display text */
  label: string;

  /** Optional icon or visual element (left side) */
  visual?: ReactNode;

  /** Click/toggle handler */
  onClick?: () => void;

  /** Is this option currently selected */
  isSelected?: boolean;

  /** Optional className for container */
  className?: string;

  /** Optional className for text */
  textClassName?: string;

  /** Show visual container background (default: true) */
  showVisualBackground?: boolean;

  /** Custom visual container className */
  visualContainerClassName?: string;
}

export function OptionCheckbox({
  label,
  visual,
  onClick,
  isSelected = false,
  className,
  textClassName,
  showVisualBackground = true,
  visualContainerClassName,
}: OptionCheckboxProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        // Base styling
        'flex items-center justify-between p-3.5 rounded-2xl',
        'border transition-all text-left group',
        // Selection state styling
        isSelected
          ? 'border-[#2a5c3a] bg-[#f7fbf7] text-[#2a5c3a] shadow-sm'
          : 'border-[#ddd8cc] bg-white hover:border-[#2a5c3a] hover:shadow-sm',
        className
      )}
    >
      {/* Content Section */}
      <div className="flex items-center gap-3 flex-1">
        {/* Visual/Icon Container */}
        {visual && (
          <div
            className={cn(
              showVisualBackground && 'p-1 bg-[#fffdf9] rounded-xl border border-[#ddd8cc]/40',
              'flex-shrink-0 flex items-center justify-center',
              visualContainerClassName
            )}
          >
            {visual}
          </div>
        )}

        {/* Text */}
        <span className={cn('text-xs font-sans font-medium', textClassName)}>
          {label}
        </span>
      </div>

      {/* Checkmark - Shows when selected */}
      {isSelected && (
        <Check className="w-3.5 h-3.5 flex-shrink-0 text-[#2a5c3a] ml-2" />
      )}
    </button>
  );
}

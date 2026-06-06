'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * TEXT INPUT FIELD
 *
 * Unified text/number/textarea input extracted from legacy component.
 * Features:
 * - Support for text, number, and textarea types
 * - Optional right-side button slot (for voice input, etc.)
 * - Accessible focus states
 * - Responsive padding
 *
 * Used for open-ended questions.
 */

interface TextInputFieldProps {
  /** Input type */
  type?: 'text' | 'number' | 'textarea';

  /** Input value */
  value: string | number;

  /** Change handler */
  onChange?: (value: string) => void;

  /** Placeholder text */
  placeholder?: string;

  /** Optional button element (right side, for voice input etc.) */
  rightButton?: ReactNode;

  /** Optional className for container */
  className?: string;

  /** Optional className for input element */
  inputClassName?: string;

  /** Optional className for button container */
  buttonContainerClassName?: string;

  /** Auto focus on mount (default: true) */
  autoFocus?: boolean;

  /** Disabled state */
  disabled?: boolean;

  /** Min value (for number type) */
  min?: number;

  /** Max value (for number type) */
  max?: number;

  /** Min height for textarea (default: 140px) */
  minHeight?: string;

  /** Allow keyboard submit (Enter key) */
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function TextInputField({
  type = 'text',
  value,
  onChange,
  placeholder,
  rightButton,
  className,
  inputClassName,
  buttonContainerClassName,
  autoFocus = true,
  disabled = false,
  min,
  max,
  minHeight = '140px',
  onKeyDown,
}: TextInputFieldProps) {
  const isTextarea = type === 'textarea';
  const baseInputClasses = cn(
    // Base styling
    'w-full p-5 pr-14 rounded-2xl',
    // Border and background
    'border border-[#ddd8cc] bg-white',
    // Focus states
    'focus:border-[#2a5c3a] focus:ring-1 focus:ring-[#2a5c3a]',
    'outline-none',
    // Typography
    'font-sans text-base',
    // Disabled state
    disabled && 'opacity-50 cursor-not-allowed',
    inputClassName
  );

  return (
    <div className={cn('relative mt-4', className)}>
      {isTextarea ? (
        <textarea
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          onKeyDown={onKeyDown}
          style={{ minHeight }}
          className={cn(baseInputClasses, 'resize-none')}
        />
      ) : (
        <input
          autoFocus={autoFocus}
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          onKeyDown={onKeyDown}
          min={min}
          max={max}
          className={baseInputClasses}
        />
      )}

      {/* Right-side button slot (for voice input, camera, etc.) */}
      {rightButton && (
        <div
          className={cn(
            'absolute',
            isTextarea ? 'top-5' : 'top-1/2 -translate-y-1/2',
            'right-4',
            buttonContainerClassName
          )}
        >
          {rightButton}
        </div>
      )}
    </div>
  );
}

'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * PROGRESS BAR COMPONENT
 *
 * Animated progress indicator extracted from legacy Quiz component.
 * Fixed at top of viewport, shows questionnaire completion percentage.
 *
 * Motion system:
 * - Linear width animation (responsive to progress changes)
 * - 400ms transition duration for smooth feel
 * - Premium green color (#2a5c3a) from legacy design system
 */

interface ProgressBarProps {
  /** Current step (0-indexed) */
  currentStep: number;

  /** Total number of steps */
  totalSteps: number;

  /** Optional className for outer container */
  className?: string;

  /** Optional className for inner animated bar */
  barClassName?: string;

  /** Show percentage text label (default: false) */
  showPercentage?: boolean;
}

export function ProgressBar({
  currentStep,
  totalSteps,
  className,
  barClassName,
  showPercentage = false,
}: ProgressBarProps) {
  // Calculate progress as percentage (0-100)
  const progress = Math.round(((currentStep + 1) / totalSteps) * 100);

  return (
    <div className={cn('fixed top-0 left-0 w-full h-1 bg-[#eef4ee] z-50', className)}>
      {/* Animated progress bar */}
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{
          duration: 0.4,
          ease: 'easeInOut',
        }}
        className={cn('h-full bg-[#2a5c3a]', barClassName)}
      />

      {/* Optional percentage text (hidden by default, for mobile accessibility) */}
      {showPercentage && (
        <div className="sr-only" role="status" aria-live="polite">
          {progress}% complete
        </div>
      )}
    </div>
  );
}

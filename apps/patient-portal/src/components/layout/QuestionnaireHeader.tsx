'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * QUESTIONNAIRE HEADER
 *
 * Premium header extracted from legacy Quiz component.
 * Features:
 * - Branding section (left)
 * - Step counter (right)
 * - Subtle bottom border
 *
 * Maintains warm, professional clinic aesthetic.
 */

interface QuestionnaireHeaderProps {
  /** Current step number (1-indexed in display) */
  currentStep: number;

  /** Total number of steps */
  totalSteps: number;

  /** Optional custom brand section content */
  brandContent?: ReactNode;

  /** Optional className override */
  className?: string;

  /** Show step counter text (default: true) */
  showStepCounter?: boolean;
}

export function QuestionnaireHeader({
  currentStep,
  totalSteps,
  brandContent,
  className,
  showStepCounter = true,
}: QuestionnaireHeaderProps) {
  return (
    <header
      className={cn(
        // Layout and spacing
        'p-6 flex justify-between items-center',
        // Background and border
        'bg-white border-b border-[#ddd8cc]',
        className
      )}
    >
      {/* Branding Section - Left */}
      <div className="flex items-center gap-3">
        {brandContent ? (
          brandContent
        ) : (
          <>
            <div>
              <div className="text-sm font-medium text-[#0c1a0e]">Dr. FACT</div>
              <div className="text-[8px] uppercase tracking-widest text-[#2a5c3a] font-sans font-bold">
                AI Trichologist
              </div>
            </div>
          </>
        )}
      </div>

      {/* Step Counter - Right */}
      {showStepCounter && (
        <div className="text-[10px] font-sans font-bold text-[#aaa] uppercase tracking-widest">
          Step {currentStep + 1} / {totalSteps}
        </div>
      )}
    </header>
  );
}

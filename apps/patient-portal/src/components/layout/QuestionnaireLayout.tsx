'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ProgressBar } from '@/components/feedback/ProgressBar';
import { QuestionnaireHeader } from './QuestionnaireHeader';
import { QuestionnaireFooter } from './QuestionnaireFooter';

/**
 * QUESTIONNAIRE LAYOUT WRAPPER
 *
 * Complete page layout extracted from legacy Quiz component.
 * Composition:
 * 1. Fixed progress bar (top)
 * 2. Header with branding and step counter
 * 3. Main content area (centered, max-width)
 * 4. Footer with attribution
 *
 * Maintains warm, medical aesthetic throughout.
 */

interface QuestionnaireLayoutProps {
  /** Main content to display */
  children: ReactNode;

  /** Current step (0-indexed) */
  currentStep: number;

  /** Total number of steps */
  totalSteps: number;

  /** Optional header content override */
  headerContent?: ReactNode;

  /** Optional footer content override */
  footerContent?: ReactNode;

  /** Custom main area className */
  mainClassName?: string;

  /** Optional layout className override */
  className?: string;

  /** Show progress bar (default: true) */
  showProgress?: boolean;

  /** Show header (default: true) */
  showHeader?: boolean;

  /** Show footer (default: true) */
  showFooter?: boolean;
}

export function QuestionnaireLayout({
  children,
  currentStep,
  totalSteps,
  headerContent,
  footerContent,
  mainClassName,
  className,
  showProgress = true,
  showHeader = true,
  showFooter = true,
}: QuestionnaireLayoutProps) {
  return (
    <div
      className={cn(
        // Full viewport
        'min-h-screen flex flex-col',
        // Design system colors
        'bg-[#faf7f2] font-serif text-[#0c1a0e]',
        className
      )}
    >
      {/* Progress Bar - Fixed Top */}
      {showProgress && (
        <ProgressBar currentStep={currentStep} totalSteps={totalSteps} />
      )}

      {/* Header */}
      {showHeader && (
        <QuestionnaireHeader
          currentStep={currentStep}
          totalSteps={totalSteps}
          brandContent={headerContent}
        />
      )}

      {/* Main Content Area */}
      <main
        className={cn(
          // Flex growth
          'flex-1',
          // Responsive max-width and centering
          'max-w-5xl w-full mx-auto',
          // Responsive padding
          'p-4 md:p-8',
          // Flex centering
          'flex items-center justify-center',
          mainClassName
        )}
      >
        {children}
      </main>

      {/* Footer */}
      {showFooter && <QuestionnaireFooter>{footerContent}</QuestionnaireFooter>}
    </div>
  );
}

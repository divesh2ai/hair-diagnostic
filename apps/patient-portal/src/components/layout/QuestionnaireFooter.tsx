'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';

/**
 * QUESTIONNAIRE FOOTER
 *
 * Subtle footer extracted from legacy Quiz component.
 * Shows clinical branding and attribution.
 * Minimal, professional, respects content above.
 */

interface QuestionnaireFooterProps {
  /** Custom footer content */
  children?: ReactNode;

  /** Show default info icon (default: true) */
  showIcon?: boolean;

  /** Optional className override */
  className?: string;

  /** Footer text (used if no children provided) */
  text?: string;
}

export function QuestionnaireFooter({
  children,
  showIcon = true,
  className,
  text = 'Clinical Intelligence by The Fact Nutrition',
}: QuestionnaireFooterProps) {
  return (
    <footer
      className={cn(
        // Layout and spacing
        'p-6 text-center',
        // Background
        'bg-[#faf7f2]',
        className
      )}
    >
      {children ? (
        children
      ) : (
        <div className="flex items-center justify-center gap-2 text-[#aaa]">
          {showIcon && <Info className="w-3 h-3" />}
          <span className="text-[10px] font-sans uppercase tracking-widest">
            {text}
          </span>
        </div>
      )}
    </footer>
  );
}

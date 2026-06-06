'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * CINEMATIC CONTAINER
 *
 * Premium two-column layout extracted from legacy Quiz component.
 * Left: Visual/image panel (dark, gradient overlay)
 * Right: Form/content panel (light, subtle gradient background)
 *
 * Preserves luxury clinic aesthetic and responsive mobile-first design.
 */

interface CinematicContainerProps {
  /** Visual panel content (images, gradients, background) */
  visualPanel: ReactNode;

  /** Form/content panel content (questions, inputs, buttons) */
  contentPanel: ReactNode;

  /** Optional custom className for container */
  className?: string;

  /** Optional visual panel custom className */
  visualClassName?: string;

  /** Optional content panel custom className */
  contentClassName?: string;

  /** Minimum height for visual panel on mobile */
  mobileMinHeight?: string;
}

export function CinematicContainer({
  visualPanel,
  contentPanel,
  className,
  visualClassName,
  contentClassName,
  mobileMinHeight = 'min-h-[220px]',
}: CinematicContainerProps) {
  return (
    <div
      className={cn(
        // Base container
        'bg-white rounded-[2rem] overflow-hidden',
        'border border-[#ddd8cc] shadow-[0_20px_40px_rgba(0,0,0,0.12)]',
        // Responsive: stack on mobile, side-by-side on desktop
        'flex flex-col md:flex-row',
        'w-full min-h-[550px]',
        className
      )}
    >
      {/* Visual Panel - Dark, Premium Background */}
      <div
        className={cn(
          // Layout
          'w-full md:w-1/2 relative overflow-hidden',
          // Mobile: smaller height
          `${mobileMinHeight} md:min-h-0`,
          'flex-shrink-0',
          // Dark medical aesthetic
          'bg-[#0c1a0e]',
          visualClassName
        )}
      >
        {visualPanel}
      </div>

      {/* Content Panel - Light, Warmth, Subtle Gradient */}
      <div
        className={cn(
          // Layout
          'w-full md:w-1/2',
          // Vertical centering
          'flex flex-col justify-center',
          // Padding responsive
          'p-6 md:p-10',
          // Subtle gradient background (warm off-white)
          'bg-gradient-to-br from-white to-[#fffdf5]',
          contentClassName
        )}
      >
        {contentPanel}
      </div>
    </div>
  );
}

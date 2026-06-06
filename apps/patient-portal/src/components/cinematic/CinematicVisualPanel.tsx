'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * CINEMATIC VISUAL PANEL
 *
 * Wraps background images/visuals with:
 * - Medical-grade dark overlay (gradient from dark to transparent)
 * - Footer text (clinical branding)
 * - Premium opacity fade
 *
 * Used within CinematicContainer's visual panel section.
 */

interface CinematicVisualPanelProps {
  /** Background image element or visual content */
  children: ReactNode;

  /** Optional footer text (e.g., "Dr. FACT Clinical Intelligence") */
  footerText?: string;

  /** Optional className for inner wrapper */
  className?: string;

  /** Image opacity (0-1) - default 0.8 for medical feel */
  imageOpacity?: number;

  /** Show overlay gradient (true by default) */
  showOverlay?: boolean;

  /** Show footer text (true by default) */
  showFooterText?: boolean;
}

export function CinematicVisualPanel({
  children,
  footerText = 'Dr. FACT Clinical Intelligence // Parameter Assessment',
  className,
  imageOpacity = 0.8,
  showOverlay = true,
  showFooterText = true,
}: CinematicVisualPanelProps) {
  return (
    <div className={cn('absolute inset-0 w-full h-full', className)}>
      {/* Background Image/Visual with Opacity */}
      <div
        style={{ opacity: imageOpacity }}
        className="absolute inset-0 w-full h-full"
      >
        {children}
      </div>

      {/* Medical Overlay - Dark Gradient from Bottom */}
      {showOverlay && (
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c1a0e] via-[#0c1a0e]/20 to-transparent" />
      )}

      {/* Footer Text - Clinical Branding */}
      {showFooterText && (
        <div className="absolute bottom-6 left-6 right-6 text-white font-sans text-[10px] uppercase tracking-widest opacity-60">
          {footerText}
        </div>
      )}
    </div>
  );
}

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode } from 'react';

/**
 * QUESTION TRANSITION COMPONENT
 *
 * Cinematic entrance animations for question content.
 * Extracted from legacy component's premium motion system.
 *
 * Two transition patterns:
 * - IMAGE: Zoom-in fade (subtle scale 1.05 → 1.0)
 * - FORM: Horizontal slide fade (x: 15px offset)
 *
 * Duration and easing tuned for clinical premium feel.
 */

interface QuestionTransitionProps {
  /** Unique key to trigger animation on content change */
  transitionKey: string;

  /** Content to animate in */
  children: ReactNode;

  /** Transition type: image panels (zoom-fade) or form panels (slide-fade) */
  type?: 'image' | 'form';

  /** Custom className for the animated div */
  className?: string;
}

export function QuestionTransition({
  transitionKey,
  children,
  type = 'form',
  className,
}: QuestionTransitionProps) {
  // Image transitions: subtle zoom with fade (cinematic)
  const imageVariants = {
    initial: { opacity: 0, scale: 1.05 },
    animate: { opacity: 0.9, scale: 1 },
    exit: { opacity: 0, scale: 1.05 },
  };

  // Form transitions: horizontal slide with fade
  const formVariants = {
    initial: { opacity: 0, x: 15 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -15 },
  };

  const variants = type === 'image' ? imageVariants : formVariants;
  const duration = type === 'image' ? 0.4 : 0.3;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={transitionKey}
        initial={variants.initial}
        animate={variants.animate}
        exit={variants.exit}
        transition={{
          duration,
          ease: 'easeOut',
        }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

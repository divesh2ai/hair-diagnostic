'use client';

import { motion } from 'framer-motion';

interface ProgressHeaderProps {
  currentStep: number;
  totalSteps: number;
  category: string;
  /** Optional one-line section description from the real protocol. */
  sectionDescription?: string;
}

export function ProgressHeader({
  currentStep,
  totalSteps,
  category,
  sectionDescription,
}: ProgressHeaderProps) {
  const percentage = Math.round(((currentStep + 1) / totalSteps) * 100);

  return (
    <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b px-4 py-4 w-full">
      <div className="max-w-2xl mx-auto flex flex-col gap-3">
        <div className="flex justify-between items-center text-sm font-semibold tracking-wide">
          <span className="text-primary uppercase">{category}</span>
          <span className="text-muted-foreground">{percentage}% Completed</span>
        </div>
        {sectionDescription && (
          <p className="text-xs text-muted-foreground/70 -mt-1 leading-snug">{sectionDescription}</p>
        )}
        <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
        </div>
      </div>
    </div>
  );
}

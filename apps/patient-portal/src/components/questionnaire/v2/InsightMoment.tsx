'use client';

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { InsightMomentContent } from './insightRules';

interface InsightMomentProps {
  content: InsightMomentContent;
}

/**
 * Static educational interstitial. Glass card above the next question; no
 * modal, no required interaction. Pairs with the immersive shell aesthetic.
 */
export function InsightMoment({ content }: InsightMomentProps) {
  return (
    <motion.div
      key={content.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1] }}
      className="mb-10 sm:mb-12 rounded-[28px] border border-white/70 bg-white/70 backdrop-blur-2xl p-5 sm:p-6 shadow-[0_24px_60px_-30px_rgba(99,102,241,0.45),0_0_0_1px_rgba(255,255,255,0.6)_inset]"
      role="note"
    >
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600">
        <Sparkles className="w-3.5 h-3.5" aria-hidden />
        {content.eyebrow}
      </span>
      <p className="mt-2 font-display text-[18px] sm:text-[20px] leading-snug text-slate-800 max-w-[60ch]">
        {content.body}
      </p>
    </motion.div>
  );
}

'use client';

import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';

export interface BuildingChecklistState {
  assessmentComplete: boolean;
  driversIdentified: boolean;
  recoveryPlanGenerated: boolean;
  doctorNarrativeCreating: boolean;   // in-progress when true, ✓ when false AND ready
  videoRendering: boolean;            // in-progress when true, ✓ when false AND ready
  doctorNarrativeReady: boolean;
}

interface Props {
  checklist: BuildingChecklistState;
}

const BULLETS = [
  'What is happening to your hair',
  'Why it is happening',
  'What is making it worse',
  'Your recommended treatment protocol',
  'What recovery may look like',
];

/**
 * Wait-state hero. The patient never sees raw URLs, queue status, or
 * "video has not been generated yet" copy — only a calm, narrative-shaped
 * progress experience that ends in the doctor briefing video.
 */
export function HairStoryBuilding({ checklist }: Props) {
  const items: Array<{ label: string; state: 'done' | 'active' | 'pending' }> = [
    { label: 'Assessment Complete', state: checklist.assessmentComplete ? 'done' : 'active' },
    { label: 'Biological Drivers Identified', state: checklist.driversIdentified ? 'done' : checklist.assessmentComplete ? 'active' : 'pending' },
    { label: 'Recovery Plan Generated', state: checklist.recoveryPlanGenerated ? 'done' : checklist.driversIdentified ? 'active' : 'pending' },
    { label: 'Doctor Narrative Being Created', state: checklist.doctorNarrativeReady ? 'done' : checklist.doctorNarrativeCreating ? 'active' : 'pending' },
    { label: 'Video Rendering', state: !checklist.videoRendering && checklist.doctorNarrativeReady ? 'done' : checklist.videoRendering ? 'active' : 'pending' },
  ];

  return (
    <section
      className="relative overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_8px_40px_-20px_rgba(15,23,42,0.15)]"
      style={{
        background:
          'radial-gradient(120% 80% at 80% -10%, rgba(255, 207, 178, 0.55) 0%, transparent 60%),' +
          'radial-gradient(110% 70% at 0% 110%, rgba(214, 211, 245, 0.45) 0%, transparent 55%),' +
          'linear-gradient(180deg, #fbf7f1 0%, #f6f5fb 100%)',
      }}
    >
      <div className="grid gap-10 px-6 py-12 sm:grid-cols-[1.1fr_1fr] sm:px-12 sm:py-16">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500/80">
            Preparing your briefing
          </p>
          <h1
            className="mt-3 font-serif text-[clamp(1.7rem,3.6vw,2.35rem)] font-medium leading-[1.18] tracking-tight text-slate-900"
            style={{ textWrap: 'balance' as const }}
          >
            Building Your Personalized Hair Story
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-slate-600">
            Your responses have been analyzed.
          </p>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-slate-600">
            HairOS is now creating a personalized doctor briefing explaining:
          </p>
          <ul className="mt-4 space-y-2 text-[15px] leading-relaxed text-slate-700">
            {BULLETS.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/70 px-4 py-2 text-[13px] text-slate-600 backdrop-blur-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
            <span>Estimated wait: 30–90 seconds</span>
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200/80 bg-white/80 p-6 backdrop-blur-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
            Progress
          </p>
          <ul className="mt-4 space-y-3">
            {items.map((item, i) => (
              <motion.li
                key={item.label}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.35 }}
                className="flex items-center gap-3 text-[14px]"
              >
                <span
                  className={
                    item.state === 'done'
                      ? 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700'
                      : item.state === 'active'
                        ? 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700'
                        : 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-400'
                  }
                  aria-hidden
                >
                  {item.state === 'done' ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  ) : item.state === 'active' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <span className="block h-1.5 w-1.5 rounded-full bg-stone-300" />
                  )}
                </span>
                <span
                  className={
                    item.state === 'done'
                      ? 'text-slate-700'
                      : item.state === 'active'
                        ? 'font-medium text-slate-900'
                        : 'text-slate-400'
                  }
                >
                  {item.label}
                </span>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

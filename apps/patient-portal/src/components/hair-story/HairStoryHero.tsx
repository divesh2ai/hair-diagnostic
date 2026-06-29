'use client';

import { useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  videoUrl: string;
  thumbnailUrl: string | null;
  onViewReport: () => void;
}

/**
 * Video-first hero. The doctor briefing IS the result — the patient sees
 * this first, the structured report waits one click away.
 */
export function HairStoryHero({ videoUrl, thumbnailUrl, onViewReport }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasStarted, setHasStarted] = useState(false);

  const handleWatch = () => {
    const v = videoRef.current;
    if (!v) return;
    setHasStarted(true);
    v.play().catch(() => {});
  };

  return (
    <section
      className="relative overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_8px_40px_-20px_rgba(15,23,42,0.18)]"
      style={{
        background:
          'radial-gradient(120% 80% at 80% -10%, rgba(255, 207, 178, 0.45) 0%, transparent 60%),' +
          'radial-gradient(110% 70% at 0% 110%, rgba(214, 211, 245, 0.4) 0%, transparent 55%),' +
          'linear-gradient(180deg, #fbf7f1 0%, #ffffff 100%)',
      }}
    >
      <div className="px-6 py-10 sm:px-10 sm:py-14">
        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500/80">
          Your personalized briefing
        </p>
        <h1
          className="mt-3 font-serif text-[clamp(1.85rem,4vw,2.6rem)] font-medium leading-[1.15] tracking-tight text-slate-900"
          style={{ textWrap: 'balance' as const }}
        >
          Your Hair Story Is Ready
        </h1>

        <div className="relative mt-8 overflow-hidden rounded-2xl border border-stone-200 bg-slate-950">
          <video
            ref={videoRef}
            src={videoUrl}
            poster={thumbnailUrl ?? undefined}
            controls={hasStarted}
            playsInline
            className="block aspect-video w-full"
            preload="metadata"
          />
          {!hasStarted && (
            <button
              type="button"
              onClick={handleWatch}
              className="absolute inset-0 flex items-center justify-center bg-slate-950/30 transition hover:bg-slate-950/20"
              aria-label="Play your hair story"
            >
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/95 shadow-lg ring-1 ring-black/5 backdrop-blur-sm">
                <Play className="h-9 w-9 translate-x-0.5 text-slate-900" fill="currentColor" />
              </span>
            </button>
          )}
        </div>

        <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <Button
            size="lg"
            onClick={handleWatch}
            className="rounded-full bg-slate-900 px-6 text-white hover:bg-slate-800"
          >
            <Play className="mr-2 h-4 w-4" fill="currentColor" />
            Watch My Hair Story
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={onViewReport}
            className="rounded-full border-stone-300 px-6"
          >
            View Intelligence Report
          </Button>
        </div>
      </div>
    </section>
  );
}

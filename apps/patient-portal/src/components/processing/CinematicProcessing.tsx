'use client';

/**
 * HairOS — Report Preparation Experience
 *
 * The patient sees this while the orchestrator builds their report in the
 * background. The layout is deliberately *calm*, not narrative:
 *
 *  • Four real phases mapped 1:1 to the pipeline. The user never finishes
 *    ahead of the backend; if a stage takes longer, the headline simply
 *    stays — no fake progress, no looping spinner anxiety.
 *  • A single editorial motif (the "bloom" of concentric rings) warms and
 *    fills as phases complete. SVG + framer-motion, no WebGL.
 *  • Daylight palette — cream, blush, warm gold. This is the moment before
 *    a patient sees their recovery plan; the tone should feel hopeful, not
 *    embattled.
 *  • Honest timing: ETA shows a calmly worded range that reflects which
 *    real phase is active, not a countdown.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseAssessmentStatusResponse } from '@/lib/adapters/assessmentAdapter';
import { safeArray } from '@/lib/safeData';

interface Props {
  assessmentId: string;
  clinicSlug: string;
  previewToken?: string | null;
}

/* ─── Phase model ─────────────────────────────────────────────────────────── */

type PhaseIndex = 0 | 1 | 2 | 3 | 4 | 5; // 0 = warming up, 1-5 = real phases, after 5 = done

interface PhaseCopy {
  eyebrow: string;
  head: string;
  sub: string;
  /** Honest, calm ETA copy. Not a timer. */
  eta: string;
}

const PHASES: Record<Exclude<PhaseIndex, 0>, PhaseCopy> = {
  1: {
    eyebrow: 'Step 1 of 5',
    head: 'Reading your responses',
    sub: 'Translating your answers into clinical signals.',
    eta: 'This usually takes under a minute.',
  },
  2: {
    eyebrow: 'Step 2 of 5',
    head: 'Mapping your hair biology',
    sub: 'Connecting stress, hormones, scalp, and nutrition into one picture.',
    eta: 'Just a few moments more.',
  },
  3: {
    eyebrow: 'Step 3 of 5',
    head: 'Designing your protocol',
    sub: 'Matching the right therapies to your unique profile.',
    eta: 'Almost there.',
  },
  4: {
    eyebrow: 'Step 4 of 5',
    head: 'Composing your doctor briefing',
    sub: 'Writing the narrative your doctor avatar will deliver.',
    eta: 'Any moment now.',
  },
  5: {
    eyebrow: 'Step 5 of 5',
    head: 'Rendering your personalized video',
    sub: 'Bringing your hair story to life.',
    eta: '30–90 seconds.',
  },
};

const WARMUP_COPY: PhaseCopy = {
  eyebrow: 'Preparing',
  head: 'Preparing your assessment',
  sub: 'Getting everything in place.',
  eta: 'This will start in a moment.',
};

const DONE_COPY: PhaseCopy = {
  eyebrow: 'Ready',
  head: 'Your report is ready',
  sub: 'Opening your recovery plan.',
  eta: '',
};

/**
 * Real orchestration stages mapped to the four patient-facing phases. We
 * accept both lowercase log stage names and uppercase DB status enums.
 */
function stageToPhase(stage: string | undefined): PhaseIndex {
  if (!stage) return 0;
  const s = stage.toLowerCase();
  if (s === 'complete') return 5;
  if (s === 'videorender' || s.includes('rendering_video') || s === 'pdf' || s === 'visual') return 5;
  if (s === 'videoscript' || s.includes('generating_video_script')) return 4;
  if (s === 'narratives' || s.includes('generating_narrative')) return 4;
  if (s === 'recommendations' || s.includes('generating_recommendations')) return 3;
  if (s === 'clinical' || s === 'therapy' || s.includes('running_clinical_engine')) return 2;
  if (s === 'normalize' || s.includes('normalizing') || s === 'queued') return 1;
  return 1;
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export function CinematicProcessing({ assessmentId, clinicSlug, previewToken }: Props) {
  const router = useRouter();

  const [phase, setPhase] = useState<PhaseIndex>(0);
  const [status, setStatus] = useState<string>('PROCESSING');
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [reduced, setReduced] = useState(false);

  const routedRef = useRef(false);

  /* Reduced-motion detection */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const h = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  /* Backend polling — the single source of truth for the phase. */
  const poll = useCallback(async () => {
    try {
      const tokenQs = previewToken ? `&t=${encodeURIComponent(previewToken)}` : '';
      const res = await fetch(`/api/assessment/status?id=${assessmentId}${tokenQs}`);
      if (!res.ok) throw new Error('Status unavailable');
      const data = parseAssessmentStatusResponse(await res.json());
      const s = data.status ?? 'PENDING';
      setStatus(s);

      const logs = safeArray<{ stage: string; status: string }>(data.orchestration?.logs);
      const lastRunning = [...logs].reverse().find((l) => l.status === 'RUNNING');
      const lastSuccess = [...logs].reverse().find((l) => l.status === 'SUCCESS');
      const stage = lastRunning?.stage ?? lastSuccess?.stage;

      // ── Done-gate ─────────────────────────────────────────────────────
      // Terminal status from the orchestrator is the source of truth: the
      // run is finished, so the patient should land on the result page.
      // The video block is incidental — if a doctor briefing video is ready
      // we still advance, but we never wait on it (the current Phase B
      // pipeline doesn't produce one).
      const videoState = (data as { video?: { state?: string } }).video?.state;
      const videoReady = videoState === 'READY';
      const statusCompleted = s === 'COMPLETED' || s === 'PARTIAL_FAILURE';

      if (videoReady || statusCompleted) {
        setPhase(5);
        setIsDone(true);
      } else {
        setPhase((prev) => {
          const next = stageToPhase(stage);
          // Never regress the phase (e.g. polling race during a stage transition).
          return next > prev ? next : prev;
        });
      }

      if (s === 'FAILED') {
        setError(data.errors?.[0] ?? 'Processing failed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection error');
    }
  }, [assessmentId, previewToken]);

  useEffect(() => {
    poll();
    const id = window.setInterval(poll, 2000);
    return () => window.clearInterval(id);
  }, [poll]);

  /* Soft hold on the "Ready" headline before routing — feels intentional. */
  useEffect(() => {
    if (!isDone || routedRef.current) return;
    routedRef.current = true;
    const id = window.setTimeout(() => {
      const tokenQs = previewToken ? `?t=${encodeURIComponent(previewToken)}` : '';
      router.push(`/q/${clinicSlug}/preview/${assessmentId}${tokenQs}`);
    }, 1100);
    return () => window.clearTimeout(id);
  }, [isDone, router, clinicSlug, assessmentId, previewToken]);

  const retry = async () => {
    setError(null);
    routedRef.current = false;
    setIsDone(false);
    await fetch('/api/assessment/orchestrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessmentId }),
    });
    poll();
  };

  const copy: PhaseCopy = isDone
    ? DONE_COPY
    : phase === 0
      ? WARMUP_COPY
      : PHASES[phase];

  const isFailed = status === 'FAILED' || !!error;

  return (
    <div
      className="relative min-h-[100dvh] w-full overflow-hidden text-slate-900"
      style={{
        // Dawn palette — cream base, warm peach lift at the top, soft lavender hush at the bottom.
        background:
          'radial-gradient(120% 80% at 80% -10%, rgba(255, 207, 178, 0.65) 0%, transparent 60%),' +
          'radial-gradient(110% 70% at 0% 110%, rgba(214, 211, 245, 0.55) 0%, transparent 55%),' +
          'linear-gradient(180deg, #fbf7f1 0%, #f6f5fb 100%)',
      }}
    >
      {/* Soft film grain — adds depth without being noisy */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-2xl flex-col items-center justify-center px-6 py-16">
        {/* Bloom motif */}
        <Bloom phase={phase} isDone={isDone} reduced={reduced} />

        {/* Caption stack */}
        <div className="mt-12 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={`copy-${isDone ? 'done' : phase}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-3"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500/80">
                {copy.eyebrow}
              </p>
              <h1
                className="font-display text-[clamp(1.65rem,3.6vw,2.35rem)] font-medium leading-[1.18] tracking-tight text-slate-900"
                style={{ textWrap: 'balance' as const }}
              >
                {copy.head}
              </h1>
              {copy.sub && (
                <p className="mx-auto max-w-md text-[15px] leading-relaxed text-slate-600">
                  {copy.sub}
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Step indicator */}
        <div className="mt-12 flex items-center gap-3">
          {[1, 2, 3, 4, 5].map((i) => {
            const filled = isDone || i < phase || (i === phase && phase > 0);
            const active = !isDone && i === phase;
            return (
              <span key={i} className="relative inline-flex h-2 items-center">
                <span
                  className={`block h-[3px] rounded-full transition-all duration-700 ease-out ${
                    filled
                      ? 'w-8 bg-slate-900/85'
                      : active
                        ? 'w-6 bg-slate-900/60'
                        : 'w-4 bg-slate-400/40'
                  }`}
                />
                {active && !reduced && (
                  <motion.span
                    aria-hidden
                    className="absolute -left-1 top-1/2 h-[3px] w-2 -translate-y-1/2 rounded-full bg-slate-900/40"
                    animate={{ x: [0, 24, 0] }}
                    transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity }}
                  />
                )}
              </span>
            );
          })}
        </div>

        {/* ETA — only while running */}
        {!isDone && !isFailed && copy.eta && (
          <p className="mt-6 text-[13px] text-slate-500/80">{copy.eta}</p>
        )}
      </div>

      {/* Error overlay */}
      {isFailed && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/85 backdrop-blur-md px-6">
          <div className="max-w-sm rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xl">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-rose-500" />
            <h2 className="text-lg font-semibold text-slate-900">We hit a snag</h2>
            <p className="mt-2 text-sm text-slate-600">{error ?? 'Processing failed.'}</p>
            <Button onClick={retry} className="mt-5 w-full rounded-full">
              <RotateCcw className="mr-2 h-4 w-4" /> Retry
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Bloom motif ─────────────────────────────────────────────────────────── */

/**
 * Four concentric soft rings. As phases advance, outer rings fill in and the
 * whole bloom warms from cool to warm. Center carries a subtle breathing
 * glow when running.
 *
 * SVG-only — no WebGL, no canvas. Crisp on every density.
 */
function Bloom({ phase, isDone, reduced }: { phase: PhaseIndex; isDone: boolean; reduced: boolean }) {
  // Ring colors warm as phases complete. Stops are: idle → warming → ready.
  const ringColors = useMemo(
    () => [
      { idle: '#e7e3df', warm: '#f4c5a8', ready: '#f0a07a' }, // outer
      { idle: '#ebe7e3', warm: '#f6cdb2', ready: '#eea27f' },
      { idle: '#efebe7', warm: '#f7d3bd', ready: '#eda787' },
      { idle: '#f2eee9', warm: '#f9d9c5', ready: '#ecae8e' }, // inner
    ],
    [],
  );

  // For phase=N, rings 1..N have "ready" color, ring N+1 has "warm", rest idle.
  const ringState = (ringIndex: number): 'idle' | 'warm' | 'ready' => {
    const indexFromOutside = ringIndex; // 0 outermost
    const completed = isDone ? 4 : Math.max(0, phase - 1); // rings fully ready
    if (indexFromOutside < completed) return 'ready';
    if (indexFromOutside === completed && phase > 0) return 'warm';
    return 'idle';
  };

  return (
    <div className="relative h-[260px] w-[260px] sm:h-[300px] sm:w-[300px]">
      {/* Soft glow halo behind the bloom */}
      <motion.div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(255, 180, 138, 0.40) 0%, rgba(255, 180, 138, 0) 70%)',
          filter: 'blur(8px)',
        }}
        animate={
          reduced
            ? { opacity: 0.7 }
            : { opacity: [0.55, 0.85, 0.55], scale: [1, 1.04, 1] }
        }
        transition={{ duration: 4.6, ease: 'easeInOut', repeat: Infinity }}
      />

      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="bloom-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor="#fff7ec" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#fcd9b8" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#f5b48a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="bloom-core-done" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor="#fff8e7" stopOpacity="1" />
            <stop offset="55%" stopColor="#ffd9a1" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#ffb37a" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer ring → inner ring. Radii descend in equal steps. */}
        {[88, 70, 53, 38].map((r, i) => {
          const state = ringState(i);
          const color =
            state === 'ready' ? ringColors[i].ready
            : state === 'warm' ? ringColors[i].warm
            : ringColors[i].idle;
          return (
            <motion.circle
              key={i}
              cx={100}
              cy={100}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={state === 'idle' ? 1.2 : 1.6}
              strokeOpacity={state === 'idle' ? 0.55 : 0.92}
              initial={false}
              animate={
                reduced
                  ? {}
                  : state === 'warm'
                    ? { strokeWidth: [1.6, 2.1, 1.6], strokeOpacity: [0.75, 1, 0.75] }
                    : {}
              }
              transition={{ duration: 2.4, ease: 'easeInOut', repeat: Infinity }}
            />
          );
        })}

        {/* Soft breathing core */}
        <motion.circle
          cx={100}
          cy={100}
          r={28}
          fill={`url(#${isDone ? 'bloom-core-done' : 'bloom-core'})`}
          initial={false}
          animate={
            reduced
              ? { scale: 1 }
              : { scale: [1, 1.08, 1] }
          }
          transition={{ duration: 3.4, ease: 'easeInOut', repeat: Infinity }}
          style={{ transformOrigin: '100px 100px' }}
        />
      </svg>
    </div>
  );
}

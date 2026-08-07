"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValueEvent,
  type MotionValue,
} from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  Wind,
  Droplets,
  Sun,
  Moon,
  Cigarette,
  Wine,
  Activity,
  Brain,
  Utensils,
  Zap,
  Radio,
  Thermometer,
  CloudFog,
  HeartPulse,
  Leaf,
  Sparkles,
} from "lucide-react";
import RosField from "./RosField";
import {
  ManhattanPlot,
  FollicleUnderPressure,
  FollicleCycle,
  ReceptorThreshold,
  SystemicBody,
  RestorationArc,
} from "./SceneArt";

/* ------------------------------------------------------------------ */
/*  Shared atoms                                                       */
/* ------------------------------------------------------------------ */

const serif = "font-[family-name:var(--font-fraunces)]";
const ease = [0.22, 1, 0.36, 1] as const;

/** Scroll progress (0→1) for a scene pinned across its own tall section. */
function useScene(ref: React.RefObject<HTMLElement | null>) {
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  return useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });
}

function SceneFrame({
  innerRef,
  length = "h-[240vh]",
  children,
}: {
  innerRef: React.RefObject<HTMLDivElement | null>;
  length?: string;
  children: React.ReactNode;
}) {
  return (
    <section ref={innerRef} className={`relative ${length}`}>
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="mx-auto w-full max-w-6xl px-6 md:px-10">{children}</div>
      </div>
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-sky-300/80">
      <span className="h-px w-8 bg-sky-400/50" />
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  ACT 1 — Hero                                                       */
/* ------------------------------------------------------------------ */

function ActHero({ showScrollHint }: { showScrollHint: boolean }) {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden">
      <div className="mx-auto w-full max-w-6xl px-6 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease }}
        >
          <Eyebrow>A new understanding of hair loss</Eyebrow>
          <h1
            className={`${serif} max-w-4xl text-balance text-5xl font-light leading-[1.04] tracking-tight text-white md:text-7xl lg:text-[5.25rem]`}
          >
            Your hair loss is <span className="italic text-sky-300">not</span> the story you were
            told.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-white/60 md:text-xl">
            It now arrives <strong className="font-medium text-white/90">younger</strong>, with{" "}
            <strong className="font-medium text-white/90">no family history</strong>, and with
            perfectly <strong className="font-medium text-white/90">normal DHT</strong>. The modern
            epidemic of hair loss is far more{" "}
            <span className="text-sky-300">epigenetic</span> than it is genetic.
          </p>

          <div className="mt-12 flex flex-wrap items-center gap-3">
            {["Younger onset", "No family history", "Normal DHT"].map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm text-white/70 backdrop-blur-sm"
              >
                {t}
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      {showScrollHint && (
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 1 }}
        >
          <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">
            Scroll to understand why
          </span>
          <motion.div
            className="mx-auto mt-3 h-10 w-px bg-gradient-to-b from-sky-400/60 to-transparent"
            animate={{ scaleY: [0.4, 1, 0.4], opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "top" }}
          />
        </motion.div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  ACT 2 — Polygenic constellation                                    */
/* ------------------------------------------------------------------ */

function ActPolygenic() {
  const ref = useRef<HTMLDivElement>(null);
  const p = useScene(ref);
  const lift = useTransform(p, [0, 0.5], [40, 0]);
  const fade = useTransform(p, [0, 0.4], [0, 1]);

  return (
    <SceneFrame innerRef={ref} length="h-[280vh]">
      <div className="grid items-center gap-12 md:grid-cols-[0.9fr_1.1fr]">
        <motion.div style={{ opacity: fade, y: lift }}>
          <Eyebrow>What the GWAS data revealed</Eyebrow>
          <h2 className={`${serif} text-4xl font-light leading-tight text-white md:text-5xl`}>
            It was never a <span className="italic text-sky-300">single gene.</span>
          </h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-white/60">
            Genome-wide association studies confirmed that hair loss is{" "}
            <strong className="font-medium text-white/90">polygenic</strong> and{" "}
            <strong className="font-medium text-white/90">multifactorial</strong> — driven not by
            one gene but by a whole network of genes that interact with hormonal, metabolic,
            lifestyle, and environmental forces.
          </p>
        </motion.div>

        <ManhattanPlot progress={p} />
      </div>
    </SceneFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  ACT 3 — The modern factors                                         */
/* ------------------------------------------------------------------ */

const LIFESTYLE = [
  { icon: Brain, label: "Stress" },
  { icon: Moon, label: "Sleep" },
  { icon: Cigarette, label: "Smoking" },
  { icon: Wine, label: "Alcohol" },
  { icon: Activity, label: "Exercise" },
  { icon: Activity, label: "Sedentary life" },
  { icon: Zap, label: "Fatigue & exhaustion" },
  { icon: Utensils, label: "Diet & nutrition" },
];

const ENVIRONMENT = [
  { icon: CloudFog, label: "Pollution" },
  { icon: Sun, label: "UV rays" },
  { icon: Droplets, label: "Hard water" },
  { icon: Thermometer, label: "Temperature & humidity" },
  { icon: Moon, label: "Circadian rhythm" },
  { icon: Wind, label: "Seasonal changes" },
  { icon: Radio, label: "Electromagnetic radiation" },
];

function FactorChip({
  icon: Icon,
  label,
  tone,
}: {
  icon: typeof Brain;
  label: string;
  tone: "amber" | "sky";
}) {
  return (
    <span
      className={`inline-flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-sm text-white/75 backdrop-blur-sm transition-colors ${
        tone === "amber"
          ? "border-amber-300/15 bg-amber-300/[0.05] hover:border-amber-300/35"
          : "border-sky-300/15 bg-sky-300/[0.05] hover:border-sky-300/35"
      }`}
    >
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
          tone === "amber" ? "bg-amber-300/10" : "bg-sky-300/10"
        }`}
      >
        <Icon
          className={`h-3.5 w-3.5 ${tone === "amber" ? "text-amber-300" : "text-sky-300"}`}
        />
      </span>
      <span className="leading-tight">{label}</span>
    </span>
  );
}

function ActFactors() {
  const ref = useRef<HTMLDivElement>(null);
  const p = useScene(ref);
  const headFade = useTransform(p, [0, 0.18], [0, 1]);
  const headLift = useTransform(p, [0, 0.18], [30, 0]);
  const colA = useTransform(p, [0.2, 0.55], [0, 1]);
  const colB = useTransform(p, [0.45, 0.8], [0, 1]);

  return (
    <SceneFrame innerRef={ref} length="h-[300vh]">
      <motion.div style={{ opacity: headFade, y: headLift }} className="max-w-2xl">
        <Eyebrow>The forces your genes answer to</Eyebrow>
        <h2 className={`${serif} text-4xl font-light leading-tight text-white md:text-5xl`}>
          Your <span className="italic text-sky-300">life</span> is now part of the equation.
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-white/60">
          The same genes respond, every day, to how you live and where you live. Each factor nudges
          the follicle a little further from health.
        </p>
      </motion.div>

      <div className="mt-10 grid items-center gap-8 md:grid-cols-[1fr_auto_1fr]">
        <motion.div style={{ opacity: colA }}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-amber-300/80">
            Lifestyle
          </p>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
            {LIFESTYLE.map((f) => (
              <FactorChip key={f.label} icon={f.icon} label={f.label} tone="amber" />
            ))}
          </div>
        </motion.div>

        <div className="order-first md:order-none">
          <FollicleUnderPressure progress={p} />
        </div>

        <motion.div style={{ opacity: colB }}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-sky-300/80">
            Environment
          </p>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
            {ENVIRONMENT.map((f) => (
              <FactorChip key={f.label} icon={f.icon} label={f.label} tone="sky" />
            ))}
          </div>
        </motion.div>
      </div>
    </SceneFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  ACT 4 — It targets the weakest first                               */
/* ------------------------------------------------------------------ */

function ActWeakest() {
  const ref = useRef<HTMLDivElement>(null);
  const p = useScene(ref);
  const fade = useTransform(p, [0, 0.3], [0, 1]);
  const lift = useTransform(p, [0, 0.3], [30, 0]);

  return (
    <SceneFrame innerRef={ref} length="h-[280vh]">
      <div className="grid items-center gap-12 md:grid-cols-2">
        <motion.div style={{ opacity: fade, y: lift }}>
          <Eyebrow>Selective, progressive damage</Eyebrow>
          <h2 className={`${serif} text-4xl font-light leading-tight text-white md:text-5xl`}>
            It attacks the <span className="italic text-amber-300">weakest</span> hairs first.
          </h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-white/60">
            The damage doesn&apos;t touch every strand. It progressively wears down the{" "}
            <strong className="font-medium text-white/90">weak, inactive, resting</strong> hairs —
            stretching the telogen phase and quietly preventing the next{" "}
            <strong className="font-medium text-white/90">anagen</strong> from ever beginning.
          </p>
          <div className="mt-8 flex gap-6 text-sm">
            <span className="flex items-center gap-2 text-white/60">
              <span className="h-3 w-1 rounded-full bg-emerald-400" /> Active, healthy
            </span>
            <span className="flex items-center gap-2 text-white/60">
              <span className="h-3 w-1 rounded-full bg-amber-400/60" /> Resting, vulnerable
            </span>
          </div>
        </motion.div>

        <FollicleCycle progress={p} />
      </div>
    </SceneFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  ACT 5 — ROS: the common pathway (keystone)                         */
/* ------------------------------------------------------------------ */

const ROS_DRIVERS = [
  "Stress",
  "Inflammation",
  "Immunity & autoimmunity",
  "DNA damage",
  "Early aging",
  "Epigenetic changes",
];

function DriverChip({
  label,
  index,
  progress,
}: {
  label: string;
  index: number;
  progress: MotionValue<number>;
}) {
  const opacity = useTransform(
    progress,
    [0.35 + index * 0.04, 0.5 + index * 0.04],
    [0, 1]
  );
  return (
    <motion.span
      style={{ opacity }}
      className="rounded-full border border-amber-400/20 bg-amber-400/[0.06] px-3 py-1.5 text-sm text-amber-100/80"
    >
      {label}
    </motion.span>
  );
}

function ActROS() {
  const ref = useRef<HTMLDivElement>(null);
  const p = useScene(ref);
  const fade = useTransform(p, [0, 0.2], [0, 1]);
  const lift = useTransform(p, [0, 0.2], [30, 0]);

  return (
    <SceneFrame innerRef={ref} length="h-[340vh]">
      <div className="grid items-center gap-12 md:grid-cols-[1.1fr_1fr]">
        <motion.div style={{ opacity: fade, y: lift }}>
          <Eyebrow>The single mechanism underneath it all</Eyebrow>
          <h2 className={`${serif} text-4xl font-light leading-[1.1] text-white md:text-5xl`}>
            Nearly every cause converges on one molecule:{" "}
            <span className="italic text-amber-300">ROS.</span>
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-white/60">
            Metabolic damage is mediated through the generation of{" "}
            <strong className="font-medium text-white/90">reactive oxygen species (ROS)</strong>.
            DHT acts through <strong className="font-medium text-white/90">TGF-β</strong> — which is{" "}
            <em>also</em> switched on by ROS.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-white/60">
            As ROS accumulates, it{" "}
            <strong className="font-medium text-amber-200">
              lowers the sensitivity threshold of the androgen receptors
            </strong>
            , making them vulnerable to entirely <em>normal</em> levels of DHT.
          </p>

          <div className="mt-7">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-white/40">
              All of these act through ROS
            </p>
            <div className="flex flex-wrap gap-2">
              {ROS_DRIVERS.map((d, i) => (
                <DriverChip key={d} label={d} index={i} progress={p} />
              ))}
            </div>
          </div>
        </motion.div>

        <ReceptorThreshold progress={p} />
      </div>
    </SceneFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  ACT 6 — It doesn't stop at hair                                    */
/* ------------------------------------------------------------------ */

const SYSTEMS = [
  { icon: HeartPulse, label: "Cardiac disorders" },
  { icon: Activity, label: "Insulin resistance" },
  { icon: Droplets, label: "Dyslipidemias" },
  { icon: Zap, label: "Metabolic syndrome" },
];

function SystemCard({
  icon: Icon,
  label,
  index,
  progress,
}: {
  icon: typeof HeartPulse;
  label: string;
  index: number;
  progress: MotionValue<number>;
}) {
  const opacity = useTransform(progress, [0.3 + index * 0.08, 0.55 + index * 0.08], [0, 1]);
  const y = useTransform(progress, [0.3 + index * 0.08, 0.55 + index * 0.08], [24, 0]);
  return (
    <motion.div
      style={{ opacity, y }}
      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-400/10">
        <Icon className="h-4 w-4 text-rose-300/90" />
      </span>
      <p className="text-sm font-medium leading-tight text-white/80">{label}</p>
    </motion.div>
  );
}

function ActSystemic() {
  const ref = useRef<HTMLDivElement>(null);
  const p = useScene(ref);
  const fade = useTransform(p, [0, 0.25], [0, 1]);
  const lift = useTransform(p, [0, 0.25], [30, 0]);

  return (
    <SceneFrame innerRef={ref} length="h-[260vh]">
      <div className="grid items-center gap-10 md:grid-cols-[1fr_auto]">
        <div>
          <motion.div style={{ opacity: fade, y: lift }}>
            <Eyebrow>The same damage, beyond the scalp</Eyebrow>
            <h2 className={`${serif} text-4xl font-light leading-tight text-white md:text-5xl`}>
              Hair is the <span className="italic text-sky-300">visible</span> signal of a deeper
              imbalance.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/60">
              The oxidative damage radiates outward — carrying an associated risk of broader
              metabolic disease.
            </p>
          </motion.div>

          <div className="mt-10 grid grid-cols-2 gap-3">
            {SYSTEMS.map((s, i) => (
              <SystemCard key={s.label} icon={s.icon} label={s.label} index={i} progress={p} />
            ))}
          </div>
          <p className="mt-7 max-w-xl text-sm italic text-white/40">
            An association rooted in shared metabolic pathways — your hair may be the earliest place
            it shows.
          </p>
        </div>

        <SystemicBody progress={p} />
      </div>
    </SceneFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  ACT 7 — The reversal + CTA                                         */
/* ------------------------------------------------------------------ */

const BENEFITS = [
  "Neutralize ROS",
  "Repair cellular damage",
  "Promote active metabolism",
  "Restore hair growth & wellness",
];

function ActReversal({ ctaHref, ctaLabel }: { ctaHref: string; ctaLabel: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const p = useScene(ref);
  const fade = useTransform(p, [0, 0.25], [0, 1]);
  const lift = useTransform(p, [0, 0.25], [40, 0]);
  const glow = useTransform(p, [0.2, 0.7], [0.1, 0.5]);

  return (
    <SceneFrame innerRef={ref} length="h-[260vh]">
      {/* The pinned frame clips its overflow and this scene is the tallest, so
          on short viewports it scales down rather than losing the arc or CTA. */}
      <div className="relative mx-auto max-w-3xl text-center [@media(min-height:601px)_and_(max-height:700px)]:scale-[0.88] [@media(max-height:600px)]:scale-[0.76]">
        <motion.div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            opacity: glow,
            background: "radial-gradient(circle, rgba(52,211,153,0.25), transparent 65%)",
          }}
        />
        <motion.div style={{ opacity: fade, y: lift }} className="relative">
          <div className="flex justify-center">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
              <Leaf className="h-3.5 w-3.5" /> The reversal
            </span>
          </div>
          <h2 className={`${serif} text-4xl font-light leading-[1.1] text-white md:text-5xl`}>
            What ROS damages,{" "}
            <span className="italic text-emerald-300">nutrients can restore.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/65 md:text-lg">
            The right nutrients neutralize ROS, repair the cellular damage, and reawaken active
            metabolism — restoring hair growth alongside whole-body wellness.
          </p>
          <p className="mx-auto mt-3 max-w-xl text-base font-medium leading-relaxed text-white/90 md:text-lg">
            Without anti-androgens. Without side effects.
          </p>

          <div className="mt-6">
            <RestorationArc progress={p} />
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {BENEFITS.map((b) => (
              <span
                key={b}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-2 text-sm text-emerald-100/90"
              >
                <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                {b}
              </span>
            ))}
          </div>

          <div className="mt-7">
            <Link
              href={ctaHref}
              className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-white px-9 py-4 text-base font-semibold text-[#0a0f14] shadow-[0_0_40px_-8px_rgba(52,211,153,0.6)] transition-all hover:-translate-y-0.5 hover:bg-emerald-50"
            >
              {ctaLabel}
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <p className="mt-4 text-sm text-white/40">
              Discover the root causes behind <em>your</em> hair loss — in about 3 minutes.
            </p>
          </div>
        </motion.div>
      </div>
    </SceneFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  Orchestrator                                                       */
/* ------------------------------------------------------------------ */

export interface RootCauseStoryProps {
  /** Where the closing CTA leads (e.g. the assessment route). */
  ctaHref: string;
  ctaLabel?: string;
  /** Optional back link shown top-left (used on the clinic deep-dive route). */
  backHref?: string;
  backLabel?: string;
  showScrollHint?: boolean;
}

const HUES = [195, 200, 38, 35, 28, 350, 152]; // cyan → amber → rose → emerald

export default function RootCauseStory({
  ctaHref,
  ctaLabel = "Start your assessment",
  backHref,
  backLabel = "Back",
  showScrollHint = true,
}: RootCauseStoryProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: rootRef });

  // Re-tint the ambient particle field as the narrative progresses.
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const seg = Math.min(HUES.length - 1, Math.floor(v * HUES.length));
    const next = Math.min(HUES.length - 1, seg + 1);
    const local = v * HUES.length - seg;
    const hue = HUES[seg] + (HUES[next] - HUES[seg]) * local;
    rootRef.current?.style.setProperty("--ros-hue", String(hue));
  });

  const barWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <div
      ref={rootRef}
      className="relative bg-[#070b10] text-white"
      style={{ ["--ros-hue" as string]: "195" }}
    >
      {/* Ambient layers */}
      <RosField className="pointer-events-none fixed inset-0 z-0 opacity-70" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,rgba(56,189,248,0.12),transparent)]" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-transparent via-[#070b10]/30 to-[#070b10]" />

      {/* Top progress bar */}
      <motion.div
        className="fixed left-0 top-0 z-50 h-0.5 bg-gradient-to-r from-sky-400 via-amber-300 to-emerald-400"
        style={{ width: barWidth }}
      />

      {backHref && (
        <Link
          href={backHref}
          className="fixed left-5 top-5 z-50 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-4 py-2 text-sm text-white/70 backdrop-blur-md transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      )}

      {/* Narrative */}
      <div className="relative z-10">
        <ActHero showScrollHint={showScrollHint} />
        <ActPolygenic />
        <ActFactors />
        <ActWeakest />
        <ActROS />
        <ActSystemic />
        <ActReversal ctaHref={ctaHref} ctaLabel={ctaLabel} />
      </div>
    </div>
  );
}

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

const GENE_NODES = Array.from({ length: 26 }, (_, i) => {
  const a = (i / 26) * Math.PI * 2 + (i % 3);
  const rad = 30 + ((i * 37) % 60);
  return {
    x: 50 + Math.cos(a) * (rad / 2.4),
    y: 50 + Math.sin(a) * (rad / 2.4),
    d: (i % 5) * 0.12,
    hub: i % 7 === 0,
  };
});

function GeneNode({
  node,
  progress,
}: {
  node: (typeof GENE_NODES)[number];
  progress: MotionValue<number>;
}) {
  const opacity = useTransform(progress, [0.1 + node.d, 0.5 + node.d], [0, 1]);
  return (
    <motion.circle
      cx={node.x}
      cy={node.y}
      r={node.hub ? 2.1 : 1.1}
      fill={node.hub ? "rgb(125,211,252)" : "rgba(186,230,253,0.7)"}
      style={{ opacity }}
    />
  );
}

function ActPolygenic() {
  const ref = useRef<HTMLDivElement>(null);
  const p = useScene(ref);
  const lift = useTransform(p, [0, 0.5], [40, 0]);
  const fade = useTransform(p, [0, 0.4], [0, 1]);
  const netOpacity = useTransform(p, [0.15, 0.7], [0, 1]);
  const scale = useTransform(p, [0, 0.6], [0.9, 1]);

  return (
    <SceneFrame innerRef={ref}>
      <div className="grid items-center gap-12 md:grid-cols-2">
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

        <motion.div className="relative mx-auto aspect-square w-full max-w-md" style={{ scale }}>
          <svg viewBox="0 0 100 100" className="h-full w-full">
            <motion.g style={{ opacity: netOpacity }}>
              {GENE_NODES.map((n, i) =>
                GENE_NODES.slice(i + 1).map((m, j) => {
                  const dist = Math.hypot(n.x - m.x, n.y - m.y);
                  if (dist > 26) return null;
                  return (
                    <line
                      key={`${i}-${j}`}
                      x1={n.x}
                      y1={n.y}
                      x2={m.x}
                      y2={m.y}
                      stroke="rgba(56,189,248,0.18)"
                      strokeWidth={0.3}
                    />
                  );
                })
              )}
            </motion.g>
            {GENE_NODES.map((n, i) => (
              <GeneNode key={i} node={n} progress={p} />
            ))}
          </svg>
        </motion.div>
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
    <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white/75 backdrop-blur-sm">
      <Icon className={`h-4 w-4 ${tone === "amber" ? "text-amber-300/80" : "text-sky-300/80"}`} />
      {label}
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

      <div className="mt-12 grid gap-10 md:grid-cols-2">
        <motion.div style={{ opacity: colA }}>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-amber-300/80">
            Lifestyle
          </p>
          <div className="flex flex-wrap gap-2.5">
            {LIFESTYLE.map((f) => (
              <FactorChip key={f.label} icon={f.icon} label={f.label} tone="amber" />
            ))}
          </div>
        </motion.div>

        <motion.div style={{ opacity: colB }}>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-sky-300/80">
            Environment
          </p>
          <div className="flex flex-wrap gap-2.5">
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

const STRANDS = Array.from({ length: 30 }, (_, i) => ({
  weak: i % 3 === 0,
  h: 40 + ((i * 53) % 45),
  d: (i % 10) * 0.05,
}));

function Strand({
  strand,
  progress,
}: {
  strand: (typeof STRANDS)[number];
  progress: MotionValue<number>;
}) {
  const opacity = useTransform(
    progress,
    [0.2 + strand.d, 0.6 + strand.d],
    strand.weak ? [0.9, 0.18] : [0.9, 0.95]
  );
  const scaleY = useTransform(
    progress,
    [0.2 + strand.d, 0.65 + strand.d],
    strand.weak ? [1, 0.45] : [1, 1]
  );
  return (
    <motion.div
      className="w-1.5 rounded-full"
      style={{
        height: `${strand.h}%`,
        opacity,
        scaleY,
        transformOrigin: "bottom",
        background: strand.weak
          ? "linear-gradient(to top, rgba(251,191,36,0.7), rgba(251,191,36,0.1))"
          : "linear-gradient(to top, rgba(52,211,153,0.9), rgba(52,211,153,0.25))",
      }}
    />
  );
}

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

        <div className="flex h-64 items-end justify-center gap-1.5 md:h-80">
          {STRANDS.map((s, i) => (
            <Strand key={i} strand={s} progress={p} />
          ))}
        </div>
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
  const thresholdY = useTransform(p, [0.3, 0.75], ["0%", "62%"]);
  const rosGlow = useTransform(p, [0.3, 0.8], [0.15, 0.85]);
  const dhtFlash = useTransform(p, [0.7, 0.85, 1], [0, 1, 0.7]);

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

        {/* Receptor + threshold visual */}
        <div className="relative mx-auto h-80 w-full max-w-sm">
          <motion.div
            className="absolute inset-0 rounded-3xl"
            style={{
              opacity: rosGlow,
              background:
                "radial-gradient(circle at 50% 60%, rgba(251,146,60,0.22), transparent 70%)",
            }}
          />
          <div className="absolute inset-0 rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-sm" />
          <div className="relative flex h-full flex-col items-center justify-end p-6">
            <span className="absolute left-6 top-5 text-[11px] uppercase tracking-[0.2em] text-white/40">
              Androgen receptor
            </span>

            <motion.div
              className="absolute left-6 right-6 flex items-center gap-2"
              style={{ top: thresholdY }}
            >
              <span className="whitespace-nowrap text-[10px] font-medium uppercase tracking-wider text-amber-200/90">
                Sensitivity threshold
              </span>
              <span className="h-px flex-1 bg-amber-300/60" />
            </motion.div>

            <div className="absolute left-6 right-6 top-[62%] flex items-center gap-2">
              <motion.span
                style={{ opacity: dhtFlash }}
                className="whitespace-nowrap rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-200"
              >
                Normal DHT → now harmful
              </motion.span>
              <span className="h-px flex-1 border-t border-dashed border-rose-300/50" />
            </div>

            <div className="mb-2 h-24 w-24 rounded-full border border-amber-300/30 bg-gradient-to-br from-amber-400/20 to-rose-500/10" />
          </div>
        </div>
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
      className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm"
    >
      <Icon className="mx-auto h-6 w-6 text-rose-300/80" />
      <p className="mt-3 text-sm font-medium text-white/80">{label}</p>
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
      <div className="mx-auto max-w-3xl text-center">
        <motion.div style={{ opacity: fade, y: lift }}>
          <div className="flex justify-center">
            <Eyebrow>The same damage, beyond the scalp</Eyebrow>
          </div>
          <h2 className={`${serif} text-4xl font-light leading-tight text-white md:text-5xl`}>
            Hair is the <span className="italic text-sky-300">visible</span> signal of a deeper
            imbalance.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/60">
            The oxidative damage radiates outward — carrying an associated risk of broader metabolic
            disease.
          </p>
        </motion.div>

        <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
          {SYSTEMS.map((s, i) => (
            <SystemCard key={s.label} icon={s.icon} label={s.label} index={i} progress={p} />
          ))}
        </div>
        <p className="mt-8 text-sm italic text-white/40">
          An association rooted in shared metabolic pathways — your hair may be the earliest place
          it shows.
        </p>
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
      <div className="relative mx-auto max-w-3xl text-center">
        <motion.div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            opacity: glow,
            background: "radial-gradient(circle, rgba(52,211,153,0.25), transparent 65%)",
          }}
        />
        <motion.div style={{ opacity: fade, y: lift }} className="relative">
          <div className="flex justify-center">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
              <Leaf className="h-3.5 w-3.5" /> The reversal
            </span>
          </div>
          <h2 className={`${serif} text-4xl font-light leading-[1.1] text-white md:text-6xl`}>
            What ROS damages,{" "}
            <span className="italic text-emerald-300">nutrients can restore.</span>
          </h2>
          <p className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-white/65">
            The right nutrients neutralize ROS, repair the cellular damage, and reawaken active
            metabolism — restoring hair growth alongside whole-body wellness.
          </p>
          <p className="mx-auto mt-4 max-w-xl text-lg font-medium leading-relaxed text-white/90">
            Without anti-androgens. Without side effects.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-2.5">
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

          <div className="mt-12">
            <Link
              href={ctaHref}
              className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-white px-9 py-4 text-base font-semibold text-[#0a0f14] shadow-[0_0_40px_-8px_rgba(52,211,153,0.6)] transition-all hover:-translate-y-0.5 hover:bg-emerald-50"
            >
              {ctaLabel}
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <p className="mt-5 text-sm text-white/40">
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

"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";

/**
 * Bespoke scene artwork for the RootCauseStory narrative. Every figure is a
 * hand-built SVG driven by the scene's own scroll progress (0→1) so the
 * illustration *explains* rather than decorates.
 */

/* ------------------------------------------------------------------ */
/*  Deterministic noise — stable across server/client renders          */
/* ------------------------------------------------------------------ */

/** Round to a fixed precision. Trig differs in its last bits between the Node
 *  render and the browser, which shows up as a hydration mismatch on every
 *  coordinate attribute — quantizing makes both sides agree exactly. */
function q(n: number, dp = 3) {
  return Math.round(n * 10 ** dp) / 10 ** dp;
}

function rand(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return q(x - Math.floor(x), 5);
}

/* ------------------------------------------------------------------ */
/*  1. GWAS Manhattan plot — "it was never a single gene"              */
/* ------------------------------------------------------------------ */

const CHROMS = Array.from({ length: 11 }, (_, c) => ({
  c,
  // Each chromosome band carries a cluster of SNPs; a few break significance.
  snps: Array.from({ length: 26 }, (_, i) => {
    const s = c * 100 + i;
    const peak = (c * 7 + i) % 23 === 0;
    return {
      x: c * 36 + 6 + rand(s) * 30,
      // -log10(p): most noise near the floor, peaks punch through.
      y: peak ? 62 + rand(s + 1) * 30 : 4 + rand(s + 2) * 34,
      r: peak ? 2.6 : 1.5,
      peak,
      d: rand(s + 3) * 0.3,
    };
  }),
}));

const SIG_Y = 58; // genome-wide significance line, in plot units

function Snp({
  snp,
  chrom,
  progress,
}: {
  snp: (typeof CHROMS)[number]["snps"][number];
  chrom: number;
  progress: MotionValue<number>;
}) {
  const start = 0.08 + chrom * 0.045 + snp.d * 0.1;
  const opacity = useTransform(progress, [start, start + 0.14], [0, snp.peak ? 1 : 0.55]);
  const scale = useTransform(progress, [start, start + 0.14], [0, 1]);
  return (
    <motion.circle
      cx={snp.x}
      cy={100 - snp.y}
      r={snp.r}
      fill={
        snp.peak
          ? "rgb(125,211,252)"
          : chrom % 2 === 0
            ? "rgba(148,163,184,0.75)"
            : "rgba(56,189,248,0.5)"
      }
      style={{ opacity, scale, transformOrigin: `${snp.x}px ${100 - snp.y}px` }}
    />
  );
}

export function ManhattanPlot({ progress }: { progress: MotionValue<number> }) {
  const lineDraw = useTransform(progress, [0.05, 0.25], [0, 1]);
  const labelFade = useTransform(progress, [0.55, 0.75], [0, 1]);
  const frameFade = useTransform(progress, [0, 0.15], [0, 1]);

  return (
    <motion.div
      style={{ opacity: frameFade }}
      className="relative w-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm"
    >
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
          Genome-wide association
        </span>
        <span className="text-[10px] tracking-wide text-white/30">−log₁₀(p)</span>
      </div>

      <svg viewBox="0 0 404 112" className="h-auto w-full" role="img" aria-label="Manhattan plot showing many independent genetic loci associated with hair loss">
        {/* alternating chromosome bands */}
        {CHROMS.map((c) => (
          <rect
            key={`band-${c.c}`}
            x={c.c * 36}
            y={0}
            width={36}
            height={100}
            fill={c.c % 2 === 0 ? "rgba(255,255,255,0.018)" : "transparent"}
          />
        ))}

        {/* significance threshold — scaleX rather than pathLength, which needs
            a client-side getTotalLength() and breaks hydration. */}
        <motion.line
          x1={0}
          y1={100 - SIG_Y}
          x2={400}
          y2={100 - SIG_Y}
          stroke="rgba(251,191,36,0.55)"
          strokeWidth={0.7}
          strokeDasharray="4 4"
          style={{ scaleX: lineDraw, transformOrigin: "0px 0px" }}
        />
        <motion.text
          x={2}
          y={100 - SIG_Y - 3}
          fill="rgba(251,191,36,0.8)"
          fontSize={5}
          letterSpacing={0.4}
          style={{ opacity: lineDraw }}
        >
          SIGNIFICANCE
        </motion.text>

        {/* axis */}
        <line x1={0} y1={100} x2={400} y2={100} stroke="rgba(255,255,255,0.15)" strokeWidth={0.6} />

        {CHROMS.map((c) =>
          c.snps.map((s, i) => <Snp key={`${c.c}-${i}`} snp={s} chrom={c.c} progress={progress} />)
        )}

        {/* chromosome ticks */}
        {CHROMS.map((c) => (
          <text
            key={`t-${c.c}`}
            x={c.c * 36 + 18}
            y={109}
            fill="rgba(255,255,255,0.3)"
            fontSize={5}
            textAnchor="middle"
          >
            {c.c + 1}
          </text>
        ))}
      </svg>

      <motion.p style={{ opacity: labelFade }} className="mt-3 text-center text-xs text-white/45">
        Every spike above the line is an{" "}
        <span className="text-sky-300/90">independent locus</span> — dozens of them, scattered across
        the genome.
      </motion.p>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  2. Follicle under converging pressure — lifestyle + environment    */
/* ------------------------------------------------------------------ */

function PressureArrow({
  angle,
  progress,
  tone,
  index,
}: {
  angle: number;
  progress: MotionValue<number>;
  tone: "amber" | "sky";
  index: number;
}) {
  const start = 0.22 + index * 0.02;
  const opacity = useTransform(progress, [start, start + 0.2, 0.95], [0, 0.9, 0.9]);
  const rad = (angle * Math.PI) / 180;
  const outer = 92;
  const inner = 46;
  const x1 = q(110 + Math.cos(rad) * outer);
  const y1 = q(110 + Math.sin(rad) * outer);
  const x2 = q(110 + Math.cos(rad) * inner);
  const y2 = q(110 + Math.sin(rad) * inner);
  const head = (o: number) =>
    `${q(x2 + Math.cos(rad + o) * 5)},${q(y2 + Math.sin(rad + o) * 5)}`;
  const stroke = tone === "amber" ? "rgba(251,191,36,0.65)" : "rgba(56,189,248,0.6)";

  return (
    <motion.g style={{ opacity }}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={1} strokeLinecap="round" />
      <motion.circle
        r={1.8}
        fill={tone === "amber" ? "rgb(252,211,77)" : "rgb(125,211,252)"}
        animate={{
          cx: [x1, x2],
          cy: [y1, y2],
          opacity: [0, 1, 0],
        }}
        transition={{
          duration: 2.4,
          repeat: Infinity,
          delay: index * 0.18,
          ease: "easeIn",
        }}
      />
      <polygon points={`${x2},${y2} ${head(2.5)} ${head(-2.5)}`} fill={stroke} />
    </motion.g>
  );
}

export function FollicleUnderPressure({ progress }: { progress: MotionValue<number> }) {
  const strain = useTransform(progress, [0.2, 0.85], [1, 0.82]);
  const heat = useTransform(progress, [0.2, 0.9], [0.05, 0.4]);
  const coreFade = useTransform(progress, [0.08, 0.3], [0, 1]);

  // 8 lifestyle arrows on the upper arc, 7 environment on the lower arc.
  const lifestyle = Array.from({ length: 8 }, (_, i) => 190 + i * 22);
  const environment = Array.from({ length: 7 }, (_, i) => 10 + i * 22);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[300px]">
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          opacity: heat,
          background: "radial-gradient(circle, rgba(251,146,60,0.3), transparent 62%)",
        }}
      />
      <svg viewBox="0 0 220 220" className="h-full w-full" role="img" aria-label="A hair follicle at the centre of converging lifestyle and environmental forces">
        <defs>
          <linearGradient id="folStrand" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="rgba(52,211,153,0.9)" />
            <stop offset="100%" stopColor="rgba(52,211,153,0.05)" />
          </linearGradient>
          <radialGradient id="folBulb">
            <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
            <stop offset="100%" stopColor="rgba(52,211,153,0.25)" />
          </radialGradient>
        </defs>

        {/* pressure rings */}
        {[64, 82, 100].map((r, i) => (
          <circle
            key={r}
            cx={110}
            cy={110}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={0.6}
            strokeDasharray={i === 1 ? "2 5" : undefined}
          />
        ))}

        {lifestyle.map((a, i) => (
          <PressureArrow key={`l${a}`} angle={a} progress={progress} tone="amber" index={i} />
        ))}
        {environment.map((a, i) => (
          <PressureArrow key={`e${a}`} angle={a} progress={progress} tone="sky" index={i + 8} />
        ))}

        {/* the follicle itself */}
        <motion.g style={{ opacity: coreFade, scale: strain, transformOrigin: "110px 110px" }}>
          <circle cx={110} cy={110} r={38} fill="rgba(7,11,16,0.75)" />
          <circle cx={110} cy={110} r={38} fill="none" stroke="rgba(255,255,255,0.12)" />
          <path
            d="M110 142 C 104 126, 104 112, 110 96 C 116 112, 116 126, 110 142 Z"
            fill="url(#folStrand)"
          />
          <path d="M110 96 L110 78" stroke="url(#folStrand)" strokeWidth={2.4} strokeLinecap="round" />
          <circle cx={110} cy={140} r={6.5} fill="url(#folBulb)" />
        </motion.g>
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  3. Anagen / telogen — selective damage to resting hairs            */
/* ------------------------------------------------------------------ */

const FOLLICLES = Array.from({ length: 16 }, (_, i) => ({
  i,
  x: 14 + i * 24,
  h: 54 + rand(i) * 46,
  lean: (rand(i + 40) - 0.5) * 14,
  weak: i % 3 === 1,
  d: rand(i + 80) * 0.22,
}));

function Follicle({
  f,
  progress,
}: {
  f: (typeof FOLLICLES)[number];
  progress: MotionValue<number>;
}) {
  const start = 0.24 + f.d;
  const scaleY = useTransform(progress, [start, start + 0.4], [1, f.weak ? 0.28 : 1]);
  const opacity = useTransform(progress, [start, start + 0.4], [0.95, f.weak ? 0.3 : 1]);
  const bulbY = useTransform(progress, [start, start + 0.4], [0, f.weak ? -9 : 0]);
  const bulbR = useTransform(progress, [start, start + 0.4], [4.2, f.weak ? 2.4 : 4.6]);

  const baseY = 150;
  const tipY = baseY - f.h;
  const stroke = f.weak ? "rgba(251,191,36,0.85)" : "rgba(52,211,153,0.95)";

  return (
    <g>
      {/* dermal papilla, below the scalp line */}
      <motion.circle
        cx={f.x}
        cy={baseY + 12}
        r={bulbR}
        fill={f.weak ? "rgba(251,191,36,0.5)" : "rgba(52,211,153,0.6)"}
        style={{ y: bulbY }}
      />
      <motion.path
        d={`M${f.x} ${baseY} C ${f.x + f.lean} ${baseY - f.h * 0.45}, ${f.x + f.lean * 1.6} ${tipY + f.h * 0.25}, ${f.x + f.lean * 2} ${tipY}`}
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
        style={{ scaleY, opacity, transformOrigin: `${f.x}px ${baseY}px` }}
      />
    </g>
  );
}

export function FollicleCycle({ progress }: { progress: MotionValue<number> }) {
  const anagenFade = useTransform(progress, [0.55, 0.8], [1, 0.25]);
  const telogenFade = useTransform(progress, [0.55, 0.8], [0.25, 1]);

  return (
    <div className="relative mx-auto w-full max-w-md">
      <svg viewBox="0 0 400 180" className="h-auto w-full" role="img" aria-label="Weak resting hairs shrinking while active hairs remain intact">
        <defs>
          <linearGradient id="scalp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.09)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        {FOLLICLES.map((f) => (
          <Follicle key={f.i} f={f} progress={progress} />
        ))}

        {/* scalp surface */}
        <rect x={0} y={150} width={400} height={30} fill="url(#scalp)" />
        <line x1={0} y1={150} x2={400} y2={150} stroke="rgba(255,255,255,0.22)" strokeWidth={0.8} />

        {/* phase markers */}
        <motion.g style={{ opacity: anagenFade }}>
          <text x={4} y={14} fill="rgba(52,211,153,0.85)" fontSize={7} letterSpacing={1}>
            ANAGEN — growing
          </text>
        </motion.g>
        <motion.g style={{ opacity: telogenFade }}>
          <text x={396} y={14} fill="rgba(251,191,36,0.9)" fontSize={7} letterSpacing={1} textAnchor="end">
            TELOGEN — stretched, stalled
          </text>
        </motion.g>
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  4. Androgen receptor threshold gate                                */
/* ------------------------------------------------------------------ */

const ROS_MOTES = Array.from({ length: 22 }, (_, i) => ({
  i,
  x: 24 + rand(i * 3) * 172,
  y: 120 + rand(i * 5) * 120,
  r: 1.6 + rand(i * 7) * 2.4,
  d: rand(i * 11),
}));

function RosMote({
  m,
  progress,
}: {
  m: (typeof ROS_MOTES)[number];
  progress: MotionValue<number>;
}) {
  const start = 0.28 + m.d * 0.3;
  const opacity = useTransform(progress, [start, start + 0.25], [0, 0.75]);
  return (
    <motion.circle
      cx={m.x}
      cy={m.y}
      r={m.r}
      fill="rgba(251,146,60,0.8)"
      style={{ opacity }}
      animate={{ cy: [m.y, m.y - 6, m.y] }}
      transition={{ duration: 3 + m.d * 2, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

/** A DHT molecule: a small hexagon that docks into the receptor pocket. */
function DhtMolecule({
  index,
  progress,
}: {
  index: number;
  progress: MotionValue<number>;
}) {
  const startX = 20 + index * 60;
  const start = 0.6 + index * 0.06;
  const opacity = useTransform(progress, [start, start + 0.12], [0, 1]);
  const y = useTransform(progress, [start, start + 0.3], [40, 88]);
  const fill = useTransform(progress, [start + 0.15, start + 0.3], [
    "rgba(186,230,253,0.9)",
    "rgba(253,164,175,0.95)",
  ]);

  return (
    <motion.g style={{ opacity, y }}>
      <motion.polygon
        points={`${startX},32 ${startX + 6},36 ${startX + 6},44 ${startX},48 ${startX - 6},44 ${startX - 6},36`}
        style={{ fill }}
        stroke="rgba(255,255,255,0.35)"
        strokeWidth={0.6}
      />
      <text x={startX} y={26} fill="rgba(255,255,255,0.4)" fontSize={5.5} textAnchor="middle">
        DHT
      </text>
    </motion.g>
  );
}

export function ReceptorThreshold({ progress }: { progress: MotionValue<number> }) {
  const thresholdY = useTransform(progress, [0.3, 0.78], [78, 148]);
  const glow = useTransform(progress, [0.3, 0.85], [0.08, 0.5]);
  const alarm = useTransform(progress, [0.72, 0.88], [0, 1]);
  const frame = useTransform(progress, [0.05, 0.25], [0, 1]);

  return (
    <motion.div style={{ opacity: frame }} className="relative mx-auto w-full max-w-sm">
      <motion.div
        className="absolute inset-0 rounded-3xl"
        style={{
          opacity: glow,
          background: "radial-gradient(circle at 50% 75%, rgba(251,146,60,0.35), transparent 70%)",
        }}
      />
      <div className="absolute inset-0 rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-sm" />

      <svg viewBox="0 0 220 260" className="relative h-auto w-full" role="img" aria-label="Rising ROS lowering the androgen receptor sensitivity threshold until normal DHT becomes harmful">
        <defs>
          <linearGradient id="cellFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(251,146,60,0.02)" />
            <stop offset="100%" stopColor="rgba(251,146,60,0.16)" />
          </linearGradient>
        </defs>

        <text x={12} y={16} fill="rgba(255,255,255,0.4)" fontSize={7} letterSpacing={1.4}>
          FOLLICLE CELL
        </text>

        {/* cell body */}
        <rect x={12} y={22} width={196} height={222} rx={18} fill="url(#cellFill)" />
        <rect x={12} y={22} width={196} height={222} rx={18} fill="none" stroke="rgba(255,255,255,0.09)" />

        {ROS_MOTES.map((m) => (
          <RosMote key={m.i} m={m} progress={progress} />
        ))}

        {[0, 1, 2].map((i) => (
          <DhtMolecule key={i} index={i} progress={progress} />
        ))}

        {/* androgen receptor — a pocket that the threshold sits inside */}
        <g>
          <path
            d="M78 150 L78 196 Q78 214 96 214 L124 214 Q142 214 142 196 L142 150"
            fill="none"
            stroke="rgba(255,255,255,0.28)"
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <text x={110} y={232} fill="rgba(255,255,255,0.45)" fontSize={7} textAnchor="middle" letterSpacing={1}>
            ANDROGEN RECEPTOR
          </text>
        </g>

        {/* the sensitivity threshold, sinking as ROS builds */}
        <motion.g style={{ y: thresholdY }}>
          <line x1={24} y1={0} x2={196} y2={0} stroke="rgba(251,191,36,0.85)" strokeWidth={1.2} />
          <text x={24} y={-5} fill="rgba(252,211,77,0.95)" fontSize={7} letterSpacing={0.8}>
            SENSITIVITY THRESHOLD
          </text>
        </motion.g>

        {/* normal DHT level — fixed; the threshold falls to meet it */}
        <line x1={24} y1={148} x2={196} y2={148} stroke="rgba(148,163,184,0.5)" strokeWidth={0.8} strokeDasharray="3 3" />
        <text x={196} y={144} fill="rgba(148,163,184,0.7)" fontSize={6.5} textAnchor="end">
          normal DHT level
        </text>

        <motion.g style={{ opacity: alarm }}>
          <rect x={54} y={156} width={112} height={16} rx={8} fill="rgba(244,63,94,0.22)" />
          <text x={110} y={167} fill="rgb(254,205,211)" fontSize={7} textAnchor="middle" fontWeight={600}>
            NORMAL DHT → NOW HARMFUL
          </text>
        </motion.g>
      </svg>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  5. Systemic signal — the damage radiating past the scalp           */
/* ------------------------------------------------------------------ */

export function SystemicBody({ progress }: { progress: MotionValue<number> }) {
  const bodyFade = useTransform(progress, [0.05, 0.3], [0, 1]);
  const spread = useTransform(progress, [0.25, 0.8], [0, 1]);

  return (
    <motion.div style={{ opacity: bodyFade }} className="relative mx-auto w-full max-w-[180px]">
      <svg viewBox="0 0 160 260" className="h-auto w-full" role="img" aria-label="Oxidative damage radiating from the scalp through the body">
        <defs>
          <linearGradient id="bodyG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(125,211,252,0.28)" />
            <stop offset="55%" stopColor="rgba(251,146,60,0.2)" />
            <stop offset="100%" stopColor="rgba(244,63,94,0.14)" />
          </linearGradient>
        </defs>

        {/* radiating waves from the scalp */}
        {[0, 1, 2].map((i) => (
          <motion.circle
            key={i}
            cx={80}
            cy={34}
            r={20}
            fill="none"
            stroke="rgba(251,146,60,0.5)"
            strokeWidth={1}
            style={{ opacity: spread }}
            animate={{ r: [18, 96], opacity: [0.5, 0] }}
            transition={{ duration: 3.6, repeat: Infinity, delay: i * 1.2, ease: "easeOut" }}
          />
        ))}

        {/* torso silhouette */}
        <path
          d="M80 12 C 92 12, 100 21, 100 33 C 100 45, 92 54, 80 54 C 68 54, 60 45, 60 33 C 60 21, 68 12, 80 12 Z"
          fill="url(#bodyG)"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={0.8}
        />
        <path
          d="M62 60 L98 60 C 118 60, 126 74, 128 96 L132 150 L118 154 L112 116 L112 176 C 112 210, 108 232, 104 250 L92 250 L86 176 L80 176 L74 250 L62 250 C 58 232, 54 210, 54 176 L54 116 L48 154 L34 150 L38 96 C 40 74, 48 60, 62 60 Z"
          fill="url(#bodyG)"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth={0.8}
        />

        {/* organ hotspots */}
        {[
          { x: 72, y: 92, delay: 0 },
          { x: 88, y: 116, delay: 0.6 },
          { x: 78, y: 140, delay: 1.2 },
        ].map((h, i) => (
          <motion.circle
            key={i}
            cx={h.x}
            cy={h.y}
            r={3}
            fill="rgb(253,164,175)"
            style={{ opacity: spread }}
            animate={{ opacity: [0.35, 1, 0.35], r: [2.4, 3.6, 2.4] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: h.delay, ease: "easeInOut" }}
          />
        ))}
      </svg>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  6. Restoration arc — ROS in, neutralised out                       */
/* ------------------------------------------------------------------ */

export function RestorationArc({ progress }: { progress: MotionValue<number> }) {
  const fade = useTransform(progress, [0.1, 0.35], [0, 1]);
  const heal = useTransform(progress, [0.3, 0.75], [0, 1]);
  const damaged = useTransform(progress, [0.3, 0.75], [1, 0.18]);

  return (
    <motion.div style={{ opacity: fade }} className="mx-auto w-full max-w-md">
      <svg viewBox="0 0 400 124" className="h-auto w-full" role="img" aria-label="A damaged follicle restored as nutrients neutralise reactive oxygen species">
        <defs>
          <linearGradient id="healG" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="rgba(52,211,153,1)" />
            <stop offset="100%" stopColor="rgba(52,211,153,0.1)" />
          </linearGradient>
          <linearGradient id="sickG" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="rgba(251,146,60,0.9)" />
            <stop offset="100%" stopColor="rgba(251,146,60,0.05)" />
          </linearGradient>
        </defs>

        {/* left: oxidised follicle */}
        <motion.g style={{ opacity: damaged }}>
          <path d="M70 104 C 64 88, 66 78, 70 66" stroke="url(#sickG)" strokeWidth={3} fill="none" strokeLinecap="round" />
          <circle cx={70} cy={108} r={5} fill="rgba(251,146,60,0.5)" />
          {[0, 1, 2, 3].map((i) => (
            <circle key={i} cx={54 + i * 11} cy={50 - (i % 2) * 8} r={2.4} fill="rgba(251,146,60,0.7)" />
          ))}
          <text x={70} y={120} fill="rgba(251,146,60,0.75)" fontSize={7} textAnchor="middle" letterSpacing={0.8}>
            ROS DAMAGE
          </text>
        </motion.g>

        {/* the nutrient corridor */}
        <motion.path
          d="M110 76 C 170 44, 230 44, 290 76"
          stroke="rgba(52,211,153,0.4)"
          strokeWidth={1}
          strokeDasharray="4 4"
          fill="none"
          style={{ opacity: heal }}
        />
        {[0, 1, 2].map((i) => (
          <motion.circle
            key={i}
            r={2.6}
            fill="rgb(110,231,183)"
            animate={{
              offsetDistance: ["0%", "100%"],
              opacity: [0, 1, 0],
            }}
            transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.8, ease: "linear" }}
            style={{ offsetPath: 'path("M110 76 C 170 44, 230 44, 290 76")' }}
          />
        ))}
        <motion.text
          x={200}
          y={36}
          fill="rgba(110,231,183,0.9)"
          fontSize={7.5}
          textAnchor="middle"
          letterSpacing={1.2}
          style={{ opacity: heal }}
        >
          NUTRIENT REPAIR
        </motion.text>

        {/* right: restored follicle */}
        <motion.g style={{ opacity: heal }}>
          <path d="M330 104 C 324 82, 326 66, 330 44" stroke="url(#healG)" strokeWidth={3.4} fill="none" strokeLinecap="round" />
          <path d="M330 104 C 340 84, 344 70, 348 52" stroke="url(#healG)" strokeWidth={2.4} fill="none" strokeLinecap="round" />
          <path d="M330 104 C 320 84, 316 70, 312 52" stroke="url(#healG)" strokeWidth={2.4} fill="none" strokeLinecap="round" />
          <circle cx={330} cy={108} r={6} fill="rgba(52,211,153,0.75)" />
          <text x={330} y={120} fill="rgba(110,231,183,0.85)" fontSize={7} textAnchor="middle" letterSpacing={0.8}>
            ACTIVE ANAGEN
          </text>
        </motion.g>

        <line x1={0} y1={112} x2={400} y2={112} stroke="rgba(255,255,255,0.12)" strokeWidth={0.6} />
      </svg>
    </motion.div>
  );
}

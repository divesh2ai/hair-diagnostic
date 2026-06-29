"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Play, ArrowRight, Sparkles, ChevronRight } from "lucide-react";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1605497788044-5a32c7078486?auto=format&fit=crop&w=1800&q=85";

const CHAPTERS = [
  {
    n: "Chapter 1",
    title: "What's Happening To My Hair?",
    sub: "Your pattern, mapped in clinical detail.",
    image:
      "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=900&q=80",
  },
  {
    n: "Chapter 2",
    title: "Why Is This Happening?",
    sub: "The biology beneath the surface.",
    image:
      "https://images.unsplash.com/photo-1559757175-08fdec6c2839?auto=format&fit=crop&w=900&q=80",
  },
  {
    n: "Chapter 3",
    title: "How We Rebuild Growth",
    sub: "A regeneration roadmap, sequenced for you.",
    image:
      "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=900&q=80",
  },
  {
    n: "Chapter 4",
    title: "Your Future Hair Journey",
    sub: "Month by month, what recovery looks like.",
    image:
      "https://images.unsplash.com/photo-1595163319827-ce152a3aa66e?auto=format&fit=crop&w=900&q=80",
  },
];

const INSIGHTS = [
  "Progressive Pattern Hair Loss",
  "Nutritional Deficiency Signals",
  "Elevated Inflammatory Activity",
  "Scalp Environment Stress",
  "Recovery Potential Remains Strong",
];

const fadeUp = {
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const },
};

export default function LandingPage() {
  return (
    <div
      className="min-h-screen overflow-x-hidden text-[#F8FAFC] font-[var(--font-jakarta)]"
      style={{
        background:
          "linear-gradient(180deg, #07111F 0%, #0A2540 38%, #1B4965 62%, #F8FAFC 100%)",
      }}
    >
      {/* Particle / biological network ambient layer */}
      <ParticleField />

      {/* Header */}
      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-8 py-7">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#00C2A8] shadow-[0_0_12px_#00C2A8]" />
          <span className="text-sm font-semibold uppercase tracking-[0.32em] text-white/90">
            HairOS
          </span>
        </div>
        <Link
          href="/sandbox"
          className="text-sm text-white/55 hover:text-white transition-colors"
        >
          Clinical QA
        </Link>
      </header>

      {/* HERO — full viewport */}
      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-88px)] max-w-7xl grid-cols-1 items-center gap-16 px-8 pb-24 lg:grid-cols-[1.05fr_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-1.5 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-[#F4B942]" />
            <span className="text-[11px] uppercase tracking-[0.28em] text-white/70">
              Personalized · HairOS Intelligence
            </span>
          </div>

          <h1 className="font-[var(--font-jakarta)] text-[56px] font-bold leading-[1.02] tracking-[-0.02em] md:text-[72px]">
            Your Hair
            <br />
            <span className="bg-gradient-to-r from-[#F4B942] via-[#FFD98A] to-[#00C2A8] bg-clip-text text-transparent">
              Story.
            </span>
          </h1>

          <p className="mt-7 max-w-xl text-[18px] leading-[1.7] text-white/65">
            Generated from your responses and analyzed through HairOS Intelligence —
            a personalized look at the pattern, biology, and recovery path
            shaped uniquely by you.
          </p>

          <div className="mt-10 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <Link
              href="/q/drfact-mumbai"
              className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full bg-white px-8 py-5 text-[15px] font-semibold text-[#0A2540] shadow-[0_20px_50px_-12px_rgba(0,194,168,0.5)] transition-all hover:shadow-[0_24px_60px_-10px_rgba(0,194,168,0.7)]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#00C2A8] to-[#0A2540] text-white">
                <Play className="h-4 w-4 fill-white" />
              </span>
              Watch My Hair Story
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>

            <div className="flex items-center gap-3 text-[13px] text-white/55">
              <div className="h-1 w-1 rounded-full bg-[#00C2A8]" />
              <span>8 minutes · No account required</span>
            </div>
          </div>

          {/* Inline micro-insights */}
          <div className="mt-14 grid max-w-lg grid-cols-3 gap-6 border-t border-white/10 pt-7">
            {[
              { label: "Clinical signals", value: "18+" },
              { label: "Root causes mapped", value: "10" },
              { label: "Audit-traced", value: "100%" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-2xl font-semibold text-white">{s.value}</div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/45">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Cinematic hero image */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <div className="absolute -inset-10 rounded-[3rem] bg-[radial-gradient(ellipse_at_center,rgba(0,194,168,0.25),transparent_70%)] blur-3xl" />
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-white/15 shadow-[0_50px_120px_-30px_rgba(0,0,0,0.9)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={HERO_IMAGE}
              alt="The opening scene of your hair story"
              className="h-full w-full object-cover"
            />
            {/* Cinematic gradients */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#07111F] via-[#07111F]/30 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-[#00C2A8]/12" />

            {/* Floating chapter badge */}
            <div className="absolute left-6 top-6 flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-4 py-2 backdrop-blur-xl">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F4B942] shadow-[0_0_8px_#F4B942]" />
              <span className="text-[11px] uppercase tracking-[0.26em] text-white/85">
                Now Playing · Prologue
              </span>
            </div>

            {/* Bottom caption strip */}
            <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/15 bg-black/35 px-5 py-4 backdrop-blur-xl">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[#00C2A8]">
                A documentary about you
              </div>
              <div className="mt-1.5 text-[15px] font-medium text-white">
                Crafted from your responses · narrated by your biology
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* PERSONAL INSIGHT — single premium card */}
      <section className="relative z-10 mx-auto max-w-6xl px-8 pb-32">
        <motion.div {...fadeUp}>
          <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-white/[0.04] p-10 backdrop-blur-2xl shadow-[0_40px_100px_-30px_rgba(0,0,0,0.7)] md:p-14">
            <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#00C2A8]/14 blur-3xl" />
            <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-[#F4B942]/10 blur-3xl" />

            <div className="relative grid gap-12 md:grid-cols-[auto_1fr] md:items-start">
              <div>
                <p className="text-[11px] uppercase tracking-[0.32em] text-[#00C2A8]">
                  HairOS · Discovery
                </p>
                <h2 className="mt-3 max-w-md text-[40px] font-bold leading-[1.05] tracking-[-0.01em] text-white md:text-[44px]">
                  What HairOS
                  <br />
                  Discovered
                </h2>
                <p className="mt-5 max-w-xs text-[15px] leading-[1.7] text-white/55">
                  Five signals stood out across your responses — the threads we follow
                  through the rest of your story.
                </p>
              </div>

              <ul className="relative space-y-2">
                {INSIGHTS.map((insight, i) => (
                  <motion.li
                    key={insight}
                    initial={{ opacity: 0, x: 16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{
                      duration: 0.6,
                      delay: i * 0.08,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="group flex items-center justify-between gap-6 border-b border-white/8 py-5 last:border-0"
                  >
                    <div className="flex items-center gap-5">
                      <span className="font-mono text-[12px] text-white/30">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-[20px] font-medium text-white md:text-[22px]">
                        {insight}
                      </span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-white/25 transition-all group-hover:translate-x-1 group-hover:text-[#00C2A8]" />
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      </section>

      {/* CHAPTERS — Netflix doc episodes */}
      <section className="relative z-10 mx-auto max-w-7xl px-8 pb-32">
        <motion.div {...fadeUp} className="mb-12 flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-[#00C2A8]">
              The Series
            </p>
            <h2 className="mt-3 text-[40px] font-bold leading-[1.05] tracking-[-0.01em] text-white md:text-[48px]">
              Four chapters.
              <br />
              <span className="text-white/55">One story — yours.</span>
            </h2>
          </div>
          <div className="hidden text-right text-[13px] text-white/45 md:block">
            Auto-plays in sequence
            <br />
            ~12 min total
          </div>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {CHAPTERS.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{
                duration: 0.7,
                delay: i * 0.1,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="group relative aspect-[3/4] cursor-pointer overflow-hidden rounded-2xl border border-white/12 shadow-[0_30px_60px_-25px_rgba(0,0,0,0.6)] transition-transform hover:-translate-y-1"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.image}
                alt={c.title}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-[#0A2540]/30" />

              {/* Play badge */}
              <div className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/30 backdrop-blur-md transition-all group-hover:bg-[#00C2A8] group-hover:border-[#00C2A8]">
                <Play className="h-4 w-4 fill-white text-white" />
              </div>

              <div className="absolute inset-x-0 bottom-0 p-6">
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#F4B942]">
                  {c.n}
                </div>
                <h3 className="mt-2 text-[22px] font-bold leading-tight text-white">
                  {c.title}
                </h3>
                <p className="mt-2 text-[13px] leading-[1.6] text-white/65">{c.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* LIGHT TRANSITION — closing CTA on light field */}
      <section className="relative z-10 pb-32 pt-12">
        <div className="mx-auto max-w-5xl px-8">
          <motion.div
            {...fadeUp}
            className="relative overflow-hidden rounded-[2rem] bg-white p-12 text-center shadow-[0_50px_120px_-30px_rgba(10,37,64,0.4)] md:p-20"
          >
            <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-[#00C2A8]/12 blur-3xl" />
            <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-[#F4B942]/14 blur-3xl" />

            <p className="relative text-[11px] uppercase tracking-[0.32em] text-[#00C2A8]">
              Premiere
            </p>
            <h2 className="relative mt-4 text-[44px] font-bold leading-[1.05] tracking-[-0.01em] text-[#0A2540] md:text-[56px]">
              Ready to meet
              <br />
              your hair?
            </h2>
            <p className="relative mx-auto mt-6 max-w-md text-[17px] leading-[1.7] text-[#1B4965]/70">
              Eight calm minutes. One personal documentary. A clearer path forward
              — written entirely about you.
            </p>
            <div className="relative mt-10 flex justify-center">
              <Link
                href="/q/drfact-mumbai"
                className="group inline-flex items-center gap-3 rounded-full bg-[#0A2540] px-9 py-5 text-[15px] font-semibold text-white shadow-[0_20px_50px_-12px_rgba(10,37,64,0.6)] transition-all hover:bg-[#1B4965]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00C2A8]">
                  <Play className="h-4 w-4 fill-white text-white" />
                </span>
                Start My Hair Recovery Journey
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </motion.div>

          <p className="mt-10 text-center text-[12px] uppercase tracking-[0.28em] text-[#0A2540]/45">
            HairOS — The operating system for AI-powered hair recovery clinics.
          </p>
        </div>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Ambient biological-network particle field                                  */
/* -------------------------------------------------------------------------- */
function ParticleField() {
  const points = Array.from({ length: 28 }, (_, i) => ({
    id: i,
    x: (i * 173) % 100,
    y: (i * 89) % 100,
    delay: (i % 8) * 0.6,
    duration: 6 + (i % 5),
  }));

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.35]"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <defs>
          <radialGradient id="dot" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00C2A8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#00C2A8" stopOpacity="0" />
          </radialGradient>
        </defs>
        {points.map((p, i) => {
          const next = points[(i + 3) % points.length];
          return (
            <g key={p.id}>
              <line
                x1={p.x}
                y1={p.y}
                x2={next.x}
                y2={next.y}
                stroke="#00C2A8"
                strokeOpacity="0.08"
                strokeWidth="0.08"
              />
              <circle cx={p.x} cy={p.y} r="0.35" fill="url(#dot)">
                <animate
                  attributeName="opacity"
                  values="0.2;1;0.2"
                  dur={`${p.duration}s`}
                  begin={`${p.delay}s`}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          );
        })}
      </svg>

      {/* Slow moving glows */}
      <motion.div
        className="absolute h-[700px] w-[700px] rounded-full bg-[#00C2A8]/8 blur-3xl"
        animate={{ x: [-100, 80, -100], y: [-80, 60, -80] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
        style={{ top: "5%", left: "55%" }}
      />
      <motion.div
        className="absolute h-[600px] w-[600px] rounded-full bg-[#F4B942]/8 blur-3xl"
        animate={{ x: [60, -60, 60], y: [60, -40, 60] }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
        style={{ top: "30%", left: "-10%" }}
      />
    </div>
  );
}

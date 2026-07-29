'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAssessmentStore } from '@/stores/useAssessmentStore';
import { MotionConfig, motion } from 'framer-motion';
import {
  ArrowRight,
  Atom,
  Clock,
  FlaskConical,
  Leaf,
  Lock,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from 'lucide-react';

import type { ClinicLandingData } from '@/lib/clinics/getClinicLandingData';

/* ── DR. FACT palette ──────────────────────────────────────────── */
const INK = '#081209';
const DEEP = '#0C1B12';
const PANEL = '#10241A';
const LINE = 'rgba(219,197,140,0.14)';
const GOLD = '#D9BC7A';
const GOLD_SOFT = '#F0DCA8';
const CREAM = '#F4EFE2';
const MUTED = 'rgba(214,222,208,0.62)';

const RESULTS = [
  { id: 'female-case', sex: 'Female', before: '/results/female-32-before.jpg', after: '/results/female-32-after.jpg', width: 900, height: 675 },
  { id: 'male-case', sex: 'Male', before: '/results/male-35-before.jpg', after: '/results/male-35-after.jpg', width: 900, height: 600 },
];

const HERO_PARTICLES = [
  { left: '12%', top: '18%', delay: 0.2 }, { left: '78%', top: '14%', delay: 1.1 },
  { left: '18%', top: '68%', delay: 1.8 }, { left: '86%', top: '58%', delay: 0.7 },
  { left: '52%', top: '82%', delay: 1.4 },
] as const;

const FEATURES = [
  { icon: Atom, title: 'Root-Cause Analysis', body: 'Identify the signals and likely drivers behind the patient’s hair concerns.' },
  { icon: Stethoscope, title: 'Doctor-Guided Insight', body: 'A doctor reviews the assessment and approves or modifies the recommended plan.' },
  { icon: Leaf, title: 'Personalized Recovery Plan', body: 'A plan designed around the patient’s condition, history, lifestyle and hair goals.' },
];

const STEPS = [
  { n: '01', title: 'Answer the assessment', body: 'A guided, three-minute conversation about your hair, health, and lifestyle. No account needed.' },
  { n: '02', title: 'AI maps the root cause', body: 'Your signals are cross-referenced against clinical patterns — hormones, nutrition, stress, genetics.' },
  { n: '03', title: 'A doctor reviews it', body: 'Every analysis is validated by a clinician before anything is recommended to you.' },
  { n: '04', title: 'Your recovery plan', body: 'A personalized protocol built for your biology — treatments that work from the inside out.' },
];

const SCIENCE_PILLARS = [
  { icon: FlaskConical, title: 'Follicle biology', body: 'Every hair concern traces to a specific layer of the follicle — growth cycle, blood supply, or hormonal signalling.' },
  { icon: ScanSearch, title: 'Signal mapping', body: '18+ clinical signals are weighed together, because hair loss is rarely caused by one thing alone.' },
  { icon: ShieldCheck, title: 'Audit-traced logic', body: 'Every conclusion in your report is traceable to the exact answers and evidence that produced it.' },
];

const easeOut = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.8, ease: easeOut },
};

function MetricChip({
  label, value, className, delay = 0,
}: {
  label: string; value: string; className?: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay, ease: easeOut }}
      className={`absolute ${className ?? ''}`}
    >
      <motion.div
        animate={{ y: [0, -7, 0] }}
        transition={{ duration: 5.5, delay, repeat: Infinity, ease: 'easeInOut' }}
        className="rounded-xl border px-4 py-3 backdrop-blur-md"
        style={{ borderColor: LINE, background: 'rgba(8,18,9,0.55)' }}
      >
        <p className="text-[9px] uppercase tracking-[0.24em]" style={{ color: MUTED }}>{label}</p>
        <p className="mt-1 text-[18px] font-semibold" style={{ color: GOLD_SOFT }}>{value}</p>
      </motion.div>
    </motion.div>
  );
}

interface ClinicLandingClientProps {
  clinic: ClinicLandingData;
}

export default function ClinicLandingClient({ clinic }: ClinicLandingClientProps) {
  const router = useRouter();
  const { setClinicData, reset } = useAssessmentStore();

  // Sync the Zustand assessment store with the server-resolved clinic. Reset
  // any stale in-progress session first so returning patients don't leak
  // answers into a fresh clinic visit.
  useEffect(() => {
    reset();
    setClinicData({
      id: clinic.id,
      name: clinic.name,
      theme: 'default',
      language: clinic.language,
    });
  }, [clinic.id, clinic.name, clinic.language, setClinicData, reset]);

  const startAssessment = () => router.push(`/q/${clinic.slug}/assessment-v3`);
  const openScience = () => router.push(`/q/${clinic.slug}/science`);

  return (
    <MotionConfig reducedMotion="user">
    <div
      className="relative min-h-screen overflow-x-hidden font-[family-name:var(--font-jakarta)]"
      style={{ background: INK, color: CREAM }}
    >
      {/* ── NAV ─────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-xl"
        style={{ borderColor: LINE, background: 'rgba(8,18,9,0.82)' }}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div className="min-w-0">
            <p
              className="font-[family-name:var(--font-fraunces)] text-[20px] font-semibold tracking-[0.14em]"
              style={{ color: CREAM }}
            >
              DR. FACT
            </p>
            <p className="text-[8.5px] uppercase tracking-[0.34em]" style={{ color: GOLD }}>
              AI Hair Health Diagnostic
            </p>
          </div>

          <nav className="hidden items-center gap-8 text-[13px] md:flex" style={{ color: MUTED }}>
            <a href="#how-it-works" className="transition-colors hover:text-[#F4EFE2]">How It Works</a>
            <a href="#science" className="transition-colors hover:text-[#F4EFE2]">The Science</a>
            <a href="#results" className="transition-colors hover:text-[#F4EFE2]">Results</a>
            <a href="#about" className="transition-colors hover:text-[#F4EFE2]">About Us</a>
          </nav>

          <button
            type="button"
            onClick={startAssessment}
            className="group inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-[12.5px] font-semibold transition-all hover:-translate-y-px"
            style={{ borderColor: 'rgba(219,197,140,0.4)', color: GOLD_SOFT }}
          >
            Take Hair Analysis
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(900px 600px at 78% 30%, rgba(46,74,56,0.55) 0%, transparent 60%), radial-gradient(700px 500px at 85% 75%, rgba(217,188,122,0.12) 0%, transparent 55%)',
          }}
        />

        <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-6 pb-20 pt-14 md:grid-cols-[0.42fr_0.58fr] md:pb-28 md:pt-20">
          <div className="relative z-10 flex flex-col justify-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: easeOut }}
            >
              <div className="mb-6 flex items-center gap-3">
                <span className="h-px w-8" style={{ background: GOLD }} />
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.3em]" style={{ color: GOLD }}>
                  AI-Powered. Doctor-Guided.
                </span>
              </div>

              <h1
                className="font-[family-name:var(--font-fraunces)] text-[42px] font-medium leading-[1.06] tracking-[-0.01em] md:text-[64px] lg:text-[72px]"
                style={{ color: CREAM }}
              >
                Understand the
                <br />
                Root Cause.
                <br />
                Restore with <span style={{ color: GOLD_SOFT }}>Precision.</span>
              </h1>

              <p className="mt-6 max-w-md text-[15.5px] leading-[1.75] md:text-[16.5px]" style={{ color: MUTED }}>
                DR. FACT uses advanced analysis and doctor-reviewed clinical reasoning to
                understand the likely drivers behind hair concerns and create a personalized
                recovery plan.
              </p>

              <div className="mt-9">
                <button
                  type="button"
                  onClick={startAssessment}
                  className="group inline-flex items-center gap-3 rounded-full px-8 py-4 text-[14.5px] font-semibold transition-all hover:-translate-y-0.5"
                  style={{
                    background: `linear-gradient(135deg, ${GOLD_SOFT} 0%, ${GOLD} 100%)`,
                    color: '#1A2415',
                    boxShadow: '0 18px 50px -14px rgba(217,188,122,0.55)',
                  }}
                >
                  Start Your Hair Assessment
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>

              <p className="mt-7 text-[12px] leading-relaxed" style={{ color: MUTED }}>
                Clinically guided <span aria-hidden="true" style={{ color: GOLD }}>&bull;</span>{' '}
                Privacy protected <span aria-hidden="true" style={{ color: GOLD }}>&bull;</span>{' '}
                Takes about 3 minutes
              </p>
            </motion.div>
          </div>

          <div className="relative min-h-[400px] sm:min-h-[460px] md:-mr-6 md:min-h-[620px]">
            <div className="absolute inset-[4%] rounded-full bg-[#D9BC7A]/10 blur-3xl" aria-hidden="true" />
            <motion.div initial={{ opacity: 0, scale: 1.025 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.6, ease: easeOut }} className="absolute inset-0">
              <picture>
                <source srcSet="/images/hair-root-hero.avif 1x, /images/hair-root-hero@2x.avif 2x" type="image/avif" />
                <source srcSet="/images/hair-root-hero.webp 1x, /images/hair-root-hero@2x.webp 2x" type="image/webp" />
                <Image src="/images/hair-root-hero.webp" alt="" fill fetchPriority="high" quality={90} sizes="(max-width: 767px) 100vw, (max-width: 1280px) 58vw, 780px" className="object-cover [object-position:56%_30%] md:object-right-top" />
              </picture>
              <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-40 md:block" style={{ background: `linear-gradient(90deg, ${INK} 0%, transparent 100%)` }} aria-hidden="true" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28" style={{ background: `linear-gradient(180deg, transparent 0%, ${INK} 100%)` }} aria-hidden="true" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-16 md:hidden" style={{ background: `linear-gradient(180deg, ${INK} 0%, transparent 100%)` }} aria-hidden="true" />
            </motion.div>
            <div className="pointer-events-none absolute inset-0 hidden md:block" aria-hidden="true">
              {HERO_PARTICLES.map((particle, index) => (
                <motion.span key={particle.left + particle.top} className="absolute h-1 w-1 rounded-full bg-[#F0DCA8]/45" style={{ left: particle.left, top: particle.top }} animate={{ opacity: [0.2, 0.65, 0.2], y: [0, -10, 0] }} transition={{ duration: 7 + index, delay: particle.delay, repeat: Infinity, ease: 'easeInOut' }} />
              ))}
            </div>
            <div className="pointer-events-none absolute inset-0 hidden md:block" aria-hidden="true">
              <MetricChip label="Scalp Health" value="92%" className="left-[3%] top-[40%]" delay={0.6} />
              <MetricChip label="Hair Diameter" value="+18%" className="right-[16%] top-[14%]" delay={0.9} />
              <MetricChip label="Follicle Strength" value="+24%" className="right-[3%] top-[46%]" delay={1.2} />
            </div>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-7xl px-6 pb-20">
          <motion.div
            {...fadeUp}
            className="grid overflow-hidden rounded-2xl border lg:grid-cols-3"
            style={{ borderColor: LINE, background: 'rgba(16,36,26,0.6)', backdropFilter: 'blur(12px)' }}
          >
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex gap-4 border-t p-7 first:border-t-0 lg:border-l lg:border-t-0 lg:first:border-l-0 lg:p-8"
                style={{ borderColor: LINE }}
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border"
                  style={{ borderColor: 'rgba(219,197,140,0.35)' }}
                >
                  <f.icon className="h-5 w-5" style={{ color: GOLD }} />
                </div>
                <div>
                  <h3
                    className="font-[family-name:var(--font-fraunces)] text-[17px] font-medium"
                    style={{ color: CREAM }}
                  >
                    {f.title}
                  </h3>
                  <p className="mt-2 text-[13px] leading-[1.65]" style={{ color: MUTED }}>
                    {f.body}
                  </p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────── */}
      <section id="how-it-works" className="relative py-24" style={{ background: DEEP }}>
        <div className="mx-auto w-full max-w-7xl px-6">
          <motion.div {...fadeUp} className="mx-auto max-w-xl text-center">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.3em]" style={{ color: GOLD }}>
              — How It Works —
            </p>
            <h2
              className="mt-4 font-[family-name:var(--font-fraunces)] text-[34px] font-medium leading-tight md:text-[46px]"
              style={{ color: CREAM }}
            >
              From your answers to your answer.
            </h2>
            <p className="mt-4 text-[15px] leading-[1.7]" style={{ color: MUTED }}>
              Three minutes of honest questions. One clinically validated map
              of what your hair is actually telling you.
            </p>
          </motion.div>

          <div className="mt-14 grid gap-5 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.7, delay: i * 0.1, ease: easeOut }}
                className="rounded-2xl border p-7"
                style={{ borderColor: LINE, background: PANEL }}
              >
                <p className="font-[family-name:var(--font-fraunces)] text-[30px] font-light" style={{ color: GOLD }}>
                  {s.n}
                </p>
                <h3 className="mt-4 text-[16px] font-semibold" style={{ color: CREAM }}>{s.title}</h3>
                <p className="mt-2.5 text-[13px] leading-[1.65]" style={{ color: MUTED }}>{s.body}</p>
              </motion.div>
            ))}
          </div>

          <motion.div {...fadeUp} className="mt-12 flex justify-center">
            <button
              type="button"
              onClick={startAssessment}
              className="group inline-flex items-center gap-2 rounded-full border px-7 py-3.5 text-[13.5px] font-medium transition-all hover:-translate-y-px"
              style={{ borderColor: 'rgba(219,197,140,0.4)', color: GOLD_SOFT }}
            >
              Begin the three-minute assessment
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* ── THE SCIENCE ─────────────────────────────────────────── */}
      <section id="science" className="relative overflow-hidden py-24">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(800px 500px at 18% 40%, rgba(46,74,56,0.5) 0%, transparent 60%)' }}
        />
        <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-6 md:grid-cols-[0.9fr_1.1fr] md:items-center">
          <motion.div {...fadeUp}>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.3em]" style={{ color: GOLD }}>
              — The Science Behind It —
            </p>
            <h2
              className="mt-4 font-[family-name:var(--font-fraunces)] text-[34px] font-medium leading-[1.1] md:text-[46px]"
              style={{ color: CREAM }}
            >
              Hair loss has
              <br />
              <span style={{ color: GOLD_SOFT }}>a biology.</span>
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-[1.75]" style={{ color: MUTED }}>
              Inflammation, hormones, nutrient absorption, stress, genetics —
              every signal traces back to a specific layer of the follicle.
              DR. FACT reads those layers together, the way a clinician does.
            </p>
            <button
              type="button"
              onClick={openScience}
              className="group mt-8 inline-flex items-center gap-2 rounded-full border px-6 py-3.5 text-[13px] font-medium transition-all hover:-translate-y-px"
              style={{ borderColor: 'rgba(219,197,140,0.4)', color: GOLD_SOFT }}
            >
              <Sparkles className="h-4 w-4 transition-transform group-hover:rotate-12" style={{ color: GOLD }} />
              Read the science behind your hair loss
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </motion.div>

          <div className="grid gap-4">
            {SCIENCE_PILLARS.map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, x: 28 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.7, delay: i * 0.12, ease: easeOut }}
                className="flex gap-5 rounded-2xl border p-6"
                style={{ borderColor: LINE, background: 'rgba(16,36,26,0.55)' }}
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border"
                  style={{ borderColor: 'rgba(219,197,140,0.35)' }}
                >
                  <p.icon className="h-5 w-5" style={{ color: GOLD }} />
                </div>
                <div>
                  <h3 className="text-[15.5px] font-semibold" style={{ color: CREAM }}>{p.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-[1.65]" style={{ color: MUTED }}>{p.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Real patient results */}
      <section id="results" className="relative py-20 md:py-24" style={{ background: DEEP }}>
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-6">
          <motion.div {...fadeUp} className="mx-auto max-w-xl text-center">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.3em]" style={{ color: GOLD }}>? Real Results ?</p>
            <h2 className="mt-4 font-[family-name:var(--font-fraunces)] text-[34px] font-medium leading-tight md:text-[46px]" style={{ color: CREAM }}>Real People. Real Results.</h2>
          </motion.div>
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {RESULTS.map((result, index) => (
              <motion.article key={result.id} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.7, delay: index * 0.1, ease: easeOut }} className="overflow-hidden rounded-2xl border p-4 sm:p-5" style={{ borderColor: LINE, background: PANEL }}>
                <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: GOLD_SOFT }}>{result.sex} patient case</h3>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {(['before', 'after'] as const).map((phase) => (
                    <figure key={phase}>
                      <div className="relative overflow-hidden rounded-xl border" style={{ borderColor: LINE }}>
                        <Image src={result[phase]} alt={result.sex + ' patient hair, ' + phase} width={result.width} height={result.height} sizes="(max-width: 640px) 44vw, (max-width: 1024px) 46vw, 280px" className="aspect-[4/3] w-full object-cover object-center" />
                      </div>
                      <figcaption className="mt-3 text-center text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: MUTED }}>{phase === 'before' ? 'Before' : 'After'}</figcaption>
                    </figure>
                  ))}
                </div>
              </motion.article>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-3xl text-center text-[12px] leading-[1.7]" style={{ color: MUTED }}>Real patient cases shown with permission. Individual outcomes vary according to the underlying cause, adherence, duration of care and other clinical factors.</p>
        </div>
      </section>

      {/* ── ABOUT / CLINICIAN ──────────────────────────────────── */}
      <section id="about" className="relative py-24">
        <div className="mx-auto w-full max-w-5xl px-6">
          <motion.div
            {...fadeUp}
            className="relative overflow-hidden rounded-[2rem] border p-8 md:p-12"
            style={{ borderColor: LINE, background: PANEL }}
          >
            <div
              className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full blur-3xl"
              style={{ background: 'rgba(217,188,122,0.1)' }}
            />

            <p className="text-[10.5px] font-semibold uppercase tracking-[0.3em]" style={{ color: GOLD }}>
              — About Us —
            </p>

            {clinic.leadDoctor ? (
              <div className="relative mt-6 grid gap-8 md:grid-cols-[150px_1fr] md:items-start">
                {clinic.leadDoctor.photoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={clinic.leadDoctor.photoUrl}
                    alt={clinic.leadDoctor.name}
                    className="h-32 w-32 rounded-full border object-cover md:h-36 md:w-36"
                    style={{ borderColor: 'rgba(219,197,140,0.4)' }}
                  />
                ) : (
                  <div
                    className="flex h-32 w-32 items-center justify-center rounded-full border md:h-36 md:w-36"
                    style={{ borderColor: 'rgba(219,197,140,0.4)', background: 'rgba(8,18,9,0.5)' }}
                  >
                    <Stethoscope className="h-11 w-11" style={{ color: MUTED }} />
                  </div>
                )}
                <div className="min-w-0">
                  <h3
                    className="font-[family-name:var(--font-fraunces)] text-[26px] font-medium leading-tight md:text-[32px]"
                    style={{ color: CREAM }}
                  >
                    {clinic.leadDoctor.name}
                  </h3>
                  {clinic.leadDoctor.credentials && (
                    <p className="mt-1 text-[11.5px] uppercase tracking-[0.18em]" style={{ color: GOLD }}>
                      {clinic.leadDoctor.credentials}
                    </p>
                  )}
                  {clinic.leadDoctor.specialization && (
                    <p className="mt-1 text-[14px]" style={{ color: MUTED }}>
                      {clinic.leadDoctor.specialization}
                    </p>
                  )}
                  {clinic.leadDoctor.bio && (
                    <p className="mt-5 text-[14.5px] leading-[1.75]" style={{ color: MUTED }}>
                      {clinic.leadDoctor.bio}
                    </p>
                  )}
                  {(clinic.address || clinic.tagline) && (
                    <div className="mt-6 space-y-2 border-t pt-5" style={{ borderColor: LINE }}>
                      {clinic.tagline && (
                        <p className="text-[13px] italic leading-relaxed" style={{ color: MUTED }}>
                          &ldquo;{clinic.tagline}&rdquo;
                        </p>
                      )}
                      {clinic.address && (
                        <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'rgba(214,222,208,0.4)' }}>
                          {clinic.address}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative mt-6">
                <h3
                  className="font-[family-name:var(--font-fraunces)] text-[26px] font-medium leading-tight md:text-[32px]"
                  style={{ color: CREAM }}
                >
                  {clinic.name}
                </h3>
                {clinic.tagline && (
                  <p className="mt-3 text-[14.5px] italic leading-relaxed" style={{ color: MUTED }}>
                    &ldquo;{clinic.tagline}&rdquo;
                  </p>
                )}
                {clinic.address && (
                  <p className="mt-4 text-[11px] uppercase tracking-[0.18em]" style={{ color: 'rgba(214,222,208,0.4)' }}>
                    {clinic.address}
                  </p>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24" style={{ background: DEEP }}>
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(700px 400px at 50% 100%, rgba(217,188,122,0.14) 0%, transparent 60%)' }}
        />
        <div className="relative mx-auto w-full max-w-3xl px-6 text-center">
          <motion.div {...fadeUp}>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.3em]" style={{ color: GOLD }}>
              Ready when you are
            </p>
            <h2
              className="mt-5 font-[family-name:var(--font-fraunces)] text-[36px] font-medium leading-[1.08] md:text-[54px]"
              style={{ color: CREAM }}
            >
              Three minutes to
              <br />
              your root cause.
            </h2>
            <p className="mx-auto mt-5 max-w-md text-[15px] leading-[1.7]" style={{ color: MUTED }}>
              No account. No commitment. Just answer honestly and let the
              biology speak for itself.
            </p>

            <button
              type="button"
              onClick={startAssessment}
              className="group mt-10 inline-flex items-center gap-3 rounded-full px-9 py-4 text-[15px] font-semibold transition-all hover:-translate-y-0.5"
              style={{
                background: `linear-gradient(135deg, ${GOLD_SOFT} 0%, ${GOLD} 100%)`,
                color: '#1A2415',
                boxShadow: '0 18px 50px -14px rgba(217,188,122,0.55)',
              }}
            >
              Start Your Hair Analysis
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5 text-[11px]" style={{ color: MUTED }}>
              <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5" style={{ borderColor: LINE }}>
                <Clock className="h-3 w-3" style={{ color: GOLD }} />
                ~3 minutes
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5" style={{ borderColor: LINE }}>
                <Lock className="h-3 w-3" style={{ color: GOLD }} />
                Private &amp; encrypted
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5" style={{ borderColor: LINE }}>
                <Stethoscope className="h-3 w-3" style={{ color: GOLD }} />
                Clinician-reviewed
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <footer className="border-t py-10" style={{ borderColor: LINE }}>
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-3 px-6 text-center">
          <p
            className="font-[family-name:var(--font-fraunces)] text-[16px] font-semibold tracking-[0.14em]"
            style={{ color: CREAM }}
          >
            DR. FACT
          </p>
          <p className="text-[10px] uppercase tracking-[0.28em]" style={{ color: MUTED }}>
            AI Hair Health Diagnostic · {clinic.name}
          </p>
        </div>
      </footer>
    </div>
    </MotionConfig>
  );
}

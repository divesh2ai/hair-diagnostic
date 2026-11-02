'use client';

import { useEffect, useState } from 'react';
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

import { LocaleSwitcherV3 } from '@/components/questionnaire/v3';
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

/**
 * Professional placeholder shown when a clinic has no doctor photo configured,
 * or when the configured photo URL fails to load. Never a broken image.
 */
function DoctorPhotoFallback() {
  return (
    <div
      className="relative flex aspect-[4/5] w-full items-center justify-center rounded-[1.5rem] border"
      style={{ borderColor: 'rgba(219,197,140,0.4)', background: 'rgba(8,18,9,0.5)' }}
    >
      <Stethoscope className="h-16 w-16" style={{ color: MUTED }} aria-hidden="true" />
    </div>
  );
}

/**
 * Doctor photograph with a safe loading fallback. The src is an arbitrary
 * stored URL (Supabase storage); if it is invalid, deleted, or unreachable the
 * `onError` handler swaps in the professional placeholder instead of leaving a
 * broken image. Mounted with a `key` of its src by the parent, so each clinic's
 * photo gets its own fresh attempt.
 */
function DoctorPhoto({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <DoctorPhotoFallback />;
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="relative aspect-[4/5] w-full rounded-[1.5rem] border object-cover object-top"
      style={{ borderColor: 'rgba(219,197,140,0.4)' }}
    />
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
      // Drives which languages the switcher and the assessment gate offer.
      supportedLanguages: clinic.supportedLanguages,
    });
  }, [
    clinic.id,
    clinic.name,
    clinic.language,
    clinic.supportedLanguages,
    setClinicData,
    reset,
  ]);

  const doctorPhotoUrl = clinic.leadDoctor?.photoUrl ?? null;

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
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-5 py-4 sm:px-6">
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

          <nav className="hidden items-center gap-8 text-[13px] lg:flex" style={{ color: MUTED }}>
            <a href="#about" className="transition-colors hover:text-[#F4EFE2]">Your Doctor</a>
            <a href="#science" className="transition-colors hover:text-[#F4EFE2]">The Science</a>
            <a href="#results" className="transition-colors hover:text-[#F4EFE2]">Results</a>
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/*
              The language choice lives here so a patient who reads Hindi picks
              it before entering the assessment rather than after. A tap is a
              deliberate decision, so `confirmOnSelect` records it and the
              assessment starts straight at chapter one instead of re-asking.
              Leave it untouched and the in-assessment gate still runs.

              This page's own copy stays English by design — see
              docs/localisation/assessment-hi-review.md.
            */}
            <LocaleSwitcherV3 compact confirmOnSelect />

            <button
              type="button"
              onClick={startAssessment}
              className="group inline-flex items-center gap-2 rounded-full border px-3.5 py-2.5 text-[12.5px] font-semibold transition-all hover:-translate-y-px sm:px-5"
              style={{ borderColor: 'rgba(219,197,140,0.4)', color: GOLD_SOFT }}
            >
              <span className="hidden sm:inline">Take Hair Analysis</span>
              <span className="sm:hidden">Start</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
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

      {/* ── YOUR DOCTOR ─────────────────────────────────────────── */}
      {/*
        Personalized, premium doctor introduction. Replaces the old generic
        "How It Works" explainer. Everything here is driven by the clinic's
        own resolved lead doctor (isPrimary first, else oldest active — see
        getClinicLandingData), so each clinic shows its own clinician and
        never another clinic's. Falls back gracefully when a photo or profile
        has not been configured.
      */}
      <section id="about" className="relative py-24" style={{ background: DEEP }}>
        <div className="mx-auto w-full max-w-6xl px-6">
          <motion.div
            {...fadeUp}
            className="relative grid gap-10 overflow-hidden rounded-[2rem] border p-7 sm:p-10 md:grid-cols-[0.82fr_1fr] md:items-center md:gap-14 md:p-14"
            style={{ borderColor: LINE, background: PANEL }}
          >
            <div
              className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full blur-3xl"
              style={{ background: 'rgba(217,188,122,0.1)' }}
              aria-hidden="true"
            />

            {/* Doctor photograph — the primary visual element */}
            <div className="relative mx-auto w-full max-w-[320px] md:mx-0">
              <div
                className="pointer-events-none absolute -inset-3 rounded-[1.75rem] blur-2xl"
                style={{ background: 'rgba(217,188,122,0.12)' }}
                aria-hidden="true"
              />
              {doctorPhotoUrl ? (
                /*
                  Keyed by the URL so a client-side navigation to another
                  clinic remounts the photo and re-attempts its own image
                  rather than inheriting the previous clinic's failure state.
                */
                <DoctorPhoto
                  key={doctorPhotoUrl}
                  src={doctorPhotoUrl}
                  alt={clinic.leadDoctor?.name ?? clinic.name}
                />
              ) : (
                <DoctorPhotoFallback />
              )}
            </div>

            {/* Doctor identity + assessment CTA */}
            <div className="relative min-w-0 text-center md:text-left">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.3em]" style={{ color: GOLD }}>
                — Your Doctor —
              </p>
              <h2
                className="mt-4 font-[family-name:var(--font-fraunces)] text-[32px] font-medium leading-tight md:text-[44px]"
                style={{ color: CREAM }}
              >
                {clinic.leadDoctor?.name ?? clinic.name}
              </h2>

              {clinic.leadDoctor?.credentials && (
                <p className="mt-2 text-[12px] uppercase tracking-[0.18em]" style={{ color: GOLD }}>
                  {clinic.leadDoctor.credentials}
                </p>
              )}
              {clinic.leadDoctor?.specialization && (
                <p className="mt-2 text-[15px]" style={{ color: MUTED }}>
                  {clinic.leadDoctor.specialization}
                </p>
              )}

              <p className="mt-3 text-[12.5px] font-semibold uppercase tracking-[0.2em]" style={{ color: GOLD_SOFT }}>
                {clinic.name}
              </p>

              {clinic.leadDoctor?.bio && (
                <p className="mx-auto mt-5 max-w-xl text-[14.5px] leading-[1.75] md:mx-0" style={{ color: MUTED }}>
                  {clinic.leadDoctor.bio}
                </p>
              )}

              {clinic.tagline && (
                <p className="mx-auto mt-5 max-w-xl text-[14px] italic leading-relaxed md:mx-0" style={{ color: MUTED }}>
                  &ldquo;{clinic.tagline}&rdquo;
                </p>
              )}

              {clinic.address && (
                <p className="mt-4 text-[11px] uppercase tracking-[0.18em]" style={{ color: 'rgba(214,222,208,0.4)' }}>
                  {clinic.address}
                </p>
              )}

              <div className="mt-8 flex justify-center md:justify-start">
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
                  Start My Hair Assessment
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>

              <div
                className="mt-7 flex flex-wrap items-center justify-center gap-2.5 text-[11px] md:justify-start"
                style={{ color: MUTED }}
              >
                <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5" style={{ borderColor: LINE }}>
                  <Clock className="h-3 w-3" style={{ color: GOLD }} aria-hidden="true" />
                  ~3 minutes
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5" style={{ borderColor: LINE }}>
                  <Lock className="h-3 w-3" style={{ color: GOLD }} aria-hidden="true" />
                  Private &amp; encrypted
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5" style={{ borderColor: LINE }}>
                  <Stethoscope className="h-3 w-3" style={{ color: GOLD }} aria-hidden="true" />
                  Clinician-reviewed
                </span>
              </div>
            </div>
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

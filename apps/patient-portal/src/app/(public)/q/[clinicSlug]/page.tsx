'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAssessmentStore } from '@/stores/useAssessmentStore';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  ChevronRight,
  Clock,
  Lock,
  Play,
  Sparkles,
  Stethoscope,
} from 'lucide-react';

interface LeadDoctor {
  id: string;
  name: string;
  specialization: string | null;
  credentials: string | null;
  photoUrl: string | null;
  bio: string | null;
}

interface ClinicData {
  id: string;
  name: string;
  slug: string;
  language: string;
  address?: string | null;
  logoUrl?: string | null;
  tagline?: string | null;
  leadDoctor?: LeadDoctor | null;
}

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1605497788044-5a32c7078486?auto=format&fit=crop&w=1400&q=85';

const CHAPTERS = [
  {
    n: 'Chapter 1',
    title: "What's Happening To My Hair?",
    sub: 'Your pattern, mapped in clinical detail.',
    image:
      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=900&q=80',
  },
  {
    n: 'Chapter 2',
    title: 'Why Is This Happening?',
    sub: 'The biology beneath the surface.',
    image:
      'https://images.unsplash.com/photo-1559757175-08fdec6c2839?auto=format&fit=crop&w=900&q=80',
  },
  {
    n: 'Chapter 3',
    title: 'How We Rebuild Growth',
    sub: 'A regeneration roadmap, sequenced for you.',
    image:
      'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=900&q=80',
  },
  {
    n: 'Chapter 4',
    title: 'Your Future Hair Journey',
    sub: 'Month by month, what recovery looks like.',
    image:
      'https://images.unsplash.com/photo-1595163319827-ce152a3aa66e?auto=format&fit=crop&w=900&q=80',
  },
];

const INSIGHTS = [
  'Pattern & density assessment',
  'Nutritional & metabolic signals',
  'Inflammatory & scalp environment',
  'Hormonal contributors',
  'Recovery potential profile',
];

export default function ClinicLandingPage() {
  const params = useParams();
  const router = useRouter();
  const { setClinicData, reset } = useAssessmentStore();
  const clinicSlug = String(params.clinicSlug ?? '');

  const [clinic, setClinic] = useState<ClinicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clinicSlug) return;
    reset();

    async function fetchClinic() {
      try {
        const res = await fetch(`/api/clinics/${clinicSlug}`);
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error ?? 'Clinic not found');
          return;
        }
        setClinic(data.clinic);
        setClinicData({
          id: data.clinic.id,
          name: data.clinic.name,
          slug: data.clinic.slug,
          language: data.clinic.language,
        });
      } catch {
        setError('Could not load clinic. Please check your connection.');
      } finally {
        setLoading(false);
      }
    }

    fetchClinic();
  }, [clinicSlug, setClinicData, reset]);

  if (loading) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ background: 'linear-gradient(180deg,#07111F 0%,#0A2540 100%)' }}
      >
        <div className="flex flex-col items-center gap-5">
          <div className="h-2 w-2 animate-pulse rounded-full bg-[#00C2A8] shadow-[0_0_18px_#00C2A8]" />
          <p className="text-xs uppercase tracking-[0.28em] text-white/55">
            Preparing your clinic
          </p>
        </div>
      </div>
    );
  }

  if (error || !clinic) {
    return (
      <div
        className="flex h-screen items-center justify-center p-6"
        style={{ background: 'linear-gradient(180deg,#07111F 0%,#0A2540 100%)' }}
      >
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <AlertCircle className="h-12 w-12 text-rose-400" />
          <h2 className="text-xl font-semibold text-white">Clinic not found</h2>
          <p className="text-sm text-white/55">
            {error ?? `No clinic found for "${clinicSlug}". Please scan the QR code again.`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen overflow-x-hidden font-[var(--font-jakarta)] text-white"
      style={{
        background:
          'linear-gradient(180deg, #07111F 0%, #0A2540 32%, #1B4965 58%, #E9EFF6 88%, #F8FAFC 100%)',
      }}
    >
      <ParticleField />

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header className="relative z-20 mx-auto flex w-full max-w-md items-center justify-between px-6 pt-6">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#00C2A8] shadow-[0_0_12px_#00C2A8]" />
          <span className="text-[12px] font-semibold uppercase tracking-[0.32em] text-white/90">
            HairOS
          </span>
        </div>
        <span className="rounded-full border border-white/20 bg-white/[0.06] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.22em] text-white/70 backdrop-blur-md">
          Clinical
        </span>
      </header>

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto w-full max-w-md px-6 pt-8 pb-14">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-3 py-1.5 backdrop-blur-md">
            {clinic.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={clinic.logoUrl}
                alt={`${clinic.name} logo`}
                className="h-4 w-4 rounded-full object-cover"
              />
            ) : (
              <Sparkles className="h-3 w-3 text-[#F4B942]" />
            )}
            <span className="text-[10px] uppercase tracking-[0.26em] text-white/75">
              In partnership with {clinic.name}
            </span>
          </div>

          {clinic.tagline && (
            <p className="mt-3 text-[12px] italic leading-relaxed text-white/55">
              &ldquo;{clinic.tagline}&rdquo;
            </p>
          )}

          <h1 className="mt-6 text-[44px] font-bold leading-[1.02] tracking-[-0.02em]">
            Your Hair
            <br />
            <span className="bg-gradient-to-r from-[#F4B942] via-[#FFD98A] to-[#00C2A8] bg-clip-text text-transparent">
              Story.
            </span>
          </h1>

          <p className="mt-5 text-[15px] leading-[1.7] text-white/65">
            Generated from your responses and analyzed through HairOS Intelligence —
            a personal look at the pattern, biology, and recovery path shaped uniquely by you.
          </p>
        </motion.div>

        {/* Cinematic hero image */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative mt-8"
        >
          <div className="absolute -inset-6 rounded-[2rem] bg-[radial-gradient(ellipse_at_center,rgba(0,194,168,0.28),transparent_70%)] blur-2xl" />
          <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] border border-white/15 shadow-[0_30px_80px_-25px_rgba(0,0,0,0.85)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={HERO_IMAGE}
              alt="The opening scene of your hair story"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#07111F] via-[#07111F]/30 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-[#00C2A8]/12" />

            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/20 bg-black/35 px-3 py-1.5 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F4B942] shadow-[0_0_8px_#F4B942]" />
              <span className="text-[10px] uppercase tracking-[0.24em] text-white/85">
                Prologue
              </span>
            </div>

            <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-white/15 bg-black/40 px-4 py-3 backdrop-blur-xl">
              <div className="text-[10px] uppercase tracking-[0.24em] text-[#00C2A8]">
                A documentary about you
              </div>
              <div className="mt-1 text-[13px] font-medium text-white">
                Crafted from your responses · narrated by your biology
              </div>
            </div>
          </div>
        </motion.div>

        {/* Primary CTA */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8"
        >
          <button
            type="button"
            onClick={() => router.push(`/q/${clinicSlug}/assessment`)}
            className="group flex w-full items-center justify-center gap-3 rounded-full bg-white px-7 py-5 text-[15px] font-semibold text-[#0A2540] shadow-[0_18px_50px_-12px_rgba(0,194,168,0.55)] transition-all hover:-translate-y-0.5 hover:shadow-[0_22px_60px_-12px_rgba(0,194,168,0.75)]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#00C2A8] to-[#0A2540] text-white">
              <Play className="h-3.5 w-3.5 fill-white" />
            </span>
            Watch My Hair Story
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>

          <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-white/55">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 backdrop-blur-md">
              <Clock className="h-3 w-3" />
              ~3 minutes
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 backdrop-blur-md">
              <Lock className="h-3 w-3" />
              Private
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 backdrop-blur-md">
              <Stethoscope className="h-3 w-3" />
              Clinician-reviewed
            </span>
          </div>
        </motion.div>
      </section>

      {/* ── INSIGHT CARD ───────────────────────────────────────── */}
      <section className="relative z-10 mx-auto w-full max-w-md px-6 pb-14">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[1.75rem] border border-white/15 bg-white/[0.04] p-7 backdrop-blur-2xl shadow-[0_30px_80px_-25px_rgba(0,0,0,0.7)]"
        >
          <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-[#00C2A8]/14 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-[#F4B942]/10 blur-3xl" />

          <p className="relative text-[10px] uppercase tracking-[0.3em] text-[#00C2A8]">
            HairOS · Discovery
          </p>
          <h2 className="relative mt-3 text-[28px] font-bold leading-[1.05] tracking-[-0.01em] text-white">
            What HairOS
            <br />
            Will Discover
          </h2>
          <p className="relative mt-3 text-[13.5px] leading-[1.65] text-white/55">
            Five signal layers we'll trace across your responses — the threads
            we follow through the rest of your story.
          </p>

          <ul className="relative mt-5 space-y-1">
            {INSIGHTS.map((insight, i) => (
              <motion.li
                key={insight}
                initial={{ opacity: 0, x: 12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.5,
                  delay: i * 0.07,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="group flex items-center justify-between gap-4 border-b border-white/8 py-3.5 last:border-0"
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono text-[11px] text-white/30">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[14.5px] font-medium text-white">
                    {insight}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-white/25 transition-all group-hover:translate-x-0.5 group-hover:text-[#00C2A8]" />
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </section>

      {/* ── YOUR CLINICIAN ─────────────────────────────────────── */}
      {clinic.leadDoctor && (
        <section className="relative z-10 mx-auto w-full max-w-md px-6 pb-14">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-[1.75rem] border border-white/15 bg-white/[0.04] p-7 backdrop-blur-2xl shadow-[0_30px_80px_-25px_rgba(0,0,0,0.7)]"
          >
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#00C2A8]">
              Your clinician
            </p>
            <div className="mt-4 flex items-start gap-4">
              {clinic.leadDoctor.photoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={clinic.leadDoctor.photoUrl}
                  alt={clinic.leadDoctor.name}
                  className="h-16 w-16 shrink-0 rounded-full border border-white/20 object-cover shadow-lg"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/[0.06]">
                  <Stethoscope className="h-7 w-7 text-white/55" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="text-[18px] font-bold leading-tight text-white">
                  {clinic.leadDoctor.name}
                </h3>
                {clinic.leadDoctor.credentials && (
                  <p className="mt-0.5 text-[12px] uppercase tracking-[0.16em] text-[#F4B942]">
                    {clinic.leadDoctor.credentials}
                  </p>
                )}
                {clinic.leadDoctor.specialization && (
                  <p className="mt-0.5 text-[12.5px] text-white/65">
                    {clinic.leadDoctor.specialization}
                  </p>
                )}
              </div>
            </div>
            {clinic.leadDoctor.bio && (
              <p className="mt-4 text-[13px] leading-[1.65] text-white/65">
                {clinic.leadDoctor.bio}
              </p>
            )}
            {clinic.address && (
              <p className="mt-4 border-t border-white/10 pt-3 text-[11px] uppercase tracking-[0.18em] text-white/40">
                {clinic.address}
              </p>
            )}
          </motion.div>
        </section>
      )}

      {/* ── CHAPTERS ───────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto w-full max-w-md px-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mb-7"
        >
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#00C2A8]">
            The Series
          </p>
          <h2 className="mt-3 text-[28px] font-bold leading-[1.05] tracking-[-0.01em] text-white">
            Four chapters.
            <br />
            <span className="text-white/55">One story — yours.</span>
          </h2>
        </motion.div>

        <div className="space-y-4">
          {CHAPTERS.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{
                duration: 0.7,
                delay: i * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="group relative h-56 cursor-pointer overflow-hidden rounded-2xl border border-white/12 shadow-[0_24px_50px_-25px_rgba(0,0,0,0.6)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.image}
                alt={c.title}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-[#0A2540]/35" />

              <div className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-black/35 backdrop-blur-md transition-all group-hover:border-[#00C2A8] group-hover:bg-[#00C2A8]">
                <Play className="h-3.5 w-3.5 fill-white text-white" />
              </div>

              <div className="absolute inset-x-0 bottom-0 p-5">
                <div className="text-[10px] uppercase tracking-[0.26em] text-[#F4B942]">
                  {c.n}
                </div>
                <h3 className="mt-1.5 text-[18px] font-bold leading-tight text-white">
                  {c.title}
                </h3>
                <p className="mt-1 text-[12.5px] leading-[1.55] text-white/70">
                  {c.sub}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CLOSING CTA on light field ─────────────────────────── */}
      <section className="relative z-10 pb-16 pt-6">
        <div className="mx-auto w-full max-w-md px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-[1.75rem] bg-white p-8 text-center shadow-[0_30px_80px_-20px_rgba(10,37,64,0.35)]"
          >
            <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-[#00C2A8]/14 blur-3xl" />
            <div className="absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-[#F4B942]/16 blur-3xl" />

            <p className="relative text-[10px] uppercase tracking-[0.3em] text-[#00C2A8]">
              Premiere
            </p>
            <h2 className="relative mt-3 text-[32px] font-bold leading-[1.05] tracking-[-0.01em] text-[#0A2540]">
              Ready to meet
              <br />
              your hair?
            </h2>
            <p className="relative mx-auto mt-4 max-w-xs text-[14px] leading-[1.7] text-[#1B4965]/70">
              A calm, guided assessment. A personal documentary. One clearer path forward.
            </p>

            <button
              type="button"
              onClick={() => router.push(`/q/${clinicSlug}/assessment`)}
              className="group relative mt-7 inline-flex w-full items-center justify-center gap-3 rounded-full bg-[#0A2540] px-7 py-4 text-[14px] font-semibold text-white shadow-[0_18px_45px_-12px_rgba(10,37,64,0.55)] transition-all hover:bg-[#1B4965]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00C2A8]">
                <Play className="h-3.5 w-3.5 fill-white text-white" />
              </span>
              Start My Hair Recovery Journey
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>

            <button
              type="button"
              onClick={() => router.push(`/q/${clinicSlug}/science`)}
              className="relative mx-auto mt-5 flex items-center gap-1.5 text-[12px] font-medium text-[#1B4965]/70 underline decoration-[#00C2A8]/40 underline-offset-4 transition-colors hover:text-[#0A2540] hover:decoration-[#00C2A8]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              The science behind your hair loss
            </button>
          </motion.div>

          <p className="mt-8 text-center text-[10px] uppercase tracking-[0.28em] text-[#0A2540]/40">
            HairOS · {clinic.name}
          </p>
        </div>
      </section>
    </div>
  );
}

/* ── Ambient particle / network field ─────────────────────────── */
function ParticleField() {
  const points = Array.from({ length: 22 }, (_, i) => ({
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

      <motion.div
        className="absolute h-[500px] w-[500px] rounded-full bg-[#00C2A8]/8 blur-3xl"
        animate={{ x: [-60, 50, -60], y: [-50, 40, -50] }}
        transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
        style={{ top: '5%', left: '40%' }}
      />
      <motion.div
        className="absolute h-[420px] w-[420px] rounded-full bg-[#F4B942]/8 blur-3xl"
        animate={{ x: [40, -40, 40], y: [40, -30, 40] }}
        transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
        style={{ top: '30%', left: '-10%' }}
      />
    </div>
  );
}

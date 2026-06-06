"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles,
  Shield,
  Activity,
  FileText,
  Brain,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

const fade = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0f14] text-white overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(56,189,248,0.18),transparent)]" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-sm font-semibold tracking-[0.2em] text-sky-300/90 uppercase">
          HairOS
        </span>
        <Link
          href="/sandbox"
          className="text-sm text-white/60 hover:text-white transition-colors"
        >
          Clinical QA
        </Link>
      </header>

      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-16 pb-24 md:pt-24">
        <motion.div {...fade}>
          <p className="mb-4 text-sm font-medium text-sky-400/90 tracking-wide">
            AI-powered hair & scalp healthcare
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl">
            Understand your hair.
            <span className="block text-white/70 mt-2">Recover with clinical confidence.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/55 leading-relaxed">
            A calm, clinician-guided assessment that maps your pattern, scalp health, and
            root causes — then delivers a personalized recovery plan you can trust.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/q/drfact-mumbai"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-semibold text-[#0a0f14] hover:bg-sky-50 transition-colors"
            >
              Start assessment
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="#sample-report"
              className="inline-flex items-center justify-center rounded-full border border-white/20 px-8 py-4 text-sm font-medium text-white/80 hover:bg-white/5 transition-colors"
            >
              View sample report
            </Link>
          </div>
        </motion.div>

        <motion.div
          className="mt-16 grid gap-4 md:grid-cols-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
          {[
            { icon: Activity, label: "18-step clinical intake" },
            { icon: Brain, label: "AI orchestration with audit trail" },
            { icon: FileText, label: "Cinematic patient & doctor reports" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 backdrop-blur-sm"
            >
              <Icon className="h-5 w-5 text-sky-400 mb-2" />
              <p className="text-sm text-white/70">{label}</p>
            </div>
          ))}
        </motion.div>
      </section>

      <section id="flow" className="relative z-10 border-t border-white/10 bg-[#0d1319] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <motion.h2 {...fade} className="text-2xl font-semibold md:text-3xl mb-12">
            AI diagnostic flow
          </motion.h2>
          <div className="grid gap-6 md:grid-cols-4">
            {[
              { step: "01", title: "Intake", desc: "Branching questionnaire adapts to your sex, age, and concerns." },
              { step: "02", title: "Normalize", desc: "Clinical signals extracted with full audit trail." },
              { step: "03", title: "Analyze", desc: "Modular engines detect pattern, severity, and root causes." },
              { step: "04", title: "Report", desc: "Personalized narrative + cinematic PDF for you and your doctor." },
            ].map((item) => (
              <motion.div
                key={item.step}
                {...fade}
                className="rounded-2xl border border-white/8 bg-white/[0.03] p-6"
              >
                <span className="text-xs font-mono text-sky-400">{item.step}</span>
                <h3 className="mt-2 font-medium">{item.title}</h3>
                <p className="mt-2 text-sm text-white/50 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <motion.h2 {...fade} className="text-2xl font-semibold md:text-3xl mb-8">
            Conditions we understand
          </motion.h2>
          <div className="flex flex-wrap gap-2">
            {[
              "Male & female pattern loss",
              "Telogen effluvium",
              "Postpartum shedding",
              "PCOS-related thinning",
              "Thyroid-related loss",
              "Scalp inflammation & dandruff",
              "Metabolic & stress factors",
              "Advanced Norwood patterns",
            ].map((c) => (
              <span
                key={c}
                className="rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm text-white/65"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="sample-report" className="relative z-10 border-t border-white/10 py-20">
        <div className="mx-auto max-w-6xl px-6 grid md:grid-cols-2 gap-12 items-center">
          <motion.div {...fade}>
            <h2 className="text-2xl font-semibold md:text-3xl">Sample report preview</h2>
            <p className="mt-4 text-white/55 leading-relaxed">
              Every assessment produces a patient-friendly summary and a clinician-grade
              report with therapy routing, timelines, and visual education blocks.
            </p>
          </motion.div>
          <motion.div
            {...fade}
            className="rounded-3xl border border-white/10 bg-gradient-to-br from-sky-950/40 to-[#0a0f14] p-8 shadow-2xl"
          >
            <p className="text-xs uppercase tracking-widest text-sky-400/80 mb-4">Clinical summary</p>
            <p className="text-lg font-medium leading-snug">
              Moderate inflammatory diffuse thinning with hormonal and metabolic contributors.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-white/60">
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> Ranked therapy protocol</li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> 12-week recovery timeline</li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> Scalp care visual journey</li>
            </ul>
          </motion.div>
        </div>
      </section>

      <section className="relative z-10 border-t border-white/10 bg-[#0d1319] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div {...fade} className="flex items-start gap-4">
            <Sparkles className="h-8 w-8 text-sky-400 shrink-0" />
            <div>
              <h2 className="text-2xl font-semibold">Clinical intelligence</h2>
              <p className="mt-3 max-w-2xl text-white/55 leading-relaxed">
                Deterministic rule engines — not black-box guesses. Every recommendation is
                traceable through branching paths, applied rules, and regression-tested baselines.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="relative z-10 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div {...fade} className="flex items-start gap-4">
            <Shield className="h-8 w-8 text-emerald-400/90 shrink-0" />
            <div>
              <h2 className="text-2xl font-semibold">Trust & privacy</h2>
              <p className="mt-3 max-w-2xl text-white/55 leading-relaxed">
                Multi-tenant isolation per clinic. Encrypted storage. Orchestration logs for
                clinical audit. Your data never trains public models.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="relative z-10 border-t border-white/10 py-24">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <motion.h2 {...fade} className="text-3xl font-semibold">
            Ready to begin?
          </motion.h2>
          <motion.p {...fade} className="mt-4 text-white/50">
            Takes about 8 minutes. No account required to start.
          </motion.p>
          <motion.div {...fade} className="mt-8">
            <Link
              href="/q/demo-clinic"
              className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-10 py-4 text-sm font-semibold text-white hover:bg-sky-400 transition-colors"
            >
              Start your assessment
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 py-8 text-center text-xs text-white/35">
        HairOS — The operating system for AI-powered hair recovery clinics.
      </footer>
    </div>
  );
}

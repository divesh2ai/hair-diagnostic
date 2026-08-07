"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Award,
  ClipboardList,
  Compass,
  Download,
  Droplet,
  FileText,
  FlaskConical,
  Heart,
  Leaf,
  Microscope,
  Package,
  Play,
  RefreshCw,
  Sparkles,
  Sprout,
  Target,
  Waves,
} from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { normalizeAssessmentReportPayload } from "@/lib/adapters/assessmentAdapter";
import type { AssessmentReportPayload } from "@shared/types/assessment";

/* -------------------------------------------------------------------------- */
/* Editorial image library — photoreal, premium, consistent grading           */
/* -------------------------------------------------------------------------- */
const IMG = {
  cover:
    "https://images.unsplash.com/photo-1605497788044-5a32c7078486?auto=format&fit=crop&w=2000&q=90",
  pattern:
    "https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=1600&q=90",
  scalp:
    "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1600&q=90",
  follicle:
    "https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=1600&q=90",
  hormones:
    "https://images.unsplash.com/photo-1559757175-08fdec6c2839?auto=format&fit=crop&w=1600&q=90",
  nutrients:
    "https://images.unsplash.com/photo-1490818387583-1baba5e638af?auto=format&fit=crop&w=1600&q=90",
  inflammation:
    "https://images.unsplash.com/photo-1606206886066-4c20e2b9d1e1?auto=format&fit=crop&w=1600&q=90",
  microcirc:
    "https://images.unsplash.com/photo-1530026405186-ed1f139313f8?auto=format&fit=crop&w=1600&q=90",
  oxidative:
    "https://images.unsplash.com/photo-1517637382994-f02da38c6728?auto=format&fit=crop&w=1600&q=90",
  recovery:
    "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=1600&q=90",
  future:
    "https://images.unsplash.com/photo-1595163319827-ce152a3aa66e?auto=format&fit=crop&w=2000&q=90",
};

/* Map driver names to a fitting editorial photo */
const DRIVER_VISUALS: { match: RegExp; img: string; tone: string }[] = [
  { match: /hormone|androgen|dht|estrog|thyroid|cortisol/i, img: IMG.hormones, tone: "#F4B942" },
  { match: /nutrient|iron|ferritin|vitamin|protein|deficien/i, img: IMG.nutrients, tone: "#22C55E" },
  { match: /inflamm|scalp|sebum|microbiome|dermatitis/i, img: IMG.inflammation, tone: "#EF6F6C" },
  { match: /circul|micro.?circ|blood|perfusion|vascular/i, img: IMG.microcirc, tone: "#60A5FA" },
  { match: /oxid|stress|free.?radical|antioxidant/i, img: IMG.oxidative, tone: "#A78BFA" },
  { match: /genetic|pattern|aga|follicle|miniatur/i, img: IMG.follicle, tone: "#00C2A8" },
];

function visualForDriver(name: string, index: number) {
  const found = DRIVER_VISUALS.find((d) => d.match.test(name));
  if (found) return found;
  const fallback = [IMG.follicle, IMG.scalp, IMG.hormones, IMG.nutrients, IMG.microcirc];
  const tones = ["#00C2A8", "#F4B942", "#22C55E", "#60A5FA", "#A78BFA"];
  return { img: fallback[index % fallback.length], tone: tones[index % tones.length] };
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */
const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "PARTIAL_FAILURE"]);

// useSearchParams requires a Suspense boundary during prerender.
export default function ReportPage() {
  return (
    <Suspense fallback={null}>
      <ReportPageInner />
    </Suspense>
  );
}

function ReportPageInner() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const assessmentId = String(id ?? "");
  // Signed patient token (?t=) — the status/pdf APIs return full artifact
  // content only for authenticated or token-bearing callers; without it the
  // whole dossier renders fallback placeholders.
  const token = searchParams?.get("t") ?? "";
  const tokenQs = token ? `&t=${encodeURIComponent(token)}` : "";
  const [report, setReport] = useState<AssessmentReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<ReportTab>("clinical");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/assessment/status?id=${assessmentId}${tokenQs}`,
        { cache: "no-store" },
      );
      const json = await res.json();
      const normalized = normalizeAssessmentReportPayload(json);
      setReport(normalized);
      setLoadError(normalized.processing.errors[0] ?? null);
      return normalized;
    } catch (error) {
      console.error("[ReportPage] Error fetching assessment status:", error);
      setLoadError("We could not load the latest report data.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [assessmentId, tokenQs]);

  useEffect(() => {
    let poll: number | undefined;
    let cancelled = false;
    const tick = async () => {
      const normalized = await fetchData();
      if (cancelled) return;
      // Keep polling only while orchestration is still running.
      if (!normalized || !TERMINAL_STATUSES.has(normalized.processing.status)) {
        poll = window.setTimeout(tick, 3000);
      }
    };
    const first = window.setTimeout(tick, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      if (poll !== undefined) window.clearTimeout(poll);
    };
  }, [fetchData]);

  const reportContent = asObject(report?.artifactByType.REPORT?.content);
  const pdfUrl =
    typeof reportContent.patientPdfUrl === "string"
      ? reportContent.patientPdfUrl
      : null;
  const pdfRoute = `/api/assessment/pdf?id=${assessmentId}${tokenQs}`;
  const pdfDownloadRoute = `/api/assessment/pdf?id=${assessmentId}&download=1${tokenQs}`;

  const derived = useMemo(() => deriveDossier(report), [report]);
  const downloadFileName = `${slugifyName(derived.patientName) || "hair-dossier"}.pdf`;

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "linear-gradient(180deg,#07111F 0%,#0A2540 100%)" }}
      >
        <div className="flex flex-col items-center gap-5">
          <div className="h-2 w-2 animate-pulse rounded-full bg-[#00C2A8] shadow-[0_0_18px_#00C2A8]" />
          <p
            className="text-[11px] uppercase tracking-[0.32em] text-white/55"
            style={{ fontFamily: "var(--font-jakarta)" }}
          >
            Composing your dossier
          </p>
        </div>
      </div>
    );
  }

  return (
    <main
      className="relative min-h-screen overflow-x-hidden text-white"
      style={{
        fontFamily: "var(--font-inter)",
        background:
          "linear-gradient(180deg, #07111F 0%, #0A2540 14%, #0A2540 46%, #1B4965 64%, #2C6E8F 76%, #E9EFF6 90%, #F8FAFC 100%)",
      }}
    >
      <AmbientField />

      {/* Floating action bar — minimal, unobtrusive */}
      <div className="fixed right-6 top-6 z-50 flex items-center gap-2">
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-4 py-2 text-[12px] font-medium text-white/85 backdrop-blur-md transition-colors hover:bg-black/50"
          style={{ fontFamily: "var(--font-jakarta)" }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
        <a
          href={pdfDownloadRoute}
          target="_blank"
          rel="noopener noreferrer"
          download={downloadFileName}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#00C2A8] to-[#0A2540] px-4 py-2 text-[12px] font-semibold text-white shadow-[0_12px_30px_-12px_rgba(0,194,168,0.6)]"
          style={{ fontFamily: "var(--font-jakarta)" }}
        >
          <Download className="h-3.5 w-3.5" />
          {pdfUrl ? "Download PDF" : "Check PDF"}
        </a>
        {/* Doctor-reviewed one-page summary — separate from the long-form
            clinical PDF above. Opens the printable Dr FACT sheet. */}
        <a
          href={`/reports/${assessmentId}/one-page${tokenQs ? `?${tokenQs.slice(1)}` : ""}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-[#F4B942]/50 bg-[#F4B942]/15 px-4 py-2 text-[12px] font-semibold text-[#F4B942] backdrop-blur-md transition-colors hover:bg-[#F4B942]/25"
          style={{ fontFamily: "var(--font-jakarta)" }}
          title="Open the doctor-reviewed one-page patient report"
        >
          <FileText className="h-3.5 w-3.5" />
          Patient Report
        </a>
      </div>

      {loadError && (
        <div className="relative z-10 mx-auto mt-4 max-w-3xl px-6">
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-200 backdrop-blur-md">
            {loadError}
          </div>
        </div>
      )}

      <ErrorBoundary title="Cover">
        <CoverPage derived={derived} assessmentId={assessmentId} />
      </ErrorBoundary>

      <TabNav tab={tab} onChange={setTab} />

      {tab === "clinical" && (
        <>
          <ErrorBoundary title="Executive Summary">
            <ExecutiveSummary findings={derived.findings} />
          </ErrorBoundary>

          <ErrorBoundary title="Your responses">
            <QuestionnaireResponses rows={derived.questionnaire} />
          </ErrorBoundary>

          <ErrorBoundary title="Chapter 1">
            <ChapterOne pattern={derived.pattern} />
          </ErrorBoundary>

          <ErrorBoundary title="Chapter 2">
            <ChapterTwo
              drivers={derived.drivers}
              narrative={derived.whyNarrative}
            />
          </ErrorBoundary>
        </>
      )}

      {tab === "products" && (
        <ErrorBoundary title="Chapter 3">
          <ChapterThree
            interventions={derived.interventions}
            protocolLabel={derived.protocolLabel}
            rationale={derived.protocolRationale}
          />
        </ErrorBoundary>
      )}

      {tab === "recovery" && (
        <>
          <ErrorBoundary title="Chapter 4">
            <ChapterFour milestones={derived.milestones} />
          </ErrorBoundary>

          <ErrorBoundary title="Conclusion">
            <ConclusionPage
              conclusion={derived.conclusion}
              patientName={derived.patientName}
              onBeginPlan={() => {
                setTab("products");
                document
                  .getElementById("report-tabs")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            />
          </ErrorBoundary>
        </>
      )}

      <footer className="relative z-10 border-t border-[#0A2540]/8 bg-[#F8FAFC] py-10 text-center">
        <p
          className="text-[10px] uppercase tracking-[0.32em] text-[#0A2540]/45"
          style={{ fontFamily: "var(--font-jakarta)" }}
        >
          HairOS Intelligence Dossier · {assessmentId}
        </p>
      </footer>
    </main>
  );
}

/* ── PAGE 1 · Cover ─────────────────────────────────────────────────────── */
function CoverPage({
  derived,
  assessmentId,
}: {
  derived: ReturnType<typeof deriveDossier>;
  assessmentId: string;
}) {
  return (
    <section className="relative z-10 mx-auto grid min-h-screen max-w-7xl items-center gap-16 px-5 py-24 sm:px-8 lg:grid-cols-[1.05fr_1fr]">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-4 py-1.5 backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5 text-[#F4B942]" />
          <span
            className="text-[11px] uppercase tracking-[0.3em] text-white/80"
            style={{ fontFamily: "var(--font-jakarta)" }}
          >
            HairOS Intelligence Dossier
          </span>
        </div>

        <p
          className="mt-10 text-[12px] uppercase tracking-[0.32em] text-white/50"
          style={{ fontFamily: "var(--font-jakarta)" }}
        >
          Prepared for
        </p>
        <h2
          className="mt-2 text-[30px] font-semibold tracking-[-0.01em] text-white md:text-[36px]"
          style={{ fontFamily: "var(--font-jakarta)" }}
        >
          {derived.patientName}
        </h2>

        <h1
          className="mt-12 text-[44px] font-bold leading-[0.98] tracking-[-0.03em] sm:text-[64px] md:text-[88px] lg:text-[104px]"
          style={{ fontFamily: "var(--font-jakarta)" }}
        >
          Your Hair
          <br />
          <span className="bg-gradient-to-r from-[#F4B942] via-[#FFD98A] to-[#00C2A8] bg-clip-text text-transparent">
            Story.
          </span>
        </h1>

        <p className="mt-8 max-w-xl text-[17px] leading-[1.75] text-white/65">
          A personalized explanation of the biological factors influencing
          your hair today — generated by HairOS Intelligence.
        </p>

        <div className="mt-14 grid max-w-lg grid-cols-1 gap-5 border-t border-white/10 pt-8 sm:grid-cols-3 sm:gap-6">
          <Meta label="Assessment date" value={derived.date} />
          <Meta label="Analysis ID" value={derived.shortId} />
          <Meta label="Clinician" value={derived.clinician} />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative"
      >
        <div className="absolute -inset-12 rounded-[3rem] bg-[radial-gradient(ellipse_at_center,rgba(0,194,168,0.3),transparent_70%)] blur-3xl" />
        <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-white/15 shadow-[0_60px_140px_-30px_rgba(0,0,0,0.9)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={IMG.cover} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07111F] via-[#07111F]/20 to-transparent" />
          <div className="absolute left-6 top-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/35 px-3 py-1.5 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F4B942] shadow-[0_0_8px_#F4B942]" />
            <span
              className="text-[10px] uppercase tracking-[0.28em] text-white/85"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              Volume 01
            </span>
          </div>
          <div className="absolute bottom-7 left-7 right-7 rounded-2xl border border-white/15 bg-black/40 px-5 py-4 backdrop-blur-xl">
            <div
              className="text-[10px] uppercase tracking-[0.28em] text-[#00C2A8]"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              Personal intelligence
            </div>
            <div className="mt-1.5 text-[14px] font-medium leading-snug text-white">
              Crafted from your responses · interpreted through clinical reasoning.
            </div>
          </div>
        </div>
      </motion.div>

      <span className="sr-only">Dossier {assessmentId}</span>
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="text-[10px] uppercase tracking-[0.26em] text-white/45"
        style={{ fontFamily: "var(--font-jakarta)" }}
      >
        {label}
      </div>
      <div
        className="mt-1.5 text-[14px] font-semibold text-white"
        style={{ fontFamily: "var(--font-jakarta)" }}
      >
        {value}
      </div>
    </div>
  );
}

/* ── PAGE 2 · Executive Summary ─────────────────────────────────────────── */
function ExecutiveSummary({ findings }: { findings: Finding[] }) {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-5 sm:px-8 py-28">
      <SectionEyebrow eyebrow="Executive Summary" />
      <h2
        className="mt-4 max-w-3xl text-[34px] font-bold leading-[1.02] tracking-[-0.02em] text-white sm:text-[48px] md:text-[72px]"
        style={{ fontFamily: "var(--font-jakarta)" }}
      >
        What HairOS
        <br />
        <span className="text-white/55">Discovered.</span>
      </h2>
      <p className="mt-6 max-w-xl text-[16px] leading-[1.75] text-white/55">
        The strongest signals across your responses — each one a thread we
        follow through the rest of your story.
      </p>

      <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {findings.map((f, i) => (
          <motion.article
            key={f.title}
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.75, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
            className="group relative overflow-hidden rounded-[1.75rem] border border-white/12 bg-white/[0.04] p-8 backdrop-blur-xl"
          >
            <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-[#00C2A8]/12 blur-2xl transition-opacity group-hover:opacity-80" />
            <div className="relative flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00C2A8]/25 to-[#0A2540]/10 ring-1 ring-white/10">
                <f.Icon className="h-5 w-5 text-[#00C2A8]" />
              </div>
              <ConfidencePill level={f.confidence} />
            </div>
            <h3
              className="relative mt-8 text-[22px] font-bold leading-tight text-white"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              {f.title}
            </h3>
            <p className="relative mt-3 text-[14.5px] leading-[1.7] text-white/65">
              {f.sentence}
            </p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

function ConfidencePill({ level }: { level: "Strong" | "Moderate" | "Emerging" }) {
  const color =
    level === "Strong"
      ? "bg-[#00C2A8]/15 text-[#00C2A8] border-[#00C2A8]/30"
      : level === "Moderate"
        ? "bg-[#F4B942]/15 text-[#F4B942] border-[#F4B942]/30"
        : "bg-white/10 text-white/65 border-white/15";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] ${color}`}
      style={{ fontFamily: "var(--font-jakarta)" }}
    >
      <span className="h-1 w-1 rounded-full bg-current" />
      {level}
    </span>
  );
}

/* ── Questionnaire responses ─ raw selections, evidence cards ───────────────────── */
function QuestionnaireResponses({ rows }: { rows: Selection[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-5 sm:px-8 py-20">
      <SectionEyebrow eyebrow="Your responses" />
      <h2
        className="mt-4 max-w-3xl text-[30px] font-bold leading-[1.04] tracking-[-0.02em] text-white sm:text-[40px] md:text-[56px]"
        style={{ fontFamily: "var(--font-jakarta)" }}
      >
        Questionnaire
        <br />
        <span className="text-white/55">Selections.</span>
      </h2>
      <p className="mt-5 max-w-xl text-[15px] leading-[1.75] text-white/55">
        The raw signals you shared — the foundation HairOS interprets through
        the rest of this dossier.
      </p>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="rounded-2xl border border-white/12 bg-white/[0.04] px-5 py-4 backdrop-blur-xl"
          >
            <p
              className="text-[10px] uppercase tracking-[0.26em] text-[#00C2A8]"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              {row.label}
            </p>
            <p className="mt-2 text-[14.5px] font-medium leading-[1.55] text-white/85">
              {row.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── CHAPTER 1 · What's Happening ───────────────────────────────────────── */
function ChapterOne({ pattern }: { pattern: PatternProfile }) {
  return (
    <section className="relative z-10 mx-auto max-w-7xl px-5 sm:px-8 py-28">
      <ChapterHeader
        number="Chapter One"
        title="What's Happening"
        subtitle="To My Hair"
      />

      <div className="mt-20 grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
        <div className="relative">
          <div className="absolute -inset-10 rounded-[2.5rem] bg-[radial-gradient(ellipse_at_center,rgba(0,194,168,0.24),transparent_70%)] blur-3xl" />
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-white/15 shadow-[0_60px_140px_-30px_rgba(0,0,0,0.85)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={IMG.pattern} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#07111F] via-[#07111F]/15 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/15 bg-black/45 px-5 py-4 backdrop-blur-xl">
              <div
                className="text-[10px] uppercase tracking-[0.26em] text-[#00C2A8]"
                style={{ fontFamily: "var(--font-jakarta)" }}
              >
                Pattern signature
              </div>
              <div
                className="mt-1.5 text-[15px] font-semibold text-white"
                style={{ fontFamily: "var(--font-jakarta)" }}
              >
                {pattern.label}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <DataCard
            Icon={Target}
            label="Hair pattern"
            value={pattern.label}
            sub="The visible signature HairOS classified."
          />
          <DataCard
            Icon={Activity}
            label="Severity"
            value={pattern.severity}
            sub="Where you sit on the clinical continuum."
            progress={pattern.severityPct}
          />
          <DataCard
            Icon={Compass}
            label="Affected regions"
            value={pattern.regions.join(" · ") || "Diffuse"}
            sub="The zones contributing most to the picture."
          />
          <DataCard
            Icon={Waves}
            label="Progression"
            value={pattern.progression}
            sub="The trajectory shaping your timeline."
          />
        </div>
      </div>
    </section>
  );
}

/* ── CHAPTER 2 · Why — the centerpiece of the dossier ───────────────────── */
function ChapterTwo({
  drivers,
  narrative,
}: {
  drivers: Driver[];
  narrative: string;
}) {
  return (
    <section className="relative z-10 mx-auto max-w-7xl px-5 sm:px-8 py-28">
      <ChapterHeader
        number="Chapter Two"
        title="Why Is This"
        subtitle="Happening To Me?"
      />

      {narrative && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9 }}
          className="mt-14 max-w-3xl rounded-[1.75rem] border border-white/12 bg-white/[0.04] p-8 backdrop-blur-xl"
        >
          <p
            className="text-[10px] uppercase tracking-[0.32em] text-[#00C2A8]"
            style={{ fontFamily: "var(--font-jakarta)" }}
          >
            The narrative
          </p>
          <p className="mt-4 text-[17px] leading-[1.8] text-white/80">
            {narrative}
          </p>
        </motion.div>
      )}

      <div className="mt-24 space-y-32">
        {drivers.map((d, i) => (
          <DriverStory key={d.name + i} driver={d} index={i} flip={i % 2 === 1} />
        ))}
      </div>
    </section>
  );
}

/* The 5-step biological storytelling block for one driver */
function DriverStory({
  driver,
  index,
  flip,
}: {
  driver: Driver;
  index: number;
  flip: boolean;
}) {
  const visual = visualForDriver(driver.name, index);

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      className="grid items-center gap-14 lg:grid-cols-[1fr_1.1fr]"
    >
      {/* Imagery */}
      <div className={`relative ${flip ? "lg:order-2" : ""}`}>
        <div
          className="absolute -inset-10 rounded-[2.5rem] blur-3xl"
          style={{
            background: `radial-gradient(ellipse at center, ${visual.tone}33, transparent 70%)`,
          }}
        />
        <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-white/15 shadow-[0_60px_140px_-30px_rgba(0,0,0,0.85)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={visual.img} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07111F] via-[#07111F]/20 to-transparent" />
          <div className="absolute left-6 top-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 backdrop-blur-md">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: visual.tone, boxShadow: `0 0 10px ${visual.tone}` }}
            />
            <span
              className="text-[10px] uppercase tracking-[0.28em] text-white/85"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              Driver · {String(index + 1).padStart(2, "0")}
            </span>
          </div>
        </div>
      </div>

      {/* Narrative */}
      <div className={`${flip ? "lg:order-1" : ""}`}>
        <p
          className="text-[11px] uppercase tracking-[0.32em]"
          style={{ color: visual.tone, fontFamily: "var(--font-jakarta)" }}
        >
          Detected driver
        </p>
        <h3
          className="mt-3 text-[30px] font-bold leading-[1.02] tracking-[-0.02em] text-white sm:text-[40px] md:text-[52px]"
          style={{ fontFamily: "var(--font-jakarta)" }}
        >
          {driver.name}
        </h3>

        <div className="mt-10 space-y-5">
          <BiologyStep
            tone={visual.tone}
            label="Biological mechanism"
            body={driver.mechanism}
          />
          <BiologyStep
            tone={visual.tone}
            label="Follicular impact"
            body={driver.follicular}
          />
          <BiologyStep
            tone={visual.tone}
            label="Hair-cycle impact"
            body={driver.cycle}
          />

          {driver.symptoms.length > 0 && (
            <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-6 backdrop-blur-xl">
              <p
                className="text-[10px] uppercase tracking-[0.28em]"
                style={{ color: visual.tone, fontFamily: "var(--font-jakarta)" }}
              >
                Observed symptoms
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {driver.symptoms.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-white/15 bg-white/[0.05] px-3.5 py-1.5 text-[12px] text-white/80"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function BiologyStep({
  tone,
  label,
  body,
}: {
  tone: string;
  label: string;
  body: string;
}) {
  return (
    <div className="relative rounded-2xl border border-white/12 bg-white/[0.04] p-6 backdrop-blur-xl">
      <div
        className="absolute left-0 top-6 bottom-6 w-[3px] rounded-r-full"
        style={{ background: tone, boxShadow: `0 0 12px ${tone}66` }}
      />
      <div className="pl-3">
        <p
          className="text-[10px] uppercase tracking-[0.28em] text-white/55"
          style={{ fontFamily: "var(--font-jakarta)" }}
        >
          {label}
        </p>
        <p className="mt-2.5 text-[15.5px] leading-[1.75] text-white/85">{body}</p>
      </div>
    </div>
  );
}

/* ── CHAPTER 3 · How We Rebuild Growth ──────────────────────────────────── */
function ChapterThree({
  interventions,
  protocolLabel,
  rationale,
}: {
  interventions: Intervention[];
  protocolLabel: string;
  rationale: string;
}) {
  return (
    <section className="relative z-10 mx-auto max-w-7xl px-5 sm:px-8 py-28">
      <ChapterHeader
        number="Chapter Three"
        title="How We"
        subtitle="Rebuild Growth"
      />

      <div className="mt-20 grid gap-14 lg:grid-cols-[1fr_1.4fr]">
        <div className="relative">
          <div className="absolute -inset-10 rounded-[2.5rem] bg-[radial-gradient(ellipse_at_center,rgba(34,197,94,0.22),transparent_70%)] blur-3xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-white/15 shadow-[0_60px_140px_-30px_rgba(0,0,0,0.85)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={IMG.recovery} alt="" className="aspect-[4/5] w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#07111F] via-[#07111F]/10 to-transparent" />
          </div>
          {protocolLabel && (
            <div className="relative mt-6 rounded-[1.75rem] border border-white/12 bg-white/[0.04] p-7 backdrop-blur-xl">
              <p
                className="text-[10px] uppercase tracking-[0.28em] text-[#22C55E]"
                style={{ fontFamily: "var(--font-jakarta)" }}
              >
                Protocol
              </p>
              <p
                className="mt-3 text-[20px] font-semibold text-white"
                style={{ fontFamily: "var(--font-jakarta)" }}
              >
                {protocolLabel}
              </p>
              {rationale && (
                <p className="mt-3 text-[14px] leading-[1.75] text-white/65">{rationale}</p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-7">
          {interventions.map((iv, i) => (
            <motion.div
              key={iv.name + i}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.75, delay: i * 0.06 }}
              className="relative overflow-hidden rounded-[1.75rem] border border-white/12 bg-white/[0.04] p-8 backdrop-blur-xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#22C55E]/22 to-[#0A2540]/10 ring-1 ring-white/10">
                    <Sprout className="h-5 w-5 text-[#22C55E]" />
                  </div>
                  <div>
                    <p
                      className="text-[10px] uppercase tracking-[0.26em] text-[#22C55E]"
                      style={{ fontFamily: "var(--font-jakarta)" }}
                    >
                      Phase {iv.phase}
                    </p>
                    <h3
                      className="mt-1 text-[22px] font-bold text-white"
                      style={{ fontFamily: "var(--font-jakarta)" }}
                    >
                      {iv.name}
                    </h3>
                  </div>
                </div>
                <ArrowRight className="mt-2 h-5 w-5 text-white/30" />
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <Block label="Problem" value={iv.problem} tone="#EF6F6C" />
                <Block label="Why it matters" value={iv.whyItMatters} tone="#F4B942" />
                <Block label="How it helps" value={iv.howItHelps} tone="#00C2A8" />
                <Block label="Expected impact" value={iv.impact} tone="#22C55E" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Block({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div
        className="text-[10px] uppercase tracking-[0.24em]"
        style={{ color: tone, fontFamily: "var(--font-jakarta)" }}
      >
        {label}
      </div>
      <div className="mt-2 text-[13.5px] leading-[1.65] text-white/85">{value}</div>
    </div>
  );
}

/* ── CHAPTER 4 · Future Hair Journey ────────────────────────────────────── */
function ChapterFour({ milestones }: { milestones: Milestone[] }) {
  return (
    <section className="relative z-10 mx-auto max-w-7xl px-5 sm:px-8 py-28">
      <ChapterHeader
        number="Chapter Four"
        title="Your Future"
        subtitle="Hair Journey"
      />

      <div className="relative mt-20">
        <div className="absolute left-0 right-0 top-12 hidden h-px bg-gradient-to-r from-transparent via-[#00C2A8]/40 to-transparent lg:block" />
        <div className="grid gap-7 lg:grid-cols-4">
          {milestones.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.8, delay: i * 0.1 }}
              className="relative"
            >
              <div
                className="relative z-10 mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-full border border-[#00C2A8]/40 bg-[#0A2540] text-[12px] font-semibold text-[#00C2A8] shadow-[0_0_0_6px_rgba(7,17,31,0.9)]"
                style={{ fontFamily: "var(--font-jakarta)" }}
              >
                {i + 1}
              </div>
              <div className="rounded-[1.75rem] border border-white/12 bg-white/[0.04] p-7 backdrop-blur-xl">
                <p
                  className="text-[10px] uppercase tracking-[0.3em] text-[#F4B942]"
                  style={{ fontFamily: "var(--font-jakarta)" }}
                >
                  {m.label}
                </p>
                <h4
                  className="mt-2 text-[19px] font-bold text-white"
                  style={{ fontFamily: "var(--font-jakarta)" }}
                >
                  {m.headline}
                </h4>
                <ul className="mt-5 space-y-2.5 text-[13px] leading-[1.65] text-white/65">
                  {m.bullets.map((b) => (
                    <li key={b} className="flex gap-2.5">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#00C2A8]" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="relative mt-20 overflow-hidden rounded-[2rem] border border-white/15 shadow-[0_60px_140px_-30px_rgba(0,0,0,0.85)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={IMG.future} alt="" className="h-80 w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#07111F]/85 via-[#07111F]/35 to-transparent" />
        <div className="absolute inset-0 flex items-center px-12">
          <div className="max-w-md">
            <p
              className="text-[10px] uppercase tracking-[0.3em] text-[#00C2A8]"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              Expected biological progression
            </p>
            <h4
              className="mt-3 text-[30px] font-bold leading-tight text-white"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              Recovery is a continuum — not a destination.
            </h4>
            <p className="mt-3 text-[14px] leading-[1.75] text-white/75">
              Outcomes are never guaranteed. The roadmap above describes the
              typical direction of biological change when the plan is followed
              consistently.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Conclusion ─────────────────────────────────────────────────────────── */
function ConclusionPage({
  conclusion,
  patientName,
  onBeginPlan,
}: {
  conclusion: string;
  patientName: string;
  onBeginPlan: () => void;
}) {
  return (
    <section className="relative z-10 px-5 pb-36 pt-16 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[2rem] bg-white p-14 text-center shadow-[0_60px_140px_-30px_rgba(10,37,64,0.45)] md:p-24"
        >
          <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-[#00C2A8]/14 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-[#F4B942]/16 blur-3xl" />

          <Award className="relative mx-auto h-10 w-10 text-[#00C2A8]" />
          <p
            className="relative mt-6 text-[11px] uppercase tracking-[0.34em] text-[#00C2A8]"
            style={{ fontFamily: "var(--font-jakarta)" }}
          >
            Closing chapter
          </p>
          <h2
            className="relative mt-5 text-[34px] font-bold leading-[1.04] tracking-[-0.02em] text-[#0A2540] sm:text-[48px] md:text-[68px]"
            style={{ fontFamily: "var(--font-jakarta)" }}
          >
            Your Hair
            <br />
            Has A Story.
          </h2>
          <p
            className="relative mx-auto mt-4 max-w-md text-[14px] leading-[1.7] text-[#0A2540]/55"
            style={{ fontFamily: "var(--font-jakarta)" }}
          >
            And now, {patientName}, you understand it.
          </p>
          <p className="relative mx-auto mt-8 max-w-2xl text-[17px] leading-[1.85] text-[#1B4965]/85">
            {conclusion}
          </p>

          <button
            type="button"
            onClick={onBeginPlan}
            className="relative mt-12 inline-flex items-center gap-3 rounded-full bg-[#0A2540] px-8 py-4 text-[13.5px] font-semibold text-white transition-transform hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00C2A8]"
            style={{ fontFamily: "var(--font-jakarta)" }}
          >
            <Play className="h-3.5 w-3.5 fill-white" />
            Begin the recovery plan
          </button>
        </motion.div>
      </div>
    </section>
  );
}

/* ── Tab navigation ─────────────────────────────────────────────────────── */
type ReportTab = "clinical" | "products" | "recovery";

function TabNav({
  tab,
  onChange,
}: {
  tab: ReportTab;
  onChange: (t: ReportTab) => void;
}) {
  const items: {
    id: ReportTab;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: "clinical", label: "Questionnaire & clinical interpretation", Icon: ClipboardList },
    { id: "products", label: "Product recommendation protocol", Icon: Package },
    { id: "recovery", label: "Recovery, diet & lifestyle", Icon: Sparkles },
  ];
  return (
    <div id="report-tabs" className="sticky top-4 z-40 mx-auto mt-6 max-w-5xl px-6 scroll-mt-4">
      <div
        role="tablist"
        aria-label="Clinical output"
        className="flex flex-wrap gap-1 rounded-full border border-white/15 bg-black/45 p-1 backdrop-blur-xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]"
      >
        {items.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(id)}
              className={`flex-1 min-w-[160px] inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[12px] font-semibold transition ${
                active
                  ? "bg-gradient-to-r from-[#00C2A8] to-[#0A2540] text-white shadow-[0_12px_30px_-12px_rgba(0,194,168,0.6)]"
                  : "text-white/70 hover:text-white hover:bg-white/[0.06]"
              }`}
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Shared building blocks ─────────────────────────────────────────────── */
function ChapterHeader({
  number,
  title,
  subtitle,
}: {
  number: string;
  title: string;
  subtitle: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-end justify-between gap-6"
    >
      <div>
        <p
          className="text-[11px] uppercase tracking-[0.34em] text-[#00C2A8]"
          style={{ fontFamily: "var(--font-jakarta)" }}
        >
          {number}
        </p>
        <h2
          className="mt-4 text-[34px] font-bold leading-[1.02] tracking-[-0.025em] text-white sm:text-[52px] md:text-[80px]"
          style={{ fontFamily: "var(--font-jakarta)" }}
        >
          {title}
          <br />
          <span className="text-white/55">{subtitle}</span>
        </h2>
      </div>
      <div className="hidden h-px flex-1 bg-gradient-to-r from-white/0 to-white/15 md:block" />
    </motion.div>
  );
}

function SectionEyebrow({ eyebrow }: { eyebrow: string }) {
  return (
    <div className="inline-flex items-center gap-3">
      <span className="h-px w-10 bg-[#00C2A8]" />
      <p
        className="text-[11px] uppercase tracking-[0.34em] text-[#00C2A8]"
        style={{ fontFamily: "var(--font-jakarta)" }}
      >
        {eyebrow}
      </p>
    </div>
  );
}

function DataCard({
  Icon,
  label,
  value,
  sub,
  progress,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  progress?: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-white/12 bg-white/[0.04] p-7 backdrop-blur-xl">
      <div className="flex items-start gap-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00C2A8]/25 to-[#0A2540]/10 ring-1 ring-white/10">
          <Icon className="h-5 w-5 text-[#00C2A8]" />
        </div>
        <div className="flex-1">
          <p
            className="text-[10px] uppercase tracking-[0.26em] text-white/45"
            style={{ fontFamily: "var(--font-jakarta)" }}
          >
            {label}
          </p>
          <p
            className="mt-1.5 text-[22px] font-bold text-white"
            style={{ fontFamily: "var(--font-jakarta)" }}
          >
            {value}
          </p>
          <p className="mt-2 text-[12.5px] leading-[1.6] text-white/55">{sub}</p>
          {typeof progress === "number" && (
            <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#00C2A8] to-[#F4B942]"
                style={{ width: `${Math.max(8, Math.min(100, progress))}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Ambient field — calmer, fewer points, no dashboard noise ──────────── */
function AmbientField() {
  const points = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    x: (i * 173) % 100,
    y: (i * 89) % 100,
    delay: (i % 8) * 0.6,
    duration: 8 + (i % 5),
  }));
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.22]"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <defs>
          <radialGradient id="rep-dot" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00C2A8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#00C2A8" stopOpacity="0" />
          </radialGradient>
        </defs>
        {points.map((p) => (
          <circle key={p.id} cx={p.x} cy={p.y} r="0.32" fill="url(#rep-dot)">
            <animate
              attributeName="opacity"
              values="0.15;1;0.15"
              dur={`${p.duration}s`}
              begin={`${p.delay}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
      </svg>
      <motion.div
        className="absolute h-[760px] w-[760px] rounded-full bg-[#00C2A8]/8 blur-3xl"
        animate={{ x: [-100, 80, -100], y: [-80, 60, -80] }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
        style={{ top: "6%", left: "55%" }}
      />
      <motion.div
        className="absolute h-[640px] w-[640px] rounded-full bg-[#F4B942]/8 blur-3xl"
        animate={{ x: [60, -60, 60], y: [60, -40, 60] }}
        transition={{ duration: 34, repeat: Infinity, ease: "easeInOut" }}
        style={{ top: "38%", left: "-10%" }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Dossier derivation — translate the artifact bag into chaptered shape       */
/* -------------------------------------------------------------------------- */
type Finding = {
  title: string;
  sentence: string;
  confidence: "Strong" | "Moderate" | "Emerging";
  Icon: React.ComponentType<{ className?: string }>;
};

type PatternProfile = {
  label: string;
  severity: string;
  severityPct: number;
  regions: string[];
  progression: string;
};

type Selection = { label: string; value: string };

type Driver = {
  name: string;
  mechanism: string;
  follicular: string;
  cycle: string;
  symptoms: string[];
  Icon: React.ComponentType<{ className?: string }>;
};

type Intervention = {
  phase: string;
  name: string;
  problem: string;
  whyItMatters: string;
  howItHelps: string;
  impact: string;
};

type Milestone = { label: string; headline: string; bullets: string[] };

const DRIVER_ICONS = [Microscope, FlaskConical, Droplet, Heart, Leaf, Waves];

function deriveDossier(report: AssessmentReportPayload | null) {
  const clinical = asObject(report?.artifactByType.CLINICAL_REASONING?.content);
  const severity = asObject(report?.artifactByType.SEVERITY_ANALYSIS?.content);
  const recs = asObject(report?.artifactByType.RECOMMENDATIONS?.content);
  const narratives = report?.narratives;
  const clinicalReport = asObject(narratives?.clinicalReport);
  const patientSummary = asObject(clinicalReport.patientSummary);
  const selections = asObject(patientSummary.questionnaireSelections);

  const selectionRows: Array<[string, unknown]> = [
    ["Duration", selections.duration],
    ["Shedding intensity", selections.count],
    ["Severity grade", asString(selections.grade).replace(/^Grade\s*\d+\s*[—–-]+\s*/i, "") || undefined],
    ["Hair pattern", selections.hairType],
    ["Scalp", selections.scalp],
    ["Suspected cause", selections.cause],
    ["Lifestyle", selections.lifestyle],
    ["Hormonal", selections.hormonal],
    ["Thyroid", selections.thyroid],
    ["Immunity", selections.immunity],
    ["Deficiency", selections.deficiency],
    ["Gut", selections.gut],
    ["Diet", selections.diet],
    ["Previous treatments", selections.treatment],
    ["Goal", selections.goal],
  ];
  const questionnaire: Selection[] = selectionRows
    .map(([label, raw]) => {
      const value = Array.isArray(raw)
        ? raw.map((x) => asString(x)).filter(Boolean).join(" · ")
        : asString(raw);
      return { label, value };
    })
    .filter((row) => row.value.trim().length > 0);

  const patientName =
    asString(report?.patient?.name) ||
    asString(clinical.patientName) ||
    asString(asObject(report?.artifactByType.REPORT?.content).patientName) ||
    "Your personal dossier";

  const clinician =
    asString(asObject(report?.artifactByType.REPORT?.content).clinicianName) ||
    asString(clinical.clinicianName) ||
    "HairOS Clinical";

  const dateStr = (() => {
    const raw =
      asString(asObject(report?.artifactByType.REPORT?.content).generatedAt) ||
      asString(clinical.assessmentDate);
    const d = raw ? new Date(raw) : new Date();
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  })();

  /* ─ Findings ─ */
  const rawFindings = arr(clinical.keyFindings) || arr(clinical.topFindings) || [];
  const fallbackFindings: Finding[] = [
    {
      title: "Pattern profile detected",
      sentence: "A clear pattern signature emerged from your responses.",
      confidence: "Strong",
      Icon: Target,
    },
    {
      title: "Biological drivers identified",
      sentence: "Internal contributors are influencing your hair cycle.",
      confidence: "Moderate",
      Icon: Microscope,
    },
    {
      title: "Recovery potential is meaningful",
      sentence: "The foundations for measurable improvement are in place.",
      confidence: "Strong",
      Icon: Sprout,
    },
  ];
  const findings: Finding[] =
    rawFindings.length > 0
      ? rawFindings.slice(0, 5).map((f, i) => ({
          title: asString(asObject(f).title) || asString(f) || `Finding ${i + 1}`,
          sentence:
            asString(asObject(f).summary) ||
            asString(asObject(f).description) ||
            "A signal HairOS isolated from your responses.",
          confidence: pickConfidence(asObject(f).confidence),
          Icon: DRIVER_ICONS[i % DRIVER_ICONS.length],
        }))
      : fallbackFindings;

  /* ─ Pattern ─ */
  const sevLabel =
    asString(severity.severityLabel) ||
    asString(severity.severity) ||
    asString(severity.classification) ||
    "Under assessment";
  const sevScore =
    typeof severity.severityScore === "number"
      ? (severity.severityScore as number)
      : typeof severity.score === "number"
        ? (severity.score as number)
        : 45;
  const pattern: PatternProfile = {
    label:
      asString(clinical.pattern) ||
      asString(clinical.patternClassification) ||
      asString(severity.patternLabel) ||
      "Diffuse thinning",
    severity: sevLabel,
    severityPct: typeof sevScore === "number" ? Math.min(100, sevScore) : 40,
    regions:
      (arr(clinical.affectedRegions) as unknown[])
        .map((r) => asString(r))
        .filter(Boolean) || [],
    progression:
      asString(clinical.progression) ||
      asString(severity.progression) ||
      "Gradual",
  };

  /* ─ Drivers ─ */
  // Note: arr() always returns an array, so `||` chaining never falls through
  // an empty list — pick the first source that actually has entries. The V4
  // clinical report stores causes under rootCauseAnalysis.{primary,secondary,
  // amplifiers} with condition/clinicalRelevance/supportingSignals fields.
  const rootCauseAnalysis = asObject(clinicalReport.rootCauseAnalysis);
  const flattenedCauses = [
    ...arr(rootCauseAnalysis.primary),
    ...arr(rootCauseAnalysis.secondary),
    ...arr(rootCauseAnalysis.amplifiers),
  ];
  const enrichedCauses =
    [
      arr(narratives?.enrichedRootCauses),
      arr(clinical.rootCauses),
      flattenedCauses,
    ].find((list) => list.length > 0) ?? [];
  const drivers: Driver[] = enrichedCauses.slice(0, 5).map((c, i) => {
    const o = asObject(c);
    return {
      name:
        asString(o.name) ||
        asString(o.cause) ||
        asString(o.condition) ||
        `Driver ${i + 1}`,
      mechanism:
        asString(o.mechanism) ||
        asString(o.explanation) ||
        asString(o.clinicalRelevance) ||
        "A biological pathway shaping your hair cycle.",
      follicular:
        asString(o.follicularImpact) ||
        // rootCauseAnalysis uses `impact` as a grade word ("Low"/"High"), not
        // prose — only surface it when it reads as a sentence.
        (asString(o.impact).length > 16 ? asString(o.impact) : "") ||
        "Disrupts follicle function over time.",
      cycle:
        asString(o.hairCycleImpact) ||
        asString(o.cycleImpact) ||
        "Shortens the active growth phase.",
      symptoms: (arr(o.symptoms).length > 0 ? arr(o.symptoms) : arr(o.supportingSignals))
        .map((s) => asString(s))
        .filter(Boolean),
      Icon: DRIVER_ICONS[i % DRIVER_ICONS.length],
    };
  });
  if (drivers.length === 0) {
    drivers.push({
      name: "Awaiting clinical interpretation",
      mechanism:
        "HairOS is still composing the biological narrative for your responses.",
      follicular: "Pending",
      cycle: "Pending",
      symptoms: [],
      Icon: Microscope,
    });
  }

  /* ─ Narrative ─ */
  const whyNarrative =
    asString(asObject(narratives?.patientNarrative).full) ||
    asString(asObject(narratives?.patientNarrative).short) ||
    asString(asObject(narratives?.patientNarrative).body) ||
    asString(asObject(narratives?.patientNarrative).summary) ||
    "Your story is being composed — each driver below weaves into a coherent picture of why this is happening.";

  /* ─ Interventions ─ */
  const kits = arr(recs.rankedKits) || [];
  const enrichedNeeds = arr(narratives?.enrichedTherapyNeeds) || [];
  const interventions: Intervention[] = kits.slice(0, 4).map((k, i) => {
    const kit = asObject(k);
    const need = asObject(enrichedNeeds[i]);
    return {
      phase: String(kit.phase ?? i + 1),
      name: asString(kit.kitId) || asString(kit.name) || `Phase ${i + 1} intervention`,
      problem:
        asString(need.problem) ||
        (arr(kit.matchedNeeds) || []).slice(0, 2).map((n) => asString(n)).join(" · ") ||
        "Targets a detected biological gap.",
      whyItMatters:
        asString(need.whyItMatters) ||
        "Restores a foundation the hair cycle depends on.",
      howItHelps:
        asString(need.howItHelps) ||
        (arr(kit.reasons) || []).slice(0, 1).map((r) => asString(r))[0] ||
        "Delivers the inputs the follicle needs to recover.",
      impact:
        asString(need.expectedImpact) ||
        "Improved scalp environment and growth-phase support.",
    };
  });
  if (interventions.length === 0) {
    interventions.push({
      phase: "1",
      name: "Protocol composition in progress",
      problem: "Recommendations are still being generated.",
      whyItMatters: "Each intervention will tie back to a specific detected driver.",
      howItHelps: "Pending",
      impact: "Pending",
    });
  }

  /* ─ Milestones ─ */
  const milestones: Milestone[] = [
    {
      label: "Month 1",
      headline: "Foundations begin",
      bullets: [
        "Scalp environment starts to settle",
        "Inflammatory signals soften",
        "Nutrient delivery improves",
      ],
    },
    {
      label: "Month 3",
      headline: "Shedding stabilizes",
      bullets: [
        "Excess fall reduces",
        "Hair feels stronger at the root",
        "Scalp comfort improves",
      ],
    },
    {
      label: "Month 6",
      headline: "Visible regrowth",
      bullets: [
        "Density signals along thinning zones",
        "New growth emerges at the hairline",
        "Texture and shine return",
      ],
    },
    {
      label: "Month 12",
      headline: "Cycle stabilization",
      bullets: [
        "Hair cycle rhythm normalizes",
        "Long-term growth pattern strengthens",
        "Maintenance becomes the focus",
      ],
    },
  ];

  /* ─ Conclusion ─ */
  const conclusion =
    asString(asObject(narratives?.prognosis).full) ||
    asString(asObject(narratives?.prognosis).short) ||
    asString(asObject(narratives?.prognosis).body) ||
    asString(asObject(narratives?.prognosis).summary) ||
    "What HairOS discovered, why it matters, and what can improve are now part of a single, clear picture. With consistency, the path forward is realistic — and built around the way your biology actually behaves.";

  return {
    patientName,
    clinician,
    date: dateStr,
    shortId: report ? report.assessmentId?.slice(0, 8).toUpperCase?.() ?? "—" : "—",
    findings,
    questionnaire,
    pattern,
    drivers,
    whyNarrative,
    interventions,
    protocolLabel: asString(recs.protocolLabel) || "Recommended protocol",
    protocolRationale: asString(recs.protocolRationale) || "",
    milestones,
    conclusion,
  };
}

/* -------------------------------------------------------------------------- */
/* Utility coercions                                                          */
/* -------------------------------------------------------------------------- */
function asObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
function pickConfidence(v: unknown): Finding["confidence"] {
  const s = asString(v).toLowerCase();
  if (s.includes("strong") || s.includes("high")) return "Strong";
  if (s.includes("moderate") || s.includes("medium")) return "Moderate";
  if (s.includes("emerg") || s.includes("low")) return "Emerging";
  if (typeof v === "number") {
    if (v >= 0.7) return "Strong";
    if (v >= 0.4) return "Moderate";
    return "Emerging";
  }
  return "Moderate";
}





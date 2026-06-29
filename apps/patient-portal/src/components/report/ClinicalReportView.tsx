import type { ClinicalReport } from "@hairos/packages/ai-engine/report-engine/types";
import { composeNarrativeV3 } from "@hairos/packages/ai-engine/report-engine/v3";
import { V3RecommendedKits } from "./PatientNarrativeV3";

// ────────────────────────────────────────────────────────────────────────────
// Patient report view — section order
//
//   1. Hero (name, age, gender, goal)
//   2. Your questionnaire selections          (raw signals, evidence cards)
//   3. Clinical summary & interpretation      (per Q4–Q13 condition mapping)
//   4. Recommended recovery protocol          (V3 — kit mechanism + verbatim
//                                              formulation rationale side-by-side)
//   5. Topical recommendations
//   6. Clinical Insight & Recovery Story      (patient-facing narrative)
//   7. Recovery milestones                    (universal — same for every patient)
//   8. General guidance — diet & lifestyle    (condition-agnostic reference)
//   9. Footer note
//
// Design system: warm stone neutrals + a single sophisticated teal accent,
// restrained amber for highlights. Serif for hero / numerals, sans for body.
// ────────────────────────────────────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
      {children}
    </p>
  );
}

function SectionTitle({ children, eyebrow }: { children: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="space-y-1.5">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h3 className="font-serif text-2xl font-semibold tracking-tight text-slate-900">
        {children}
      </h3>
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_-4px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_-8px_rgba(15,23,42,0.10)] ${className}`}
    >
      {children}
    </article>
  );
}

function isClinicalReport(value: unknown): value is ClinicalReport {
  return !!value && typeof value === "object" && "patientSummary" in (value as object);
}

// ── §2 — Questionnaire selections ─────────────────────────────────────────
function QuestionnaireSelections({ report }: { report: ClinicalReport }) {
  const sel = report.patientSummary.questionnaireSelections;
  const rowsRaw: Array<[string, string[] | string | undefined]> = [
    ["Duration", sel.duration],
    ["Shedding intensity", sel.count],
    ["Severity grade", sel.grade],
    ["Hair pattern", sel.hairType],
    ["Scalp", sel.scalp],
    ["Suspected cause", sel.cause],
    ["Lifestyle", sel.lifestyle],
    ["Hormonal", sel.hormonal],
    ["Thyroid", sel.thyroid],
    ["Immunity", sel.immunity],
    ["Deficiency", sel.deficiency],
    ["Gut", sel.gut],
    ["Diet", sel.diet],
    ["Previous treatments", sel.treatment],
    ["Goal", sel.goal],
  ];
  const rows = rowsRaw.filter(([, value]) => {
    if (value === undefined) return false;
    return Array.isArray(value) ? value.length > 0 : String(value).trim().length > 0;
  });

  if (rows.length === 0) return null;

  return (
    <section className="space-y-5">
      <SectionTitle eyebrow="Your assessment">Questionnaire selections</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-stone-200 bg-white px-4 py-3 transition-colors hover:border-teal-200"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">
              {label}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-800">
              {Array.isArray(value) ? value.join(", ") : value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── §3 — Clinical summary & interpretation ────────────────────────────────
function ClinicalSummaryAndInterpretation({ report }: { report: ClinicalReport }) {
  const items = report.patientSummary.clinicalInterpretation;
  if (items.length === 0) return null;

  return (
    <section className="space-y-5">
      <SectionTitle eyebrow="What we noticed">Clinical summary &amp; interpretation</SectionTitle>
      <p className="text-sm leading-relaxed text-slate-600">
        Each selection you made was reviewed and matched to the most likely clinical pattern. Here
        is how those signals translate into hair-cycle terms.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item, i) => (
          <Card key={`${item.signal}-${i}`}>
            <div className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
              <div className="flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{item.signal}</p>
                  {item.condition && (
                    <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-700">
                      {item.condition}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.interpretation}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

// ── §6 — Clinical Insight & Recovery Story ──────────────────────────────────
function ClinicalInsightStorySection({ report }: { report: ClinicalReport }) {
  const story = report.clinicalInsightStory;
  if (!story?.yourHairStory) return null;

  const sections: Array<{ key: string; eyebrow: string; title: string; body: string }> = [
    { key: "s1", eyebrow: "Section 1", title: "Your hair story",                body: story.yourHairStory },
    { key: "s2", eyebrow: "Section 2", title: "What we found",                  body: story.whyThisMayBeHappening },
    { key: "s3", eyebrow: "Section 3", title: "Your recovery plan",             body: story.whyThisPlanWasRecommended },
    { key: "s4", eyebrow: "Section 4", title: "What recovery could look like",  body: story.whatToExpect },
  ];

  return (
    <section className="space-y-5">
      <SectionTitle eyebrow="Clinical insight · your story">
        Clinical insight & recovery story
      </SectionTitle>
      <p className="text-sm leading-relaxed text-slate-600">
        Based on the information you shared with us — the factors that may be
        influencing your hair, why they matter, why this plan was selected, and
        what realistic progress may look like.
      </p>

      <article className="relative overflow-hidden rounded-3xl border border-stone-200 bg-gradient-to-br from-teal-50/40 via-white to-amber-50/30 p-6 sm:p-8">
        <div className="absolute -left-12 top-1/2 hidden h-20 w-1 -translate-y-1/2 rounded-full bg-gradient-to-b from-teal-300 via-teal-400 to-teal-600 sm:block" />
        <ol className="space-y-6">
          {sections.map((s) => (
            <li key={s.key}>
              <div className="flex items-baseline gap-3">
                <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-800">
                  {s.eyebrow}
                </span>
                <h4 className="font-serif text-base font-semibold tracking-tight text-slate-900">
                  {s.title}
                </h4>
              </div>
              <p className="mt-2 font-serif text-base leading-[1.7] text-slate-700">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </article>
    </section>
  );
}

// ── §6 — Recovery Milestones (universal, identical for every report) ─────
function RecoveryMilestonesSection({ report }: { report: ClinicalReport }) {
  const milestones = report.recoveryMilestones;
  if (!milestones || milestones.length === 0) return null;

  return (
    <section className="space-y-5">
      <SectionTitle eyebrow="The road ahead">Recovery milestones</SectionTitle>
      <p className="text-sm leading-relaxed text-slate-600">
        A realistic clinical expectation framework for your recovery journey.
      </p>
      <ol className="relative space-y-6 border-l border-stone-200 pl-8">
        {milestones.map((m, i) => (
          <li key={`${m.window}-${i}`} className="relative">
            <span className="absolute -left-[2.20rem] top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-teal-300 bg-white">
              <span className="h-2 w-2 rounded-full bg-teal-500" />
            </span>
            <p className="font-serif text-xl font-semibold tracking-tight text-teal-800">
              {m.window}
            </p>
            <ul className="mt-2 space-y-2">
              {m.bullets.map((b, j) => (
                <li
                  key={j}
                  className="flex gap-3 text-sm leading-relaxed text-slate-700"
                >
                  <span className="mt-[0.55rem] block h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ── §7 — Topical recommendations ──────────────────────────────────────────
function TopicalRecommendations({ report }: { report: ClinicalReport }) {
  if (report.topicalRecommendations.length === 0) return null;

  return (
    <section className="space-y-5">
      <SectionTitle eyebrow="Outside-in care">Topical recommendations</SectionTitle>
      <div className="grid gap-4 md:grid-cols-2">
        {report.topicalRecommendations.map((topical) => (
          <Card key={topical.name}>
            <p className="font-serif text-base font-semibold tracking-tight text-slate-900">
              {topical.name}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{topical.whySelected}</p>
            <div className="mt-3 space-y-2 border-t border-stone-100 pt-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                  How to use
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{topical.usage}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                  Clinical note
                </p>
                <p className="mt-0.5 text-xs italic leading-relaxed text-slate-500">
                  {topical.note}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {report.topicalCautions && report.topicalCautions.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
          <Eyebrow>
            <span className="text-amber-800">Important cautions</span>
          </Eyebrow>
          <ul className="mt-3 space-y-2">
            {report.topicalCautions.map((c, i) => (
              <li key={i} className="flex gap-3 text-sm text-slate-700">
                <span className="mt-[0.45rem] block h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                <span>
                  <span className="font-semibold text-slate-900">{c.name}</span>
                  <span className="text-slate-600"> — {c.reason}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ── §8 — General guidance ─────────────────────────────────────────────────
// Restructured for clarity: short intro, three clearly-bounded columns
// (Foods to limit / Foods to embrace / Daily lifestyle) with a meta-line on
// purpose, a checkmark / dash icon system, and a clean final block of
// non-negotiables (sleep / no smoking / hydration).
function GeneralGuidance({ report }: { report: ClinicalReport }) {
  const guide = report.generalLifestyleGuide;

  return (
    <section className="space-y-6 rounded-3xl border border-stone-200/80 bg-white p-6 sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <SectionTitle eyebrow="General guidance">Diet &amp; lifestyle reference</SectionTitle>
        <p className="max-w-md text-xs leading-relaxed text-stone-500">
          These are the foundational habits that support hair recovery regardless of which kit
          you're on. Personalised actions live with each kit phase above.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <GuidanceColumn
          tone="amber"
          eyebrow="Foods to limit"
          tagline="Have these no more than twice a week — they acidify the blood and slow hair growth."
          symbol="–"
          items={guide.foodsToAvoid}
        />
        <GuidanceColumn
          tone="teal"
          eyebrow="Foods to embrace"
          tagline="Rotate these through the week — they supply iron, amino acids and antioxidants the follicle needs."
          symbol="+"
          items={guide.foodsToAdd}
        />
      </div>

      <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50/60 via-white to-amber-50/30 p-5 sm:p-6">
        <div className="flex items-baseline justify-between">
          <Eyebrow>
            <span className="text-teal-800">Daily lifestyle</span>
          </Eyebrow>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
            Consistency wins
          </span>
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {guide.lifestyleRecommendations.map((item, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-700">
              <span className="mt-[0.55rem] block h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function GuidanceColumn({
  eyebrow,
  tagline,
  items,
  symbol,
  tone,
}: {
  eyebrow: string;
  tagline: string;
  items: string[];
  symbol: "+" | "–";
  tone: "amber" | "teal";
}) {
  const eyebrowColor = tone === "amber" ? "text-amber-800" : "text-teal-700";
  const ringColor = tone === "amber" ? "border-amber-200/70 bg-amber-50/30" : "border-teal-200/70 bg-teal-50/30";
  const badgeColor =
    tone === "amber"
      ? "bg-amber-100 text-amber-800"
      : "bg-teal-100 text-teal-800";

  return (
    <div className={`rounded-2xl border ${ringColor} p-5`}>
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow>
          <span className={eyebrowColor}>{eyebrow}</span>
        </Eyebrow>
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full font-serif text-sm font-semibold ${badgeColor}`}
        >
          {symbol}
        </span>
      </div>
      <p className="mt-2 text-xs italic leading-relaxed text-stone-600">{tagline}</p>
      <ul className="mt-4 space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-700">
            <span
              className={`mt-[0.55rem] block h-1 w-1 shrink-0 rounded-full ${
                tone === "amber" ? "bg-amber-400" : "bg-teal-500"
              }`}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Top level ─────────────────────────────────────────────────────────────
export function ClinicalReportView({
  report,
}: {
  report: unknown;
}) {
  if (!isClinicalReport(report)) return null;

  const narrative = composeNarrativeV3(report);

  return (
    <>
      <div className="space-y-10 rounded-3xl bg-stone-50/60 p-6 sm:p-8 lg:p-10">
      {/* 1 — Hero */}
      <header className="relative overflow-hidden rounded-3xl border border-stone-200 bg-white p-8 sm:p-10">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-teal-100/60 to-transparent blur-2xl" />
        <div className="absolute -left-12 bottom-0 h-32 w-32 rounded-full bg-gradient-to-tr from-amber-100/50 to-transparent blur-2xl" />
        <div className="relative">
          <Eyebrow>Personalised clinical report</Eyebrow>
          <h2 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            {report.patientSummary.name}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span>{report.patientSummary.age} years</span>
            <span className="h-1 w-1 rounded-full bg-stone-300" />
            <span>{report.patientSummary.gender}</span>
            {report.patientSummary.goal.length > 0 && (
              <>
                <span className="h-1 w-1 rounded-full bg-stone-300" />
                <span className="text-slate-600">
                  Goal · <span className="text-slate-800">{report.patientSummary.goal.join(", ")}</span>
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2 — Questionnaire selections */}
      <QuestionnaireSelections report={report} />

      {/* 3 — Clinical summary & interpretation */}
      <ClinicalSummaryAndInterpretation report={report} />

      {/* 4 — Recommended recovery protocol (V3) — kit + ingredient side-by-side */}
      <V3RecommendedKits narrative={narrative} />

      {/* 5 — Topical recommendations */}
      <TopicalRecommendations report={report} />

      {/* 6 — Final Clinical Assessment (doctor-style synthesis) */}
      <ClinicalInsightStorySection report={report} />

      {/* 7 — Recovery Milestones (universal, identical for every patient) */}
      <RecoveryMilestonesSection report={report} />

      {/* 8 — General guidance */}
      <GeneralGuidance report={report} />

      {/* 9 — Footer */}
      <footer className="rounded-2xl border border-stone-200 bg-white px-6 py-5 text-center">
        <p className="text-xs leading-relaxed text-stone-500">
          This report has been prepared from the information you provided in your assessment.
          Discuss any changes to your routine, supplements or medications with your treating
          doctor before starting.
        </p>
      </footer>
      </div>
    </>
  );
}

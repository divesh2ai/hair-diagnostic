import type {
  NarrativeReportV3,
  RecommendedKitEntry,
  RecommendedKitsSection,
  RecoveryOutlookSection,
} from "@hairos/packages/ai-engine/report-engine/v3";

// ────────────────────────────────────────────────────────────────────────────
// V3 patient narrative renderer.
//
// Spec: HAIROS_REPORT_NARRATIVE_ENGINE_V3 (latest revision).
//
// Renders the two V3 sections that survive:
//   - Recommended Recovery Protocol — kit mechanism (therapeutic focus) and
//     ingredient mechanism (verbatim formulation rationale) side-by-side in
//     one card per kit.
//   - Expected Recovery Milestones — Month 1 / 2-3 / 3-6 / 6-12.
//
// Clinical Summary & Interpretation and General Guidance live upstream in
// ClinicalReportView.
// ────────────────────────────────────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
      {children}
    </p>
  );
}

function MicroLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
      {children}
    </p>
  );
}

function SectionHeading({
  eyebrow,
  children,
}: {
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h3 className="font-serif text-2xl font-semibold tracking-tight text-slate-900">
        {children}
      </h3>
    </div>
  );
}

function Bullets({ items, tone = "slate" }: { items: string[]; tone?: "slate" | "teal" }) {
  if (!items.length) return null;
  const dot = tone === "teal" ? "bg-teal-500" : "bg-stone-400";
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-700">
          <span className={`mt-[0.55rem] block h-1 w-1 shrink-0 rounded-full ${dot}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ── §3 — Recommended Recovery Protocol (kit + ingredients merged) ─────────
function RecommendedKits({ data }: { data: RecommendedKitsSection }) {
  return (
    <section className="space-y-5">
      <SectionHeading eyebrow="The protocol">{data.heading}</SectionHeading>
      <p className="text-sm leading-relaxed text-slate-700">{data.intro}</p>
      <div className="space-y-5">
        {data.kits.map((k, i) => (
          <KitCard key={`${k.name}-${i}`} kit={k} phase={i + 1} />
        ))}
      </div>
    </section>
  );
}

function KitCard({ kit, phase }: { kit: RecommendedKitEntry; phase: number }) {
  const hasIngredients = kit.formulationGroups.length > 0;

  return (
    <article className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_-4px_rgba(15,23,42,0.06)]">
      {/* ── Header band ─────────────────────────────────────────────── */}
      <header className="flex items-start gap-4 border-b border-stone-100 bg-gradient-to-br from-teal-50/50 via-white to-white px-6 py-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-teal-200 bg-white font-serif text-base font-semibold text-teal-800 shadow-inner">
          {phase}
        </span>
        <div className="flex-1">
          <p className="font-serif text-xl font-semibold tracking-tight text-slate-900">
            {kit.name}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
            <span className="font-medium text-teal-800">Why this kit was selected — </span>
            {kit.whySelected}
          </p>
        </div>
      </header>

      {/* ── Side-by-side body: kit mechanism | formulation rationale ─ */}
      <div
        className={`grid divide-y divide-stone-100 lg:divide-y-0 ${
          hasIngredients ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:divide-x lg:divide-stone-100" : ""
        }`}
      >
        {/* Left — therapeutic focus (kit mechanism) */}
        <div className="space-y-3 px-6 py-5">
          <MicroLabel>Therapeutic focus · kit mechanism</MicroLabel>
          <Bullets items={kit.therapeuticFocus} tone="teal" />
        </div>

        {/* Right — formulation rationale (ingredient mechanism, verbatim) */}
        {hasIngredients && (
          <div className="space-y-4 bg-stone-50/40 px-6 py-5">
            <MicroLabel>Formulation rationale · ingredient mechanism</MicroLabel>
            <div className="space-y-4">
              {kit.formulationGroups.map((g, gi) => (
                <FormulationGroupBlock
                  key={`${g.group}-${gi}`}
                  group={g.group}
                  action={g.action}
                  ingredients={g.ingredients}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function FormulationGroupBlock({
  group,
  action,
  ingredients,
}: {
  group: string;
  action: string;
  ingredients: string[];
}) {
  return (
    <div className="border-l-2 border-teal-300 pl-4">
      <p className="text-sm font-semibold text-slate-900">{group}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-700">{action}</p>
      {ingredients.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ingredients.map((ing) => (
            <span
              key={ing}
              className="rounded-full border border-stone-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-700"
            >
              {ing}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── §5 — Recovery Outlook ──────────────────────────────────────────────────
function RecoveryOutlook({ data }: { data: RecoveryOutlookSection }) {
  return (
    <section className="space-y-5">
      <SectionHeading eyebrow="The road ahead">{data.heading}</SectionHeading>
      <ol className="relative space-y-6 border-l border-stone-200 pl-8">
        {data.entries.map((e, i) => (
          <li key={`${e.period}-${i}`} className="relative">
            <span className="absolute -left-[2.20rem] top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-teal-300 bg-white">
              <span className="h-2 w-2 rounded-full bg-teal-500" />
            </span>
            <p className="font-serif text-xl font-semibold tracking-tight text-teal-800">
              {e.period}
            </p>
            <Bullets items={e.milestones} tone="teal" />
          </li>
        ))}
      </ol>
    </section>
  );
}

// ── Compositional exports ─────────────────────────────────────────────────
export function V3RecommendedKits({ narrative }: { narrative: NarrativeReportV3 }) {
  return <RecommendedKits data={narrative.recommendedKits} />;
}

export function V3RecoveryOutlook({ narrative }: { narrative: NarrativeReportV3 }) {
  return <RecoveryOutlook data={narrative.recoveryOutlook} />;
}

// Legacy single-shot renderer kept for any caller still using it.
export function PatientNarrativeV3({ narrative }: { narrative: NarrativeReportV3 }) {
  return (
    <div className="space-y-10">
      <RecommendedKits data={narrative.recommendedKits} />
      <RecoveryOutlook data={narrative.recoveryOutlook} />
    </div>
  );
}

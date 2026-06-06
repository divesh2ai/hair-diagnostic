# HAIROS Report Renderer — Migration Plan (V1 → V2 narrative envelope)

**Audit:** [ROOT_CAUSE_ANALYSIS.md](./ROOT_CAUSE_ANALYSIS.md) · [REPORT_PIPELINE_TRACE.md](./REPORT_PIPELINE_TRACE.md)
**Scope:** read-side only. Clinical logic untouched.

The plan is ordered by the priority list in PART 7 (narrative visibility → monitoring → therapy explanation → prognosis → enum/score removal → artifact-count removal).

Each item lists the file, the line(s) responsible, the current behaviour, the required change, and the expected result. Snippets show the diff intent — do NOT paste verbatim without integrating into the surrounding file.

---

## Change set 1 — Lift narratives into the shared report payload (P1)

### 1.1 `packages/shared/types/assessment.ts:89-110`

**Current:** `AssessmentReportPayload` has `artifacts: AssessmentArtifact[]` + `artifactByType` only. No top-level narrative shape.

**Required change:** add the V2 envelope type and a top-level `narratives` field.

```ts
export interface NarrativeSection {
  full: string;
  short: string;
  segments: Array<{ label: string; text: string }>;
  length: "brief" | "detailed";
  target: string;
  locale: string;
  generatedAt: string;
}

export interface EnrichedTherapyNeed {
  need: string;
  title: string;
  clinicalRationale: string;
  patientExplanation: string;
}

export interface EnrichedRootCause {
  cause: string;
  title: string;
  clinicalContext: string;
  patientFriendly: string;
}

export interface AssessmentNarratives {
  executiveSummary: string;          // base.doctorSummary | base.patientSummary fallback
  doctorNarrative: NarrativeSection;
  patientNarrative: NarrativeSection;
  therapyExplanation: NarrativeSection;
  lifestylePlan: NarrativeSection;
  prognosis: NarrativeSection;
  monitoringPlan: NarrativeSection;
  enrichedTherapyNeeds: EnrichedTherapyNeed[];
  enrichedRootCauses: EnrichedRootCause[];
}

export interface AssessmentReportPayload {
  /* ... existing fields ... */
  artifacts: AssessmentArtifact[];
  artifactByType: Record<string, AssessmentArtifact>;
  artifactPresence: Record<string, boolean>;
  narratives: AssessmentNarratives | null;   // ← NEW
  /* ... */
}
```

**Expected result:** every frontend consumer can read `data.narratives.doctorNarrative.full`, etc. without spelunking `artifactByType`.

### 1.2 `apps/patient-portal/src/app/api/assessment/status/route.ts:115-200`

**Current (line 169):** `artifacts: artifactArray` only.

**Required change:** lift NARRATIVES into a top-level `narratives` field on the response.

```ts
const narrativesArtifact = artifacts.find(a => a.type === ArtifactType.NARRATIVES);
const narratives = narrativesArtifact ? liftNarratives(narrativesArtifact.content) : null;

const body: AssessmentStatusResponse & { ... } = {
  /* ... */
  artifacts: artifactArray,
  artifactPresence,
  narratives,                  // ← NEW
  /* ... */
};
```

Add `liftNarratives` helper in `apps/patient-portal/src/lib/narratives/liftNarratives.ts`:

```ts
export function liftNarratives(content: unknown): AssessmentNarratives | null {
  if (!content || typeof content !== "object") return null;
  const c = content as Record<string, unknown>;
  const get = (k: string) => c[k] as NarrativeSection | undefined;
  if (!get("doctor_narrative") && !get("patient_narrative")) return null;
  const empty: NarrativeSection = { full: "", short: "", segments: [], length: "detailed",
                                    target: "patient-report", locale: "en", generatedAt: "" };
  return {
    executiveSummary: (c.doctorSummary as string) || (c.patientSummary as string) || "",
    doctorNarrative: get("doctor_narrative") ?? empty,
    patientNarrative: get("patient_narrative") ?? empty,
    therapyExplanation: get("therapy_explanation") ?? empty,
    lifestylePlan: get("lifestyle_plan") ?? empty,
    prognosis: get("prognosis") ?? empty,
    monitoringPlan: get("monitoring_plan") ?? empty,
    enrichedTherapyNeeds: (c.enrichedTherapyNeeds as EnrichedTherapyNeed[]) ?? [],
    enrichedRootCauses: (c.enrichedRootCauses as EnrichedRootCause[]) ?? [],
  };
}
```

**Expected result:** API ships V2 envelope alongside the V1 artifact bag.

### 1.3 `apps/patient-portal/src/lib/adapters/assessmentAdapter.ts:92-156`

**Current:** adapter does not extract narratives.

**Required change:** pass through `raw.narratives` into `AssessmentReportPayload.narratives`, falling back to `liftNarratives(artifactByType.NARRATIVES?.content)` for backward compatibility.

```ts
const rawNarratives = (raw as any).narratives ?? null;
const narratives: AssessmentNarratives | null =
  rawNarratives ?? liftNarratives(artifactByType.NARRATIVES?.content);

return {
  /* ... */
  artifactByType,
  artifactPresence,
  narratives,                  // ← NEW
  /* ... */
};
```

**Expected result:** every page that uses `normalizeAssessmentReportPayload` gets `narratives` for free.

---

## Change set 2 — Render narrative sections on the frontend (P1)

### 2.1 New file `apps/patient-portal/src/components/report/NarrativeSection.tsx`

```tsx
import type { NarrativeSection as NS } from "@shared/types/assessment";

interface Props { title: string; section: NS | null | undefined; }

export function NarrativeSection({ title, section }: Props) {
  if (!section || !section.full?.trim()) {
    return (
      <section className="rounded-lg border bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold text-gray-800">{title}</h2>
        <p className="text-sm text-gray-400">Section content is being prepared.</p>
      </section>
    );
  }
  return (
    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-bold text-gray-800">{title}</h2>
      {section.segments.length > 0 ? (
        <dl className="space-y-3">
          {section.segments.map((seg, i) => (
            <div key={i}>
              <dt className="text-sm font-semibold text-gray-700">{seg.label}</dt>
              <dd className="mt-1 text-sm leading-6 text-gray-800 whitespace-pre-line">{seg.text}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm leading-6 text-gray-800 whitespace-pre-line">{section.full}</p>
      )}
    </section>
  );
}
```

### 2.2 `apps/patient-portal/src/app/(public)/q/[clinicSlug]/preview/[assessmentId]/page.tsx:85-99`

**Current:** generic `ClinicalSummary` for narratives → dumps Object keys.

**Required change:** replace the narrative `ClinicalSummary` with `NarrativeSection` driven by `data.narratives`:

```tsx
import { NarrativeSection } from "@/components/report/NarrativeSection";

<NarrativeSection title="Executive Summary" section={
  data?.narratives ? { ...emptyNS, full: data.narratives.executiveSummary, short: data.narratives.executiveSummary, segments: [] } : null
} />
<NarrativeSection title="Doctor Narrative"   section={data?.narratives?.doctorNarrative} />
<NarrativeSection title="Patient Narrative"  section={data?.narratives?.patientNarrative} />
<NarrativeSection title="Therapy Explanation" section={data?.narratives?.therapyExplanation} />
<NarrativeSection title="Monitoring Plan"     section={data?.narratives?.monitoringPlan} />
<NarrativeSection title="Expected Outcomes"   section={data?.narratives?.prognosis} />
```

Delete the `<ClinicalSummary title="Doctor and patient narrative" .../>` line.

### 2.3 `apps/patient-portal/src/app/assessment/[id]/report/page.tsx:128-130`

Same replacement as 2.2. Remove the `<ReportSection title="Doctor Narrative / Patient Narrative / Prognosis" .../>` and add the six `<NarrativeSection ...>` blocks.

**Expected result (changes 2.1–2.3):** Executive Summary, Doctor Narrative, Patient Narrative, Therapy Explanation, Monitoring Plan, Expected Outcomes are visible with their actual content. "Pending or unavailable" disappears for the narrative card. ✅ priorities 1–4.

---

## Change set 3 — Render the enriched knowledge layer (P1/P4)

### 3.1 New file `apps/patient-portal/src/components/report/EnrichedKnowledge.tsx`

```tsx
export function EnrichedTherapyNeeds({ items }: { items: EnrichedTherapyNeed[] | undefined }) {
  if (!items?.length) return null;
  return (
    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-bold text-gray-800">Why these therapies were chosen</h2>
      <div className="grid gap-4">
        {items.map((it) => (
          <article key={it.need} className="rounded-md border border-gray-100 p-3">
            <h3 className="text-sm font-semibold text-gray-900">{it.title}</h3>
            <p className="mt-1 text-sm text-gray-700">{it.patientExplanation}</p>
            <p className="mt-2 text-xs text-gray-500">{it.clinicalRationale}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function EnrichedRootCauses({ items }: { items: EnrichedRootCause[] | undefined }) {
  if (!items?.length) return null;
  return (
    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-bold text-gray-800">Root causes</h2>
      <div className="grid gap-4">
        {items.map((it) => (
          <article key={it.cause} className="rounded-md border border-gray-100 p-3">
            <h3 className="text-sm font-semibold text-gray-900">{it.title}</h3>
            <p className="mt-1 text-sm text-gray-700">{it.patientFriendly}</p>
            <p className="mt-2 text-xs text-gray-500">{it.clinicalContext}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
```

### 3.2 Mount both on preview + report pages

After the `<NarrativeSection>` blocks, add:

```tsx
<EnrichedRootCauses items={data?.narratives?.enrichedRootCauses} />
<EnrichedTherapyNeeds items={data?.narratives?.enrichedTherapyNeeds} />
```

**Expected result:** the knowledge layer (rationales + patient-facing copy from `THERAPY_NEED_EXPANSIONS` + `ROOT_CAUSE_EXPLANATIONS`) becomes visible. ✅ priority 5.

---

## Change set 4 — Strip raw enums and scores from KitProtocol (P5/P6)

### 4.1 `apps/patient-portal/src/app/(public)/q/[clinicSlug]/preview/[assessmentId]/page.tsx:165-214`

**Current:**
- Line 197: `{kit.score}` — internal match score displayed as a badge.
- Line 192: `kit.matchedNeeds.join(", ")` — raw therapy-need enums.

**Required change:** humanize via `data.narratives.enrichedTherapyNeeds` lookup; drop the score badge entirely:

```tsx
const needsLabel = (rawNeeds: string[]) =>
  rawNeeds.map((n) => enriched?.find(e => e.need === n)?.title ?? humanize(n)).join(", ");

// Remove the {kit.score} badge block.
<p className="mt-1 text-xs text-slate-500">
  Targets: {Array.isArray(kit.matchedNeeds) && kit.matchedNeeds.length
    ? needsLabel(kit.matchedNeeds as string[])
    : "Clinical support"}
</p>
```

Add a `humanize` helper that turns `"DHT_SUPPRESSION"` → `"DHT suppression"` for the no-enrichment fallback.

### 4.2 `apps/patient-portal/src/app/assessment/[id]/report/page.tsx:167-226`

Same two changes as 4.1.

**Expected result:** patient never sees raw enum strings or internal match scores. ✅ priority 5.

---

## Change set 5 — Replace the V1 enum-dumper everywhere (P6)

### 5.1 Delete `summarizeValue` (preview line 216, report line 229) and `ClinicalSummary` / `ReportSection`

These components are the source of "N items available", raw enum dumps, and "Available" placeholder strings. Replace each invocation site:

| Site | Replace with |
|---|---|
| `<ClinicalSummary title="Clinical profile" value={CLINICAL_REASONING.content} />` | A dedicated `<ClinicalProfileSection profile={...} />` that humanises severity, pattern, signals (mirrors `pdf-engine/components/PatientClinicalSummary.tsx` which already humanises). |
| `<ClinicalSummary title="Severity analysis" value={SEVERITY_ANALYSIS.content} />` | A typed `<SeverityCard analysis={...} />`. |
| `<ClinicalSummary title="Therapy needs and protocols" value={THERAPY_PLAN.content} />` | Folded into `<EnrichedTherapyNeeds items={...} />` (change set 3). |
| `<ClinicalSummary title="Doctor and patient narrative" .../>` | Already replaced in change set 2. |
| `<ClinicalSummary title="Visual journey" value={VISUAL_JOURNEY.content} />` | A dedicated `<VisualJourneySection sections={...} />` that renders titles + descriptions only (no raw artifact dump). |

The point is: never render unknown artifact JSON by iterating `Object.entries`. Every section must have a typed renderer.

**Expected result:** "N items available" and "Available" placeholder strings are eliminated. ✅ priority 6.

---

## Change set 6 — Migrate the PDF (P1)

### 6.1 `src/packages/pdf-engine/types.ts:20-30`

Add the V2 envelope to the payload:

```ts
import type { AssessmentNarratives } from "@shared/types/assessment";

export interface ReportInputPayload {
  /* ... existing fields ... */
  therapyPlan?: unknown;
  narratives?: AssessmentNarratives | null;   // ← NEW
  createdAt: Date;
}
```

### 6.2 `src/packages/assessment-orchestrator/index.ts:329-359`

Load the narratives artifact before building the PDF payload:

```ts
const [recommendationsArtifact, therapyArtifact, narrativesArtifact] = await Promise.all([
  prisma.aIArtifact.findUnique({ where: { ..., type: ArtifactType.RECOMMENDATIONS } }),
  prisma.aIArtifact.findUnique({ where: { ..., type: ArtifactType.THERAPY_PLAN } }),
  prisma.aIArtifact.findUnique({ where: { ..., type: ArtifactType.NARRATIVES } }),
]);

const pdfPayload: ReportInputPayload = {
  /* ... */
  therapyPlan: therapyArtifact?.content ?? null,
  narratives: narrativesArtifact?.content
    ? liftNarrativesForPdf(narrativesArtifact.content)
    : null,
  createdAt: new Date(),
};
```

Add `liftNarrativesForPdf` as a server-side helper (same shape as `liftNarratives` above, importable without Next).

### 6.3 `src/packages/pdf-engine/templates/PatientReportTemplate.tsx`

Insert new pages BETWEEN the Patient Clinical Summary page and the Visual Journey pages:

```tsx
{payload.narratives?.doctorNarrative?.full && (
  <Page size="A4" style={S.page}>
    <Text style={S.sectionEyebrow}>CLINICAL EXPLANATION</Text>
    <Text style={S.sectionTitle}>Root Cause & Clinical Reasoning</Text>
    <Text style={S.body}>{payload.narratives.doctorNarrative.full}</Text>
  </Page>
)}
{payload.narratives?.patientNarrative?.full && (
  <Page size="A4" style={S.page}>
    <Text style={S.sectionEyebrow}>YOUR EXPLANATION</Text>
    <Text style={S.sectionTitle}>What This Means for You</Text>
    <Text style={S.body}>{payload.narratives.patientNarrative.full}</Text>
  </Page>
)}
{payload.narratives?.therapyExplanation?.full && (
  <Page size="A4" style={S.page}>
    <Text style={S.sectionEyebrow}>WHY THESE THERAPIES</Text>
    <Text style={S.sectionTitle}>Therapy Rationale</Text>
    <Text style={S.body}>{payload.narratives.therapyExplanation.full}</Text>
  </Page>
)}
{payload.narratives?.monitoringPlan?.full && (
  <Page size="A4" style={S.page}>
    <Text style={S.sectionEyebrow}>FOLLOW-UP</Text>
    <Text style={S.sectionTitle}>Your Monitoring Plan</Text>
    <Text style={S.body}>{payload.narratives.monitoringPlan.full}</Text>
  </Page>
)}
{payload.narratives?.prognosis?.full && (
  <Page size="A4" style={S.page}>
    <Text style={S.sectionEyebrow}>WHAT TO EXPECT</Text>
    <Text style={S.sectionTitle}>Expected Outcomes</Text>
    <Text style={S.body}>{payload.narratives.prognosis.full}</Text>
  </Page>
)}
```

The existing "Recovery Roadmap" page (the hard-coded one) can be removed once `prognosis` is reliably populated.

**Expected result:** PDF gains 5 narrative pages sourced from the persisted V2 envelope. ✅ priorities 1–4 for the PDF channel.

---

## Change set 7 — Section title hygiene (P5)

`apps/patient-portal/src/app/assessment/[id]/report/page.tsx:129`:

**Current:** `<ReportSection title="Doctor Narrative / Patient Narrative / Prognosis" ... />` — the title itself leaks the underlying contract.

**Required change:** removed entirely by change set 2.3.

---

## Sequencing

The migration can land in two PRs without any clinical-logic changes:

1. **PR A — Contract migration (server-side):** change sets 1.1, 1.2, 1.3, 6.1, 6.2. Backward-compatible: adds `narratives` field; existing consumers ignore it.
2. **PR B — Renderer migration (client-side + PDF template):** change sets 2, 3, 4, 5, 6.3, 7. Removes V1 dumpers.

Both PRs should ship together to avoid a brief window where the API exposes `narratives` but renderers still use V1.

---

## Validation hook (use after both PRs)

After both PRs land, run the protocol in [NARRATIVE_RECOVERY_AUDIT.md §PART 8](./NARRATIVE_RECOVERY_AUDIT.md#part-8--validation-protocol).

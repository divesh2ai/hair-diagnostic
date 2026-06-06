# HAIROS Narrative Recovery — Forensic Audit

**Phase:** 5D
**Audit date:** 2026-06-06
**Audit type:** end-to-end forensic; no clinical-logic changes; no new features.
**Companion deliverables:**
- [ROOT_CAUSE_ANALYSIS.md](./ROOT_CAUSE_ANALYSIS.md)
- [REPORT_PIPELINE_TRACE.md](./REPORT_PIPELINE_TRACE.md)
- [REPORT_RENDERER_MIGRATION_PLAN.md](./REPORT_RENDERER_MIGRATION_PLAN.md)

---

## PART 1 — Narrative generation trace

Per-stage IO and presence of the canonical narrative fields. Full trace in [REPORT_PIPELINE_TRACE.md](./REPORT_PIPELINE_TRACE.md). Summary:

| Stage | INPUT | OUTPUT | SCHEMA | doctorNarrative | patientNarrative | therapyExplanation | prognosis | monitoringPlan | executiveSummary |
|---|---|---|---|---|---|---|---|---|---|
| Questionnaire submission | portal JSON | `PatientAnswers` | `src/packages/types.ts` | n/a | n/a | n/a | n/a | n/a | n/a |
| Assessment Orchestrator (entry) | `assessmentId` | side-effects | — | n/a | n/a | n/a | n/a | n/a | n/a |
| Clinical / Therapy / Recs | `PatientAnswers` | engine outputs | engine types | n/a | n/a | n/a | n/a | n/a | n/a |
| Narrative Engine | `ExplanationContext` | `ComposedNarrative` per axis | `composers/types` | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ as `doctorSummary` / `patientSummary` |
| assembleNarratives | composer outputs | full V2 envelope | `AssembledNarratives` | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Persistence Layer | envelope | NARRATIVES artifact row | opaque JSONB | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| PDF payload (`ReportInputPayload`) | per-stage artifacts | PDF input | `pdf-engine/types.ts` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| API Response | `assessmentId` | `AssessmentStatusResponse` | `shared/types/assessment.ts` | ❌ (only inside `artifacts[]`) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Frontend adapter | API response | `AssessmentReportPayload` | shared | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Report Renderer (preview) | adapter output | DOM | — | ❌ rendered as V1 dump | ❌ | ❌ | ❌ | ❌ | ❌ |
| Report Renderer (report page) | adapter output | DOM | — | ❌ rendered as V1 dump | ❌ | ❌ | ❌ | ❌ | ❌ |

**Conclusion:** narratives are deposited completely at persistence and dropped by every read-side contract afterwards.

---

## PART 2 — Artifact persistence audit

### File audited

`src/packages/assessment-orchestrator/persistence/persistArtifacts.ts`

### Behaviour

`persistNarrativeArtifact(prisma, assessmentId, narrativesPayload, generationMs)`:

1. Asserts `doctor_narrative || patient_narrative` truthy.
2. Asserts `doctor_narrative` / `patient_narrative` have non-empty `full | short | summary | narrative | body | segments`.
3. Upserts row in `aIArtifact` keyed `(assessmentId, type=NARRATIVES)`.
4. Re-reads the saved row, asserts `content` is an object and contains the two narrative keys.
5. Runs `validateArtifactPopulation("NARRATIVES", savedContent)` — hard-throws on enum-only / placeholder content.

### Persisted artifact schema (observed)

```ts
PersistedNarrativeArtifact = {
  doctor_narrative:     ComposedNarrative,
  patient_narrative:    ComposedNarrative,
  therapy_explanation:  ComposedNarrative,
  lifestyle_plan:       ComposedNarrative,
  prognosis:            ComposedNarrative,
  monitoring_plan:      ComposedNarrative,
  doctorSummary:        string,
  patientSummary:       string,
  narrative:            string,
  length:               "brief" | "detailed",
  enrichedTherapyNeeds: EnrichedTherapyNeed[],
  enrichedRootCauses:   EnrichedRootCause[],
}
```

### Missing fields

None at the persistence boundary. `executiveSummary` is not a named field — `doctorSummary` / `patientSummary` carry the equivalent content.

### Recommendation

Add an explicit `executive_summary` field in `runNarratives` (`assessment-orchestrator/index.ts:256`) so the read side does not have to choose between `doctorSummary` and `patientSummary`. Non-breaking; covered in migration plan §1.1 as `executiveSummary` in the lifted shape.

---

## PART 3 — API response audit

### File audited

`apps/patient-portal/src/app/api/assessment/status/route.ts`

### Behaviour

`GET /api/assessment/status?id=<cuid>` returns:

```ts
{
  success: true,
  assessmentId,
  status, progressPercent, isStuck,
  startedAt, updatedAt, completedAt,
  artifacts: AssessmentArtifact[],   // includes a NARRATIVES entry
  artifactPresence: { ..., narratives: boolean, ... },
  patient, clinic,
  timing,
  errors,
  events,
  orchestration: { stage, executionId, retryCount, lastCompletedStage, logs }
}
```

There is no top-level `narratives` field. The NARRATIVES artifact's content is reachable only by `artifacts.find(a => a.type === "NARRATIVES").content`.

### Missing fields

- Top-level `narratives: AssessmentNarratives | null` — covered in migration plan §1.2.

### Concrete impact

Frontend treats narrative content as opaque artifact JSON, with no V2 contract guarantees on the wire.

---

## PART 4 — Frontend consumption audit

### Files audited

- `apps/patient-portal/src/app/(public)/q/[clinicSlug]/preview/[assessmentId]/page.tsx`
- `apps/patient-portal/src/app/assessment/[id]/report/page.tsx`
- `apps/patient-portal/src/lib/adapters/assessmentAdapter.ts`

### Data source

Both pages consume `normalizeAssessmentReportPayload(json) → AssessmentReportPayload`, then read `data.artifactByType.<ARTIFACT_TYPE>.content` for every section. **The frontend currently uses Artifact Contract V1** (enum-keyed bag of raw artifact JSON).

### Rendered sections and their current source field

#### Preview page (`preview/[assessmentId]/page.tsx`)

| Section | Source field | Renderer | Status |
|---|---|---|---|
| Clinical profile | `artifactByType.CLINICAL_REASONING.content` | `ClinicalSummary` (V1 dumper) | ⚠️ enum dump |
| Severity analysis | `artifactByType.SEVERITY_ANALYSIS.content` | `ClinicalSummary` | ⚠️ enum dump |
| Recommended kit protocol | `artifactByType.RECOMMENDATIONS.content` | `KitProtocol` | ⚠️ raw enums + raw scores |
| Therapy needs and protocols | `artifactByType.THERAPY_PLAN.content` | `ClinicalSummary` | ⚠️ enum dump |
| **Doctor and patient narrative** | `artifactByType.NARRATIVES.content` | `ClinicalSummary` | ❌ enum dump only |
| Visual journey | `artifactByType.VISUAL_JOURNEY.content` | `ClinicalSummary` | ⚠️ enum dump |

#### Report page (`assessment/[id]/report/page.tsx`)

| Section | Source field | Renderer | Status |
|---|---|---|---|
| Clinical Profile | `artifactByType.CLINICAL_REASONING.content` | `ReportSection` | ⚠️ enum dump |
| Severity Analysis | `artifactByType.SEVERITY_ANALYSIS.content` | `ReportSection` | ⚠️ enum dump |
| Therapy Recommendations | `artifactByType.RECOMMENDATIONS.content` | `KitProtocol` | ⚠️ raw enums + raw scores |
| Protocols | `artifactByType.THERAPY_PLAN.content` | `ReportSection` | ⚠️ enum dump |
| **Doctor Narrative / Patient Narrative / Prognosis** | `artifactByType.NARRATIVES.content` | `ReportSection` | ❌ enum dump only |
| Visual Journey | `artifactByType.VISUAL_JOURNEY.content` | `ReportSection` | ⚠️ enum dump |

### Mechanism of the "pending or unavailable" message

`ClinicalSummary` / `ReportSection` show "Pending or unavailable" iff `Object.entries(content).length === 0`. NARRATIVES.content has many keys, so the message does NOT appear there. Instead, `summarizeValue` is called on each ComposedNarrative object value — and because that helper returns `Object.keys(value).slice(0, 6).join(", ")` for plain objects, the cells render `"full, short, segments, length, target, locale"`. For arrays (`enrichedTherapyNeeds`) it returns `"${value.length} items available"`.

**The "pending or unavailable" symptom appears on sections whose artifacts haven't persisted yet** (timing) — but on the narrative card specifically, the symptom is a different bug: the renderer reads the right artifact but ignores its content shape.

---

## PART 5 — Narrative mapping audit

The intended V2 mapping vs. what the current renderer wires up:

| Report Section | ← Should map to (V2) | ← Currently maps to | Status |
|---|---|---|---|
| Executive Summary | `narratives.executiveSummary` | (missing) | ❌ Not lifted; persistence has `doctorSummary`/`patientSummary` instead. |
| Root Cause Explanation | `narratives.doctorNarrative` | `artifactByType.NARRATIVES.content` (V1 bag, dumped) | ❌ |
| Patient Explanation | `narratives.patientNarrative` | same V1 bag | ❌ |
| Monitoring Plan | `narratives.monitoringPlan` | same V1 bag | ❌ |
| Expected Outcomes | `narratives.prognosis` | same V1 bag | ❌ |
| Treatment Explanation | `narratives.therapyExplanation` | same V1 bag | ❌ |
| Lifestyle Plan | `narratives.lifestylePlan` | same V1 bag | ❌ |
| Detected Drivers (enriched) | `narratives.enrichedRootCauses` | rendered as "N items available" | ❌ |
| Therapy Rationales (enriched) | `narratives.enrichedTherapyNeeds` | rendered as "N items available" | ❌ |

**Every single V2 mapping is missing on the read side.**

---

## PART 6 — Legacy report detection

Legacy fields still rendered by the current report:

| Legacy field | Origin | Where rendered | Why this is a problem |
|---|---|---|---|
| `kit.score` (raw 0–100 match score) | `RECOMMENDATIONS.content.rankedKits[*].score` | preview/.../page.tsx:197, report/.../page.tsx:198 | Internal scoring should not be patient-facing. |
| `kit.matchedNeeds` (raw enum strings like `"DHT_SUPPRESSION"`) | RECOMMENDATIONS artifact | preview/.../page.tsx:192, report/.../page.tsx:203 | Enums must be humanised via `enrichedTherapyNeeds`. |
| `kit.reasons` (raw strings) | RECOMMENDATIONS artifact | preview/.../page.tsx:204, report/.../page.tsx:206 | Acceptable text, but framed as bullet list of internal "reasons"; should be the enriched patientExplanation. |
| `recommendation.selectionJustification` | RECOMMENDATIONS artifact | report/.../page.tsx:218 | OK in clinician view; should be tucked under a clear "Why this protocol" subhead, not exposed as raw key. |
| "N items available" | `summarizeValue` for arrays | preview/.../page.tsx:218, report/.../page.tsx:235 | The exact "items available" / "ItemsAvailable" symptom. |
| "Available" placeholder | `summarizeValue` for objects with no keys | preview/.../page.tsx:222 | V1 debug fallback bleeding into patient view. |
| Raw artifact key names ("doctor narrative", "patient narrative", "monitoring plan") | `key.replace(/_/g, " ")` in `ClinicalSummary` / `ReportSection` | preview/.../page.tsx:155, report/.../page.tsx:157 | These are V1 internal contract labels rendered as section titles. |
| Section title `"Doctor Narrative / Patient Narrative / Prognosis"` | hard-coded | report/.../page.tsx:129 | Names the internal contract on the patient-facing surface. |
| `severity` raw enum (`hairfallSeverity`) | CLINICAL_REASONING.content | both pages via ClinicalSummary | Should be humanised via SEVERITY_LABEL (mirrors pdf-engine PatientClinicalSummary). |

These must never appear in patient reports. Fix paths are listed in [REPORT_RENDERER_MIGRATION_PLAN.md](./REPORT_RENDERER_MIGRATION_PLAN.md) §4 and §5.

---

## PART 7 — Recovery plan (executive)

Full diffs in [REPORT_RENDERER_MIGRATION_PLAN.md](./REPORT_RENDERER_MIGRATION_PLAN.md).

| Priority | File(s) | Current behaviour | Required change | Expected result |
|---|---|---|---|---|
| P1 narrative visibility | `packages/shared/types/assessment.ts` | No `narratives` slot on payload | Add `narratives: AssessmentNarratives \| null` and component types | Wire-level V2 envelope |
| P1 narrative visibility | `apps/patient-portal/src/app/api/assessment/status/route.ts` | Only ships V1 artifact bag | Lift NARRATIVES content to top-level `narratives` via `liftNarratives` helper | API exposes V2 envelope |
| P1 narrative visibility | `apps/patient-portal/src/lib/adapters/assessmentAdapter.ts` | Forwards V1 bag only | Forward top-level `narratives` (or lift from artifactByType for compat) | Frontend gets V2 envelope |
| P1 narrative visibility | preview + report pages | V1 dumper for narrative card | Replace with `<NarrativeSection>` driven by `data.narratives.doctorNarrative` etc. | Doctor + patient narratives visible |
| P2 monitoring visibility | preview + report pages | Same dumper | Add `<NarrativeSection title="Monitoring Plan" section={data.narratives.monitoringPlan} />` | Monitoring plan visible |
| P3 therapy explanation | preview + report pages | Same dumper | Add `<NarrativeSection title="Therapy Explanation" section={data.narratives.therapyExplanation} />` | Therapy explanation visible |
| P4 prognosis visibility | preview + report pages | Same dumper | Add `<NarrativeSection title="Expected Outcomes" section={data.narratives.prognosis} />` | Prognosis visible |
| P5 raw enum removal | preview + report `KitProtocol` | Renders `matchedNeeds` enums + score badge | Humanise via `enrichedTherapyNeeds`; drop score badge | No raw enums; no internal scores |
| P5 raw enum removal | preview + report `ClinicalSummary` / `ReportSection` | Dumps every key | Replace with typed `<ClinicalProfileSection>`, `<SeverityCard>`, `<VisualJourneySection>` | No raw enums |
| P6 artifact-count removal | `summarizeValue` (both pages) | Returns `"N items available"` and `"Available"` | Delete the helper; replace via typed renderers | No "items available" strings |
| PDF parity | `src/packages/pdf-engine/types.ts` | No `narratives` slot | Add `narratives?: AssessmentNarratives \| null` | PDF payload has V2 envelope |
| PDF parity | `src/packages/assessment-orchestrator/index.ts` `runReportGeneration` | Loads only RECS+THERAPY artifacts | Also load NARRATIVES; pass into `pdfPayload.narratives` | PDF receives narratives |
| PDF parity | `PatientReportTemplate.tsx` | No narrative pages | Add 5 narrative pages between Clinical Summary and Visual Journey | PDF shows narratives |
| Hygiene | report page title string | Hard-coded `"Doctor Narrative / Patient Narrative / Prognosis"` | Replaced by individual `<NarrativeSection>` titles | No internal-contract leakage |

---

## PART 8 — Validation protocol

After the migration PRs land, validate manually:

1. Start a fresh assessment for a representative patient (e.g. a Male AGA case from the corpus).
2. Wait for orchestration to complete (status `COMPLETED`).
3. `GET /api/assessment/status?id=<cuid>` — verify response contains top-level `narratives` with non-empty `doctorNarrative.full`, `patientNarrative.full`, `therapyExplanation.full`, `monitoringPlan.full`, `prognosis.full`.
4. Open the report page (`/assessment/<id>/report`):
   - ✅ Executive Summary visible.
   - ✅ Diagnosis section visible.
   - ✅ Root Cause Explanation visible (doctor narrative).
   - ✅ Biological Mechanism visible (segments of doctor narrative).
   - ✅ Therapy Explanation visible.
   - ✅ Monitoring Plan visible.
   - ✅ Expected Outcomes (prognosis) visible.
   - ✅ Patient Narrative visible.
   - ✅ Doctor Narrative visible.
   - 🚫 No raw enums (e.g. `DHT_SUPPRESSION`, `hairfallSeverity:SEVERE`).
   - 🚫 No internal IDs (artifact ids, registry ids, pathway ids).
   - 🚫 No "items available" strings.
   - 🚫 No artifact-debug output (no field labelled by raw artifact key name).
5. Open the preview page (`/q/<clinic>/preview/<id>`) — same checks as step 4.
6. Download the PDF — same checks as step 4 with the visible narrative pages.

The validation passes when every checkbox above is satisfied for one fresh end-to-end assessment.

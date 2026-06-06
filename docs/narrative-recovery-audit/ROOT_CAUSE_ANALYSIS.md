# HAIROS Narrative Recovery — Root Cause Analysis

**Audit date:** 2026-06-06
**Symptom:** Reports look identical to one week ago. Raw artifacts displayed. Internal enums visible. Doctor/patient narrative shows "pending or unavailable". Monitoring narrative not visible. Newly built knowledge layer (enrichedTherapyNeeds, enrichedRootCauses, monitoring_plan) not reflected in final report.

---

## TL;DR

The Narrative Engine works correctly. Narratives are **composed, validated, and persisted** under `ArtifactType.NARRATIVES` in the `aIArtifact` table. They never reach the patient because **three independent contracts downstream of persistence still implement Artifact Contract V1** (an enum-keyed bag of raw artifact JSON):

1. **PDF payload** (`ReportInputPayload`) has no `narratives` field. The PDF template never reads `NARRATIVES.content`.
2. **API status response** ships only `artifacts: AssessmentArtifact[]` — the NARRATIVES artifact is in there but is never lifted into a top-level `narratives` field.
3. **Shared `AssessmentReportPayload`** type has no `narratives` field. The frontend renderers use a **generic enum-dumper** (`ClinicalSummary` / `ReportSection`) that prints `Object.keys(value)` of the ComposedNarrative envelope without ever reading `full` / `segments`.

The "items available" output, the "raw enums", and the all-scores display are all from the same V1 dumper components — they render whatever Object.entries returns and call it a report.

**No clinical logic is broken. The full narrative payload exists in the DB.** The work to recover the report is purely on the **read side** of the pipeline.

---

## 1. Evidence

### 1.1 Narrative payload IS persisted

`src/packages/assessment-orchestrator/index.ts:235-300` runs `assembleAssessmentNarratives(context)` → `narrativesPayload`:

```ts
const narrativesPayload = {
  doctor_narrative, patient_narrative,
  therapy_explanation, lifestyle_plan,
  prognosis, monitoring_plan,
  doctorSummary, patientSummary, narrative, length,
  enrichedTherapyNeeds, enrichedRootCauses,
};
await persistNarrativeArtifact(prisma, ctx.assessmentId, narrativesPayload, ...);
```

`persistArtifacts.ts:87-173` (`persistNarrativeArtifact`) validates content, upserts with `ArtifactType.NARRATIVES`, re-reads, asserts `doctor_narrative || patient_narrative`, then runs `validateArtifactPopulation`. Hard-throws on failure.

→ **Narratives are in the DB.**

### 1.2 PDF generation NEVER reads narratives

`src/packages/assessment-orchestrator/index.ts:329-359` (`runReportGeneration`) loads only two artifacts before generating the PDF:

```ts
const [recommendationsArtifact, therapyArtifact] = await Promise.all([
  prisma.aIArtifact.findUnique({ where: { ..., type: ArtifactType.RECOMMENDATIONS } }),
  prisma.aIArtifact.findUnique({ where: { ..., type: ArtifactType.THERAPY_PLAN } }),
]);
const pdfPayload: ReportInputPayload = {
  assessmentId, patient, clinic, doctor,
  clinicalProfile, visualJourney, kitRecommendation, therapyPlan,
  createdAt,
};
```

`src/packages/pdf-engine/types.ts:20-30` (`ReportInputPayload`) — the type has no `narratives` field:

```ts
export interface ReportInputPayload {
  assessmentId; patient; clinic; doctor;
  clinicalProfile: NormalizedClinicalProfile;
  visualJourney: VisualJourney;
  kitRecommendation?; therapyPlan?; createdAt;
}
```

`src/packages/pdf-engine/templates/PatientReportTemplate.tsx` does NOT reference `payload.narratives`. The only narrative-shaped block in the template is `<Text>{buildNarrative(patient, p)}</Text>` (PatientClinicalSummary.tsx:290) which is a **local function** that re-derives a paragraph from the clinical profile — not from the persisted narrative artifact.

→ **PDF cannot show doctor/patient narrative, monitoring plan, therapy explanation, or prognosis.**

### 1.3 API status endpoint flattens narratives into the artifact bag

`apps/patient-portal/src/app/api/assessment/status/route.ts:115-124` builds the response with `artifacts: artifactArray` only. No top-level `narratives`. The NARRATIVES artifact is one entry in the array; consumers must dig through `artifacts.find(a => a.type === "NARRATIVES").content`.

### 1.4 Shared contract has no narrative shape

`packages/shared/types/assessment.ts:89-110` (`AssessmentReportPayload`): no `narratives` field. The frontend type doesn't even have a slot to put the V2 envelope.

### 1.5 Frontend renderers are V1 enum-dumpers

`apps/patient-portal/src/app/(public)/q/[clinicSlug]/preview/[assessmentId]/page.tsx:94`:

```tsx
<ClinicalSummary title="Doctor and patient narrative"
                 value={data?.artifactByType.NARRATIVES?.content} />
```

`ClinicalSummary` (line 142) → `Object.entries(object).slice(0, 8)` → for each key calls `summarizeValue(entryValue)`. The value of `doctor_narrative` is a `ComposedNarrative` object → `summarizeValue` (line 216) drops into the `typeof === "object"` branch and returns `Object.keys(value).slice(0, 6).join(", ")` = literal text `"full, short, segments, length, target, locale"`.

For arrays (`enrichedTherapyNeeds`, `enrichedRootCauses`) line 218 emits the exact symptom text: **`${value.length} items available`**.

Same V1 dumper pattern in the report page: `assessment/[id]/report/page.tsx:144-165` (`ReportSection`). The doctor narrative card title is hard-coded as `"Doctor Narrative / Patient Narrative / Prognosis"` and its body iterates raw artifact JSON keys.

The `KitProtocol` renderers on both pages display:

- `kit.score` (line 197 preview, 198 report) — raw match score.
- `kit.matchedNeeds.join(", ")` (line 192 preview, 203 report) — raw therapy-need enums.

That accounts for the "All scores / NeedReasons / raw enums" symptoms.

---

## 2. Root cause classification

| Failure | Class | Component | Origin |
|---|---|---|---|
| Doctor/patient narrative invisible | CONTRACT_MISMATCH | Report renderer | V1 artifact-bag → V2 narrative-envelope migration never done on read side |
| Monitoring narrative invisible | CONTRACT_MISMATCH | Same as above | `monitoring_plan` key exists in artifact but no rendering path |
| Therapy explanation invisible | CONTRACT_MISMATCH | Same | `therapy_explanation` key exists but no rendering path |
| Prognosis invisible | CONTRACT_MISMATCH | Same | `prognosis` key exists but no rendering path |
| Raw enums (matchedNeeds, severity) | LEGACY_CONTRACT | KitProtocol component (both pages) | Renderer ships V1 fields directly without humanization |
| Raw scores | LEGACY_CONTRACT | KitProtocol component (both pages) | Internal scoring should not be patient-facing |
| "items available" | LEGACY_CONTRACT | summarizeValue helper | Designed for V1 debug view; never replaced |
| "pending or unavailable" on narrative card | LEGACY_CONTRACT | ClinicalSummary / ReportSection | Renders nothing when narrative envelope's outer keys don't look like primitives |
| Reports identical to last week | INERTIA | All of the above | None of the read-side contracts moved; the orchestrator built more data into an artifact that nobody reads |
| PDF unchanged | CONTRACT_MISMATCH | `ReportInputPayload` + `PatientReportTemplate` | PDF payload has no `narratives` slot; template has no narrative sections |

---

## 3. What is NOT broken

- ✅ Questionnaire intake (`mapPortalAnswers`)
- ✅ Clinical engine (`evaluateClinicalProfile`)
- ✅ Therapy engine (`mapTherapyNeeds`)
- ✅ Recommendations (`scoreKits`)
- ✅ Narrative composition (`compose{Clinical,Patient,Therapy,Lifestyle,Prognosis,Monitoring}Narrative`)
- ✅ Narrative assembly + enrichment (`assembleAssessmentNarratives`)
- ✅ Persistence Gate #2 (`persistNarrativeArtifact` validates + verifies)
- ✅ Content-population validator
- ✅ Knowledge expansion tables (`THERAPY_NEED_EXPANSIONS`, `ROOT_CAUSE_EXPLANATIONS`)
- ✅ Database schema (NARRATIVES artifact row stores the full envelope)

**Conclusion:** the orchestrator deposits a complete V2 narrative envelope every time. The read path was never migrated from V1.

---

## 4. Why this happened

The orchestrator pipeline was upgraded incrementally (Phase 5A/5B narrative engine, monitoring composer, enrichment tables, persistence gates), but four contracts on the read side were never bumped to the V2 narrative envelope:

1. `ReportInputPayload` (PDF input)
2. `PatientReportTemplate` (PDF render)
3. `AssessmentStatusResponse` / `AssessmentReportPayload` (API+shared)
4. `ClinicalSummary` / `ReportSection` / `KitProtocol` (frontend renderers)

Because the read path falls back on the V1 enum-dumper, it can never *crash* — it just degrades silently to "pending or unavailable" or to a list of raw keys. There is no contract enforcement on the read side that would have surfaced this regression.

The fix is mechanical and well-scoped; no clinical-logic changes are required.

See [REPORT_RENDERER_MIGRATION_PLAN.md](./REPORT_RENDERER_MIGRATION_PLAN.md) for the prioritised change set.

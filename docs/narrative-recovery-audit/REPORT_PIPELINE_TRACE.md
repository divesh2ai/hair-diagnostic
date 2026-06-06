# HAIROS Report Pipeline — End-to-End Trace

**Audit date:** 2026-06-06
**Path under inspection:** Questionnaire submission → patient PDF + preview/report pages
**Verdict per stage:** ✅ produces narrative artifact / ❌ drops or ignores narrative artifact

Symbols: `✅` present and propagated · `⚠️` present but malformed · `❌` missing · `🚫` not consumed downstream

---

## Stage 1 — Questionnaire intake & mapping

**File:** `apps/patient-portal/src/app/api/assessment/create/page.tsx` → `src/packages/assessment-orchestrator/mapPortalAnswers.ts`

| | Detail |
|---|---|
| INPUT | Portal raw JSON answers |
| OUTPUT | `PatientAnswers` shape |
| SCHEMA | `src/packages/types.ts` (`PatientAnswers`) |
| narrative fields | n/a (pre-narrative stage) |

→ Not a narrative source. ✅

---

## Stage 2 — Assessment Orchestrator (entry)

**File:** `src/packages/assessment-orchestrator/index.ts:379-635` (`orchestrateAssessment`)

| | Detail |
|---|---|
| INPUT | `assessmentId` (DB lookup pulls patient + clinic + raw answers) |
| OUTPUT | side-effect: 7 stage runners executed in order |
| narrative fields | not yet computed |

Pipeline order (`STAGE_ORDER`): `normalize → clinical → therapy → recommendations → narratives → visual → pdf`.

→ Orchestration order is correct. Narratives stage runs BEFORE pdf. ✅

---

## Stage 3 — Clinical / Therapy / Recommendations

**Files:**
`src/packages/ai-engine/clinical-engine/evaluateClinicalProfile.ts`
`src/packages/ai-engine/therapy-engine/mapTherapyNeeds.ts`
`src/packages/ai-engine/kit-scorer/scoreKits.ts`

| | Detail |
|---|---|
| INPUT | `PatientAnswers` (clinical), prior step outputs (therapy, recs) |
| OUTPUT | ClinicalProfile / TherapyNeeds / KitRecommendation |
| SCHEMA | engine-internal interfaces |
| narrative fields | n/a |

→ These feed the explanation context. ✅

---

## Stage 4 — Narrative Engine + assembly

**Files:**
`src/packages/ai-engine/explanations/composers/*.ts`
`src/packages/assessment-orchestrator/narratives/assembleNarratives.ts`

`runNarratives` (`assessment-orchestrator/index.ts:235-300`) builds:

```ts
const context: ExplanationContext = {
  clinicalProfile: clinical,
  therapyNeeds: therapy,
  kitRecommendation: recommendations,
  narrativeLength: "detailed",
  patientName: ctx.patient.name,
};
const assembled = assembleAssessmentNarratives(context);
const base = buildNarrative(context);
const narrativesPayload = {
  doctor_narrative:    assembled.doctor_narrative,    // ComposedNarrative
  patient_narrative:   assembled.patient_narrative,
  therapy_explanation: assembled.therapy_explanation,
  lifestyle_plan:      assembled.lifestyle_plan,
  prognosis:           assembled.prognosis,
  monitoring_plan:     assembled.monitoring_plan,
  doctorSummary:       base.doctorSummary,
  patientSummary:      base.patientSummary,
  narrative:           base.narrative,
  length:              base.length,
  enrichedTherapyNeeds: assembled.enrichedTherapyNeeds,
  enrichedRootCauses:   assembled.enrichedRootCauses,
};
```

| | Detail |
|---|---|
| INPUT | ExplanationContext |
| OUTPUT | full V2 narrative envelope |
| SCHEMA | `ComposedNarrative` per section + enriched arrays |

Presence check:

| Field | Present |
|---|---|
| doctorNarrative (`doctor_narrative`) | ✅ |
| patientNarrative (`patient_narrative`) | ✅ |
| therapyExplanation (`therapy_explanation`) | ✅ |
| prognosis | ✅ |
| monitoringPlan (`monitoring_plan`) | ✅ |
| executiveSummary | ⚠️ derived as `base.doctorSummary` / `base.patientSummary`; no dedicated `executive_summary` key |

→ Output is correct. ✅

---

## Stage 5 — Persistence

**File:** `src/packages/assessment-orchestrator/persistence/persistArtifacts.ts:87-173` (`persistNarrativeArtifact`)

| | Detail |
|---|---|
| INPUT | `narrativesPayload` |
| OUTPUT | `aIArtifact` row with `type=NARRATIVES`, `content=narrativesPayload` |
| SCHEMA | persisted as opaque JSONB → consumer must know shape |
| GATE #2 | validates non-empty doctor + patient narrative, re-reads, asserts content, runs `validateArtifactPopulation` |

Presence check on row:

| Field | Present in DB |
|---|---|
| doctorNarrative | ✅ |
| patientNarrative | ✅ |
| therapyExplanation | ✅ |
| prognosis | ✅ |
| monitoringPlan | ✅ |
| executiveSummary | ⚠️ as `doctorSummary` / `patientSummary` |

→ Database is correct. ✅ **Everything downstream of this row must consume it.**

---

## Stage 6 — PDF generation (consumed by `runReportGeneration`)

**File:** `src/packages/assessment-orchestrator/index.ts:329-374`

```ts
const [recommendationsArtifact, therapyArtifact] = await Promise.all([
  prisma.aIArtifact.findUnique({ where: { ..., type: ArtifactType.RECOMMENDATIONS } }),
  prisma.aIArtifact.findUnique({ where: { ..., type: ArtifactType.THERAPY_PLAN } }),
]);
const pdfPayload: ReportInputPayload = {
  assessmentId, patient, clinic, doctor,
  clinicalProfile, visualJourney, kitRecommendation, therapyPlan, createdAt,
};
```

| | Detail |
|---|---|
| INPUT | recommendations + therapy artifacts only |
| OUTPUT | `ReportInputPayload` → `generateAndStoreReports(pdfPayload)` |
| SCHEMA | `src/packages/pdf-engine/types.ts:20-30` |

Presence check on `ReportInputPayload`:

| Field | Present |
|---|---|
| narratives | ❌ |
| doctorNarrative | ❌ |
| patientNarrative | ❌ |
| therapyExplanation | ❌ |
| prognosis | ❌ |
| monitoringPlan | ❌ |
| executiveSummary | ❌ |

→ **NARRATIVES artifact never loaded.** PDF cannot render narratives. 🚫

`PatientReportTemplate.tsx` doesn't reference `payload.narratives`. The local `buildNarrative(patient, p)` in `PatientClinicalSummary.tsx:290` synthesises a paragraph from the clinical profile only.

---

## Stage 7 — API response (status route)

**File:** `apps/patient-portal/src/app/api/assessment/status/route.ts:43-220`

| | Detail |
|---|---|
| INPUT | `?id=<assessmentId>` |
| OUTPUT | `AssessmentStatusResponse` with `artifacts: AssessmentArtifact[]` |
| SCHEMA | `packages/shared/types/assessment.ts` |

Presence check on response body:

| Field | Present |
|---|---|
| `artifacts[]` (includes NARRATIVES row) | ✅ |
| top-level `narratives` | ❌ |
| `doctorNarrative` / `patientNarrative` / etc. | ❌ |

→ V2 envelope is reachable only via `artifacts.find(a => a.type === "NARRATIVES").content`. The API treats narratives as just another opaque artifact blob. 🚫

---

## Stage 8 — Frontend adapter

**File:** `apps/patient-portal/src/lib/adapters/assessmentAdapter.ts:92-156` (`normalizeAssessmentReportPayload`)

Produces `AssessmentReportPayload`:

| Field | Present |
|---|---|
| `artifacts` / `artifactByType` | ✅ |
| `narratives` (top-level) | ❌ |
| `doctorNarrative` / `patientNarrative` | ❌ |

→ Adapter forwards the V1 bag. No narrative lifting. 🚫

---

## Stage 9 — Report Renderer (preview page)

**File:** `apps/patient-portal/src/app/(public)/q/[clinicSlug]/preview/[assessmentId]/page.tsx:85-99`

```tsx
<ClinicalSummary title="Clinical profile"            value={data?.artifactByType.CLINICAL_REASONING?.content} />
<ClinicalSummary title="Severity analysis"           value={data?.artifactByType.SEVERITY_ANALYSIS?.content} />
<KitProtocol                                          value={data?.artifactByType.RECOMMENDATIONS?.content} />
<ClinicalSummary title="Therapy needs and protocols" value={data?.artifactByType.THERAPY_PLAN?.content} />
<ClinicalSummary title="Doctor and patient narrative" value={data?.artifactByType.NARRATIVES?.content} />
<ClinicalSummary title="Visual journey"              value={data?.artifactByType.VISUAL_JOURNEY?.content} />
```

`ClinicalSummary` (line 142) renders `Object.entries(value).slice(0, 8)` via `summarizeValue` (line 216):

```ts
function summarizeValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.length ? `${value.length} items available` : "No items";
  if (typeof value === "object" && value !== null) {
    return Object.keys(value).slice(0, 6).join(", ") || "Available";
  }
  return String(value);
}
```

For NARRATIVES.content the per-key values are objects (`doctor_narrative` is a ComposedNarrative) or arrays (`enrichedTherapyNeeds`) → emitted as `"full, short, segments, length, target, locale"` or **"N items available"**. The actual narrative text is never read.

🚫 **All eight expected narrative slots are dropped at the renderer.**

---

## Stage 10 — Report Renderer (report page)

**File:** `apps/patient-portal/src/app/assessment/[id]/report/page.tsx:116-133`

Same V1 dumper pattern as preview:

```tsx
<ReportSection title="Clinical Profile"  value={report?.artifactByType.CLINICAL_REASONING?.content} />
<ReportSection title="Severity Analysis" value={report?.artifactByType.SEVERITY_ANALYSIS?.content} />
<KitProtocol                              value={report?.artifactByType.RECOMMENDATIONS?.content} />
<ReportSection title="Protocols"         value={report?.artifactByType.THERAPY_PLAN?.content} />
<ReportSection title="Doctor Narrative / Patient Narrative / Prognosis"
                                          value={report?.artifactByType.NARRATIVES?.content} />
<ReportSection title="Visual Journey"    value={report?.artifactByType.VISUAL_JOURNEY?.content} />
```

`ReportSection` (line 144) and `summarizeValue` (line 229) replicate the V1 dump. The hard-coded section title leaks the implementation detail ("Doctor Narrative / Patient Narrative / Prognosis") and the body shows raw artifact keys.

🚫 **Same drop point.**

---

## Trace summary

| Stage | Narrative present? | Consumed correctly? |
|---|---|---|
| 1. Questionnaire | n/a | n/a |
| 2. Orchestrator entry | n/a | ✅ |
| 3. Clinical/Therapy/Recs | n/a | ✅ |
| 4. Narrative compose + assemble | ✅ | ✅ |
| 5. Persist | ✅ | ✅ |
| 6. PDF generation | ❌ (not loaded) | 🚫 |
| 7. API status route | ✅ (in artifact bag) | 🚫 (not lifted) |
| 8. Frontend adapter | ✅ (forwarded as bag) | 🚫 (not lifted) |
| 9. Preview page | ✅ (in `artifactByType.NARRATIVES`) | 🚫 (V1 dumper) |
| 10. Report page | ✅ (in `artifactByType.NARRATIVES`) | 🚫 (V1 dumper) |

**Lost between stage 5 (persist) and stages 6/9/10.** Three independent contracts to fix. See [REPORT_RENDERER_MIGRATION_PLAN.md](./REPORT_RENDERER_MIGRATION_PLAN.md).

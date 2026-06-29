# FourChapterNarrative — Canonical Schema

**Status:** Draft v1.0.0 — awaiting approval against `sara.fourChapterNarrative.json`.
**Source of truth:** This document + `sara.fourChapterNarrative.json` are the contract every surface must read from.

---

## Hard rules

1. **One engine.** PDF, Doctor View, AI Avatar, 90-sec Video, Doctor Dashboard, WhatsApp Summary all read from a `FourChapterNarrative` payload. No second narrative engine is allowed anywhere in HairOS.
2. **Four chapters only.** The payload has exactly four chapters: `chapter1`, `chapter2`, `chapter3`, `chapter4`. No fifth chapter. No alternative chapter sets.
3. **Chapter 2 source.** `chapter2.*` content is derived strictly from `clinicalInterpretation`. ROOT_CAUSE_DETAIL, BARRIER_BY_ROOT_CAUSE, rootCauseExpansions, DRIVER_CATALOG are forbidden inputs to Chapter 2.
4. **No render-time invention.** Renderers must not inject mechanisms, biology, copy, or fields not present in the payload. If it isn't here, it doesn't ship.
5. **Deprecated.** `composeNarrativeV3`, `buildClinicalInsightStory`, `build3DAvatarScript`, `assembleNarratives`, `PatientNarrativeV3` are deprecated and must be deleted once renderers are migrated.

---

## Top-level shape

```
FourChapterNarrative {
  $schemaVersion: "FourChapterNarrative/1.0.0"
  meta:             { assessmentId, volume, language, generatedAt, confidential, pipelineVersion }
  patient:          { firstName, age, sex, salutation }
  clinician:        { name, clinic }
  cover:            { eyebrow, title, subtitle, personalLine }
  executiveSummary: { title, subtitle, drivers: Driver[] }
  chapter1:         Chapter1
  chapter2:         Chapter2
  chapter3:         Chapter3
  chapter4:         Chapter4
  closing:          { eyebrow, title, subtitle, body, cta }
  videoScript:      VideoScript           // 90s, derived from chapters
  surfaceProjections: { pdf, doctorView, aiAvatar, video90s, doctorDashboard, whatsappSummary }
  governance:       { chapter2SourceRule, noSecondNarrativeEngine, doNotInjectAtRender }
}
```

---

## Driver

```
Driver {
  id                       // stable slug, e.g. "driver.pcos_hormonal_imbalance"
  label                    // display name
  role                     // "primary_driver" | "contributing_factor"
  impact                   // "low" | "moderate" | "high"
  stage                    // "emerging" | "established" | "advanced"
  oneLiner                 // single sentence — used on cover, dashboard, WhatsApp
  linksToChapter2FactorId  // joins driver → Ch2 factor
  linksToChapter3PhaseIds  // joins driver → Ch3 phases (kits)
}
```

---

## Chapter 1 — What is happening

```
Chapter1 {
  id, number=1, eyebrow, title, intro
  patientFacts: [
    { key, label, value, caption }      // hairPattern, duration, scalpConcerns, goal
  ]
  anatomy: {
    eyebrow, title, intro,
    parts: [ { id, label, description } ]
  }
  patientQuestionAnswered: "What is happening to my hair?"
  video: { durationSeconds, avatarEmotion, visualCue }
}
```

Source: questionnaire answers + assessment classification. No biology copy.

---

## Chapter 2 — Why is this happening (**clinicalInterpretation only**)

```
Chapter2 {
  id, number=2, eyebrow, title
  narrative: string                      // long-form patient-facing explanation
  hairStory: { label, body }             // executive summary of factors
  factors: [
    {
      id, index, title, summary,
      hairCycleImpact, treatmentGoal,
      accentColor,
      sourceClinicalInterpretationId     // MUST trace to a clinicalInterpretation row
    }
  ]
  connectionScene: { label, body }       // how factors interact
  patientQuestionAnswered: "Why is this happening?"
  video: { durationSeconds, avatarEmotion, visualCue }
  sourcePolicy: "clinicalInterpretation_only"   // enforced
}
```

A renderer that prints a Chapter 2 factor without a corresponding `sourceClinicalInterpretationId` is non-conformant.

---

## Chapter 3 — How will we treat it

```
Chapter3 {
  id, number=3, eyebrow, title, intro
  phases: [
    {
      id, phaseLabel,
      kitName, kitDescription,
      problem,            // pattern being treated
      whyItMatters,       // mechanism
      howItHelps,         // ingredients
      expectedImpact,     // biological effect
      biologicalGoal,     // pattern → goal mapping for video / dashboard
      addressesFactorIds  // joins phase → Ch2 factors
    }
  ]
  patientQuestionAnswered: "What should I do?"
  video: { durationSeconds, avatarEmotion, visualCue }
}
```

Source: treatment-recommendation engine + kit library only. No new copy.

---

## Chapter 4 — What happens next

```
Chapter4 {
  id, number=4, eyebrow, title, intro
  timelineMarkers: [ { id, label, name, accentColor } ]     // Month 1-2, 3, 4, 5+
  stages: [
    { id, index, window, bullets: string[] }
  ]
  patientQuestionAnswered: "What can I expect?"
  video: { durationSeconds, avatarEmotion, visualCue }
}
```

Source: UniversalRecoveryMilestone + diet/lifestyle strategy (from V4 ClinicalReport).

---

## Closing

```
Closing { eyebrow, title, subtitle, body, cta: { label, actionId } }
```

---

## VideoScript (90 seconds)

Fixed time budget. The script is a thin projection of the chapters; it never authors new copy.

```
VideoScript {
  totalSeconds: 90
  wpm: 140
  segments: [
    { id:"intro",    kind:"intro",   durationSeconds:10, speech, avatarEmotion }
    { id:"chapter1", kind:"chapter", chapterId:"chapter1", durationSeconds:20 }
    { id:"chapter2", kind:"chapter", chapterId:"chapter2", durationSeconds:25 }
    { id:"chapter3", kind:"chapter", chapterId:"chapter3", durationSeconds:20 }
    { id:"chapter4", kind:"chapter", chapterId:"chapter4", durationSeconds:10 }
    { id:"closing",  kind:"closing", durationSeconds:5,  speech, avatarEmotion }
  ]
}
```

`chapter` segments resolve their narration from `chapterN.video` + the chapter's narrative/intro fields. No separate script generator.

---

## Surface projections

Each surface declares which slices of the payload it consumes. This is a manifest, not a transform. The payload is identical across surfaces.

| Surface | Reads |
|---|---|
| pdf | cover, executiveSummary, chapter1, chapter2, chapter3, chapter4, closing |
| doctorView | patient, executiveSummary, chapter2.factors, chapter3.phases, chapter4.stages |
| aiAvatar | videoScript |
| video90s | videoScript |
| doctorDashboard | patient, executiveSummary |
| whatsappSummary | patient, executiveSummary, first phase of chapter3, closing.cta |

---

## Validation gates (to be implemented after JSON is approved)

1. `chapter2.factors[*].sourceClinicalInterpretationId` non-empty and resolvable.
2. Every `executiveSummary.drivers[*].linksToChapter2FactorId` resolves to a real `chapter2.factors[*].id`.
3. Every `executiveSummary.drivers[*].linksToChapter3PhaseIds[*]` resolves to a real `chapter3.phases[*].id`.
4. Every `chapter3.phases[*].addressesFactorIds[*]` resolves to a real `chapter2.factors[*].id`.
5. `videoScript.segments` sum to exactly `totalSeconds`.
6. No surface renderer imports `composeNarrativeV3 | buildClinicalInsightStory | build3DAvatarScript | assembleNarratives | PatientNarrativeV3`.

---

## Approval checklist for `sara.fourChapterNarrative.json`

- [ ] Patient + clinician + cover copy match the PDF verbatim.
- [ ] Three drivers (genetic, PCOS hormonal, metabolic) with correct role/impact/stage.
- [ ] Chapter 1 patientFacts: hairPattern, duration, scalpConcerns, goal — all present.
- [ ] Chapter 1 anatomy: 4 parts (shaft, sebaceous, follicle column, bulb+papilla).
- [ ] Chapter 2 narrative: full PDF paragraph captured.
- [ ] Chapter 2 factors: 5 cards (hormonal/metabolic, stress shedding, genetic pattern, oxidative, scalp inflammation) with hairCycleImpact + treatmentGoal.
- [ ] Chapter 2 connectionScene captured.
- [ ] Chapter 3 phases: 4 (Phenotype Inflammation, Pro Fact Meta B PCOS, Pro Immune 5V Veg, Hair Fact FPHL) with problem/whyItMatters/howItHelps/expectedImpact.
- [ ] Chapter 4 markers: 4 (Month 1-2 Calm, 3 Recover, 4 Density, 5+ Hold) + 4 stages with bullets.
- [ ] Closing copy + CTA captured.
- [ ] VideoScript time budget (10/20/25/20/10/5 = 90s).
- [ ] All cross-references (driver↔factor, factor↔phase) resolve.

Once these are ticked, the JSON is locked. Renderer migration begins next; no engine code lands before that lock.

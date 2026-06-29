# 09 — Video / Avatar Architecture

## Executive Summary
**A patient-facing avatar video does not exist in this codebase.** What exists is a complete, validated **avatar dialogue script generator** (`src/packages/ai-engine/narrative-engine/build3DAvatarScript.ts`) that produces a structured `AvatarScript` with scene-by-scene dialogue, emotion tones, emphasis words, and millisecond pause hints — designed to feed a downstream 3D avatar renderer that has not been implemented. The directory reserved for it (`src/packages/ai-engine/avatar-engine/`) is empty. There is no narration audio pipeline, no lip-sync, no video composition layer, and no patient-facing video surface today. This doc catalogs exactly what *is* built so a future renderer can be wired in without rewriting the script layer.

## 1. What Exists Today

### 1.1 Avatar Script Generator (built)
`src/packages/ai-engine/narrative-engine/build3DAvatarScript.ts`

Inputs: `NarrativePipelineInput` ( `{ patient, clinicalProfile, therapyPlan, kitRecommendation, prognosis }` ).

Output: `AvatarScript` containing an ordered array of `AvatarScene` objects. Each scene has:
- A title / scene id
- One or more `AvatarDialogueSegment`s, each carrying:
  - `text` (final, naturalised — markdown stripped)
  - `emotion: AvatarEmotion` ('empathetic' | 'warm' | …)
  - `emphasis?: string[]` (words to stress)
  - `pauseAfterMs?: number`
- A tone (mapped from severity via `mappers/mapSeverityToTone.ts`)

### 1.2 Scenes Generated (per `build3DAvatarScript.ts` lines 22–...)
The script builder calls into specialised speech generators in `formatters/formatAvatarSpeech.ts`:

| Scene | Speech generator | Purpose |
|---|---|---|
| Intro | `getAvatarIntroText(patientName, diagnosisLabel, severity)` | Greeting tuned to severity |
| Understanding the problem | `getUnderstandingProblemSpeech` | What the patient is experiencing |
| Why follicles weakened | `getWhyFolliclesWeakenedSpeech` | Mechanism explanation |
| What triggered shedding | `getWhatTriggeredSheddingSpeech` | Patient-specific triggers |
| How therapies work | `getHowTherapiesWorkSpeech` | Therapy-need vocabulary |
| How kits help | `getHowKitsHelpSpeech` | Kit-specific mechanism |
| Recovery expectations | `getRecoveryExpectationsSpeech` | Timeline + outlook |
| Compliance | `getComplianceSpeech` | Adherence coaching |
| Outro | `getAvatarOutroText` | Close + next step |

### 1.3 Validators (built)
`src/packages/ai-engine/narrative-engine/validators/validateAvatarScript.ts` — schema validation of generated scripts.

### 1.4 Tests / Fixtures (built)
- `src/packages/ai-engine/narrative-engine/tests/avatarScript.test.ts`
- `src/packages/ai-engine/narrative-engine/fixtures/avatarFixtures.ts`

### 1.5 Speech Naturalisation (built)
`formatAvatarSpeech.ts` `naturaliseText()` strips markdown, collapses whitespace, normalises sentence boundaries — output is intended for TTS or motion-cued playback.

## 2. What Is Missing

| Layer | Required for video | Status |
|---|---|---|
| 3D avatar renderer (mesh, rigging, animation) | yes | **MISSING** — `src/packages/ai-engine/avatar-engine/` is empty |
| TTS / voice synthesis pipeline | yes | **MISSING** — no voice/audio code in repo |
| Lip-sync (phoneme-to-blendshape) | yes | **MISSING** |
| Video composition (scene cuts, b-roll, overlays) | yes | **MISSING** |
| Patient-facing video surface | yes | **MISSING** — no `<video>` element in any report page; no video route |
| Avatar identity (model, voice, name, brand) | yes | **MISSING** spec — no avatar identity defined |
| Educational asset library (illustrations the avatar references) | partial | `public/clinical-visuals/manifest.json` exists; no animation cues |
| Caption / subtitle generation | yes | **MISSING** (`text` field would feed it) |
| Storage / CDN for rendered videos | yes | **MISSING** |
| Personalised video delivery (per assessmentId) | yes | **MISSING** route |

## 3. Educational Assets (partial)
- `public/clinical-visuals/manifest.json` — manifest of clinical illustration assets [INFERRED purpose — file is present].
- `apps/patient-portal/src/components/visuals/` — empty directory (placeholder).
- `apps/patient-portal/src/components/cinematic/{CinematicContainer,CinematicVisualPanel}.tsx` — generic cinematic frames used by the processing screen; could host an avatar surface.

## 4. Implied Avatar Identity (vision)
From the architecture and avatar script structure, the *implied* avatar is:
- A single, consistent **"Dr.FACT consultant"** persona.
- Tone-tuned (empathetic / warm) by patient severity — meaning the avatar adapts speech but presumably not identity.
- Greets at intake (Stage 2 of consultation vision) and re-appears at delivery (Stage 10).

This is implied by:
- The script generator producing intro / outro plus mid-consultation scenes.
- The `mapSeverityToTone.ts` mapping severity → emotion.
- The consultation architecture's "single avatar across surfaces" implication.

No explicit avatar identity / model spec exists in the repo. [MISSING]

## 5. Narration Prompts
There are **no LLM prompts** for narration. All narration is generated by deterministic template functions in `formatAvatarSpeech.ts` (e.g., `getAvatarIntroText`), pulling from:
- `narrative-engine/constants.ts` (label maps: `DIAGNOSIS_LABELS`, `ROOT_CAUSE_LABELS`, `THERAPY_NEED_PATIENT_LABELS`, `RECOVERY_WINDOWS`).
- The patient's `ClinicalProfile`, `TherapyNeeds`, `KitRecommendation`, `PrognosisNarrative`.
- Tone selection via `mapSeverityToTone`.

This is consistent with the rest of the report pipeline (`08_REPORT_ARCHITECTURE.md` §8) — fully deterministic, audit-reconstructable, no AI inference layer.

## 6. Planned but Not Implemented (from elsewhere in repo)
- Avatar engine directory carved out: `src/packages/ai-engine/avatar-engine/` (empty since May 2026 per directory listing — see `00_REPOSITORY_AUDIT.md` §7).
- Consultation vision Stage 2 and Stage 10 reference the avatar's roles (intake companion + delivery reinforcement). See `07_HAIROS_CONSULTATION_VISION.md` §2.
- The `formatAvatarSpeech.AvatarEmotion` type and `pauseAfterMs` field anticipate a renderer that respects emotional cues and timing — the contract is ready for a player.

## 7. What a Renderer Would Need to Consume (contract)
The renderer should accept an `AvatarScript`:
```ts
interface AvatarScript {
  scenes: AvatarScene[];
}
interface AvatarScene {
  // sceneId, title, …
  dialogue: AvatarDialogueSegment[];
}
interface AvatarDialogueSegment {
  text: string;          // already naturalised, no markdown
  emotion: AvatarEmotion;
  emphasis?: readonly string[];
  pauseAfterMs?: number;
}
```
Wiring a renderer requires: TTS for `text` + emotion mapping → audio; lip-sync from audio; emphasis → animation cue (head tilt / hand gesture); pause → silence gap; emotion → facial / posture preset.

## 8. Summary Statement
**Today:** scripts only — text content for an avatar, fully personalized per patient, deterministic.
**Tomorrow:** a renderer + voice + identity + delivery route + storage are all needed for video to exist. The contract is in place; the implementation is not.

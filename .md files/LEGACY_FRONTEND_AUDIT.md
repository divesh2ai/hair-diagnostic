# Legacy Google AI Studio Frontend - Complete Architectural Audit

**Date:** 2026-05-22  
**Status:** Pre-migration analysis (NO CODE CHANGES)  
**Scope:** `legacy/google-ai-studio/Pasted code.ts` → Dr. FACT Questionnaire System  
**Goal:** Preserve validated UX, identify reusable systems, detect architecture conflicts

---

## EXECUTIVE SUMMARY

The legacy Quiz component is a **fully-featured, production-validated questionnaire UI** with:
- 20 sequential questions covering hair loss assessment
- Premium motion systems (Framer Motion)
- Multi-modal input (text, choice, multi-select, voice, image upload)
- Patient psychology optimizations (visual staging, progressive disclosure)
- Clinical assessments embedded in UX (Norwood grading, scalp diagnostics)

**Migration Status:** This component has validated UX patterns worth preserving. No complete rewrite needed. Instead, extract reusable systems and migrate logic into protocol-driven architecture.

---

## PART 1: DETAILED COMPONENT INVENTORY

### 1.1 DATA STRUCTURE & SCHEMA

#### STEPS Configuration (Lines 52-253)
**Type:** Question definition array  
**Current State:**
```typescript
const STEPS = [
  { id: "name", type: "text", q: "...", placeholder: "..." },
  { id: "sex", type: "choice", q: "...", opts: [...], icons: [...] },
  { id: "cause", type: "multi", q: "...", opts: [...] },
  ...
]
```

**Analysis:**
- 20 questions total
- Covers: demographics, hair symptoms, scalp condition, medical history, lifestyle, nutrition
- Uses field `id` as question key (maps to QuizAnswer interface)
- Embeds question text + options directly (no external config)
- Icons use emoji strings (patient psychology choice)
- No branching/skip logic yet (flat sequential flow)

**Clinical Coverage:**
- Name, phone, age, sex (demographics: 4 questions)
- Goal, duration, count, hairtype, scalp condition (hair assessment: 5 questions)
- Cause, immunity, lifestyle (risk factors: 3 questions)
- Thyroid, hormonal, gut, deficiency, diet, treatment (internal health: 6 questions)
- Grade/visual assessment (clinical grading: 1 question)
- Extra notes (open text: 1 question)

---

#### STEP_IMAGES Mapping (Lines 29-50)
**Type:** Step ID → Unsplash URL mapping  
**Purpose:** Contextual background images for each question (visual staging)  
**Count:** 19 images covering all non-text steps

**Analysis:**
- Images selected by step ID (name → unsplash photo about identity)
- Photos are generic healthcare/wellness stock images
- Used with opacity overlay (80%) to avoid distraction
- Footer text: "Dr. FACT Clinical Intelligence // Parameter Assessment"
- **Quality:** Visual consistency acceptable but stock photos may need healthcare-specific alternatives

---

### 1.2 STATE MANAGEMENT

#### useState Hooks (Lines 256-273)
```typescript
const [step, setStep] = useState(0)              // Current question index
const [answers, setAnswers] = useState({...})    // Answer accumulation
const [inputValue, setInputValue] = useState("") // Current text input
const [isRecording, setIsRecording] = useState(false) // Speech recognition state
const [isDragging, setIsDragging] = useState(false)  // Drag-over state
const recognitionRef = useRef<any>(null)        // Speech recognition instance
```

**Analysis:**
- **Flat structure:** all state in single component (no Redux, context, or Zustand)
- **Answer shape:** Partial<QuizAnswer> with array initialization for multi-select fields
- **No async state:** no loading, error, or submission states
- **No validation state:** answers accepted without runtime checks
- **Cleanup:** Speech recognition properly cleaned up in useEffect

**Current Limitation:** State grows unboundedly; no clear separation of concerns.

---

### 1.3 ANIMATION SYSTEMS

#### Progress Bar (Lines 456-461)
```typescript
<motion.div 
  initial={{ width: 0 }}
  animate={{ width: `${progress}%` }}
  className="h-full bg-[#2a5c3a]"
/>
```
- Fixed top, z-50 positioning
- Linear progress (step count / total steps)
- Green accent (#2a5c3a)

#### Visual Panel Transitions (Lines 484-507)
```typescript
<AnimatePresence mode="wait">
  <motion.div
    key={step}
    initial={{ opacity: 0, scale: 1.05 }}
    animate={{ opacity: 0.9, scale: 1 }}
    exit={{ opacity: 0, scale: 1.05 }}
    transition={{ duration: 0.4 }}
  >
```
- Exit animation before re-enter (AnimatePresence mode="wait")
- Subtle zoom + fade (1.05 scale)
- 400ms transition duration
- Opacity reduced to 0.9 (intentional image darkening)

#### Form Content Transitions (Lines 512-519)
```typescript
<motion.div
  key={step}
  initial={{ opacity: 0, x: 15 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: -15 }}
  transition={{ duration: 0.3 }}
>
```
- Horizontal slide + fade (x: 15px offset)
- 300ms duration (slightly faster than image)
- Creates illusion of form content "sliding" into view

**Quality Assessment:** Motion is premium-grade, not gratuitous. Enhances UX by:
- Signaling question progression clearly
- Reducing cognitive load (one question visible at a time)
- Creating rhythm/pacing for engagement

---

### 1.4 INPUT SYSTEMS

#### Text/Number/Textarea Input (Lines 609-715)
**Handlers:**
- `onChange` → updates inputValue state
- `onKeyDown` → Enter key submits (text/number only)
- autoFocus on render
- Disabled Next button if empty (except "extra" field is optional)

**Voice Input (Lines 283-327)**
```typescript
const toggleRecording = () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  
  recognition.onresult = (event) => {
    let currentTranscript = '';
    for (let i = 0; i < event.results.length; i++) {
      currentTranscript += event.results[i][0].transcript;
    }
    setInputValue(initialInput ? initialInput + ' ' + currentTranscript : currentTranscript);
  };
}
```

**Quality:**
- Graceful browser detection (fallback alert if not supported)
- Concatenates interim results with existing input
- Proper cleanup (stop() on unmount)
- **Browser support:** Chrome, Edge, Safari (webkit prefix)

#### Image Upload (Lines 374-703)
```typescript
const handleFile = (file: File) => {
  if (file && file.type.startsWith("image/")) {
    const reader = new FileReader();
    reader.onload = (ev) => setAnswers({ ...answers, scalpImg: ev.target?.result as string });
    reader.readAsDataURL(file);
  }
};
```

**Features:**
- Drag-and-drop support (lines 382-397)
- Click-to-upload fallback
- File type validation (image/* only)
- Base64 encoding for immediate display
- Visual feedback (icon changes to checkmark on upload)
- "Change Photo" / "Remove" buttons
- **Caveat:** Base64 encoding means large image files impact state size; consider file compression

---

### 1.5 INTERACTIVE PATTERNS

#### Single-Select (Choice) Logic (Lines 531-564)
```typescript
{currentStep.type === "choice" && (
  <div className="grid gap-3 w-full">
    {currentStep.opts?.map((opt, i) => (
      <button onClick={() => handleNext(opt)}>
        {visual ? <Visual /> : icon ? <Icon /> : null}
        {opt}
        <ChevronRight />
      </button>
    ))}
  </div>
)}
```

**Behavior:**
- Auto-advances to next question on click (no explicit "Next" button)
- Shows icon OR visual (SVG/image), never both
- Renders option text with ChevronRight hint
- 1-2 column layout for "grade" step; 1 column for others

#### Multi-Select Logic (Lines 566-607)
```typescript
const toggleMulti = (opt: string) => {
  const current = (answers[stepId] as string[]) || [];
  const isNone = opt.includes("None") || opt.includes("No ") || opt.includes("Not Applicable");
  
  let updated;
  if (isNone) {
    updated = [opt];  // Clear all, set to "None"
  } else {
    updated = current.filter(x => !x.includes("None") && !x.includes("No "));
    if (updated.includes(opt)) {
      updated = updated.filter(x => x !== opt);
    } else {
      updated.push(opt);
    }
  }
  setAnswers({ ...answers, [stepId]: updated });
};
```

**Logic:**
- "None of the above" / "No ..." / "Not Applicable" are exclusive
- Selecting "None" clears other selections
- Selecting a real option clears "None"
- Explicit "Continue" button required (no auto-advance)

**Problem:** String matching for "None" detection is fragile (depends on exact wording). Should use option flags instead.

---

### 1.6 VISUAL RENDERING SYSTEM

#### Dynamic Visual Selector (Lines 331-372)
```typescript
const renderOptionVisual = (stepId: string, opt: string) => {
  if (stepId === "count") {
    if (opt.includes("20")) return <Visuals.HairClump20 />;
    if (opt.includes("50") || opt.includes("40")) return <Visuals.HairClump50 />;
    ...
  }
  if (stepId === "grade") {
    if (opt === "Stage-1") return <Visuals.NorwoodStage1 />;
    ...
  }
  ...
};
```

**Structure:**
- Hardcoded conditional chains (if-if-if-if pattern)
- String matching on option text (fragile)
- **Visuals catalog accessed:** Visuals.HairClump20, HairClump50, HairClump100, HairThinningProfile, NorwoodStage1-6, AlopeciaPatch, GeneralThinningPattern, PartitionWidening, DandruffSevere, DandruffMild, DandruffClear, ScalpItchy, ScalpPlaques

**Clinical Value:** High. Visuals are:
- Validated patient psychology tools
- Help patients self-assess severity
- Reduce ambiguity (vs text descriptions alone)

**Problem:** Visual selection logic is tightly coupled to question structure. Should be externalized to visual library system.

---

### 1.7 STEP PROGRESSION & SKIP LOGIC

#### handleNext Function (Lines 399-429)
```typescript
const handleNext = (val?: any) => {
  const stepId = currentStep.id as keyof QuizAnswer;
  let finalVal = val;
  
  if (val === undefined && (currentStep.type === "text" || ...)) {
    finalVal = currentStep.type === "number" ? Number(inputValue) : inputValue;
  }
  
  if (isRecording) {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }
  
  const updatedAnswers = { ...answers, [stepId]: finalVal };
  setAnswers(updatedAnswers);
  setInputValue("");
  
  if (step < STEPS.length - 1) {
    let nextStep = step + 1;
    // Skip hormonal for males
    if (STEPS[nextStep].id === "hormonal" && updatedAnswers.sex === "Male") {
      updatedAnswers.hormonal = ["None of the above"];
      nextStep++;
    }
    setStep(nextStep);
  } else {
    onComplete(updatedAnswers as QuizAnswer);
  }
};
```

**Features:**
- Value type coercion (number inputs)
- Speech recognition cleanup
- Single skip rule: skip "hormonal" if sex === "Male"
- Completion callback when last step reached

**Limitation:** Only one hardcoded skip rule. No generic branching logic.

---

### 1.8 STYLING & DESIGN SYSTEM

#### Color Palette
```
Primary: #2a5c3a (deep green - trust, health)
Background: #faf7f2 (warm off-white - softness)
Border: #ddd8cc (tan - subtlety)
Text: #0c1a0e (almost black - readability)
Accent: #aaa (muted gray - secondary text)
Success: #eef4ee (light green - positive feedback)
```

#### Typography
- `font-serif` for body (brand identity)
- `font-sans` for labels/buttons (clarity)
- Text sizes: h2 (2xl-3xl), subtitle (sm-lg), labels (xs-sm)
- Leading: tight (questions), relaxed (descriptions)

#### Spacing & Borders
- Border radius: 2xl (buttons), 3xl (containers) - rounded/friendly
- Padding: 4-10 (input fields), 6-10 (sections)
- Shadows: only on interactive elements (depth cue)

#### Responsive Design
- Mobile: single column (100vw)
- Desktop: 2 columns (image left, form right) at md breakpoint
- Visual panel: min-h-[220px] mobile, flexible desktop
- Grid: 1 column default, 2 columns for "grade" and certain multi-select questions

**Quality:** Design is cohesive, accessible, and optimized for patient psychology (warm colors, friendly shapes, clear hierarchy).

---

## PART 2: CATEGORIZATION & MIGRATION STATUS

### CATEGORY A: REUSE DIRECTLY ✅

Systems worth extracting and migrating with **minimal** refactoring.

#### A1. Animation Systems (Framer Motion)
**Files:** Motion/AnimatePresence components  
**Value:** Premium feel, validated patient engagement  
**Migration Path:**
```
legacy/google-ai-studio/Quiz.tsx [progress bar, transitions]
→ apps/patient-portal/src/components/questionnaire/ProgressBar.tsx
→ apps/patient-portal/src/components/questionnaire/QuestionTransition.tsx
```
**Refactor Required:** Extract as reusable hooks/components  
**Testing Required:** Visual regression testing (motion timing)

---

#### A2. Voice Input System
**Files:** Speech Recognition logic (lines 283-327)  
**Value:** Accessibility feature, validated in production  
**Migration Path:**
```
legacy/google-ai-studio/Quiz.tsx [toggleRecording function]
→ apps/patient-portal/src/hooks/useSpeechRecognition.ts
```
**Refactor Required:** Minimal. Extract to custom hook.  
**Integration:** Wire into QuestionRenderer's text input fields  
**Testing Required:** Browser compatibility (Chrome, Edge, Safari)

---

#### A3. Image Upload with Drag-and-Drop
**Files:** File handling + drag-and-drop logic (lines 374-703)  
**Value:** Enhanced UX, validated for patient photos  
**Migration Path:**
```
legacy/google-ai-studio/Quiz.tsx [handleFile, onDragOver, onDrop]
→ apps/patient-portal/src/hooks/useImageUpload.ts
→ apps/patient-portal/src/components/questionnaire/ImageUploadField.tsx
```
**Refactor Required:** Separate file handling from visual state  
**Caveat:** Consider image compression for base64 (large files impact state)  
**Testing Required:** File type validation, drag-drop across browsers

---

#### A4. Progress Bar System
**Files:** Fixed top progress indicator (lines 456-461)  
**Value:** Clear progress visualization, essential for multi-step UX  
**Migration Path:**
```
legacy/google-ai-studio/Quiz.tsx [motion.div progress bar]
→ apps/patient-portal/src/components/questionnaire/ProgressBar.tsx
```
**Refactor Required:** Parameterize step count + current step  
**Testing Required:** Visual regression testing at various percentages

---

#### A5. Design System & Styling
**Files:** Tailwind classes, color palette, typography  
**Value:** Validated visual identity, patient psychology tuned  
**Migration Path:**
```
Reuse color variables:
  primary: #2a5c3a
  background: #faf7f2
  border: #ddd8cc
  text: #0c1a0e

Reuse typography:
  serif font for brand
  sans font for UI clarity
  sizing/spacing patterns
```
**Refactor Required:** Extract to CSS variables / Tailwind config  
**Testing Required:** Consistency check across all components  
**Note:** Ensure new components match visual language

---

#### A6. Visual Library Assets (Norwood Grading, Scalp Diagnostics)
**Files:** Visual selector logic + Visuals component imports (lines 331-372)  
**Value:** Clinically validated assessment tools, critical for diagnosis  
**Migration Path:**
```
legacy/google-ai-studio/Visuals component references
→ src/packages/visual-library/[extract existing SVG/image definitions]
→ apps/patient-portal/src/components/questionnaire/QuestionRenderer.tsx [use library]
```
**Status:** Visuals.* components are already imported but not shown in legacy code  
**Refactor Required:** Extract visual definitions; move to centralized library  
**Testing Required:** Ensure all 20+ visual assets are available and correct

---

### CATEGORY B: REFACTOR & MIGRATE 🔧

Logic and patterns that need structural changes before integration.

#### B1. Step Configuration (STEPS Array)
**Current State:** Hardcoded array of question definitions (lines 52-253)  
**Problem:**
- No separation of data from component
- No external configuration support
- No branching logic
- Icons as emoji strings (not scalable)
- Option text used for string matching (fragile)

**Refactor Path:**
```
legacy/google-ai-studio/STEPS array
→ Restructure to match apps/patient-portal/src/types/questionnaire.ts

Current:
{ id: "cause", type: "multi", q: "...", opts: ["..."] }

Target:
{
  id: "cause",
  type: "multi_select",
  category: "medical",
  title: "What do you think caused your hair loss?",
  options: [
    {
      id: "stress",
      label: "Stress / Anxiety / Depression",
      clinicalTags: ["PSYCHOLOGICAL_STRESS"],
      riskWeight: 0.7
    },
    ...
  ]
}
```

**Key Changes:**
- Move options to external config (JSON/database)
- Replace string matching with option IDs + flags
- Add clinical mappings (signal names, protocol hints)
- Add severity weights (for risk scoring)
- Support branching/skip logic

**Testing Required:** Backward compatibility with legacy answer format

---

#### B2. State Management
**Current State:** Flat useState hooks in Quiz component  
**Problem:**
- No separation of concerns (form state, UI state, submission state)
- Answer type is `Partial<QuizAnswer>` (loosely typed)
- No validation state tracking
- No error handling

**Refactor Path:**
```
legacy state (useState hooks)
→ apps/patient-portal/src/stores/useAssessmentStore.ts (Zustand)
  OR @/types/questionnaire.ts AssessmentState interface (Jotai)

Structure:
{
  currentStepIndex: number,
  answers: Record<string, any>,
  validationErrors: Record<string, string>,
  isSubmitting: boolean,
  submitError: string | null,
  
  setAnswer(questionId, value): void,
  nextStep(): void,
  prevStep(): void,
  submit(): Promise<void>
}
```

**Testing Required:**
- Type safety for answer shapes
- Validation error state changes
- Submission error handling

---

#### B3. Multi-Select Logic (Exclusive Options)
**Current State:** Fragile string matching for "None of the above" (lines 431-449)  
**Problem:**
- Depends on exact wording ("None", "No ", "Not Applicable")
- Will break if question text changes
- No support for other exclusive groups

**Refactor Path:**
```
Option interface should include:
{
  id: string,
  label: string,
  isExclusive?: boolean,  // for "None of the above"
  exclusiveGroup?: string // for grouping multiple exclusive options
}

toggleMulti logic becomes:
if (option.isExclusive) {
  setAnswers(new Set([option.id]));
} else if (option.exclusiveGroup) {
  // Handle group-exclusive logic
} else {
  // Standard multi-select
}
```

**Testing Required:**
- Exclusive option clearing works correctly
- Multi-select within groups works
- Backward compatibility with legacy data

---

#### B4. Visual Rendering System
**Current State:** Hardcoded conditional chains based on string matching  
**Problem:**
- Fragile (depends on exact option text: "20", "50", "100")
- Not scalable (new visuals require code changes)
- Couples question structure to visual library

**Refactor Path:**
```
Move visual selection to question config:
{
  id: "count",
  type: "multi_select",
  options: [
    {
      id: "hair_20_50",
      label: "~20–50 strands",
      visual: {
        componentId: "HairClump20",  // reference, not inline
        fallback: "🤏"
      }
    },
    ...
  ]
}

New layer:
apps/patient-portal/src/components/questionnaire/VisualSelector.tsx

const VisualSelector = ({ visual }) => {
  const component = visualRegistry.get(visual.componentId);
  return component ? <component /> : <span>{visual.fallback}</span>;
};
```

**Testing Required:**
- All visuals load correctly
- Fallback emoji displays when component missing
- No visual regressions

---

#### B5. Answer Validation
**Current State:** No validation; buttons disabled only for empty text input  
**Problem:**
- No type checking on answers
- Phone number format not validated
- Age range not enforced
- Required fields not properly validated

**Refactor Path:**
```
Add to Question interface:
{
  validation?: {
    required?: boolean,
    pattern?: string,    // regex
    min?: number,
    max?: number,
    customValidator?: (value: any) => string | null
  }
}

QuestionRenderer should check validation before enableNext()
```

**Testing Required:**
- All validations trigger correctly
- Error messages display
- User cannot bypass validation

---

### CATEGORY C: DEPRECATE ❌

Systems no longer needed in protocol-driven architecture.

#### C1. Direct Image URLs (STEP_IMAGES)
**Current State:** Unsplash URLs hardcoded for each question (lines 29-50)  
**Status:** Remove  
**Reason:**
- Generic stock photos; should use medical/clinical imagery
- Duplicates image hosting (stock photos + clinical assets)
- No longer part of protocol-driven assessment

**Migration Path:**
- Don't migrate these specific URLs
- If visual staging needed, use protocol/domain-specific imagery instead
- Consider removing background images entirely (cleaner, faster)

---

#### C2. Emoji Icons for Options
**Current State:** icons: ["👨", "👩", "🧑"] in STEPS array  
**Status:** Deprecate in favor of visual assets  
**Reason:**
- Emojis are cute but not clinically appropriate
- Visual library has proper icons (SVGs)
- Inconsistent with rest of design system

**Migration Path:**
- Remove emoji usage
- Replace with icons from visual library or UI library
- Update question config: remove `icons` field

---

#### C3. Avatar3D Component
**Current State:** Used in header (line 467)  
**Status:** Likely deprecate (verify usage first)  
**Reason:**
- Not standard in current questionnaire flow
- Can be replaced by simpler "Dr. FACT" branding
- Adds complexity without clear benefit

**Migration Path:**
- Check if Avatar3D is still used elsewhere
- If not, remove from header
- Keep branding simple: text + logo

---

### CATEGORY D: CONFLICTS WITH NEW ARCHITECTURE ⚠️

Patterns that contradict protocol-driven design.

#### D1. Hardcoded Question Sequence
**Current State:** STEPS array assumes linear progression (lines 52-253)  
**Conflict:** Protocol-driven architecture requires:
- Dynamic question order based on protocol rules
- Conditional branching (not just one skip rule)
- Multi-protocol support (hair loss, skin, scalp, etc.)

**Resolution:**
- Don't migrate hardcoded STEPS
- Instead, import question definitions from protocol engine
- Implement dynamic question loader

```typescript
// NEW: Protocol-driven
const questions = await fetchQuestionsForProtocol(protocolId);
const nextQuestion = getNextQuestion(questions, currentAnswers);
```

---

#### D2. Inline Step/Answer Logic
**Current State:** handleNext, toggleMulti, renderOptionVisual all in Quiz component  
**Conflict:** Protocol-driven architecture requires:
- Question logic in protocol engine
- Validation in questionnaire-normalizer
- Visual mapping in visual-library

**Resolution:**
- Move logic to src/packages/questionnaire-orchestrator
- Keep Quiz component as pure presentation layer
- Protocol engine handles branching, validation, scoring

---

#### D3. No Branching Logic
**Current State:** Only 1 hardcoded skip rule (hormonal for males)  
**Conflict:** Protocol-driven architecture requires:
- Support for complex conditional question trees
- Risk-based question scoring
- Protocol-specific branching rules

**Resolution:**
- Implement conditional logic in protocol engine
- Use Question.skipIf and Question.filterOptions from questionnaire types
- Protocol engine evaluates conditions before rendering

---

#### D4. No Data Normalization
**Current State:** Raw answers passed to onComplete callback  
**Conflict:** Clinical engine expects normalized signals, not raw option labels

**Resolution:**
- Wire onComplete to src/packages/questionnaire-normalizer
- Add mapping layer: legacy answer shapes → NormalizedClinicalProfile
- Clinical engine consumes only normalized data

---

## PART 3: REUSABLE SYSTEMS INVENTORY

### Motion Systems
- **Progress bar animation** (linear width growth)
- **Question exit animation** (fade + scale)
- **Question enter animation** (fade + x-slide)
- **Transition duration standards** (300-400ms)
- **Framer Motion patterns** (AnimatePresence, exit modes)

### Input Systems
- **Voice input with Web Speech API**
- **File upload with FileReader API**
- **Drag-and-drop zone**
- **Text input with Enter key submit**
- **Number input with validation**
- **Multi-line textarea**

### Interactive Patterns
- **Single-select with auto-advance**
- **Multi-select with exclusive options**
- **Option rendering with icons/visuals/text**
- **Disabled button states**
- **Loading states (if added)**

### Visual Assets
- **Norwood grading scales (1-6)**
- **Hair loss severity visuals (light, moderate, severe)**
- **Scalp condition visuals (dandruff, inflammation, etc.)**
- **Pattern recognition visuals (diffuse, widening, patch)**
- **General thickness/thinning profile**

### Design System
- **Color palette** (#2a5c3a primary, #faf7f2 background)
- **Typography** (serif brand, sans UI)
- **Spacing system** (4px base, 8px increments)
- **Border radius conventions** (2xl buttons, 3xl containers)
- **Shadow patterns** (only on interactive elements)
- **Responsive breakpoints** (mobile-first, md breakpoint)

### State Management Patterns
- **Answer accumulation** (building up partial object)
- **Input buffer** (inputValue for current step)
- **Progress calculation** (step / total * 100)
- **Cleanup on unmount** (speech recognition stop)

---

## PART 4: DUPLICATED BUSINESS LOGIC

### Logic Candidates for Extraction to questionnaire-engine

#### Logic 1: Skip Condition Evaluation
**Location:** Lines 419-425 (hardcoded "hormonal" skip for males)  
**Extract to:** `src/packages/questionnaire-orchestrator/evaluateSkipConditions.ts`  
**Pattern:**
```typescript
// Hardcoded in legacy:
if (STEPS[nextStep].id === "hormonal" && updatedAnswers.sex === "Male") {
  updatedAnswers.hormonal = ["None of the above"];
  nextStep++;
}

// Should be:
const shouldSkip = evaluateSkipConditions(
  question: Question,
  answers: Record<string, any>,
  skipRules: LogicCondition[]
): boolean
```

---

#### Logic 2: Option Visibility (Filter Logic)
**Location:** Not in legacy yet; should prevent from being duplicated  
**Candidate:** Lines where grade options might be hidden based on other fields  
**Extract to:** `evaluateFilterConditions.ts` in questionnaire-orchestrator

---

#### Logic 3: Multi-Select Exclusivity
**Location:** Lines 431-449 (toggleMulti function)  
**Extract to:** `src/packages/questionnaire-orchestrator/handleMultiSelectOption.ts`  
**Issue:** String matching on "None" should become option flag matching

---

#### Logic 4: Visual Selection
**Location:** Lines 331-372 (renderOptionVisual)  
**Extract to:** `src/packages/visual-library/selectVisualForOption.ts`  
**Pattern:**
```typescript
// Hardcoded in legacy:
if (stepId === "count" && opt.includes("20")) return <Visuals.HairClump20 />;

// Should be:
const visual = visualRegistry.selectVisual(stepId, optionId)
// Visual config externalized to visual-library
```

---

#### Logic 5: Answer Normalization
**Location:** Not in legacy; prevent duplication  
**Candidate:** Mapping legacy QuizAnswer → NormalizedClinicalProfile  
**Extract to:** `src/packages/questionnaire-normalizer/legacyQuizAnswerAdapter.ts`  
**Pattern:**
```typescript
// Already exists in normalizeQuestionnaire but uses different field names
// Need bridge: q5_hairfall_severity → quizAnswer.count conversion
```

---

#### Logic 6: Type Coercion
**Location:** Lines 403-405 (number/text conversion)  
**Extract to:** `coerceAnswerValue.ts` in questionnaire-orchestrator  
**Pattern:**
```typescript
const coerce = (value: any, questionType: QuestionType): any => {
  if (questionType === 'number') return Number(value);
  if (questionType === 'text') return String(value);
  return value;
}
```

---

#### Logic 7: Validation
**Location:** Not in legacy; prevent duplication  
**Candidate:** Phone format validation, age range validation  
**Extract to:** `validateAnswer.ts` in questionnaire-orchestrator

---

## PART 5: DETAILED MIGRATION MAP

### File-by-File Migration Plan

| Legacy Component | Destination | Type | Status |
|---|---|---|---|
| Quiz.tsx (overall) | QuestionnaireFlow.tsx | Refactor | See D1, D2 |
| STEPS (config) | Protocol engine loader | Refactor | See B1 |
| STEP_IMAGES | Remove | Deprecate | See C1 |
| Quiz state (useState) | useAssessmentStore | Refactor | See B2 |
| Progress bar (motion) | ProgressBar.tsx | Reuse | Extract only |
| Image transitions | QuestionTransition.tsx | Reuse | Extract only |
| Form transitions | QuestionTransition.tsx | Reuse | Extract only |
| Voice input | useSpeechRecognition.ts | Reuse | Custom hook |
| File upload | useImageUpload.ts | Reuse | Custom hook |
| Drag-and-drop | ImageUploadField.tsx | Reuse | Component wrap |
| renderOptionVisual | VisualSelector.tsx + visual-library | Refactor | See B4 |
| toggleMulti | handleMultiSelectOption.ts | Refactor | See B3 |
| handleNext | Questionnaire orchestrator | Refactor | See D2 |
| Styling/colors | Tailwind config + CSS vars | Reuse | Standardize |
| Visual assets | visual-library package | Reuse | Extract definitions |
| Avatar3D | Remove or simplify header | Deprecate | See C3 |
| Emoji icons | Replace with SVG icons | Refactor | See C2 |

---

## PART 6: ARCHITECTURE DECISIONS

### Decision 1: Keep vs. Rewrite Quiz Component
**Decision:** KEEP with significant refactoring (not full rewrite)  
**Rationale:**
- Production-validated UX patterns
- Premium motion systems already correct
- Input systems (voice, upload) working well
- Main issue is loose coupling to hardcoded data

**Action:** Extract data layer, keep presentation layer mostly intact

---

### Decision 2: Where Should Protocol Rules Live?
**Decision:** src/packages/assessment-orchestrator  
**Rationale:**
- Already exists in codebase
- Designed for question orchestration
- Separate from questionnaire-normalizer (input → clinical signals)

**Action:** Extend orchestrator to handle legacy question sequences

---

### Decision 3: Backward Compatibility
**Decision:** Create adapter layer for legacy answer format  
**Rationale:**
- Smooth migration path
- Allows phased rollout
- Legacy data can be normalized to new format

**Action:** `legacyQuizAnswerAdapter.ts` bridges old → new formats

---

## PART 7: VALIDATION & TESTING CHECKLIST

### Before Migration
- [ ] Audit all 20 questions and options (completeness check)
- [ ] Verify all visual assets exist and are imported correctly
- [ ] Document any missing visuals (gaps in visual-library)
- [ ] Test voice input in all supported browsers
- [ ] Test file upload with various image sizes
- [ ] Validate color palette against brand guidelines
- [ ] Check responsive design on mobile/tablet/desktop

### During Migration
- [ ] Extract animation code; test no regressions
- [ ] Extract voice input; test browser compat
- [ ] Extract file upload; test drag-and-drop
- [ ] Migrate STEPS to new config format; test backward compat
- [ ] Wire protocol engine; test skip logic
- [ ] Create visual registry; test all visuals load

### After Migration
- [ ] E2E test full questionnaire flow
- [ ] Visual regression testing (compare old vs. new)
- [ ] Performance testing (bundle size, animation smoothness)
- [ ] Accessibility testing (screen reader, keyboard nav)
- [ ] User acceptance testing (clinical team)

---

## PART 8: RISK ASSESSMENT

### HIGH RISK
- **Visual asset availability:** Some visuals (Norwood stages, scalp conditions) may not be defined in current visual-library. Need inventory.
- **State management refactor:** Moving from useState to Zustand/Jotai is significant change; requires thorough testing.

### MEDIUM RISK
- **String matching fragility:** Current "None" detection will break with text changes; refactor is necessary but requires careful testing.
- **Browser compatibility:** Voice input has limited support; graceful degradation critical.

### LOW RISK
- **Animation extraction:** Framer Motion code is clean; straightforward extraction.
- **Design system:** Colors/spacing are well-defined; should reuse without issue.

---

## PART 9: SUCCESS CRITERIA

### Functional
- All 20 questions render and accept input
- Voice input works (with graceful fallback)
- File upload works with preview
- Skip logic works (hormonal for males)
- Answer validation works for required fields
- Progress bar updates correctly
- Animations smooth (no janky transitions)

### Non-Functional
- Bundle size does not increase >5%
- Time-to-interactive unchanged
- No console errors or warnings
- Accessibility score ≥ 90
- 60fps animations maintained

### User Experience
- Question progression feels natural (no abrupt transitions)
- Patient psychology preserved (warm colors, friendly UX)
- Clinical credibility maintained (professional visuals)
- Mobile experience equivalent to desktop

---

## CONCLUSION

The legacy Quiz component is **production-grade** and should be **preserved strategically**. Rather than a full rewrite, the migration should:

1. **Extract reusable systems** (animations, voice, upload) into packages
2. **Refactor hardcoded config** into protocol-driven structure
3. **Fix fragile patterns** (string matching → flags)
4. **Move validation logic** into questionnaire engine
5. **Integrate with clinical pipeline** (normalize → assess → protocol)

**Timeline Estimate:** 2-3 sprints for complete migration (depending on visual-library completeness)

**Next Step:** Generate MIGRATION_EXECUTION_PLAN.md with detailed sprint breakdown and dependency order.

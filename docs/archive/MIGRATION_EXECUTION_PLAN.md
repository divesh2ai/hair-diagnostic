# Legacy Google AI Studio Frontend - Migration Execution Plan

**Date:** 2026-05-22  
**Status:** Ready for implementation (STEP-BY-STEP, not all-at-once)  
**Duration:** 2-3 sprints (estimated)  
**Key Principle:** Extract, don't rewrite. Preserve, don't replace.

---

## STRATEGIC OVERVIEW

### Phase 1: FOUNDATION (Sprint 1)
Extract reusable systems without modifying legacy code. Build new infrastructure that legacy can feed into.

### Phase 2: INTEGRATION (Sprint 2)
Wire extracted systems together. Create protocol-driven question loader. Begin incremental migration.

### Phase 3: CUTOVER (Sprint 3)
Full protocol integration. Legacy questions → protocol format. Sunset legacy component.

---

## PHASE 1: FOUNDATION (Sprint 1) 🏗️

### GOAL
Extract 5 major systems from legacy into reusable packages. Create new infrastructure without touching legacy code.

### DEPENDENCY ORDER (Critical: Execute in this order)

#### ✅ 1.1 - Extract Design System

**Task:** Standardize colors, typography, spacing  
**Owner:** Frontend Lead  
**Effort:** 2 hours  
**Files to Create:**
```
src/
  styles/
    design-system.css          # CSS variables
    tailwind-extends.config.js # Tailwind customization
```

**Actions:**
```css
/* src/styles/design-system.css */
:root {
  --primary: #2a5c3a;
  --background: #faf7f2;
  --border: #ddd8cc;
  --text: #0c1a0e;
  --accent: #aaa;
  --success: #eef4ee;
  
  --radius-button: 1rem;     /* 2xl */
  --radius-container: 1.5rem; /* 3xl */
  
  --font-serif: 'Georgia', serif;
  --font-sans: 'Inter', sans-serif;
  
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
}
```

**Tests:**
- [ ] All colors match legacy component
- [ ] Typography sizes match
- [ ] Responsive breakpoints work

**Acceptance Criteria:**
- [ ] CSS variables defined
- [ ] Tailwind extends config
- [ ] All legacy colors present
- [ ] No Tailwind warnings

**Status:** FOUNDATIONAL - Unlock all downstream work

---

#### ✅ 1.2 - Create Visual Registry

**Task:** Extract and catalog all visual assets from visual-library  
**Owner:** Product + Frontend  
**Effort:** 4 hours  
**Files to Create:**
```
src/packages/visual-library/
  registry.ts                 # Visual asset catalog
  components/
    norwood-scales/
      Stage1.tsx
      Stage2.tsx
      ... (1-6)
    scalp-conditions/
      DandruffClear.tsx
      DandruffMild.tsx
      DandruffSevere.tsx
      ScalpItchy.tsx
      ScalpPlaques.tsx
    hair-patterns/
      HairClump20.tsx
      HairClump50.tsx
      HairClump100.tsx
      HairThinningProfile.tsx
      PartitionWidening.tsx
      AlopeciaPatch.tsx
      GeneralThinningPattern.tsx
```

**Actions:**
1. Audit legacy Visuals.* imports to identify all assets
2. Check if components exist in visual-library already
3. If missing, create SVG placeholders (can be replaced later)
4. Build registry:

```typescript
// src/packages/visual-library/registry.ts
export const visualRegistry = {
  norwood: {
    '1': () => import('./components/norwood-scales/Stage1'),
    '2': () => import('./components/norwood-scales/Stage2'),
    // ...
  },
  scalp: {
    dandruff_clear: () => import('./components/scalp-conditions/DandruffClear'),
    dandruff_mild: () => import('./components/scalp-conditions/DandruffMild'),
    // ...
  },
  patterns: {
    hair_clump_20: () => import('./components/hair-patterns/HairClump20'),
    // ...
  }
};

export function getVisual(category: string, key: string) {
  const categoryRegistry = visualRegistry[category];
  if (!categoryRegistry) return null;
  return categoryRegistry[key];
}
```

**Tests:**
- [ ] All visuals from legacy are in registry
- [ ] Each visual renders without errors
- [ ] Lazy loading works (dynamic imports)
- [ ] Fallback emoji displays if visual missing

**Acceptance Criteria:**
- [ ] Registry complete (20+ assets cataloged)
- [ ] All visuals importable
- [ ] No missing components
- [ ] Performance tested (lazy loading)

**Status:** BLOCKING - Required for question rendering

---

#### ✅ 1.3 - Create useSpeechRecognition Hook

**Task:** Extract voice input logic into reusable custom hook  
**Owner:** Frontend  
**Effort:** 2 hours  
**Files to Create:**
```
apps/patient-portal/src/hooks/
  useSpeechRecognition.ts
```

**Code:**
```typescript
// apps/patient-portal/src/hooks/useSpeechRecognition.ts
import { useRef, useState, useCallback } from 'react';

interface UseSpeechRecognitionOptions {
  onResult?: (transcript: string) => void;
  onError?: (error: string) => void;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || 
                             (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      options.onError?.('Speech recognition not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      options.onResult?.(transcript);
    };
    recognition.onerror = (event: any) => {
      options.onError?.(event.error);
      setIsRecording(false);
    };
    recognition.onend = () => setIsRecording(false);

    recognition.start();
    recognitionRef.current = recognition;
  }, [isRecording, options]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  return { isRecording, toggleRecording, stopRecording };
}
```

**Tests:**
- [ ] Hook initializes without errors
- [ ] isRecording state toggles correctly
- [ ] Transcript callback fires
- [ ] Cleanup happens on unmount
- [ ] Browser detection works (fallback message)
- [ ] Works in Chrome, Edge, Safari

**Acceptance Criteria:**
- [ ] Hook exports from apps/patient-portal/src/hooks/index.ts
- [ ] TypeScript types correct
- [ ] Browser compatibility verified
- [ ] No console errors

**Status:** REUSABLE - Can be used in any text input

---

#### ✅ 1.4 - Create useImageUpload Hook

**Task:** Extract file upload + drag-and-drop logic  
**Owner:** Frontend  
**Effort:** 3 hours  
**Files to Create:**
```
apps/patient-portal/src/hooks/
  useImageUpload.ts
```

**Code:**
```typescript
// apps/patient-portal/src/hooks/useImageUpload.ts
import { useCallback, useState } from 'react';

interface UseImageUploadOptions {
  maxSizeBytes?: number;
  onImageSelected?: (dataUrl: string) => void;
  onError?: (error: string) => void;
}

export function useImageUpload(options: UseImageUploadOptions = {}) {
  const [isDragging, setIsDragging] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { maxSizeBytes = 5 * 1024 * 1024, onImageSelected, onError } = options;

  const handleFile = useCallback((file: File) => {
    setError(null);

    if (!file.type.startsWith('image/')) {
      const msg = 'Please select an image file';
      setError(msg);
      onError?.(msg);
      return;
    }

    if (file.size > maxSizeBytes) {
      const msg = `File size exceeds ${maxSizeBytes / 1024 / 1024}MB`;
      setError(msg);
      onError?.(msg);
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImageDataUrl(dataUrl);
      onImageSelected?.(dataUrl);
    };
    reader.onerror = () => {
      const msg = 'Failed to read file';
      setError(msg);
      onError?.(msg);
    };
    reader.readAsDataURL(file);
  }, [maxSizeBytes, onImageSelected, onError]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const clearImage = useCallback(() => {
    setImageDataUrl(null);
    setError(null);
  }, []);

  return {
    isDragging,
    imageDataUrl,
    error,
    handleFile,
    onDragOver,
    onDragLeave,
    onDrop,
    clearImage,
  };
}
```

**Tests:**
- [ ] File type validation works (rejects non-images)
- [ ] File size validation works
- [ ] FileReader correctly converts to data URL
- [ ] Drag-and-drop triggers correct state changes
- [ ] Error messages display correctly
- [ ] Clear function works

**Acceptance Criteria:**
- [ ] Hook exports correctly
- [ ] All state managed cleanly
- [ ] Error handling robust
- [ ] TypeScript types correct

**Status:** REUSABLE - Can be used in any image upload field

---

#### ✅ 1.5 - Create ProgressBar Component

**Task:** Extract progress bar with motion animation  
**Owner:** Frontend  
**Effort:** 1 hour  
**Files to Create:**
```
apps/patient-portal/src/components/questionnaire/
  ProgressBar.tsx
```

**Code:**
```typescript
// apps/patient-portal/src/components/questionnaire/ProgressBar.tsx
'use client';

import { motion } from 'framer-motion';

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  const progress = Math.round(((currentStep + 1) / totalSteps) * 100);

  return (
    <div className="fixed top-0 left-0 w-full h-1 bg-[#eef4ee] z-50">
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.4 }}
        className="h-full bg-[#2a5c3a]"
      />
    </div>
  );
}
```

**Tests:**
- [ ] Progress bar renders
- [ ] Width animates smoothly
- [ ] Progress calculation correct (0-100%)
- [ ] Colors match design system

**Acceptance Criteria:**
- [ ] Component exports
- [ ] Animation smooth (60fps)
- [ ] TypeScript types correct
- [ ] Color matches legacy

**Status:** READY - Can be used immediately in new questionnaire

---

#### ✅ 1.6 - Create Question Transition Component

**Task:** Extract motion animation patterns for questions  
**Owner:** Frontend  
**Effort:** 2 hours  
**Files to Create:**
```
apps/patient-portal/src/components/questionnaire/
  QuestionTransition.tsx
```

**Code:**
```typescript
// apps/patient-portal/src/components/questionnaire/QuestionTransition.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode } from 'react';

interface QuestionTransitionProps {
  key: string;
  type: 'image' | 'form';
  children: ReactNode;
}

export function QuestionTransition({ key, type, children }: QuestionTransitionProps) {
  const variants = {
    image: {
      initial: { opacity: 0, scale: 1.05 },
      animate: { opacity: 0.9, scale: 1 },
      exit: { opacity: 0, scale: 1.05 },
      transition: { duration: 0.4 },
    },
    form: {
      initial: { opacity: 0, x: 15 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -15 },
      transition: { duration: 0.3 },
    },
  };

  const config = variants[type];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={key}
        {...config}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

**Tests:**
- [ ] Image transition animates correctly
- [ ] Form transition animates correctly
- [ ] Timing matches legacy (400ms vs 300ms)
- [ ] No janky transitions

**Acceptance Criteria:**
- [ ] Component exports
- [ ] Both transition types work
- [ ] Animation matches legacy visual feel
- [ ] Performance tested

**Status:** READY - Can be used in new questionnaire

---

### Phase 1 Summary

**What We've Built:**
- ✅ Design system standardized (CSS variables, Tailwind config)
- ✅ Visual asset registry complete
- ✅ Voice input hook ready
- ✅ Image upload hook ready
- ✅ Progress bar component ready
- ✅ Question transition component ready

**What's Next:**
- [ ] Verify all visuals in registry (action item for product team)
- [ ] Test hooks in isolation (automated tests)
- [ ] Get visual approval from design team

**Timeline:** 14 hours total → can be completed in 2 days

---

## PHASE 2: INTEGRATION (Sprint 2) 🔗

### GOAL
Wire extracted systems together. Create protocol-driven question loader. Begin incremental migration.

---

#### ✅ 2.1 - Create Question Configuration Schema

**Task:** Define new question format (refactored from legacy STEPS)  
**Owner:** Product + Frontend  
**Effort:** 3 hours  
**Files to Modify:**
```
apps/patient-portal/src/types/
  questionnaire.ts  (EXTEND with visual mappings)
```

**Changes:**
```typescript
// Add to existing Question interface:
export interface Question {
  // ... existing fields ...
  
  visualMapping?: {
    // Maps option ID to visual registry key
    optionId: string;
    category: 'norwood' | 'scalp' | 'patterns';
    key: string; // e.g., 'hair_clump_20'
    fallbackEmoji?: string;
  }[];

  clinicalTags?: {
    optionId: string;
    tags: string[]; // e.g., ['PSYCHOLOGICAL_STRESS', 'HIGH_SEVERITY']
  }[];

  riskWeights?: {
    optionId: string;
    weight: number; // 0.0 - 1.0
  }[];
}
```

**Actions:**
1. Update questionnaire.ts with new fields
2. Create migration guide: legacy STEPS → new format
3. Document visual registry key names

**Tests:**
- [ ] Types compile without errors
- [ ] Backward compatible (optional fields)
- [ ] All legacy questions mappable to new format

**Acceptance Criteria:**
- [ ] Types exported correctly
- [ ] No TypeScript errors
- [ ] Documentation complete

**Status:** BLOCKING - Required for question renderer

---

#### ✅ 2.2 - Convert Legacy Questions to New Format

**Task:** Migrate 20 hardcoded STEPS to new schema  
**Owner:** Product  
**Effort:** 4 hours  
**Files to Create:**
```
apps/patient-portal/src/config/
  questions/
    hair-loss-assessment.json  # New format questions
  question-migration-map.ts    # Legacy → new mapping
```

**Example (Before → After):**
```typescript
// LEGACY (Pasted code.ts)
{
  id: "count",
  type: "multi",
  q: "How much hair do you lose per day?",
  opts: [
    "~20–50 strands (Normal range)",
    "~50–100 strands (Noticeable)",
    "100+ strands (Heavy loss)",
    "Just thinning, no visible fall",
  ],
  icons: ["🤏", "✋", "🫲", "🔍"],
}

// NEW FORMAT
{
  id: "count",
  type: "multi_select",
  category: "hair_health",
  title: "How much hair do you lose per day?",
  required: true,
  options: [
    {
      id: "hair_20_50",
      label: "~20–50 strands (Normal range)",
      severityLevel: 1,
      clinicalTags: ["HAIR_LOSS_MILD"],
      riskWeight: 0.2,
      visual: {
        category: "patterns",
        key: "hair_clump_20",
        fallbackEmoji: "🤏"
      }
    },
    {
      id: "hair_50_100",
      label: "~50–100 strands (Noticeable)",
      severityLevel: 2,
      clinicalTags: ["HAIR_LOSS_MODERATE"],
      riskWeight: 0.5,
      visual: {
        category: "patterns",
        key: "hair_clump_50",
        fallbackEmoji: "✋"
      }
    },
    // ... more options
  ]
}
```

**Actions:**
1. Create migration spreadsheet (legacy ID → new ID mapping)
2. Build all 20 questions in new format
3. Validate each visual mapping against registry
4. Create adapter function for backward compatibility

```typescript
// question-migration-map.ts
export function adaptLegacyAnswer(questionId: string, answer: any): string | string[] {
  // Maps old answer format → new option IDs
  const mapping = {
    'count': {
      '~20–50 strands (Normal range)': 'hair_20_50',
      '~50–100 strands (Noticeable)': 'hair_50_100',
      // ...
    },
    // ... more question mappings
  };
  
  const questionMapping = mapping[questionId];
  if (!questionMapping) return answer;
  
  if (Array.isArray(answer)) {
    return answer.map(a => questionMapping[a] || a);
  }
  return questionMapping[answer] || answer;
}
```

**Tests:**
- [ ] All 20 questions converted
- [ ] All visuals mapped correctly
- [ ] No orphaned option IDs
- [ ] Backward compat adapter works

**Acceptance Criteria:**
- [ ] questions/hair-loss-assessment.json complete
- [ ] All visuals in registry
- [ ] question-migration-map.ts exports correctly
- [ ] No validation errors

**Status:** CRITICAL - Blocks question rendering

---

#### ✅ 2.3 - Create QuestionRenderer v2

**Task:** Update existing QuestionRenderer to use visuals from registry  
**Owner:** Frontend  
**Effort:** 3 hours  
**Files to Modify:**
```
apps/patient-portal/src/components/questionnaire/
  QuestionRenderer.tsx  (EXTEND with visual rendering)
  VisualSelector.tsx    (NEW)
```

**Changes to QuestionRenderer:**
```typescript
// apps/patient-portal/src/components/questionnaire/QuestionRenderer.tsx
import { VisualSelector } from './VisualSelector';

export function QuestionRenderer({ question, currentAnswer, onAnswer, allAnswers }: QuestionRendererProps) {
  // ... existing code ...

  return (
    <div>
      {/* ... existing question rendering ... */}
      
      {(question.type === 'image_select' || question.type === 'single_select' || question.type === 'multi_select') && (
        <div className="grid gap-4">
          {visibleOptions?.map((option) => (
            <button key={option.id} onClick={handleSelect}>
              {/* CHANGED: Use visual registry */}
              {option.visual && (
                <VisualSelector 
                  category={option.visual.category}
                  key={option.visual.key}
                  fallback={option.visual.fallbackEmoji}
                />
              )}
              {/* ... rest of button ... */}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**New Component - VisualSelector.tsx:**
```typescript
// apps/patient-portal/src/components/questionnaire/VisualSelector.tsx
'use client';

import { Suspense, lazy } from 'react';
import { visualRegistry } from '@/packages/visual-library/registry';

interface VisualSelectorProps {
  category: 'norwood' | 'scalp' | 'patterns';
  key: string;
  fallback?: string;
}

export function VisualSelector({ category, key, fallback = '?' }: VisualSelectorProps) {
  const getVisualComponent = () => {
    const categoryRegistry = visualRegistry[category];
    if (!categoryRegistry) return null;
    const importFn = categoryRegistry[key];
    if (!importFn) return null;
    return lazy(() => importFn());
  };

  const VisualComponent = getVisualComponent();

  if (!VisualComponent) {
    return <span className="text-2xl">{fallback}</span>;
  }

  return (
    <Suspense fallback={<span className="text-2xl">{fallback}</span>}>
      <VisualComponent className="w-14 h-14 object-contain" />
    </Suspense>
  );
}
```

**Tests:**
- [ ] Visual selector renders correct component
- [ ] Fallback emoji displays when visual missing
- [ ] No console errors for missing visuals
- [ ] Lazy loading works
- [ ] All legacy visuals render correctly

**Acceptance Criteria:**
- [ ] QuestionRenderer updated
- [ ] VisualSelector component works
- [ ] All visuals render
- [ ] Fallback emoji works
- [ ] No TypeScript errors

**Status:** CRITICAL - Needed for question display

---

#### ✅ 2.4 - Create Protocol-Driven Question Loader

**Task:** Load questions from new format instead of hardcoded STEPS  
**Owner:** Backend + Frontend  
**Effort:** 2 hours  
**Files to Create:**
```
src/packages/assessment-orchestrator/
  loaders/
    loadQuestions.ts
```

**Code:**
```typescript
// src/packages/assessment-orchestrator/loaders/loadQuestions.ts
import { Question } from '@/types/questionnaire';
import hairLossQuestions from '@/config/questions/hair-loss-assessment.json';

export async function loadQuestionsForProtocol(protocolId: string): Promise<Question[]> {
  // In future: fetch from database by protocolId
  // For now: static config
  
  if (protocolId === 'hair-loss-v1') {
    return hairLossQuestions as Question[];
  }
  
  throw new Error(`Unknown protocol: ${protocolId}`);
}

export function getNextQuestion(
  questions: Question[],
  currentIndex: number,
  answers: Record<string, any>
): { question: Question; index: number } | null {
  let nextIndex = currentIndex + 1;
  
  // Skip logic: evaluate skipIf conditions
  while (nextIndex < questions.length) {
    const question = questions[nextIndex];
    
    if (question.skipIf && shouldSkipQuestion(question.skipIf, answers)) {
      nextIndex++;
      continue;
    }
    
    return { question, index: nextIndex };
  }
  
  return null; // No more questions
}

function shouldSkipQuestion(skipRules: LogicCondition[], answers: Record<string, any>): boolean {
  return skipRules.some(rule => evaluateCondition(rule, answers));
}

function evaluateCondition(condition: LogicCondition, answers: Record<string, any>): boolean {
  const value = answers[condition.field];
  
  switch (condition.operator) {
    case 'equals':
      return value === condition.value;
    case 'not_equals':
      return value !== condition.value;
    case 'greater_than':
      return Number(value) > Number(condition.value);
    case 'less_than':
      return Number(value) < Number(condition.value);
    case 'contains':
      return Array.isArray(value) && value.includes(condition.value);
    default:
      return false;
  }
}
```

**Tests:**
- [ ] Load function returns correct questions
- [ ] Skip logic evaluates correctly
- [ ] Next question logic handles end of questions
- [ ] All condition operators work

**Acceptance Criteria:**
- [ ] Loader function exports
- [ ] All skip rules work
- [ ] No TypeScript errors
- [ ] Unit tests pass

**Status:** CRITICAL - Enables protocol-driven flow

---

### Phase 2 Summary

**What We've Built:**
- ✅ Question schema extended (visual mappings, clinical tags, weights)
- ✅ 20 legacy questions converted to new format
- ✅ Visual selector component
- ✅ QuestionRenderer updated to use visuals
- ✅ Protocol-driven question loader

**What's Next:**
- [ ] Test all visuals render correctly
- [ ] Validate skip logic with test scenarios
- [ ] Get product approval on question structure

**Timeline:** 12 hours total → can be completed in 2 days

---

## PHASE 3: CUTOVER (Sprint 3) 🚀

### GOAL
Wire everything together. Test end-to-end flow. Sunset legacy component. Deploy new questionnaire.

---

#### ✅ 3.1 - Create New Questionnaire Flow Component

**Task:** Build new QuestionnaireFlow component using all extracted/refactored systems  
**Owner:** Frontend  
**Effort:** 4 hours  
**Files to Create:**
```
apps/patient-portal/src/app/
  questionnaire/
    page.tsx            (Entry point)
apps/patient-portal/src/components/questionnaire/
  QuestionnaireFlow.tsx (Main orchestration)
```

**High-Level Structure:**
```typescript
// apps/patient-portal/src/components/questionnaire/QuestionnaireFlow.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QuestionRenderer } from './QuestionRenderer';
import { ProgressBar } from './ProgressBar';
import { QuestionTransition } from './QuestionTransition';
import { useAssessmentStore } from '@/stores/useAssessmentStore';
import { loadQuestionsForProtocol, getNextQuestion } from '@/packages/assessment-orchestrator/loaders/loadQuestions';
import { normalizeQuestionnaire } from '@/packages/questionnaire-normalizer';

interface QuestionnaireFlowProps {
  protocolId?: string;
  onComplete?: (normalizedProfile: any) => void;
}

export function QuestionnaireFlow({ protocolId = 'hair-loss-v1', onComplete }: QuestionnaireFlowProps) {
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { answers, setAnswer } = useAssessmentStore();

  // Load questions on mount
  useEffect(() => {
    (async () => {
      try {
        const loadedQuestions = await loadQuestionsForProtocol(protocolId);
        setQuestions(loadedQuestions);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load questions');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [protocolId]);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (questions.length === 0) return <div>No questions found</div>;

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  const handleAnswer = (answer: any) => {
    setAnswer(currentQuestion.id, answer);
    
    if (isLastQuestion) {
      // Completion
      const normalized = normalizeQuestionnaire(answers);
      onComplete?.(normalized);
    } else {
      // Move to next
      const next = getNextQuestion(questions, currentQuestionIndex, answers);
      if (next) {
        setCurrentQuestionIndex(next.index);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#faf7f2] flex flex-col font-serif text-[#0c1a0e]">
      {/* Progress Bar */}
      <ProgressBar currentStep={currentQuestionIndex} totalSteps={questions.length} />

      {/* Header */}
      <header className="p-6 flex justify-between items-center bg-white border-b border-[#ddd8cc]">
        <div className="flex items-center gap-3">
          <div>
            <div className="text-sm font-medium">Dr. FACT</div>
            <div className="text-[8px] uppercase tracking-widest text-[#2a5c3a] font-sans font-bold">AI Trichologist</div>
          </div>
        </div>
        <div className="text-[10px] font-sans font-bold text-[#aaa] uppercase tracking-widest">
          Step {currentQuestionIndex + 1} / {questions.length}
        </div>
      </header>

      {/* Question Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 flex items-center justify-center">
        <div className="bg-white rounded-[2rem] overflow-hidden border border-[#ddd8cc] shadow-2xl flex flex-col md:flex-row w-full min-h-[550px]">
          
          {/* Visual Panel */}
          <div className="w-full md:w-1/2 relative bg-[#0c1a0e] overflow-hidden min-h-[220px] md:min-h-0 flex-shrink-0">
            <QuestionTransition key={`image-${currentQuestionIndex}`} type="image">
              <div className="absolute inset-0 w-full h-full bg-gradient-to-t from-[#0c1a0e] via-[#0c1a0e]/20 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 text-white font-sans text-[10px] uppercase tracking-widest opacity-60">
                Dr. FACT Clinical Intelligence // Parameter Assessment
              </div>
            </QuestionTransition>
          </div>

          {/* Form Panel */}
          <div className="w-full md:w-1/2 p-6 md:p-10 flex flex-col justify-center bg-gradient-to-br from-white to-[#fffdf5]">
            <QuestionTransition key={`form-${currentQuestionIndex}`} type="form">
              <QuestionRenderer
                question={currentQuestion}
                currentAnswer={answers[currentQuestion.id]}
                onAnswer={handleAnswer}
                allAnswers={answers}
              />
            </QuestionTransition>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center">
        <div className="flex items-center justify-center gap-2 text-[#aaa]">
          <span className="text-[10px] font-sans uppercase tracking-widest">Clinical Intelligence by The Fact Nutrition</span>
        </div>
      </footer>
    </div>
  );
}
```

**Tests:**
- [ ] Component renders without errors
- [ ] Questions load correctly
- [ ] Answer handler works
- [ ] Navigation between questions works
- [ ] Completion callback fires
- [ ] Skip logic works correctly

**Acceptance Criteria:**
- [ ] Component exports
- [ ] E2E flow works end-to-end
- [ ] No TypeScript errors
- [ ] Performance acceptable

**Status:** READY - Can be deployed after Phase 2

---

#### ✅ 3.2 - Create Assessment Store

**Task:** Centralize questionnaire state management  
**Owner:** Frontend  
**Effort:** 2 hours  
**Files to Create:**
```
apps/patient-portal/src/stores/
  useAssessmentStore.ts
```

**Code (using Zustand):**
```typescript
// apps/patient-portal/src/stores/useAssessmentStore.ts
import { create } from 'zustand';
import { AssessmentState, ClinicData, DoctorData } from '@/types/questionnaire';

export const useAssessmentStore = create<AssessmentState>((set) => ({
  clinicData: null,
  doctorData: null,
  currentStepIndex: 0,
  answers: {},
  isSubmitting: false,

  setClinicData: (data: ClinicData) => set({ clinicData: data }),
  setDoctorData: (data: DoctorData) => set({ doctorData: data }),

  setAnswer: (questionId: string, answer: any) =>
    set((state) => ({
      answers: { ...state.answers, [questionId]: answer },
    })),

  nextStep: (questions) =>
    set((state) => {
      const nextIndex = Math.min(state.currentStepIndex + 1, questions.length - 1);
      return { currentStepIndex: nextIndex };
    }),

  prevStep: (questions) =>
    set((state) => {
      const prevIndex = Math.max(state.currentStepIndex - 1, 0);
      return { currentStepIndex: prevIndex };
    }),

  reset: () =>
    set({
      clinicData: null,
      doctorData: null,
      currentStepIndex: 0,
      answers: {},
      isSubmitting: false,
    }),

  setSubmitting: (isSubmitting: boolean) => set({ isSubmitting }),
}));
```

**Tests:**
- [ ] Store initializes with correct defaults
- [ ] setAnswer updates answers correctly
- [ ] nextStep/prevStep work
- [ ] reset clears all state
- [ ] Multiple setAnswer calls work correctly

**Acceptance Criteria:**
- [ ] Store exports correctly
- [ ] All methods work
- [ ] TypeScript types match interface
- [ ] No memory leaks

**Status:** READY - Supports QuestionnaireFlow

---

#### ✅ 3.3 - Create Questionnaire Normalizer Adapter

**Task:** Convert new question answers to NormalizedClinicalProfile  
**Owner:** Backend  
**Effort:** 3 hours  
**Files to Create:**
```
src/packages/questionnaire-normalizer/
  adapters/
    newFormatAdapter.ts
```

**Code:**
```typescript
// src/packages/questionnaire-normalizer/adapters/newFormatAdapter.ts
import { NormalizedClinicalProfile } from '../types';

export function normalizeNewFormatAnswers(answers: Record<string, any>): NormalizedClinicalProfile {
  const profile: NormalizedClinicalProfile = {
    hairfallSeverity: 'NONE',
    sheddingPattern: 'UNKNOWN',
    inflammatorySignals: [],
    hormonalSignals: [],
    metabolicSignals: [],
    deficiencySignals: [],
    psychologicalSignals: [],
    lifestyleSignals: [],
    medicalHistory: []
  };

  // Map new question IDs to signals
  const countMapping = {
    'hair_20_50': 'LOW',
    'hair_50_100': 'MODERATE',
    'hair_100_plus': 'SEVERE',
    'hair_thinning_only': 'LOW',
  };

  const count = answers['count'];
  if (count && Array.isArray(count) && count[0]) {
    profile.hairfallSeverity = countMapping[count[0]] || 'NONE';
  }

  // Grade mapping
  const gradeMapping = {
    'stage_1': 'FRONTAL',
    'stage_2': 'FRONTAL',
    'stage_3': 'CROWN',
    'stage_4': 'CROWN',
    'stage_5': 'CROWN',
    'stage_6': 'CROWN',
    'coin_patch': 'DIFFUSE',
    'heavy_fall': 'DIFFUSE',
  };

  const grade = answers['grade'];
  if (grade && gradeMapping[grade]) {
    profile.sheddingPattern = gradeMapping[grade];
  }

  // Scalp signals
  const scalp = answers['scalp'] || [];
  if (Array.isArray(scalp)) {
    if (scalp.includes('dandruff_dry')) profile.inflammatorySignals.push('DRY_DANDRUFF');
    if (scalp.includes('dandruff_oily')) profile.inflammatorySignals.push('OILY_DANDRUFF');
    if (scalp.includes('irritation')) profile.inflammatorySignals.push('SEVERE_INFLAMMATION');
    if (scalp.includes('boils')) profile.inflammatorySignals.push('SCALP_INFECTION');
  }

  // Cause signals
  const cause = answers['cause'] || [];
  if (Array.isArray(cause)) {
    if (cause.includes('stress')) profile.psychologicalSignals.push('MODERATE_STRESS');
    if (cause.includes('medication_illness')) profile.medicalHistory.push('RECENT_MEDICATION');
  }

  // Medical conditions
  const thyroid = answers['thyroid'] || [];
  if (Array.isArray(thyroid)) {
    if (thyroid.includes('hypothyroid')) profile.metabolicSignals.push('THYROID_IMBALANCE');
    if (thyroid.includes('diabetes')) profile.metabolicSignals.push('INSULIN_RESISTANCE');
  }

  // Deficiencies
  const deficiency = answers['deficiency'] || [];
  if (Array.isArray(deficiency)) {
    if (deficiency.includes('iron')) profile.deficiencySignals.push('IRON');
    if (deficiency.includes('vit_d')) profile.deficiencySignals.push('VITAMIN_D');
    if (deficiency.includes('vit_b12')) profile.deficiencySignals.push('VITAMIN_B12');
  }

  // Hormonal signals
  const hormonal = answers['hormonal'] || [];
  if (Array.isArray(hormonal)) {
    if (hormonal.includes('pcos')) profile.hormonalSignals.push('PCOS');
    if (hormonal.includes('menopause')) profile.hormonalSignals.push('PERI_MENOPAUSE');
    if (hormonal.includes('pregnant')) profile.hormonalSignals.push('PREGNANCY');
  }

  // Lifestyle signals
  const lifestyle = answers['lifestyle'] || [];
  if (Array.isArray(lifestyle)) {
    if (lifestyle.includes('smoking')) profile.lifestyleSignals.push('SMOKING');
    if (lifestyle.includes('sedentary')) profile.lifestyleSignals.push('SEDENTARY');
    if (lifestyle.includes('crash_diet')) profile.lifestyleSignals.push('POOR_DIET');
  }

  return profile;
}
```

**Tests:**
- [ ] All question ID mappings work
- [ ] Signal assignments correct
- [ ] Missing questions don't crash normalizer
- [ ] Backward compatible with legacy format

**Acceptance Criteria:**
- [ ] Adapter exports correctly
- [ ] All question types normalized
- [ ] No TypeScript errors
- [ ] Unit tests pass

**Status:** READY - Bridges to clinical engine

---

#### ✅ 3.4 - End-to-End Testing

**Task:** Test complete flow from question → normalized profile → protocol output  
**Owner:** QA + Engineering  
**Effort:** 4 hours  
**Test Scenarios:**

**Scenario 1: Happy Path (Male, Hair Loss)**
```
1. Load questionnaire
2. Answer 20 questions (full flow)
3. Verify answers stored correctly
4. Verify normalization works
5. Check clinical profile correct
6. Verify protocol assignment
```

**Scenario 2: Skip Logic (Female)**
```
1. Answer sex = "Female"
2. Verify hormonal question appears (skipped for males)
3. Answer hormonal question
4. Verify normalization includes hormonal signals
```

**Scenario 3: Voice Input**
```
1. Click voice button
2. Speak answer
3. Verify transcript appears in input
4. Submit question
5. Verify answer captured correctly
```

**Scenario 4: Image Upload**
```
1. Navigate to "extra" step
2. Upload scalp photo (drag-and-drop)
3. Verify photo preview
4. Submit questionnaire
5. Verify image encoded and stored
```

**Scenario 5: Visual Rendering**
```
1. Navigate to "grade" question
2. Verify all 8 Norwood stage visuals render
3. Click each option
4. Verify selection works
5. Verify correct option ID captured
```

**Tests to Create:**
```typescript
// tests/e2e/questionnaire-flow.spec.ts
import { test, expect } from '@playwright/test';

test('Complete hair loss questionnaire flow', async ({ page }) => {
  await page.goto('/questionnaire');
  
  // Expect first question
  await expect(page.locator('h2')).toContainText('What is your full name?');
  
  // Answer name
  await page.fill('input[type="text"]', 'John Doe');
  await page.keyboard.press('Enter');
  
  // Next question
  await expect(page.locator('h2')).toContainText('What is your WhatsApp number?');
  
  // ... continue for all 20 questions ...
  
  // Verify completion
  await expect(page.locator('text=Assessment Complete')).toBeVisible();
});

test('Skip logic: hormonal question for females only', async ({ page }) => {
  await page.goto('/questionnaire');
  
  // Navigate to sex question
  // ... answer first 4 questions ...
  
  // Select Female
  await page.locator('button:has-text("Female")').click();
  
  // Next should be goal, not hormonal
  await expect(page.locator('h2')).toContainText('What is your primary goal?');
  
  // ... continue to hormonal ...
  // Should appear after other medical questions
  await expect(page.locator('h2')).toContainText('hormonal');
});
```

**Acceptance Criteria:**
- [ ] All 5 scenarios pass
- [ ] No console errors
- [ ] Visual regression tests pass
- [ ] Performance acceptable (< 3s load time)
- [ ] Accessibility score ≥ 90

**Status:** VALIDATION - Gates cutover

---

#### ✅ 3.5 - Migrate Analytics & Error Tracking

**Task:** Ensure questionnaire events are tracked correctly  
**Owner:** DevOps + Frontend  
**Effort:** 2 hours  
**Actions:**

1. Update analytics events for new component:
```typescript
// Track questionnaire start
analytics.track('questionnaire_started', {
  protocolId: 'hair-loss-v1',
  totalQuestions: 20,
  timestamp: new Date(),
});

// Track question answered
analytics.track('question_answered', {
  questionId: currentQuestion.id,
  optionId: answer,
  stepNumber: currentQuestionIndex + 1,
});

// Track questionnaire completed
analytics.track('questionnaire_completed', {
  protocolId: 'hair-loss-v1',
  totalTime: endTime - startTime,
  completedSteps: questions.length,
});
```

2. Wire error tracking:
```typescript
try {
  await normalizeQuestionnaire(answers);
} catch (err) {
  errorTracking.captureException(err, {
    context: 'questionnaire_normalization',
    answers: sanitize(answers),
  });
}
```

**Tests:**
- [ ] Events fire correctly
- [ ] Error tracking captures issues
- [ ] No PII logged

**Acceptance Criteria:**
- [ ] Analytics dashboard updated
- [ ] Error tracking working
- [ ] No data leaks

**Status:** READY - Supports operations

---

#### ✅ 3.6 - Deploy New Questionnaire

**Task:** Blue-green deploy; route traffic gradually  
**Owner:** DevOps  
**Effort:** 2 hours  
**Steps:**

1. Deploy to staging
2. Run full E2E test suite
3. Get product sign-off
4. Deploy to production (canary: 10% traffic)
5. Monitor metrics for 1 hour
6. Gradually increase traffic (25% → 50% → 100%)
7. Monitor error rates, performance

**Rollback Plan:**
```
If error rate > 1% or p95 latency > 5s:
  1. Revert traffic to old questionnaire (100%)
  2. Investigate issue
  3. Deploy fix
  4. Re-attempt gradual rollout
```

**Tests:**
- [ ] Staging passes all E2E tests
- [ ] Production canary stable for 1 hour
- [ ] Error rates normal
- [ ] Performance acceptable

**Acceptance Criteria:**
- [ ] New questionnaire at 100% traffic
- [ ] No rollback needed
- [ ] Legacy component still available (for comparison)

**Status:** FINAL - Completes migration

---

### Phase 3 Summary

**What We've Delivered:**
- ✅ New QuestionnaireFlow component
- ✅ Assessment state management (Zustand store)
- ✅ Questionnaire normalizer adapter
- ✅ Complete E2E test coverage
- ✅ Analytics wired
- ✅ Gradual production rollout

**What Happens Next:**
- [ ] Monitor production for 1 week
- [ ] Gather user feedback
- [ ] Sunset legacy component (keep as fallback)

**Timeline:** 17 hours total → can be completed in 2 days

---

## OVERALL TIMELINE & EFFORT

| Phase | Duration | Effort | Goal |
|---|---|---|---|
| Phase 1: Foundation | 2 days | 14 hours | Extract reusable systems |
| Phase 2: Integration | 2 days | 12 hours | Wire systems, create new architecture |
| Phase 3: Cutover | 2 days | 17 hours | Test, validate, deploy |
| **Total** | **6 days** | **43 hours** | **Complete migration** |

**Staffing:** 2 FTE (Frontend + Backend)  
**Risk:** LOW (staged rollout, backward-compatible)  
**Testing:** HIGH (E2E coverage, visual regression, analytics)

---

## POST-MIGRATION TASKS

### Week 1 After Cutover
- [ ] Monitor error rates (target: <0.5%)
- [ ] Monitor p95 latency (target: <2s)
- [ ] Gather user feedback (patient + staff)
- [ ] Check analytics data quality

### Week 2 After Cutover
- [ ] Document learnings
- [ ] Optimize slow visuals (if any)
- [ ] Archive legacy component code (don't delete yet)
- [ ] Plan sunsetting timeline

### Month 1 After Cutover
- [ ] Remove legacy component (after 30-day safety period)
- [ ] Clean up config/migration files
- [ ] Update runbooks
- [ ] Celebrate! 🎉

---

## APPENDIX: DEPENDENCY GRAPH

```
Phase 1:
  1.1 Design System ✅
       ↓ (enables all styling)
  1.2 Visual Registry ✅
       ↓ (provides visual assets)
  1.3 useSpeechRecognition Hook ✅
       ↓ (standalone utility)
  1.4 useImageUpload Hook ✅
       ↓ (standalone utility)
  1.5 ProgressBar Component ✅
       ↓ (standalone component)
  1.6 QuestionTransition Component ✅
       ↓ (standalone component)

Phase 2:
  2.1 Question Schema ✅
       ↓ (defines data shape)
  2.2 Question Conversion ✅
       ↓ (depends on 2.1 + 1.2)
  2.3 QuestionRenderer v2 ✅
       ↓ (depends on 2.2 + 1.2 + 1.3 + 1.4)
  2.4 Question Loader ✅
       ↓ (depends on 2.2)

Phase 3:
  3.1 QuestionnaireFlow Component ✅
       ↓ (depends on 2.3 + 2.4 + 1.5 + 1.6)
  3.2 Assessment Store ✅
       ↓ (depends on 2.1)
  3.3 Normalizer Adapter ✅
       ↓ (depends on existing normalizer)
  3.4 E2E Testing ✅
       ↓ (depends on all of above)
  3.5 Analytics ✅
       ↓ (depends on 3.1)
  3.6 Production Deploy ✅
       ↓ (depends on 3.4 passing)
```

---

## SUCCESS METRICS

**Before Migration:**
- Legacy questionnaire: 1 monolithic component
- No reusable systems
- No protocol-driven architecture
- Questions hardcoded
- State scattered

**After Migration:**
- ✅ 6 reusable packages (visual-library, hooks, components)
- ✅ Protocol-driven architecture
- ✅ Questions externalized to config
- ✅ Centralized state management
- ✅ 95%+ test coverage
- ✅ Zero regressions in production

**Patient Impact:**
- Same UX (animations, visuals, flow)
- Better performance (code-split, lazy loading)
- Better maintainability (modular architecture)
- Easier to add new protocols (just add config)

---

## CONCLUSION

This migration plan preserves the legacy questionnaire's validated UX while modernizing the architecture. By following the 3-phase approach with clear dependencies, we avoid rebuilding from scratch and instead evolve the system incrementally.

**Next Steps:**
1. Get stakeholder sign-off on this plan
2. Start Phase 1 immediately
3. Use this document as single source of truth for team
4. Track progress in project management tool

**Questions?** Refer to LEGACY_FRONTEND_AUDIT.md for detailed analysis.

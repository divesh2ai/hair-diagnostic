# PHASE 1 - QUICK START GUIDE

**For developers integrating Phase 1 components into questionnaire pages.**

---

## IMPORT PATTERNS

### Full Layout (Recommended)
```tsx
import { QuestionnaireLayout } from '@/components/layout';
import { CinematicContainer } from '@/components/cinematic';

<QuestionnaireLayout currentStep={0} totalSteps={20}>
  <CinematicContainer {...} />
</QuestionnaireLayout>
```

### Manual Composition
```tsx
import { ProgressBar } from '@/components/feedback';
import { QuestionnaireHeader } from '@/components/layout';
import { CinematicContainer } from '@/components/cinematic';
import { QuestionTransition } from '@/components/transitions';

<ProgressBar currentStep={0} totalSteps={20} />
<QuestionnaireHeader currentStep={0} totalSteps={20} />
<main>
  <CinematicContainer {...} />
</main>
```

### Individual Components
```tsx
// Input components
import { OptionButton, OptionCheckbox, TextInputField, VoiceInputButton } from '@/components/shared';
import { ImageUploadCard } from '@/components/upload';

// Animations
import { QuestionTransition } from '@/components/transitions';
```

---

## COMMON PATTERNS

### Pattern 1: Single-Select Question (Choice)
```tsx
<div className="space-y-3">
  <h2 className="text-2xl font-bold">What is your gender?</h2>
  
  <OptionButton
    label="Male"
    visual={<span>👨</span>}
    onClick={() => handleAnswer('male')}
    isSelected={answer === 'male'}
  />
  <OptionButton
    label="Female"
    visual={<span>👩</span>}
    onClick={() => handleAnswer('female')}
    isSelected={answer === 'female'}
  />
  <OptionButton
    label="Other"
    visual={<span>🧑</span>}
    onClick={() => handleAnswer('other')}
    isSelected={answer === 'other'}
  />
</div>
```

### Pattern 2: Multi-Select Question (Multi)
```tsx
<div className="space-y-3">
  <h2 className="text-2xl font-bold">Select all that apply:</h2>
  
  <div className="space-y-2">
    {options.map((opt) => (
      <OptionCheckbox
        key={opt.id}
        label={opt.label}
        onClick={() => toggleOption(opt.id)}
        isSelected={selectedIds.includes(opt.id)}
      />
    ))}
  </div>
  
  <button className="mt-4 w-full py-3 bg-primary text-white rounded-xl">
    Continue
  </button>
</div>
```

### Pattern 3: Text Input with Voice
```tsx
<TextInputField
  type="text"
  value={textValue}
  onChange={setTextValue}
  placeholder="Enter your answer..."
  rightButton={
    <VoiceInputButton
      isRecording={isRecording}
      onClick={toggleRecording}
    />
  }
/>
```

### Pattern 4: Image Upload with Drag-Drop
```tsx
<ImageUploadCard
  isDragging={isDragging}
  hasImage={!!imageData}
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  onDrop={handleDrop}
  onFileChange={handleFileChange}
  onRemove={() => setImageData(null)}
  title="Upload Scalp Photo"
/>
```

### Pattern 5: Full Question Flow
```tsx
<QuestionnaireLayout
  currentStep={currentStep}
  totalSteps={totalSteps}
>
  <CinematicContainer
    visualPanel={
      <CinematicVisualPanel imageOpacity={0.8}>
        <img 
          src={STEP_IMAGES[currentQuestion.id]} 
          alt={currentQuestion.title}
          className="w-full h-full object-cover"
        />
      </CinematicVisualPanel>
    }
    contentPanel={
      <QuestionTransition
        transitionKey={`q-${currentStep}`}
        type="form"
      >
        {/* Question content here */}
      </QuestionTransition>
    }
  />
</QuestionnaireLayout>
```

---

## DESIGN TOKENS

### Colors
```tsx
import { colors } from '@/styles/design-tokens';

<button style={{ backgroundColor: colors.primary[500] }}>Primary</button>
<div style={{ backgroundColor: colors.background[200] }}>Background</div>
<button style={{ color: colors.text.primary }}>Text</button>
```

Or use Tailwind classes (built into design system):
```tsx
<div className="bg-[#2a5c3a] text-[#faf7f2]">Primary + Background</div>
```

### Spacing
```tsx
import { spacing } from '@/styles/design-tokens';

<div className="space-y-md">  {/* 1rem = 16px */}
  <p className={`mb-${spacing.lg}`}>Paragraph</p>
</div>
```

Or use Tailwind:
```tsx
<div className="space-y-4">  {/* 1rem */}
  <p className="mb-6">Paragraph</p>
</div>
```

### Shadows
```tsx
import { shadows } from '@/styles/design-tokens';

<div style={{ boxShadow: shadows.elevated }}>
  Premium elevated card
</div>
<div style={{ boxShadow: shadows.clinical }}>
  Clinical card shadow
</div>
```

### Animations
```tsx
import { animations } from '@/styles/design-tokens';

<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{
    duration: animations.questionEnter.duration / 1000,
    ease: animations.questionEnter.easing,
  }}
>
  Animated content
</motion.div>
```

---

## RESPONSIVE BEHAVIOR

All Phase 1 components are mobile-first responsive:

```
Mobile (< 640px)
├─ Single column layout
├─ Full width
├─ Visual panel: 220px height
└─ Stacked content

Tablet (640px - 1024px)
├─ Two-column layout begins
├─ 50% left visual, 50% right content
└─ Flexed centering

Desktop (> 1024px)
├─ Full two-column layout
├─ Max-width: 5xl (64rem)
├─ Centered on page
└─ Fixed heights maintained
```

Breakpoint classes:
```tsx
<div className="w-full md:w-1/2">
  Desktop: 50% width
  Mobile: 100% width
</div>
```

---

## ACCESSIBILITY FEATURES

All Phase 1 components include:

✅ **Keyboard Navigation**
- Tab to focus interactive elements
- Enter/Space to activate buttons
- Text inputs support standard shortcuts

✅ **Screen Reader Support**
- ARIA labels on buttons
- Semantic HTML structure
- sr-only status messages

✅ **Color & Contrast**
- WCAG AA compliant (4.5:1 minimum)
- No color-only information
- Clear focus indicators

✅ **Motion**
- All animations respectful (300-400ms)
- No vestibular triggers
- prefers-reduced-motion support (Phase 2)

---

## COMPONENT PROPS REFERENCE

### CinematicContainer
```tsx
interface CinematicContainerProps {
  visualPanel: ReactNode;         // Left panel content
  contentPanel: ReactNode;        // Right panel content
  className?: string;
  visualClassName?: string;
  contentClassName?: string;
  mobileMinHeight?: string;       // default: 'min-h-[220px]'
}
```

### ProgressBar
```tsx
interface ProgressBarProps {
  currentStep: number;            // 0-indexed
  totalSteps: number;
  className?: string;
  barClassName?: string;
  showPercentage?: boolean;       // default: false
}
```

### OptionButton
```tsx
interface OptionButtonProps {
  label: string;                  // Display text
  description?: string;           // Optional subtitle
  visual?: ReactNode;             // Icon/visual (left)
  onClick?: () => void;
  isSelected?: boolean;
  className?: string;
  textClassName?: string;
  showChevron?: boolean;          // default: true
  visualContainerClassName?: string;
}
```

### TextInputField
```tsx
interface TextInputFieldProps {
  type?: 'text' | 'number' | 'textarea';
  value: string | number;
  onChange?: (value: string) => void;
  placeholder?: string;
  rightButton?: ReactNode;        // Voice, camera, etc.
  autoFocus?: boolean;            // default: true
  disabled?: boolean;
  min?: number;                   // For number type
  max?: number;
  minHeight?: string;             // For textarea
  onKeyDown?: (e: React.KeyboardEvent) => void;
}
```

### ImageUploadCard
```tsx
interface ImageUploadCardProps {
  isDragging?: boolean;           // Drag state
  hasImage?: boolean;             // Upload state
  onFileChange?: (file: File | null) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onRemove?: () => void;
  title?: string;
  subtitle?: string;
  accept?: string;                // default: 'image/*'
  showRemoveButton?: boolean;     // default: true
  actions?: ReactNode;            // Additional buttons
}
```

---

## STYLING OVERRIDE PATTERNS

### Theme Customization (Coming Phase 2)
```tsx
// For now, use Tailwind class overrides
<button className="bg-blue-600 text-white ...">
  Custom button
</button>
```

### Dark Mode (Coming Phase 2)
Components currently don't support dark mode.  
Phase 2 will add prefers-color-scheme support.

---

## PERFORMANCE TIPS

✅ **Do:**
- Memoize expensive renders with `React.memo()`
- Use `key` prop on list items
- Lazy load images in background panels
- Code-split large question components

❌ **Don't:**
- Re-render entire layout on small state changes
- Pass large objects as props
- Create inline styles in render
- Disable animations unnecessarily

---

## COMMON ERRORS & FIXES

### "Cannot find module @/components/cinematic"
**Fix:** Use correct import path with index
```tsx
// ✅ Correct
import { CinematicContainer } from '@/components/cinematic';

// ❌ Wrong
import { CinematicContainer } from '@/components/cinematic/CinematicContainer';
```

### Motion animations not working
**Fix:** Ensure framer-motion is installed
```bash
npm install framer-motion motion
```

### Progress bar not animating
**Fix:** Pass numeric currentStep, not string
```tsx
// ✅ Correct
<ProgressBar currentStep={3} totalSteps={20} />

// ❌ Wrong
<ProgressBar currentStep={'3'} totalSteps={'20'} />
```

### Image upload drag-drop not responsive
**Fix:** Wrap in functional component, not inline
```tsx
// ✅ Correct
function UploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  return <ImageUploadCard isDragging={isDragging} ... />;
}

// ❌ Wrong (state lost on render)
<ImageUploadCard isDragging={false} ... />
```

---

## TESTING COMPONENTS

### Unit Test Example (Vitest)
```tsx
import { render, screen } from '@testing-library/react';
import { ProgressBar } from '@/components/feedback';

describe('ProgressBar', () => {
  it('renders correct percentage', () => {
    render(<ProgressBar currentStep={5} totalSteps={20} />);
    expect(screen.getByRole('status')).toHaveTextContent('30%');
  });

  it('animates width correctly', async () => {
    const { rerender } = render(<ProgressBar currentStep={0} totalSteps={20} />);
    rerender(<ProgressBar currentStep={10} totalSteps={20} />);
    // Motion assertions here
  });
});
```

### E2E Test Example (Playwright)
```tsx
import { test, expect } from '@playwright/test';

test('question transition animates on step change', async ({ page }) => {
  await page.goto('/questionnaire');
  
  const formContent = page.locator('[data-testid="question-form"]');
  const initialText = await formContent.textContent();
  
  // Trigger next step
  await page.locator('button[aria-label="Next"]').click();
  
  // Wait for animation
  await page.waitForTimeout(400);
  
  const newText = await formContent.textContent();
  expect(newText).not.toBe(initialText);
});
```

---

## TROUBLESHOOTING

### Components not rendering
1. Check imports are using barrel exports (`index.ts`)
2. Verify `@/` path alias is configured in tsconfig
3. Ensure all props are passed correctly
4. Check TypeScript errors (`npm run type-check`)

### Styling not applying
1. Verify Tailwind classes are spelled correctly
2. Check class names don't exceed Tailwind limits
3. Ensure design-tokens.ts is accessible
4. Clear Next.js cache: `rm -rf .next`

### Animation performance issues
1. Check device CPU usage (motion is smooth at 60fps)
2. Reduce animation duration for mobile
3. Disable animations in mobile view if needed
4. Profile with Chrome DevTools (Performance tab)

---

## NEXT PHASES

**Phase 1b (Hooks - Ready Soon):**
- useSpeechRecognition
- useImageUpload
- useAssessmentState

**Phase 2 (Logic - Next):**
- Question configuration
- Visual registry
- Skip logic evaluation
- Normalization adapter

**Phase 3 (Integration - After):**
- Protocol engine wiring
- E2E testing
- Production deployment

---

## RESOURCES

📖 **Documentation:**
- `PHASE_1_COMPONENT_MIGRATION_MAP.md` - Full reference
- `LEGACY_FRONTEND_AUDIT.md` - Context & analysis
- `MIGRATION_EXECUTION_PLAN.md` - Overall strategy

🎨 **Design System:**
- `src/styles/design-tokens.ts` - All tokens
- `public/clinical-visuals/manifest.json` - Visual assets

📦 **Source Code:**
- `legacy/google-ai-studio/Pasted code.ts` - Original component

---

## GETTING HELP

1. Check this guide first (search keywords)
2. Review `PHASE_1_COMPONENT_MIGRATION_MAP.md` for detailed docs
3. Look at component examples in test files
4. Ask in team Slack with:
   - Component name
   - Expected vs. actual behavior
   - Code snippet
   - Error message

---

**Phase 1 Extraction is Complete.** Components are production-ready and fully documented. ✅

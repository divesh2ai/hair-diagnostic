export type QuestionCategory =
  | 'about_you'
  | 'hair_health'
  | 'internal_health'
  | 'scalp_assessment'
  | 'nutrition'
  | 'lifestyle'
  | 'hormonal'
  | 'medical'
  | 'skin_about_you'
  | 'skin_acne_lesions'
  | 'skin_acne_triggers'
  | 'skin_previous_treatment'
  | 'skin_safety_uploads';

/**
 * Top-level assessment concern. Selects which protocol the runtime loads.
 * Only `skin_acne` is implemented; the two other skin branches ship disabled
 * on the concern picker and are placeholders here for exhaustive switches.
 */
export type Concern =
  | 'hair'
  | 'skin_acne'
  | 'skin_pigmentation'
  | 'skin_anti_ageing';

export type QuestionType =
  | 'single_select'
  | 'multi_select'
  | 'image_select'
  | 'text'
  | 'textarea'
  | 'number'
  | 'image_upload'
  | 'scale';

export interface QuestionOption {
  id: string;
  label: string;
  shortLabel?: string;
  description?: string;
  icon?: string;
  image?: {
    url: string;
    alt: string;
  };
  /** Inline illustration (SVG/PNG with transparent bg). Rendered centered,
   *  smaller than `image`. Distinguishes editorial diagrams from photography. */
  illustration?: {
    url: string;
    alt: string;
  };
  severityLevel?: 1 | 2 | 3 | 4 | 5;
  clinicalTags?: string[];
  followUpQuestionId?: string;
  riskWeight?: number;
}

// Logic Evaluators
export type LogicCondition = {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than';
  value: any;
};

export interface Question {
  id: string;
  category: QuestionCategory;
  type: QuestionType;
  title: string;
  subtitle?: string;
  helperText?: string;
  required: boolean;
  options?: QuestionOption[];
  validation?: {
    min?: number;
    max?: number;
    /** Length bounds for text inputs. */
    minLength?: number;
    maxLength?: number;
    /** Regex pattern for text inputs (string form, compiled at runtime). */
    pattern?: string;
    /** Optional placeholder text shown when the field is empty. */
    placeholder?: string;
    errorMessage?: string;
  };
  /** Optional UI format hint (e.g. "name") used by the renderer to apply
   *  field-specific input handling (title-case, digit stripping, etc). */
  uiFormat?: "name" | "number" | "text";

  // Skip logic: if true, this question is skipped
  skipIf?: LogicCondition[];

  /**
   * Lightweight conditional visibility. If `answers[questionId]` does NOT
   * match `value`, the question is hidden, skipped during validation, and
   * excluded from progress counts. Simpler dual of `skipIf` for the common
   * "show only when X = Y" pattern (gender gates, follow-up branches, etc.).
   *
   * `value` semantics:
   *  - string  : exact match against single-select answers, or `.includes`
   *              against multi-select arrays.
   *  - string[]: matches if any element of `value` matches as above.
   */
  showIf?: {
    questionId: string;
    value: string | string[];
  };

  /**
   * Presentation tier — controls heading size, grid density, and spacing
   * without changing the renderer architecture. Defaults to "standard".
   *  - `high_impact` : hero question (e.g. "Pick your hair type") — larger
   *                    heading, bigger cards, generous spacing.
   *  - `standard`    : the current default behaviour.
   *  - `compact`     : tighter grid + smaller heading for high-volume sections
   *                    (e.g. symptom checklists).
   */
  presentationTier?: 'high_impact' | 'standard' | 'compact';

  // Filter logic: options to hide based on conditions
  filterOptions?: {
    optionId: string;
    hideIf: LogicCondition[];
  }[];

  /**
   * Pairwise mutual exclusion groups for multi_select questions.
   * Each inner array is a group where selecting one deselects all others.
   * Example: [["Dry scalp", "Oily scalp"], ["Dandruff / white flakes", "Dandruff + Itching + White flakes"]]
   */
  mutualExclusivityGroups?: string[][];

  /**
   * Optional message shown briefly when an auto-deselection fires due to group exclusivity.
   * Sourced from the protocol schema's mutualExclusivityRules.toastMessage.
   */
  mutualExclusivityToast?: string;

  // Section metadata (from real protocol)
  sectionId?: string;
  sectionTitle?: string;
  sectionDescription?: string;

  // UI hints from protocol uiMetadata
  uiLayout?: string;

  // Traceability back to DrFACT source
  sourceRef?: string;

  clinicalMapping?: {
    signal?: string;
    protocolHints?: string[];
  };
}

export interface ClinicData {
  id: string;
  name: string;
  theme: string;
  language: string;
}

export interface DoctorData {
  id: string;
  name: string;
}

export interface ProgressState {
  percentage: number;
  visiblePosition: number;
  visibleTotal: number;
  rawIndex: number;
  answeredCount: number;
  unansweredVisible: number;
}

export interface AssessmentState {
  // Which top-level concern this session is answering.
  // Drives protocol selection and downstream doctor-queue tagging.
  concern: Concern;

  // Protocol
  protocol: Question[] | null;

  // Navigation
  currentStepIndex: number;

  // Answers
  answers: Record<string, any>;

  // Derived runtime state
  progress: ProgressState;
  branchingPath: string[];
  skippedQuestions: string[];
  visibleQuestions: string[];
  protocolSignals: Record<string, any>;

  // UI
  isSubmitting: boolean;

  /**
   * Records the most recent mutual-exclusivity deselection event.
   * Set by QuestionRenderer when applyGroupExclusivity removes a conflicting selection.
   * Consumed by DebugPanel for sandbox validation.
   */
  lastExclusivityEvent: {
    questionId: string;
    /** The option the user tapped. */
    selected: string;
    /** Options that were automatically removed because they conflict with selected. */
    deselected: string[];
  } | null;

  // Context
  clinicData: ClinicData | null;
  doctorData: DoctorData | null;

  // Protocol management
  loadProtocol: (questions: Question[]) => void;

  // Switch the active concern (also swaps the loaded protocol).
  setConcern: (concern: Concern, questions: Question[]) => void;

  // Answer management
  setAnswer: (questionId: string, answer: any) => void;

  /** Record a mutual-exclusivity auto-deselection event for DebugPanel. */
  recordExclusivityEvent: (event: { questionId: string; selected: string; deselected: string[] }) => void;

  // Navigation
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;

  // Sandbox / replay
  replayFixture: (fixture: Record<string, any>) => void;

  // Lifecycle
  reset: () => void;
  setSubmitting: (isSubmitting: boolean) => void;

  // Context setters
  setClinicData: (data: ClinicData) => void;
  setDoctorData: (data: DoctorData) => void;
}

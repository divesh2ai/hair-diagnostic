export type QuestionCategory =
  | 'about_you'
  | 'hair_health'
  | 'internal_health'
  | 'scalp_assessment'
  | 'nutrition'
  | 'lifestyle'
  | 'hormonal'
  | 'medical';

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
    pattern?: string;
    errorMessage?: string;
  };

  // Skip logic: if true, this question is skipped
  skipIf?: LogicCondition[];

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

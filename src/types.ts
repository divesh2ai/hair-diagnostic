export type Severity = 'MILD' | 'MODERATE' | 'SEVERE';

export type SessionState = {
  mode?: 'CONVERSATIONAL' | 'DIAGNOSTIC';
  step?: string;
  answers?: Record<string, any>;
};

export type LLMDiagnosis = {
  condition: string;
  confidence: number;
  root_causes: string[];
};

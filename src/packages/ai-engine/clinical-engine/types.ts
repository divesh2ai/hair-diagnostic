import type { DiagnosisKey, ScalpState, RootCause, Severity } from '../../types';

export interface ClinicalFlags {
  // Goal flags
  isRegrowGoal: boolean;
  hasGreyGoal: boolean;
  hasHairGoal: boolean;
  // Patient profile
  isVeg: boolean;
  isMale: boolean;
  isPregnant: boolean;
  isGrade45: boolean;
  isGrade123: boolean;
  // Shedding state
  hasActiveShedding: boolean;
  hasNoVisibleFall: boolean;
  // GLP-1 state
  hasGLP1Early: boolean;
  hasGLP1Late: boolean;
  // Rapid weight loss / crash diet (non-GLP-1 trigger for Shield kit)
  hasCrashDiet: boolean;
  // Scalars
  age: number;
  // Raw answer strings used by downstream rules
  goal: string;
  grade: string;
  count: string;
  duration: string;
}

export interface ScoredDiagnosis {
  key: DiagnosisKey;
  score: number;
  isPrimary: boolean;
}

export interface ClinicalProfile {
  primaryDiagnosis: DiagnosisKey;
  primaryScore: number;
  secondaryDiagnoses: ScoredDiagnosis[];
  allScores: Partial<Record<DiagnosisKey, number>>;
  scalpStates: ScalpState[];
  rootCauses: RootCause[];
  severity: Severity;
  flags: ClinicalFlags;
}

// Mutable score accumulator used only inside the scoring engine.
export type ScoreAccumulator = Partial<Record<DiagnosisKey, number>>;

export type AbsoluteLockResult =
  | { locked: true; key: DiagnosisKey }
  | { locked: false };

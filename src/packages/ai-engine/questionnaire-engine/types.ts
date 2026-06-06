export type QuestionnaireSubmission = Readonly<Record<string, unknown>>;

export interface QuestionnaireProfile {
  readonly demographics: Readonly<{
    readonly age: number;
    readonly biologicalSex: 'MALE' | 'FEMALE' | 'UNKNOWN';
  }>;
  readonly symptoms: Readonly<{
    readonly primaryConcerns: ReadonlyArray<string>;
    readonly onsetDurationMonths: number;
    readonly scalpCondition: 'NORMAL' | 'OILY' | 'DRY' | 'INFLAMED' | 'UNKNOWN';
  }>;
  readonly patternIndicators: Readonly<{
    readonly ludwigScale: string;
    readonly norwoodScale: string;
    readonly thinningAreas: ReadonlyArray<string>;
  }>;
  readonly lifestyleRiskFactors: Readonly<{
    readonly stressLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
    readonly dietQuality: 'POOR' | 'FAIR' | 'GOOD' | 'UNKNOWN';
    readonly smokingStatus: boolean;
  }>;
  readonly medicalHistoryFlags: Readonly<{
    readonly familyHistoryOfHairLoss: boolean;
    readonly knownDeficiencies: ReadonlyArray<string>;
    readonly currentMedications: ReadonlyArray<string>;
  }>;
  readonly labMarkerSummary: Readonly<Record<string, string>>;
}
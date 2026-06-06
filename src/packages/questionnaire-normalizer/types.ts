export interface NormalizedClinicalProfile {
  hairfallSeverity: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
  sheddingPattern: 'DIFFUSE' | 'FRONTAL' | 'CROWN' | 'PARTITION' | 'UNKNOWN';
  inflammatorySignals: string[];
  hormonalSignals: string[];
  metabolicSignals: string[];
  deficiencySignals: string[];
  psychologicalSignals: string[];
  lifestyleSignals: string[];
  medicalHistory: string[];
}

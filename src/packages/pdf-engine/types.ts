import { NormalizedClinicalProfile } from '../questionnaire-normalizer/types';
import { VisualJourney } from '../visual-recommendation-engine/types';
import { KitRecommendation } from '../ai-engine/kit-scorer/types';

export interface PatientInfo {
  name: string;
  age: number;
  gender: string;
}

export interface ClinicInfo {
  name: string;
  logoUrl?: string;
}

export interface DoctorInfo {
  name: string;
}

export interface ReportInputPayload {
  assessmentId: string;
  patient: PatientInfo;
  clinic: ClinicInfo;
  doctor: DoctorInfo;
  clinicalProfile: NormalizedClinicalProfile;
  visualJourney: VisualJourney;
  kitRecommendation?: KitRecommendation | null;
  therapyPlan?: unknown;
  createdAt: Date;
}

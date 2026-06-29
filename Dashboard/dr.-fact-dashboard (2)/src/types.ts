export type UserRole = 'admin' | 'clinic_admin' | 'doctor' | 'state_monitor';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface Clinic {
  id: string;
  name: string;
  address?: string;
  state?: string;
  city?: string;
  area?: string;
  phone?: string;
  createdAt: any;
  adminId?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  clinicId?: string;
  displayName?: string;
  photoURL?: string;
  avatarUrl?: string;
  language?: 'en' | 'hi' | 'mr' | 'pa' | 'gu';
  createdAt: any;
  specialty?: string;
  bio?: string;
  phone?: string;
}

export interface Doctor {
  id: string;
  userId: string;
  clinicId: string;
  specialization?: string;
  bio?: string;
  active: boolean;
}

export interface Patient {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  gender?: 'male' | 'female' | 'other';
  age?: number;
  treatmentType?: string;
  clinicId: string;
  doctorId: string;
  hairScore?: number;
  lastDiagnosis?: string;
  riskLevel?: RiskLevel;
  createdAt: any;
  lastVisit?: any;
  medicalHistory?: string[];
  notes?: string;
}

export interface Report {
  id: string;
  patientId: string;
  patientName?: string;
  doctorId: string;
  clinicId: string;
  hairScore: number;
  diagnosis: string;
  riskLevel: RiskLevel;
  recommendedProducts: string[];
  questionnaireAnswers: any;
  createdAt: any;
  aiConfidence?: number;
  aiReasoning?: string[];
  aiKits?: string[];
  scalpSummary?: string;
  lifestyleImpact?: string;
  stateMonitorStatus?: 'pending' | 'approved' | 'flagged';
}

export type AgreementLevel = 'correct' | 'partial' | 'incorrect';

export interface DoctorReview {
  id: string;
  patientId: string;
  reportId: string;
  aiDiagnosis: string;
  aiConfidence: number;
  aiKits: string[];
  doctorDiagnosis: string;
  doctorKits: string[];
  agreement: AgreementLevel;
  notes: string;
  createdAt: any;
  doctorId: string;
  clinicId: string;
  stateMonitorStatus?: 'pending' | 'approved' | 'flagged';
}

export interface Outcome {
  id: string;
  patientId: string;
  clinicId: string;
  followUpDate: string;
  improvement: boolean;
  notes: string;
  createdAt: any;
  doctorId: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  entity: string;
  entityId?: string;
  details: string;
  clinicId: string;
  createdAt: any;
}

import type { Severity } from '../../../types';
import type { NarrativeTone, NarrativeLength } from '../types';

// ─── Severity → Tone Resolution ───────────────────────────────────────────────

export interface ToneProfile {
  readonly primaryTone: NarrativeTone;
  readonly doctorTone: NarrativeTone;
  readonly patientTone: NarrativeTone;
  readonly openingStyle: 'direct' | 'contextual' | 'empathetic';
  readonly urgencyLevel: 'low' | 'medium' | 'high';
  readonly reassuranceWeight: number; // 0–1, higher = more reassurance
  readonly detailWeight: number;      // 0–1, higher = more clinical detail
}

const TONE_PROFILES: Record<Severity, ToneProfile> = {
  MILD: {
    primaryTone: 'reassuring',
    doctorTone: 'technical',
    patientTone: 'reassuring',
    openingStyle: 'contextual',
    urgencyLevel: 'low',
    reassuranceWeight: 0.7,
    detailWeight: 0.5,
  },
  MODERATE: {
    primaryTone: 'motivational',
    doctorTone: 'clinical',
    patientTone: 'motivational',
    openingStyle: 'direct',
    urgencyLevel: 'medium',
    reassuranceWeight: 0.5,
    detailWeight: 0.7,
  },
  SEVERE: {
    primaryTone: 'empathetic',
    doctorTone: 'clinical',
    patientTone: 'empathetic',
    openingStyle: 'empathetic',
    urgencyLevel: 'high',
    reassuranceWeight: 0.6,
    detailWeight: 0.9,
  },
};

export function mapSeverityToTone(severity: Severity): ToneProfile {
  return TONE_PROFILES[severity];
}

// ─── Tone-Aware Opening Lines ─────────────────────────────────────────────────

const PATIENT_OPENING_BY_SEVERITY: Record<Severity, readonly string[]> = {
  MILD: [
    'Your hair analysis shows early-stage changes that respond very well to targeted care.',
    'The good news is that your hair loss is at an early, highly treatable stage.',
    'You\'ve come in at exactly the right time — early-stage changes like yours have the best outcomes.',
  ],
  MODERATE: [
    'Your hair analysis has identified a moderate pattern that requires a structured, consistent approach.',
    'Your hair loss is at a moderate stage. With the right protocol, meaningful improvement is achievable.',
    'You\'re at a stage where intervention matters — and your personalised plan is designed to deliver results.',
  ],
  SEVERE: [
    'We understand this has been a difficult journey. Your analysis shows a more advanced pattern, but there is a clear path forward.',
    'Your results show significant hair loss progression. Your protocol has been designed with this in mind, prioritising stabilisation first.',
    'Advanced-stage hair loss requires a comprehensive approach — and your plan addresses each contributing factor directly.',
  ],
};

const DOCTOR_OPENING_BY_SEVERITY: Record<Severity, string> = {
  MILD: 'Clinical assessment indicates early-stage presentation with favourable prognosis.',
  MODERATE: 'Clinical assessment identifies moderate-grade presentation requiring structured multimodal intervention.',
  SEVERE: 'Clinical assessment reveals advanced-stage presentation. Aggressive multimodal protocol initiated; specialist referral should be considered.',
};

export function getDoctorOpeningStatement(severity: Severity): string {
  return DOCTOR_OPENING_BY_SEVERITY[severity];
}

export function getPatientOpeningStatement(
  severity: Severity,
  index: number = 0
): string {
  const options = PATIENT_OPENING_BY_SEVERITY[severity];
  return options[index % options.length];
}

// ─── Length × Severity content depth ─────────────────────────────────────────

export function resolveContentDepth(
  severity: Severity,
  length: NarrativeLength
): 'minimal' | 'standard' | 'comprehensive' {
  if (length === 'short') return 'minimal';
  if (length === 'detailed') return 'comprehensive';
  // medium: elevate for severe
  return severity === 'SEVERE' ? 'comprehensive' : 'standard';
}

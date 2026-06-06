import type { PatientAnswers } from '../../types';
import type { ClinicalProfile } from '../clinical-engine/types';
import type { NarrativeLength, NarrativeMetadata } from './types';
import { PIPELINE_VERSION } from './constants';

// ─── Age / Gender Utilities ───────────────────────────────────────────────────

export function resolveAge(patient: PatientAnswers): number {
  const raw = patient.age;
  if (typeof raw === 'number') return raw;
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? 30 : parsed;
}

export function isFemale(patient: PatientAnswers): boolean {
  const sex = (patient.sex ?? '').toLowerCase();
  return sex === 'female' || sex === 'f';
}

export function resolvePatientName(patient: PatientAnswers): string {
  return patient.name ?? 'Patient';
}

export function ageGroup(age: number): 'young-adult' | 'adult' | 'middle-aged' | 'mature' {
  if (age < 30) return 'young-adult';
  if (age < 45) return 'adult';
  if (age < 60) return 'middle-aged';
  return 'mature';
}

// ─── Text Utilities ───────────────────────────────────────────────────────────

export function sentenceCase(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function joinWithAnd(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

export function joinWithComma(items: readonly string[]): string {
  return items.join(', ');
}

export function bulletise(items: readonly string[]): string {
  return items.map(i => `• ${i}`).join('\n');
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3).trimEnd() + '...';
}

export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\n{2,}/g, '\n');
}

// ─── Pronoun Utilities ────────────────────────────────────────────────────────

export interface Pronouns {
  readonly subject: string;
  readonly object: string;
  readonly possessive: string;
  readonly reflexive: string;
}

export function resolvePronouns(patient: PatientAnswers): Pronouns {
  if (isFemale(patient)) {
    return { subject: 'she', object: 'her', possessive: 'her', reflexive: 'herself' };
  }
  return { subject: 'he', object: 'him', possessive: 'his', reflexive: 'himself' };
}

export function resolvePatientPronouns(patient: PatientAnswers): Pronouns {
  if (isFemale(patient)) {
    return { subject: 'you', object: 'you', possessive: 'your', reflexive: 'yourself' };
  }
  return { subject: 'you', object: 'you', possessive: 'your', reflexive: 'yourself' };
}

// ─── Duration Utilities ───────────────────────────────────────────────────────

export function parseDurationLabel(duration: string | undefined): string {
  if (!duration) return 'unspecified duration';
  const d = duration.toLowerCase();
  if (d.includes('month') || d.includes('3') || d.includes('6')) return d;
  if (d.includes('year')) return d;
  return duration;
}

export function durationIsChronified(duration: string | undefined): boolean {
  if (!duration) return false;
  const d = duration.toLowerCase();
  return d.includes('year') || d.includes('24') || d.includes('18');
}

// ─── Length-Aware Content Selection ──────────────────────────────────────────

export function selectByLength<T>(
  length: NarrativeLength,
  options: { short: T; medium: T; detailed: T }
): T {
  return options[length];
}

export function expandByLength(
  length: NarrativeLength,
  base: string,
  additions: { medium: string; detailed: string }
): string {
  if (length === 'short') return base;
  if (length === 'medium') return `${base} ${additions.medium}`;
  return `${base} ${additions.medium} ${additions.detailed}`;
}

// ─── Confidence Utilities ─────────────────────────────────────────────────────

export function confidenceLevel(score: number): 'low' | 'moderate' | 'high' {
  if (score >= 75) return 'high';
  if (score >= 50) return 'moderate';
  return 'low';
}

export function normaliseScore(raw: number, max: number = 100): number {
  return Math.min(100, Math.max(0, Math.round((raw / max) * 100)));
}

// ─── Metadata Builder ─────────────────────────────────────────────────────────

export function buildMetadata(
  profile: ClinicalProfile,
  kitCount: number,
  length: NarrativeLength
): NarrativeMetadata {
  return {
    diagnosisKey: profile.primaryDiagnosis,
    severity: profile.severity,
    rootCauses: profile.rootCauses,
    scalpStates: profile.scalpStates,
    therapyNeedCount: 0, // will be filled by caller
    kitCount,
    narrativeLength: length,
    pipelineVersion: PIPELINE_VERSION,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Section Builder Helper ───────────────────────────────────────────────────

export function makeSection(
  id: string,
  title: string,
  body: string,
  bullets?: readonly string[],
  renderAs: 'paragraph' | 'bullets' | 'table' | 'timeline' | 'card' = 'paragraph'
): import('./types').NarrativeSection {
  return { id, title, body, bullets, renderAs };
}

// ─── ISO Timestamp ────────────────────────────────────────────────────────────

export function nowISO(): string {
  return new Date().toISOString();
}

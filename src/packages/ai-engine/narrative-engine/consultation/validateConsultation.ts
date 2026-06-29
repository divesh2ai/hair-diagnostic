import type { ValidationResult } from '../types';
import {
  CONSULTATION_CHAPTER_ORDER,
  type DoctorConsultationScript,
} from './types';

export function validateDoctorConsultation(
  script: DoctorConsultationScript,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!script.title) errors.push('script.title is required');
  if (!script.patientName) errors.push('script.patientName is required');
  if (!script.greeting?.segment?.text) errors.push('script.greeting.segment.text is required');
  if (!script.closing?.segment?.text) errors.push('script.closing.segment.text is required');
  if (!script.metadata?.generatedAt) errors.push('script.metadata.generatedAt is required');

  if (script.chapters.length !== 5) {
    errors.push(`script.chapters must contain exactly 5 chapters (got ${script.chapters.length})`);
  }

  script.chapters.forEach((chapter, i) => {
    const expectedId = CONSULTATION_CHAPTER_ORDER[i];
    if (chapter.id !== expectedId) {
      errors.push(`chapters[${i}].id must be "${expectedId}" (got "${chapter.id}")`);
    }
    if (chapter.chapterNumber !== i + 1) {
      errors.push(`chapters[${i}].chapterNumber must be ${i + 1} (got ${chapter.chapterNumber})`);
    }
    if (!chapter.title) errors.push(`chapters[${i}].title is required`);
    if (!chapter.headline) errors.push(`chapters[${i}].headline is required`);
    if (!chapter.narration) errors.push(`chapters[${i}].narration is required`);
    if (!chapter.visualCue) warnings.push(`chapters[${i}].visualCue is missing`);
    if (!chapter.gestureCategory) errors.push(`chapters[${i}].gestureCategory is required`);
    if (chapter.estimatedDurationSeconds <= 0) {
      errors.push(`chapters[${i}].estimatedDurationSeconds must be positive`);
    }
    if (chapter.estimatedDurationSeconds > 120) {
      warnings.push(`chapters[${i}] is longer than 2 minutes — may lose patient attention`);
    }
    if (chapter.segments.length === 0) {
      errors.push(`chapters[${i}].segments must not be empty`);
    }
    chapter.followUpPrompts.forEach((prompt, j) => {
      if (!prompt.id) errors.push(`chapters[${i}].followUpPrompts[${j}].id is required`);
      if (!prompt.question) errors.push(`chapters[${i}].followUpPrompts[${j}].question is required`);
      if (prompt.chapterId !== chapter.id) {
        errors.push(
          `chapters[${i}].followUpPrompts[${j}].chapterId must match chapter id "${chapter.id}"`,
        );
      }
    });
  });

  if (script.totalEstimatedDurationSeconds <= 0) {
    errors.push('script.totalEstimatedDurationSeconds must be positive');
  }
  if (script.totalEstimatedDurationSeconds > 600) {
    warnings.push('Total consultation duration exceeds 10 minutes — consider trimming');
  }

  return { valid: errors.length === 0, errors, warnings };
}

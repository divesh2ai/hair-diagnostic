/**
 * Convert the canonical raw response object into per-question persistence
 * rows. Reserved metadata belongs only in Assessment.rawResponses and must
 * never become an AssessmentResponse question row.
 */
export function buildAssessmentResponseRows(
  assessmentId: string,
  answers: Record<string, unknown>,
) {
  return Object.entries(answers)
    .filter(([questionId, answer]) => questionId !== '__meta' && answer !== undefined)
    .map(([questionId, answer]) => ({
      assessmentId,
      questionId,
      answer: answer ?? null,
    }));
}

export function withConcernMetadata(
  answers: Record<string, unknown>,
  concern: string,
): Record<string, unknown> {
  const existing =
    typeof answers.__meta === 'object' && answers.__meta !== null
      ? (answers.__meta as Record<string, unknown>)
      : {};
  return { ...answers, __meta: { ...existing, concern } };
}

/**
 * Record the language the patient answered in.
 *
 * Deliberately stored in the reserved `__meta` bag rather than a new column:
 * `Assessment.rawResponses` already carries cross-cutting session metadata, so
 * this is additive, backwards compatible and needs no migration. Assessments
 * submitted before this shipped simply have no `__meta.locale`, which readers
 * treat as English.
 *
 * This value is session metadata for analytics and report-language defaults
 * ONLY. Every answer in the same payload is a canonical English answer code, so
 * no clinical consumer needs to branch on it.
 */
export function withLocaleMetadata(
  answers: Record<string, unknown>,
  locale: string,
): Record<string, unknown> {
  const existing =
    typeof answers.__meta === 'object' && answers.__meta !== null
      ? (answers.__meta as Record<string, unknown>)
      : {};
  return { ...answers, __meta: { ...existing, locale } };
}
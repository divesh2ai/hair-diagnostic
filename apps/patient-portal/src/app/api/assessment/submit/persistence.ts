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
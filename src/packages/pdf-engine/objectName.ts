// Naming for the stored long-form report PDF. Kept dependency-free (no React /
// @react-pdf / Supabase) so it is importable and unit-testable on its own.

/**
 * Converts a patient name into a safe, lowercase filename slug.
 * e.g. "Rohini Sharma"   → "rohini-sharma"
 *      "Séraphin O'Neil" → "seraphin-oneil"
 * Returns "" when the name sanitises to nothing.
 */
export function toFilenameSlug(name: string): string {
  return name
    .normalize('NFD') // decompose accented characters
    .replace(/[̀-ͯ]/g, '') // strip accent marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumeric → hyphen
    .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens
}

/**
 * The Supabase object filename for a patient's long-form report PDF. Named after
 * the patient so the file is identifiable in storage, with the assessment id as
 * a guaranteed-unique fallback when the name sanitises to nothing. The caller
 * stores it under `reports/<assessmentId>/`, so the id is always present in the
 * full object path and same-name patients never collide.
 */
export function patientReportObjectName(
  patientName: string | null | undefined,
  assessmentId: string,
): string {
  const slug = toFilenameSlug(patientName ?? '');
  return `${slug || assessmentId}-report.pdf`;
}

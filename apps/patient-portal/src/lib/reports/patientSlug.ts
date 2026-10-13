// A storage-key-safe slug of a patient's name, for naming report artefacts in
// Supabase storage. Lowercase ASCII with hyphens, accents folded, length-capped.
//
// This intentionally puts patient identity into object keys (per product
// decision: reports are saved under the patient name, including in storage).
// A unique component — the assessment id or asset id — is ALWAYS kept alongside
// this slug by the caller, so two patients who share a name never collide and a
// regenerated artefact stays addressable. The bucket remains private and is
// only ever read through short-lived signed URLs.
//
// Returns "" when there is no usable name; callers fall back to the id alone.
export function patientReportSlug(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

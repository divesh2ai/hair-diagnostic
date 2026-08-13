// The clinic's public URL key.
//
// A Super Admin setting up a clinic should never have to learn the word
// "slug". They type "Advanced Hair Clinic Mumbai" and the platform derives
// `advanced-hair-clinic-mumbai`, shows them the resulting patient URL, and
// gets out of the way.
//
// ── Belongs to Clinic, never Doctor ─────────────────────────────────────────
// One clinic, one URL, one QR code, however many doctors work there. Patients
// scan the clinic's code and land in the clinic's shared Review Queue; the
// slug is not, and must never become, a doctor routing key.
//
// ── Immutable once created ──────────────────────────────────────────────────
// The slug is printed on QR codes that end up laminated on a reception desk.
// Changing it silently breaks every one of them, so the edit form keeps the
// field read-only after creation. Nothing here enforces that — it is a
// product rule the form and the PATCH handler own — but this is where the
// reason is written down.

/** Mirrors the server's `^[a-z0-9-]+$` create validation exactly. */
export const CLINIC_SLUG_PATTERN = /^[a-z0-9-]+$/;

export const CLINIC_SLUG_MIN = 2;
export const CLINIC_SLUG_MAX = 60;

/**
 * Derive a URL key from a clinic name.
 *
 * Latin letters and digits survive; everything else becomes a separator. Names
 * in Devanagari and other Indian scripts therefore reduce to whatever Latin
 * characters they contain, which for a purely non-Latin name is nothing — the
 * caller gets "" and must ask the admin to type a URL themselves rather than
 * receive a mangled transliteration nobody asked for.
 */
export function slugifyClinicName(name: string): string {
  return (
    name
      .normalize("NFKD")
      // Strip combining marks left behind by NFKD so "Dr. Fact" with an accent
      // decomposes to plain ASCII rather than losing the base letter.
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, CLINIC_SLUG_MAX)
      // A trailing hyphen can reappear after the length cap.
      .replace(/-+$/g, "")
  );
}

/**
 * Normalise a URL an admin is typing, mid-keystroke.
 *
 * Deliberately NOT `slugifyClinicName`: that strips trailing hyphens, which
 * makes "advanced-hair" impossible to type — the hyphen vanishes the moment it
 * is entered and the next letter joins the previous word. Leading hyphens are
 * still dropped (nothing legitimate starts with one) and the final trim happens
 * on submit.
 */
export function normaliseClinicSlugInput(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, CLINIC_SLUG_MAX);
}

/** True when a value is acceptable as `Clinic.slug`. */
export function isValidClinicSlug(slug: string): boolean {
  return (
    slug.length >= CLINIC_SLUG_MIN &&
    slug.length <= CLINIC_SLUG_MAX &&
    CLINIC_SLUG_PATTERN.test(slug)
  );
}

/**
 * The patient-facing assessment URL for a slug, for preview in the admin form.
 *
 * `origin` is passed in rather than read from the environment because the only
 * honest origin to show a Super Admin is the one their browser is on — a
 * NEXT_PUBLIC_APP_URL that is stale or unset would print a URL that does not
 * work. Server-side callers with no origin get the path alone, which is true
 * everywhere.
 */
export function clinicAssessmentUrl(slug: string, origin?: string | null): string {
  const path = `/q/${slug}`;
  if (!origin) return path;
  return `${origin.replace(/\/+$/, "")}${path}`;
}

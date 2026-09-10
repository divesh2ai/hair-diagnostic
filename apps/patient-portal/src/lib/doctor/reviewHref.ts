// Where "Review" goes for a given case.
//
// Skin concerns have dedicated review surfaces; hair cases use the general
// consultation review. Centralised so the dashboard, the queue, and the
// review-next-patient handoff can never disagree about the destination.
//
// ── The default branch is for HAIR, not for "anything else" ─────────────────
// It used to be reached by any concern without an explicit case, which meant a
// known skin concern with no surface yet — acne — was routed into the HAIR
// consultation. The read path there refuses it (see the `skin_` guard in
// lib/consultation/reviewPayload, which exists because the engines, fed acne
// answers, returned a confident hair diagnosis on a skin case). So nothing was
// ever fabricated — but a doctor was still being sent one click from the
// surface that authorises treatment, to a refusal that reads as a broken
// record rather than a missing product.
//
// Skin is now handled by prefix, not by enumeration: a concern that starts
// `skin_` either has a surface listed below or goes to the holding page. A new
// skin track added tomorrow cannot inherit the hair route by omission.

/** Skin concerns with a real doctor review surface. */
const SKIN_ROUTES: Record<string, string> = {
  skin_pigmentation: "skin/pigmentation",
  skin_anti_ageing: "skin/anti-ageing",
};

/**
 * The holding surface for a skin concern with no review product yet.
 *
 * One page for all of them rather than one per track: it renders no clinical
 * content, so there is nothing about it that differs by concern except the
 * label, and a shared destination means a NEW skin track cannot be added
 * without a route — it lands here rather than silently inheriting the hair
 * consultation.
 */
const SKIN_REVIEW_UNAVAILABLE = "skin/review-unavailable";

export function reviewHref(row: {
  id: string;
  concern?: string | null;
}): string {
  const concern = row.concern ?? null;
  const known = concern ? SKIN_ROUTES[concern] : undefined;
  if (known) return `/doctor/reports/${row.id}/${known}`;
  // Every skin concern is accounted for: either it has a surface above, or it
  // goes to the holding page. Neither branch can reach the hair consultation.
  if (concern?.startsWith("skin_")) {
    return `/doctor/reports/${row.id}/${SKIN_REVIEW_UNAVAILABLE}`;
  }
  return `/doctor/reports/${row.id}`;
}

/**
 * True when a concern has no doctor review surface that can produce a clinical
 * opinion. Read by the queue so the row's action does not promise a review
 * that the destination cannot deliver.
 *
 * Derived from the route table rather than listed separately, so the two can
 * never disagree about which tracks are reviewable.
 */
export function isReviewUnavailable(concern: string | null | undefined): boolean {
  return Boolean(concern?.startsWith("skin_")) && !SKIN_ROUTES[concern as string];
}

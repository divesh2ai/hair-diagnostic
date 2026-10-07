// Product-vertical discriminator for assessments.
//
// HairOS and Skin FACT are separate products with separate protocol and
// recommendation engines. An assessment's vertical is derived from its
// concern — the `__meta.concern` string carried on every assessment — so this
// needs no schema change: `skin_*` concerns are Skin FACT; everything else
// (hair, and legacy rows with no concern) is HairOS.
//
// This is the single source of truth for "is this a HairOS case or a Skin FACT
// case". Routing (reviewHref), the consultation read path (reviewPayload) and
// the protocol loader all read it so they can never drift into disagreement —
// a new `skin_*` track added tomorrow is classified SKIN_FACT automatically and
// cannot inherit a HairOS code path by omission.
//
// Kept dependency-free (pure string logic, no browser or engine imports) so it
// is safe to import from API routes, server components and client runtime alike.

export type Vertical = "HAIROS" | "SKIN_FACT";

/** Every Skin FACT concern is namespaced with this prefix. */
export const SKIN_CONCERN_PREFIX = "skin_";

/**
 * Classify an assessment's concern into its product vertical.
 *
 * A `skin_*` concern is Skin FACT. Anything else — `hair`, an empty/absent
 * concern on a legacy row, or an unrecognised non-skin value — is HairOS. The
 * default is HairOS by design: HairOS predates the concern field, so an
 * assessment with no concern is a hair assessment.
 */
export function verticalForConcern(concern: string | null | undefined): Vertical {
  return typeof concern === "string" && concern.startsWith(SKIN_CONCERN_PREFIX)
    ? "SKIN_FACT"
    : "HAIROS";
}

/** True when the concern belongs to HairOS (and may use HairOS protocols). */
export function isHairOsConcern(concern: string | null | undefined): boolean {
  return verticalForConcern(concern) === "HAIROS";
}

/** True when the concern belongs to Skin FACT. */
export function isSkinFactConcern(concern: string | null | undefined): boolean {
  return verticalForConcern(concern) === "SKIN_FACT";
}

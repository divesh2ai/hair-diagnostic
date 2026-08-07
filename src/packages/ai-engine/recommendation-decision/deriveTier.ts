import type { KitId } from '../../types';
import type { KitScoringDiagnostics } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// deriveTier — STRICTLY OBSERVATIONAL.
//
// Reads which locked bucket the kit fell into inside kitPrioritizer (already
// captured in KitScoringDiagnostics.orderingSources[kit].bucket). Does NOT
// invent a new tier policy and does NOT reason from kit names or ids.
//
// Returns `null` (paired with LEGACY_SEQUENCE_POLICY on the decision) whenever
// the bucket is unknown or the kit was placed by fall-through order. That
// null is the whole point of this pass — it exposes unexplained ordering
// rather than hiding it behind an invented tier.
// ─────────────────────────────────────────────────────────────────────────────

// Bucket → provisional tier mapping. The buckets themselves are the ones
// kitPrioritizer already declares. We are not choosing which bucket a kit
// belongs to; we are only labelling what kitPrioritizer already decided.
//
//   Tier 1 — root-cause / disease heads (the pipeline already treats these
//            as the leading clinical driver).
//   Tier 2 — terrain / acute stabilisation (phenotype inflammation, TE GOLD,
//            META B generic, PRO IMMUNE — these are always placed AFTER the
//            Tier 1 head in kitPrioritizer).
//   Tier 3 — MID_SUPPORT (upstream nutrient / substrate support that sits
//            after the acute layer).
//   Tier 4 — PATTERN_KITS_LAST (kitPrioritizer explicitly puts these at the
//            tail regardless of any other consideration).
const BUCKET_TO_TIER: Readonly<Record<string, 1 | 2 | 3 | 4>> = {
  ROOT_CAUSE_HEAD: 1,
  ACUTE_TRIGGER_HEAD: 1,
  GI_GOLD_HEAD: 1,
  IRON_UP_HEAD: 1,
  ENDOMETRIOSIS_KITS: 1,
  DISEASE_KITS: 1,
  HORMONAL_KITS: 1,

  PHENOTYPE_INFLAMATION: 2,
  TE_GOLD_KITS: 2,
  META_B_GENERIC: 2,
  PRO_IMMUNE: 2,

  MID_SUPPORT: 3,

  PATTERN_KITS_LAST: 4,
};

export function deriveTier(
  kitId: KitId,
  diagnostics: KitScoringDiagnostics,
): { tier: 1 | 2 | 3 | 4 | null; tieBreaker: string | null } {
  const source = diagnostics.orderingSources[kitId];
  if (!source) return { tier: null, tieBreaker: null };

  const bucket = source.bucket ?? null;
  if (bucket && bucket in BUCKET_TO_TIER) {
    return { tier: BUCKET_TO_TIER[bucket], tieBreaker: 'legacy-sequence-index' };
  }
  return { tier: null, tieBreaker: 'legacy-sequence-index' };
}

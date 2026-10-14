import type { KitId } from '../../../types';
import type { ClinicalFlags } from '../../clinical-engine/types';
import type { ConditionId } from '../registry/conditionKitRegistry';
import {
  assessHormonalAxisOverlap,
  type HormonalAxisOverlap,
} from './assessHormonalAxisOverlap';

// ─────────────────────────────────────────────────────────────────────────────
// RESOLVE KIT INTERACTIONS  (Layer ③)
//
// Operates on the SET of detected conditions and applies every LOCKED clinical
// interaction rule (supersession, unification, age-mutex, exclusivity). These
// are the rules that previously lived as a scattered pipeline of injection /
// strip / precedence rule files — now consolidated into one auditable place.
//
// Output:
//   • conditions  — the surviving condition set after resolution
//   • kitOverride — per-condition kit substitutions (e.g. PCOS + Hypothyroid
//                   collapse both META B variants into one plain META B)
//   • applied     — human-readable audit trail of every rule that fired
//
// Reference: feedback-kit-injection-rules memory (Rules 1–7).
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolutionResult {
  readonly conditions: ConditionId[];
  readonly kitOverride: Partial<Record<ConditionId, KitId>>;
  readonly applied: string[];
  /**
   * Hormonal-axis overlaps (PCOS ↔ menopause-continuum) that were RECOGNISED
   * rather than age-discarded. Each carries a doctor-review verdict and the
   * non-binding default primary. buildKitSequence holds the non-primary kit
   * out of the auto-dispensed sequence; the doctor-review + PDF layers read
   * these to show both conditions and the pending approval. Empty for every
   * assessment with no such co-occurrence. Additive — existing consumers that
   * ignore it are unaffected.
   */
  readonly overlaps: HormonalAxisOverlap[];
}

export function resolveKitInteractions(
  detected: Set<ConditionId>,
  flags: ClinicalFlags,
): ResolutionResult {
  const c = new Set(detected);
  const kitOverride: Partial<Record<ConditionId, KitId>> = {};
  const applied: string[] = [];
  const overlaps: HormonalAxisOverlap[] = [];

  const has = (id: ConditionId) => c.has(id);
  const drop = (id: ConditionId, why: string) => {
    if (c.delete(id)) applied.push(why);
  };

  // ── PREGNANCY — exclusive. Strip everything else (safety lock). ─────────────
  if (has('PREGNANCY')) {
    applied.push('PREGNANCY_LOCK: pregnancy is exclusive — all other kits suppressed.');
    return { conditions: ['PREGNANCY'], kitOverride, applied, overlaps };
  }

  // ── PERI/POST-MENOPAUSE + PCOS — hormonal-axis overlap (clinical policy 2026-10)
  //
  // ⚠️ CLINICAL CHANGE — REQUIRES CLINICAL SIGN-OFF BEFORE DEPLOY.
  //
  // REPLACES the age-only MENO_PCOS_MUTEX (removed), which discarded one
  // condition purely by age — so a 39-year-old with PCOS + peri-menopause lost
  // peri entirely and received a PCOS-only kit/diagnosis/PDF (the Rohini case).
  //
  // Both reported conditions are now RETAINED. The two hormonal-axis kits are
  // NOT auto-co-dispensed: the pair is assessed for ingredient/axis overlap and
  // routed to the doctor, who approves co-prescription, a swap, or one kit.
  // buildKitSequence holds the non-primary kit out of the auto sequence on the
  // strength of the overlap recorded here. Age informs only the non-binding
  // default primary (see assessHormonalAxisOverlap) — it never discards.
  //
  // POST supersedes PERI within the continuum first (below), so at most one
  // menopause-continuum condition pairs with PCOS here.
  if (has('PERI_MENOPAUSE') && has('POST_MENOPAUSE')) {
    drop('PERI_MENOPAUSE', 'MENO_STAGE: post-menopause supersedes peri-menopause.');
  }
  if (has('PCOS') && (has('PERI_MENOPAUSE') || has('POST_MENOPAUSE'))) {
    const meno: ConditionId = has('POST_MENOPAUSE') ? 'POST_MENOPAUSE' : 'PERI_MENOPAUSE';
    const overlap = assessHormonalAxisOverlap('PCOS', meno, flags);
    overlaps.push(overlap);
    applied.push(overlap.auditLine);
    // Deliberately NO drop() — both conditions survive into the diagnosis,
    // protocol label, doctor-review payload and PDF.
  }

  // ── PCOS + HYPOTHYROID → single plain META B (Rule 3b, locked) ─────────────
  // 3-axis integrated kit covers AMPK/insulin + androgen + T3.
  if (has('PCOS') && has('HYPOTHYROID')) {
    drop('HYPOTHYROID', 'PCOS_HYPO_UNIFY: PCOS + Hypothyroid → single plain PRO FACT META B (3-axis kit).');
    kitOverride['PCOS'] = 'PRO FACT META B';
    applied.push('PCOS_HYPO_UNIFY: PCOS META B variant collapsed to plain PRO FACT META B.');
  }

  // ── HYPOTHYROID + METABOLIC → plain META B (Rule 1, locked) ────────────────
  // Integrated kit covers T3 + insulin/adipose; avoids AMPK/Berberine/NMN dup.
  if (has('HYPOTHYROID') && has('METABOLIC')) {
    drop('HYPOTHYROID', 'HYPO_METABOLIC: Hypothyroid + metabolic → plain PRO FACT META B (METABOLIC kit covers both).');
  }

  // ── HYPOTHYROID + POST-MENOPAUSE → post-menopause kit carries metabolic ────
  // POST_MENOPAUSE → PRO FACT META B POSTMENOPAUSE (a META B variant that
  // covers T3 + AMPK/insulin). HYPOTHYROID is redundant there.
  //
  // PERI_MENOPAUSE → HAIR FACT PERI MENOPAUSE (a hormonal-driver kit for
  // estrogen/androgen balance — NOT a META B variant, does NOT cover T3).
  // Declared hypothyroidism must still get PRO FACT META B HYPOTHYROID
  // alongside the peri kit, otherwise the T3 metabolic axis is left
  // untreated. Fixed 2026-08-10 — earlier rule dropped hypothyroid for both
  // peri and post, causing thyroid to be silently missed on peri patients
  // (e.g. tests/fixtures/patients/hypothyroid_peri_menopause_01.json,
  // whose fixture description explicitly locks in the expectation).
  if (has('HYPOTHYROID') && has('POST_MENOPAUSE')) {
    drop('HYPOTHYROID', 'HYPO_POSTMENO: post-menopause META B kit already carries the T3 metabolic axis — hypothyroid variant dropped.');
  }

  // ── PCOS supersedes generic METABOLIC (META B PCOS covers metabolic) ───────
  if (has('PCOS') && has('METABOLIC')) {
    drop('METABOLIC', 'PCOS_METABOLIC: PRO FACT META B PCOS already covers the metabolic axis.');
  }

  // ── POST-MENOPAUSE supersedes generic METABOLIC ────────────────────────────
  if (has('POST_MENOPAUSE') && has('METABOLIC')) {
    drop('METABOLIC', 'POSTMENO_METABOLIC: post-menopause META B already covers the metabolic axis.');
  }

  // ── GUT supersedes ACUTE_SHEDDING (Rule 5, locked) ─────────────────────────
  if (has('GUT_DYSFUNCTION') && has('ACUTE_SHEDDING')) {
    drop('ACUTE_SHEDDING', 'GI_SUPERSEDES_TE: GI GOLD restores absorption → covers TE GOLD biology. TE GOLD dropped.');
  }

  // ── SCALP_INFLAMMATION (Phenotype) supersedes HAIR_BREAKAGE (Rule 7) ────────
  if (has('SCALP_INFLAMMATION') && has('HAIR_BREAKAGE')) {
    drop('HAIR_BREAKAGE', 'PHENOTYPE_SUPERSEDES_HBR: Phenotype Inflammation covers shaft-damage biology. HBR dropped.');
  }

  // ── SCALP_INFLAMMATION (Phenotype) supersedes OXIDATIVE_STRESS ─────────────
  if (has('SCALP_INFLAMMATION') && has('OXIDATIVE_STRESS')) {
    drop('OXIDATIVE_STRESS', 'PHENOTYPE_SUPERSEDES_OXIDATIVE: Phenotype covers the shared NAC/Resveratrol/Quercetin pathway.');
  }

  // ── ALOPECIA AREATA is root-cause: it does not strip others, but it leads ──
  // (sequencing handled by kitPrioritizer ROOT_CAUSE_HEAD).

  return { conditions: [...c], kitOverride, applied, overlaps };
}

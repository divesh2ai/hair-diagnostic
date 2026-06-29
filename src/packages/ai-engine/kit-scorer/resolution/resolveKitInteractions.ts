import type { KitId } from '../../../types';
import type { ClinicalFlags } from '../../clinical-engine/types';
import type { ConditionId } from '../registry/conditionKitRegistry';

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
}

export function resolveKitInteractions(
  detected: Set<ConditionId>,
  flags: ClinicalFlags,
): ResolutionResult {
  const c = new Set(detected);
  const kitOverride: Partial<Record<ConditionId, KitId>> = {};
  const applied: string[] = [];

  const has = (id: ConditionId) => c.has(id);
  const drop = (id: ConditionId, why: string) => {
    if (c.delete(id)) applied.push(why);
  };

  // ── PREGNANCY — exclusive. Strip everything else (safety lock). ─────────────
  if (has('PREGNANCY')) {
    applied.push('PREGNANCY_LOCK: pregnancy is exclusive — all other kits suppressed.');
    return { conditions: ['PREGNANCY'], kitOverride, applied };
  }

  // ── PERI/POST-MENOPAUSE vs PCOS — age-gated mutex (Rule 6, locked) ──────────
  //   age < 40   → PCOS wins, menopause continuum stripped
  //   age 40–49  → PERI wins, PCOS stripped
  //   age ≥ 50   → POST/MENO wins, PCOS stripped
  if (has('PCOS') && (has('PERI_MENOPAUSE') || has('POST_MENOPAUSE'))) {
    if (flags.age < 40) {
      drop('PERI_MENOPAUSE', 'MENO_PCOS_MUTEX: age < 40 → PCOS wins, peri-menopause kit stripped.');
      drop('POST_MENOPAUSE', 'MENO_PCOS_MUTEX: age < 40 → PCOS wins, post-menopause kit stripped.');
    } else if (flags.age < 50) {
      drop('PCOS', 'MENO_PCOS_MUTEX: age 40–49 → peri-menopause wins, PCOS kit stripped.');
      drop('POST_MENOPAUSE', 'MENO_PCOS_MUTEX: age 40–49 → peri-menopause wins, post-menopause stripped.');
    } else {
      drop('PCOS', 'MENO_PCOS_MUTEX: age ≥ 50 → menopause continuum wins, PCOS kit stripped.');
    }
  }

  // ── POST supersedes PERI when both present (later stage governs) ────────────
  if (has('PERI_MENOPAUSE') && has('POST_MENOPAUSE')) {
    drop('PERI_MENOPAUSE', 'MENO_STAGE: post-menopause supersedes peri-menopause.');
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

  // ── HYPOTHYROID + menopause kit → menopause kit carries metabolic ──────────
  if (has('HYPOTHYROID') && (has('PERI_MENOPAUSE') || has('POST_MENOPAUSE'))) {
    drop('HYPOTHYROID', 'HYPO_MENO: menopause kit already carries metabolic correction — hypothyroid variant dropped.');
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

  return { conditions: [...c], kitOverride, applied };
}

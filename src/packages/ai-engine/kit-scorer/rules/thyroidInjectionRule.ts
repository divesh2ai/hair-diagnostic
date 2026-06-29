import type { PatientAnswers, KitId } from '../../../types';
import type { KitScorerContext } from '../types';
import { signals } from '../../clinical-engine/signals';

// ─────────────────────────────────────────────────────────────────────────────
// Thyroid injection rule (locked clinical rule 2026-06-17).
//
// Thyroid is disease-tier and non-negotiable — the kit must appear whenever
// the patient declares the corresponding thyroid signal, regardless of which
// primary diagnosis wins the score race.
//
// Locked clinical decisions:
//   • Hypothyroid + PCOS → single plain PRO FACT META B.
//     Rationale: PCOS already carries the weight-gain factor inherently, so
//     PCOS + Hypothyroid is the disease combo where the 3-axis integrated
//     META B (AMPK/insulin + androgen + T3) covers all three pathways in one
//     kit. PRO FACT META B PCOS and PRO FACT META B HYPOTHYROID are both
//     stripped to avoid duplication.
//
//   • Hypothyroid alone with no META B variant present → PRO FACT META B
//     HYPOTHYROID injected. Single-disease metabolic correction.
//
//   • Hypothyroid alone with plain PRO FACT META B already present (typically
//     from metabolicModifierRule when obesity / sedentary signal is also
//     declared) → leave it. The 2-condition integrated kit already covers
//     T3 + insulin/adipose. Adding META B HYPOTHYROID alongside would
//     duplicate the AMPK / Berberine / NMN pathway.
//
//   • Hypothyroid alongside the menopause-continuum kits (META B MENOPAUSE /
//     POSTMENOPAUSE) → leave the menopause kit. It already carries the
//     metabolic correction the patient needs; META B HYPOTHYROID would
//     duplicate.
//
//   • Hyperthyroid declared → PRO FACT THYROID CARE injected. This kit
//     targets a distinct biology (hyperthyroid oxidative / metabolic
//     overactivity) and does not overlap with the META B family.
//
// Idempotent. Runs irrespective of primary diagnosis.
// ─────────────────────────────────────────────────────────────────────────────

const META_B_PLAIN: KitId = 'PRO FACT META B';
const META_B_PCOS: KitId = 'PRO FACT META B PCOS';
const META_B_HYPO: KitId = 'PRO FACT META B HYPOTHYROID';
const META_B_MENO: KitId = 'PRO FACT META B MENOPAUSE';
const META_B_POST: KitId = 'PRO FACT META B POSTMENOPAUSE';
const THYROID_CARE: KitId = 'PRO FACT THYROID CARE';

function hasHypothyroidSignal(ans: PatientAnswers): boolean {
  const s = signals(ans);
  return s.thyroid('Hypothyroidism') || s.hormonal('Hypothyroidism');
}

function hasHyperthyroidSignal(ans: PatientAnswers): boolean {
  const s = signals(ans);
  return s.thyroid('Hyperthyroidism') || s.hormonal('Hyperthyroidism');
}

function hasPcosSignal(ans: PatientAnswers): boolean {
  const s = signals(ans);
  return s.hormonal('PCOS') || s.hormonal('PMOS') || s.hormonal('PCOD');
}

export function applyThyroidInjectionRule(
  ctx: KitScorerContext,
  ans: PatientAnswers,
): KitScorerContext {
  const hypo = hasHypothyroidSignal(ans);
  const hyper = hasHyperthyroidSignal(ans);
  if (!hypo && !hyper) return ctx;

  let phases = [...ctx.phases];
  const rules: string[] = [];

  // ── Hyperthyroid: inject PRO FACT THYROID CARE if missing.
  if (hyper && !phases.includes(THYROID_CARE)) {
    phases.push(THYROID_CARE);
    rules.push(
      `THYROID_INJECTION: ${THYROID_CARE} injected — Hyperthyroidism declared. Non-negotiable disease kit.`,
    );
  }

  // ── Hypothyroid: handle in order of precedence.
  if (hypo) {
    const pcos = hasPcosSignal(ans);

    if (pcos) {
      // PCOS + Hypo → collapse to plain PRO FACT META B (3-axis integrated kit).
      const hadPcosVariant = phases.includes(META_B_PCOS);
      const hadHypoVariant = phases.includes(META_B_HYPO);
      if (hadPcosVariant || hadHypoVariant || !phases.includes(META_B_PLAIN)) {
        phases = phases.filter((k) => k !== META_B_PCOS && k !== META_B_HYPO);
        if (!phases.includes(META_B_PLAIN)) {
          phases.unshift(META_B_PLAIN);
        }
        rules.push(
          'THYROID_PCOS_UNIFICATION: PCOS + Hypothyroid → single PRO FACT META B. ' +
            'Covers AMPK/insulin + androgen + T3 axes in one kit. ' +
            'META B PCOS / META B HYPOTHYROID stripped to avoid pathway duplication. ' +
            '(Locked rule 2026-06-17.)',
        );
      }
    } else {
      // No PCOS. Defer to existing META B variant if present (plain / MENO / POST
      // all cover hypothyroid metabolic axis adequately). Otherwise inject
      // META B HYPOTHYROID.
      const hasAnyMetaBVariant =
        phases.includes(META_B_PLAIN) ||
        phases.includes(META_B_HYPO) ||
        phases.includes(META_B_MENO) ||
        phases.includes(META_B_POST);
      if (!hasAnyMetaBVariant) {
        phases.push(META_B_HYPO);
        rules.push(
          `THYROID_INJECTION: ${META_B_HYPO} injected — Hypothyroidism declared and no META B variant present. Non-negotiable disease kit.`,
        );
      }
    }
  }

  if (rules.length === 0) return ctx;
  return { ...ctx, phases, appliedRules: [...ctx.appliedRules, ...rules] };
}

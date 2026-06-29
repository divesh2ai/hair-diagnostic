import type { PatientAnswers, KitId } from '../../../types';
import type { KitScorerContext } from '../types';
import { signals } from '../../clinical-engine/signals';

// ─────────────────────────────────────────────────────────────────────────────
// Menopause continuum injection rule (locked clinical rule 2026-06-14).
//
// The menopause continuum kits (PERI / MENO / POST) are non-negotiable disease
// kits — they must appear whenever the patient declares the corresponding
// hormonal signal, regardless of which primary diagnosis wins the score race.
//
// Locked age gates (mutex with PCOS — both kits cannot co-prescribe):
//   age < 40              → PCOS wins; strip PERI/POST
//   age 40-49             → PERI wins; strip META B PCOS
//   age ≥ 55 + Post-meno  → POST-MENOPAUSE wins; strip META B PCOS
//
// Bare 'Menopause' hormonal option retired 2026-06-15 — no MENO trigger arm.
// MENO_KIT constant retained in ALL_MENOPAUSE_KITS for defensive cleanup only.
//
// Patient's hormonal selection determines WHICH menopause kit (Peri/Meno/Post);
// age determines whether the menopause-continuum path or PCOS path applies.
//
// Idempotent. Runs irrespective of primary diagnosis.
// ─────────────────────────────────────────────────────────────────────────────

const PERI_KIT: KitId = 'HAIR FACT PERI MENOPAUSE';
const MENO_KIT: KitId = 'PRO FACT META B MENOPAUSE';
const POST_KIT: KitId = 'PRO FACT META B POSTMENOPAUSE';
const META_B_PCOS: KitId = 'PRO FACT META B PCOS';

const ALL_MENOPAUSE_KITS: KitId[] = [PERI_KIT, MENO_KIT, POST_KIT, 'HAIR FACT PERI MENOPAUSE VEG'];

function hasPeriSignal(ans: PatientAnswers): boolean {
  const s = signals(ans);
  // Avoid bare 'peri' — collides with "Heavy bleeding periods" (locked 2026-06-15).
  return (
    s.hormonal('Peri-menopause') || s.hormonal('Peri menopause') ||
    s.hormonal('Perimenopause')   || s.hormonal('Peri-Menopause')
  );
}

function hasPostMenopauseSignal(ans: PatientAnswers): boolean {
  const s = signals(ans);
  return (
    s.hormonal('Post-menopause') || s.hormonal('Post menopause') ||
    s.hormonal('Post-Menopause')
  );
}

function hasPcosSignal(ans: PatientAnswers): boolean {
  const s = signals(ans);
  return s.hormonal('PCOS') || s.hormonal('PMOS') || s.hormonal('PCOD');
}

export function applyMenopauseContinuumInjectionRule(
  ctx: KitScorerContext,
  ans: PatientAnswers,
): KitScorerContext {
  const age = ctx.flags.age ?? 0;
  const peri = hasPeriSignal(ans);
  const post = hasPostMenopauseSignal(ans);
  const pcos = hasPcosSignal(ans);

  if (!peri && !post && !pcos) return ctx;

  let phases = [...ctx.phases];
  const rules: string[] = [];

  // ── Determine which menopause-continuum kit the patient's selection demands.
  // Priority within the continuum: POST > PERI (latest stage wins). Bare
  // 'Menopause' option retired 2026-06-15 — no MENO arm.
  let demandedKit: KitId | null = null;
  if (post && age >= 55)      demandedKit = POST_KIT;
  else if (peri && age >= 40 && age < 50) demandedKit = PERI_KIT;
  // Note: Peri selected but age < 40 → no PERI kit; PCOS path applies if PCOS present.
  // Note: Peri selected at age ≥ 50 → patient is past peri; do not inject PERI.

  // ── PCOS vs menopause mutex (locked age gates).
  if (pcos && demandedKit !== null) {
    // Patient is in menopause age window → strip META B PCOS, menopause wins.
    if (phases.includes(META_B_PCOS)) {
      phases = phases.filter((k) => k !== META_B_PCOS);
      rules.push(
        `MENOPAUSE_VS_PCOS: age ${age} — menopause continuum wins. PRO FACT META B PCOS stripped to avoid hormonal-axis kit duplication.`,
      );
    }
  } else if (pcos && demandedKit === null && age < 40) {
    // Patient is in PCOS age window → strip any menopause kit that may have
    // leaked in from base sequences; PCOS path applies.
    const before = phases.length;
    phases = phases.filter((k) => !ALL_MENOPAUSE_KITS.includes(k));
    if (phases.length < before) {
      rules.push(
        `PCOS_VS_MENOPAUSE: age ${age} (< 40) — PCOS wins. Menopause-continuum kits stripped.`,
      );
    }
  }

  // ── Inject demanded menopause kit when not already present.
  if (demandedKit !== null && !phases.includes(demandedKit)) {
    // Strip the other menopause kits before injection — only one continuum kit at a time.
    phases = phases.filter((k) => !ALL_MENOPAUSE_KITS.includes(k));
    phases.push(demandedKit);
    rules.push(
      `MENOPAUSE_CONTINUUM_INJECTION: ${demandedKit} injected — patient declared the corresponding hormonal signal at age ${age}. Non-negotiable disease kit.`,
    );
  }

  if (rules.length === 0) return ctx;
  return { ...ctx, phases, appliedRules: [...ctx.appliedRules, ...rules] };
}

/**
 * Topical Recommendation Engine.
 *
 * Source of truth: the doctor-authored protocol table (gender × age bracket ×
 * grade × scalp condition × key conditions → recommended treatment) and the
 * supporting scalp/age/finasteride override rules.
 *
 *   Male <25, 25–55, >55, >60, <18
 *   Female <30, >30 (Grade 1–2 / Grade ≥3 / hormonal split)
 *   Special tracks: hypertension, peri/menopause/post-menopause, PCOS,
 *                   PCOD facial hair, frizzy hair
 *
 * Strict overrides (always applied — never bypassed):
 *   · Pregnancy / planning pregnancy → no topicals (consultation only)
 *   · Hypertension → no Minoxidil (topical or oral)
 *   · Dry / itchy / dandruff scalp → AVOID topical Minoxidil; replace with
 *     Emugrow MCRD (male / female >30) or Emugrow MCR (female <30)
 *   · Psoriasis / inflammation → prioritise Emugrow MCRD (or MCR <30)
 *   · Frizzy hair → avoid alcohol-heavy formulations
 *
 * Auto-injects (added after the branch fires, unless an override blocked them):
 *   · F-Biwash+ on any dandruff / itching / psoriasis scalp
 *   · F-Trichosilk D&F (With/Without Treatment) on dry / frizzy hair
 *
 * Output capped at 6 recommended + 4 cautions. Pure function, no side effects.
 */

import type { PatientAnswers } from "../../types";
import { getTopicalProduct } from "./products";
import {
  evaluateSafety,
  type SafetyEvaluationResult,
} from "../../ai-engine/safety-evaluator";

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface TopicalRec {
  name: string;
  usage: string;
  note: string;
  whySelected: string;
}

export interface TopicalCaution {
  name: string;
  reason: string;
}

export interface TopicalDecision {
  recommended: TopicalRec[];
  cautions: TopicalCaution[];
  /** Which decision branch fired — useful for debugging / audit. */
  branchId: string;
  /**
   * Canonical safety / eligibility evaluation. Same evaluator consumed by
   * kit selection. Downstream consumers should present `doctorView` on the
   * doctor dashboard and `patientView` on the patient report. Do not
   * re-derive pregnancy / hypertension / finasteride / age gates outside
   * this field.
   */
  safety?: SafetyEvaluationResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// Patient normalisation
// ─────────────────────────────────────────────────────────────────────────────

interface NormalisedPatient {
  gender: "male" | "female" | "other";
  age: number;
  scalpTokens: string[];
  hormonalIssues: string[];
  isPregnant: boolean;
  planningPregnancy: boolean;
  hasHypertension: boolean;
  hasDandruffItchingCombo: boolean;
  hasPsoriasis: boolean;
  /** Concatenated lowercased text of all answers — for regex scans. */
  answerText: string;
}

function tokeniseScalp(raw: string[]): string[] {
  const out = new Set<string>();
  for (const item of raw ?? []) {
    const s = item.toLowerCase();
    if (/dandruff|flake/.test(s)) out.add("dandruff");
    if (/itch/.test(s)) out.add("itching");
    if (/oily/.test(s)) out.add("oily");
    if (/dry/.test(s)) out.add("dry");
    if (/sens/.test(s)) out.add("sensitive");
    if (/psoriasis/.test(s)) {
      out.add("psoriasis");
      out.add("inflammation");
      out.add("sensitive");
    }
    if (/red|irrit|burn|boil|pimple/.test(s)) {
      out.add("sensitive");
      out.add("inflammation");
    }
    if (/fungal/.test(s)) out.add("fungal");
    if (/normal/.test(s)) out.add("normal");
  }
  if (out.size === 0) out.add("normal");
  return Array.from(out);
}

function deriveHormonalIssues(ans: PatientAnswers): string[] {
  const out: string[] = [];
  const text = [
    ...(ans.hormonal ?? []),
    ...(ans.hormonal_issues ?? []),
    ...(Array.isArray(ans.thyroid) ? ans.thyroid : ans.thyroid ? [String(ans.thyroid)] : []),
  ]
    .join(" ")
    .toLowerCase();
  if (/pcos|pcod/.test(text)) out.push("pcos");
  if (/thyroid/.test(text)) out.push("thyroid");
  if (/postpartum|post-partum|post[- ]?delivery|feeding|lactat|breastfeed/.test(text)) {
    out.push("postpartum");
  }
  if (/post[\s-]?menopaus/.test(text)) out.push("post_menopause");
  else if (/peri[\s-]?meno/.test(text)) out.push("peri_menopause");
  else if (/menopaus/.test(text)) out.push("menopause");
  if (/pregnan/.test(text)) out.push("pregnancy");
  if (/endometr/.test(text)) out.push("endometriosis");
  return out;
}

function normalisePatient(
  patient: { age: number; sex: string },
  ans: PatientAnswers,
): NormalisedPatient {
  const rawGender = (ans.gender ?? ans.sex ?? patient.sex ?? "").toString().toLowerCase();
  const gender: NormalisedPatient["gender"] = rawGender.includes("female")
    ? "female"
    : rawGender.includes("male")
    ? "male"
    : "other";

  const scalpTokens = tokeniseScalp(ans.scalp ?? []);
  const hormonalIssues = deriveHormonalIssues(ans);

  const isPregnant = !!ans.is_pregnant || hormonalIssues.includes("pregnancy");
  const planningPregnancy =
    !!ans.planning_pregnancy ||
    /planning.*conceiv|trying.*conceiv|trying.*pregn/i.test(ans.medical_detail ?? "");

  const answerText = JSON.stringify(ans).toLowerCase();
  const hasHypertension =
    !!ans.hasHypertension || /hypertension|blood pressure|\bbp\b|antihypertensive/.test(answerText);

  const hasDandruffItchingCombo = (ans.scalp ?? []).some(
    (s) => /dandruff/i.test(s) && /itch/i.test(s),
  );
  const hasPsoriasis = (ans.scalp ?? []).some((s) => /psoriasis/i.test(s));

  return {
    gender,
    age: typeof patient.age === "number" ? patient.age : parseInt(String(patient.age), 10) || 0,
    scalpTokens,
    hormonalIssues,
    isPregnant,
    planningPregnancy,
    hasHypertension,
    hasDandruffItchingCombo,
    hasPsoriasis,
    answerText,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — derived flags
// ─────────────────────────────────────────────────────────────────────────────

interface Flags {
  /** Dry / dandruff / itching — any subset that triggers the "avoid topical Minoxidil" override. */
  isDryDandruff: boolean;
  /** Any inflammation that triggers Emugrow MCRD preference. */
  isInflamed: boolean;
  isPsoriasis: boolean;
  isDandruffItching: boolean;
  /** Lifestyle markers raising effective androgen pressure. */
  isGymmer: boolean;
  /** PCOS / PCOD. */
  isPCOS: boolean;
  /** Peri-menopause (text matches peri). */
  isPeriMeno: boolean;
  /** Menopause (text matches menopause but not peri / not post). */
  isMeno: boolean;
  /** Post-menopause. */
  isPostMeno: boolean;
  /** Any female hormonal involvement (PCOS / thyroid / peri / meno / post / endometriosis). */
  hasHormonal: boolean;
  isPregnancy: boolean;
  isHypertension: boolean;
  /** Grade ≥3 (advanced). */
  isAdv: boolean;
  /** Patient explicitly reports facial hair / hirsutism. */
  hasFacialHair: boolean;
  /** Frizzy hair flag — triggers alcohol-heavy avoidance. */
  isFrizzy: boolean;
  /** Heat / chemical treatment history for F-Trichosilk variant selection. */
  hasHeatChemicalHistory: boolean;
  /** Patient reports topical intolerance or plateau (rare; from medical_detail). */
  hasTopicalIntolerance: boolean;
  hasPlateau: boolean;
}

function deriveFlags(p: NormalisedPatient, ans: PatientAnswers, gradeNum: number): Flags {
  const t = p.answerText;
  const has = (re: RegExp) => re.test(t);

  return {
    isDryDandruff:
      p.scalpTokens.some((s) => /dry|dandruff|itching/.test(s)) ||
      has(/frizzy|white flakes|excess dry/),
    isInflamed:
      p.scalpTokens.includes("inflammation") ||
      p.scalpTokens.includes("sensitive") ||
      has(/redness|irritation|burning|boils|pimples|psoriasis/),
    isPsoriasis: p.hasPsoriasis || has(/psoriasis/),
    isDandruffItching:
      p.hasDandruffItchingCombo ||
      (p.scalpTokens.includes("dandruff") && p.scalpTokens.includes("itching")),
    isGymmer: has(/gym|bodybuilding|heavy androgen|steroid/),
    isPCOS: p.hormonalIssues.includes("pcos") || has(/pcod/),
    isPeriMeno: p.hormonalIssues.includes("peri_menopause"),
    isMeno: p.hormonalIssues.includes("menopause"),
    isPostMeno: p.hormonalIssues.includes("post_menopause"),
    hasHormonal: p.hormonalIssues.filter((h) => h !== "pregnancy").length > 0,
    isPregnancy: p.isPregnant || p.planningPregnancy,
    isHypertension: p.hasHypertension,
    isAdv: gradeNum >= 3,
    hasFacialHair: has(/facial hair|hirsut|fha|trichonourish/),
    isFrizzy: has(/frizzy|frizz/),
    hasHeatChemicalHistory: (ans.treatment ?? []).some((tt) =>
      /heat|chemical|colour|color|keratin|straighten|bleach|perm/i.test(tt),
    ),
    hasTopicalIntolerance: has(/intoleran|sensitivity to minoxidil|reacts to minoxidil/),
    hasPlateau: has(/plateau|no response|stopped working|not working/),
  };
}

function parseGrade(ans: PatientAnswers): number {
  const m = String(ans.grade ?? "").match(/(\d)/);
  return m ? parseInt(m[1], 10) : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// rec / caution helpers
// ─────────────────────────────────────────────────────────────────────────────

function rec(
  out: TopicalRec[],
  seen: Set<string>,
  name: string,
  whySelected: string,
  usageOverride?: string,
  noteOverride?: string,
): void {
  if (seen.has(name)) return;
  if (out.length >= 6) return;
  const product = getTopicalProduct(name);
  out.push({
    name,
    usage: usageOverride ?? product?.usage ?? "Apply as directed by the doctor.",
    note: noteOverride ?? product?.note ?? "",
    whySelected,
  });
  seen.add(name);
}

function caution(out: TopicalCaution[], name: string, reason: string): void {
  if (out.length >= 4) return;
  if (out.some((c) => c.name === name)) return;
  out.push({ name, reason });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main engine — protocol table walker
// ─────────────────────────────────────────────────────────────────────────────

export function recommendTopicals(
  patient: { age: number; sex: string },
  ans: PatientAnswers,
): TopicalDecision {
  const p = normalisePatient(patient, ans);
  const gradeNum = parseGrade(ans);
  const f = deriveFlags(p, ans, gradeNum);

  const recommended: TopicalRec[] = [];
  const cautions: TopicalCaution[] = [];
  const seen = new Set<string>();
  let branchId = "FALLBACK";

  // ────────────────────────────────────────────────────────────────────────
  // CANONICAL SAFETY EVALUATOR — pregnancy / planning-pregnancy / hypertension /
  // finasteride / age gates run here. This is the single source of truth,
  // shared with kit selection. Local overrides ONLY translate evaluator
  // outputs into TopicalRec + TopicalCaution shape; they do NOT re-derive
  // any rule.
  // ────────────────────────────────────────────────────────────────────────
  const safetyInitial = evaluateSafety({
    answers: ans,
    patient,
    proposedKits: [],
  });

  if (safetyInitial.findings.some((x) => x.ruleId === 'SAFETY_PREGNANCY_KIT_LOCK')) {
    branchId = "PREGNANCY_OVERRIDE";
    caution(
      cautions,
      "Minoxidil / Finasteride / Dutasteride / Spironolactone topicals",
      "Pregnancy — no standard topical safe in pregnancy. Doctor consultation required.",
    );
    caution(
      cautions,
      "F-Emugrow MCRD",
      "Contains Dutasteride 0.5% — avoid in pregnancy or planning to conceive.",
    );
    return { recommended, cautions, branchId, safety: safetyInitial };
  }

  if (safetyInitial.findings.some((x) => x.ruleId === 'SAFETY_PLANNING_PREGNANCY_TOPICAL_BLOCK')) {
    branchId = "PLANNING_PREGNANCY_OVERRIDE";
    caution(
      cautions,
      "Minoxidil / Finasteride / Dutasteride / Spironolactone topicals",
      "Planning pregnancy — all Minoxidil, Finasteride, Dutasteride and anti-androgen topicals are contraindicated.",
    );
    caution(
      cautions,
      "F-Emugrow MCRD",
      "Contains Dutasteride 0.5% — avoid in pregnancy or planning to conceive.",
    );
    return { recommended, cautions, branchId, safety: safetyInitial };
  }

  if (safetyInitial.findings.some((x) => x.ruleId === 'SAFETY_HYPERTENSION_MINOXIDIL_BLOCK')) {
    branchId = "HYPERTENSION_OVERRIDE";
    rec(recommended, seen, "F-Emugrow MCRD",
      "Hypertension — Minoxidil is a vasodilator and is contraindicated. Non-Minoxidil pattern-loss formulation chosen.");
    rec(recommended, seen, "Trichogain Serum",
      "Hypertension — non-Minoxidil follicle support.");
    rec(recommended, seen, "CR Serum",
      "Hypertension — gentle non-Minoxidil topical, alternate day or night use.");
    caution(cautions, "Minoxidil (topical or oral)",
      "Hypertension — Minoxidil topical and oral both compound antihypertensive medication effects.");
    if (p.age > 60) {
      caution(cautions, "Oral Minoxidil",
        "Age >60 — high-risk cardiac. Avoid Oral Minoxidil unless mandatory cardiac evaluation cleared.");
    } else {
      caution(cautions, "Oral Minoxidil 1.25mg",
        "Only if BP is currently controlled and the doctor approves. Escalate to 2.5mg only at plateau.");
    }
    const decision = finaliseWithAutoInjects({ recommended, cautions, branchId }, p, ans, f);
    return applyEvaluatorPostFilter(decision, ans, patient);
  }

  // ────────────────────────────────────────────────────────────────────────
  // MALE <18 — Avoid Finasteride; mild non-hormonal only
  // ────────────────────────────────────────────────────────────────────────
  if (p.gender === "male" && p.age > 0 && p.age < 18) {
    if (!f.isAdv) {
      branchId = "MALE_UNDER_18_GRADE12";
      rec(recommended, seen, "F-Emugrow MCRD",
        "Under 18 — mild non-hormonal pattern-loss support indicated.",
        undefined,
        "Mild non-hormonal option for under-18 patients. Avoid Finasteride entirely.");
      rec(recommended, seen, "Trichogain Serum",
        "Under 18 — gentle non-hormonal alternative to topical Minoxidil.");
      caution(cautions, "Finasteride (any strength)",
        "Avoid Finasteride entirely under 18.");
    } else {
      branchId = "MALE_UNDER_18_ADV";
      rec(recommended, seen, "F-Emugrow MCRD",
        "Under 18 with advanced grade — strict doctor supervision required.");
      caution(cautions, "Finasteride (any strength)",
        "Avoid Finasteride entirely under 18.");
      caution(cautions, "Minoxidil 5%",
        "Cautious Minoxidil only under strict specialist supervision in advanced-grade pattern loss under 18.");
    }
    return applyEvaluatorPostFilter(
      finaliseWithAutoInjects({ recommended, cautions, branchId }, p, ans, f),
      ans,
      patient,
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // MALE >60 — Triple combo regardless of scalp / grade
  // ────────────────────────────────────────────────────────────────────────
  if (p.gender === "male" && p.age > 60) {
    branchId = "MALE_OVER_60";
    rec(recommended, seen, "Minoxidil 5%",
      "Male >60 — Minoxidil 5% follicle activator (standard component of the over-60 triple combo).");
    rec(recommended, seen, "Finasteride 2.5% Topical",
      "Male >60 — local DHT block at full topical strength to counter long-standing androgen pressure.");
    rec(recommended, seen, "F-Emugrow MCRD",
      "Male >60 — layered Dutasteride + Redensyl support alongside Minoxidil + Finasteride 2.5%.");
    caution(cautions, "Oral Minoxidil",
      "Age >60 — mandatory cardiac evaluation before initiation; high-risk cardiac patients should avoid.");
    return applyEvaluatorPostFilter(
      finaliseWithAutoInjects({ recommended, cautions, branchId }, p, ans, f),
      ans,
      patient,
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // MALE 18 → 60
  // ────────────────────────────────────────────────────────────────────────
  if (p.gender === "male" && p.age >= 18 && p.age <= 60) {
    const under25 = p.age < 25;
    const ageBracket = under25 ? "<25" : "25–55";

    // ── Scalp overrides first (dry/dandruff/psoriasis preempt Minoxidil) ─
    if (f.isPsoriasis) {
      branchId = `MALE_${ageBracket}_PSORIASIS`;
      rec(recommended, seen, "F-Emugrow MCRD",
        "Psoriatic / inflamed scalp — Minoxidil's alcohol vehicle strips epidermal barrier. F-Emugrow MCRD is non-alcohol, peptide-based and anti-inflammatory.");
      if (f.isAdv) {
        caution(cautions, "Finasteride 2.5% Topical (alternate day)",
          "Advanced grade with psoriasis — alternate-day Finasteride 2.5% gel for 3–4 months once inflammation is controlled.");
      }
      caution(cautions, "Oral Minoxidil 1.25mg",
        "Introduce only after scalp inflammation is controlled.");
      caution(cautions, "Topical Minoxidil 5%",
        "Avoid until psoriasis remission — risk of flare.");
      return applyEvaluatorPostFilter(
      finaliseWithAutoInjects({ recommended, cautions, branchId }, p, ans, f),
      ans,
      patient,
    );
    }

    if (f.isDandruffItching || (p.scalpTokens.includes("dry") && p.scalpTokens.includes("dandruff"))) {
      branchId = `MALE_${ageBracket}_DRY_DANDRUFF`;
      rec(recommended, seen, "F-Emugrow MCRD",
        "Excess dry / dandruff scalp — alcohol vehicle of topical Minoxidil worsens dryness and flaking. Replace with F-Emugrow MCRD.");
      if (f.isAdv) {
        rec(recommended, seen, "Finasteride 2.5% Topical",
          "Advanced grade with dry/dandruff scalp — alternate-day Finasteride 2.5% for 3–4 months alongside F-Emugrow MCRD.",
          "Apply on alternate days for 3–4 months, then re-evaluate. Doctor supervision required.");
      } else {
        rec(recommended, seen, "Trichogain Serum",
          "Excess dry / dandruff — alternate with F-Emugrow MCRD on non-Emugrow nights.");
      }
      caution(cautions, "Oral Minoxidil 1.25mg",
        "Doctor-decision adjunct when scalp is too dry / sensitive for topical Minoxidil. Escalate to 2.5mg only at plateau.");
      caution(cautions, "Topical Minoxidil",
        "Avoid topical Minoxidil — alcohol vehicle worsens dry / dandruff scalp.");
      return applyEvaluatorPostFilter(
      finaliseWithAutoInjects({ recommended, cautions, branchId }, p, ans, f),
      ans,
      patient,
    );
    }

    if (p.scalpTokens.includes("dry") || f.isInflamed) {
      branchId = `MALE_${ageBracket}_DRY_OR_INFLAMED`;
      rec(recommended, seen, "F-Emugrow MCRD",
        "Dry or inflamed scalp — non-alcohol vehicle preferred over topical Minoxidil.");
      if (f.isAdv) {
        rec(recommended, seen, "Finasteride 2.5% Topical",
          "Advanced grade — local DHT block alongside F-Emugrow MCRD.");
      }
      caution(cautions, "Oral Minoxidil 1.25mg",
        "Consider only if response plateaus and scalp is stable.");
      caution(cautions, "Topical Minoxidil",
        "Avoid until scalp barrier recovers.");
      return applyEvaluatorPostFilter(
      finaliseWithAutoInjects({ recommended, cautions, branchId }, p, ans, f),
      ans,
      patient,
    );
    }

    // ── Topical intolerance / plateau (oral pathway) ────────────────────
    if (f.hasTopicalIntolerance) {
      branchId = `MALE_${ageBracket}_TOPICAL_INTOLERANCE`;
      rec(recommended, seen, "Oral Minoxidil 1.25mg",
        "Topical intolerance reported — switch to systemic Minoxidil at 1.25mg under doctor supervision.");
      if (f.isAdv) {
        rec(recommended, seen, "Finasteride 0.25% Topical",
          "Advanced grade — pair with topical Finasteride gel if tolerated.");
      } else {
        rec(recommended, seen, "Finasteride 0.25% Topical",
          "Pair the systemic Minoxidil with low-strength topical Finasteride gel if tolerated.");
      }
      caution(cautions, "Oral Minoxidil 2.5mg",
        "Plateau escalation only.");
      return applyEvaluatorPostFilter(
      finaliseWithAutoInjects({ recommended, cautions, branchId }, p, ans, f),
      ans,
      patient,
    );
    }

    if (f.hasPlateau) {
      branchId = `MALE_${ageBracket}_PLATEAU`;
      rec(recommended, seen, "Finasteride 2.5% Topical",
        "Plateau on topical regimen — escalate to Finasteride 2.5% to drive a stronger DHT block.");
      rec(recommended, seen, "Oral Minoxidil 1.25mg",
        "Plateau escalation — start oral Minoxidil at 1.25mg under doctor supervision.");
      caution(cautions, "Oral Minoxidil 2.5mg",
        "Escalate to 2.5mg only if 1.25mg plateaus.");
      return applyEvaluatorPostFilter(
      finaliseWithAutoInjects({ recommended, cautions, branchId }, p, ans, f),
      ans,
      patient,
    );
    }

    // ── Normal / oily scalp — standard branches ─────────────────────────
    if (f.isGymmer) {
      branchId = `MALE_${ageBracket}_${f.isAdv ? "ADV" : "GRADE12"}_GYMMER`;
      rec(recommended, seen, "Minoxidil 5%",
        "Gymmer / high-androgen lifestyle — Minoxidil 5% follicle activator on a normal/oily scalp.");
      rec(recommended, seen, "Finasteride 2.5% Topical",
        "Heavy gym / high androgens — start Finasteride 2.5% topical for the first 3–4 months, then taper to 0.25%.");
      if (f.isAdv) {
        caution(cautions, "Oral Minoxidil 2.5mg",
          "Reserve for plateau escalation at 6 months.");
      }
      return applyEvaluatorPostFilter(
      finaliseWithAutoInjects({ recommended, cautions, branchId }, p, ans, f),
      ans,
      patient,
    );
    }

    if (f.isAdv) {
      // Grade ≥3 on normal-oily scalp
      const usesHighStrengthFin = !under25 || p.age >= 25;
      branchId = `MALE_${ageBracket}_ADV_STANDARD`;
      rec(recommended, seen, "Minoxidil 5%",
        "Advanced-grade pattern loss on a normal/oily scalp — first-line follicle activator.");
      rec(
        recommended,
        seen,
        usesHighStrengthFin ? "Finasteride 2.5% Topical" : "Finasteride 0.25% Topical",
        usesHighStrengthFin
          ? "Age ≥25 with advanced grade — prefer Finasteride 2.5% topical alongside Minoxidil."
          : "Standard topical DHT block alongside Minoxidil.",
      );
      caution(cautions, "Oral Minoxidil 1.25mg",
        "Plateau escalation at 6 months — start 1.25mg, escalate to 2.5mg only if needed.");
      return applyEvaluatorPostFilter(
      finaliseWithAutoInjects({ recommended, cautions, branchId }, p, ans, f),
      ans,
      patient,
    );
    }

    // Grade 1-2 on normal-oily scalp — standard case
    branchId = `MALE_${ageBracket}_GRADE12_STANDARD`;
    rec(recommended, seen, "Minoxidil 5%",
      under25
        ? "Under 25, early-grade pattern loss on a normal/oily scalp — first-line follicle activator."
        : "Early-grade pattern loss on a normal/oily scalp — first-line follicle activator.");
    rec(recommended, seen, "Finasteride 0.25% Topical",
      under25
        ? "Pair the Minoxidil activator with a low-strength topical DHT block (combo or separate)."
        : "Pair the Minoxidil activator with a low-strength topical DHT block (combo or separate).");
    caution(cautions, "Oral Minoxidil 1.25–2.5mg",
      "Switch to systemic Minoxidil only if topical intolerance is reported.");
    return applyEvaluatorPostFilter(
      finaliseWithAutoInjects({ recommended, cautions, branchId }, p, ans, f),
      ans,
      patient,
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // FEMALE branches
  // ────────────────────────────────────────────────────────────────────────
  if (p.gender === "female") {
    // ── Menopausal continuum (peri / meno / post) — anti-androgen track ─
    if (f.isPeriMeno || f.isMeno || f.isPostMeno) {
      const label = f.isPostMeno ? "POST_MENOPAUSE" : f.isMeno ? "MENOPAUSE" : "PERI_MENOPAUSE";
      branchId = `FEMALE_${label}`;
      rec(recommended, seen, "F-Trichosure Pro",
        "Menopausal continuum — anti-androgen track preferred at this hormonal stage.");
      rec(recommended, seen, "F-Emugrow MCRD",
        "Menopausal continuum — layered Dutasteride + Redensyl follicle activation.");
      rec(recommended, seen, "Oral Minoxidil + Spironolactone",
        "Menopausal continuum — systemic anti-androgen + Minoxidil for advanced or refractory thinning.");
      return applyEvaluatorPostFilter(
      finaliseWithAutoInjects({ recommended, cautions, branchId }, p, ans, f),
      ans,
      patient,
    );
    }

    // ── PCOS / facial hair tracks ─────────────────────────────────────────
    if (f.isPCOS || f.hasFacialHair) {
      branchId = p.age < 30 ? "FEMALE_PCOS_UNDER_30" : "FEMALE_PCOS_OVER_30";
      rec(recommended, seen, "Oral Minoxidil + Spironolactone",
        "PCOS / androgen excess — systemic Minoxidil + Spironolactone is the first-line female pattern-loss option.");
      rec(recommended, seen, "Oral Minoxidil + Bicalutamide",
        "PCOS — doctor-choice alternative to Spironolactone.");
      if (f.hasFacialHair) {
        rec(recommended, seen, "Trichonourish EVA / FHA-Andro+",
          "Facial hair growth tendency — anti-androgen topical for facial follicles. Avoid in pregnancy.");
      }
      caution(cautions, "Minoxidil 2% + Finasteride 0.25% Topical",
        "Topical alternative when systemic anti-androgen is not chosen — doctor decision.");
      return applyEvaluatorPostFilter(
      finaliseWithAutoInjects({ recommended, cautions, branchId }, p, ans, f),
      ans,
      patient,
    );
    }

    // ── Scalp overrides ──────────────────────────────────────────────────
    if (f.isPsoriasis || (f.isDandruffItching) || (p.scalpTokens.includes("dry") && p.scalpTokens.includes("dandruff"))) {
      const isUnder30 = p.age < 30;
      const product = isUnder30 ? "F-Emugrow MCR" : "F-Emugrow MCRD";
      branchId = `FEMALE_${isUnder30 ? "UNDER_30" : "OVER_30"}_${f.isPsoriasis ? "PSORIASIS" : "DRY_DANDRUFF"}`;
      rec(recommended, seen, product,
        isUnder30
          ? "Under 30 with dry / dandruff / psoriatic scalp — non-irritant peptide vehicle (MCR variant, no Dutasteride). Avoid in pregnancy."
          : "Over 30 with dry / dandruff / psoriatic scalp — Dutasteride 0.5% + Redensyl 3% in a non-irritant vehicle. Avoid in pregnancy.");
      caution(cautions, "Minoxidil 2%",
        "Reintroduce only once the scalp barrier and dandruff are controlled.");
      if (f.isPsoriasis) {
        caution(cautions, "Topical Minoxidil",
          "Avoid on active psoriasis — risk of flare.");
      }
      return applyEvaluatorPostFilter(
      finaliseWithAutoInjects({ recommended, cautions, branchId }, p, ans, f),
      ans,
      patient,
    );
    }

    if (p.scalpTokens.includes("dry") || f.isInflamed) {
      const isUnder30 = p.age < 30;
      const product = isUnder30 ? "F-Emugrow MCR" : "F-Emugrow MCRD";
      branchId = `FEMALE_${isUnder30 ? "UNDER_30" : "OVER_30"}_DRY_OR_INFLAMED`;
      rec(recommended, seen, product,
        "Dry / inflamed scalp — replace alcohol-based Minoxidil with the non-irritant Emugrow vehicle. Avoid in pregnancy.");
      caution(cautions, "Minoxidil 2%",
        "Reintroduce once the scalp recovers.");
      return applyEvaluatorPostFilter(
      finaliseWithAutoInjects({ recommended, cautions, branchId }, p, ans, f),
      ans,
      patient,
    );
    }

    // ── Normal / oily scalp — age + grade matrix ────────────────────────
    if (p.age > 0 && p.age < 30) {
      branchId = "FEMALE_UNDER_30_NORMAL_OILY";
      rec(recommended, seen, "Minoxidil 2% Topical",
        "Female under 30 with early-grade pattern thinning on a normal/oily scalp — start with low-strength Minoxidil 2%.",
        "Apply once daily as directed. Upgrade to 5% or add Finasteride only if response is inadequate at 3 months.",
        "Doctor-choice starting strength under 30; titrate up only on inadequate response.");
      return applyEvaluatorPostFilter(
      finaliseWithAutoInjects({ recommended, cautions, branchId }, p, ans, f),
      ans,
      patient,
    );
    }

    if (p.age >= 30) {
      if (f.isAdv) {
        if (f.hasHormonal) {
          branchId = "FEMALE_OVER_30_ADV_HORMONAL";
          rec(recommended, seen, "Minoxidil 2% Topical",
            "Advanced-grade female pattern loss over 30 with hormonal involvement — use low-strength Minoxidil 2% to limit androgen amplification.");
          rec(recommended, seen, "Finasteride 0.25% Topical",
            "Pair Minoxidil with low-strength topical Finasteride gel (doctor choice).");
          rec(recommended, seen, "F-Emugrow MCRD",
            "Layered Dutasteride + Redensyl support for advanced hormonal cases. Avoid in pregnancy.");
        } else {
          branchId = "FEMALE_OVER_30_ADV_NO_HORMONAL";
          rec(recommended, seen, "Minoxidil 5%",
            "Advanced-grade female pattern loss over 30 without hormonal involvement — first-line follicle activator.");
          rec(recommended, seen, "Finasteride 0.25% Topical",
            "Pair Minoxidil 5% with topical Finasteride gel 0.25% (doctor choice).");
          rec(recommended, seen, "F-Emugrow MCRD",
            "Consider Dutasteride + Redensyl if response is slow. Avoid in pregnancy.");
        }
        return applyEvaluatorPostFilter(
      finaliseWithAutoInjects({ recommended, cautions, branchId }, p, ans, f),
      ans,
      patient,
    );
      }

      // Grade 1-2, age >=30, normal-oily
      if (f.hasHormonal) {
        branchId = "FEMALE_OVER_30_GRADE12_HORMONAL";
        rec(recommended, seen, "Minoxidil 5%",
          "Early-grade female pattern loss over 30 with hormonal involvement — Minoxidil 5% follicle activator.");
        rec(recommended, seen, "Finasteride 0.25% Topical",
          "Pair Minoxidil with topical Finasteride gel 0.25% (doctor choice).");
      } else {
        branchId = "FEMALE_OVER_30_GRADE12_NO_HORMONAL";
        rec(recommended, seen, "Minoxidil 5%",
          "Early-grade female pattern loss over 30 without hormonal involvement — Minoxidil 5% follicle activator.");
        rec(recommended, seen, "Finasteride 0.1% Gel",
          "Gentler topical DHT block (0.1% gel) for non-hormonal female cases — doctor choice between 0.1% and 0.25%.");
      }
      return applyEvaluatorPostFilter(
      finaliseWithAutoInjects({ recommended, cautions, branchId }, p, ans, f),
      ans,
      patient,
    );
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Fallback — only auto-injects (no branch matched)
  // ────────────────────────────────────────────────────────────────────────
  return applyEvaluatorPostFilter(
    finaliseWithAutoInjects({ recommended, cautions, branchId }, p, ans, f),
    ans,
    patient,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluator post-filter — runs the canonical safety evaluator against the
// proposed topical set and strips any product that appears in
// `blockedTopicals`, then attaches the full evaluation (findings, doctor +
// patient views) to the decision. This is the single point at which topical
// recommendations are reconciled against pregnancy / hypertension /
// finasteride / age gates.
// ─────────────────────────────────────────────────────────────────────────────
function applyEvaluatorPostFilter(
  decision: TopicalDecision,
  ans: PatientAnswers,
  patient: { age: number; sex: string },
): TopicalDecision {
  const proposedNames = decision.recommended.map((r) => r.name);
  const safety = evaluateSafety({
    answers: ans,
    patient,
    proposedKits: proposedNames,
  });
  const blocked = new Set(safety.blockedTopicals);
  if (blocked.size === 0) {
    return { ...decision, safety };
  }
  const filtered = decision.recommended.filter((r) => !blocked.has(r.name));
  return { ...decision, recommended: filtered, safety };
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-injects + frizzy hair guard
// ─────────────────────────────────────────────────────────────────────────────

function finaliseWithAutoInjects(
  decision: TopicalDecision,
  p: NormalisedPatient,
  ans: PatientAnswers,
  f: Flags,
): TopicalDecision {
  const seen = new Set(decision.recommended.map((r) => r.name));

  // AUTO_01 — F-Biwash+ on any dandruff / itching / psoriasis scalp.
  if (
    !f.isPregnancy &&
    (f.isDandruffItching ||
      f.isPsoriasis ||
      p.scalpTokens.some((s) => /dandruff|itching|psoriasis/.test(s)))
  ) {
    rec(decision.recommended, seen, "F-Biwash+ Anti-Dandruff Shampoo",
      "Medicated scalp cleansing — always added when the scalp microenvironment is compromised by dandruff, itching or psoriasis.");
  }

  // AUTO_02 — F-Trichosilk D&F on dry or frizzy hair (variant by treatment history).
  if (p.scalpTokens.includes("dry") || f.isFrizzy) {
    const variant = f.hasHeatChemicalHistory
      ? "F-Trichosilk D&F (With Treatment)"
      : "F-Trichosilk D&F (Without Treatment)";
    rec(decision.recommended, seen, variant,
      f.hasHeatChemicalHistory
        ? "Dry / frizzy hair with heat or chemical treatment history — daily leave-in heat-protectant serum."
        : "Dry / frizzy hair without heat or chemical history — daily leave-in conditioning serum.");
  }

  // Frizzy-hair guard — surface a caution against alcohol-heavy formulations.
  if (f.isFrizzy && decision.recommended.some((r) => /Minoxidil/i.test(r.name))) {
    caution(decision.cautions, "Alcohol-heavy Minoxidil formulations",
      "Frizzy hair reported — alcohol vehicles dry the cuticle further. Use the lowest tolerated strength or a non-alcohol vehicle (Emugrow).");
  }

  return decision;
}

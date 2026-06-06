// ─────────────────────────────────────────────────────────────────────────────
// Normalization Validator
// Validates that raw questionnaire answers are correctly mapped to normalized
// clinical profile fields with no lost clinical context.
// ─────────────────────────────────────────────────────────────────────────────

import type { PatientAnswers } from "../../packages/types";
import type {
  NormalizationValidationReport,
  NormalizationCheckResult,
} from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Core validation entry point
// ─────────────────────────────────────────────────────────────────────────────

export function validateNormalization(answers: PatientAnswers): NormalizationValidationReport {
  const checks: NormalizationCheckResult[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // Run all deterministic mapping checks
  checks.push(...validateSexMapping(answers));
  checks.push(...validateAgeMapping(answers));
  checks.push(...validateSeverityMapping(answers));
  checks.push(...validateHormonalSignalMapping(answers));
  checks.push(...validateThyroidSignalMapping(answers));
  checks.push(...validateScalpSignalMapping(answers));
  checks.push(...validateDeficiencyMapping(answers));
  checks.push(...validateLifestyleMapping(answers));
  checks.push(...validateImmunityMapping(answers));
  checks.push(...validateDietMapping(answers));
  checks.push(...validateGenderBranchingIntegrity(answers));

  // Collect errors and warnings
  for (const check of checks) {
    if (!check.passed) {
      if (check.reason?.startsWith("WARN:")) {
        warnings.push(`[${check.field}] ${check.reason.replace("WARN: ", "")}`);
      } else {
        errors.push(`[${check.field}] ${check.reason ?? "Validation failed"}`);
      }
    }
  }

  return {
    passed: errors.length === 0,
    checks,
    errors,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual field validators
// ─────────────────────────────────────────────────────────────────────────────

function validateSexMapping(answers: PatientAnswers): NormalizationCheckResult[] {
  const results: NormalizationCheckResult[] = [];
  const sex = String(answers.sex ?? "").toLowerCase();
  const valid = sex === "male" || sex === "female";
  results.push({
    field: "sex",
    input: answers.sex,
    output: sex,
    passed: valid,
    reason: valid ? undefined : "sex must normalize to 'male' or 'female'",
  });
  return results;
}

function validateAgeMapping(answers: PatientAnswers): NormalizationCheckResult[] {
  const age = Number(answers.age);
  const valid = !isNaN(age) && age >= 10 && age <= 100;
  return [{
    field: "age",
    input: answers.age,
    output: age,
    passed: valid,
    reason: valid ? undefined : `age "${answers.age}" is outside valid range (10–100)`,
  }];
}

function validateSeverityMapping(answers: PatientAnswers): NormalizationCheckResult[] {
  const count = String(answers.count ?? "").toLowerCase();
  const grade = String(answers.grade ?? "").toLowerCase();

  const knownCounts = [
    "less than 50", "50-100", "100-150", "more than 150",
    "thinning visible, minimal fall", "thinning only", "no visible fall"
  ];
  const hasSeveritySignal = knownCounts.some((c) => count.includes(c.substring(0, 8))) || grade.length > 0;
  return [{
    field: "count+grade → severity signal",
    input: { count: answers.count, grade: answers.grade },
    output: hasSeveritySignal ? "SEVERITY_DERIVABLE" : "SEVERITY_UNKNOWN",
    passed: hasSeveritySignal,
    reason: hasSeveritySignal ? undefined : "WARN: count/grade values are insufficient for severity derivation",
  }];
}

function validateHormonalSignalMapping(answers: PatientAnswers): NormalizationCheckResult[] {
  const results: NormalizationCheckResult[] = [];
  const sex = String(answers.sex ?? "").toLowerCase();

  // Females must have hormonal field parsed
  if (sex === "female") {
    const hormonal = answers.hormonal ?? [];
    const hormonalArr = Array.isArray(hormonal) ? hormonal : [hormonal];

    const knownSignals = ["pcos", "irregular_periods", "menopause", "peri_menopause", "post_menopause"];
    const hasKnownSignal = hormonalArr.some((h) =>
      knownSignals.some((k) => String(h).toLowerCase().includes(k))
    );

    results.push({
      field: "hormonal (female)",
      input: hormonal,
      output: hormonalArr,
      passed: true, // Empty is valid — not every female has a hormonal condition
      reason: !hasKnownSignal && hormonalArr.length > 0
        ? "WARN: hormonal values present but none matched known clinical signals"
        : undefined,
    });

    // Pregnancy / postpartum field
    const hormonalIssues = answers.hormonal_issues ?? answers.hormonal ?? [];
    const issuesArr = Array.isArray(hormonalIssues) ? hormonalIssues : [hormonalIssues];
    const pregnancySignals = ["pregnant", "postpartum", "breastfeeding", "delivery", "planning"];
    const hasPregnancySignal = issuesArr.some((h) =>
      pregnancySignals.some((k) => String(h).toLowerCase().includes(k))
    );
    results.push({
      field: "hormonal_issues → pregnancy/postpartum",
      input: hormonalIssues,
      output: hasPregnancySignal ? "PREGNANCY_OR_POSTPARTUM_DETECTED" : "NONE",
      passed: true,
    });
  }

  // Males must NOT have hormonal data set — warn if they do
  if (sex === "male" && answers.hormonal && (answers.hormonal as string[]).length > 0) {
    results.push({
      field: "hormonal (male — should be empty)",
      input: answers.hormonal,
      output: "NON_EMPTY",
      passed: false,
      reason: "Male patients should not have hormonal field populated (branching violation)",
    });
  }

  return results;
}

function validateThyroidSignalMapping(answers: PatientAnswers): NormalizationCheckResult[] {
  const thyroid = answers.thyroid ?? [];
  const thyroidArr = Array.isArray(thyroid) ? thyroid : [thyroid];
  const knownSignals = ["hypothyroid", "hyperthyroid", "thyroid", "hashimoto", "graves"];
  const hasKnown = thyroidArr.some((t) =>
    knownSignals.some((k) => String(t).toLowerCase().includes(k))
  );
  return [{
    field: "thyroid",
    input: thyroid,
    output: hasKnown ? "THYROID_SIGNAL_DETECTED" : "NONE",
    passed: true,
    reason: !hasKnown && thyroidArr.filter(Boolean).length > 0
      ? "WARN: thyroid values present but none matched known clinical signals"
      : undefined,
  }];
}

function validateScalpSignalMapping(answers: PatientAnswers): NormalizationCheckResult[] {
  const scalp = answers.scalp ?? [];
  const scalpArr = Array.isArray(scalp) ? scalp : [scalp];
  const knownSignals = ["oily", "dry", "dandruff", "itchy", "inflamed", "psoriasis", "sensitive", "normal"];
  const allKnown = scalpArr.every((s) =>
    knownSignals.some((k) => String(s).toLowerCase().includes(k))
  );
  return [{
    field: "scalp",
    input: scalp,
    output: scalpArr,
    passed: allKnown || scalpArr.length === 0,
    reason: (!allKnown && scalpArr.length > 0)
      ? "WARN: one or more scalp values did not map to known clinical scalp states"
      : undefined,
  }];
}

function validateDeficiencyMapping(answers: PatientAnswers): NormalizationCheckResult[] {
  const def = answers.deficiency ?? [];
  const defArr = Array.isArray(def) ? def : [def];
  const knownDeficiencies = ["iron", "vit_d", "vitamin_d", "b12", "vit_b12", "zinc", "ferritin"];
  const allKnown = defArr.every((d) =>
    knownDeficiencies.some((k) => String(d).toLowerCase().includes(k))
  );
  return [{
    field: "deficiency",
    input: def,
    output: defArr,
    passed: allKnown || defArr.length === 0,
    reason: (!allKnown && defArr.length > 0)
      ? "WARN: one or more deficiency values did not match known clinical signals"
      : undefined,
  }];
}

function validateLifestyleMapping(answers: PatientAnswers): NormalizationCheckResult[] {
  const ls = answers.lifestyle ?? [];
  const lsArr = Array.isArray(ls) ? ls : [ls];
  const knownFactors = ["stress", "night_shift", "sedentary", "smoking", "alcohol", "frequent_flyer", "jet_lag"];
  const allKnown = lsArr.every((l) =>
    knownFactors.some((k) => String(l).toLowerCase().includes(k))
  );
  return [{
    field: "lifestyle",
    input: ls,
    output: lsArr,
    passed: allKnown || lsArr.length === 0,
    reason: (!allKnown && lsArr.length > 0)
      ? "WARN: one or more lifestyle values did not match known clinical factors"
      : undefined,
  }];
}

function validateImmunityMapping(answers: PatientAnswers): NormalizationCheckResult[] {
  const immunity = answers.immunity ?? [];
  const immArr = Array.isArray(immunity) ? immunity : [immunity];
  const knownSignals = ["illness", "autoimmune", "medication", "vaccination", "infection", "surgery"];
  const allKnown = immArr.every((i) =>
    knownSignals.some((k) => String(i).toLowerCase().includes(k))
  );
  return [{
    field: "immunity",
    input: immunity,
    output: immArr,
    passed: allKnown || immArr.length === 0,
    reason: (!allKnown && immArr.length > 0)
      ? "WARN: one or more immunity values did not match known clinical signals"
      : undefined,
  }];
}

function validateDietMapping(answers: PatientAnswers): NormalizationCheckResult[] {
  const diet = answers.diet ?? [];
  const dietArr = Array.isArray(diet) ? diet : [diet];
  const knownSignals = ["vegetarian", "vegan", "non_veg", "crash_diet", "keto", "intermittent", "balanced", "glp1", "ozempic", "wegovy"];
  const allKnown = dietArr.every((d) =>
    knownSignals.some((k) => String(d).toLowerCase().includes(k))
  );
  return [{
    field: "diet",
    input: diet,
    output: dietArr,
    passed: allKnown || dietArr.length === 0,
    reason: (!allKnown && dietArr.length > 0)
      ? "WARN: one or more diet values did not match known clinical signals"
      : undefined,
  }];
}

function validateGenderBranchingIntegrity(answers: PatientAnswers): NormalizationCheckResult[] {
  const results: NormalizationCheckResult[] = [];
  const sex = String(answers.sex ?? "").toLowerCase();

  // If male — hormonal fields must be empty
  if (sex === "male") {
    const hormonal = Array.isArray(answers.hormonal) ? answers.hormonal : [];
    const hormonalIssues = Array.isArray(answers.hormonal_issues) ? answers.hormonal_issues : [];
    results.push({
      field: "gender-branch integrity (male)",
      input: { hormonal, hormonal_issues: hormonalIssues },
      output: "MALE_BRANCH",
      passed: hormonal.length === 0 && hormonalIssues.length === 0,
      reason: (hormonal.length > 0 || hormonalIssues.length > 0)
        ? "Male patient has hormonal data — possible data contamination from a female branch"
        : undefined,
    });
  }

  return results;
}

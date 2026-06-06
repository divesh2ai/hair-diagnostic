/**
 * Validates narrative themes, required tokens, forbidden tokens, and
 * length floor across patient/doctor/scientific framings.
 */

import { ClinicalReplayCase, ReplayResult, ValidatorOutcome } from "../types";
import { finding, scoreOf, anyCritical } from "./utils";

const WORD_FLOOR = 25;

export function validateNarrative(
  c: ClinicalReplayCase,
  r: ReplayResult
): ValidatorOutcome {
  const findings = [];
  let lost = 0;
  const total = 100;
  const exp = c.expectedNarrativeThemes;
  const got = r.narrativeResult;
  const corpus = [got.patientFraming, got.doctorFraming, got.scientificFraming].join("\n").toLowerCase();

  // (50) themes
  const themeSlice = 50 / Math.max(1, exp.themes.length);
  for (const t of exp.themes) {
    if (!got.themes.includes(t)) {
      findings.push(finding(
        "NARRATIVE_THEME_MISSING", "minor", "NARRATIVE_FAILURE",
        t, got.themes,
        `Narrative theme "${t}" missing.`,
        t, "MISSING"
      ));
      lost += themeSlice;
    }
  }

  // (25) mustContainTokens
  const reqTokens = exp.mustContainTokens ?? [];
  const tokSlice = 25 / Math.max(1, reqTokens.length);
  for (const tok of reqTokens) {
    if (!corpus.includes(tok.toLowerCase())) {
      findings.push(finding(
        "NARRATIVE_TOKEN_MISSING", "minor", "NARRATIVE_FAILURE",
        tok, null,
        `Required narrative token "${tok}" missing.`,
        tok, "MISSING_TOKEN"
      ));
      lost += tokSlice;
    }
  }

  // (15) mustNotContainTokens — critical for safety
  for (const tok of (exp.mustNotContainTokens ?? [])) {
    if (corpus.includes(tok.toLowerCase())) {
      findings.push(finding(
        "NARRATIVE_TOKEN_FORBIDDEN", "critical", "NARRATIVE_FAILURE",
        `forbidden: ${tok}`, corpus,
        `Forbidden narrative token "${tok}" was present.`,
        tok, "FORBIDDEN_TOKEN"
      ));
      lost += 15;
    }
  }

  // (10) length floor
  for (const label of ["patientFraming", "doctorFraming", "scientificFraming"] as const) {
    const text = (got as unknown as Record<string, string>)[label] ?? "";
    const words = text.trim().split(/\s+/).length;
    if (words < WORD_FLOOR) {
      findings.push(finding(
        "NARRATIVE_TOO_SHORT", "minor", "NARRATIVE_FAILURE",
        `≥ ${WORD_FLOOR} words`, words,
        `${label} only ${words} words.`,
        label, "TOO_SHORT"
      ));
      lost += 5;
    }
  }

  const score = scoreOf(total, lost);
  return { pass: !anyCritical(findings) && score >= 70, score, findings };
}
